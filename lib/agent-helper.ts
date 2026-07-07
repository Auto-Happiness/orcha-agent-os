import { createChatAgent as realCreateChatAgent } from "./chat-agent";

/**
 * A testable wrapper around the agent initialization logic.
 * By using this wrapper, unit tests can stub out live agent calls
 * and mock stream responses without connecting to external LLM providers.
 */
export const agentHelper = {
  createChatAgent: async (context: any) => {
    return realCreateChatAgent(context);
  }
};
