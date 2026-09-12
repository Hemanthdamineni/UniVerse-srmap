const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canonicalizeSkill,
  canonicalizeSkills,
  isKnownSkill,
} = require("../src/utils/skillNames");

test("canonicalises common acronyms and dotted names", () => {
  assert.equal(canonicalizeSkill("aws"), "AWS");
  assert.equal(canonicalizeSkill("AWS"), "AWS");
  assert.equal(canonicalizeSkill("node.js"), "Node.js");
  assert.equal(canonicalizeSkill("nodejs"), "Node.js");
  assert.equal(canonicalizeSkill("Node Js"), "Node.js");
  assert.equal(canonicalizeSkill("react"), "React");
  assert.equal(canonicalizeSkill("reactjs"), "React");
  assert.equal(canonicalizeSkill("c"), "C");
  assert.equal(canonicalizeSkill("c++"), "C++");
  assert.equal(canonicalizeSkill("cpp"), "C++");
  assert.equal(canonicalizeSkill("c sharp"), "C#");
  assert.equal(canonicalizeSkill("js"), "JavaScript");
  assert.equal(canonicalizeSkill("rest"), "REST API");
  assert.equal(canonicalizeSkill("ci/cd"), "CI/CD");
  assert.equal(canonicalizeSkill("ml"), "Machine Learning");
});

test("title-cases unknown skills sensibly", () => {
  assert.equal(canonicalizeSkill("competitive programming"), "Competitive Programming");
  assert.equal(canonicalizeSkill("PROJECT MANAGEMENT"), "Project Management");
  assert.equal(canonicalizeSkill("ar/vr"), "AR/VR");
  assert.equal(canonicalizeSkill("  spring   boot "), "Spring Boot");
});

test("handles empty / junk input", () => {
  assert.equal(canonicalizeSkill(""), "");
  assert.equal(canonicalizeSkill("   "), "");
  assert.equal(canonicalizeSkill(null), "");
  assert.equal(canonicalizeSkill(undefined), "");
});

test("canonicalizeSkills dedupes case-insensitively, preserves order", () => {
  assert.deepEqual(
    canonicalizeSkills(["aws", "AWS", "react", "ReactJS", "", "  ", "node.js"]),
    ["AWS", "React", "Node.js"],
  );
});

test("isKnownSkill recognises dictionary skills and aliases, rejects prose", () => {
  for (const s of ["python", "PyTorch", "node.js", "aws", "postgres", "k8s", "opencv", "rtos", "dsa", "gen ai"]) {
    assert.equal(isKnownSkill(s), true, s);
  }
  for (const s of ["Complexity Optimization", "What You Get Out Of It", "Real Ownership", "", "the"]) {
    assert.equal(isKnownSkill(s), false, s);
  }
});

test("expanded canonical coverage for common ML / systems terms", () => {
  assert.equal(canonicalizeSkill("yolo"), "YOLO");
  assert.equal(canonicalizeSkill("faiss"), "FAISS");
  assert.equal(canonicalizeSkill("hugging face"), "Hugging Face");
  assert.equal(canonicalizeSkill("langchain"), "LangChain");
  assert.equal(canonicalizeSkill("rtos"), "RTOS");
  assert.equal(canonicalizeSkill("scikit-learn"), "scikit-learn");
  assert.equal(canonicalizeSkill("gen ai"), "Generative AI");
  assert.equal(canonicalizeSkill("vector stores"), "Vector Databases");
});

test("vendored list widens recognition without polluting canonical casing", () => {
  // vendored-only terms are recognised…
  for (const s of ["apache flink", "grpc", "logstash", "logistic regression"]) {
    assert.equal(isKnownSkill(s), true, s);
  }
  // …but cleaned junk is not
  for (const s of ["material", "diagram", "durability", "indentation"]) {
    assert.equal(isKnownSkill(s), false, s);
  }
  // curated casing still wins for the common ones
  assert.equal(canonicalizeSkill("kubernetes"), "Kubernetes");
  assert.equal(canonicalizeSkill("grpc"), "gRPC");
});
