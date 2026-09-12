import { afterEach, describe, expect, it } from "vitest";
import {
  clearQueryPersistedCache,
  getQueryPersistScope,
  setQueryPersistScope,
} from "./queryPersist";

describe("query persistence identity boundary", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("removes every prior student and legacy snapshot when the identity changes", () => {
    window.localStorage.setItem("erp.query-cache.v1", "legacy");
    window.localStorage.setItem("erp.query-cache.v2.alice", "alice-data");
    window.localStorage.setItem("erp.query-cache.scope", "alice");

    setQueryPersistScope("AP23/1100/42");

    expect(getQueryPersistScope()).toBe("ap23110042");
    expect(window.localStorage.getItem("erp.query-cache.v1")).toBeNull();
    expect(window.localStorage.getItem("erp.query-cache.v2.alice")).toBeNull();
  });

  it("removes identity scope and all persisted snapshots on auth termination", () => {
    window.localStorage.setItem("erp.query-cache.v2.alice", "alice-data");
    window.localStorage.setItem("erp.query-cache.v2.bob", "bob-data");
    window.localStorage.setItem("erp.query-cache.scope", "alice");

    clearQueryPersistedCache();

    expect(getQueryPersistScope()).toBe("");
    expect(window.localStorage.getItem("erp.query-cache.v2.alice")).toBeNull();
    expect(window.localStorage.getItem("erp.query-cache.v2.bob")).toBeNull();
  });
});
