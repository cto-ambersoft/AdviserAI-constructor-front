import { apiRequest } from "@/lib/api/client";
import type {
  ExchangeAccountCreate,
  ExchangeAccountRead,
  ExchangeAccountsMetaResponse,
  ExchangeAccountUpdate,
  ExchangeAccountValidateResponse,
} from "@/lib/api/types";

export async function getExchangeAccountsMeta() {
  return apiRequest<ExchangeAccountsMetaResponse>("/api/exchange/accounts/meta");
}

export async function listExchangeAccounts() {
  return apiRequest<ExchangeAccountRead[]>("/api/exchange/accounts");
}

export async function createExchangeAccount(payload: ExchangeAccountCreate) {
  return apiRequest<ExchangeAccountRead>("/api/v1/exchange/accounts", {
    method: "POST",
    body: payload,
  });
}

export async function updateExchangeAccount(accountId: number, payload: ExchangeAccountUpdate) {
  return apiRequest<ExchangeAccountRead>(`/api/v1/exchange/accounts/${accountId}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteExchangeAccount(accountId: number) {
  return apiRequest<void>(`/api/v1/exchange/accounts/${accountId}`, {
    method: "DELETE",
  });
}

export async function validateExchangeAccount(accountId: number) {
  return apiRequest<ExchangeAccountValidateResponse>(`/api/v1/exchange/accounts/${accountId}/validate`, {
    method: "POST",
  });
}
