"use client";

import React, { useState, useEffect } from "react";
import {
  Drawer,
  Stack,
  Text,
  Group,
  TextInput,
  Button,
  Box,
  ScrollArea,
  ActionIcon,
  Badge,
  Loader,
  Paper,
  Divider,
  Avatar,
  Center,
  Tooltip,
  Menu,
  MultiSelect,
  Checkbox,
  Select
} from "@mantine/core";
import { useQuery, useMutation } from "convex/react";
import { useMutation as useRqMutation } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
import { MODEL_OPTIONS } from "@/lib/model-options";
import {
  IconSparkles,
  IconSend,
  IconRobot,
  IconChartBar,
  IconChartLine,
  IconChartPie,
  IconNumbers,
  IconCheck,
  IconX,
  IconDotsVertical,
  IconArrowRight,
  IconDeviceFloppy,
  IconPlus,
  IconChevronDown,
  IconTable,
  IconHash
} from "@tabler/icons-react";

interface AskAIPanelProps {
  opened: boolean;
  onClose: (createdDashboardId?: string) => void;
  organizationId: any;
  saas: string;
}

interface ProposedWidget {
  id: string;
  type: "bar" | "line" | "pie" | "kpi" | "area" | "table" | "counter";
  title: string;
  reason: string;
  sql: string;
  mapping?: {
    labelKey: string;
    valueKeys: string[];
  };
}


