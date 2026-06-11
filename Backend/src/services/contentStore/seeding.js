const {
  toSafeString,
  toNullableInteger,
  detectResourceKind,
  looksLikeAbsoluteUrl,
  inferTypeFromPageKey,
  toPageTitle,
} = require("./utils");

const seedingMethods = {
  seedExternalPages(seedData) {
    let inserted = 0;
    for (const [pageKey, payload] of Object.entries(seedData || {})) {
      const id = `external:${pageKey}`;
      if (this.getContent(id)) continue;

      const baseResources = [];

      if (Array.isArray(payload?.resources)) {
        for (const resource of payload.resources) {
          const url = toSafeString(resource?.url_or_path || resource?.url);
          if (!url) continue;
          baseResources.push({
            kind: detectResourceKind(resource),
            title: toSafeString(resource?.title) || "Resource",
            url_or_path: url,
            mime_type: toSafeString(resource?.mime_type || resource?.mimeType) || null,
            size_bytes: toNullableInteger(resource?.size_bytes || resource?.sizeBytes),
          });
        }
      }

      if (Array.isArray(payload?.items)) {
        for (const item of payload.items) {
          const value = toSafeString(item?.value);
          if (!looksLikeAbsoluteUrl(value)) continue;
          baseResources.push({
            kind: "link",
            title: toSafeString(item?.label) || "Reference Link",
            url_or_path: value,
            mime_type: null,
            size_bytes: null,
          });
        }
      }

      this.upsertContent({
        id,
        type: inferTypeFromPageKey(pageKey),
        title: toSafeString(payload?.title) || toPageTitle(pageKey),
        description: toSafeString(payload?.summary),
        category: pageKey,
        startDate: null,
        endDate: null,
        location: "",
        resources: baseResources,
      });
      inserted += 1;
    }
    return inserted;
  },

  seedEvents(events) {
    let inserted = 0;
    for (const event of Array.isArray(events) ? events : []) {
      const id = toSafeString(event?.id);
      if (!id || this.getContent(id)) continue;

      const resources = [];
      for (const attachment of Array.isArray(event?.attachments) ? event.attachments : []) {
        const url = toSafeString(attachment?.url || attachment?.url_or_path);
        if (!url) continue;
        resources.push({
          kind: detectResourceKind(attachment),
          title: toSafeString(attachment?.name || attachment?.title) || "Attachment",
          url_or_path: url,
          mime_type: toSafeString(attachment?.mime_type || attachment?.mimeType) || null,
          size_bytes: toNullableInteger(attachment?.size_bytes || attachment?.sizeBytes),
        });
      }

      const coverImageUrl = toSafeString(event?.coverImageUrl);
      if (coverImageUrl) {
        resources.push({
          kind: "image",
          title: "Cover Image",
          url_or_path: coverImageUrl,
          mime_type: null,
          size_bytes: null,
        });
      }

      this.upsertContent({
        id,
        type: "event",
        title: toSafeString(event?.title) || "Untitled Event",
        description: toSafeString(event?.description),
        category: toSafeString(event?.category),
        startDate: event?.startAt || null,
        endDate: event?.endAt || null,
        location: toSafeString(event?.location?.physical),
        resources,
      });
      inserted += 1;
    }
    return inserted;
  },
};

module.exports = { seedingMethods };
