"use client";

import React, { useMemo } from "react";
import ReactFlow, {
  Handle,
  Position,
  Background,
  Controls,
  Node,
  Edge,
  BaseEdge,
  getBezierPath,
  EdgeProps,
  MarkerType,
  BackgroundVariant
} from "reactflow";
import "reactflow/dist/style.css";
import { Box, Text, Group, Stack, Badge, rem, useMantineColorScheme } from "@mantine/core";
import { IconDatabase, IconFingerprint, IconRelationOneToOne } from "@tabler/icons-react";

const PRIMARY_PURPLE = "#a855f7";

const TableNode = ({ data }: { data: any }) => {
  const isDark = data._isDark;
  const nodeBg       = isDark ? "#1a1b1e"                    : "#ffffff";
  const headerBg     = isDark ? "#2c2e33"                    : "#f1f5f9";
  const borderCol    = isDark ? "rgba(255,255,255,0.08)"     : "rgba(0,0,0,0.08)";
  const handleBorder = isDark ? "#0c0c0e"                    : "#ffffff";
  const textCol      = isDark ? "white"                      : "#0f172a";
  const iconCol      = isDark ? "rgba(255,255,255,0.2)"      : "rgba(0,0,0,0.2)";
  const fieldText    = isDark ? "gray.4"                     : "gray.7";

  return (
    <Box
      style={{
        width: 280,
        backgroundColor: nodeBg,
        borderRadius: "8px",
        border: `1px solid ${borderCol}`,
        overflow: "hidden",
        boxShadow: isDark
          ? "0 10px 15px -3px rgba(0,0,0,0.4)"
          : "0 4px 12px rgba(0,0,0,0.08)",
        color: textCol
      }}
    >
      {/* Header */}
      <Box
        p="xs"
        style={{
          backgroundColor: headerBg,
          borderBottom: `1px solid ${borderCol}`,
          cursor: "grab"
        }}
        className="drag-handle"
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap={8}>
            <IconDatabase size={16} color={PRIMARY_PURPLE} />
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" fw={700} truncate title={data.displayName} style={{ color: textCol }}>{data.displayName}</Text>
            </Box>
          </Group>
          <Badge size="xs" variant="outline" color="gray" styles={{ label: { fontSize: '9px', textTransform: 'lowercase' } }}>{data.tableName}</Badge>
        </Group>
      </Box>

      {/* Body */}
      <Stack gap={0} p={4}>
        <Box px="xs" py={4}>
          <Text size="9px" fw={700} c="dimmed" style={{ textTransform: "uppercase" }}>Columns</Text>
        </Box>

        {data.fields?.map((field: any) => (
          <Box
            key={field.columnName}
            px="xs"
            py={4}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              borderRadius: "4px",
              transition: "background 150ms ease"
            }}
            className="column-row"
          >
            {/* Connection Handles (Left & Right) */}
            <Handle
              type="target"
              position={Position.Left}
              id={`target-${field.columnName}`}
              style={{
                left: -4,
                background: PRIMARY_PURPLE,
                width: 8,
                height: 8,
                border: `2px solid ${handleBorder}`,
                zIndex: 10
              }}
            />

            <Group justify="space-between" style={{ flex: 1 }} wrap="nowrap">
              <Group gap={6} wrap="nowrap">
                {field.isPrimary ? (
                  <IconFingerprint size={12} color={PRIMARY_PURPLE} />
                ) : (
                  <IconRelationOneToOne size={12} color={iconCol} />
                )}
                <Text size="xs" c={field.isPrimary ? (isDark ? "white" : "dark") : fieldText} truncate>{field.displayName}</Text>
              </Group>
              <Text size="9px" c="dimmed" style={{ fontFamily: "monospace" }}>{field.type === 'dimension' ? 'DIM' : 'MEA'}</Text>
            </Group>

            <Handle
              type="source"
              position={Position.Right}
              id={`source-${field.columnName}`}
              style={{
                right: -4,
                background: PRIMARY_PURPLE,
                width: 8,
                height: 8,
                border: `2px solid ${handleBorder}`,
                zIndex: 10
              }}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

const RelationshipEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: PRIMARY_PURPLE,
          strokeWidth: 2,
          strokeOpacity: 0.5,
          filter: "drop-shadow(0 0 4px rgba(168, 85, 247, 0.4))"
        }}
      />
    </>
  );
};

const nodeTypes = { table: TableNode };
const edgeTypes = { relationship: RelationshipEdge };

interface SchemaDiagramProps {
  models: any[];
  relationships: any[];
}

export function SchemaDiagram({ models, relationships }: SchemaDiagramProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const canvasBg       = isDark ? "#0c0c0e"                : "#f8fafc";
  const canvasBorder   = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
  const controlsBg     = isDark ? "#1a1b1e"                : "#ffffff";
  const controlsBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const gridColor      = isDark ? "rgba(168,85,247,0.05)"  : "rgba(168,85,247,0.10)";

  // Inject _isDark into node data so TableNode can read the palette without a React context
  const nodes: Node[] = useMemo(() => {
    return models.map((model, idx) => ({
      id: model._id,
      type: "table",
      position: { x: (idx % 3) * 380, y: Math.floor(idx / 3) * 450 },
      data: { ...model, _isDark: isDark },
      dragHandle: ".drag-handle",
    }));
  }, [models, isDark]);

  // Convert relationships to React Flow Edges
  const edges: Edge[] = useMemo(() => {
    return relationships.map((rel) => ({
      id: rel._id,
      source: rel.fromModelId,
      target: rel.toModelId,
      type: "relationship",
      sourceHandle: `source-${rel.fromColumn}`,
      targetHandle: `target-${rel.toColumn}`,
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: PRIMARY_PURPLE,
        width: 15,
        height: 15,
      },
    }));
  }, [relationships]);

  return (
    <Box h="700px" style={{
      border: `1px solid ${canvasBorder}`,
      borderRadius: rem(12),
      overflow: "hidden",
      background: canvasBg
    }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background
          gap={24}
          color={gridColor}
          variant={BackgroundVariant.Lines}
        />
        <Controls
          style={{
            background: controlsBg,
            border: `1px solid ${controlsBorder}`
          }}
        />
      </ReactFlow>
    </Box>
  );
}
