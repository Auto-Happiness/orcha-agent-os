"use client";

import React from "react";
import { Box, ScrollArea, TextInput, Text } from "@mantine/core";
// Sub-components
import { evaluateCell, parseCoord, formatCoord } from "@/lib/spreadsheet-engine";

interface SpreadsheetGridProps {
  rows: number;
  cols: number;
  cells: Record<string, string>;
  activeCell: string | null;
  onCellClick: (coord: string) => void;
  onCellChange: (coord: string, val: string) => void;
  showSampleData?: boolean;
  sampleData?: Record<string, any>;
}

const COL_HEADERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function SpreadsheetGrid({ 
  rows, 
  cols, 
  cells, 
  activeCell, 
  onCellClick, 
  onCellChange,
  showSampleData = false,
  sampleData = {}
}: SpreadsheetGridProps) {

  const handleKeyDown = (e: React.KeyboardEvent, coord: string) => {
    const { colIdx, rowIdx } = parseCoord(coord);
    
    let nextCol = colIdx;
    let nextRow = rowIdx;

    if (e.key === "ArrowUp") nextRow = Math.max(0, rowIdx - 1);
    else if (e.key === "ArrowDown") nextRow = Math.min(rows - 1, rowIdx + 1);
    else if (e.key === "ArrowLeft") nextCol = Math.max(0, colIdx - 1);
    else if (e.key === "ArrowRight") nextCol = Math.min(cols - 1, colIdx + 1);
    else if (e.key === "Enter") nextRow = Math.min(rows - 1, rowIdx + 1);
    else return;

    e.preventDefault();
    const nextCoord = formatCoord(nextCol, nextRow);
    onCellClick(nextCoord);
    
    // Auto focus the next cell
    setTimeout(() => {
      const el = document.querySelector(`input[data-coord="${nextCoord}"]`) as HTMLInputElement;
      el?.focus();
      el?.select();
    }, 0);
  };

  return (
    <ScrollArea style={{ flex: 1 }} offsetScrollbars scrollbarSize={10} bg="#0c0918">
      <Box style={{ 
        display: "grid", 
        gridTemplateColumns: `40px repeat(${cols}, 120px)`,
        width: "fit-content"
      }}>
        {/* Header Row */}
        <Box h={25} style={{ borderRight: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)" }} />
        {COL_HEADERS.slice(0, cols).map(h => (
          <Box 
            key={h} 
            h={25} 
            style={{ 
              borderRight: "1px solid rgba(255,255,255,0.1)", 
              borderBottom: "1px solid rgba(255,255,255,0.1)", 
              background: "rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Text size="10px" fw={700} c="dimmed">{h}</Text>
          </Box>
        ))}

        {/* Rows */}
        {Array.from({ length: rows }).map((_, rIdx) => {
          const rNum = rIdx + 1;
          return (
            <React.Fragment key={rIdx}>
              {/* Row Header */}
              <Box 
                h={28} 
                style={{ 
                  borderRight: "1px solid rgba(255,255,255,0.1)", 
                  borderBottom: "1px solid rgba(255,255,255,0.1)", 
                  background: "rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text size="10px" fw={700} c="dimmed">{rNum}</Text>
              </Box>
              
              {/* Row Cells */}
              {COL_HEADERS.slice(0, cols).map(col => {
                const coord = `${col}${rNum}`;
                const isActive = activeCell === coord;
                const rawValue = cells[coord] || "";
                const displayValue = isActive ? rawValue : evaluateCell(coord, cells, new Set(), showSampleData, sampleData);
                const isMarker = rawValue.startsWith("{") && rawValue.endsWith("}");
                const isFormula = rawValue.startsWith("=");

                return (
                  <Box 
                    key={coord} 
                    h={28} 
                    onClick={() => onCellClick(coord)}
                    style={{ 
                      borderRight: "1px solid rgba(255,255,255,0.08)", 
                      borderBottom: "1px solid rgba(255,255,255,0.08)", 
                      background: isActive ? "rgba(74,222,128,0.1)" : "transparent",
                      outline: isActive ? "1px solid #4ade80" : "none",
                      zIndex: isActive ? 1 : 0,
                      position: "relative",
                      padding: "0 4px",
                      display: "flex",
                      alignItems: "center",
                      cursor: "cell"
                    }}
                  >
                    <TextInput
                      variant="unstyled"
                      size="xs"
                      data-coord={coord}
                      value={displayValue}
                      onChange={(e) => onCellChange(coord, e.currentTarget.value)}
                      onFocus={() => onCellClick(coord)}
                      onKeyDown={(e) => handleKeyDown(e, coord)}
                      styles={{ 
                        input: { 
                          height: 24, 
                          color: isMarker ? "#4ade80" : isFormula && !isActive ? "#60a5fa" : "white", 
                          fontWeight: isMarker || (isFormula && !isActive) ? 600 : 400,
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                          overflow: "hidden"
                        } 
                      }}
                    />
                  </Box>
                );
              })}
            </React.Fragment>
          );
        })}
      </Box>
    </ScrollArea>

  );
}
