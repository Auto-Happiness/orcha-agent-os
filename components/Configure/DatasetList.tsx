import { 
  Stack, 
  Group, 
  Text, 
  Button, 
  Table, 
  Badge, 
  ActionIcon, 
  Tooltip 
} from "@mantine/core";
import { IconPlus, IconTable, IconCopy, IconTrash, IconCheck } from "@tabler/icons-react";

const DATASETS = [
  { name: "Product Catalog", source: "PostgreSQL", tables: 12 },
  { name: "User Events (BigQuery)", source: "BigQuery", tables: 45 },
  { name: "Real-time Audits", source: "Firestore", tables: 8 },
];

export function DatasetList() {
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">List of generated toolsets and materialized views for your AI.</Text>
        <Button leftSection={<IconPlus size={16} />} size="xs" color="violet" variant="outline">Create Dataset</Button>
      </Group>

      <Table verticalSpacing="sm" style={{ color: "rgba(255,255,255,0.7)" }}>
        <Table.Thead>
          <Table.Tr style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <Table.Th>Dataset Name</Table.Th>
            <Table.Th>Source</Table.Th>
            <Table.Th>Tables</Table.Th>
            <Table.Th>Sync Status</Table.Th>
            <Table.Th ta="right">Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {DATASETS.map((d) => (
            <Table.Tr key={d.name} style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <IconTable size={14} color="#a855f7" />
                  <Text size="sm" fw={500}>{d.name}</Text>
                </Group>
              </Table.Td>
              <Table.Td><Badge color="gray" size="xs" variant="outline">{d.source}</Badge></Table.Td>
              <Table.Td><Text size="xs">{d.tables} tables</Text></Table.Td>
              <Table.Td>
                <Group gap={6}>
                  <IconCheck size={12} color="#22c55e" />
                  <Text size="xs" c="green.4">Synched</Text>
                </Group>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <Tooltip label="Copy ID"><ActionIcon variant="subtle" size="sm" color="violet"><IconCopy size={14} /></ActionIcon></Tooltip>
                  <Tooltip label="Delete"><ActionIcon variant="subtle" size="sm" color="red"><IconTrash size={14} /></ActionIcon></Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
