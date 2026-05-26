"use client";

import React, { useState, useEffect } from "react";
import { Drawer, Stack, Group, Text, Box, Badge, ScrollArea } from "@mantine/core";
import { useQuery, useMutation } from "convex/react";
import { useMutation as useRqMutation } from "@tanstack/react-query";
import { api } from "@/convex/_generated/api";
import { IconSparkles } from "@tabler/icons-react";

import { ProposedWidget, DraftPrompt } from "./AskAIPanel/types";
import { DraftsSection } from "./AskAIPanel/DraftsSection";
import { LoadingSection } from "./AskAIPanel/LoadingSection";
import { ProposalSection } from "./AskAIPanel/ProposalSection";
import { PromptInputArea } from "./AskAIPanel/PromptInputArea";

interface AskAIPanelProps {
  opened: boolean;
  onClose: (createdDashboardId?: string) => void;
  organizationId: any;
  saas: string;
}

export function AskAIPanel({ opened, onClose, organizationId, saas }: AskAIPanelProps) {
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [draftPrompts, setDraftPrompts] = useState<DraftPrompt[]>([]);
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
      setProposedWidgets(
        (proposal.widgets || []).map((w: any, i: number) => {
          const draft = draftPrompts[i];
          return {
            id: String(i),
            type: w.type as any,
            title: w.title,
            reason: w.reason || "AI-generated widget",
            sql: w.sql,
            mapping: {
              ...w.mapping,
              formatType: draft?.formatType || (w.type === "counter" ? "raw" : undefined),
              formatValue: draft?.formatValue || undefined,
              numberFormat: draft?.numberFormat || (w.type === "counter" ? "compact" : undefined),
            },
          };
        })
      );
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
    if (!currentPrompt.trim() || draftPrompts.length >= 10) return;
    setDraftPrompts([...draftPrompts, { text: currentPrompt.trim(), type: "bar" }]);
    setCurrentPrompt("");
  };

  const handleRemovePrompt = (index: number) => {
    setDraftPrompts(draftPrompts.filter((_, i) => i !== index));
  };

  const handleUpdateDraftPrompt = (index: number, updatedDraft: DraftPrompt) => {
    const newDrafts = [...draftPrompts];
    newDrafts[index] = updatedDraft;
    setDraftPrompts(newDrafts);
  };

  const handleUpdateProposedWidget = (index: number, updatedWidget: ProposedWidget) => {
    const newWidgets = [...proposedWidgets];
    newWidgets[index] = updatedWidget;
    setProposedWidgets(newWidgets);
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
        setProposedWidgets(
          (result.widgets || []).map((w: any, i: number) => {
            const draft = draftPrompts[i];
            return {
              id: String(i),
              type: w.type as any,
              title: w.title,
              reason: w.reason || "AI-generated widget",
              sql: w.sql,
              mapping: {
                ...w.mapping,
                formatType: draft?.formatType || (w.type === "counter" ? "raw" : undefined),
                formatValue: draft?.formatValue || undefined,
                numberFormat: draft?.numberFormat || (w.type === "counter" ? "compact" : undefined),
              },
            };
          })
        );
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
      ? [...draftPrompts, { text: currentPrompt.trim(), type: "bar" }].slice(0, 10)
      : draftPrompts;

    setIsGenerating(true);
    setCurrentStep("analyzing");

    generateDashboardMutation.mutate({
      draftPrompts: finalPrompts.map((p) => ({ text: p.text, type: p.type })),
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
          mapping: w.mapping
            ? {
                labelKey: w.mapping.labelKey,
                valueKeys: w.mapping.valueKeys,
                formatType: w.mapping.formatType || (w.type === "kpi" || w.type === "counter" ? "raw" : undefined),
                formatValue: w.mapping.formatValue || undefined,
                numberFormat: w.mapping.numberFormat || (w.type === "kpi" || w.type === "counter" ? "compact" : undefined),
              }
            : {
                labelKey: "category",
                valueKeys: ["value"],
                formatType: w.type === "kpi" || w.type === "counter" ? "raw" : undefined,
                numberFormat: w.type === "kpi" || w.type === "counter" ? "compact" : undefined,
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
              boxShadow: "0 0 15px rgba(147, 51, 234, 0.4)",
            }}
          >
            <IconSparkles size={20} color="white" />
          </Box>
          <Box>
            <Text fw={800} size="lg" c="white" style={{ letterSpacing: "-0.5px" }}>
              Orcha Genie
            </Text>
            <Badge variant="dot" color="violet" size="xs">
              Multi-Insight Architect
            </Badge>
          </Box>
        </Group>
      }
      padding="xl"
      styles={{
        content: {
          background: "#07050f",
          borderLeft: "1px solid rgba(147, 51, 234, 0.15)",
          display: "flex",
          flexDirection: "column",
        },
        header: {
          background: "#07050f",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          paddingBottom: 20,
        },
        body: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden",
        },
      }}
    >
      <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ScrollArea style={{ flex: 1 }} p="xl">
          <Stack gap="xl">
            {currentStep === "idle" && (
              <DraftsSection
                draftPrompts={draftPrompts}
                onRemoveDraftPrompt={handleRemovePrompt}
                onChangeDraftPrompt={handleUpdateDraftPrompt}
              />
            )}

            {(currentStep === "analyzing" || currentStep === "designing") && (
              <LoadingSection currentStep={currentStep} draftPromptsCount={draftPrompts.length} />
            )}

            {currentStep === "ready" && (
              <ProposalSection
                proposedWidgets={proposedWidgets}
                onChangeProposedWidget={handleUpdateProposedWidget}
                onDeploy={handleDeploy}
                isSaving={isSaving}
                onDiscard={() => {
                  setProposedWidgets([]);
                  setDraftPrompts([]);
                  setCurrentStep("idle");
                }}
              />
            )}
          </Stack>
        </ScrollArea>

        {/* Input Area */}
        <PromptInputArea
          currentPrompt={currentPrompt}
          onChangeCurrentPrompt={setCurrentPrompt}
          draftPromptsCount={draftPrompts.length}
          isGenerating={isGenerating}
          onAddPrompt={handleAddPrompt}
          onGenerate={handleGenerate}
          allConfigs={allConfigs}
          selectedConfigIds={selectedConfigIds}
          onChangeSelectedConfigIds={setSelectedConfigIds}
          selectedModel={selectedModel}
          onChangeSelectedModel={setSelectedModel}
        />
      </Box>
    </Drawer>
  );
}
