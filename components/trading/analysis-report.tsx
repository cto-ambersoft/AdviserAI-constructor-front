"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AnalysisReport({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return (
      <div className="rounded-md border border-border/70 bg-background/30 p-3 text-sm text-muted-foreground">
        Report is not available for this run.
      </div>
    );
  }

  return (
    <div className="max-h-[520px] overflow-auto rounded-md border border-border/70 bg-background/40 p-4">
      <article className="space-y-4 text-sm leading-6 text-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ ...props }) => <h1 className="text-xl font-semibold" {...props} />,
            h2: ({ ...props }) => <h2 className="text-lg font-semibold" {...props} />,
            h3: ({ ...props }) => <h3 className="text-base font-semibold" {...props} />,
            p: ({ ...props }) => <p className="text-sm text-foreground/95" {...props} />,
            ul: ({ ...props }) => <ul className="list-disc space-y-1 pl-5" {...props} />,
            ol: ({ ...props }) => <ol className="list-decimal space-y-1 pl-5" {...props} />,
            li: ({ ...props }) => <li className="text-sm" {...props} />,
            blockquote: ({ ...props }) => (
              <blockquote className="border-l-2 border-border pl-3 text-muted-foreground" {...props} />
            ),
            code: ({ className, children, ...props }) => (
              <code
                className={`rounded bg-muted/60 px-1 py-0.5 text-xs ${className ?? ""}`.trim()}
                {...props}
              >
                {children}
              </code>
            ),
            pre: ({ ...props }) => (
              <pre className="overflow-auto rounded-md border border-border/70 bg-muted/30 p-3 text-xs" {...props} />
            ),
            table: ({ ...props }) => <table className="w-full border-collapse text-xs" {...props} />,
            th: ({ ...props }) => <th className="border border-border/70 px-2 py-1 text-left" {...props} />,
            td: ({ ...props }) => <td className="border border-border/70 px-2 py-1" {...props} />,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
