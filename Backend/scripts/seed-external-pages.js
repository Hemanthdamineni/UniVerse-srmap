const { EXTERNAL_DB_PATH } = require("../src/config/env");
const { EXTERNAL_PAGE_SEED_DATA } = require("../src/data/externalSeedData");
const { ExternalDataStore } = require("../src/services/campus/feedbackServices");

function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const missingOnly = args.includes("--missing");
  const mode = reset ? "reset" : missingOnly ? "missing" : "upsert";

  const store = new ExternalDataStore(EXTERNAL_DB_PATH);

  if (reset) {
    const removed = store.clearAll();
    const affected = store.upsertAll(EXTERNAL_PAGE_SEED_DATA);
    console.log(
      `[seed:external] mode=${mode} removed=${removed} affected=${affected} total=${store.countPages()}`
    );
    return;
  }

  if (missingOnly) {
    const inserted = store.seedMissing(EXTERNAL_PAGE_SEED_DATA);
    console.log(
      `[seed:external] mode=${mode} inserted=${inserted} total=${store.countPages()}`
    );
    return;
  }

  const affected = store.upsertAll(EXTERNAL_PAGE_SEED_DATA);
  console.log(
    `[seed:external] mode=${mode} affected=${affected} total=${store.countPages()}`
  );
}

main();
