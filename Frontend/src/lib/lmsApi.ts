import { requestData, requestMultipart } from "./apiClient";

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
  title: string;
  description: string;
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
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  resources?: Array<{
    id: string;
    kind: string;
    title: string;
    urlOrPath: string;
  }>;
  createdAt?: string;
};

export type UploadedResource = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

export async function getLearningMaterialCatalog(year?: number | null) {
  const query = year ? `?year=${encodeURIComponent(String(year))}` : "";
  return requestData<ResourceCatalogResponse>(`/api/resources/catalog${query}`);
}

export async function getLearningMaterialSubjects(year: number, courseCode: string) {
  return requestData<ResourceSubjectResponse>(
    `/api/resources/subjects?year=${encodeURIComponent(String(year))}&courseCode=${encodeURIComponent(courseCode)}`
  );
}

export async function getLearningMaterialLibrary(payload: {
  year: number;
  courseCode: string;
  subjectCode: string;
  query?: string;
}) {
  const params = new URLSearchParams({
    year: String(payload.year),
    courseCode: payload.courseCode,
    subjectCode: payload.subjectCode,
  });
  if (payload.query?.trim()) params.set("query", payload.query.trim());
  return requestData<ResourceLibraryResponse>(`/api/resources/library?${params.toString()}`);
}

export async function listAdminLearningMaterialItems(filters: Record<string, string>, headers?: HeadersInit) {
  const params = new URLSearchParams(filters);
  return requestData<{ items: Array<LearningResourceItem & { createdAt?: string; updatedAt?: string }> }>(
    `/api/resources/admin/items?${params.toString()}`,
    { headers }
  );
}

