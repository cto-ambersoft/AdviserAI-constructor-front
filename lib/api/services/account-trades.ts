import { apiRequest } from "@/lib/api/client";
import type { AccountTradesRead } from "@/lib/api/types";

type AccountTradesQuery = {
  account_id: number;
  symbol: string;
  limit?: number;
  events_limit?: number;
};

export async function getAccountTrades(query: AccountTradesQuery) {
  const { account_id, ...params } = query;
  return apiRequest<AccountTradesRead>(`/api/v1/accounts/${account_id}/trades`, {
    method: "GET",
    query: params,
  });
}
