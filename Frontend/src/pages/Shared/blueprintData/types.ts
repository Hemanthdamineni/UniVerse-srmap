import type { PageSourceLabel, SectionModel, StatusMessage, KpiItem } from "../../../components/erp/ErpPrimitives";

export interface BlueprintPageState {
  isLoading: boolean;
  error: string | null;
  source: PageSourceLabel;
  updatedAt?: string;
  sections: SectionModel[];
  statuses: StatusMessage[];
  kpis: KpiItem[];
}

export interface KeyLoadResult {
  pageKey: string;
  source: "live" | "dump";
  payload: unknown;
  updatedAt?: string;
}

export interface LeafSection {
  title: string;
  text?: string;
  tables: unknown[];
  externalUrl?: string;
  tableContent?: Record<string, unknown>;
}

export interface ExternalPagePayload {
  title?: string;
  summary?: string;
  items?: Array<{ label?: string; value?: string }>;
  updatedAt?: string;
}
