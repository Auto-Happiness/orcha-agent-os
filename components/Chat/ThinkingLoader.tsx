"use client";

import React, { useEffect, useState } from "react";
import { Group, Loader, Text } from "@mantine/core";

export function ThinkingLoader() {
  const [status, setStatus] = useState("Reviewing intent...");

  useEffect(() => {
    const sequence = [
      { text: "Reviewing intent...", delay: 1200 },
      { text: "Analyzing schema...", delay: 1800 },
      { text: "Structuring query...", delay: 2200 },
      { text: "Executing query...", delay: 2600 },
      { text: "Generating response...", delay: 3500 },
    ];

    let currentIdx = 0;
    let timeoutId: any;

    const runNext = () => {
      if (currentIdx < sequence.length - 1) {
        timeoutId = setTimeout(() => {
          currentIdx++;
          setStatus(sequence[currentIdx].text);
          runNext();
        }, sequence[currentIdx].delay);
      }
    };

    runNext();

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <Group gap="xs" align="center" wrap="nowrap" style={{ overflow: "hidden" }}>
      <style>{`
        @keyframes slideInFromRight {
          0% {
            opacity: 0;
            transform: translateX(12px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .slide-in-text {
          animation: slideInFromRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <Loader size="xs" color="violet" type="dots" />
      <Text
        key={status}
        className="slide-in-text"
        size="sm"
        c="dimmed"
        style={{
          fontStyle: "italic",
          letterSpacing: "0.02em",
          display: "inline-block"
        }}
      >
        {status}
      </Text>
    </Group>
  );
}
