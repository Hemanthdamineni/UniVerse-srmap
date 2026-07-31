import { readExtractedPage } from "./shared";
import type { TransformerOutput } from "./types";

export function transformTransportRoutes(rawData: unknown) {
  const extracted = readExtractedPage(rawData, "transport/transport-&-faqs", "transport-routes");

  if (!extracted) {
    return { records: [] };
  }

  return {
    records: extracted.records,
  };
}