export function AskAIPanel({ opened, onClose, organizationId, saas }: AskAIPanelProps) {
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [draftPrompts, setDraftPrompts] = useState<{ text: string; type: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [proposedWidgets, setProposedWidgets] = useState<ProposedWidget[]>([]);
  const [currentStep, setCurrentStep] = useState<"idle" | "analyzing" | "designing" | "ready">("idle");
  const [proposalId, setProposalId] = useState<string | null>(null);

  // Selection States
  const allConfigs = useQuery(api.databaseConfigs.listByOrganization, { organizationId }) || [];
  const [selectedConfigIds, setSelectedConfigIds] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("gemini:gemini-1.5-flash");

  // Convex mutations
  const createDashboard = useMutation(api.bi.createDashboardWithWidgets);
  const proposal = useQuery(api.bi.getProposal, proposalId ? { proposalId: proposalId as any } : "skip");

  // Initialize selection if not set
  useEffect(() => {
    if (allConfigs.length > 0 && selectedConfigIds.length === 0) {
      setSelectedConfigIds([allConfigs[0]._id]);
    }
  }, [allConfigs]);

  // Reactive Subscription for Asynchronous Generator Completed State
  useEffect(() => {
    if (!proposal) return;
    if (proposal.status === "ready") {
      setProposedWidgets((proposal.widgets || []).map((w: any, i: number) => ({
        id: String(i),
        type: w.type as any,
        title: w.title,
        reason: w.reason || "AI-generated widget",
        sql: w.sql,
        mapping: w.mapping
      })));
      setCurrentStep("ready");
      setIsGenerating(false);
      setProposalId(null);
    } else if (proposal.status === "failed") {
      console.error("[DashboardGen] Background proposal failed:", proposal.error);
      setIsGenerating(false);
      setCurrentStep("idle");
      setProposalId(null);
      alert(proposal.error || "Generation failed. Please try a different query or settings.");
    }
  }, [proposal]);

  const handleAddPrompt = () => {
    if (!currentPrompt.trim() || draftPrompts.length >= 5) return;
    setDraftPrompts([...draftPrompts, { text: currentPrompt.trim(), type: "bar" }]);
    setCurrentPrompt("");
  };

  const handleRemovePrompt = (index: number) => {
    setDraftPrompts(draftPrompts.filter((_, i) => i !== index));
  };

  const generateDashboardMutation = useRqMutation({
    mutationFn: async (payload: {
      draftPrompts: { text: string; type: string }[];
      selectedConfigIds: string[];
      selectedModel: string;
      organizationId: any;
    }) => {
      const response = await fetch("/api/bi/generate-dashboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to generate dashboard");
      }
      return result;
    },
    onSuccess: (result) => {
      if (result.mode === "async") {
        setCurrentStep("designing");
        setProposalId(result.proposalId);
      } else {
        setProposedWidgets((result.widgets || []).map((w: any, i: number) => ({
          id: String(i),
          type: w.type as any,
          title: w.title,
          reason: w.reason || "AI-generated widget",
          sql: w.sql,
          mapping: w.mapping,
        })));
        setCurrentStep("ready");
        setIsGenerating(false);
      }
    },
    onError: (err: any) => {
      console.error("[DashboardGen] Error generating dashboard:", err);
      setIsGenerating(false);
      setCurrentStep("idle");
      alert(err.message || "Failed to generate dashboard. Please try again.");
    },
  });

  const handleGenerate = async () => {
    if (draftPrompts.length === 0 && !currentPrompt.trim()) return;

    const finalPrompts = currentPrompt.trim()
      ? [...draftPrompts, { text: currentPrompt.trim(), type: "bar" }].slice(0, 5)
      : draftPrompts;

    setIsGenerating(true);
    setCurrentStep("analyzing");

    generateDashboardMutation.mutate({
      draftPrompts: finalPrompts,
      selectedConfigIds,
      selectedModel,
      organizationId,
    });
  };

  const handleDeploy = async () => {
    if (proposedWidgets.length === 0) return;
    setIsSaving(true);

    try {
      const name = prompt("Enter dashboard name:", "AI Generated Dashboard") || "AI Generated Dashboard";

      const widgetsToSave = proposedWidgets.map((w, index) => {
        const x = (index % 2) * 6;
        const y = Math.floor(index / 2) * 4;
        const wVal = index === 4 ? 12 : 6;
        const hVal = 4;
        const sizeVal: "small" | "medium" | "large" | "full" = index === 4 ? "full" : "medium";

        return {
          type: w.type as any,
          title: w.title,
          description: w.reason,
          sql: w.sql,
          mapping: w.mapping ? {
            labelKey: w.mapping.labelKey,
            valueKeys: w.mapping.valueKeys,
          } : {
            labelKey: "category",
            valueKeys: ["value"],
          },
          layout: { x, y, w: wVal, h: hVal },
          order: index,
          size: sizeVal,
        };
      });

      const dashboardId = await createDashboard({
        organizationId,
        configId: selectedConfigIds[0] as any,
        name,
        description: "AI-Generated multi-insight dashboard",
        widgets: widgetsToSave,
      });

      setProposedWidgets([]);
      setDraftPrompts([]);
      setCurrentStep("idle");
      onClose(dashboardId);
    } catch (err: any) {
      console.error("[DashboardGen] Failed to save dashboard:", err);
      alert(err.message || "Failed to deploy dashboard. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "bar": return <IconChartBar size={18} color="#a855f7" />;
      case "line": return <IconChartLine size={18} color="#0ea5e9" />;
      case "pie": return <IconChartPie size={18} color="#ec4899" />;
      case "kpi": return <IconNumbers size={18} color="#f59e0b" />;
      case "table": return <IconTable size={18} color="#10b981" />;
      case "counter": return <IconHash size={18} color="#6366f1" />;
      default: return <IconChartBar size={18} />;
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="600px"
      title={
        <Group gap="sm">
          <Box
            style={{
              background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)",
              borderRadius: "8px",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(147, 51, 234, 0.4)"
            }}
          >
            <IconSparkles size={20} color="white" />
          </Box>
          <Box>
            <Text fw={800} size="lg" c="white" style={{ letterSpacing: "-0.5px" }}>Orcha Genie</Text>
            <Badge variant="dot" color="violet" size="xs">Multi-Insight Architect</Badge>
          </Box>
        </Group>
      }
      padding="xl"
      styles={{
        content: {
          background: "#07050f",
          borderLeft: "1px solid rgba(147, 51, 234, 0.15)",
          display: "flex",
          flexDirection: "column"
        },
        header: {
          background: "#07050f",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          paddingBottom: 20
        },
        body: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden"
        }
      }}
    >
      <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ScrollArea style={{ flex: 1 }} p="xl">
          <Stack gap="xl">
            {currentStep === "idle" && (
              <Stack gap="xl">
                <Box py={20} ta="center">
                  <Avatar
                    size={64}
                    radius="xl"
                    mx="auto"
                    mb="md"
                    styles={{ root: { background: "rgba(147, 51, 234, 0.1)", border: "2px solid rgba(147, 51, 234, 0.2)" } }}
                  >
                    <IconRobot size={32} color="#a855f7" />
                  </Avatar>
                  <Text fw={700} size="lg" c="white">Insight Architect</Text>
                  <Text size="xs" c="dimmed">Draft up to 5 widgets. I&apos;ll build the full dashboard.</Text>
                </Box>

                {draftPrompts.length > 0 && (
                  <Stack gap="xs">
                    <Text size="xs" fw={800} c="dimmed" style={{ letterSpacing: "1px" }}>DRAFT INSIGHTS ({draftPrompts.length}/5)</Text>
                    {draftPrompts.map((p, i) => (
                      <Paper
                        key={i}
                        p="xs"
                        radius="md"
                        style={{ background: "rgba(147, 51, 234, 0.05)", border: "1px solid rgba(147, 51, 234, 0.2)" }}
                      >
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                            <Badge color="violet" variant="filled" size="xs">{i + 1}</Badge>
                            <Text size="xs" c="white" lineClamp={1} style={{ flex: 1 }}>{p.text}</Text>
                          </Group>
                          <Group gap={4}>
                            <Menu position="bottom-end" shadow="md" width={140}>
                              <Menu.Target>
                                <Button 
                                  variant="subtle" 
                                  size="compact-xs" 
                                  color="gray"
                                  leftSection={getIconForType(p.type || "bar")}
                                  styles={{ section: { marginRight: 4 } }}
                                >
                                  {(p.type || "bar").charAt(0).toUpperCase() + (p.type || "bar").slice(1)}
                                </Button>
                              </Menu.Target>
                              <Menu.Dropdown bg="#0c0a1a" style={{ border: "1px solid rgba(147, 51, 234, 0.2)" }}>
                                <Menu.Label>Insight Type</Menu.Label>
                                <Menu.Item 
                                  leftSection={<IconChartBar size={14} color="#a855f7" />}
                                  onClick={() => {
                                    const newDrafts = [...draftPrompts];
                                    newDrafts[i].type = "bar";
                                    setDraftPrompts(newDrafts);
                                  }}
                                  c="white"
                                >
                                  Bar Chart
                                </Menu.Item>
                                <Menu.Item 
                                  leftSection={<IconChartLine size={14} color="#0ea5e9" />}
                                  onClick={() => {
                                    const newDrafts = [...draftPrompts];
                                    newDrafts[i].type = "line";
                                    setDraftPrompts(newDrafts);
                                  }}
                                  c="white"
                                >
                                  Line Chart
                                </Menu.Item>
                                <Menu.Item 
                                  leftSection={<IconChartPie size={14} color="#ec4899" />}
                                  onClick={() => {
                                    const newDrafts = [...draftPrompts];
                                    newDrafts[i].type = "pie";
                                    setDraftPrompts(newDrafts);
                                  }}
                                  c="white"
                                >
                                  Pie Chart
                                </Menu.Item>
                                <Menu.Item 
                                  leftSection={<IconNumbers size={14} color="#f59e0b" />}
                                  onClick={() => {
                                    const newDrafts = [...draftPrompts];
                                    newDrafts[i].type = "kpi";
                                    setDraftPrompts(newDrafts);
                                  }}
                                  c="white"
                                >
                                  KPI Metric
                                </Menu.Item>
                                <Menu.Item 
                                  leftSection={<IconTable size={14} color="#10b981" />}
                                  onClick={() => {
                                    const newDrafts = [...draftPrompts];
                                    newDrafts[i].type = "table";
                                    setDraftPrompts(newDrafts);
                                  }}
                                  c="white"
                                >
                                  Data Table
                                </Menu.Item>
                                <Menu.Item 
                                  leftSection={<IconHash size={14} color="#6366f1" />}
                                  onClick={() => {
                                    const newDrafts = [...draftPrompts];
                                    newDrafts[i].type = "counter";
                                    setDraftPrompts(newDrafts);
                                  }}
                                  c="white"
                                >
                                  Smart Counter
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                            <ActionIcon variant="subtle" color="gray" size="xs" onClick={() => handleRemovePrompt(i)}>
                              <IconX size={12} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}

            {(currentStep === "analyzing" || currentStep === "designing") && (
              <Stack align="center" py={50} gap="md">
                <Loader color="violet" size="lg" type="bars" />
                <Text fw={600} c="violet.3">
                  {currentStep === "analyzing" ? "Sit back and relax..." : "Architecting Dashboard..."}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  Processing {draftPrompts.length} requested insights...
                </Text>
              </Stack>
            )}

            {currentStep === "ready" && (
              <Stack gap="lg">
                <Group justify="space-between" align="center">
                  <Text size="xs" fw={800} c="dimmed" style={{ letterSpacing: "1px" }}>AI ARCHITECT PROPOSAL</Text>
                  <Badge color="green" variant="light">{proposedWidgets.length} Widgets Ready</Badge>
                </Group>

                {proposedWidgets.map((widget, index) => (
                  <Paper
                    key={widget.id}
                    p="md"
                    radius="md"
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      position: "relative",
                      overflow: "hidden"
                    }}
                  >
                    <Box
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "4px",
                        height: "100%",
                        background: widget.type === "line" ? "#0ea5e9" : widget.type === "bar" ? "#a855f7" : widget.type === "pie" ? "#ec4899" : widget.type === "kpi" ? "#f59e0b" : widget.type === "table" ? "#10b981" : "#6366f1"
                      }}
                    />
                    <Group justify="space-between" mb="xs" wrap="nowrap">
                      <Group gap="xs">
                        {getIconForType(widget.type)}
                        <Text fw={700} size="sm" c="white">{widget.title}</Text>
                      </Group>
                    </Group>
                    <Text size="xs" c="dimmed" mb="md" style={{ lineHeight: 1.4 }}>
                      {widget.reason}
                    </Text>
                  </Paper>
                ))}

                <Button
                  fullWidth
                  size="md"
                  color="violet"
                  mt="xl"
                  leftSection={<IconCheck size={18} />}
                  onClick={handleDeploy}
                  loading={isSaving}
                  disabled={isSaving}
                  style={{ background: "linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)" }}
                >
                  Confirm & Deploy Dashboard
                </Button>
                <Button variant="subtle" color="gray" fullWidth size="sm" onClick={() => {
                  setProposedWidgets([]);
                  setDraftPrompts([]);
                  setCurrentStep("idle");
                }}>
                  Discard & Restart
                </Button>
              </Stack>
            )}
          </Stack>
        </ScrollArea>

        {/* Input Area */}
        <Box
          p="xl"
          style={{
            background: "rgba(13, 10, 26, 0.8)",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            backdropFilter: "blur(10px)"
          }}
        >
          <Stack gap="md">
            <TextInput
              placeholder={draftPrompts.length >= 5 ? "Limit reached (5/5)" : "Describe an insight (e.g. Sales by Region)"}
              size="md"
              value={currentPrompt}
              onChange={(e) => setCurrentPrompt(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    handleGenerate();
                  } else {
                    e.preventDefault();
                    handleAddPrompt();
                  }
                }
              }}
              disabled={isGenerating || draftPrompts.length >= 5}
              styles={{
                input: {
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(147, 51, 234, 0.2)",
                  color: "white",
                  borderRadius: "12px",
                  paddingRight: "90px"
                }
              }}
              rightSection={
                <Group gap={6} mr={5}>
                  <Tooltip label="Add Insight Draft">
                    <ActionIcon
                      color="gray"
                      variant="subtle"
                      radius="md"
                      onClick={handleAddPrompt}
                      disabled={!currentPrompt.trim() || draftPrompts.length >= 5}
                    >
                      <IconPlus size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Generate Dashboard">
                    <ActionIcon
                      color="violet"
                      variant="filled"
                      radius="md"
                      size="lg"
                      onClick={handleGenerate}
                      loading={isGenerating}
                      disabled={draftPrompts.length === 0 && !currentPrompt.trim()}
                    >
                      <IconDeviceFloppy size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              }
              rightSectionWidth={90}
            />

            <Group justify="space-between" align="center">
              <Group gap="sm">
                <MultiSelect
                  data={allConfigs?.map(c => ({ value: c._id, label: c.name })) || []}
                  value={selectedConfigIds}
                  onChange={setSelectedConfigIds}
                  placeholder="Databases"
                  variant="unstyled"
                  size="xs"
                  w={180}
                  hidePickedOptions={false}
                  comboboxProps={{ position: 'top-start', width: 280, shadow: 'xl' }}
                  rightSection={<IconChevronDown size={10} color="rgba(255,255,255,0.4)" />}
                  renderOption={({ option }) => {
                    const config = allConfigs?.find(c => c._id === option.value);
                    const isSelected = selectedConfigIds.includes(option.value);
                    return (
                      <Group gap="sm" wrap="nowrap">
                        <Checkbox checked={isSelected} readOnly size="xs" color="violet" />
                        <Stack gap={2}>
                          <Text size="xs" fw={700} c="white">{option.label}</Text>
                          <Text size="10px" c="dimmed">{config?.type?.toUpperCase()}</Text>
                        </Stack>
                      </Group>
                    );
                  }}
                  styles={{
                    input: { color: "rgba(255,255,255,0.6)", fontSize: "11px", minHeight: "unset" },
                    dropdown: { background: "#0c0a1a", borderColor: "rgba(147, 51, 234, 0.2)" },
                    option: { fontSize: "11px", color: "white" }
                  }}
                />

                <Select
                  data={MODEL_OPTIONS}
                  value={selectedModel}
                  onChange={(val) => val && setSelectedModel(val)}
                  variant="unstyled"
                  size="xs"
                  w={160}
                  comboboxProps={{ position: 'top', width: 200, shadow: 'xl' }}
                  leftSection={<IconSparkles size={12} color="#a855f7" />}
                  rightSection={<IconChevronDown size={10} color="rgba(255,255,255,0.4)" />}
                  styles={{
                    input: { color: "rgba(255,255,255,0.6)", fontSize: "11px" },
                    dropdown: { background: "#0c0a1a", borderColor: "rgba(147, 51, 234, 0.2)" },
                    groupLabel: { color: "#a855f7", fontWeight: 700, fontSize: "9px" },
                    option: { fontSize: "11px", color: "white" }
                  }}
                />
              </Group>

              <Group gap={4}>
                <IconSparkles size={10} color="#a855f7" />
                <Text size="10px" c="dimmed">{draftPrompts.length}/5 Insights</Text>
              </Group>
            </Group>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
}
