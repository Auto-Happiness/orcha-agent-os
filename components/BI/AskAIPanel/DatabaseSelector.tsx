import React from "react";
import { Menu, Group, Text, Checkbox, Avatar, Stack } from "@mantine/core";
import { IconTable, IconChevronDown } from "@tabler/icons-react";

interface DatabaseSelectorProps {
  allConfigs: any[];
  selectedConfigIds: string[];
  onChangeSelectedConfigIds: (ids: string[]) => void;
}

export function DatabaseSelector({
  allConfigs,
  selectedConfigIds,
  onChangeSelectedConfigIds,
}: DatabaseSelectorProps) {
  const handleToggleConfig = (id: string) => {
    if (selectedConfigIds.includes(id)) {
      onChangeSelectedConfigIds(selectedConfigIds.filter((cid) => cid !== id));
    } else {
      onChangeSelectedConfigIds([...selectedConfigIds, id]);
    }
  };

  return (
    <Menu
      closeOnItemClick={false}
      position="top-start"
      width={320}
      shadow="xl"
      styles={{
        dropdown: {
          background: "#0c0a1a",
          borderColor: "rgba(147, 51, 234, 0.2)",
          borderRadius: "8px",
          padding: "4px",
        },
        item: {
          padding: "8px 12px",
          borderRadius: "6px",
          color: "white",
          "&:hover": {
            background: "rgba(255, 255, 255, 0.05)",
          },
        },
      }}
    >
      <Menu.Target>
        <Group
          gap={6}
          px="sm"
          py={6}
          style={{
            cursor: "pointer",
            borderRadius: "8px",
            border: "1px solid rgba(147, 51, 234, 0.2)",
            background: "rgba(255, 255, 255, 0.02)",
            height: "32px",
            minWidth: "150px",
            transition: "all 0.15s ease",
          }}
          className="db-select-pill-hover"
        >
          <style jsx>{`
            .db-select-pill-hover:hover {
              background: rgba(255, 255, 255, 0.06) !important;
              border-color: rgba(147, 51, 234, 0.4) !important;
            }
          `}</style>
          <IconTable size={14} color="rgba(255,255,255,0.4)" />
          <Text size="xs" fw={600} c="rgba(255,255,255,0.8)" style={{ flex: 1 }}>
            {selectedConfigIds.length === 0
              ? "Select Databases"
              : `${selectedConfigIds.length} DB${selectedConfigIds.length > 1 ? "s" : ""} Selected`}
          </Text>
          <IconChevronDown size={10} color="rgba(255,255,255,0.4)" />
        </Group>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label c="dimmed" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Target Databases
        </Menu.Label>
        {allConfigs
          ?.filter((config) => {
            const dbType = config.type?.toLowerCase();
            return dbType !== "bigquery" && dbType !== "mongodb";
          })
          .map((config) => {
            const isSelected = selectedConfigIds.includes(config._id);
          return (
            <Menu.Item key={config._id} onClick={() => handleToggleConfig(config._id)}>
              <Group gap="sm" wrap="nowrap" style={{ width: "100%" }}>
                <Checkbox
                  checked={isSelected}
                  readOnly
                  size="xs"
                  color="violet"
                  styles={{ input: { cursor: "pointer" } }}
                />
                <Avatar
                  src={config.image || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"}
                  size={24}
                  radius="xs"
                  style={{ background: "transparent", opacity: 0.8 }}
                />
                <Stack gap={2} style={{ flex: 1 }}>
                  <Text size="xs" fw={700} c="white">
                    {config.name}
                  </Text>
                  <Text size="10px" c="dimmed" style={{ lineHeight: 1.2 }}>
                    {config.type?.toUpperCase()}
                    {config.description ? ` • ${config.description}` : ""}
                  </Text>
                </Stack>
              </Group>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
