"use client";

import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Box, Text, Center, Loader, Stack, Group } from "@mantine/core";

interface DynamicChartProps {
  data: any[];
  type: "bar" | "line" | "pie" | "area" | "kpi";
  labelKey: string;
  valueKeys: string[];
  height?: number | string;
  seriesColors?: Record<string, string>;
  isLoading?: boolean;
}

export function DynamicChart({
  data,
  type,
  labelKey,
  valueKeys,
  height = 300,
  seriesColors,
  isLoading
}: DynamicChartProps) {

  // Format data for Recharts - ensure all numeric keys are parsed
  const formattedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item) => {
      const formattedItem: any = { ...item };
      formattedItem[labelKey] = String(item[labelKey] || "Unknown");
      valueKeys.forEach(key => {
        formattedItem[key] = parseFloat(String(item[key])) || 0;
      });
      return formattedItem;
    });
  }, [data, labelKey, valueKeys]);

  if (isLoading) {
    return (
      <Center h={height}>
        <Loader color="violet" size="sm" />
      </Center>
    );
  }

  if (formattedData.length === 0) {
    return (
      <Center h={height} style={{ border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8 }}>
        <Text size="xs" c="dimmed">No data available for visualization</Text>
      </Center>
    );
  }

  // Common styles
  const axisStyle = {
    fontSize: 10,
    fill: "rgba(255,255,255,0.4)",
  };

  const defaultPalette = ["#9333ea", "#00D1FF", "#00FF94", "#FF00E5", "#FFB800", "#FF6B6B"];

  const getSeriesColor = (key: string, index: number) => {
    // 1. Check if there's an explicit color for this specific key
    if (seriesColors && seriesColors[key]) return seriesColors[key];
    
    // 2. Fallback to default palette
    return defaultPalette[index % defaultPalette.length];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Box
          p="xs"
          style={{
            background: "#130f22",
            border: "1px solid rgba(147, 51, 234, 0.2)",
            borderRadius: 8,
            boxShadow: "0 10px 20px rgba(0,0,0,0.3)",
          }}
        >
          <Text size="xs" fw={700} c="white" mb={4}>
            {label}
          </Text>
          <Stack gap={2}>
            {payload.map((entry: any, index: number) => (
              <Group key={index} gap={8} wrap="nowrap">
                <Box w={8} h={8} style={{ borderRadius: "50%", background: entry.color || entry.fill }} />
                <Text size="10px" c="dimmed" style={{ flex: 1 }}>{entry.name}:</Text>
                <Text size="10px" fw={700} c="white">
                  {entry.value.toLocaleString()}
                </Text>
              </Group>
            ))}
          </Stack>
        </Box>
      );
    }
    return null;
  };

  // Render logic based on type
  const renderChart = () => {
    switch (type) {
      case "line":
        return (
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={labelKey} {...axisStyle} tickLine={false} axisLine={false} dy={10} />
            <YAxis {...axisStyle} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            {valueKeys.map((key, index) => {
              const sColor = getSeriesColor(key, index);
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={sColor}
                  strokeWidth={3}
                  dot={{ r: 4, fill: sColor, strokeWidth: 2, stroke: "#0c0918" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              );
            })}
          </LineChart>
        );

      case "area":
        return (
          <AreaChart data={formattedData}>
            <defs>
              {valueKeys.map((key, index) => {
                const sColor = getSeriesColor(key, index);
                return (
                  <linearGradient key={`grad-${key}`} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={sColor} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={sColor} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={labelKey} {...axisStyle} tickLine={false} axisLine={false} dy={10} />
            <YAxis {...axisStyle} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {valueKeys.map((key, index) => {
              const sColor = getSeriesColor(key, index);
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={sColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#color-${key})`}
                />
              );
            })}
          </AreaChart>
        );

      case "pie":
        const primaryValueKey = valueKeys[0];
        return (
          <PieChart>
            <Pie
              data={formattedData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey={primaryValueKey}
              nameKey={labelKey}
              stroke="none"
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            >
              {formattedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getSeriesColor(String(entry[labelKey]), index)}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}
            />
          </PieChart>
        );

      case "bar":
      default:
        return (
          <BarChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey={labelKey} {...axisStyle} tickLine={false} axisLine={false} dy={10} />
            <YAxis {...axisStyle} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            {valueKeys.map((key, index) => {
              const sColor = getSeriesColor(key, index);
              return (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  fill={sColor}
                  radius={[4, 4, 0, 0]}
                  barSize={24}
                />
              );
            })}
          </BarChart>
        );
    }
  };

  return (
    <Box h={height} w="100%">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </Box>
  );
}
