export const MODEL_OPTIONS = [
  {
    group: "Google Gemini",
    items: [
      { value: "gemini:gemini-3.1-pro", label: "Gemini 3.1 Pro (High)" },
      { value: "gemini:gemini-3.0-flash", label: "Gemini 3 Flash" },
      { value: "gemini:gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini:gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { value: "gemini:gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
  },
  {
    group: "OpenAI",
    items: [
      { value: "openai:gpt-5", label: "GPT-5 Omni" },
      { value: "openai:o1", label: "OpenAI o1" },
      { value: "openai:gpt-4o", label: "GPT-4o" },
      { value: "openai:gpt-4o-mini", label: "GPT-4o mini" },
    ],
  },
  {
    group: "Anthropic Claude",
    items: [
      { value: "claude:claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
      { value: "claude:claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (New)" },
      { value: "claude:claude-3-opus-20240229", label: "Claude 3 Opus" },
    ],
  },
  {
    group: "Local & Grok",
    items: [
      { value: "grok:grok-2", label: "Grok-2" },
      { value: "local:qwen4:latest", label: "Qwen4 (Local)" },
      { value: "local:qwen3:latest", label: "Qwen3 (Local)" },
      { value: "local:qwen2.5:latest", label: "Qwen2.5 (Local)" },
      { value: "local:llama4:latest", label: "Llama 4 (Local)" },
      { value: "local:llama3.1:latest", label: "Llama 3.1 (Local)" },
      { value: "local:mistral:latest", label: "Mistral (Local)" },
    ],
  }
];
