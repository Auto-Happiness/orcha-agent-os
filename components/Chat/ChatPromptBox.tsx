import { 
  Box, 
  Paper, 
  Stack, 
  TextInput, 
  Group, 
  ActionIcon, 
  Select, 
  Badge, 
  Transition,
  Text
} from "@mantine/core";
import { 
  IconPlus, 
  IconAdjustmentsHorizontal, 
  IconChevronDown, 
  IconMicrophone, 
  IconArrowRight 
} from "@tabler/icons-react";

interface ChatPromptBoxProps {
  input: string;
  handleInputChange: (e: any) => void;
  handleSubmit: (e: any) => void;
  isLoading: boolean;
  allConfigs: any[];
  selectedConfigId: string | null;
  setSelectedConfigId: (val: string | null) => void;
}

export function ChatPromptBox({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  allConfigs,
  selectedConfigId,
  setSelectedConfigId
}: ChatPromptBoxProps) {
  return (
    <Box p="md" style={{ background: "transparent" }}>
      <form onSubmit={handleSubmit}>
        <Paper 
          radius="lg" 
          p="sm" 
          style={{ 
            background: "#161616", 
            border: "1px solid rgba(255,255,255,0.1)",
            transition: "all 0.2s ease",
          }}
          onFocusCapture={(e) => e.currentTarget.style.borderColor = "rgba(147,51,234,0.4)"}
          onBlurCapture={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
        >
          <Stack gap="xs">
            <TextInput
              placeholder="Ask anything, @ to mention, / for workflows"
              variant="unstyled"
              size="md"
              value={input}
              onChange={handleInputChange}
              styles={{ 
                input: { 
                  color: "white", 
                  fontSize: "14px",
                  background: "transparent"
                } 
              }}
            />
            
            <Group justify="space-between" align="center">
              <Group gap={8}>
                 <ActionIcon variant="transparent" color="dimmed" size="md">
                    <IconPlus size={18} />
                 </ActionIcon>
                 
                 <Select
                   data={allConfigs?.map(c => ({ value: c._id, label: c.name })) || []}
                   value={selectedConfigId}
                   onChange={setSelectedConfigId}
                   variant="unstyled"
                   size="xs"
                   w={220}
                   comboboxProps={{ position: 'top-start', width: 320, shadow: 'xl' }}
                   leftSection={<IconAdjustmentsHorizontal size={14} color="rgba(255,255,255,0.4)" />}
                   rightSection={<IconChevronDown size={10} color="rgba(255,255,255,0.4)" />}
                   renderOption={({ option }) => {
                      const config = allConfigs?.find(c => c._id === option.value);
                      return (
                        <Stack gap={2}>
                           <Text size="xs" fw={700} c="white">{option.label}</Text>
                           {config?.description && (
                             <Text size="10px" c="dimmed" style={{ lineHeight: 1.2 }}>
                               {config.description}
                             </Text>
                           )}
                        </Stack>
                      );
                   }}
                   styles={{
                     root: { width: "220px" },
                     input: { 
                       color: "rgba(255,255,255,0.6)", 
                       fontWeight: 500, 
                       fontSize: "12px",
                       background: "transparent", 
                       padding: "0 8px"
                     },
                     dropdown: { 
                        background: "#161616", 
                        borderColor: "rgba(255,255,255,0.1)", 
                        borderRadius: "8px",
                        padding: "8px"
                     },
                     option: { 
                        fontSize: "12px", 
                        color: "rgba(255,255,255,0.6)", 
                        padding: "8px 12px",
                        "&[data-selected]": { background: "rgba(147,51,234,0.2)", color: "white" } 
                     }
                   }}
                 />

                 <Badge variant="outline" color="gray" size="sm" radius="sm" style={{ borderColor: 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                    Local
                 </Badge>
              </Group>

              <Group gap={8}>
                 <ActionIcon variant="transparent" color="dimmed" size="md">
                    <IconMicrophone size={18} />
                 </ActionIcon>
                 
                 <Transition mounted={(input?.length || 0) > 0} transition="scale" duration={200}>
                    {(styles) => (
                      <ActionIcon 
                        style={styles}
                        type="submit" 
                        color="violet" 
                        radius="xl" 
                        size="lg" 
                        variant="filled"
                        disabled={isLoading}
                      >
                        <IconArrowRight size={20} />
                      </ActionIcon>
                    )}
                 </Transition>
              </Group>
            </Group>
          </Stack>
        </Paper>
      </form>
      
      <Text size="10px" ta="center" c="dimmed" py="xs" mt={4} style={{ opacity: 0.5 }}>
        Orcha can make mistakes. Verify important results with the Query Lab.
      </Text>
    </Box>
  );
}
