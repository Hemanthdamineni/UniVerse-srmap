export const RESOURCE_GROUPS = [
  { value: "pyq-mid", label: "PYQ Mid" },
  { value: "pyq-sem", label: "PYQ Semester" },
  { value: "slides", label: "Slides" },
  { value: "notes", label: "Notes" },
  { value: "links", label: "Links" },
  { value: "videos", label: "Videos" },
  { value: "roadmaps", label: "Roadmaps" },
];

export const EMPTY_MATERIAL_FORM = {
  title: "",
  description: "",
  url: "",
  kind: "pdf",
  resourceGroup: "notes",
  visibility: "visible",
  featured: false,
  tags: "",
};

export const EMPTY_RECOMMENDATION_FORM = {
  title: "",
  description: "",
  url: "",
  kind: "link",
  resourceGroup: "links",
};

export function canPreviewResource(url: string, kind: string) {
  const normalizedUrl = String(url || "").toLowerCase();
  const normalizedKind = String(kind || "").toLowerCase();
  return normalizedKind === "pdf" || normalizedUrl.includes("drive.google.com") || normalizedUrl.endsWith(".pdf");
}

export function inferUploadedResourceKind(uploaded: { mimeType: string; fileName: string }) {
  if (uploaded.mimeType.includes("pdf")) return "pdf";
  if (uploaded.mimeType.includes("presentation") || uploaded.fileName.match(/\.(ppt|pptx)$/i)) return "ppt";
  if (uploaded.mimeType.includes("video")) return "video";
  return "link";
}
