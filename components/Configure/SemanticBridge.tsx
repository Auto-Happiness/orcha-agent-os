"use client";

import { 
  Stack, 
  Group, 
  Text, 
  Box, 
  Card,
  Badge, 
  ScrollArea,
  rem,
  Paper,
  ActionIcon,
  TextInput,
  Select,
  Grid,
  Button,
  Divider,
  Title,
  Center,
  Tooltip,
  Tabs,
  SegmentedControl
} from "@mantine/core";
import { 
  IconTable, 
  IconPlus,
  IconFingerprint,
  IconSettings,
  IconChartDots
} from "@tabler/icons-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { notifications } from "@mantine/notifications";
import { useParams } from "next/navigation";
import { SchemaDiagram } from "./SchemaDiagram";

interface SemanticBridgeProps {
  configId: string | null;
  organizationId?: string | null;
}

export function SemanticBridge({ configId }: SemanticBridgeProps) {
  const { saas } = useParams();
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const allModels = useQuery(api.semanticModels.listModelsByConfig, { configId: configId as any });
  const relationships = useQuery(api.semanticRelationships.listByConfig, { configId: configId as any });
  const { data, updateData } = useCreationWizard();
  
  const [viewMode, setViewMode] = useState<string>("list");
  
  // Only show models that were selected in the previous step
  const models: any[] = useMemo(() => {
    if (!allModels) return [];
    return allModels.filter((m: any) => data.selectedTables?.includes(m.tableName));
  }, [allModels, data.selectedTables]);

  const updateModel = useMutation(api.semanticModels.updateModel);
  const suggestRelationships = useMutation(api.semanticModels.suggestRelationships);
  const aiEnrich = useAction(api.semanticModels.generateAiEnrichment);
  const [isEnriching, setIsEnriching] = useState(false);
  
  // Suggest relationships when the step is first reached
  useMemo(() => {
    if (configId && activeOrg?._id) {
      suggestRelationships({ 
        configId: configId as any, 
        organizationId: activeOrg._id
      }).then(res => {
        if (res.suggestions && res.suggestions.length > 0) {
          notifications.show({
            title: "Relationships Suggested",
            message: `Automatically identified ${res.suggestions.length} potential table links.`,
            color: "violet",
            icon: <IconSettings size={16} />
          });
        }
      });
    }
  }, [configId, activeOrg?._id, suggestRelationships]);

  const handleAiEnrich = async () => {
    if (!configId || !activeOrg?._id) return;
    setIsEnriching(true);
    try {
      await aiEnrich({ 
        configId: configId as any,
        businessContext: data.businessContext || ""
      });
      notifications.show({ title: "AI Modeling Complete", message: "Refined business names and types using AI insights.", color: "green" });
    } catch (err) {
      notifications.show({ title: "AI Failed", message: "Could not apply AI enrichment.", color: "red" });
    } finally {
      setIsEnriching(false);
    }
  };

  const [activeTable, setActiveTable] = useState<string | null>(null);

  // Initialize active table if not set
  useMemo(() => {
    if (!activeTable && models.length > 0) {
      setActiveTable(models[0].tableName);
    }
  }, [models, activeTable]);

  const selectedModel = useMemo(() => 
    models.find((m: any) => m.tableName === activeTable),
    [models, activeTable]
  );

  const handleFieldUpdate = async (fieldIdx: number, updates: any) => {
    if (!selectedModel) return;
    
    const newFields = [...selectedModel.fields];
    newFields[fieldIdx] = { ...newFields[fieldIdx], ...updates };

    try {
      await updateModel({
        id: selectedModel._id,
        fields: newFields,
      });
    } catch (err) {
      notifications.show({ title: "Update Failed", message: "Could not save field changes.", color: "red" });
    }
  };

  if (allModels === undefined) {
    return <Text c="dimmed">Loading models...</Text>;
  }

  return (
    <Stack gap="xl">
      <Group justify="flex-end">
        <SegmentedControl 
          value={viewMode}
          onChange={setViewMode}
          data={[
            { label: 'Form View', value: 'list' },
            { label: 'Diagram View', value: 'diagram' },
          ]}
          color="violet"
          size="xs"
        />
      </Group>

      {viewMode === 'diagram' ? (
        <SchemaDiagram models={models} relationships={relationships || []} />
      ) : (
        <Grid>

      {/* Sidebar: Selected Tables */}
      <Grid.Col span={3}>
        <Stack gap="md">
           <Card withBorder radius="md" p="sm" bg="rgba(255,255,255,0.01)">
            <Stack gap={8}>
              <Text size="xs" fw={700} c="dimmed" style={{ textTransform: "uppercase", letterSpacing: rem(1) }}>Business Context</Text>
              <Text size="10px" c="dimmed">Help the AI understand this DB (e.g. "SaaS Billing")</Text>
              <TextInput 
                placeholder="Database purpose..."
                size="xs"
                value={data.businessContext}
                onChange={(e) => updateData({ businessContext: e.currentTarget.value })}
                styles={{ input: { background: "rgba(0,0,0,0.2)" } }}
              />
            </Stack>
          </Card>

          <Box>
            <Text size="xs" fw={700} c="dimmed" px="xs" mb={8} style={{ textTransform: "uppercase", letterSpacing: rem(1) }}>Selected Models</Text>
            <Stack gap="xs">
              {models.map(m => (
                <Paper
                  key={m._id}
                  p="sm"
                  radius="md"
                  style={{
                    cursor: "pointer",
                    background: activeTable === m.tableName ? "rgba(147,51,234,0.15)" : "transparent",
                    border: "1px solid",
                    borderColor: activeTable === m.tableName ? "rgba(147,51,234,0.3)" : "transparent",
                    transition: "all 150ms ease"
                  }}
                  onClick={() => setActiveTable(m.tableName)}
                >
                  <Group gap="sm" wrap="nowrap">
                    <IconTable size={16} color={activeTable === m.tableName ? "#a855f7" : "rgba(255,255,255,0.3)"} />
                    <Box style={{ flex: 1 }}>
                      <Text size="sm" fw={600} c={activeTable === m.tableName ? "white" : "gray.5"}>{m.displayName}</Text>
                      <Text size="10px" c="dimmed">{m.fields.length} fields</Text>
                    </Box>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Box>
          
          <Divider my="sm" style={{ opacity: 0.1 }} />
          
          <Button 
            variant="subtle" 
            color="violet" 
            size="xs" 
            leftSection={<IconPlus size={14} />}
            fullWidth
            justify="flex-start"
          >
            Add Relationship
          </Button>
        </Stack>
      </Grid.Col>

      {/* Main Content: Field Editor */}
      <Grid.Col span={9}>
        {selectedModel ? (
          <Stack gap="xl">
            <Box>
               <Group justify="space-between" align="flex-start">
                  <Stack gap={4}>
                    <Title order={4} c="white">{selectedModel.displayName}</Title>
                    <Text size="xs" c="dimmed">Source: <span style={{ fontFamily: "monospace" }}>{selectedModel.tableName}</span></Text>
                  </Stack>
                  <Group>
                    <Button 
                      variant="gradient" 
                      gradient={{ from: 'violet', to: 'indigo' }} 
                      size="xs" 
                      loading={isEnriching}
                      onClick={handleAiEnrich}
                      leftSection={<IconSettings size={14} />}
                    >
                      AI Magic Enrichment
                    </Button>
                    <Button variant="light" color="gray" size="xs">Manual Settings</Button>
                  </Group>
               </Group>
            </Box>

            <ScrollArea h={600} pr="md">
              <Stack gap="md">
                {selectedModel.fields.map((field: any, idx: number) => (
                  <Card key={field.columnName} withBorder style={{ 
                    background: "rgba(255,255,255,0.02)", 
                    borderColor: field.isPrimary ? "rgba(147,51,234,0.4)" : "rgba(255,255,255,0.06)",
                    boxShadow: field.isPrimary ? "0 0 10px rgba(147,51,234,0.1)" : "none"
                  }} radius="md" p="sm">
                    <Grid align="center">
                      <Grid.Col span={4}>
                        <Stack gap={4}>
                           <TextInput 
                            size="xs" 
                            label="Business Name" 
                            defaultValue={field.displayName}
                            onBlur={(e) => handleFieldUpdate(idx, { displayName: e.currentTarget.value })}
                            styles={{ input: { background: "transparent", border: "none", padding: 0, fontWeight: 700, fontSize: rem(14) }, label: { fontSize: rem(10), color: "rgba(255,255,255,0.3)" } }}
                          />
                           <Group gap={4}>
                              <Text size="10px" c="dimmed" ff="monospace">{field.columnName}</Text>
                              {field.isPrimary && <Badge size="9px" variant="filled" color="violet">PK</Badge>}
                           </Group>
                        </Stack>
                      </Grid.Col>
                      
                      <Grid.Col span={2}>
                        <Select
                          size="xs"
                          label="Type"
                          data={[
                            { value: 'dimension', label: 'Dimension' },
                            { value: 'measure', label: 'Measure' },
                          ]}
                          value={field.type}
                          onChange={(val) => handleFieldUpdate(idx, { type: val!, aggregation: val === 'measure' ? 'sum' : undefined })}
                          styles={{ input: { background: "rgba(0,0,0,0.2)", height: rem(32) } }}
                        />
                      </Grid.Col>

                      <Grid.Col span={2}>
                        {field.type === 'measure' && (
                          <Select
                            size="xs"
                            label="Aggregation"
                            data={[
                              { value: 'sum', label: 'Sum' },
                              { value: 'avg', label: 'Average' },
                              { value: 'count', label: 'Count' },
                              { value: 'max', label: 'Max' },
                              { value: 'min', label: 'Min' },
                            ]}
                            value={field.aggregation || 'sum'}
                            onChange={(val) => handleFieldUpdate(idx, { aggregation: val! })}
                            styles={{ input: { background: "rgba(0,0,0,0.2)", height: rem(32) } }}
                          />
                        )}
                      </Grid.Col>

                      <Grid.Col span={3}>
                           <TextInput 
                            size="xs" 
                            label="Calculated Expression" 
                            placeholder="e.g. price * quantity"
                            defaultValue={field.expression}
                            onBlur={(e) => handleFieldUpdate(idx, { expression: e.currentTarget.value })}
                            styles={{ input: { background: "rgba(0,0,0,0.2)", height: rem(32) }, label: { fontSize: rem(10), color: "rgba(255,255,255,0.3)" } }}
                          />
                      </Grid.Col>

                      <Grid.Col span={1} ta="right">
                         <Group gap={4} justify="flex-end">
                            <Tooltip label={field.isPrimary ? "Primary Key" : "Mark as PK"}>
                               <ActionIcon 
                                 variant={field.isPrimary ? "filled" : "subtle"} 
                                 color="violet" 
                                 size="sm"
                                 onClick={() => handleFieldUpdate(idx, { isPrimary: !field.isPrimary })}
                               >
                                 <IconFingerprint size={14} />
                               </ActionIcon>
                            </Tooltip>
                         </Group>
                      </Grid.Col>
                    </Grid>
                  </Card>
                ))}
              </Stack>
            </ScrollArea>
          </Stack>
        ) : (
          <Center h={400}>
            <Text c="dimmed">Select a table to start modeling.</Text>
          </Center>
        )}
      </Grid.Col>
    </Grid>
    )}
    </Stack>
  );
}
