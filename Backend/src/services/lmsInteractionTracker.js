const { nowIso, randomId } = require("./lmsUtils");

class LmsInteractionTracker {
  constructor({ lmsStore, queue, recommendationEngine }) {
    this.lmsStore = lmsStore;
    this.queue = queue;
    this.recommendationEngine = recommendationEngine;
  }

  async track({ userId, resourceId = null, guideId = null, roadmapId = null, action, timeSpentMs = 0, metadata = {} }) {
    const event = {
      id: randomId("ix"),
      userId,
      resourceId,
      guideId,
      roadmapId,
      action,
      timeSpentMs,
      metadata: JSON.stringify(metadata || {}),
      createdAt: nowIso(),
    };

    await this.queue.enqueue(event);

    if (resourceId) {
      await this.lmsStore.applyInteractionEffects({ userId, resourceId, action, timeSpentMs, metadata });
      if (this.recommendationEngine) {
        await this.recommendationEngine.recordFeedback({ userId, resourceId, action });
      }
    }

    await this.lmsStore.recordActivity(userId);
    return event;
  }
}

module.exports = {
  LmsInteractionTracker,
};
