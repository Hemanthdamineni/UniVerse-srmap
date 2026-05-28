import { isStaticPrototype } from "./staticPrototypeEnv";

const FIXTURE_URL = "fixtures/erp-batch.json";

type StaticErpNodeType = "container" | "text" | "table" | "form" | "field" | "button";

type StaticErpNode = {
  id: string;
  type: StaticErpNodeType;
  props: Record<string, unknown>;
  children: StaticErpNode[];
};

type StaticErpDocument = {
  title: string;
  root: StaticErpNode;
};

type StaticErpPageResponse = {
  success?: boolean;
  pageKey: string;
  source?: string;
  fetchedAt?: string;
  staleAt?: string | null;
  policyMode?: string;
  warnings?: string[];
  meta?: {
    normalizationRules?: string[];
    issues?: Array<{ sectionKey?: string; tableIndex?: number; message?: string }>;
    targets?: Array<{ dropdown?: string; subitem?: string }>;
  };
  data: unknown;
  document?: StaticErpDocument;
};

type StaticErpPageFailure = {
  success: false;
  pageKey: string;
  error: string;
  status: number;
  code: string;
};

type StaticErpBatchPageResult = StaticErpPageResponse | StaticErpPageFailure;
type StaticErpBatchResponse = Record<string, StaticErpBatchPageResult>;

let cachedFixtures: StaticErpBatchResponse | null = null;
let cacheFailed = false;

function fixtureBase(): string {
  const base = import.meta.env.BASE_URL || "/";
  if (base.endsWith("/")) return base;
  return `${base}/`;
}

/** Minimal successful page used when a key has no fixture entry. */
export function minimalStaticErpPageResponse(pageKey: string): StaticErpPageResponse {
  return {
    success: true,
    pageKey,
    source: "static-prototype",
    fetchedAt: new Date().toISOString(),
    data: {
      Overview: {
        text: `No fixture for "${pageKey}". Add this key to public/fixtures/erp-batch.json (see StaticHost/README.md).`,
      },
    },
  };
}

async function loadFixtureFile(): Promise<StaticErpBatchResponse> {
  if (cachedFixtures) return cachedFixtures;
  if (cacheFailed) return {};

  try {
    const res = await fetch(`${fixtureBase()}${FIXTURE_URL}`, { credentials: "same-origin" });
    if (!res.ok) {
      cacheFailed = true;
      return {};
    }
    const body = (await res.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      cacheFailed = true;
      return {};
    }
    cachedFixtures = body as StaticErpBatchResponse;
    return cachedFixtures;
  } catch {
    cacheFailed = true;
    return {};
  }
}

function isErpPageResponse(value: unknown): value is StaticErpPageResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as StaticErpPageResponse;
  return typeof v.pageKey === "string" && "data" in v;
}

function isErpPageFailure(value: unknown): value is StaticErpPageFailure {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.success === false && typeof v.pageKey === "string" && typeof v.error === "string";
}

/**
 * Merge batch fixture JSON with fallbacks for missing keys.
 */
export async function resolveStaticErpBatch(pageKeys: string[]): Promise<StaticErpBatchResponse> {
  if (!isStaticPrototype()) return {};

  const fromFile = await loadFixtureFile();
  const out: StaticErpBatchResponse = {};

  for (const key of pageKeys) {
    const raw = fromFile[key];
    if (isErpPageFailure(raw) || isErpPageResponse(raw)) {
      out[key] = raw as StaticErpBatchPageResult;
    } else {
      out[key] = minimalStaticErpPageResponse(key);
    }
  }

  return out;
}

export async function loadStaticErpSupplementalJson<T extends Record<string, unknown>>(
  fileName: string
): Promise<T | null> {
  if (!isStaticPrototype()) return null;
  try {
    const res = await fetch(`${fixtureBase()}fixtures/${fileName}`, { credentials: "same-origin" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
