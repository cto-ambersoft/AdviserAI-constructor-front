import { backendMutationProxy } from "@/app/api/_utils/backend-proxy";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { accountId } = await context.params;
  return backendMutationProxy(`/api/v1/exchange/accounts/${accountId}`, request, "PATCH");
}

export async function DELETE(request: Request, context: RouteContext) {
  const { accountId } = await context.params;
  return backendMutationProxy(`/api/v1/exchange/accounts/${accountId}`, request, "DELETE");
}
