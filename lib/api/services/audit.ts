import { apiRequest } from "@/lib/api/client";
import type { AuditLogCreateRequest, AuditLogRead, AuditMetaResponse } from "@/lib/api/types";

export async function getAuditMeta() {
  return apiRequest<AuditMetaResponse>("/api/v1/audit/meta");
}

export async function listAuditEvents(limit?: number) {
  return apiRequest<AuditLogRead[]>("/api/v1/audit/", {
    query: { limit },
  });
}

export async function createAuditEvent(payload: AuditLogCreateRequest) {
  return apiRequest<AuditLogRead>("/api/v1/audit/events", {
    method: "POST",
    body: payload,
  });
}
