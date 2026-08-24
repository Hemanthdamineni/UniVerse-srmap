import { isStaticPrototype, requestData } from "./http";
import {
  STATIC_LMS_RESOURCES,
  type LmsGuide,
  type LmsResource,
  type LmsRoadmap,
  type QuestionBankItem,
} from "./resources";

export interface LmsSearchFilters {
  query?: string;
  /** Comma-separated subset of resources,guides,roadmaps,questions */
  types?: string;
  subjectCode?: string;
  type?: string;
  difficulty?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface UnifiedSearchGroup<T> {
  items: T[];
  total: number;
}

export interface UnifiedSearchResponse {
  query: string;
  groups: {
    resources: UnifiedSearchGroup<LmsResource>;
    guides: UnifiedSearchGroup<LmsGuide>;
    roadmaps: UnifiedSearchGroup<LmsRoadmap>;
    questions: UnifiedSearchGroup<QuestionBankItem>;
  };
}

const STATIC_SEARCH_GUIDES: LmsGuide[] = [
  {
    id: "guide-normalization",
    authorId: "AP23110010001",
    title: "Normalization study guide",
    description: "Step-by-step normalization practice for database exams.",
    subjectCode: "CSE301",
    subjectName: "Database Systems",
    semester: "6",
    unit: "Normalization",
    tags: ["dbms", "normalization"],
    published: 1,
    sections: [
      { id: "gsec-1", guideId: "guide-normalization", title: "Introduction", content: "Start from functional dependencies.", position: 1 },
    ],
    upvotes: 4,
    viewCount: 21,
    qualityScore: 3.5,
    createdAt: "2026-05-02T10:00:00.000Z",
    updatedAt: "2026-05-02T10:00:00.000Z",
  } as unknown as LmsGuide,
];

const STATIC_SEARCH_ROADMAPS: LmsRoadmap[] = [
  {
    id: "roadmap-db",
    authorId: "AP23110010001",
    title: "Database engineering path",
    skill: "Database design",
    description: "From ER modelling to index tuning.",
    published: 1,
    nodes: [],
    edges: [],
    upvotes: 6,
    viewCount: 40,
    qualityScore: 4.1,
    createdAt: "2026-04-18T09:00:00.000Z",
  } as unknown as LmsRoadmap,
];

const STATIC_SEARCH_QUESTIONS: QuestionBankItem[] = [
  {
    id: "qb-fts",
    subjectCode: "CSE301",
    question: "Which index type does SQLite use for full-text search?",
    options: ["B-tree", "FTS5 inverted index"],
    correctIndex: 1,
    explanation: "FTS5 maintains an inverted index over tokens.",
    difficulty: "medium",
    upvotes: 3,
    contributedBy: "AP23110010001",
    createdAt: "2026-05-20T12:00:00.000Z",
  },
  {
    id: "qb-acid",
    subjectCode: "CSE301",
    question: "Which ACID property guarantees committed transactions survive crashes?",
    options: ["Atomicity", "Durability"],
    correctIndex: 1,
    explanation: "Durability covers crash survival of committed state.",
    difficulty: "easy",
    upvotes: 5,
    contributedBy: "AP23110010002",
    createdAt: "2026-05-21T12:00:00.000Z",
  },
];

function matchesStaticNeedle(needle: string, ...fields: Array<string | null | undefined>) {
  if (!needle) return true;
  return fields.some((field) => String(field || "").toLowerCase().includes(needle));
}

function staticResourceGroup(filters: LmsSearchFilters): UnifiedSearchGroup<LmsResource> {
  const needle = String(filters.query || "").toLowerCase();
  const subjectCode = String(filters.subjectCode || "").toUpperCase();
  const type = String(filters.type || "");
  const difficulty = String(filters.difficulty || "").toLowerCase();
  const items = STATIC_LMS_RESOURCES.filter((item) => {
    if (subjectCode && item.subjectCode !== subjectCode) return false;
    if (type && item.type !== type) return false;
    if (difficulty && String(item.difficulty || "").toLowerCase() !== difficulty) return false;
    if (!matchesStaticNeedle(needle, item.title, item.description, JSON.stringify(item.tags || []))) return false;
    return item.moderation?.publicEligible !== false;
  });
  return { items, total: items.length };
}

function buildStaticSearchResponse(filters: LmsSearchFilters): UnifiedSearchResponse {
  const needle = String(filters.query || "").toLowerCase();
  return {
    query: String(filters.query || ""),
    groups: {
      resources: staticResourceGroup(filters),
      guides: {
        items: STATIC_SEARCH_GUIDES.filter((guide) =>
          matchesStaticNeedle(needle, guide.title, guide.description, guide.subjectCode)
        ),
        total: STATIC_SEARCH_GUIDES.filter((guide) =>
          matchesStaticNeedle(needle, guide.title, guide.description, guide.subjectCode)
        ).length,
      },
      roadmaps: {
        items: STATIC_SEARCH_ROADMAPS.filter((roadmap) =>
          matchesStaticNeedle(needle, roadmap.title, roadmap.description, roadmap.skill)
        ),
        total: STATIC_SEARCH_ROADMAPS.filter((roadmap) =>
          matchesStaticNeedle(needle, roadmap.title, roadmap.description, roadmap.skill)
        ).length,
      },
      questions: {
        items: STATIC_SEARCH_QUESTIONS.filter(
          (question) =>
            matchesStaticNeedle(needle, question.question, question.explanation) &&
            (!filters.subjectCode ||
              question.subjectCode === String(filters.subjectCode).toUpperCase())
        ),
        total: STATIC_SEARCH_QUESTIONS.filter(
          (question) =>
            matchesStaticNeedle(needle, question.question, question.explanation) &&
            (!filters.subjectCode ||
              question.subjectCode === String(filters.subjectCode).toUpperCase())
        ).length,
      },
    },
  };
}

function appendSearchParam(search: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  search.set(key, String(value));
}

export async function searchLmsContent(filters: LmsSearchFilters = {}): Promise<UnifiedSearchResponse> {
  if (isStaticPrototype()) {
    return buildStaticSearchResponse(filters);
  }
  const search = new URLSearchParams();
  appendSearchParam(search, "query", filters.query);
  appendSearchParam(search, "types", filters.types);
  appendSearchParam(search, "subjectCode", filters.subjectCode);
  appendSearchParam(search, "type", filters.type);
  appendSearchParam(search, "difficulty", filters.difficulty);
  appendSearchParam(search, "sort", filters.sort);
  appendSearchParam(search, "page", filters.page);
  appendSearchParam(search, "limit", filters.limit);
  return requestData<UnifiedSearchResponse>(`/api/lms/search?${search.toString()}`);
}
