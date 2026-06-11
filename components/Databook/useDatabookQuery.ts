import { useState, useEffect } from "react";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import {
  buildFilterSql,
  isPaginatable,
  buildCountSql,
  buildPageSql
} from "./paginationHelpers";

interface UseDatabookQueryParams {
  saas: string;
  entry: any;
  dbConfig: any;
  saveDateFilterMutation: any;
  removeMutation: any;
  router: any;
}

export function useDatabookQuery({
  saas,
  entry,
  dbConfig,
  saveDateFilterMutation,
  removeMutation,
  router,
}: UseDatabookQueryParams) {
  const [currentPage, setCurrentPage] = useState(1);
  const [filterRules, setFilterRules] = useState<any[]>([]);
  const [isFilterRulesInitialized, setIsFilterRulesInitialized] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const PAGE_SIZE = 49;

  // Reset page to 1 when databook entry changes
  useEffect(() => {
    setCurrentPage(1);
  }, [entry?._id]);

  // Sync filterRules from entry
  useEffect(() => {
    if (entry) {
      if (entry.filterRules) {
        try {
          setFilterRules(JSON.parse(entry.filterRules));
        } catch (e) {
          console.error("Failed to parse filter rules:", e);
          setFilterRules([]);
        }
      } else if (entry.filterDateColumn && entry.filterDateFrom && entry.filterDateTo) {
        setFilterRules([
          {
            id: "legacy",
            column: entry.filterDateColumn,
            type: "between",
            dateFrom: entry.filterDateFrom,
            dateTo: entry.filterDateTo,
          }
        ]);
      } else {
        setFilterRules([]);
      }
      setIsFilterRulesInitialized(true);
    }
  }, [entry]);

  const activeSql = dbConfig && entry && isFilterRulesInitialized
    ? buildFilterSql(filterRules, entry.sql, dbConfig.type)
    : "";

  const isPaginated = activeSql ? isPaginatable(activeSql) : false;

  // 1. Count Query
  const countQuery = useQuery({
    queryKey: ["databook", entry?._id, "count", activeSql],
    queryFn: async () => {
      if (!dbConfig || !entry || !activeSql || !isPaginated) return 0;
      const parsedConfig = JSON.parse(dbConfig.encryptedUri);
      const countSql = buildCountSql(activeSql, dbConfig.type);

      try {
        const response = await fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: dbConfig.type,
            config: parsedConfig,
            sql: countSql,
          }),
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || "Failed to execute count query.");
        }

        let fetchedCount = 0;
        if (result.rows && result.rows.length > 0) {
          const row = result.rows[0];
          const countKey = Object.keys(row).find(k => k.toLowerCase() === "total_count");
          fetchedCount = countKey ? parseInt(row[countKey], 10) : 0;
        }
        return fetchedCount;
      } catch (err: any) {
        console.error("Count query failed, falling back to cache count:", err);
        try {
          const parsed = JSON.parse(entry.resultRows);
          return parsed.length;
        } catch (e) {
          return 0;
        }
      }
    },
    enabled: !!dbConfig && !!entry && !!activeSql && isPaginated,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // 2. Data Page Query
  const dataQuery = useQuery({
    queryKey: ["databook", entry?._id, "page", activeSql, currentPage],
    queryFn: async () => {
      if (!dbConfig || !entry || !activeSql) return [];
      const parsedConfig = JSON.parse(dbConfig.encryptedUri);

      let sqlToRun = activeSql;
      if (isPaginated) {
        const offset = (currentPage - 1) * PAGE_SIZE;
        sqlToRun = buildPageSql(activeSql, offset, PAGE_SIZE, dbConfig.type);
      }

      try {
        const response = await fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: dbConfig.type,
            config: parsedConfig,
            sql: sqlToRun,
          }),
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || "Failed to execute data query.");
        }
        return result.rows || [];
      } catch (err: any) {
        console.error("Live load failed, falling back to cached rows:", err);
        notifications.show({
          title: "Database Load Failed",
          message: err.message || "Could not fetch data directly from database. Showing cached preview.",
          color: "red",
          autoClose: 5000,
        });
        try {
          return JSON.parse(entry.resultRows) || [];
        } catch (e) {
          return [];
        }
      }
    },
    enabled: !!dbConfig && !!entry && !!activeSql,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const handleDelete = async (onSuccess?: () => void) => {
    setRefreshing(true);
    try {
      await removeMutation({ id: entry._id });
      notifications.show({
        title: "Deleted Successfully",
        message: "The query result was deleted from your Databook.",
        color: "violet",
        autoClose: 2000,
      });
      router.push(`/${saas}/databook`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      notifications.show({
        title: "Delete Failed",
        message: err.message || "Failed to delete query result.",
        color: "red",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleApplyFilter = async (newRules: any[], onSuccess?: () => void) => {
    if (!dbConfig || !entry || newRules.length === 0) return;
    
    const isInvalid = newRules.some((rule) => {
      if (!rule.column) return true;
      if (rule.type === "between" && (!rule.dateFrom || !rule.dateTo)) return true;
      if (rule.type === "month_year" && (!rule.month || !rule.year)) return true;
      if (rule.type === "year" && !rule.year) return true;
      if (rule.type === "month" && !rule.month) return true;
      return false;
    });

    if (isInvalid) {
      notifications.show({
        title: "Incomplete Rules",
        message: "Please fill in all values for your filter rules.",
        color: "orange",
        autoClose: 3000,
      });
      return;
    }

    setRefreshing(true);
    if (onSuccess) onSuccess();
    try {
      const firstRule = newRules[0];
      await saveDateFilterMutation({
        id: entry._id,
        filterDateColumn: firstRule.type === "between" ? firstRule.column : undefined,
        filterDateFrom: firstRule.type === "between" ? firstRule.dateFrom : undefined,
        filterDateTo: firstRule.type === "between" ? firstRule.dateTo : undefined,
        filterRules: JSON.stringify(newRules),
      });

      setCurrentPage(1);
      setFilterRules(newRules);

      notifications.show({
        title: "Filters Applied",
        message: `${newRules.length} filter(s) applied successfully.`,
        color: "green",
        autoClose: 2000,
      });
    } catch (err: any) {
      notifications.show({
        title: "Filtering Failed",
        message: err.message || "An error occurred while executing the filtered query.",
        color: "red",
        autoClose: 3500,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearFilter = async (onSuccess?: () => void) => {
    if (!dbConfig || !entry) return;
    setRefreshing(true);
    if (onSuccess) onSuccess();
    try {
      await saveDateFilterMutation({
        id: entry._id,
        filterDateColumn: undefined,
        filterDateFrom: undefined,
        filterDateTo: undefined,
        filterRules: undefined,
      });

      setCurrentPage(1);
      setFilterRules([]);

      notifications.show({
        title: "Filters Cleared",
        message: "Saved query restored to original unfiltered state.",
        color: "violet",
        autoClose: 2000,
      });
    } catch (err: any) {
      notifications.show({
        title: "Clear Failed",
        message: err.message || "An error occurred while restoring the original query.",
        color: "red",
        autoClose: 3500,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (!dbConfig || !entry) return;
    setRefreshing(true);
    try {
      setCurrentPage(1);
      await Promise.all([
        countQuery.refetch(),
        dataQuery.refetch(),
      ]);

      notifications.show({
        title: "Databook Synchronized",
        message: "Query results updated with the latest database data.",
        color: "green",
        autoClose: 2000,
      });
    } catch (err: any) {
      notifications.show({
        title: "Sync Failed",
        message: err.message || "An error occurred while re-running the query.",
        color: "red",
        autoClose: 3000,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const pageData = dataQuery.data || null;
  const totalCount = isPaginated ? (countQuery.data || 0) : (dataQuery.data || []).length;
  const loadingPage = dataQuery.isFetching || countQuery.isFetching;

  return {
    currentPage,
    setCurrentPage,
    totalCount,
    pageData,
    loadingPage,
    filterRules,
    refreshing,
    PAGE_SIZE,
    handleDelete,
    handleApplyFilter,
    handleClearFilter,
    handleRefresh,
  };
}
