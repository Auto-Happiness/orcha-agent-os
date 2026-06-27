"use client";

import React from "react";
import { Box, Group, Text, Button } from "@mantine/core";

interface PaginationControlsProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  loadingPage: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalCount,
  pageSize,
  loadingPage,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Box
      style={{
        background: "var(--orcha-panel)",
        backdropFilter: "blur(12px)",
        border: "1px solid var(--orcha-border)",
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
          Showing <Text span fw={600} c="var(--orcha-text-title)">{((currentPage - 1) * pageSize) + 1}</Text> to{" "}
          <Text span fw={600} c="var(--orcha-text-title)">{Math.min(currentPage * pageSize, totalCount)}</Text> of{" "}
          <Text span fw={600} c="var(--orcha-text-title)">{totalCount.toLocaleString()}</Text> records
        </Text>
      </Group>

      <Group gap="md">
        <Text size="xs" c="dimmed">
          Page <Text span fw={600} c="var(--orcha-text-title)">{currentPage}</Text> of <Text span fw={600} c="var(--orcha-text-title)">{totalPages}</Text>
        </Text>

        <Group gap="xs">
          <Button
            size="compact-xs"
            variant="light"
            color="violet"
            disabled={currentPage === 1 || loadingPage}
            onClick={() => onPageChange(1)}
          >
            First
          </Button>
          <Button
            size="compact-xs"
            variant="light"
            color="violet"
            disabled={currentPage === 1 || loadingPage}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Prev
          </Button>
          <Button
            size="compact-xs"
            variant="light"
            color="violet"
            disabled={currentPage === totalPages || loadingPage}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
          <Button
            size="compact-xs"
            variant="light"
            color="violet"
            disabled={currentPage === totalPages || loadingPage}
            onClick={() => onPageChange(totalPages)}
          >
            Last
          </Button>
        </Group>
      </Group>
    </Box>
  );
}
