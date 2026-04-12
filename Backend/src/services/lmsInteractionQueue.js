const { LMS_QUEUE_BATCH_SIZE, LMS_QUEUE_FLUSH_MS, LMS_QUEUE_MAX_RETRIES } = require("../config/env");
const { randomId } = require("./lmsUtils");

class LmsInteractionQueue {
  constructor({ lmsStore, flushMs = LMS_QUEUE_FLUSH_MS, batchSize = LMS_QUEUE_BATCH_SIZE, maxRetries = LMS_QUEUE_MAX_RETRIES }) {
    this.lmsStore = lmsStore;
    this.flushMs = flushMs;
    this.batchSize = batchSize;
    this.maxRetries = maxRetries;
    this.pending = [];
    this.deadLetters = [];
    this.timer = setInterval(() => {
      this.flush().catch(() => {
        // Flush errors are handled per batch item retry state.
      });
    }, this.flushMs);
    this.timer.unref?.();
  }

  enqueue(event) {
    this.pending.push({ ...event, _retryCount: Number(event?._retryCount || 0) });
    if (this.pending.length >= this.batchSize) {
      return this.flush();
    }
    return Promise.resolve();
  }

  async flush() {
    if (!this.pending.length) return 0;
    const batch = this.pending.splice(0, this.batchSize);
    try {
      await this.lmsStore.insertInteractionBatch(batch);
      return batch.length;
    } catch (error) {
      for (const event of batch) {
        const nextRetryCount = Number(event._retryCount || 0) + 1;
        if (nextRetryCount > this.maxRetries) {
          this.deadLetters.push({
            id: randomId("dead"),
            failedAt: new Date().toISOString(),
            error: error?.message || "Queue flush failed",
            event,
          });
          continue;
        }
        this.pending.unshift({ ...event, _retryCount: nextRetryCount });
      }
      throw error;
    }
  }

  getHealth() {
    return {
      pendingCount: this.pending.length,
      deadLetterCount: this.deadLetters.length,
      flushMs: this.flushMs,
      batchSize: this.batchSize,
    };
  }

  stop() {
    clearInterval(this.timer);
  }
}

module.exports = {
  LmsInteractionQueue,
};
