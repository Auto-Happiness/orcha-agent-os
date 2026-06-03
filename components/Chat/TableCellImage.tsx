"use client";

import React, { memo, useState } from "react";
import { Text, Box, HoverCard } from "@mantine/core";

export const isImageUrl = (url: any): boolean => {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  return /\.(jpeg|jpg|gif|png|webp|svg|bmp)(?:\?.*)?$/i.test(trimmed);
};

export const TableCellImage = memo(function TableCellImage({ url }: { url: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <Text
        component="a"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        c="violet.3"
        style={{ textDecoration: "underline", cursor: "pointer", fontSize: 11 }}
      >
        {url}
      </Text>
    );
  }

  return (
    <HoverCard width={280} position="top" withArrow shadow="md" openDelay={200} closeDelay={100}>
      <HoverCard.Target>
        <Box
          component="a"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            cursor: "pointer",
            borderRadius: 4,
            overflow: "hidden",
            border: "1px solid rgba(147, 51, 234, 0.3)",
            height: 36,
            verticalAlign: "middle",
            transition: "transform 0.15s ease, border-color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.borderColor = "rgba(147, 51, 234, 0.8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.borderColor = "rgba(147, 51, 234, 0.3)";
          }}
        >
          <img
            src={url}
            alt="thumbnail"
            style={{
              height: "100%",
              width: "auto",
              maxWidth: 80,
              objectFit: "cover",
              display: "block",
            }}
            onError={() => setHasError(true)}
          />
        </Box>
      </HoverCard.Target>
      <HoverCard.Dropdown style={{ padding: 6, background: "rgba(19, 16, 42, 0.95)", border: "1px solid rgba(147, 51, 234, 0.25)", zIndex: 1000 }}>
        <img
          src={url}
          alt="preview"
          style={{
            width: "100%",
            height: "auto",
            maxHeight: 240,
            borderRadius: 4,
            objectFit: "contain",
            display: "block",
          }}
        />
      </HoverCard.Dropdown>
    </HoverCard>
  );
});

export const ChatImagePreview = memo(function ChatImagePreview({ url, alt }: { url: string; alt: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <Text
        component="a"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        c="violet.3"
        style={{ textDecoration: "underline", cursor: "pointer", fontSize: 13 }}
      >
        {alt || url}
      </Text>
    );
  }

  return (
    <Box
      style={{
        marginTop: 8,
        marginBottom: 8,
        maxWidth: "100%",
        width: 320,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid rgba(147, 51, 234, 0.2)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        background: "rgba(10,8,20,0.5)",
        display: "block",
      }}
    >
      <Box
        component="a"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          cursor: "pointer",
          transition: "opacity 0.2s ease, transform 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.9";
          e.currentTarget.style.transform = "scale(1.01)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <img
          src={url}
          alt={alt || "Image preview"}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: 240,
            objectFit: "contain",
            display: "block",
          }}
          onError={() => setHasError(true)}
        />
      </Box>
      {alt && alt !== url && (
        <Box style={{ padding: "6px 12px", borderTop: "1px solid rgba(147, 51, 234, 0.1)", background: "rgba(19,16,42,0.95)" }}>
          <Text size="xs" c="rgba(192,132,252,0.7)" style={{ fontStyle: "italic", fontSize: 11 }}>{alt}</Text>
        </Box>
      )}
    </Box>
  );
});
