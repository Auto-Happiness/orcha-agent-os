import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { KeyManager } from "./key-manager";

export type LanguageModel = ReturnType<ReturnType<typeof createOpenAI>["chat"]>;

interface AiKeyRecord {
  provider: string;
  keyValue: string;
  storageStrategy: string;
}

function decryptKey(record: AiKeyRecord | undefined, orgIdStr: string): string | undefined {
  if (record?.keyValue && record.storageStrategy === "convex") {
    try {
      const decrypted = KeyManager.decrypt(record.keyValue, orgIdStr);
      return decrypted ? decrypted.trim() : undefined;
    } catch (e) {
      console.error(`[ModelResolver] Failed to decrypt ${record.provider} key:`, e);
    }
  }
  return undefined;
}

/**
 * Resolves the appropriate AI language model instance based on the
 * selected model string (e.g. "openai:gpt-4o"), stored AI keys, and org context.
 *
 * Throws a descriptive error string if the model cannot be initialized.
 */
export function resolveModel(
  modelId: string,
  aiKeys: AiKeyRecord[],
  orgIdStr: string
): LanguageModel {
  const colonIdx = modelId.indexOf(":");
  const provider = modelId.substring(0, colonIdx);
  const modelName = modelId.substring(colonIdx + 1);

  const findKey = (p: string) => aiKeys.find((k) => k.provider === p);

  switch (provider) {
    case "openai": {
      const apiKey = decryptKey(findKey("openai"), orgIdStr);
      if (!apiKey) throw new Error("OpenAI API key not configured.");
      return createOpenAI({ apiKey }).chat(modelName);
    }

    case "local": {
      const record = findKey("local");
      if (!record?.keyValue) throw new Error("Local model not configured. Add it in Settings → AI Intelligence.");
      const raw = record.storageStrategy === "convex"
        ? KeyManager.decrypt(record.keyValue, orgIdStr)
        : record.keyValue;
      const localConfig = JSON.parse(raw);
      const baseURL = (localConfig.url || "http://127.0.0.1:11434").replace(/\/$/, "") + "/v1";
      const resolvedModel = (modelName && modelName !== "local") ? modelName : (localConfig.model || "qwen3:latest");
      return createOpenAI({ baseURL, apiKey: "ollama" }).chat(resolvedModel);
    }

    case "gemini": {
      const apiKey = decryptKey(findKey("gemini"), orgIdStr);
      if (!apiKey) throw new Error("Gemini API key not configured.");
      return createGoogleGenerativeAI({ apiKey })(modelName || "gemini-1.5-flash") as any;
    }

    case "claude":
    case "anthropic": {
      const apiKey = decryptKey(findKey("claude"), orgIdStr);
      if (!apiKey) throw new Error("Claude API key not configured.");
      return createAnthropic({ apiKey })(modelName) as any;
    }

    default: {
      const apiKey = decryptKey(findKey("gemini"), orgIdStr);
      if (!apiKey) throw new Error("Gemini API key not configured.");
      return createGoogleGenerativeAI({ apiKey })(modelName || "gemini-1.5-flash") as any;
    }
  }
}
