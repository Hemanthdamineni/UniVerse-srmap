const fs = require("fs");
const path = require("path");

const { CONTENT_DB_PATH } = require("../src/config/env");
const { ContentStore } = require("../src/services/contentStore");
const { slugify } = require("../src/utils/text");

function usage() {
  console.error(
    "Usage: node scripts/import-learning-materials.js <input.json>\n" +
      "The JSON file must contain an array of learning-material content objects."
  );
  process.exit(1);
}

function buildDefaultId(entry, index) {
  const metadata = entry?.metadata || {};
  const parts = [
    "learning-material",
    metadata.year,
    metadata.courseCode,
    metadata.subjectCode,
    metadata.resourceGroup,
    entry?.title || `item-${index + 1}`,
  ].filter(Boolean);
  return slugify(parts.join(" ")) || `learning-material-${index + 1}`;
}

function main() {
  const inputFile = process.argv[2];
  if (!inputFile) usage();

  const resolvedPath = path.resolve(process.cwd(), inputFile);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Input file not found: ${resolvedPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(`Invalid JSON in ${resolvedPath}: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(parsed)) {
    console.error("Input JSON must be an array.");
    process.exit(1);
  }

  const store = new ContentStore(CONTENT_DB_PATH);
  let imported = 0;

  parsed.forEach((entry, index) => {
    const payload = {
      id: entry?.id || buildDefaultId(entry, index),
      type: "learning_material",
      title: entry?.title || `Learning Material ${index + 1}`,
      description: entry?.description || "",
      category: entry?.category || "resources/learning-materials",
      metadata: entry?.metadata || {},
      resources: Array.isArray(entry?.resources) ? entry.resources : [],
    };

    store.upsertContent(payload);
    imported += 1;
  });

  console.log(`Imported ${imported} learning-material item(s) into ${CONTENT_DB_PATH}`);
}

main();
