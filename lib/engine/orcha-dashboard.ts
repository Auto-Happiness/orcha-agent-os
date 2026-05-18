import { OrchaFusion } from "./orcha-fusion";
import { SqlRefiner } from "./sql-refiner";
import { DbExecutor } from "../db-executor";
import crypto from "crypto";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

interface CacheEntry {
  timestamp: number;
  data: any;
}

/**
 * Specialized engine for handling heavy, multi-query dashboard executions.
 *
 * Two-Tier Cache Strategy:
 *  L1 (In-Memory): Static process Map — zero-latency but wiped on cold starts.
 *  L2 (Convex DB): Persistent dashboardQueryCache table — survives all cold starts.
 *
 * On cache read:  L1 hit → return immediately. L1 miss → check L2 → populate L1.
 * On cache write: Write to L1 immediately, write to L2 asynchronously (fire-and-forget).
 */
export class OrchaDashboard {
  /** L1: process-level in-memory cache */
  private static l1Cache = new Map<string, CacheEntry>();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private static generateCacheKey(dashboardId: string, queries: { id: string, sql: string }[]): string {
    const payload = JSON.stringify({
      dashboardId,
      queries: queries.map(q => ({ id: q.id, sql: q.sql.trim() })).sort((a, b) => a.id.localeCompare(b.id))
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private static sweepL1Cache() {
    const now = Date.now();
    for (const [key, entry] of this.l1Cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.l1Cache.delete(key);
      }
    }
  }

  /** Reads from L2 Convex cache. Returns null on miss or error. */
  private static async readL2Cache(convex: ConvexHttpClient, cacheKey: string): Promise<any | null> {
    try {
      const raw = await convex.query(api.bi.getDashboardCache, { cacheKey });
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("[OrchaDashboard] L2 cache read failed (non-fatal):", (e as any).message);
      return null;
    }
  }

  /** Writes to L2 Convex cache asynchronously (fire-and-forget — never blocks execution). */
  private static writeL2Cache(
    convex: ConvexHttpClient,
    cacheKey: string,
    organizationId: string,
    data: any
  ): void {
    convex.mutation(api.bi.setDashboardCache, {
      cacheKey,
      organizationId: organizationId as any,
      data: JSON.stringify(data),
      ttlMs: this.CACHE_TTL_MS,
    }).catch((e: any) => {
      console.warn("[OrchaDashboard] L2 cache write failed (non-fatal):", e.message);
    });
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
    organizationId: string,
    convexToken?: string
  ): Promise<Record<string, { rows: any[], columns: string[], error?: string, queryName?: string }>> {

    this.sweepL1Cache();

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    if (convexToken) convex.setAuth(convexToken);

    const cacheKey = this.generateCacheKey(dashboardId, queries);

    // --- L1 Cache Check (In-Memory, Zero-Latency) ---
    const l1Hit = this.l1Cache.get(cacheKey);
    if (l1Hit) {
      console.log(`[OrchaDashboard] L1 HIT: Serving dashboard ${dashboardId} from memory.`);
      return l1Hit.data;
    }

    // --- L2 Cache Check (Convex, Persistent across cold starts) ---
    const l2Data = await this.readL2Cache(convex, cacheKey);
    if (l2Data) {
      console.log(`[OrchaDashboard] L2 HIT: Serving dashboard ${dashboardId} from Convex persistent cache.`);
      // Populate L1 from L2 so subsequent requests in this process are instant
      this.l1Cache.set(cacheKey, { timestamp: Date.now(), data: l2Data });
      return l2Data;
    }

    console.log(`[OrchaDashboard] CACHE MISS: Executing batch for dashboard ${dashboardId} (${queries.length} queries, concurrency: 3).`);

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

    // --- Write results to both cache tiers ---
    // L1: Synchronous in-memory write (instant for same-process subsequent requests)
    this.l1Cache.set(cacheKey, { timestamp: Date.now(), data: results });
    // L2: Async Convex write (fire-and-forget — persists across cold starts)
    this.writeL2Cache(convex, cacheKey, organizationId, results);

    return results;
  }
}
