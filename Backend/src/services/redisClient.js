const {
  REDIS_URL,
  REDIS_SENTINEL_URLS,
  REDIS_SENTINEL_MASTER_NAME,
  REDIS_PASSWORD,
} = require("../config/env");
const { log } = require("../utils/logger");

let sharedClient = null;
let initFailed = false;

async function discoverMasterUrl(createClient, sentinels, masterName, password) {
  for (const sentinel of sentinels) {
    const sentinelUrl = `redis://${sentinel.host}:${sentinel.port}`;
    const probe = createClient({
      url: sentinelUrl,
      password: password || undefined,
      socket: {
        reconnectStrategy: () => false,
      },
    });

    try {
      await probe.connect();
      const response = await probe.sendCommand([
        "SENTINEL",
        "get-master-addr-by-name",
        masterName,
      ]);

      const host = Array.isArray(response) ? String(response[0] || "").trim() : "";
      const port = Array.isArray(response) ? Number(response[1] || 6379) : 6379;
      if (host) {
        return `redis://${host}:${port}`;
      }
    } catch {
      // Try next sentinel endpoint.
    } finally {
      try {
        await probe.quit();
      } catch {
        try {
          await probe.disconnect();
        } catch {
          // No-op
        }
      }
    }
  }

  return "";
}

async function getRedisClient() {
  const hasSentinel = Boolean(String(REDIS_SENTINEL_URLS || "").trim());
  if ((!REDIS_URL && !hasSentinel) || initFailed) return null;
  if (sharedClient) return sharedClient;

  try {
    // Optional dependency: only required when REDIS_URL is configured.
    // eslint-disable-next-line global-require
    const { createClient } = require("redis");

    const socketOptions = {
      reconnectStrategy: (retries) => {
        if (retries > 20) return new Error("Redis reconnect exhausted");
        return Math.min(1000, retries * 50);
      },
    };

    const sentinelRoots = String(REDIS_SENTINEL_URLS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((entry) => {
        const [host, port] = entry.split(":");
        return {
          host: String(host || "").trim(),
          port: Number(port || 26379),
        };
      })
      .filter((entry) => entry.host);

    const discoveredUrl =
      REDIS_URL ||
      (sentinelRoots.length
        ? await discoverMasterUrl(
            createClient,
            sentinelRoots,
            REDIS_SENTINEL_MASTER_NAME,
            REDIS_PASSWORD
          )
        : "");

    if (!discoveredUrl) {
      throw new Error("Unable to discover Redis master from configured sentinel endpoints");
    }

    const config = {
      url: discoveredUrl,
      password: REDIS_PASSWORD || undefined,
      socket: socketOptions,
    };

    const client = createClient(config);

    client.on("error", (error) => {
      log({ level: "error", msg: "Redis client error", error: error?.message || String(error) });
    });

    await client.connect();
    sharedClient = client;

    log({
      level: "info",
      msg: sentinelRoots.length ? "Redis connected (sentinel)" : "Redis connected",
      sentinelMasterName: sentinelRoots.length ? REDIS_SENTINEL_MASTER_NAME : undefined,
    });

    return sharedClient;
  } catch (error) {
    initFailed = true;
    log({
      level: "error",
      msg: "Redis unavailable. Falling back to in-memory stores.",
      error: error?.message || String(error),
    });
    return null;
  }
}

module.exports = {
  getRedisClient,
};
