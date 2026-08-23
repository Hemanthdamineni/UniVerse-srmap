import { cn } from "../../lib/core/utils";
import { Check, Copy } from "lucide-react";
import {
  createContext,
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Shimmer } from "./Shimmer";
import { highlight, isHighlightable, type HighlightedNode } from "./highlight";

// True while the parent surface is still streaming content in. We hide
// fenced-code contents during this phase: parsing partial code is wasted
// work and a shimmering placeholder is calmer UI than text that grows
// char-by-char.
const StreamingCtx = createContext(false);
export const ChatStreamingProvider = StreamingCtx.Provider;

const POSIX_SHELL = new Set([
  "bash",
  "sh",
  "zsh",
  "shell",
  "console",
  "shellscript",
]);
const WINDOWS_SHELL = new Set([
  "powershell",
  "pwsh",
  "ps1",
  "ps",
  "cmd",
  "bat",
  "batch",
]);
const SHELL_LANGS = new Set([...POSIX_SHELL, ...WINDOWS_SHELL]);

function shellPrompt(lang: string): string {
  if (WINDOWS_SHELL.has(lang))
    return lang === "cmd" || lang === "bat" || lang === "batch" ? ">" : "PS>";
  return "$";
}

function normalizeLangLabel(raw: string): string {
  const lower = raw.toLowerCase();
  if (POSIX_SHELL.has(lower)) return "bash";
  if (lower === "pwsh" || lower === "ps1" || lower === "ps") return "powershell";
  if (lower === "bat" || lower === "batch") return "cmd";
  return lower || "text";
}

export type CodeBlockProps = {
  code: string;
  lang: string | null;
};

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const streaming = useContext(StreamingCtx);
  const label = normalizeLangLabel(lang ?? "");

  if (streaming) {
    return <GeneratingPlaceholder label={label} />;
  }

  if (SHELL_LANGS.has(label)) {
    return <CommandCard code={code} lang={label} />;
  }

  return <FinalizedCodeBlock code={code} lang={label} />;
}

function GeneratingPlaceholder({ label }: { label: string }) {
  return (
    <div className="not-prose my-2 flex items-center gap-2 rounded-lg border border-[var(--comp-border)] bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
      <span className="inline-block size-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
      <Shimmer duration={1.2}>
        {label === "text" ? "Generating code…" : `Generating ${label}…`}
      </Shimmer>
    </div>
  );
}

function BlockChrome({
  label,
  code,
  children,
}: {
  label: string;
  code: string;
  children: ReactNode;
}) {
  return (
    <div className="not-prose my-3 overflow-hidden rounded-xl border border-[var(--comp-border)] bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b border-[color-mix(in_srgb,var(--comp-border)_60%,transparent)] bg-muted/20 px-3 py-1">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <CopyButton text={code} />
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function FinalizedCodeBlock({ code, lang }: { code: string; lang: string }) {
  if (!isHighlightable(lang)) {
    return (
      <BlockChrome label={lang} code={code}>
        <pre className="m-0 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-foreground">
          {code}
        </pre>
      </BlockChrome>
    );
  }
  return (
    <BlockChrome label={lang} code={code}>
      <HighlightedPre code={code} lang={lang} />
    </BlockChrome>
  );
}

const HighlightedPre = memo(function HighlightedPre({
  code,
  lang,
}: {
  code: string;
  lang: string;
}) {
  const [nodes, setNodes] = useState<HighlightedNode[] | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    let cancelled = false;
    highlight(code, lang)
      .then((result) => {
        if (cancelled || cancelRef.current) return;
        setNodes(result);
      })
      .catch(() => {
        if (cancelled) return;
        setNodes(null);
      });
    return () => {
      cancelled = true;
      cancelRef.current = true;
    };
  }, [code, lang]);

  if (!nodes) {
    return (
      <pre className="m-0 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-foreground">
        {code}
      </pre>
    );
  }

  return (
    <pre className="m-0 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-foreground">
      {nodes.map((node, i) =>
        node.kind === "break" ? (
          <span key={i}>{"\n"}</span>
        ) : (
          <span key={i} className={node.cls || undefined}>
            {node.value}
          </span>
        ),
      )}
    </pre>
  );
});

function CommandCard({ code, lang }: { code: string; lang: string }) {
  const isMultiline = code.includes("\n");
  const prompt = shellPrompt(lang);
  return (
    <div className="not-prose my-3 overflow-hidden rounded-xl border border-[var(--comp-border)] bg-muted/40">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {normalizeLangLabel(lang)}
        </span>
        <CopyButton text={code} />
      </div>
      <div className="border-t border-[color-mix(in_srgb,var(--comp-border)_60%,transparent)] bg-background/40">
        <pre
          className={cn(
            "m-0 overflow-x-auto px-3 py-2 font-mono text-[12.5px] leading-relaxed text-foreground",
            isMultiline ? "whitespace-pre" : "whitespace-pre-wrap",
          )}
        >
          {code.split("\n").map((line, i) => (
            <span key={i} className="flex">
              <span className="mr-2 select-none text-[var(--accent-blue)] opacity-70">
                {prompt}
              </span>
              <span>{line}</span>
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const tRef = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(tRef.current), []);

  const onCopy = async () => {
    if (!navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      tRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — nothing to do */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="Copy code"
      title="Copy code"
      className={cn(
        "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--comp-text-secondary)] transition-colors hover:bg-[var(--comp-surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]",
        className,
      )}
    >
      {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={2} />}
    </button>
  );
}
