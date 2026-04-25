import { Grid, TextInput, Stack, Text, Box, Group } from "@mantine/core";
import { IconFile, IconInfoCircle } from "@tabler/icons-react";
import { inputStyles } from "@/lib/styles";
import { useCreationWizard } from "@/lib/store/useCreationWizard";

export function SQLiteForm() {
  const { data, updateData } = useCreationWizard();
  const dbConfig = data.dbConfig || {};

  const handleUpdate = (field: string, value: any) => {
    updateData({
      dbConfig: { ...dbConfig, [field]: value }
    });
  };

  return (
    <Stack gap="lg">
      <Grid>
        <Grid.Col span={12}>
          <TextInput
            label="Database File Path"
            placeholder="e.g. /data/app.db or C:\data\app.db"
            leftSection={<IconFile size={14} />}
            styles={inputStyles}
            value={dbConfig.filePath || ""}
            onChange={(e) => handleUpdate("filePath", e.target.value)}
          />
        </Grid.Col>
      </Grid>

      <Box
        p="md"
        style={{
          background: "rgba(147,51,234,0.06)",
          border: "1px solid rgba(147,51,234,0.15)",
          borderRadius: "8px",
        }}
      >
        <Group gap="xs" align="flex-start">
          <IconInfoCircle size={16} color="#c084fc" style={{ flexShrink: 0, marginTop: 2 }} />
          <Stack gap={4}>
            <Text size="xs" fw={600} c="white">SQLite Connection Notes</Text>
            <Text size="xs" c="dimmed">
              SQLite is a local, file-based database. No host, port, or credentials are required.
              Provide the <strong>absolute path</strong> to the <code>.db</code> or <code>.sqlite</code> file on
              the <strong>server</strong> where Orcha Agent OS is running.
            </Text>
          </Stack>
        </Group>
      </Box>
    </Stack>
  );
}
