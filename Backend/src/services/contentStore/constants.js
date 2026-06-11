const CONTENT_TYPES = new Set(["event", "learning_material", "announcement", "page"]);
const RESOURCE_KINDS = new Set(["pdf", "ppt", "image", "video", "link", "doc"]);
const LEARNING_MATERIAL_GROUPS = new Set(["pyq-mid", "pyq-sem", "slides", "notes", "links", "videos", "roadmaps"]);
const CONTENT_LIFECYCLE_STATES = new Set(["draft", "review", "published", "unpublished", "archived", "deleted"]);
const CONTENT_TRANSITIONS = {
  submit_review: { from: ["draft", "unpublished"], to: "review", label: "Submit for review" },
  publish: { from: ["draft", "review", "unpublished", "archived"], to: "published", label: "Publish" },
  unpublish: { from: ["published", "review"], to: "unpublished", label: "Unpublish" },
  archive: { from: ["published", "unpublished", "review", "draft"], to: "archived", label: "Archive" },
  delete: { from: ["draft", "review", "published", "unpublished", "archived"], to: "deleted", label: "Delete" },
  restore: { from: ["deleted", "archived"], to: "published", label: "Restore" },
};
const LEARNING_MATERIAL_GROUP_LABELS = {
  "pyq-mid": "PYQ Mid",
  "pyq-sem": "PYQ Semester",
  slides: "Slides",
  notes: "Notes",
  links: "Links",
  videos: "Videos",
  roadmaps: "Roadmaps",
};

module.exports = {
  CONTENT_TYPES,
  RESOURCE_KINDS,
  LEARNING_MATERIAL_GROUPS,
  CONTENT_LIFECYCLE_STATES,
  CONTENT_TRANSITIONS,
  LEARNING_MATERIAL_GROUP_LABELS,
};
