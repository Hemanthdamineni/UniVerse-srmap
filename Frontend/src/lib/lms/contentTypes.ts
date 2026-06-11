export type ResourceCatalogCourse = {
  year: number | null;
  courseCode: string;
  courseName: string;
  subjectCount: number;
  resourceCount: number;
};

export type ResourceCatalogResponse = {
  years: number[];
  selectedYear: number | null;
  courses: ResourceCatalogCourse[];
};

export type ResourceSubjectResponse = {
  year: number;
  courseCode: string;
  subjects: Array<{
    subjectCode: string;
    subjectName: string;
    semester: number | null;
    groups: string[];
    resourceCount: number;
  }>;
};

export type LearningResourceItem = {
  id: string;
  type?: string;
  title: string;
  description: string;
  category?: string;
  lifecycleState?: string;
  version?: number;
  deletedAt?: string | null;
  lastActor?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  resources: Array<{
    id: string;
    contentId: string;
    kind: string;
    title: string;
    urlOrPath: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    createdAt?: string;
  }>;
};

export type ResourceLibraryResponse = {
  subject: {
    year: number;
    courseCode: string;
    courseName: string;
    subjectCode: string;
    subjectName: string;
    semester: number | null;
  };
  groups: Array<{
    group: string;
    label: string;
    items: LearningResourceItem[];
  }>;
  totalItems: number;
  totalResources: number;
};

export type ResourceRecommendation = {
  id: string;
  type?: string;
  title: string;
  description: string;
  lifecycleState?: string;
  version?: number;
  metadata?: Record<string, unknown>;
  resources?: Array<{
    id: string;
    kind: string;
    title: string;
    urlOrPath: string;
  }>;
  createdAt?: string;
};

export type ContentWorkflowSpec = {
  states: string[];
  transitions: Array<{
    action: string;
    label: string;
    from: string[];
    to: string;
    requiresReason?: boolean;
  }>;
  permissions: Record<string, string[]>;
  bulkSafety: {
    previewRequired: boolean;
    maxItems: number;
    rollback: string;
  };
};

export type ContentHistoryEntry = {
  id: string;
  contentId: string;
  action: string;
  actorId: string;
  actorRole: string;
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, { before: unknown; after: unknown }>;
  createdAt: string;
};

export type ContentBulkPreview = {
  action: string;
  valid: boolean;
  invalidCount: number;
  items: Array<{
    id: string;
    title?: string;
    type?: string;
    currentState?: string;
    nextState?: string;
    valid: boolean;
    reason?: string;
  }>;
};

export type UploadedResource = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};
