import { 
  Group, 
  Stack, 
  Text, 
  UnstyledButton, 
  rem, 
  ScrollArea,
  Box,
  ThemeIcon
} from "@mantine/core";
import { 
  IconBrandMysql, 
  IconBrandMongodb, 
  IconSql, 
  IconDatabase, 
  IconCloud,
  IconTableFilled,
  IconServer,
  IconChevronRight
} from "@tabler/icons-react";

const PROVIDERS = [
  { id: "postgres", label: "PostgreSQL", icon: IconSql, color: "blue" },
  { id: "mysql",    label: "MySQL",      icon: IconBrandMysql, color: "cyan" },
  { id: "mssql",    label: "MSSQL",      icon: IconServer, color: "red" },
  { id: "mongodb",  label: "MongoDB",    icon: IconBrandMongodb, color: "green" },
  { id: "bigquery", label: "BigQuery",   icon: IconTableFilled, color: "indigo" },
  { id: "sqlite",   label: "SQLite",     icon: IconDatabase, color: "gray" },
];

interface ProviderSelectorProps {
  selected: string;
  onSelect: (provider: string) => void;
}

const getColorRGB = (color: string) => {
  switch (color) {
    case "blue": return "37, 150, 243";
    case "cyan": return "0, 188, 212";
    case "red": return "244, 67, 54";
    case "green": return "76, 175, 80";
    case "indigo": return "63, 81, 181";
    case "violet": return "147, 51, 234";
    default: return "255, 255, 255";
  }
};

export function DatabaseProviderSelector({ selected, onSelect }: ProviderSelectorProps) {
  return (
    <Box h="100%" display="flex" style={{ flexDirection: "column" }}>
      <Text size="xs" fw={700} c="dimmed" mb={16} ml={4} style={{ textTransform: "uppercase", letterSpacing: rem(1.5) }}>
        Select engine
      </Text>
      
      <ScrollArea style={{ flex: 1 }} scrollbars="y" offsetScrollbars>
        <Stack gap="xs" pr="sm">
          {PROVIDERS.map((p) => (
            <UnstyledButton
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                width: "100%",
                padding: `${rem(12)} ${rem(16)}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: selected === p.id ? "rgba(147,51,234,0.12)" : "transparent",
                border: "1px solid",
                borderColor: selected === p.id ? "rgba(147,51,234,0.3)" : "transparent",
                borderRadius: rem(10),
                transition: "all 150ms ease",
                "&:hover": {
                  background: "rgba(147,51,234,0.06)",
                }
              }}
            >
              <Group gap="md">
                <ThemeIcon 
                  variant="light" 
                  color={selected === p.id ? p.color : "gray"} 
                  size="md" 
                  radius="md"
                  style={{ 
                    background: selected === p.id ? `rgba(${getColorRGB(p.color)}, 0.15)` : "rgba(255,255,255,0.04)" 
                  }}
                >
                  <p.icon size={18} style={{ color: selected === p.id ? `var(--mantine-color-${p.color}-filled)` : "rgba(255,255,255,0.3)" }} />
                </ThemeIcon>
                <Text size="sm" fw={selected === p.id ? 700 : 500} c={selected === p.id ? "white" : "dimmed"} style={{ whiteSpace: "nowrap" }}>
                  {p.label}
                </Text>
              </Group>

              {selected === p.id && <IconChevronRight size={14} color="#9333ea" />}
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
