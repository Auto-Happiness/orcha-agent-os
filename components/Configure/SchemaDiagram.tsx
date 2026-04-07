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
import { Box, Text, Group, Stack, Badge, rem, Divider } from "@mantine/core";
import { IconDatabase, IconFingerprint, IconRelationOneToOne } from "@tabler/icons-react";

// --- Wren AI Style Constants ---
const PRIMARY_PURPLE = "#a855f7";
const BACKGROUND_DARK = "#0c0c0e";
const NODE_BG = "#1a1b1e";
const HEADER_BG = "#2c2e33";

// --- Custom DB Table Node (Wren AI Look) ---
const TableNode = ({ data }: { data: any }) => {
  return (
    <Box 
      style={{ 
        width: 280, 
        backgroundColor: NODE_BG,
        borderRadius: "8px",
        border: `1px solid rgba(255,255,255,0.08)`,
        overflow: "hidden",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)",
        color: "white"
      }}
    >
      {/* Header */}
      <Box 
        p="xs" 
        style={{ 
          backgroundColor: HEADER_BG, 
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          cursor: "grab"
        }}
        className="drag-handle"
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap={8}>
            <IconDatabase size={16} color={PRIMARY_PURPLE} />
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="xs" fw={700} truncate title={data.displayName}>{data.displayName}</Text>
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
                border: "2px solid #0c0c0e",
                zIndex: 10
              }} 
            />
            
            <Group justify="space-between" style={{ flex: 1 }} wrap="nowrap">
              <Group gap={6} wrap="nowrap">
                {field.isPrimary ? (
                  <IconFingerprint size={12} color={PRIMARY_PURPLE} />
                ) : (
                  <IconRelationOneToOne size={12} color="rgba(255,255,255,0.2)" />
                )}
                <Text size="xs" c={field.isPrimary ? "white" : "gray.4"} truncate>{field.displayName}</Text>
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
                border: "2px solid #0c0c0e",
                zIndex: 10
              }} 
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

// --- Custom Edge (Wren AI Look) ---
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

const nodeTypes = {
  table: TableNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

interface SchemaDiagramProps {
  models: any[];
  relationships: any[];
}

export function SchemaDiagram({ models, relationships }: SchemaDiagramProps) {
  // Convert models to React Flow Nodes
  const nodes: Node[] = useMemo(() => {
    return models.map((model, idx) => ({
      id: model._id,
      type: "table",
      position: { x: (idx % 3) * 380, y: Math.floor(idx / 3) * 450 },
      data: model,
      dragHandle: ".drag-handle",
    }));
  }, [models]);

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
      border: "1px solid rgba(255,255,255,0.05)", 
      borderRadius: rem(12), 
      overflow: "hidden", 
      background: BACKGROUND_DARK 
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
          color="rgba(168, 85, 247, 0.05)" // Subtle purple grid
          variant={BackgroundVariant.Lines} 
        />
        <Controls 
          style={{ 
            background: NODE_BG, 
            border: "1px solid rgba(255,255,255,0.08)"
          }} 
        />
      </ReactFlow>
    </Box>
  );
}
