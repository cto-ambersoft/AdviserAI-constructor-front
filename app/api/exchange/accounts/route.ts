import { backendMutationProxy, backendReadProxy } from "@/app/api/_utils/backend-proxy";

export async function GET(request: Request) {
  return backendReadProxy("/api/v1/exchange/accounts", request);
}

export async function POST(request: Request) {
  return backendMutationProxy("/api/v1/exchange/accounts", request, "POST");
}
