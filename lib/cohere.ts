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

export async function generateCohereResponse(
  systemPrompt: string,
  userMessages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const cohere = getCohereClient();

  const chatHistory = userMessages.slice(0, -1).map((msg) => ({
    role: msg.role as "USER" | "CHATBOT",
    message: msg.content,
  }));

  const lastMessage = userMessages[userMessages.length - 1];

  const response = await cohere.chat({
    model: "command-r-plus-08-2024",
    message: lastMessage?.content || "",
    chatHistory: chatHistory.length > 0 ? chatHistory : undefined,
    preamble: systemPrompt,
    temperature: 0.3,
    maxTokens: 2048,
  });

  return response.text || "";
}
