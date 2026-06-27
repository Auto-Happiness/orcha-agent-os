"use client";

import React from "react";
import { Modal, Stack, Text, Group, Button } from "@mantine/core";

interface DeleteConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export function DeleteConfirmModal({ opened, onClose, onConfirm, loading }: DeleteConfirmModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Delete Saved Query"
      centered
      size="sm"
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      styles={{
        content: { background: "var(--orcha-panel)", border: "1px solid var(--orcha-border)", borderRadius: 12 },
        header: { background: "var(--orcha-panel)", color: "var(--orcha-text-title)" },
        title: { fontWeight: 600 }
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="var(--orcha-text-body)">
          Are you sure you want to delete this saved result from your Databook? This action cannot be undone.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose} size="xs" disabled={loading}>
            Cancel
          </Button>
          <Button color="red" onClick={onConfirm} size="xs" loading={loading}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
