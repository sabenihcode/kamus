import { CohereClient } from "cohere-ai";

let client: CohereClient | null = null;

export function getCohereClient(): CohereClient {
  if (!client) {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error("COHERE_API_KEY is not set");
    }
    client = new CohereClient({ token: apiKey });
  }
  return client;
}

function toCohereRole(role: "user" | "assistant"): "USER" | "CHATBOT" {
  return role === "user" ? "USER" : "CHATBOT";
}

export async function generateCohereResponse(
  systemPrompt: string,
  userMessages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const cohere = getCohereClient();

  // Build valid chat history: must alternate USER / CHATBOT and not start with CHATBOT
  const chatHistory: Array<{ role: "USER" | "CHATBOT"; message: string }> = [];

  for (const msg of userMessages.slice(0, -1)) {
    const cohereRole = toCohereRole(msg.role);

    // If history is empty, it must start with USER
    if (chatHistory.length === 0 && cohereRole === "CHATBOT") {
      continue;
    }

    // Avoid duplicate consecutive roles
    const lastRole = chatHistory[chatHistory.length - 1]?.role;
    if (lastRole === cohereRole) {
      continue;
    }

    chatHistory.push({ role: cohereRole, message: msg.content });
  }

  const lastMessage = userMessages[userMessages.length - 1];

  const model = process.env.COHERE_MODEL || "command-r";

  const response = await cohere.chat({
    model,
    message: lastMessage?.content || "",
    chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
    preamble: systemPrompt,
    temperature: 0.3,
    maxTokens: 2048,
  });

  return response.text || "";
}
