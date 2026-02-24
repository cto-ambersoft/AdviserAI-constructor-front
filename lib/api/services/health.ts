import { apiRequest } from "@/lib/api/client";

export async function getHealthStatus() {
  return apiRequest<Record<string, string>>("/api/v1/health");
}
