import { describe, expect, it } from "vitest";
import { buildMultipartForm } from "./http";

describe("buildMultipartForm", () => {
  it("builds a FormData with string values", () => {
    const fd = buildMultipartForm({ title: "Hello", count: "3" });
    expect(fd.get("title")).toBe("Hello");
    expect(fd.get("count")).toBe("3");
  });

  it("builds a FormData with number values converting to string", () => {
    const fd = buildMultipartForm({ count: 42, ratio: 3.14 });
    expect(fd.get("count")).toBe("42");
    expect(fd.get("ratio")).toBe("3.14");
  });

  it("builds a FormData with boolean values converting to string", () => {
    const fd = buildMultipartForm({ active: true, published: false });
    expect(fd.get("active")).toBe("true");
    expect(fd.get("published")).toBe("false");
  });

  it("builds a FormData with object values serialized as JSON", () => {
    const obj = { tags: ["sql", "db"], score: 85 };
    const fd = buildMultipartForm({ metadata: obj });
    expect(fd.get("metadata")).toBe(JSON.stringify(obj));
  });

  it("appends File objects directly", () => {
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    const fd = buildMultipartForm({ file });
    expect(fd.get("file")).toBe(file);
  });

  it("skips null and undefined values", () => {
    const fd = buildMultipartForm({ a: "keep", b: null, c: undefined, d: 0 });
    expect(fd.get("a")).toBe("keep");
    expect(fd.get("b")).toBeNull();
    expect(fd.get("c")).toBeNull();
    expect(fd.get("d")).toBe("0");
  });

  it("handles empty input", () => {
    const fd = buildMultipartForm({});
    // FormData with no entries — just verify no error
    expect([...fd.entries()]).toHaveLength(0);
  });
});
