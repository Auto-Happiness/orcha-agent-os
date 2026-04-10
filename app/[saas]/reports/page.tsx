"use client";

import React, { useState } from "react";
import { 
  Box, 
  Title, 
  Text, 
  SimpleGrid, 
  Paper, 
  Group, 
  ThemeIcon, 
  Stack,
  Button,
  Badge,
  ActionIcon,
  Tooltip,
  Divider,
  Tabs,
  Avatar,
  Table
} from "@mantine/core";
import Link from "next/link";
import { useParams } from "next/navigation";
import { 
  IconFileSpreadsheet, 
  IconTable, 
  IconUpload, 
  IconPlayerPlay,
  IconClock,
  IconBrandGithub,
  IconDotsVertical,
  IconDownload,
  IconLayoutGrid,
  IconListDetails,
  IconChartBar,
  IconPlus,
  IconSearch
} from "@tabler/icons-react";

export default function ReportsPage() {
  const params = useParams<{ saas: string }>();
  const [activeTab, setActiveTab] = useState<string | null>("templates");

  const templates = [
    { id: 1, name: "Monthly Financial Summary", type: "XLSX", lastUsed: "2h ago", author: "System", description: "Standard balance sheet and P&L template." },
    { id: 2, name: "Customer Growth Tracker", type: "CSV", lastUsed: "1d ago", author: "Alex", description: "Daily active users and churn metrics." },
    { id: 3, name: "Inventory Audit Log", type: "XLSX", lastUsed: "5h ago", author: "Sarah", description: "Warehouse stock levels and SKU movements." },
  ];

  const recentReports = [
    { id: 101, name: "March_Sales_Final.xlsx", size: "2.4 MB", date: "2024-03-31", status: "Completed" },
    { id: 102, name: "User_Feedback_Export.csv", size: "840 KB", date: "2024-04-01", status: "Completed" },
    { id: 103, name: "Q1_Inventory_Report.xlsx", size: "4.1 MB", date: "2024-04-05", status: "Processing" },
  ];

  return (
    <Box p="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-end">
          <Box>
            <Group gap="xs" mb={4}>
              <ThemeIcon variant="light" color="green" size="sm">
                <IconFileSpreadsheet size={16} />
              </ThemeIcon>
              <Text size="xs" fw={700} c="green.4" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Spreadsheet Automation
              </Text>
            </Group>
            <Title order={1} c="white">Spreadsheet Reports</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Generate data-driven spreadsheets using XLSX templates and AI mapping.
            </Text>
          </Box>
          <Button 
            variant="gradient" 
            gradient={{ from: 'green.7', to: 'green.5' }} 
            leftSection={<IconPlus size={16} />}
            radius="md"
            component={Link}
            href={`/${params.saas}/reports/create`}
          >
            Create Report
          </Button>
        </Group>

        <Divider color="rgba(255,255,255,0.08)" />

        <Tabs value={activeTab} onChange={setActiveTab} variant="pills" color="violet" styles={{
          tab: {
            color: "rgba(255,255,255,0.5)",
            fontSize: "13px",
            fontWeight: 500,
          },
          list: { gap: "4px" }
        }}>
          <Tabs.List mb="md">
            <Tabs.Tab value="templates" leftSection={<IconLayoutGrid size={14} />}>Templates</Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconClock size={14} />}>Run History</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="templates">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {templates.map((tpl) => (
                <Paper 
                  key={tpl.id} 
                  p="lg" 
                  radius="md" 
                  style={{ 
                    background: "rgba(255,255,255,0.02)", 
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  className="hover-bright"
                >
                  <Group justify="space-between" mb="xs">
                    <Badge color={tpl.type === "XLSX" ? "green" : "blue"} variant="light" size="xs">{tpl.type}</Badge>
                    <ActionIcon variant="subtle" size="sm" color="dimmed"><IconDotsVertical size={14} /></ActionIcon>
                  </Group>
                  <Text fw={600} c="white" size="sm" mb={4}>{tpl.name}</Text>
                  <Text size="xs" c="dimmed" mb="lg" lineClamp={2}>{tpl.description}</Text>
                  
                  <Divider color="rgba(255,255,255,0.05)" mb="md" />
                  
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Avatar size="xs" radius="xl" color="violet">{tpl.author[0]}</Avatar>
                      <Text size="11px" c="dimmed">{tpl.author}</Text>
                    </Group>
                    <Text size="11px" c="dimmed">Last used {tpl.lastUsed}</Text>
                  </Group>
                </Paper>
              ))}
              
              <Paper 
                p="lg" 
                radius="md" 
                style={{ 
                  background: "transparent", 
                  border: "2px dashed rgba(255,255,255,0.1)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 160,
                  cursor: "pointer"
                }}
              >
                <IconUpload size={30} color="rgba(255,255,255,0.3)" />
                <Text size="xs" c="dimmed" mt="sm">Upload new template</Text>
              </Paper>
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="history">
            <Paper radius="md" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <Table variant="unstyled" verticalSpacing="sm">
                <Table.Thead style={{ background: "rgba(255,255,255,0.03)" }}>
                  <Table.Tr>
                    <Table.Th c="dimmed" style={{ fontSize: "11px", fontWeight: 600 }}>REPORT NAME</Table.Th>
                    <Table.Th c="dimmed" style={{ fontSize: "11px", fontWeight: 600 }}>DATE</Table.Th>
                    <Table.Th c="dimmed" style={{ fontSize: "11px", fontWeight: 600 }}>SIZE</Table.Th>
                    <Table.Th c="dimmed" style={{ fontSize: "11px", fontWeight: 600 }}>STATUS</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recentReports.map((report) => (
                    <Table.Tr key={report.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <Table.Td>
                        <Group gap="sm">
                          <IconFileSpreadsheet size={16} color="#4ade80" />
                          <Text size="xs" c="white" fw={500}>{report.name}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td><Text size="xs" c="dimmed">{report.date}</Text></Table.Td>
                      <Table.Td><Text size="xs" c="dimmed">{report.size}</Text></Table.Td>
                      <Table.Td>
                        <Badge 
                          size="xs" 
                          variant="light" 
                          color={report.status === "Completed" ? "green" : "blue"}
                        >
                          {report.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end">
                          <Tooltip label="Download"><ActionIcon variant="subtle" size="sm" color="dimmed"><IconDownload size={14} /></ActionIcon></Tooltip>
                          <ActionIcon variant="subtle" size="sm" color="dimmed"><IconDotsVertical size={14} /></ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Box>
  );
}

