import { apiRequest } from "@/lib/api/client";
import type {
  AdminRuntimeQuery,
  AdminRuntimeSnapshotResponse,
} from "@/lib/api/types";

type GetAdminRuntimeOptions = {
  signal?: AbortSignal;
};

export async function getAdminRuntimeSnapshot(
  query: AdminRuntimeQuery,
  options: GetAdminRuntimeOptions = {},
) {
  const { signal } = options;
  return apiRequest<AdminRuntimeSnapshotResponse>("/api/v1/admin/runtime", {
    method: "GET",
    query,
    signal,
  });
}
