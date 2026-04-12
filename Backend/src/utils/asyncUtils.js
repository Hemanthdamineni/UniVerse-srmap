class Semaphore {
  constructor(maxConcurrent = 10) {
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 1);
    this.current = 0;
    this.queue = [];
  }

  async acquire(timeoutMs = 1000) {
    if (this.current < this.maxConcurrent) {
      this.current += 1;
      return () => this.release();
    }

    return new Promise((resolve, reject) => {
      const item = {
        resolve: () => {
          this.current += 1;
          resolve(() => this.release());
        },
        reject,
      };

      let timer = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          const index = this.queue.indexOf(item);
          if (index >= 0) this.queue.splice(index, 1);
          const error = new Error("Upstream concurrency limit exceeded");
          error.status = 503;
          reject(error);
        }, timeoutMs);
      }

      item.resolve = () => {
        if (timer) clearTimeout(timer);
        this.current += 1;
        resolve(() => this.release());
      };

      this.queue.push(item);
    });
  }

  release() {
    this.current = Math.max(0, this.current - 1);

    if (!this.queue.length) return;

    if (this.current < this.maxConcurrent) {
      const next = this.queue.shift();
      next.resolve();
    }
  }

  stats() {
    return {
      maxConcurrent: this.maxConcurrent,
      inFlight: this.current,
      queued: this.queue.length,
    };
  }
}

async function withTimeout(promise, timeoutMs, timeoutMessage = "Operation timed out") {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(timeoutMessage);
          error.code = "TIMEOUT";
          error.status = 504;
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

module.exports = {
  Semaphore,
  withTimeout,
};
