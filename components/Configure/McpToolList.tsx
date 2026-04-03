'use client';

import {
  Stack,
  Group,
  Text,
  Button,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Code,
  Modal,
  TextInput,
  Textarea,
  Select
} from "@mantine/core";
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTerminal2, IconCopy, IconTrash, IconDatabase } from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function McpToolList({ organizationId }: { organizationId: string | undefined }) {
  const tools = useQuery(
    api.mcpTools.listByOrganization, 
    organizationId ? { organizationId: organizationId as any } : "skip"
  );
  const configs = useQuery(
    api.databaseConfigs.getByOrganization, 
    organizationId ? { organizationId: organizationId as any } : "skip"
  );

  const createTool = useMutation(api.mcpTools.create);
  const [opened, { open, close }] = useDisclosure(false);

  // Form State
  const [newTool, setNewTool] = useState({
    name: '',
    description: '',
    statement: '',
    configId: ''
  });

  const handleSave = async () => {
    if (!newTool.name || !newTool.statement || !newTool.configId) return;

    await createTool({
      organizationId: organizationId as any,
      configId: newTool.configId as any,
      name: newTool.name,
      description: newTool.description,
      parameters: [], // TODO: Basic auto-discovery or manual entry
      statement: newTool.statement
    });
    close();
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">Define specialized SQL tools that your AI can execute on your behalf.</Text>
        <Button
          leftSection={<IconPlus size={16} />}
          size="xs"
          color="violet"
          variant="outline"
          onClick={open}
        >
          Create Tool
        </Button>
      </Group>

      <Table verticalSpacing="sm" style={{ color: "rgba(255,255,255,0.8)" }}>
        <Table.Thead>
          <Table.Tr style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <Table.Th>Tool Name</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>SQL Statement</Table.Th>
            <Table.Th ta="right">Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tools?.map((tool: any) => (
            <Table.Tr key={tool._id} style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <IconTerminal2 size={14} color="#a855f7" />
                  <Text size="sm" fw={500}>{tool.name}</Text>
                </Group>
              </Table.Td>
              <Table.Td><Text size="xs" c="dimmed" lineClamp={1}>{tool.description}</Text></Table.Td>
              <Table.Td>
                <Code color="dark.6" c="violet.4">{tool.statement.substring(0, 30)}...</Code>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <Tooltip label="Copy ID"><ActionIcon variant="subtle" size="sm" color="violet"><IconCopy size={14} /></ActionIcon></Tooltip>
                  <Tooltip label="Delete"><ActionIcon variant="subtle" size="sm" color="red"><IconTrash size={14} /></ActionIcon></Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {(!tools || tools.length === 0) && (
            <Table.Tr>
              <Table.Td colSpan={4} align="center">
                <Stack align="center" py="md">
                  <IconDatabase size={30} opacity={0.2} />
                  <Text size="xs" c="dimmed">No tools defined for this workspace.</Text>
                </Stack>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={close} title="Create New MCP Tool" size="lg">
        <Stack gap="md">
          <Select
            label="Database Connection"
            placeholder="Select source"
            data={configs ? [{ value: (configs as any)._id, label: (configs as any).type }] : []}
            value={newTool.configId}
            onChange={(val) => setNewTool({ ...newTool, configId: val || '' })}
          />
          <TextInput
            label="Tool Name"
            placeholder="e.g. search_customers"
            value={newTool.name}
            onChange={(e) => setNewTool({ ...newTool, name: e.currentTarget.value })}
          />
          <Textarea
            label="Description"
            placeholder="How the AI should use this tool"
            value={newTool.description}
            onChange={(e) => setNewTool({ ...newTool, description: e.currentTarget.value })}
          />
          <Textarea
            label="SQL Statement"
            placeholder="SELECT * FROM users WHERE email = $1"
            minRows={4}
            value={newTool.statement}
            onChange={(e) => setNewTool({ ...newTool, statement: e.currentTarget.value })}
            description="Use $1, $2 for parameters."
          />
          <Button color="violet" onClick={handleSave}>Save Tool</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
