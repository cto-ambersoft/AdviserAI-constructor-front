import { apiRequest } from "@/lib/api/client";
import type { AIAgentPrompt, AIAgentResponse } from "@/lib/api/types";

export async function analyzeWithAI(payload: AIAgentPrompt) {
  return apiRequest<AIAgentResponse>("/api/v1/ai/analyze", {
    method: "POST",
    body: payload,
  });
}
