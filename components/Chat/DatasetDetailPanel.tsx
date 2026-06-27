import React, { useCallback, useState, useEffect } from "react";
import { Box, Group, Stack, Text, ActionIcon, Loader, Button, Center, useMantineColorScheme } from "@mantine/core";
import { IconDownload, IconX } from "@tabler/icons-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { isPaginatable, buildCountSql, buildPageSql } from "../Databook/paginationHelpers";

interface DatasetDetailPanelProps {
  activeDetailTable: {
    data: any[];
    title: string;
    sql?: string;
  } | null;
  configId?: string | null;
  onClose: () => void;
}

const PAGE_SIZE = 50;

export function DatasetDetailPanel({ activeDetailTable, configId, onClose }: DatasetDetailPanelProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const dbConfig = useQuery(
    api.databaseConfigs.getById,
    configId ? { configId: configId as any } : "skip"
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageData, setPageData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset pagination states when SQL or title changes
  useEffect(() => {
    setCurrentPage(1);
    setTotalCount(null);
    setPageData([]);
    setErrorMessage(null);
  }, [activeDetailTable?.sql, activeDetailTable?.title]);

  const hasSqlPagination = activeDetailTable?.sql && dbConfig && isPaginatable(activeDetailTable.sql);

  // Fetch Total Count
  useEffect(() => {
    if (!activeDetailTable) return;

    if (!hasSqlPagination) {
      setPageData(activeDetailTable.data);
      setTotalCount(activeDetailTable.data.length);
      return;
    }

    let active = true;
    const fetchCount = async () => {
      try {
        const parsedConfig = JSON.parse(dbConfig.encryptedUri);
        const countSql = buildCountSql(activeDetailTable.sql!, dbConfig.type);
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
        if (!active) return;
        if (result.success && result.rows && result.rows.length > 0) {
          const row = result.rows[0];
          const countKey = Object.keys(row).find(k => k.toLowerCase() === "total_count");
          const countVal = countKey ? parseInt(row[countKey], 10) : 0;
          setTotalCount(countVal);
        } else {
          setTotalCount(activeDetailTable.data.length);
        }
      } catch (err) {
        console.error("[DatasetDetailPanel] Count query failed, falling back to static length:", err);
        if (active) {
          setTotalCount(activeDetailTable.data.length);
        }
      }
    };

    fetchCount();
    return () => {
      active = false;
    };
  }, [activeDetailTable, dbConfig, hasSqlPagination]);

  // Fetch Paginated Page Data
  useEffect(() => {
    if (!activeDetailTable) return;

    if (!hasSqlPagination) {
      setPageData(activeDetailTable.data);
      return;
    }

    let active = true;
    const fetchData = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const parsedConfig = JSON.parse(dbConfig.encryptedUri);
        const offset = (currentPage - 1) * PAGE_SIZE;
        const pageSql = buildPageSql(activeDetailTable.sql!, offset, PAGE_SIZE, dbConfig.type);
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
        if (!active) return;
        if (result.success) {
          setPageData(result.rows || []);
        } else {
          setErrorMessage(result.message || "Failed to load page data.");
          setPageData(activeDetailTable.data);
        }
      } catch (err: any) {
        console.error("[DatasetDetailPanel] Data fetch failed, falling back to static:", err);
        if (active) {
          setErrorMessage(err.message || "Failed to load page data.");
          setPageData(activeDetailTable.data);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [activeDetailTable, dbConfig, hasSqlPagination, currentPage]);

  const handleDownloadCSV = useCallback(async () => {
    if (!activeDetailTable) return;
    const { sql, data, title } = activeDetailTable;

    // Fallback to client-side page download if no sql, not paginatable, or no configId
    if (!sql || !isPaginatable(sql) || !configId) {
      const columns = Object.keys(data[0] || {});
      const escape = (v: any) => {
        if (v == null) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = columns.join(",");
      const rows = data.map(row => columns.map(c => escape(row[c])).join(","));
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_preview.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Export full dataset via API
    try {
      const res = await fetch("/api/export/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, configId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_full.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  }, [activeDetailTable, configId]);

  if (!activeDetailTable) return null;

  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 1;

  return (
    <Box
      style={{
        flex: 65,
        minWidth: 320,
        borderLeft: "1px solid var(--orcha-border)",
        background: "var(--orcha-panel)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        boxShadow: isDark ? "-8px 0 32px rgba(0,0,0,0.6)" : "-8px 0 32px rgba(0,0,0,0.06)",
        zIndex: 10,
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      
      {/* Header */}
      <Box style={{ background: "var(--orcha-surface)", borderBottom: "1px solid var(--orcha-border)", padding: "14px 20px" }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text size="xs" fw={700} c="var(--orcha-purple)" style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}>Dataset View</Text>
            <Text fw={700} size="sm" c="var(--orcha-text-title)" truncate>{activeDetailTable.title}</Text>
          </Stack>
          <Group gap={8}>
            <ActionIcon variant="subtle" color="violet" radius="md" size="md" onClick={handleDownloadCSV} title="Download CSV">
              <IconDownload size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" radius="md" size="md" onClick={onClose} title="Close Panel">
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Box>

      {/* Table Body */}
      <Box style={{ flex: 1, overflow: "auto", position: "relative" }} p="md">
        {loading && (
          <Center style={{ position: "absolute", inset: 0, background: isDark ? "rgba(12,8,20,0.7)" : "rgba(255,255,255,0.7)", zIndex: 5 }}>
            <Loader color="violet" size="md" />
          </Center>
        )}
        
        {errorMessage && (
          <Box p="sm" mb="md" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 6 }}>
            <Text size="xs" c="red.4">{errorMessage}</Text>
          </Box>
        )}

        <Box style={{ overflowX: "auto", minWidth: "100%" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--orcha-surface)", border: "1px solid var(--orcha-border)" }}>
            <thead>
              <tr>
                <th style={{ width: 40, padding: "10px 12px", textAlign: "right", fontSize: 10, color: "var(--orcha-text-muted)", fontWeight: 500, borderBottom: "1px solid var(--orcha-border)", background: "var(--orcha-sidebar-hover-bg)", userSelect: "none" }}>#</th>
                {pageData.length > 0 && Object.keys(pageData[0]).map((col) => (
                  <th key={col} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--orcha-purple)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap", borderBottom: "1px solid var(--orcha-border)", borderLeft: "1px solid var(--orcha-table-border)", background: "var(--orcha-sidebar-hover-bg)" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((row, ri) => {
                const columns = Object.keys(row);
                const absoluteIndex = (currentPage - 1) * PAGE_SIZE + ri + 1;
                return (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "var(--orcha-table-border)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--orcha-sidebar-hover-bg)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ri % 2 === 0 ? "transparent" : "var(--orcha-table-border)"; }}
                  >
                    <td style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, color: "var(--orcha-text-muted)", borderBottom: "1px solid var(--orcha-table-border)", userSelect: "none" }}>{absoluteIndex}</td>
                    {columns.map((col, ci) => {
                      const val = row[col];
                      const isNull = val == null;
                      const isNumericString = typeof val === "string" && /^-?\d+(\.\d+)?$/.test(val.trim());
                      const isNum = !isNull && (typeof val === "number" || isNumericString);
                      
                      const lowerCol = col.toLowerCase();
                      const isIdentifier = lowerCol === "id" || lowerCol.endsWith("_id") || lowerCol.endsWith("id") || lowerCol === "year" || lowerCol === "zip" || lowerCol === "zipcode" || lowerCol.includes("phone");
                      
                      let displayVal = String(val);
                      if (!isNull && isNum && !isIdentifier) {
                        const numVal = Number(val);
                        if (!isNaN(numVal)) {
                          displayVal = numVal.toLocaleString();
                        }
                      } else if (isNull) {
                        displayVal = "null";
                      }

                      const numericValue = !isNull && isNum ? Number(val) : NaN;
                      const isNegative = !isNaN(numericValue) && numericValue < 0;

                      return (
                        <td key={ci} style={{ padding: "8px 16px", fontSize: 12, color: isNull ? "var(--orcha-null-color)" : isNum && isNegative ? "#ef4444" : isNum ? "var(--orcha-number-color)" : "var(--orcha-text-body)", fontStyle: isNull ? "italic" : "normal", fontFamily: isNum ? "var(--font-geist-mono,monospace)" : "inherit", whiteSpace: "nowrap", borderBottom: "1px solid var(--orcha-table-border)", borderLeft: "1px solid var(--orcha-table-border)", textAlign: isNum ? "right" : "left" }}>
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {pageData.length === 0 && !loading && (
                <tr>
                  <td colSpan={100} style={{ padding: "30px", textAlign: "center", color: "var(--orcha-text-muted)", fontSize: "12px" }}>
                    No rows returned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Box>
      </Box>

      {/* Pagination Footer */}
      {hasSqlPagination && totalCount !== null && (
        <Box
          style={{
            background: "var(--orcha-surface)",
            borderTop: "1px solid var(--orcha-border)",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text size="xs" c="dimmed">
            Showing {((currentPage - 1) * PAGE_SIZE + 1).toLocaleString()} - {Math.min(currentPage * PAGE_SIZE, totalCount).toLocaleString()} of {totalCount.toLocaleString()} rows
          </Text>
          <Group gap={10} align="center">
            <Button
              variant="subtle"
              color="violet"
              size="xs"
              disabled={currentPage === 1 || loading}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              Previous
            </Button>
            <Text size="xs" fw={600} c="var(--orcha-text-title)">
              Page {currentPage} of {totalPages || 1}
            </Text>
            <Button
              variant="subtle"
              color="violet"
              size="xs"
              disabled={currentPage >= totalPages || loading}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              Next
            </Button>
          </Group>
        </Box>
      )}

      {!hasSqlPagination && pageData.length > 0 && (
        <Box
          style={{
            background: "var(--orcha-surface)",
            borderTop: "1px solid var(--orcha-border)",
            padding: "12px 20px",
          }}
        >
          <Text size="xs" c="dimmed">
            Showing all {pageData.length.toLocaleString()} rows (local preview)
          </Text>
        </Box>
      )}
    </Box>
  );
}
