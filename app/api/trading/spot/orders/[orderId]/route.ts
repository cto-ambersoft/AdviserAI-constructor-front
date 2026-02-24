import { backendMutationProxy } from "@/app/api/_utils/backend-proxy";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  return backendMutationProxy(`/api/v1/trading/spot/orders/${orderId}`, request, "DELETE");
}
