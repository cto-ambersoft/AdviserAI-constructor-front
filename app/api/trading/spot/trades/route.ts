import { backendReadProxy } from "@/app/api/_utils/backend-proxy";

export async function GET(request: Request) {
  return backendReadProxy("/api/v1/trading/spot/trades", request);
}
