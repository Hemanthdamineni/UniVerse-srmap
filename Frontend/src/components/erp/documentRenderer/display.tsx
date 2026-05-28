import { Check } from "lucide-react";
import { sanitizeVisibleText } from "../ErpPrimitives";
import type { ErpNode } from "../../../lib/erpApi";
import { readString, type NodeRendererProps } from "./model";

function normalizeComparableText(value: string) {
  return sanitizeVisibleText(value, "")
    .toLowerCase()
    .replace(/[\W_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function rawString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function looksLikeInternalFormTitle(rawTitle: string, displayTitle: string) {
  const normalizedRaw = rawTitle.toLowerCase().replace(/[\s_-]+/g, "");
  const normalizedDisplay = displayTitle.toLowerCase().replace(/[\s_-]+/g, "");

  if (!normalizedRaw && !normalizedDisplay) return false;
  if (normalizedRaw.startsWith("frm") || normalizedDisplay.startsWith("frm")) return true;
  if ((normalizedRaw.startsWith("form") || normalizedDisplay.startsWith("form")) && !displayTitle.includes(" ")) {
    return true;
  }
  return false;
}

export function readDisplayFormTitle(node: ErpNode) {
  const title = readString(node.props.title);
  if (!title) return "";

  const rawTitle = rawString(node.props.title);
  if (looksLikeInternalFormTitle(rawTitle, title)) {
    return "";
  }

  return title;
}

export function isSingleNestedFormWrapper(node: ErpNode) {
  return Array.isArray(node.children) && node.children.length === 1 && node.children[0]?.type === "form";
}

export function looksLikeImplementationDump(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  const codeMarkers =
    normalized.match(
      /(function\s+[a-z0-9_]+\s*\(|\$\(|\$.post\(|\$.ajax\(|document\.getelementbyid|window\.open|serializearray|json\.stringify|closest\(|prop\(|val\(|html\(|css\(|\bvar\s+[a-z0-9_]+\b|\breturn\b|\bif\s*\(|\belse\b|=>|===|!==|\/\*)/gi
    ) || [];
  const symbolHits = (normalized.match(/[{};]/g) || []).length;

  return codeMarkers.length >= 4 || (codeMarkers.length >= 2 && normalized.length > 120) || (codeMarkers.length >= 1 && symbolHits >= 6);
}

const USER_FACING_TEXT_HINT_PATTERN =
  /(note:|not registered|not applicable|open soon|registration closed|registered successfully|completed successfully|allowed only between|please select carefully|helpdesk|feedback not enabled)/i;

const IMPLEMENTATION_FRAGMENT_PATTERN =
  /(thead\s*\{|window\.open|superAlert|dialogHtml|argObject|\$\(|\.focus\s*\(|\.val\s*\(|position\s*:\s*sticky|frmTitle|cmb[A-Z0-9_]+|hdn[A-Z0-9_]+|\.jsp\b|function\s+[a-z0-9_]+\s*\(|\bvar\s+[a-z0-9_]+\b|\breturn\b|\btry\b|\bcatch\b)/i;

export function dedupeAdjacentSegments(segments: string[]) {
  const output: string[] = [];
  segments.forEach((segment) => {
    const normalized = normalizeComparableText(segment);
    if (!normalized) return;
    if (output.length > 0 && normalizeComparableText(output[output.length - 1] || "") === normalized) {
      return;
    }
    output.push(segment);
  });
  return output;
}

export function extractMeaningfulTextFromDump(text: string) {
  const lastBlockEnd = Math.max(text.lastIndexOf("}"), text.lastIndexOf(";"));
  if (lastBlockEnd >= 0 && lastBlockEnd < text.length - 1) {
    const trailingText = sanitizeVisibleText(text.slice(lastBlockEnd + 1), "").trim();
    if (USER_FACING_TEXT_HINT_PATTERN.test(trailingText)) {
      return trailingText;
    }
  }

  const fragments = text
    .replace(/([{};])/g, "$1\n")
    .split("\n")
    .map((fragment) => sanitizeVisibleText(fragment, ""))
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .filter((fragment) => !looksLikeImplementationDump(fragment))
    .filter((fragment) => !IMPLEMENTATION_FRAGMENT_PATTERN.test(fragment))
    .filter((fragment) => !/^(var|function|return|try|catch|if|else)\b/i.test(fragment))
    .filter((fragment) => !/^[.$#@()[\]{}'"`:=,+/*\\-]+$/.test(fragment))
    .filter((fragment) => /[a-z]{3,}/i.test(fragment));

  const extractedText = dedupeAdjacentSegments(fragments).join(" ").trim();
  return IMPLEMENTATION_FRAGMENT_PATTERN.test(extractedText) ? "" : extractedText;
}

export function cleanDisplayMessage(text: string) {
  let cleaned = sanitizeVisibleText(text, "").trim();
  if (!cleaned) return "";

  cleaned = cleaned
    .replace(/\bLoading\.{2,}\s*$/i, "")
    .replace(/\bredirect[a-z0-9_]*\(\)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  cleaned = cleaned.replace(
    /^(Hostel Room Request|Transport Request|Minor Registration|SAP Registration|Attachment Details|Online Payment Acknowledgment|Semester Exam Application Standard Instruction)\s+(?=(Note:|Please\b|You are\b|University\b|School\b|Minor Course\b|SAP\b))/i,
    ""
  );

  cleaned = cleaned.replace(
    /^(SAP Attachments|SAP Details|SAP Feedback|SAP Withdraw)\s+(?=You are|Feedback\b|Not\b)/i,
    ""
  );

  cleaned = cleaned.replace(
    /^University Exam Application Registration\s*-\s*May\s*2026\s+(?=University Exam Registration)/i,
    ""
  );

  cleaned = cleaned.replace(
    /\b(HOSTEL REGISTRATION\s*20\d{2}|TRANSPORT REGISTRATION\s*20\d{2}|SAP REGISTRATION|SAP WITHDRAW|SAP ATTACHMENTS|SAP DETAILS|SAP FEEDBACK|MINOR PROGRAM REGISTRATION)\b\s*$/i,
    ""
  ).trim();

  return cleaned;
}

export function isLowValueStandaloneText(text: string) {
  const normalized = normalizeComparableText(text);
  return /^(course registration|minor registration|minor program registration|exam application details|sap details|sap attachments|sap feedback|sap withdraw|attachment details|transport registration|hostel registration)$/.test(normalized);
}

export function splitMessageForDisplay(text: string) {
  const cleaned = cleanDisplayMessage(text);
  if (!cleaned) return null;
  if (isLowValueStandaloneText(cleaned)) return null;

  const noteMatch = cleaned.match(/^Note:\s*(.+)$/i);
  if (noteMatch) {
    return {
      tone: "info" as const,
      eyebrow: "Note",
      body: noteMatch[1]?.trim() || cleaned,
    };
  }

  if (/not registered|not applicable to you|open soon|registration closed|registered successfully|completed successfully|feedback not enabled/i.test(cleaned)) {
    return {
      tone: /registered successfully|completed successfully/i.test(cleaned)
        ? ("success" as const)
        : /not registered|not applicable|closed|not enabled/i.test(cleaned)
          ? ("danger" as const)
          : ("info" as const),
      eyebrow: /open soon/i.test(cleaned) ? "Update" : "Status",
      body: cleaned,
    };
  }

  if (/allowed only between|please select carefully|helpdesk/i.test(cleaned)) {
    return {
      tone: "info" as const,
      eyebrow: "Details",
      body: cleaned,
    };
  }

  return {
    tone: "plain" as const,
    eyebrow: "",
    body: cleaned,
  };
}

export function noticeToneClasses(tone: string) {
  if (tone === "success") {
    return {
      shell:
        "border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,var(--background)_90%)]",
      eyebrow: "text-[color-mix(in_srgb,var(--success)_72%,var(--comp-text-primary)_28%)]",
      body: "text-[color-mix(in_srgb,var(--success)_70%,var(--comp-text-primary)_30%)]",
    };
  }

  if (tone === "warning") {
    return {
      shell:
        "border-[color-mix(in_srgb,var(--warning)_32%,transparent)] bg-[color-mix(in_srgb,var(--warning)_12%,var(--background)_88%)]",
      eyebrow: "text-[color-mix(in_srgb,var(--warning)_78%,var(--comp-text-primary)_22%)]",
      body: "text-[color-mix(in_srgb,var(--warning)_72%,var(--comp-text-primary)_28%)]",
    };
  }

  if (tone === "danger") {
    return {
      shell:
        "border-[color-mix(in_srgb,var(--error)_30%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,var(--background)_90%)]",
      eyebrow: "text-[color-mix(in_srgb,var(--error)_78%,var(--comp-text-primary)_22%)]",
      body: "text-[color-mix(in_srgb,var(--error)_76%,var(--comp-text-primary)_24%)]",
    };
  }

  return {
    shell:
      "border-[color-mix(in_srgb,var(--border)_60%,transparent)] bg-[color-mix(in_srgb,var(--surface)_82%,transparent)]",
    eyebrow: "text-[var(--comp-text-secondary)]",
    body: "text-[var(--comp-text-primary)]",
  };
}

export function readSapProcessModel(text: string) {
  const cleaned = sanitizeVisibleText(text, "").replace(/\s+/g, " ").trim();
  const match = cleaned.match(
    /(?:^|\b)(SEMESTER ABROAD PROGRAM\s*\(SAP\)\s*PROCESS)\s+1\s+Registration\s+2\s+CV\s+3\s+Confirmation\s+4\s+Completion\b/i
  );

  if (!match) return null;

  return {
    title: "Semester Abroad Program (SAP) Process",
    steps: ["Registration", "CV", "Confirmation", "Completion"],
    activeIndex: 0,
  };
}

export function SapProcessStepper({
  title,
  steps,
  activeIndex,
}: {
  title: string;
  steps: string[];
  activeIndex: number;
}) {
  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--border)_62%,transparent)] bg-[var(--surface)] px-4 py-4 shadow-sm">
      <p data-page-contrast="true" className="page-contrast-fg text-sm font-semibold">
        {title}
      </p>
      <ol className="mt-4 grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;
          return (
            <li
              key={step}
              className={`relative rounded-lg border px-3 py-3 ${
                isActive
                  ? "border-[color-mix(in_srgb,var(--comp-accent)_48%,var(--border))] bg-[color-mix(in_srgb,var(--comp-accent)_10%,var(--surface))]"
                  : "border-[color-mix(in_srgb,var(--border)_65%,transparent)] bg-[color-mix(in_srgb,var(--surface)_74%,transparent)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                    isActive || isComplete
                      ? "border-[var(--comp-accent)] bg-[var(--comp-accent)] text-white"
                      : "border-[color-mix(in_srgb,var(--border)_78%,transparent)] text-[var(--comp-text-secondary)]"
                  }`}
                >
                  {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span data-page-contrast="true" className="page-contrast-fg text-sm font-medium">
                  {step}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function TextRenderer({ node }: NodeRendererProps) {
  const rawText = readString(node.props.text);
  if (!rawText) return null;

  const text = looksLikeImplementationDump(rawText) ? extractMeaningfulTextFromDump(rawText) : rawText;
  const sapProcess = readSapProcessModel(text);
  if (sapProcess) {
    return (
      <SapProcessStepper
        title={sapProcess.title}
        steps={sapProcess.steps}
        activeIndex={sapProcess.activeIndex}
      />
    );
  }

  const parsed = splitMessageForDisplay(text);
  if (!parsed?.body) return null;

  if (parsed.tone === "plain") {
    return <p data-page-contrast="true" className="page-contrast-fg text-sm leading-6">{parsed.body}</p>;
  }

  return <NoticeBlock message={parsed.body} eyebrow={parsed.eyebrow} tone={parsed.tone} />;
}

export function NoticeBlock({ message, eyebrow, tone }: { message: string; eyebrow?: string; tone: string }) {
  const toneClasses = noticeToneClasses(tone);

  return (
    <div
      className={`rounded-lg border px-4 py-4 shadow-sm ${toneClasses.shell}`}
    >
      {eyebrow ? (
        <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${toneClasses.eyebrow}`}>
          {eyebrow}
        </p>
      ) : null}
      <p className={`mt-1 text-sm leading-6 ${toneClasses.body}`}>{message}</p>
    </div>
  );
}
