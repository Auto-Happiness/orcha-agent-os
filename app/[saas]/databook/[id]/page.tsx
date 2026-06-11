"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Title,
  Text,
  Stack,
  Box,
  Skeleton,
  Center,
  ScrollArea,
  Avatar,
  Group,
  Code,
  Button,
  Modal,
  Drawer,
  Menu,
  ActionIcon,
  Badge,
  Loader,
  Select,
  TextInput,
  Grid
} from "@mantine/core";
import Link from "next/link";
import {
  IconArrowLeft,
  IconNotebook,
  IconCopy,
  IconUser,
  IconSparkles,
  IconDotsVertical,
  IconTerminal2,
  IconRefresh,
  IconFilter,
  IconPlus,
  IconTrash
} from "@tabler/icons-react";
import { DataTable } from "@/components/Chat/DataTable";
import { ReasoningBlock } from "@/components/Chat/ReasoningBlock";
import { notifications } from "@mantine/notifications";

function parseMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|(!)?\[(.+?)\]\((.+?)\)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<Text key={`bold-${match.index}`} component="span" fw={700} c="inherit">{match[1]}</Text>);
    } else if (match[2]) {
      parts.push(<Text key={`italic-${match.index}`} component="span" style={{ fontStyle: "italic" }} c="inherit">{match[2]}</Text>);
    } else if (match[3]) {
      parts.push(<Text key={`code-${match.index}`} component="span" size="xs" style={{ background: "rgba(147,51,234,0.15)", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }} c="violet.2">{match[3]}</Text>);
    } else if (match[5] && match[6]) {
      const linkText = match[5];
      const linkUrl = match[6];
      parts.push(<Text key={`link-${match.index}`} component="a" href={linkUrl} target="_blank" rel="noopener noreferrer" c="violet.3" style={{ textDecoration: "underline", cursor: "pointer" }}>{linkText}</Text>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const cleanSql = (sql: string): string => {
  return sql.trim().replace(/;+$/, "").trim();
};

const stripTrailingOrderBy = (sql: string): string => {
  let depth = 0;
  for (let i = sql.length - 1; i >= 0; i--) {
    const char = sql[i];
    if (char === ')') depth++;
    else if (char === '(') depth--;
    else if (depth === 0 && i >= 8) {
      const substr = sql.substring(i - 8, i).toUpperCase();
      if (substr === 'ORDER BY') {
        if (i - 9 < 0 || /\s/.test(sql[i - 9])) {
          return sql.substring(0, i - 8).trim();
        }
      }
    }
  }
  return sql;
};

const hasTopLevelOrderBy = (sql: string): boolean => {
  let depth = 0;
  for (let i = sql.length - 1; i >= 0; i--) {
    const char = sql[i];
    if (char === ')') depth++;
    else if (char === '(') depth--;
    else if (depth === 0 && i >= 8) {
      const substr = sql.substring(i - 8, i).toUpperCase();
      if (substr === 'ORDER BY') {
        if (i - 9 < 0 || /\s/.test(sql[i - 9])) {
          return true;
        }
      }
    }
  }
  return false;
};

const stripSystemLimit = (sql: string, dialect: string): string => {
  const cleaned = cleanSql(sql);
  const dialectLower = dialect.toLowerCase();

  if (dialectLower === "mssql") {
    let stripped = cleaned.replace(/\s+OFFSET\s+\d+\s+ROWS(\s+FETCH\s+(?:NEXT|FIRST)\s+\d+\s+ROWS\s+ONLY)?/i, "");
    stripped = stripped.replace(/^(\s*SELECT\s+DISTINCT)\s+TOP\s+\d+/i, "$1");
    stripped = stripped.replace(/^(\s*SELECT)\s+TOP\s+\d+/i, "$1");
    return stripped.trim();
  }

  if (dialectLower === "oracle") {
    let stripped = cleaned.replace(/\s+OFFSET\s+\d+\s+ROWS(\s+FETCH\s+(?:NEXT|FIRST)\s+\d+\s+ROWS\s+ONLY)?/i, "");
    stripped = stripped.replace(/\s+FETCH\s+(?:NEXT|FIRST)\s+\d+\s+ROWS\s+ONLY/i, "");
    return stripped.trim();
  }

  let stripped = cleaned.replace(/\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?/i, "");
  stripped = stripped.replace(/\s+OFFSET\s+\d+/i, "");
  return stripped.trim();
};

const buildCountSql = (sql: string, dialect: string): string => {
  const cleaned = cleanSql(sql);
  const dialectLower = dialect.toLowerCase();
  const queryWithoutLimit = stripSystemLimit(cleaned, dialectLower);
  const queryWithoutOrderBy = stripTrailingOrderBy(queryWithoutLimit);

  return `SELECT COUNT(*) AS total_count FROM (\n${queryWithoutOrderBy}\n) _count_source`;
};

const buildPageSql = (sql: string, offset: number, limit: number, dialect: string): string => {
  const cleaned = cleanSql(sql);
  const dialectLower = dialect.toLowerCase();
  const queryWithoutLimit = stripSystemLimit(cleaned, dialectLower);

  if (dialectLower === "oracle") {
    return `${queryWithoutLimit} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
  }

  if (dialectLower === "mssql") {
    if (hasTopLevelOrderBy(queryWithoutLimit)) {
      return `${queryWithoutLimit} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    } else {
      return `${queryWithoutLimit} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    }
  }

  return `${queryWithoutLimit} LIMIT ${limit} OFFSET ${offset}`;
};

const isPaginatable = (sql: string): boolean => {
  const norm = sql.trim().toLowerCase();
  return norm.startsWith("select") || norm.startsWith("with");
};

export default function DatabookDetailPage() {
  const { saas, id } = useParams();
  const router = useRouter();
  const removeMutation = useMutation(api.databook.remove);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageData, setPageData] = useState<any[] | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const PAGE_SIZE = 49;

  const handleDelete = async () => {
    try {
      await removeMutation({ id: id as any });
      notifications.show({
        title: "Deleted Successfully",
        message: "The query result was deleted from your Databook.",
        color: "violet",
        autoClose: 2000,
      });
      router.push(`/${saas}/databook`);
    } catch (err: any) {
      notifications.show({
        title: "Delete Failed",
        message: err.message || "Failed to delete query result.",
        color: "red",
      });
    }
  };

  const organization = useQuery(api.organizations.getSafeBySlug, { 
    slug: saas as string 
  });

  const entry = useQuery(api.databook.getById, {
    id: id as any
  });

  const dbConfig = useQuery(
    api.databaseConfigs.getById,
    entry?.configId ? { configId: entry.configId } : "skip"
  );

  const allModels = useQuery(
    api.semanticModels.listModelsByConfig,
    entry?.configId ? { configId: entry.configId } : "skip"
  );

  const saveDateFilterMutation = useMutation(api.databook.saveDateFilter);

  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterRules, setFilterRules] = useState<any[]>([]);
  const [isFilterRulesInitialized, setIsFilterRulesInitialized] = useState(false);
  const [tempFilterRules, setTempFilterRules] = useState<any[]>([]);

  const handleOpenFilterModal = () => {
    if (filterRules.length === 0) {
      setTempFilterRules([
        {
          id: Math.random().toString(36).substring(2, 9),
          column: dateColumns[0]?.value || "",
          type: "between",
          dateFrom: "",
          dateTo: "",
          month: "1",
          year: new Date().getFullYear().toString(),
        }
      ]);
    } else {
      setTempFilterRules(filterRules.map(r => ({ ...r })));
    }
    setFilterModalOpen(true);
  };

  const handleAddRule = () => {
    setTempFilterRules((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        column: dateColumns[0]?.value || "",
        type: "between",
        dateFrom: "",
        dateTo: "",
        month: "1",
        year: new Date().getFullYear().toString(),
      },
    ]);
  };

  const handleUpdateRule = (index: number, updates: Partial<any>) => {
    setTempFilterRules((prev) =>
      prev.map((rule, idx) => (idx === index ? { ...rule, ...updates } : rule))
    );
  };

  const handleRemoveRule = (index: number) => {
    setTempFilterRules((prev) => prev.filter((_, idx) => idx !== index));
  };

  const fetchInitialDataAndCount = async (activeFilters = filterRules) => {
    if (!dbConfig || !entry) return;
    setLoadingPage(true);
    try {
      const parsedConfig = JSON.parse(dbConfig.encryptedUri);
      const activeSql = buildFilterSql(activeFilters, entry.sql, dbConfig.type);

      if (!isPaginatable(activeSql)) {
        // Run query raw and bypass pagination completely
        const response = await fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: dbConfig.type,
            config: parsedConfig,
            sql: activeSql,
          }),
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || "Failed to execute query.");
        }
        setPageData(result.rows);
        setTotalCount(result.rows.length);
        return;
      }

      const countSql = buildCountSql(activeSql, dbConfig.type);
      const firstPageSql = buildPageSql(activeSql, 0, PAGE_SIZE, dbConfig.type);

      const [countResponse, dataResponse] = await Promise.all([
        fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: dbConfig.type,
            config: parsedConfig,
            sql: countSql,
          }),
        }),
        fetch("/api/db/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: dbConfig.type,
            config: parsedConfig,
            sql: firstPageSql,
          }),
        })
      ]);

      const countResult = await countResponse.json();
      const dataResult = await dataResponse.json();

      if (!countResult.success) {
        throw new Error(countResult.message || "Failed to execute count query.");
      }
      if (!dataResult.success) {
        throw new Error(dataResult.message || "Failed to execute data query.");
      }

      let fetchedCount = 0;
      if (countResult.rows && countResult.rows.length > 0) {
        const row = countResult.rows[0];
        const countKey = Object.keys(row).find(k => k.toLowerCase() === "total_count");
        fetchedCount = countKey ? parseInt(row[countKey], 10) : 0;
      }

      setTotalCount(fetchedCount);
      setPageData(dataResult.rows);
    } catch (err: any) {
      console.error("Live load failed:", err);
      notifications.show({
        title: "Database Load Failed",
        message: err.message || "Could not fetch data directly from database.",
        color: "red",
        autoClose: 5000,
      });
      // Fallback to cached rows
      try {
        const parsed = JSON.parse(entry.resultRows);
        setPageData(parsed);
        setTotalCount(parsed.length);
      } catch (e) {
        setPageData([]);
        setTotalCount(0);
      }
    } finally {
      setLoadingPage(false);
    }
  };

  const fetchPageData = async (page: number) => {
    if (!dbConfig || !entry) return;
    const activeSql = buildFilterSql(filterRules, entry.sql, dbConfig.type);
    if (!isPaginatable(activeSql)) return;

    setLoadingPage(true);
    try {
      const parsedConfig = JSON.parse(dbConfig.encryptedUri);
      const offset = (page - 1) * PAGE_SIZE;
      const pageSql = buildPageSql(activeSql, offset, PAGE_SIZE, dbConfig.type);

      const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: dbConfig.type,
          config: parsedConfig,
          sql: pageSql,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setPageData(result.rows);
      } else {
        throw new Error(result.message || "Failed to fetch page data.");
      }
    } catch (e: any) {
      notifications.show({
        title: "Page Load Failed",
        message: e.message || "Failed to load page data.",
        color: "red",
      });
    } finally {
      setLoadingPage(false);
    }
  };

  React.useEffect(() => {
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

  // Reactive effect for initial database fetch (runs only once after filterRules are initialized from entry)
  React.useEffect(() => {
    if (entry && dbConfig && isFilterRulesInitialized) {
      setCurrentPage(1);
      fetchInitialDataAndCount();
    }
  }, [entry?._id, dbConfig?._id, isFilterRulesInitialized]);

  // Reactive effect for fetching pages on currentPage change
  React.useEffect(() => {
    if (currentPage > 1) {
      fetchPageData(currentPage);
    } else if (currentPage === 1 && pageData && totalCount > PAGE_SIZE) {
      // Re-fetch page 1 if we reset back to page 1 from another page
      fetchPageData(1);
    }
  }, [currentPage]);

  const dateColumns = React.useMemo(() => {
    if (!allModels || !entry) return [];
    
    const sqlLower = entry.sql.toLowerCase();
    const discovered: { value: string; label: string }[] = [];

    // 1. Identify which tables participate in the SQL query
    const participatingModels = allModels.filter((model) => {
      const tblName = model.tableName.toLowerCase();
      const regex = new RegExp(`\\b${tblName}\\b`, "i");
      return regex.test(sqlLower);
    });

    // 2. Extract date/time fields from participating tables
    participatingModels.forEach((model) => {
      (model.fields || []).forEach((field: any) => {
        const typeLower = (field.type || "").toLowerCase();
        const rawTypeLower = (field.rawType || "").toLowerCase();
        const nameLower = field.columnName.toLowerCase();
        
        const isDateType = 
          field.isTimeDimension === true ||
          typeLower.includes("date") ||
          typeLower.includes("time") ||
          typeLower.includes("timestamp") ||
          rawTypeLower.includes("date") ||
          rawTypeLower.includes("time") ||
          rawTypeLower.includes("timestamp") ||
          nameLower.includes("date") ||
          nameLower.includes("time") ||
          nameLower.includes("timestamp") ||
          nameLower.includes("_at");
           
        if (isDateType) {
          const exists = discovered.some(c => c.value === field.columnName);
          if (!exists) {
            discovered.push({
              value: field.columnName,
              label: `${model.displayName} → ${field.displayName || field.columnName} (${field.columnName})`
            });
          }
        }
      });
    });

    // 3. Fallback: Scan resultColumns
    entry.resultColumns.forEach((colName) => {
      const colLower = colName.toLowerCase();
      const isDateName = 
        colLower.includes("date") || 
        colLower.includes("time") || 
        colLower.includes("timestamp") || 
        colLower.includes("_at");
         
      if (isDateName) {
        const exists = discovered.some(c => c.value === colName);
        if (!exists) {
          discovered.push({
            value: colName,
            label: `Result Column → ${colName}`
          });
        }
      }
    });

    return discovered;
  }, [allModels, entry]);

  const getMonthFilterSql = (col: string, m: string, dialect: string) => {
    const padM = m.padStart(2, "0");
    switch (dialect.toLowerCase()) {
      case "sqlite":
        return `strftime('%m', ${col}) = '${padM}'`;
      case "postgres":
      case "oracle":
      case "bigquery":
        return `EXTRACT(MONTH FROM ${col}) = ${parseInt(m)}`;
      case "mysql":
      case "mariadb":
        return `MONTH(${col}) = ${parseInt(m)}`;
      case "mssql":
        return `DATEPART(month, ${col}) = ${parseInt(m)}`;
      default:
        return `EXTRACT(MONTH FROM ${col}) = ${parseInt(m)}`;
    }
  };

  const buildFilterSql = (rules: any[], originalSql: string, dialect: string) => {
    if (rules.length === 0) return originalSql;

    const clauses = rules.map((rule) => {
      const col = rule.column;
      if (!col) return "";

      switch (rule.type) {
        case "between": {
          if (!rule.dateFrom || !rule.dateTo) return "";
          return `${col} BETWEEN '${rule.dateFrom} 00:00:00' AND '${rule.dateTo} 23:59:59'`;
        }
        case "month_year": {
          if (!rule.month || !rule.year) return "";
          const m = rule.month.padStart(2, "0");
          const y = rule.year;
          const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
          return `${col} BETWEEN '${y}-${m}-01 00:00:00' AND '${y}-${m}-${lastDay} 23:59:59'`;
        }
        case "year": {
          if (!rule.year) return "";
          return `${col} BETWEEN '${rule.year}-01-01 00:00:00' AND '${rule.year}-12-31 23:59:59'`;
        }
        case "month": {
          if (!rule.month) return "";
          return getMonthFilterSql(col, rule.month, dialect);
        }
        default:
          return "";
      }
    }).filter(c => c !== "");

    if (clauses.length === 0) return originalSql;

    return `SELECT * FROM (\n${originalSql}\n) _filtered_data\nWHERE ${clauses.join(" AND ")}`;
  };

  const handleApplyFilter = async () => {
    if (!dbConfig || !entry || tempFilterRules.length === 0) return;
    
    const isInvalid = tempFilterRules.some((rule) => {
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
    setFilterModalOpen(false);
    try {
      const firstRule = tempFilterRules[0];
      await saveDateFilterMutation({
        id: entry._id,
        filterDateColumn: firstRule.type === "between" ? firstRule.column : undefined,
        filterDateFrom: firstRule.type === "between" ? firstRule.dateFrom : undefined,
        filterDateTo: firstRule.type === "between" ? firstRule.dateTo : undefined,
        filterRules: JSON.stringify(tempFilterRules),
      });

      setCurrentPage(1);
      setFilterRules(tempFilterRules);

      notifications.show({
        title: "Filters Applied",
        message: `${tempFilterRules.length} filter(s) applied successfully.`,
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

  const handleClearFilter = async () => {
    if (!dbConfig || !entry) return;
    setRefreshing(true);
    setFilterModalOpen(false);
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

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    notifications.show({
      title: "SQL Copied",
      message: "SQL query copied to clipboard.",
      color: "violet",
      autoClose: 2000,
    });
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!dbConfig || !entry) return;
    setRefreshing(true);
    try {
      setCurrentPage(1);
      await fetchInitialDataAndCount();

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

  // Handle Initial Loading State
  if (organization === undefined || entry === undefined) {
    return (
      <Box p="4rem" style={{ maxWidth: "1600px" }}>
        <Stack gap="2rem">
          <Skeleton h={30} w={120} radius="md" />
          <Box mb="xl">
             <Skeleton h={40} w={500} mb="xs" radius="md" />
             <Skeleton h={20} w={700} radius="md" />
          </Box>
          <Skeleton h={300} radius="md" />
        </Stack>
      </Box>
    );
  }

  // Handle Not Found State
  if (organization === null || entry === null) {
    return (
      <Center h="400px" style={{ color: "white" }}>
        <Stack align="center" gap="xs">
          <Title order={3}>Record Not Found</Title>
          <Text c="dimmed">This databook entry could not be located in the database.</Text>
          <Button component={Link} href={`/${saas}/databook`} variant="light" color="violet">
            Back to Databook
          </Button>
        </Stack>
      </Center>
    );
  }

  return (
    <Box p="4rem" style={{ maxWidth: "1600px" }}>
      <title>{entry ? `${entry.name} - Databook` : "Saved Query"}</title>
      <Stack gap="2rem">
        <Box>
          <Button
            component={Link}
            href={`/${saas}/databook`}
            variant="subtle"
            color="violet"
            leftSection={<IconArrowLeft size={16} />}
            styles={{
              root: {
                paddingLeft: 0,
                color: "rgba(255,255,255,0.6)",
                "&:hover": {
                  color: "white",
                  background: "transparent"
                }
              }
            }}
          >
            Back to Databook
          </Button>
        </Box>

        <Group justify="space-between" align="flex-start" mb="xl">
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" align="center" mb={6}>
              <IconNotebook size={24} color="#a855f7" />
              <Title order={1} c="white" size="2rem" style={{ letterSpacing: "-0.02em" }}>
                {entry.name}
              </Title>
            </Group>
            {entry.question && (
              <Text c="dimmed" size="md" style={{ fontStyle: "italic" }}>
                "{entry.question}"
              </Text>
            )}
            <Group gap="sm" mt="md" wrap="wrap" align="center">
              {dbConfig ? (
                <>
                  <Badge variant="dot" color="violet" styles={{ label: { textTransform: "none", color: "rgba(255,255,255,0.85)" } }}>
                    Database: {dbConfig.name}
                  </Badge>
                  <Badge variant="light" color="violet" size="sm">
                    {dbConfig.type.toUpperCase()}
                  </Badge>
                </>
              ) : (
                <Badge variant="dot" color="gray" styles={{ label: { textTransform: "none", color: "rgba(255,255,255,0.5)" } }}>
                  Database: Unknown / Deleted
                </Badge>
              )}
              {filterRules && filterRules.length > 0 ? (
                filterRules.map((rule, idx) => {
                  let label = "";
                  if (rule.type === "between") {
                    label = `${rule.column}: ${rule.dateFrom} to ${rule.dateTo}`;
                  } else if (rule.type === "month_year") {
                    const mName = MONTH_OPTIONS.find(o => o.value === rule.month)?.label || rule.month;
                    label = `${rule.column}: ${mName} ${rule.year}`;
                  } else if (rule.type === "year") {
                    label = `${rule.column}: Year ${rule.year}`;
                  } else if (rule.type === "month") {
                    const mName = MONTH_OPTIONS.find(o => o.value === rule.month)?.label || rule.month;
                    label = `${rule.column}: ${mName}`;
                  }
                  return (
                    <Badge key={rule.id || idx} variant="light" color="orange" size="sm" styles={{ label: { textTransform: "none" } }}>
                      Filtered: {label}
                    </Badge>
                  );
                })
              ) : entry.filterDateColumn ? (
                <Badge variant="light" color="orange" size="sm" styles={{ label: { textTransform: "none" } }}>
                  Filtered: {entry.filterDateColumn} ({entry.filterDateFrom} to {entry.filterDateTo})
                </Badge>
              ) : null}
              <Text size="xs" c="dimmed" style={{ borderLeft: "1px solid rgba(255,255,255,0.1)", paddingLeft: "10px" }}>
                Saved on {(() => {
                  const d = new Date(entry.createdAt);
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const dd = String(d.getDate()).padStart(2, "0");
                  return `${mm}/${dd}/${d.getFullYear()}`;
                })()}
              </Text>
            </Group>
          </Box>
          <Menu shadow="md" width={180} position="bottom-end" styles={{
            dropdown: { background: "#13102a", borderColor: "rgba(147,51,234,0.2)" },
            item: { color: "white", transition: "all 0.2s ease" }
          }}>
            <Menu.Target>
              <ActionIcon variant="light" color="violet" size="lg" radius="md">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Actions</Menu.Label>
              <Menu.Item 
                leftSection={refreshing ? <Loader size={12} color="violet" /> : <IconRefresh size={14} color="#a855f7" />} 
                onClick={handleRefresh}
                disabled={refreshing || !dbConfig}
              >
                Sync with Database
              </Menu.Item>
              <Menu.Item 
                leftSection={<IconFilter size={14} color="#a855f7" />} 
                onClick={handleOpenFilterModal}
                disabled={refreshing || !dbConfig}
              >
                Configure Filters
              </Menu.Item>
              {((filterRules && filterRules.length > 0) || entry.filterDateColumn) && (
                <Menu.Item 
                  leftSection={<IconFilter size={14} color="#ef4444" />} 
                  onClick={handleClearFilter}
                  disabled={refreshing}
                  c="red.4"
                >
                  Clear Filters
                </Menu.Item>
              )}
              <Menu.Item leftSection={<IconTerminal2 size={14} color="#a855f7" />} onClick={() => setSqlModalOpen(true)}>
                View SQL Query
              </Menu.Item>
              <Menu.Divider style={{ borderColor: "rgba(255,255,255,0.05)" }} />
              <Menu.Item 
                leftSection={<IconTrash size={14} color="#ef4444" />} 
                onClick={() => setDeleteModalOpen(true)}
                c="red.4"
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* 1. Query Results Table (Top) */}
        <Box>
          <Text size="xs" fw={700} c="violet.4" mb="md" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Live Query Result
          </Text>
          <Box style={{ position: "relative" }}>
            {pageData ? (
              <DataTable
                data={pageData}
                sql={entry.sql}
              />
            ) : (
              <Box style={{ background: "rgba(10,8,20,0.8)", border: "1px solid rgba(147,51,234,0.18)", borderRadius: 14, height: "200px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Stack align="center" gap="xs">
                  <Loader color="violet" size="sm" />
                  <Text size="xs" c="violet.3" fw={600}>Executing database query...</Text>
                </Stack>
              </Box>
            )}

            {loadingPage && pageData && (
              <Box
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(12, 8, 20, 0.7)",
                  backdropFilter: "blur(2px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  borderRadius: 14,
                }}
              >
                <Stack align="center" gap="xs">
                  <Loader color="violet" size="sm" />
                  <Text size="xs" c="violet.3" fw={600}>Executing SQL query...</Text>
                </Stack>
              </Box>
            )}
          </Box>

          {/* Pagination Controls */}
          {pageData && totalCount > PAGE_SIZE && (
            <Box
              style={{
                background: "rgba(19, 16, 42, 0.4)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(147, 51, 234, 0.15)",
                borderTop: "none",
                borderRadius: "0 0 14px 14px",
                padding: "12px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: -1,
              }}
            >
              <Group gap="xs">
                <Box style={{ width: 6, height: 6, borderRadius: "50%", background: "#a855f7", boxShadow: "0 0 8px #a855f7" }} />
                <Text size="xs" c="dimmed">
                  Showing <Text span fw={600} c="white">{((currentPage - 1) * PAGE_SIZE) + 1}</Text> to{" "}
                  <Text span fw={600} c="white">{Math.min(currentPage * PAGE_SIZE, totalCount)}</Text> of{" "}
                  <Text span fw={600} c="white">{totalCount.toLocaleString()}</Text> records
                </Text>
              </Group>

              <Group gap="md">
                <Text size="xs" c="dimmed">
                  Page <Text span fw={600} c="white">{currentPage}</Text> of <Text span fw={600} c="white">{Math.ceil(totalCount / PAGE_SIZE)}</Text>
                </Text>

                <Group gap="xs">
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="violet"
                    disabled={currentPage === 1 || loadingPage}
                    onClick={() => setCurrentPage(1)}
                  >
                    First
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="violet"
                    disabled={currentPage === 1 || loadingPage}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                  >
                    Prev
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="violet"
                    disabled={currentPage === Math.ceil(totalCount / PAGE_SIZE) || loadingPage}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                  >
                    Next
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="violet"
                    disabled={currentPage === Math.ceil(totalCount / PAGE_SIZE) || loadingPage}
                    onClick={() => setCurrentPage(Math.ceil(totalCount / PAGE_SIZE))}
                  >
                    Last
                  </Button>
                </Group>
              </Group>
            </Box>
          )}
        </Box>

        {/* 2. Chat/Conversation History (Bottom) */}
        <Box style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(147,51,234,0.08)", borderRadius: 12, padding: "24px" }}>
          <Text size="xs" fw={700} c="violet.4" mb="md" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Conversation Transcript
          </Text>
          <ScrollArea h={380} offsetScrollbars>
            <Stack gap="lg" px="xs" style={{ maxWidth: "1000px" }}>
              {(() => {
                const history = entry.chatHistory ? JSON.parse(entry.chatHistory) : [];
                if (history.length === 0) {
                  return (
                    <Text size="sm" c="dimmed" ta="center" py="xl">
                      No conversation transcript saved with this query.
                    </Text>
                  );
                }
                return history.map((m: any, idx: number) => {
                  const isUser = m.role === "user";
                  return (
                    <Group key={m.id || idx} gap="md" align="flex-start" wrap="nowrap">
                      <Avatar size="sm" radius="xl" color={isUser ? "blue" : "violet"} style={{ background: isUser ? "rgba(37,99,235,0.1)" : "transparent", flexShrink: 0 }}>
                        {isUser ? <IconUser size={16} /> : <IconSparkles size={18} style={{ color: "#a855f7" }} />}
                      </Avatar>
                      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                        <Text fw={700} size="xs" c="white">{isUser ? "You" : "Orcha Agent"}</Text>
                        {m.parts && Array.isArray(m.parts) ? (
                          m.parts.map((part: any, partIdx: number) => {
                            if (part.type !== "text" || !part.text) return null;
                            const MARKER = "### \uD83E\uDDE0 Reasoning";
                            const markerIdx = part.text.indexOf(MARKER);
                            if (markerIdx !== -1) {
                              const before = part.text.slice(0, markerIdx).trim();
                              const reasoningAndAfter = part.text.slice(markerIdx);
                              const afterMarker = reasoningAndAfter.slice(MARKER.length).trimStart();
                              const sections = afterMarker.split(/\n{2,}/);
                              let reasoningEndIndex = 0;
                              for (let j = 1; j < sections.length; j++) {
                                const s = sections[j].trimStart();
                                const lowerS = s.toLowerCase();
                                if (lowerS.startsWith("final") || lowerS.startsWith("based on") || lowerS.startsWith("here") || lowerS.startsWith("the ") || (!s.startsWith("*") && !s.startsWith("-") && !s.startsWith("#") && !/^\d+\./.test(s))) {
                                  break;
                                }
                                reasoningEndIndex = j;
                              }
                              const reasoningContent = sections.slice(0, reasoningEndIndex + 1).join("\n\n").trim();
                              const afterAnswer = sections.slice(reasoningEndIndex + 1).join("\n\n").trim();
                              return (
                                <React.Fragment key={partIdx}>
                                  {before ? <Text size="xs" c="rgba(255,255,255,0.85)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }} component="div">{parseMarkdown(before)}</Text> : null}
                                  <ReasoningBlock text={MARKER + "\n" + reasoningContent} renderMarkdown={parseMarkdown} />
                                  {afterAnswer ? <Text size="xs" c="rgba(255,255,255,0.85)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 4 }} component="div">{parseMarkdown(afterAnswer)}</Text> : null}
                                </React.Fragment>
                              );
                            }
                            return (
                              <Text key={partIdx} size="xs" c="rgba(255,255,255,0.85)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }} component="div">
                                {parseMarkdown(part.text)}
                              </Text>
                            );
                          })
                        ) : (
                          <Text size="xs" c="rgba(255,255,255,0.85)" style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }} component="div">
                            {parseMarkdown(m.content || "")}
                          </Text>
                        )}
                      </Stack>
                    </Group>
                  );
                });
              })()}
            </Stack>
          </ScrollArea>
        </Box>

      {/* SQL Query Modal */}
      <Modal
        opened={sqlModalOpen}
        onClose={() => setSqlModalOpen(false)}
        title="SQL Query"
        centered
        size="lg"
        radius="md"
        overlayProps={{
          color: "#05010d",
          opacity: 0.85,
          blur: 10,
        }}
        styles={{
          content: { background: "#0c0814", border: "1px solid rgba(147,51,234,0.2)", padding: "1rem" },
          header: { background: "#0c0814", borderBottom: "1px solid rgba(147,51,234,0.1)", paddingBottom: "1rem" },
          title: { color: "white", fontWeight: 600 }
        }}
      >
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              This SQL query was executed to fetch the results shown.
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="violet"
              leftSection={<IconCopy size={11} />}
              onClick={() => handleCopySql(entry.sql)}
            >
              Copy SQL
            </Button>
          </Group>
          <Box style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(147,51,234,0.12)", borderRadius: 8, padding: "12px", maxHeight: 400, overflowY: "auto" }}>
            <Code block style={{ background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: 11, padding: 0 }}>
              {entry.sql}
            </Code>
          </Box>
        </Stack>
      </Modal>

      {/* Date Filter Drawer */}
      <Drawer
        opened={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        title="Configure Query Date Filters"
        position="right"
        size="650px"
        overlayProps={{
          color: "#05010d",
          opacity: 0.85,
          blur: 10,
        }}
        styles={{
          content: { background: "#0c0814", borderLeft: "1px solid rgba(147,51,234,0.2)", padding: "1.5rem" },
          header: { background: "#0c0814", borderBottom: "1px solid rgba(147,51,234,0.1)", paddingBottom: "1rem" },
          title: { color: "white", fontWeight: 600 }
        }}
      >
        <Stack gap="md">
          {dateColumns.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No date or timestamp columns discovered in the participating tables. Make sure your query references tables with date fields.
            </Text>
          ) : (
            <>
              {tempFilterRules.length > 0 && (
                <Grid styles={{ inner: { gap: "var(--mantine-spacing-md)" } }} mb="xs" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                  <Grid.Col span={4}><Text size="xs" fw={600} c="dimmed">Column</Text></Grid.Col>
                  <Grid.Col span={3}><Text size="xs" fw={600} c="dimmed">Filter Type</Text></Grid.Col>
                  <Grid.Col span={4}><Text size="xs" fw={600} c="dimmed">Value / Range</Text></Grid.Col>
                  <Grid.Col span={1}></Grid.Col>
                </Grid>
              )}

              <Stack gap="sm">
                {tempFilterRules.map((rule, idx) => (
                  <Grid key={rule.id || idx} align="center" styles={{ inner: { gap: "var(--mantine-spacing-md)" } }}>
                    <Grid.Col span={4}>
                      <Select
                        placeholder="Select column"
                        data={dateColumns}
                        value={rule.column}
                        onChange={(val) => handleUpdateRule(idx, { column: val || "" })}
                        styles={{
                          input: { background: "rgba(0,0,0,0.3)", borderColor: "rgba(147,51,234,0.2)", color: "white" }
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Select
                        placeholder="Select type"
                        data={[
                          { value: "between", label: "Date Range" },
                          { value: "month_year", label: "Month & Year" },
                          { value: "year", label: "Year Only" },
                          { value: "month", label: "Month Only" },
                        ]}
                        value={rule.type}
                        onChange={(val) => handleUpdateRule(idx, { type: val || "between" })}
                        styles={{
                          input: { background: "rgba(0,0,0,0.3)", borderColor: "rgba(147,51,234,0.2)", color: "white" }
                        }}
                      />
                    </Grid.Col>
                    <Grid.Col span={4}>
                      {rule.type === "between" && (
                        <Group gap="xs" grow wrap="nowrap">
                          <TextInput
                            type="date"
                            placeholder="From"
                            value={rule.dateFrom || ""}
                            onChange={(e) => handleUpdateRule(idx, { dateFrom: e.target.value })}
                            styles={{
                              input: { background: "rgba(0,0,0,0.3)", borderColor: "rgba(147,51,234,0.2)", color: "white" }
                            }}
                          />
                          <TextInput
                            type="date"
                            placeholder="To"
                            value={rule.dateTo || ""}
                            onChange={(e) => handleUpdateRule(idx, { dateTo: e.target.value })}
                            styles={{
                              input: { background: "rgba(0,0,0,0.3)", borderColor: "rgba(147,51,234,0.2)", color: "white" }
                            }}
                          />
                        </Group>
                      )}
                      {rule.type === "month_year" && (
                        <Group gap="xs" grow wrap="nowrap">
                          <Select
                            placeholder="Month"
                            data={MONTH_OPTIONS}
                            value={rule.month}
                            onChange={(val) => handleUpdateRule(idx, { month: val || "1" })}
                            styles={{
                              input: { background: "rgba(0,0,0,0.3)", borderColor: "rgba(147,51,234,0.2)", color: "white" }
                            }}
                          />
                          <TextInput
                            placeholder="Year"
                            value={rule.year || ""}
                            onChange={(e) => handleUpdateRule(idx, { year: e.target.value })}
                            styles={{
                              input: { background: "rgba(0,0,0,0.3)", borderColor: "rgba(147,51,234,0.2)", color: "white" }
                            }}
                          />
                        </Group>
                      )}
                      {rule.type === "year" && (
                        <TextInput
                          placeholder="Year (YYYY)"
                          value={rule.year || ""}
                          onChange={(e) => handleUpdateRule(idx, { year: e.target.value })}
                          styles={{
                            input: { background: "rgba(0,0,0,0.3)", borderColor: "rgba(147,51,234,0.2)", color: "white" }
                          }}
                        />
                      )}
                      {rule.type === "month" && (
                        <Select
                          placeholder="Month"
                          data={MONTH_OPTIONS}
                          value={rule.month}
                          onChange={(val) => handleUpdateRule(idx, { month: val || "1" })}
                          styles={{
                            input: { background: "rgba(0,0,0,0.3)", borderColor: "rgba(147,51,234,0.2)", color: "white" }
                          }}
                        />
                      )}
                    </Grid.Col>
                    <Grid.Col span={1} style={{ display: "flex", justifyContent: "center" }}>
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="md"
                        radius="md"
                        onClick={() => handleRemoveRule(idx)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Grid.Col>
                  </Grid>
                ))}
              </Stack>

              <Group justify="flex-start" mt="xs">
                <Button
                  leftSection={<IconPlus size={14} />}
                  variant="outline"
                  color="violet"
                  size="xs"
                  onClick={handleAddRule}
                >
                  Add Filter Rule
                </Button>
              </Group>

              <Group justify="flex-end" gap="sm" mt="lg" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "1rem" }}>
                {((filterRules && filterRules.length > 0) || entry.filterDateColumn) && (
                  <Button variant="subtle" color="red" size="sm" onClick={handleClearFilter} loading={refreshing}>
                    Clear Filters
                  </Button>
                )}
                <Button variant="subtle" color="gray" size="sm" onClick={() => setFilterModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  color="violet"
                  size="sm"
                  onClick={handleApplyFilter}
                  loading={refreshing}
                  disabled={tempFilterRules.length === 0}
                >
                  Apply & Run Query
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Saved Query"
        centered
        size="sm"
        overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        styles={{
          content: { background: "#130f22", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 12 },
          header: { background: "#130f22", color: "white" },
          title: { fontWeight: 600 }
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="rgba(255,255,255,0.7)">
            Are you sure you want to delete this saved result from your Databook? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={() => setDeleteModalOpen(false)} size="xs">
              Cancel
            </Button>
            <Button color="red" onClick={handleDelete} size="xs">
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  </Box>
);
}
