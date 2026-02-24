import { backendMutationProxy } from "@/app/api/_utils/backend-proxy";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { accountId } = await context.params;
  return backendMutationProxy(`/api/v1/exchange/accounts/${accountId}/validate`, request, "POST");
}
