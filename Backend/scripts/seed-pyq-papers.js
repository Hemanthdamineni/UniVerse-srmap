const fs = require("fs");
const path = require("path");

const { CONTENT_DB_PATH } = require("../src/config/env");
const { ContentStore } = require("../src/services/lms/contentStore");

const DEFAULT_INPUT = path.join(__dirname, "..", "src", "data", "pyqPapers.json");

function main() {
  const inputPath = process.argv[2] || DEFAULT_INPUT;
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(entries) || entries.length === 0) {
    console.error("Input must be a non-empty array of content entries.");
    process.exit(1);
  }

  const store = new ContentStore(CONTENT_DB_PATH);
  let imported = 0;
  for (const entry of entries) {
    store.upsertContent({
      id: entry.id,
      type: entry.type || "learning_material",
      title: entry.title,
      description: entry.description || "",
      category: entry.category || "resources/previous-year-papers",
      metadata: entry.metadata || {},
      resources: Array.isArray(entry.resources) ? entry.resources : [],
    });
    imported += 1;
  }

  console.log(`Imported ${imported} previous-year-paper content item(s) into ${CONTENT_DB_PATH}`);
}

main();
