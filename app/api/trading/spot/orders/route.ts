import { backendMutationProxy } from "@/app/api/_utils/backend-proxy";

export async function POST(request: Request) {
  return backendMutationProxy("/api/v1/trading/spot/orders", request, "POST");
}
