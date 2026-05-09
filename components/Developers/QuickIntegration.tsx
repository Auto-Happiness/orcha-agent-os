import { 
  Box, 
  Group, 
  Title, 
  Paper, 
  Stack, 
  Text, 
  Tabs, 
  Button, 
  Code, 
  rem 
} from "@mantine/core";
import { 
  IconCode, 
  IconTerminal2, 
  IconBrandJavascript, 
  IconBrandTypescript, 
  IconBrandPython, 
  IconBrandGolang, 
  IconBrandPhp, 
  IconExternalLink 
} from "@tabler/icons-react";

interface QuickIntegrationProps {
  organizationId: string;
}

const HighlightCode = ({ code, lang }: { code: string; lang: string }) => {
  const highlighted = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"(.*?)"/g, '<span style="color: #ce9178">"$1"</span>') // strings
    .replace(/\b(func|package|import|var|public|class|static|void|using|await|new|return|curl|if|throws|var|async|def|from|as|print|const|interface|type)\b/g, '<span style="color: #569cd6">$1</span>') // keywords
    .replace(/\b(http|client|req|resp|payload|messages|organizationId|ch|request|response|URL|Header|Body|Main|requests|json|fetch|headers|method|body|reader|value)\b/g, '<span style="color: #9cdcfe">$1</span>') // variables
    .replace(/\b(POST|Authorization|Bearer|Content-Type)\b/g, '<span style="color: #4ec9b0">$1</span>'); // headers/methods

  return (
    <Code 
      block 
      p="md" 
      style={{ 
        background: "rgba(0,0,0,0.5)", 
        color: "#d4d4d4", 
        fontSize: rem(11), 
        fontFamily: "monospace",
        lineHeight: 1.6,
        border: "1px solid rgba(255,255,255,0.05)"
      }}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
};

