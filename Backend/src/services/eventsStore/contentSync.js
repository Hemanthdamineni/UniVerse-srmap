const { ensureArray } = require("./utils");

module.exports = {
  _toContentResource(resource, fallbackTitle = "Resource") {
    const url = String(resource?.url || resource?.url_or_path || "").trim();
    if (!url) return null;

    const kindFromInput = String(resource?.kind || "").trim().toLowerCase();
    const allowedKinds = new Set(["pdf", "ppt", "image", "video", "link", "doc"]);
    let kind = allowedKinds.has(kindFromInput) ? kindFromInput : "link";

    if (!allowedKinds.has(kindFromInput)) {
      const lower = url.toLowerCase();
      if (lower.endsWith(".pdf")) kind = "pdf";
      else if (lower.endsWith(".ppt") || lower.endsWith(".pptx")) kind = "ppt";
      else if (/\.(png|jpg|jpeg|gif|webp|svg)(\?|$)/.test(lower)) kind = "image";
      else if (/\.(mp4|mov|webm|mkv)(\?|$)/.test(lower)) kind = "video";
      else if (/\.(doc|docx|rtf)(\?|$)/.test(lower)) kind = "doc";
    }

    return {
      kind,
      title: String(resource?.title || resource?.name || fallbackTitle || "Resource").trim() || "Resource",
      url_or_path: url,
      mime_type: resource?.mime_type || resource?.mimeType || null,
      size_bytes: Number.isFinite(Number(resource?.size_bytes || resource?.sizeBytes))
        ? Math.floor(Number(resource?.size_bytes || resource?.sizeBytes))
        : null,
    };
  },

  _buildEventContentResources(event) {
    const resources = [];

    for (const attachment of ensureArray(event.attachments)) {
      const normalized = this._toContentResource(attachment, "Attachment");
      if (normalized) resources.push(normalized);
    }

    if (String(event.coverImageUrl || "").trim()) {
      resources.push({
        kind: "image",
        title: "Cover Image",
        url_or_path: String(event.coverImageUrl).trim(),
        mime_type: null,
        size_bytes: null,
      });
    }

    const gallery = this.gallery.filter((item) => item.eventId === event.id);
    for (const photo of gallery) {
      const normalized = this._toContentResource(
        { kind: "image", title: photo.caption || "Gallery Photo", url: photo.url },
        "Gallery Photo"
      );
      if (normalized) resources.push(normalized);
    }

    return resources;
  },

  _syncEventToContent(event) {
    if (!this.contentStore) return;
    try {
      this.contentStore.upsertContent({
        id: event.id,
        type: "event",
        title: String(event.title || "").trim() || "Untitled Event",
        description: String(event.description || ""),
        category: String(event.category || ""),
        startDate: event.startAt || null,
        endDate: event.endAt || null,
        location: String(event.location?.physical || ""),
        resources: this._buildEventContentResources(event),
      });
    } catch (_error) {
      // Keep events workflow resilient even if unified content sync fails.
    }
  },

  _removeEventsFromContent(eventIds) {
    if (!this.contentStore) return;
    for (const eventId of eventIds) {
      try {
        this.contentStore.deleteContentIfExists(eventId);
      } catch (_error) {
        // Ignore sync cleanup errors.
      }
    }
  }
};
