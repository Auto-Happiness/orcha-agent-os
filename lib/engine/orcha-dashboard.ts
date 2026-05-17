import { OrchaFusion } from "./orcha-fusion";
import { SqlRefiner } from "./sql-refiner";
import { DbExecutor } from "../db-executor";
import crypto from "crypto";

interface CacheEntry {
  timestamp: number;
  data: any;
}

/**
 * Specialized engine for handling heavy, multi-query dashboard executions.
 * Features a 5-minute TTL cache and safe batch processing.
 */
export class OrchaDashboard {
  private static cache = new Map<string, CacheEntry>();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private static generateCacheKey(dashboardId: string, queries: { id: string, sql: string }[]): string {
    const payload = JSON.stringify({
      dashboardId,
      queries: queries.map(q => ({ id: q.id, sql: q.sql.trim() })).sort((a, b) => a.id.localeCompare(b.id))
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private static sweepCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.cache.delete(key);
      }
    }
  }

  private static async runWithConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    const promises: Promise<void>[] = [];
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const currentIndex = index++;
        results[currentIndex] = await fn(items[currentIndex]);
      }
    }

    const poolSize = Math.min(limit, items.length);
    for (let i = 0; i < poolSize; i++) {
      promises.push(worker());
    }

    await Promise.all(promises);
    return results;
  }

  static async executeBatch(
    dashboardId: string,
    queries: { id: string, sql: string, defaultAlias?: string, queryName?: string, type?: string, rawDb?: string }[],
    dbConfigMap: Map<string, any>,
    aliasTableMap: Map<string, string[]>,
    aiKeys: any[],
    organizationId: string
  ): Promise<Record<string, { rows: any[], columns: string[], error?: string, queryName?: string }>> {

    this.sweepCache();

    // Check Cache
    const cacheKey = this.generateCacheKey(dashboardId, queries);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`[OrchaDashboard] Serving dashboard ${dashboardId} from cache (Key: ${cacheKey})`);
      return cached.data;
    }

    console.log(`[OrchaDashboard] Executing batch for dashboard ${dashboardId} (${queries.length} queries) with a concurrency limit of 3`);

    const results: Record<string, { rows: any[], columns: string[], error?: string, queryName?: string }> = {};

    // Execute queries with limited concurrency to avoid API rate limits and connection pooling exhaustion.
    await this.runWithConcurrencyLimit(queries, 3, async (q) => {
      // Declare sql outside try so the catch self-healing block can reference it
      let sql = q.sql;
      try {
        // --- STEP 1: AI REFINEMENT (Intelligent Translation) ---
        const aliases = Array.from(dbConfigMap.keys());
        sql = await SqlRefiner.refine(q.sql, aliases, q.defaultAlias, aliasTableMap, aiKeys, organizationId);
        
        // --- STEP 2: MANUAL QUALIFICATION (Safety Fallback) ---
        sql = sql.trim().replace(/;?\s*$/, "");
        
        // AUTO-QUALIFICATION & TRANSLATION
        if (q.defaultAlias) {
          const alias = q.defaultAlias;
          
          // 1. Swap RAW database name with alias if present (e.g., tapalord_enterprise.food -> alias.food)
          if (q.rawDb) {
            const rawDbRegex = new RegExp(`\\b${q.rawDb}\\.`, 'gi');
            sql = sql.replace(rawDbRegex, `${alias}.`);
          }

          // 2. Handle Postgres schema requirements (DuckDB ATTACH maps the DB, so we need alias.public.table)
          if (q.type === "postgres") {
             // If query has alias.table but no schema, inject .public.
             const pgRegex = new RegExp(`\\b${alias}\\.(?!public\\.)([a-zA-Z0-9_]+)`, 'gi');
             sql = sql.replace(pgRegex, `${alias}.public.$1`);
          }

          // 3. Qualify remaining bare table names (only if they don't have a period already)
          sql = sql.replace(/\bFROM\s+([a-zA-Z0-9_]+)\b(?!\.)/gi, `FROM ${alias}.$1`)
                   .replace(/\bJOIN\s+([a-zA-Z0-9_]+)\b(?!\.)/gi, `JOIN ${alias}.$1`);

          // 4. Final Postgres safety check for bare tables we just qualified
          if (q.type === "postgres") {
            const pgRegex2 = new RegExp(`\\bFROM\s+${alias}\\.(?!public\\.)([a-zA-Z0-9_]+)`, 'gi');
            const pgRegex3 = new RegExp(`\\bJOIN\s+${alias}\\.(?!public\\.)([a-zA-Z0-9_]+)`, 'gi');
            sql = sql.replace(pgRegex2, `FROM ${alias}.public.$1`)
                     .replace(pgRegex3, `JOIN ${alias}.public.$1`);
          }
        }

        // NORMALIZE MSSQL DIALECT — Two-pass correction:

        // Pass 1: Fix AI mistranslation: "SELECT LIMIT N col" → "SELECT col LIMIT N"
        // This happens when the LLM incorrectly converts "SELECT TOP N" into "SELECT LIMIT N col" 
        // instead of properly moving LIMIT to the end.
        const badLimitRegex = /^(SELECT\s+)LIMIT\s+(\d+)\s+/i;
        const badLimitMatch = sql.match(badLimitRegex);
        if (badLimitMatch) {
          const limit = badLimitMatch[2];
          sql = sql.replace(badLimitRegex, "SELECT ").trim() + ` LIMIT ${limit}`;
        }

        // Pass 2: Convert any remaining native "SELECT TOP N" to "SELECT ... LIMIT N"
        const topRegex = /^SELECT\s+TOP\s+(\d+)\s+/i;
        const topMatch = sql.match(topRegex);
        if (topMatch) {
          const limit = topMatch[1];
          sql = sql.replace(topRegex, "SELECT ").trim() + ` LIMIT ${limit}`;
        }

        // Ensure SQL has a final LIMIT to prevent massive payload transfers
        if (!/LIMIT\s+\d+/i.test(sql)) {
          sql = `SELECT * FROM (${sql}) AS _bi_source LIMIT 1000`;
        }

        const rows = await OrchaFusion.executeMulti(sql, dbConfigMap);
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

        results[q.id] = { rows, columns, queryName: q.queryName };
      } catch (err: any) {
        console.error(`[OrchaDashboard] Query ${q.id} failed:`, err.message);
        
        // SELF-HEALING RETRY MECHANISM:
        // If DuckDB throws a Catalog Error due to a hallucinated table name and suggests a correction,
        // we automatically rewrite the query using the suggested correct table and retry once!
        const selfHealMatch = err.message.match(/Table with name\s+["']?([a-zA-Z0-9_]+)["']?\s+does not exist!\s+Did you mean\s+["']?([a-zA-Z0-9_]+)["']?/i);
        if (selfHealMatch) {
          const nonexistentTable = selfHealMatch[1];
          const suggestedTable = selfHealMatch[2];
          console.warn(`[OrchaDashboard] Detected hallucinated table name "${nonexistentTable}". Self-healing query to use suggested correct table "${suggestedTable}" and retrying...`);
          
          try {
            // Replace the hallucinated table name with the suggested one
            const healedSql = sql.replace(new RegExp(`\\b${nonexistentTable}\\b`, 'g'), suggestedTable);
            console.log(`[OrchaDashboard] Retrying healed SQL: ${healedSql}`);
            const rows = await OrchaFusion.executeMulti(healedSql, dbConfigMap);
            const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
            results[q.id] = { rows, columns, queryName: q.queryName };
            return; // Exit success
          } catch (retryErr: any) {
            console.error(`[OrchaDashboard] Self-healing retry failed:`, retryErr.message);
          }
        }

        // On failure, return an empty set with an error so the rest of the dashboard still loads
        results[q.id] = { rows: [], columns: [], error: err.message, queryName: q.queryName };
      }
    });

    // Save to Cache
    this.cache.set(cacheKey, { timestamp: Date.now(), data: results });

    return results;
  }
}