export function QuickIntegration({ organizationId }: QuickIntegrationProps) {
  return (
    <Box>
      <Group gap="xs" mb="sm">
        <IconCode size={18} color="#a855f7" />
        <Title order={4} c="white">Quick Integration</Title>
      </Group>
      <Paper
        p="xl"
        radius="lg"
        style={{
          background: "rgba(147,51,234,0.03)",
          border: "1px solid rgba(147,51,234,0.15)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <Box style={{
          position: "absolute",
          top: -50,
          right: -50,
          width: 150,
          height: 150,
          background: "radial-gradient(circle, rgba(147,51,234,0.2) 0%, transparent 70%)",
          filter: "blur(20px)"
        }} />

        <Stack gap="md">
          <Box>
            <Text size="sm" fw={600} c="white" mb={4}>Streaming API (SSE)</Text>
            <Text size="xs" c="dimmed" lh={1.5}>
              This endpoint uses <strong>Server-Sent Events (SSE)</strong> to stream responses 
              in real-time chunks, allowing your application to display 
              the agent's response as it is being generated.
            </Text>
          </Box>

          <Text size="sm" c="dimmed">Select your language to see integration examples:</Text>
          
          <Tabs variant="outline" defaultValue="curl" styles={{
              tab: { fontSize: rem(11), padding: "6px 16px", borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" },
              list: { borderBottom: "none", marginBottom: rem(12), gap: rem(8) }
          }}>
            <Tabs.List>
              <Tabs.Tab value="curl" leftSection={<IconTerminal2 size={14} />}>cURL</Tabs.Tab>
              <Tabs.Tab value="js" leftSection={<IconBrandJavascript size={14} color="#F7DF1E" />}>JavaScript</Tabs.Tab>
              <Tabs.Tab value="ts" leftSection={<IconBrandTypescript size={14} color="#3178C6" />}>TypeScript</Tabs.Tab>
              <Tabs.Tab value="python" leftSection={<IconBrandPython size={14} color="#3776AB" />}>Python</Tabs.Tab>
              <Tabs.Tab value="go" leftSection={<IconBrandGolang size={14} color="#00ADD8" />}>Golang</Tabs.Tab>
              <Tabs.Tab value="java" leftSection={<IconCode size={14} color="#E76F00" />}>Java</Tabs.Tab>
              <Tabs.Tab value="csharp" leftSection={<IconCode size={14} color="#512BD4" />}>C#</Tabs.Tab>
              <Tabs.Tab value="php" leftSection={<IconBrandPhp size={14} color="#777BB4" />}>PHP</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="curl">
              <HighlightCode 
                lang="bash"
                code={`curl -X POST https://api.orcha-agent.com/api/chat \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "organizationId": "${organizationId}",
    "messages": [{"role": "user", "content": "Hello Agent"}]
  }'`}
              />
            </Tabs.Panel>

            <Tabs.Panel value="js">
              <HighlightCode 
                lang="javascript"
                code={`const response = await fetch("https://api.orcha-agent.com/api/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    organizationId: "${organizationId}",
    messages: [{ role: "user", content: "Hello Agent" }]
  })
});

const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(new TextDecoder().decode(value));
}`}
              />
            </Tabs.Panel>

            <Tabs.Panel value="ts">
              <HighlightCode 
                lang="typescript"
                code={`interface ChatRequest {
  organizationId: string;
  messages: Array<{ role: string; content: string }>;
}

const req: ChatRequest = {
  organizationId: "${organizationId}",
  messages: [{ role: "user", content: "Hello Agent" }]
};

const response = await fetch("https://api.orcha-agent.com/api/chat", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(req)
});`}
              />
            </Tabs.Panel>

            <Tabs.Panel value="python">
              <HighlightCode 
                lang="python"
                code={`import requests
import json

url = "https://api.orcha-agent.com/api/chat"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}
payload = {
    "organizationId": "${organizationId}",
    "messages": [{"role": "user", "content": "Hello Agent"}]
}

response = requests.post(url, headers=headers, json=payload, stream=True)

for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'))`}
              />
            </Tabs.Panel>

            <Tabs.Panel value="go">
              <HighlightCode 
                lang="go"
                code={`package main

import (
	"bytes"
	"encoding/json"
	"net/http"
)

func main() {
	url := "https://api.orcha-agent.com/api/chat"
	payload := map[string]interface{}{
		"organizationId": "${organizationId}",
		"messages": []map[string]string{
			{"role": "user", "content": "Hello Agent"},
		},
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer YOUR_API_KEY")
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	client.Do(req)
}`}
              />
            </Tabs.Panel>

            <Tabs.Panel value="java">
              <HighlightCode 
                lang="java"
                code={`import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class Main {
    public static void main(String[] args) throws Exception {
        var client = HttpClient.newHttpClient();
        var request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.orcha-agent.com/api/chat"))
            .header("Authorization", "Bearer YOUR_API_KEY")
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\\"organizationId\\":\\"${organizationId}\\", \\"messages\\":[{\\"role\\":\\"user\\", \\"content\\":\\"Hello Agent\\"}]}"))
            .build();

        client.send(request, HttpResponse.BodyHandlers.ofString());
    }
}`}
              />
            </Tabs.Panel>

            <Tabs.Panel value="csharp">
              <HighlightCode 
                lang="csharp"
                code={`using System.Net.Http.Json;

using var client = new HttpClient();
client.DefaultRequestHeaders.Add("Authorization", "Bearer YOUR_API_KEY");

var payload = new {
    organizationId = "${organizationId}",
    messages = new[] { new { role = "user", content = "Hello Agent" } }
};

await client.PostAsJsonAsync("https://api.orcha-agent.com/api/chat", payload);`}
              />
            </Tabs.Panel>

            <Tabs.Panel value="php">
              <HighlightCode 
                lang="php"
                code={`<?php
$ch = curl_init("https://api.orcha-agent.com/api/chat");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    "organizationId" => "${organizationId}",
    "messages" => [["role" => "user", "content" => "Hello Agent"]]
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer YOUR_API_KEY",
    "Content-Type: application/json"
]);

$response = curl_exec($ch);
curl_close($ch);`}
              />
            </Tabs.Panel>
          </Tabs>

          <Button
            variant="subtle"
            color="violet"
            size="xs"
            rightSection={<IconExternalLink size={14} />}
            component="a"
            href="#"
            style={{ alignSelf: "flex-start" }}
          >
            Read Full API Documentation
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