export async function createLearningMaterialItem(payload: Record<string, unknown>, headers?: HeadersInit) {
  return requestData<LearningResourceItem>("/api/resources/items", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function updateLearningMaterialItem(
  contentId: string,
  payload: Record<string, unknown>,
  headers?: HeadersInit
) {
  return requestData<LearningResourceItem>(`/api/resources/items/${encodeURIComponent(contentId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function deleteLearningMaterialItem(contentId: string, headers?: HeadersInit) {
  return requestData<{ deleted: boolean }>(`/api/resources/items/${encodeURIComponent(contentId)}`, {
    method: "DELETE",
    headers,
  });
}

export async function createResourceRecommendation(payload: Record<string, unknown>) {
  return requestData<ResourceRecommendation>("/api/resources/recommendations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadResourceFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return requestMultipart<UploadedResource>("/api/uploads", form, {
    method: "POST",
  });
}

export async function listResourceRecommendations(headers?: HeadersInit) {
  return requestData<{ items: ResourceRecommendation[] }>("/api/resources/recommendations", {
    headers,
  });
}

export async function reviewResourceRecommendation(
  contentId: string,
  payload: { status: "approved" | "rejected" | "pending"; reviewerNotes?: string },
  headers?: HeadersInit
) {
  return requestData<ResourceRecommendation>(`/api/resources/recommendations/${encodeURIComponent(contentId)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function getLmsProgressOverview() {
  return requestData<{
    completedCredits: number;
    requiredCredits: number;
    currentCgpa: string;
    progressPercent: number;
    semesters: Array<{
      semester: number;
      label: string;
      credits: number;
      sgpa: string;
      status: string;
    }>;
    attendancePct: string;
    subjectsAtRisk: number;
  }>("/api/lms/tracker/overview");
}

export async function getLmsAcademicInsights() {
  return requestData<{
    gpaTrend: Array<{ semester: string; sgpa: number }>;
    categoryPerformance: Array<{
      category: string;
      subjects: number;
      avgGrade: string;
      avgGpa: number;
    }>;
    highlights: Array<{ label: string; value: string }>;
    recommendations: Array<{ title: string; description: string; type: string }>;
    overview: {
      progressPercent: number;
      attendancePct: string;
    };
  }>("/api/lms/tracker/insights");
}

export type LmsPagination = {
  page: number;
  limit: number;
  total?: number;
};

export type LmsTopic = {
  id: string;
  label: string;
  subjectCode?: string | null;
  description?: string | null;
  crossSubjectLinks?: Array<{
    topicId: string;
    subjectCode: string;
    relation: string;
  }>;
};

export type LmsComment = {
  id: string;
  resourceId: string;
  userId: string;
  content: string;
  helpful: number;
  createdAt: string;
  updatedAt?: string | null;
  userHelpful?: boolean;
};

export type LmsAnnotation = {
  id: string;
  userId: string;
  resourceId: string;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
};

export type LmsResource = {
  id: string;
  type: "link" | "file" | "note" | "quiz" | "flashcard" | "pyq";
  title: string;
  description?: string | null;
  difficulty?: string | null;
  semester: string;
  subjectCode: string;
  subjectName: string;
  unit: string;
  unitNormalized: string;
  tags: string[];
  uploadedBy: string;
  uploadedAt: string;
  updatedAt?: string | null;
  url?: string | null;
  filePath?: string | null;
  fileSize?: number | null;
  fileHash?: string | null;
  mimeType?: string | null;
  noteContent?: string | null;
  structuredContent?: Record<string, unknown> | null;
  examYear?: string | null;
  examType?: string | null;
  examMonth?: string | null;
  exportable?: number;
  validForSemester?: string | null;
  estimatedMinutes?: number | null;
  viewCount: number;
  upvotes: number;
  bookmarkCount: number;
  commentCount: number;
  qualityScore: number;
  effectivenessScore: number;
  examProvenScore: number;
  renderType?: string | null;
  outdatedCount?: number;
  isOutdated?: number;
  flagCount?: number;
  moderationState?: number;
  verified?: number;
  userUpvoted?: boolean;
  userBookmarked?: boolean;
  userMarkedOutdated?: boolean;
  userRating?: {
    rating: number;
    review?: string | null;
    dimensionTags?: string[];
  } | null;
  comments?: LmsComment[];
  annotations?: LmsAnnotation[];
  related?: LmsResource[];
  topics?: LmsTopic[];
};

export type LmsGuideSection = {
  id: string;
  guideId: string;
  title: string;
  content: string;
  position: number;
};

export type LmsGuide = {
  id: string;
  title: string;
  description?: string | null;
  authorId: string;
  subjectCode: string;
  subjectName: string;
  semester: string;
  unit: string;
  unitNormalized: string;
  tags: string[];
  difficulty?: string | null;
  viewCount: number;
  upvotes: number;
  qualityScore: number;
  exportable: number;
  published: number;
  sections: LmsGuideSection[];
  userProgress?: {
    readSections: string[];
    startedAt: string;
    updatedAt: string;
  } | null;
  userUpvoted?: boolean;
};

export type LmsRoadmapNode = {
  id: string;
  roadmapId: string;
  title: string;
  description?: string | null;
  nodeType: "concept" | "resource" | "quiz" | "milestone";
  resourceId?: string | null;
  position: number;
  isOptional: number;
};

export type LmsRoadmap = {
  id: string;
  title: string;
  description?: string | null;
  skill: string;
  authorId: string;
  difficulty?: string | null;
  estimatedHours?: number | null;
  viewCount: number;
  upvotes: number;
  qualityScore: number;
  published: number;
  nodes: LmsRoadmapNode[];
  edges: Array<{ roadmapId: string; fromNodeId: string; toNodeId: string }>;
  userProgress?: {
    completedNodes: string[];
    startedAt: string;
    updatedAt: string;
  } | null;
};

export type LmsRequest = {
  id: string;
  userId: string;
  subjectCode: string;
  subjectName: string;
  semester: string;
  unit?: string | null;
  title: string;
  description?: string | null;
  resourceType?: string | null;
  status: string;
  fulfilledBy?: string | null;
  fulfilledResourceId?: string | null;
  upvotes: number;
  createdAt: string;
  updatedAt?: string | null;
};

export type LmsCollection = {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  isPublic: number;
  createdAt: string;
  items?: LmsResource[];
};

function appendValue(formData: FormData, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  if (value instanceof File) {
    formData.append(key, value);
    return;
  }
  if (typeof value === "object") {
    formData.append(key, JSON.stringify(value));
    return;
  }
  formData.append(key, String(value));
}

function buildMultipartForm(values: Record<string, unknown>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    appendValue(formData, key, value);
  }
  return formData;
}

export async function listLmsResources(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return requestData<{ items: LmsResource[]; pagination: LmsPagination }>(`/api/lms/resources?${search.toString()}`);
}

export async function getLmsResource(id: string) {
  return requestData<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}`);
}

export async function createLmsResource(payload: Record<string, unknown>) {
  const hasFile = payload.file instanceof File;
  if (hasFile) {
    return requestMultipart<LmsResource>("/api/lms/resources", buildMultipartForm(payload));
  }
  return requestData<LmsResource>("/api/lms/resources", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateLmsResource(id: string, payload: Record<string, unknown>) {
  const hasFile = payload.file instanceof File;
  if (hasFile) {
    return requestMultipart<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}`, buildMultipartForm(payload), {
      method: "PUT",
    });
  }
  return requestData<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteLmsResource(id: string) {
  return requestData<{ deleted: boolean; id: string }>(`/api/lms/resources/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function restoreLmsResource(id: string) {
  return requestData<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
}

export async function checkLmsDuplicate(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ exact: LmsResource | null; similar: LmsResource[]; hasDuplicate: boolean }>(
    `/api/lms/resources/check-duplicate?${search.toString()}`
  );
}

export async function toggleResourceUpvote(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/resources/${encodeURIComponent(id)}/upvote`, {
    method: "POST",
  });
}

export async function toggleResourceBookmark(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/resources/${encodeURIComponent(id)}/bookmark`, {
    method: "POST",
  });
}

export async function flagLmsResource(id: string, reason: string) {
  return requestData(`/api/lms/resources/${encodeURIComponent(id)}/flag`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function markLmsResourceOutdated(id: string, reason: string) {
  return requestData(`/api/lms/resources/${encodeURIComponent(id)}/mark-outdated`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function rateLmsResource(id: string, payload: { rating: number; review?: string; dimensionTags?: string[] }) {
  return requestData<LmsResource>(`/api/lms/resources/${encodeURIComponent(id)}/rate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function recordLmsResourceView(id: string, payload: { timeSpentMs?: number; metadata?: Record<string, unknown> } = {}) {
  return requestData(`/api/lms/resources/${encodeURIComponent(id)}/view`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLmsComments(id: string) {
  return requestData<LmsComment[]>(`/api/lms/resources/${encodeURIComponent(id)}/comments`);
}

export async function postLmsComment(id: string, content: string) {
  return requestData<LmsComment[]>(`/api/lms/resources/${encodeURIComponent(id)}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function toggleCommentHelpful(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/comments/${encodeURIComponent(id)}/helpful`, {
    method: "POST",
  });
}

export async function getLmsAnnotations(resourceId: string) {
  return requestData<LmsAnnotation[]>(`/api/lms/resources/${encodeURIComponent(resourceId)}/annotations`);
}

export async function saveLmsAnnotation(resourceId: string, content: string) {
  return requestData<LmsAnnotation[]>(`/api/lms/resources/${encodeURIComponent(resourceId)}/annotations`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function deleteLmsAnnotation(id: string) {
  return requestData<{ deleted: boolean; id: string }>(`/api/lms/annotations/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getPyqBank(subjectCode: string, params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ items: LmsResource[]; pagination: LmsPagination }>(
    `/api/lms/pyq/${encodeURIComponent(subjectCode)}?${search.toString()}`
  );
}

export async function getUpcomingPyqs() {
  return requestData<LmsResource[]>("/api/lms/pyq/upcoming");
}

export async function listLmsRequests(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ items: LmsRequest[]; pagination: LmsPagination }>(`/api/lms/requests?${search.toString()}`);
}

export async function createLmsRequest(payload: Record<string, unknown>) {
  return requestData<LmsRequest>("/api/lms/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function upvoteLmsRequest(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/requests/${encodeURIComponent(id)}/upvote`, {
    method: "POST",
  });
}

export async function fulfillLmsRequest(id: string, resourceId: string) {
  return requestData<LmsRequest>(`/api/lms/requests/${encodeURIComponent(id)}/fulfill`, {
    method: "POST",
    body: JSON.stringify({ resourceId }),
  });
}

export async function closeLmsRequest(id: string) {
  return requestData<LmsRequest>(`/api/lms/requests/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function getPendingExamFeedback() {
  return requestData<LmsResource[]>("/api/lms/exam-feedback/pending");
}

export async function submitExamFeedback(feedbackItems: Array<{ resourceId: string; helpful: boolean }>) {
  return requestData<{ submitted: number }>("/api/lms/exam-feedback", {
    method: "POST",
    body: JSON.stringify({ feedbackItems }),
  });
}

export async function submitQuizAttempt(resourceId: string, payload: Record<string, unknown>) {
  return requestData(`/api/lms/resources/${encodeURIComponent(resourceId)}/quiz-attempt`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getQuizAttempts(resourceId: string) {
  return requestData<Array<Record<string, unknown>>>(`/api/lms/resources/${encodeURIComponent(resourceId)}/quiz-attempts`);
}

export async function listQuestionBank(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ items: Array<Record<string, unknown>>; pagination: LmsPagination }>(
    `/api/lms/question-bank?${search.toString()}`
  );
}

export async function createQuestionBankItem(payload: Record<string, unknown>) {
  return requestData<Record<string, unknown>>("/api/lms/question-bank", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function upvoteQuestionBankItem(id: string) {
  return requestData<Record<string, unknown>>(`/api/lms/question-bank/${encodeURIComponent(id)}/upvote`, {
    method: "POST",
  });
}

export async function buildQuizFromQuestionBank(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<{ questions: Array<Record<string, unknown>>; count: number }>(
    `/api/lms/question-bank/build-quiz?${search.toString()}`
  );
}

export async function listLmsCollections() {
  return requestData<LmsCollection[]>("/api/lms/collections");
}

export async function createLmsCollection(payload: Record<string, unknown>) {
  return requestData<LmsCollection>("/api/lms/collections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLmsCollection(id: string) {
  return requestData<LmsCollection>(`/api/lms/collections/${encodeURIComponent(id)}`);
}

export async function addToLmsCollection(id: string, resourceId: string) {
  return requestData<LmsCollection>(`/api/lms/collections/${encodeURIComponent(id)}/items`, {
    method: "POST",
    body: JSON.stringify({ resourceId }),
  });
}

export async function removeFromLmsCollection(id: string, resourceId: string) {
  return requestData<LmsCollection>(`/api/lms/collections/${encodeURIComponent(id)}/items/${encodeURIComponent(resourceId)}`, {
    method: "DELETE",
  });
}

export async function listGuides(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<LmsGuide[]>(`/api/lms/guides?${search.toString()}`);
}

export async function createGuide(payload: Record<string, unknown>) {
  return requestData<LmsGuide>("/api/lms/guides", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getGuide(id: string) {
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(id)}`);
}

export async function updateGuide(id: string, payload: Record<string, unknown>) {
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteGuide(id: string) {
  return requestData<{ deleted: boolean; id: string }>(`/api/lms/guides/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function addGuideSection(id: string, payload: Record<string, unknown>) {
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(id)}/sections`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateGuideSection(guideId: string, sectionId: string, payload: Record<string, unknown>) {
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(guideId)}/sections/${encodeURIComponent(sectionId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function markGuideSectionRead(guideId: string, sectionId: string) {
  return requestData<LmsGuide>(`/api/lms/guides/${encodeURIComponent(guideId)}/sections/${encodeURIComponent(sectionId)}/read`, {
    method: "POST",
  });
}

export async function toggleGuideUpvote(id: string) {
  return requestData<{ active: boolean }>(`/api/lms/guides/${encodeURIComponent(id)}/upvote`, {
    method: "POST",
  });
}

export async function listRoadmaps(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<LmsRoadmap[]>(`/api/lms/roadmaps?${search.toString()}`);
}

export async function createRoadmap(payload: Record<string, unknown>) {
  return requestData<LmsRoadmap>("/api/lms/roadmaps", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRoadmap(id: string) {
  return requestData<LmsRoadmap>(`/api/lms/roadmaps/${encodeURIComponent(id)}`);
}

export async function deleteRoadmap(id: string) {
  return requestData<{ deleted: boolean; id: string }>(`/api/lms/roadmaps/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function addRoadmapNode(id: string, payload: Record<string, unknown>) {
  return requestData<LmsRoadmap>(`/api/lms/roadmaps/${encodeURIComponent(id)}/nodes`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addRoadmapEdge(id: string, payload: Record<string, unknown>) {
  return requestData<LmsRoadmap>(`/api/lms/roadmaps/${encodeURIComponent(id)}/edges`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completeRoadmapNode(roadmapId: string, nodeId: string) {
  return requestData<LmsRoadmap>(`/api/lms/roadmaps/${encodeURIComponent(roadmapId)}/nodes/${encodeURIComponent(nodeId)}/complete`, {
    method: "POST",
  });
}

export async function getRecommendations(params: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  return requestData<LmsResource[]>(`/api/lms/recommendations?${search.toString()}`);
}

export async function getNextStepRecommendation(resourceId: string) {
  return requestData<LmsResource[]>(`/api/lms/recommendations/next-step?resourceId=${encodeURIComponent(resourceId)}`);
}

export async function getExploreData() {
  return requestData<{
    trending: LmsResource[];
    topRated: LmsResource[];
    examReady: LmsResource[];
  }>("/api/lms/explore");
}

export async function getSubjectOverview(subjectCode: string) {
  return requestData<Record<string, unknown>>(`/api/lms/subjects/${encodeURIComponent(subjectCode)}/overview`);
}

export async function getSubjectPresence(subjectCode: string) {
  return requestData<{ subjectCode: string; count: number }>(`/api/lms/subjects/${encodeURIComponent(subjectCode)}/presence`);
}

export async function getTopicGraph(subjectCode: string) {
  return requestData<Record<string, unknown>>(`/api/lms/topics/graph?subjectCode=${encodeURIComponent(subjectCode)}`);
}

export async function getWeeklyLeaderboard() {
  return requestData<Array<Record<string, unknown>>>("/api/lms/leaderboard/weekly");
}

export async function getLmsProgress() {
  return requestData<Record<string, unknown>>("/api/lms/progress");
}

export async function getLmsProgressForSubject(subjectCode: string) {
  return requestData<Array<Record<string, unknown>>>(`/api/lms/progress/${encodeURIComponent(subjectCode)}`);
}

export async function getLmsMastery() {
  return requestData<Array<Record<string, unknown>>>("/api/lms/mastery");
}

export async function getContinueLearning() {
  return requestData<LmsResource | null>("/api/lms/continue");
}

export async function getRevisionQueue() {
  return requestData<Array<Record<string, unknown>>>("/api/lms/revision");
}

export async function submitRevisionReview(resourceId: string, score: number) {
  return requestData<Array<Record<string, unknown>>>(`/api/lms/revision/${encodeURIComponent(resourceId)}/review`, {
    method: "POST",
    body: JSON.stringify({ score }),
  });
}

export async function getLmsStreak() {
  return requestData<Record<string, unknown>>("/api/lms/streak");
}

export async function generateLearningSession(durationMinutes: number) {
  return requestData<Record<string, unknown>>("/api/lms/session/generate", {
    method: "POST",
    body: JSON.stringify({ durationMinutes }),
  });
}

export async function getMyContributions() {
  return requestData<Record<string, unknown>>("/api/lms/me/contributions");
}

export async function getMyBookmarks() {
  return requestData<LmsResource[]>("/api/lms/me/bookmarks");
}

export async function getMyActivity() {
  return requestData<Array<Record<string, unknown>>>("/api/lms/me/activity");
}

export async function getMyLmsRequests() {
  return requestData<LmsRequest[]>("/api/lms/me/requests");
}

export async function updateMyLmsPreferences(payload: Record<string, unknown>) {
  return requestData<Record<string, unknown>>("/api/lms/me/preferences", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getContributorProfile(userId: string) {
  return requestData<Record<string, unknown>>(`/api/lms/contributors/${encodeURIComponent(userId)}`);
}
