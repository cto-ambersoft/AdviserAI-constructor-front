"use client";

import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { notifyApiError, notifyError, notifyInfo, notifySuccess } from "@/lib/notifications";
import {
  ApiError,
  getTelegramSettings,
  linkTelegram,
  sendTelegramTest,
  unlinkTelegram,
  updateTelegramSettings,
  type TelegramLinkOut,
  type TelegramSettingsOut,
  type TelegramSettingsUpdate,
} from "@/lib/api";

const CARD_CLASS = "border-border/80 bg-card/80 shadow-sm backdrop-blur";
const POLL_INTERVAL_MS = 3000;

type LoadState = "loading" | "ready" | "unconfigured" | "error";

function isUnconfigured(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 503 || error.code === "service_unavailable")
  );
}

export function TelegramNotificationsSettings() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [settings, setSettings] = useState<TelegramSettingsOut | null>(null);
  const [link, setLink] = useState<TelegramLinkOut | null>(null);
  const [pendingByAction, setPendingByAction] = useState<Record<string, boolean>>({});

  const isActionPending = useCallback(
    (key: string) => Boolean(pendingByAction[key]),
    [pendingByAction],
  );

  const runWithPending = useCallback(
    async <T,>(key: string, run: () => Promise<T>): Promise<T | undefined> => {
      setPendingByAction((prev) => ({ ...prev, [key]: true }));
      try {
        return await run();
      } catch (error) {
        notifyApiError(error, { fallback: "Request failed" });
        return undefined;
      } finally {
        setPendingByAction((prev) => ({ ...prev, [key]: false }));
      }
    },
    [],
  );

  // Initial load. A 503 means the backend bot token is not configured.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const next = await getTelegramSettings();
        if (!active) return;
        setSettings(next);
        setLoadState("ready");
      } catch (error) {
        if (!active) return;
        if (isUnconfigured(error)) {
          setLoadState("unconfigured");
          return;
        }
        setLoadState("error");
        notifyApiError(error, { fallback: "Failed to load notification settings" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // While a link is pending, poll until the chat is connected (or the code expires).
  useEffect(() => {
    if (!link || settings?.linked) {
      return;
    }
    const expiresAt = link.expires_at ? new Date(link.expires_at).getTime() : Number.POSITIVE_INFINITY;
    let active = true;
    const timer = setInterval(() => {
      void (async () => {
        if (!active) return;
        if (Date.now() > expiresAt) {
          setLink(null);
          notifyInfo("The connection link expired. Generate a new one.");
          return;
        }
        try {
          const next = await getTelegramSettings();
          if (!active) return;
          setSettings(next);
          if (next.linked) {
            setLink(null);
            notifySuccess("Telegram connected — notifications are enabled.");
          }
        } catch {
          // Transient errors are ignored; the next tick retries.
        }
      })();
    }, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [link, settings?.linked]);

  const patchSettings = useCallback(
    (key: string, patch: TelegramSettingsUpdate) =>
      void runWithPending(key, async () => {
        const next = await updateTelegramSettings(patch);
        setSettings(next);
      }),
    [runWithPending],
  );

  const handleConnect = () =>
    void runWithPending("link", async () => {
      const result = await linkTelegram();
      setLink(result);
      if (result.deep_link && typeof window !== "undefined") {
        window.open(result.deep_link, "_blank", "noopener,noreferrer");
      }
    });

  const handleTest = () =>
    void runWithPending("test", async () => {
      const result = await sendTelegramTest();
      if (result.status === "sent") {
        notifySuccess("Test message sent to your Telegram.");
      } else {
        notifyError(result.error?.trim() || "Failed to send test message.");
      }
    });

  const handleUnlink = () =>
    void runWithPending("unlink", async () => {
      const next = await unlinkTelegram();
      setSettings(next);
      setLink(null);
      notifySuccess("Telegram disconnected.");
    });

  return (
    <main className="mx-auto min-h-screen w-full max-w-[760px] p-4 md:p-6">
      <Card className={CARD_CLASS}>
        <CardHeader>
          <CardTitle>Telegram Notifications</CardTitle>
          <CardDescription>
            Get a Telegram message when auto-trade opens or closes a position.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadState === "loading" ? (
            <LoadingSkeleton />
          ) : loadState === "unconfigured" ? (
            <UnconfiguredNotice />
          ) : loadState === "error" ? (
            <p className="text-sm text-muted-foreground">
              Could not load notification settings. Please refresh the page.
            </p>
          ) : settings ? (
            <>
              <ConnectionSection
                settings={settings}
                link={link}
                isLinking={isActionPending("link")}
                isTesting={isActionPending("test")}
                isUnlinking={isActionPending("unlink")}
                onConnect={handleConnect}
                onCancelLink={() => setLink(null)}
                onTest={handleTest}
                onUnlink={handleUnlink}
              />
              {settings.linked ? (
                <>
                  <Separator />
                  <PreferencesSection
                    settings={settings}
                    isPending={isActionPending}
                    onChange={patchSettings}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function ConnectionSection({
  settings,
  link,
  isLinking,
  isTesting,
  isUnlinking,
  onConnect,
  onCancelLink,
  onTest,
  onUnlink,
}: {
  settings: TelegramSettingsOut;
  link: TelegramLinkOut | null;
  isLinking: boolean;
  isTesting: boolean;
  isUnlinking: boolean;
  onConnect: () => void;
  onCancelLink: () => void;
  onTest: () => void;
  onUnlink: () => void;
}) {
  if (settings.linked) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Badge variant="default">Connected</Badge>
          {settings.linked_at ? (
            <span className="text-sm text-muted-foreground">
              since {new Date(settings.linked_at).toLocaleString()}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <LoadingButton
            size="sm"
            variant="outline"
            isLoading={isTesting}
            loadingText="Sending..."
            onClick={onTest}
          >
            <Send className="size-4" />
            Send test
          </LoadingButton>
          <LoadingButton
            size="sm"
            variant="destructive"
            isLoading={isUnlinking}
            loadingText="Disconnecting..."
            onClick={onUnlink}
          >
            Disconnect
          </LoadingButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm text-muted-foreground">
        Connect your Telegram to receive trade notifications. Open the bot and press
        <span className="font-medium text-foreground"> Start</span> — no extra setup needed.
      </p>
      {link ? (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Waiting for you to press Start in Telegram...</span>
          </div>
          {link.deep_link ? (
            <a
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              href={link.deep_link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" />
              Open Telegram bot
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              Open your bot and send <code className="font-mono">/start {link.code}</code>
            </p>
          )}
          <Button size="sm" variant="ghost" onClick={onCancelLink}>
            Cancel
          </Button>
        </div>
      ) : (
        <LoadingButton isLoading={isLinking} loadingText="Generating link..." onClick={onConnect}>
          Connect Telegram
        </LoadingButton>
      )}
    </div>
  );
}

const PREFERENCE_ROWS: ReadonlyArray<{
  key: "notify_on_open" | "notify_on_close" | "notify_on_risk";
  label: string;
  description: string;
}> = [
  { key: "notify_on_open", label: "Position opened", description: "When a new trade is opened." },
  { key: "notify_on_close", label: "Position closed", description: "When a trade is closed or partially taken." },
  {
    key: "notify_on_risk",
    label: "Risk events",
    description: "Kill-switch trips and auto-pause.",
  },
];

function PreferencesSection({
  settings,
  isPending,
  onChange,
}: {
  settings: TelegramSettingsOut;
  isPending: (key: string) => boolean;
  onChange: (key: string, patch: TelegramSettingsUpdate) => void;
}) {
  return (
    <div className="space-y-1">
      <SettingRow
        label="Enable notifications"
        description="Master switch for all Telegram messages."
        checked={settings.enabled}
        disabled={isPending("enabled")}
        onCheckedChange={(value) => onChange("enabled", { enabled: value })}
      />
      <Separator className="my-1" />
      {PREFERENCE_ROWS.map((row) => (
        <SettingRow
          key={row.key}
          label={row.label}
          description={row.description}
          checked={settings[row.key]}
          // Child toggles are meaningless while the master switch is off.
          disabled={!settings.enabled || isPending(row.key)}
          onCheckedChange={(value) => onChange(row.key, { [row.key]: value })}
        />
      ))}
    </div>
  );
}

function SettingRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function UnconfiguredNotice() {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      Telegram notifications are currently unavailable. Please try again later.
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
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
