import type { ContentBulkPreview, ContentHistoryEntry, LearningResourceItem } from "../../../lib/lms/index";
import type { EMPTY_MATERIAL_FORM, EMPTY_RECOMMENDATION_FORM } from "./constants";

export type BannerState = {
  tone: "success" | "warning";
  text: string;
};

export type MaterialFormState = typeof EMPTY_MATERIAL_FORM;
export type RecommendationFormState = typeof EMPTY_RECOMMENDATION_FORM;

export type AdminLearningResourceItem = LearningResourceItem & { createdAt?: string };

export type AdminQueueHandlers = {
  onToggleSelection: (contentId: string) => void;
  onBulkActionChange: (action: string) => void;
  onBulkPreview: () => void;
  onBulkExecute: () => void;
  onEdit: (item: AdminLearningResourceItem) => void;
  onToggleVisibility: (item: AdminLearningResourceItem) => void;
  onLifecycleAction: (contentId: string, action: string) => void;
  onHistory: (contentId: string) => void;
  onDelete: (contentId: string) => void;
};

export type AdminQueueState = {
  selectedAdminIds: string[];
  bulkAction: string;
  bulkPreview: ContentBulkPreview | null;
  historyOpenId: string;
  historyItems: ContentHistoryEntry[];
};
