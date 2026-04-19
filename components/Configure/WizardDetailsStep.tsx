import { 
  Stack, 
  Group, 
  Text, 
  TextInput, 
  Textarea, 
  Avatar, 
  ActionIcon, 
  Badge, 
  Box, 
  rem,
  MultiSelect,
  Grid,
  Divider
} from "@mantine/core";
import { IconCameraPlus, IconTags, IconPencil, IconPhoto, IconBrain, IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { inputStyles, selectStyles } from "@/lib/styles";
import { useCreationWizard } from "@/lib/store/useCreationWizard";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { SegmentedControl, Alert } from "@mantine/core";

export function WizardDetailsStep() {
  const { saas } = useParams();
  const { data, updateData } = useCreationWizard();
  const { isAuthenticated } = useConvexAuth();

  // 1. Resolve organization to check for keys
  const activeOrg = useQuery(api.organizations.getSafeBySlug, { slug: saas as string });
  const aiKeys = useQuery(api.aiKeys.listByOrganization, (isAuthenticated && activeOrg?._id) ? { organizationId: activeOrg._id } : "skip");

  // 2. Validation: Check if the selected memory provider has a key
  const hasKey = data.memoryProvider === "local" || (aiKeys?.some(k => k.provider === data.memoryProvider));
  const isLoading = !aiKeys && isAuthenticated;

  return (
    <Stack gap={40} py="xl">
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
           <Stack align="center" gap="md">
              <Text size="sm" fw={700} c="dimmed" style={{ textTransform: "uppercase" }}>Identity Profile</Text>
              <Box>
                 <Avatar 
                    src={`https://api.dicebear.com/7.x/identicon/svg?seed=${data.name || 'orcha'}&backgroundColor=13102a`} 
                    size={rem(180)} 
                    radius="md" 
                    variant="light" 
                    color="violet"
                    style={{ border: "2px solid rgba(147,51,234,0.3)", background: "rgba(147,51,234,0.05)" }}
                  />
              </Box>
              <Text size="xs" c="dimmed" ta="center" px="xl">An automatic environment identifier has been generated based on your name.</Text>
           </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8 }}>
           <Stack gap="xl">
              <TextInput 
                label="Connection Display Name" 
                placeholder="e.g. Production Analytics Lake" 
                styles={inputStyles}
                value={data.name}
                onChange={(e) => updateData({ name: e.target.value })}
                leftSection={<IconPencil size={14} />}
              />

              <Textarea 
                label="Deployment Description" 
                placeholder="Briefly describe the purpose of this connection..." 
                styles={inputStyles}
                minRows={3}
                value={data.description}
                onChange={(e) => updateData({ description: e.target.value })}
              />

              <Textarea 
                label="Business Context (Domain Knowledge)" 
                placeholder="Describe your business domain (e.g. 'Scale model shop with customers and orders'). This helps the AI understand your data." 
                styles={inputStyles}
                minRows={5}
                value={data.businessContext}
                onChange={(e) => updateData({ businessContext: e.target.value })}
                description="This is injected into the AI agent to give it 'common sense' about your industry."
              />

               <Stack gap="xs">
                <TextInput
                  label="Resource Tags"
                  placeholder="Type a tag and press Enter..."
                  styles={inputStyles}
                  leftSection={<IconTags size={14} />}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = e.currentTarget.value.trim();
                      if (val && !data.tags.includes(val)) {
                        updateData({ tags: [...data.tags, val] });
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                />
                <Group gap="xs">
                  {data.tags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="light" 
                      color="violet" 
                      radius="xs"
                      rightSection={
                        <ActionIcon 
                          size="xs" 
                          variant="transparent" 
                          color="violet"
                          onClick={() => updateData({ tags: data.tags.filter(t => t !== tag) })}
                        >
                          ×
                        </ActionIcon>
                      }
                    >
                      {tag}
                    </Badge>
                  ))}
                  {data.tags.length === 0 && <Text size="10px" c="dimmed" ml={4}>No tags assigned yet.</Text>}
                </Group>
              </Stack>
           </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
