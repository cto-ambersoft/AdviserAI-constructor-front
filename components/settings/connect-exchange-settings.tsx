"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import {
  ApiError,
  createExchangeAccount,
  deleteExchangeAccount,
  getExchangeAccountsMeta,
  listExchangeAccounts,
  updateExchangeAccount,
  validateExchangeAccount,
  type ExchangeAccountRead,
  type ExchangeAccountUpdate,
  type ExchangeAccountsMetaResponse,
} from "@/lib/api";

const CARD_CLASS = "border-border/80 bg-card/80 shadow-sm backdrop-blur";

export function ConnectExchangeSettings() {
  const [accountsMeta, setAccountsMeta] = useState<ExchangeAccountsMetaResponse | null>(null);
  const [accounts, setAccounts] = useState<ExchangeAccountRead[]>([]);
  const [selectedExchangeName, setSelectedExchangeName] = useState("bybit");
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editMode, setEditMode] = useState<"demo" | "real">("demo");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingByAction, setPendingByAction] = useState<Record<string, boolean>>({});

  const setActionPending = useCallback((actionKey: string, value: boolean) => {
    setPendingByAction((prev) => ({ ...prev, [actionKey]: value }));
  }, []);

  const isActionPending = useCallback(
    (actionKey: string) => {
      return Boolean(pendingByAction[actionKey]);
    },
    [pendingByAction],
  );

  const runWithPending = useCallback(
    async <T,>(actionKey: string, run: () => Promise<T>): Promise<T> => {
      setActionPending(actionKey, true);
      try {
        return await run();
      } finally {
        setActionPending(actionKey, false);
      }
    },
    [setActionPending],
  );

  useEffect(() => {
    void (async () => {
      try {
        const [meta, nextAccounts] = await Promise.all([getExchangeAccountsMeta(), listExchangeAccounts()]);
        setAccountsMeta(meta);
        setAccounts(nextAccounts);
        if (meta.supported_exchanges.length > 0) {
          setSelectedExchangeName(meta.supported_exchanges[0]);
        }
      } catch (error) {
        setErrorMessage(toUserErrorMessage(error, "Failed to load exchange accounts"));
      }
    })();
  }, []);

  const handleCreateAccount = async (formData: FormData) => {
    const mode = (formData.get("mode")?.toString() ?? "demo") as "demo" | "real";
    await runWithPending("create-account", async () => {
      setErrorMessage("");
      const payload = {
        exchange_name: formData.get("exchange_name")?.toString().trim() ?? "",
        account_label: formData.get("account_label")?.toString().trim() ?? "",
        mode,
        api_key: formData.get("api_key")?.toString() ?? "",
        api_secret: formData.get("api_secret")?.toString() ?? "",
        passphrase: formData.get("passphrase")?.toString() || null,
      };
      await createExchangeAccount(payload);
      setAccounts(await listExchangeAccounts());
      setMessage("Account created. Secret values are never shown again.");
    });
  };

  const handleUpdateAccount = async (accountId: number, formData: FormData) => {
    const nextMode = (formData.get("mode")?.toString() ?? "demo") as "demo" | "real";
    const patch: ExchangeAccountUpdate = {
      account_label: formData.get("account_label")?.toString().trim() || null,
      mode: nextMode,
      api_key: formData.get("api_key")?.toString() || null,
      api_secret: formData.get("api_secret")?.toString() || null,
      passphrase: formData.get("passphrase")?.toString() || null,
    };
    await runWithPending(`update-account-${accountId}`, async () => {
      await updateExchangeAccount(accountId, patch);
      setAccounts(await listExchangeAccounts());
      setEditingAccountId(null);
      setMessage("Account updated. Secrets are masked and cannot be retrieved.");
    });
  };

  const exchangeOptions = accountsMeta?.supported_exchanges ?? [selectedExchangeName];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1100px] p-4 md:p-6">
      {errorMessage ? (
        <p className="mb-3 rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
      {message ? (
        <p className="mb-3 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      ) : null}

      <Card className={CARD_CLASS}>
        <CardHeader>
          <CardTitle>Connect Exchange</CardTitle>
          <CardDescription>Create, update, delete, and validate exchange connections.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-2 rounded-md border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              setErrorMessage("");
              setMessage("");
              const formData = new FormData(event.currentTarget);
              void handleCreateAccount(formData)
                .then(() => {
                  event.currentTarget.reset();
                })
                .catch((error) => {
                  setErrorMessage(toUserErrorMessage(error, "Failed to create account"));
                });
            }}
          >
            <fieldset className="space-y-2" disabled={isActionPending("create-account")}>
              <Label text="New exchange account" />
              <select className={INPUT_CLASS} name="exchange_name" defaultValue={selectedExchangeName}>
                {exchangeOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input className={INPUT_CLASS} name="account_label" placeholder="Label" required />
              <select className={INPUT_CLASS} name="mode" defaultValue={accountsMeta?.default_mode ?? "demo"}>
                <option value="demo">demo</option>
                <option value="real">real</option>
              </select>
              <input className={INPUT_CLASS} name="api_key" placeholder="API key" autoComplete="off" required />
              <input
                className={INPUT_CLASS}
                name="api_secret"
                placeholder="API secret"
                type="password"
                autoComplete="new-password"
                required
              />
              <input
                className={INPUT_CLASS}
                name="passphrase"
                placeholder="Passphrase (optional)"
                type="password"
                autoComplete="new-password"
              />
              <LoadingButton
                className="w-full"
                type="submit"
                isLoading={isActionPending("create-account")}
                loadingText="Creating..."
              >
                Create Account
              </LoadingButton>
            </fieldset>
          </form>

          <Separator />

          <div className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {account.account_label} ({account.exchange_name})
                  </p>
                  <Badge variant={account.mode === "real" ? "destructive" : "secondary"}>{account.mode}</Badge>
                </div>

                {editingAccountId === account.id ? (
                  <form
                    className="space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setErrorMessage("");
                      const formData = new FormData(event.currentTarget);
                      void handleUpdateAccount(account.id, formData).catch((error) => {
                        setErrorMessage(toUserErrorMessage(error, "Failed to update account"));
                      });
                    }}
                  >
                    <input
                      className={INPUT_CLASS}
                      name="account_label"
                      value={editLabel}
                      onChange={(event) => setEditLabel(event.target.value)}
                      required
                    />
                    <select
                      className={INPUT_CLASS}
                      name="mode"
                      value={editMode}
                      onChange={(event) => setEditMode(event.target.value as "demo" | "real")}
                    >
                      <option value="demo">demo</option>
                      <option value="real">real</option>
                    </select>
                    <input className={INPUT_CLASS} name="api_key" placeholder="New API key (optional)" />
                    <input
                      className={INPUT_CLASS}
                      name="api_secret"
                      placeholder="New API secret (optional)"
                      type="password"
                      autoComplete="new-password"
                    />
                    <input
                      className={INPUT_CLASS}
                      name="passphrase"
                      placeholder="New passphrase (optional)"
                      type="password"
                      autoComplete="new-password"
                    />
                    <div className="flex gap-2">
                      <LoadingButton
                        type="submit"
                        size="sm"
                        isLoading={isActionPending(`update-account-${account.id}`)}
                        loadingText="Saving..."
                      >
                        Save
                      </LoadingButton>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditingAccountId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingAccountId(account.id);
                        setEditLabel(account.account_label);
                        setEditMode(account.mode as "demo" | "real");
                      }}
                    >
                      Edit
                    </Button>
                    <LoadingButton
                      size="sm"
                      variant="outline"
                      isLoading={isActionPending(`validate-account-${account.id}`)}
                      loadingText="Validating..."
                      onClick={() =>
                        void runWithPending(`validate-account-${account.id}`, async () => {
                          const res = await validateExchangeAccount(account.id);
                          setMessage(`Validation status: ${res.status}`);
                        }).catch((error) => {
                          setErrorMessage(toUserErrorMessage(error, "Validation failed"));
                        })
                      }
                    >
                      Validate
                    </LoadingButton>
                    <LoadingButton
                      size="sm"
                      variant="destructive"
                      isLoading={isActionPending(`delete-account-${account.id}`)}
                      loadingText="Deleting..."
                      onClick={() =>
                        void runWithPending(`delete-account-${account.id}`, async () => {
                          await deleteExchangeAccount(account.id);
                          setAccounts(await listExchangeAccounts());
                          setMessage("Account deleted.");
                        }).catch((error) => {
                          setErrorMessage(toUserErrorMessage(error, "Delete failed"));
                        })
                      }
                    >
                      Delete
                    </LoadingButton>
                  </div>
                )}
              </div>
            ))}
            {accounts.length === 0 ? <p className="text-sm text-muted-foreground">No accounts yet.</p> : null}
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <p className="text-sm text-muted-foreground">
              After connecting an exchange, move to the trading page to place orders.
            </p>
            <Button asChild>
              <Link href="/trade">Go to Trade</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function toUserErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return typeof error.message === "string" && error.message.trim().length > 0 ? error.message : fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function LoadingButton({
  isLoading,
  loadingText = "Loading...",
  children,
  disabled,
  ...props
}: {
  isLoading: boolean;
  loadingText?: string;
} & ComponentProps<typeof Button>) {
  return (
    <Button {...props} disabled={disabled || isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
