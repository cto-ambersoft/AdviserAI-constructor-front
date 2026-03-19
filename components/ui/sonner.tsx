"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="app-toaster"
      closeButton
      position="bottom-right"
      theme="dark"
      toastOptions={{
        duration: 4000,
        style: {
          background: "var(--card)",
          color: "var(--card-foreground)",
          border: "1px solid var(--border)",
        },
        classNames: {
          toast:
            "border border-border/80 bg-card/95 text-card-foreground shadow-lg backdrop-blur-sm",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
          closeButton:
            "border-border/80 bg-muted/70 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          actionButton:
            "bg-primary text-primary-foreground transition-colors hover:brightness-110",
          cancelButton:
            "border border-border/80 bg-secondary text-secondary-foreground transition-colors hover:bg-accent",
        },
      }}
      {...props}
    />
  );
}
