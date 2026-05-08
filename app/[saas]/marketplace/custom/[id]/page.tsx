"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    Box, Container, Title, Text, Grid, Card, Badge,
    Group, Button, Stack, ActionIcon, Tooltip, ScrollArea,
    TextInput, Divider, Code, Alert, Loader, Paper, JsonInput, Center,
    Modal
} from "@mantine/core";
import {
    IconArrowLeft,
    IconSearch,
    IconBolt,
    IconTerminal2,
    IconCopy,
    IconRefresh,
    IconCircleCheck,
    IconAlertCircle,
    IconHistory,
    IconBell,
    IconChevronRight,
    IconTrash,
    IconX,
    IconCheck
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type McpTool = {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
};

type HistoryItem = {
    id: string;
    method: string;
    timestamp: string;
    status: 'pending' | 'success' | 'error';
};

export default function McpInspectorPage() {
    const { saas, id } = useParams();
    const router = useRouter();

    const keyRecord = useQuery(api.integrationKeys.get, { id: id as Id<"integrationKeys"> });
    const removeKey = useMutation(api.integrationKeys.removeKey);

    const [tools, setTools] = useState<McpTool[]>([]);
    const [search, setSearch] = useState("");
    const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
    const [loading, setLoading] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [toolInputs, setToolInputs] = useState<Record<string, any>>({});
    const [toolResult, setToolResult] = useState<any>(null);
    const [calling, setCalling] = useState(false);

    const fetchTools = async () => {
        if (!keyRecord) return;
        setLoading(true);
        addHistoryItem("tools/list");
        try {
            const res = await fetch(`/api/mcp/proxy?integration=${keyRecord.integration}&organizationId=${keyRecord.organizationId}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            setTools(data.result?.tools || []);
            updateHistoryStatus("tools/list", 'success');
        } catch (e: any) {
            notifications.show({ title: "Failed to fetch tools", message: e.message, color: "red" });
            updateHistoryStatus("tools/list", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!keyRecord) return;
        
        setRemoving(true);
        try {
            await removeKey({ 
                organizationId: keyRecord.organizationId, 
                integration: keyRecord.integration 
            });
            notifications.show({ title: "Server Removed", message: "The MCP server has been disconnected.", color: "green" });
            router.push(`/${saas}/marketplace/custom`);
        } catch (e: any) {
            notifications.show({ title: "Failed to remove server", message: e.message, color: "red" });
            setRemoving(false);
            setShowRemoveModal(false);
        }
    };

    useEffect(() => {
        if (keyRecord) fetchTools();
    }, [keyRecord]);

    const addHistoryItem = (method: string) => {
        const newItem: HistoryItem = {
            id: Math.random().toString(36).substr(2, 9),
            method,
            timestamp: new Date().toLocaleTimeString(),
            status: 'pending'
        };
        setHistory(prev => [newItem, ...prev]);
    };

    const updateHistoryStatus = (method: string, status: 'success' | 'error') => {
        setHistory(prev => {
            const index = prev.findIndex(item => item.method === method && item.status === 'pending');
            if (index === -1) return prev;
            const newHistory = [...prev];
            newHistory[index] = { ...newHistory[index], status };
            return newHistory;
        });
    };

    const handleRunTool = async () => {
        if (!selectedTool || !keyRecord) return;
        setCalling(true);
        setToolResult(null);
        const historyMethod = `tools/call (${selectedTool.name})`;
        addHistoryItem(historyMethod);

        try {
            const res = await fetch("/api/mcp/proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    integration: keyRecord.integration,
                    organizationId: keyRecord.organizationId,
                    method: "tools/call",
                    params: {
                        name: selectedTool.name,
                        arguments: toolInputs
                    },
                    id: 1
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            setToolResult(data.result);
            updateHistoryStatus(historyMethod, 'success');
        } catch (e: any) {
            notifications.show({ title: "Tool execution failed", message: e.message, color: "red" });
            updateHistoryStatus(historyMethod, 'error');
            setToolResult({ error: e.message });
        } finally {
            setCalling(false);
        }
    };

    const filteredTools = tools.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

    if (!keyRecord) {
        return (
            <Box p="4rem" style={{ minHeight: "calc(100vh - 56px)", background: "#07050f" }}>
                <Stack align="center" py={100}>
                    <Loader color="violet" />
                    <Text c="dimmed">Loading server details...</Text>
                </Stack>
            </Box>
        );
    }

    const displayName = keyRecord.integration.replace("custom_mcp__", "").replace(/_/g, " ");

    return (
        <Box p="4rem" style={{ minHeight: "calc(100vh - 56px)", background: "#07050f", maxWidth: "1600px" }}>
            <title>Inspector: {displayName}</title>
            <Stack gap="xl">
                {/* Header */}
                <Group justify="space-between">
                    <Group gap="md">
                        <ActionIcon variant="subtle" color="gray" onClick={() => router.back()} size="lg">
                            <IconArrowLeft size={20} />
                        </ActionIcon>
                        <Box>
                            <Group gap="xs">
                                <Title order={2} fw={800} c="white" style={{ textTransform: "capitalize", letterSpacing: "-0.02em" }}>{displayName}</Title>
                                <Badge color="green" variant="light" size="xs" radius="sm">Live</Badge>
                            </Group>
                            <Text size="xs" c="dimmed" style={{ opacity: 0.6 }}>{keyRecord.mcpUrl}</Text>
                        </Box>
                    </Group>
                    <Group>
                        <Button variant="subtle" color="gray" leftSection={<IconRefresh size={14} />} onClick={fetchTools} loading={loading}>
                            Reconnect
                        </Button>
                        <Button variant="light" color="violet" leftSection={<IconRefresh size={14} />} onClick={fetchTools} loading={loading}>
                            Refresh Tools
                        </Button>
                        <Button 
                            variant="light" 
                            color="red" 
                            leftSection={<IconTrash size={14} />} 
                            onClick={() => setShowRemoveModal(true)}
                        >
                            Remove Server
                        </Button>
                    </Group>
                </Group>

                <Grid>
                    {/* Row 1: Tools & Execution */}
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Paper withBorder radius="md" style={{ background: "rgba(19,15,34,0.4)", height: 500, display: "flex", flexDirection: "column", borderColor: "rgba(255,255,255,0.06)" }}>
                            <Box p="md" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                <Group justify="space-between" mb="xs">
                                    <Text fw={700} size="sm" c="white">Tools</Text>
                                    <IconSearch size={14} color="rgba(255,255,255,0.3)" />
                                </Group>
                                <TextInput
                                    placeholder="Search tools..."
                                    size="xs"
                                    value={search}
                                    onChange={(e) => setSearch(e.currentTarget.value)}
                                    styles={{ input: { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)", color: "white" } }}
                                />
                            </Box>
                            <Box p="xs" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                <Stack gap={4}>
                                    <Button fullWidth size="xs" variant="light" color="gray" styles={{ root: { backgroundColor: "rgba(255,255,255,0.03)" } }} onClick={fetchTools}>List Tools</Button>
                                    <Button fullWidth size="xs" variant="subtle" color="gray" onClick={() => { setTools([]); setSelectedTool(null); }}>Clear</Button>
                                </Stack>
                            </Box>
                            <ScrollArea style={{ flex: 1 }}>
                                {loading && tools.length === 0 ? (
                                    <Stack align="center" py="xl">
                                        <Loader size="sm" color="violet" />
                                        <Text size="xs" c="dimmed">Discovering tools...</Text>
                                    </Stack>
                                ) : filteredTools.length === 0 ? (
                                    <Box p="xl" style={{ textAlign: "center" }}>
                                        <Stack gap="xs" align="center">
                                            <IconTerminal2 size={24} color="rgba(255,255,255,0.1)" />
                                            <Text size="xs" c="dimmed">No tools found.</Text>
                                            {keyRecord.mcpUrl && !keyRecord.mcpUrl.includes("/sse") && keyRecord.mcpUrl.includes("localhost") && (
                                                <Alert color="blue" variant="light" p="xs" styles={{ label: { fontSize: 10 }, message: { fontSize: 10 } }}>
                                                    Tip: Local Go servers often use the <b>/sse</b> suffix. 
                                                    Try updating the URL to <code>{keyRecord.mcpUrl}/sse</code>
                                                </Alert>
                                            )}
                                            <Button size="xs" variant="subtle" color="violet" onClick={fetchTools}>Retry Discovery</Button>
                                        </Stack>
                                    </Box>
                                ) : (
                                    filteredTools.map(t => (
                                        <Box
                                            key={t.name}
                                            p="md"
                                            style={{
                                                cursor: "pointer",
                                                borderBottom: "1px solid rgba(255,255,255,0.03)",
                                                backgroundColor: selectedTool?.name === t.name ? "rgba(147,51,234,0.1)" : "transparent",
                                                transition: "background 0.2s ease"
                                            }}
                                            onClick={() => {
                                                setSelectedTool(t);
                                                const initialInputs: Record<string, any> = {};
                                                if (t.inputSchema?.properties) {
                                                    Object.keys(t.inputSchema.properties).forEach(key => {
                                                        initialInputs[key] = "";
                                                    });
                                                }
                                                setToolInputs(initialInputs);
                                                setToolResult(null);
                                            }}
                                        >
                                            <Group justify="space-between" wrap="nowrap">
                                                <Box>
                                                    <Text size="sm" fw={700} c={selectedTool?.name === t.name ? "violet.4" : "white"}>{t.name}</Text>
                                                    <Text size="xs" c="dimmed" lineClamp={1}>{t.description}</Text>
                                                </Box>
                                                <IconChevronRight size={14} color="rgba(255,255,255,0.2)" />
                                            </Group>
                                        </Box>
                                    ))
                                )}
                            </ScrollArea>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Paper withBorder radius="md" style={{ background: "rgba(19,15,34,0.4)", height: 500, overflow: "hidden", display: "flex", flexDirection: "column", borderColor: "rgba(255,255,255,0.06)" }}>
                            {!selectedTool ? (
                                <Center style={{ flex: 1 }}>
                                    <Stack align="center" gap="xs">
                                        <Box style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(147,51,234,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(147,51,234,0.2)" }}>
                                            <IconTerminal2 size={30} color="rgba(147,51,234,0.3)" />
                                        </Box>
                                        <Text c="dimmed" size="sm" fw={500}>Select a tool to inspect and execute</Text>
                                    </Stack>
                                </Center>
                            ) : (
                                <ScrollArea style={{ flex: 1 }} p="md">
                                    <Stack gap="xl">
                                        <Box>
                                            <Group justify="space-between">
                                                <Title order={3} c="white" fw={800}>{selectedTool.name}</Title>
                                                <Group gap="xs">
                                                    <Badge size="xs" variant="outline" color="gray" leftSection={<IconX size={10} />}>Read-only</Badge>
                                                    <Badge size="xs" variant="outline" color="green" leftSection={<IconCheck size={10} />}>Destructive</Badge>
                                                    <Badge size="xs" variant="outline" color="gray" leftSection={<IconX size={10} />}>Idempotent</Badge>
                                                    <Badge size="xs" variant="outline" color="green" leftSection={<IconCheck size={10} />}>Open-world</Badge>
                                                </Group>
                                            </Group>
                                            <Text size="sm" c="dimmed" mt={4} style={{ maxWidth: 600 }}>{selectedTool.description}</Text>
                                        </Box>

                                        <Box>
                                            <Group justify="space-between" mb="xs">
                                                <Text fw={700} size="sm" c="white">Tool-specific Metadata:</Text>
                                                <Button size="compact-xs" variant="subtle" color="violet" styles={{ root: { fontSize: 10 } }}>Add Pair</Button>
                                            </Group>
                                            <Text size="xs" c="dimmed">No metadata pairs.</Text>
                                        </Box>

                                        <Stack gap="sm">
                                            <Group>
                                                <Button
                                                    leftSection={<IconBolt size={14} />}
                                                    color="violet"
                                                    onClick={handleRunTool}
                                                    loading={calling}
                                                    radius="md"
                                                >
                                                    Run Tool
                                                </Button>
                                                <Button
                                                    variant="subtle"
                                                    color="gray"
                                                    leftSection={<IconCopy size={14} />}
                                                    radius="md"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(JSON.stringify(toolInputs));
                                                        notifications.show({ message: "Arguments copied to clipboard", color: 'violet' });
                                                    }}
                                                >
                                                    Copy Input
                                                </Button>
                                            </Group>

                                            <Box>
                                                <Text fw={700} size="sm" c="white" mb="xs">Arguments (JSON):</Text>
                                                <JsonInput
                                                    placeholder="e.g. { 'id': '123' }"
                                                    validationError="Invalid JSON"
                                                    formatOnBlur
                                                    autosize
                                                    minRows={4}
                                                    value={JSON.stringify(toolInputs, null, 2)}
                                                    onChange={(val) => {
                                                        try {
                                                            if (val) setToolInputs(JSON.parse(val));
                                                        } catch { }
                                                    }}
                                                    styles={{ input: { background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.06)", color: "white", fontSize: 12, fontFamily: "monospace" } }}
                                                />
                                            </Box>
                                        </Stack>

                                        {toolResult && (
                                            <Box>
                                                <Group gap="xs" mb="xs">
                                                    <Text fw={700} size="sm" c="white">Tool Result:</Text>
                                                    <Text fw={700} size="sm" c={toolResult.error ? "red.5" : "green.5"}>{toolResult.error ? "Error" : "Success"}</Text>
                                                </Group>
                                                <Stack gap="md">
                                                    <Paper withBorder p="md" radius="md" style={{ background: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.06)", position: "relative" }}>
                                                        <Group justify="space-between" mb="xs">
                                                            <Text size="xs" fw={700} c="dimmed">Structured Content:</Text>
                                                            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => {
                                                                navigator.clipboard.writeText(JSON.stringify(toolResult, null, 2));
                                                                notifications.show({ message: "Result copied" });
                                                            }}>
                                                                <IconCopy size={14} />
                                                            </ActionIcon>
                                                        </Group>
                                                        <Code block styles={{ root: { background: "transparent", color: "#a855f7", fontSize: 11 } }}>
                                                            {JSON.stringify(toolResult, null, 2)}
                                                        </Code>
                                                    </Paper>

                                                    <Box>
                                                        <Text size="xs" fw={700} c="dimmed" mb={4}>Unstructured Content:</Text>
                                                        <Paper withBorder p="xs" radius="sm" style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.04)" }}>
                                                            <Text size="xs" c="dimmed">No unstructured content returned.</Text>
                                                        </Paper>
                                                    </Box>
                                                </Stack>
                                            </Box>
                                        )}
                                    </Stack>
                                </ScrollArea>
                            )}
                        </Paper>
                    </Grid.Col>

                    {/* Row 2: History & Notifications */}
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Paper withBorder radius="md" style={{ background: "rgba(19,15,34,0.4)", height: 300, display: "flex", flexDirection: "column", borderColor: "rgba(255,255,255,0.06)" }}>
                            <Box p="md" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                <Group justify="space-between">
                                    <Group gap="xs">
                                        <IconHistory size={16} color="rgba(255,255,255,0.4)" />
                                        <Text fw={700} size="sm" c="white">History</Text>
                                    </Group>
                                    <Button size="compact-xs" variant="subtle" color="gray" styles={{ root: { fontSize: 10 } }} onClick={() => setHistory([])}>Clear</Button>
                                </Group>
                            </Box>
                            <ScrollArea style={{ flex: 1 }} p="md">
                                <Stack gap={6}>
                                    {history.length === 0 ? (
                                        <Center py="xl">
                                            <Text size="xs" c="dimmed">No history yet</Text>
                                        </Center>
                                    ) : (
                                        history.map(item => (
                                            <Box key={item.id} p="xs" style={{ background: "rgba(255,255,255,0.03)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.04)" }}>
                                                <Group justify="space-between">
                                                    <Group gap="xs">
                                                        {item.status === 'pending' ? <Loader size={10} color="violet" /> : <IconBolt size={10} color={item.status === 'success' ? '#22c55e' : '#ef4444'} />}
                                                        <Text size="xs" fw={700} c={item.status === 'error' ? 'red.4' : 'white'}>{item.method}</Text>
                                                    </Group>
                                                    <Group gap={6}>
                                                        <Text size="10px" c="dimmed" style={{ opacity: 0.5 }}>{item.timestamp}</Text>
                                                        <IconChevronRight size={10} color="rgba(255,255,255,0.2)" />
                                                    </Group>
                                                </Group>
                                            </Box>
                                        ))
                                    )}
                                </Stack>
                            </ScrollArea>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Paper withBorder radius="md" style={{ background: "rgba(19,15,34,0.4)", height: 300, display: "flex", flexDirection: "column", borderColor: "rgba(255,255,255,0.06)" }}>
                            <Box p="md" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                <Group justify="space-between">
                                    <Group gap="xs">
                                        <IconBell size={16} color="rgba(255,255,255,0.4)" />
                                        <Text fw={700} size="sm" c="white">Server Notifications</Text>
                                    </Group>
                                    <Button size="compact-xs" variant="subtle" color="gray" styles={{ root: { fontSize: 10 } }}>Clear</Button>
                                </Group>
                            </Box>
                            <Center style={{ flex: 1 }}>
                                <Stack align="center" gap={4}>
                                    <IconBell size={30} color="rgba(255,255,255,0.05)" />
                                    <Text size="xs" c="dimmed">No notifications yet</Text>
                                </Stack>
                            </Center>
                        </Paper>
                    </Grid.Col>
                </Grid>

            <Modal
                opened={showRemoveModal}
                onClose={() => !removing && setShowRemoveModal(false)}
                title="Remove MCP Server"
                centered
                size="sm"
                overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
                styles={{
                    content: { background: "#130f22", border: "1px solid rgba(147,51,234,0.2)", borderRadius: 12 },
                    header: { background: "#130f22", color: "white" },
                    title: { fontWeight: 600 }
                }}
            >
                <Stack gap="md">
                    <Text size="sm" c="rgba(255,255,255,0.7)">
                        Are you sure you want to disconnect <b>{displayName}</b>? This will remove the server and all its tools from your organization.
                    </Text>
                    <Group justify="flex-end" gap="sm">
                        <Button variant="subtle" color="gray" onClick={() => setShowRemoveModal(false)} size="xs" disabled={removing}>
                            Cancel
                        </Button>
                        <Button color="red" onClick={handleRemove} size="xs" loading={removing}>
                            Remove
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Stack>
    </Box>
);
}
