/**
 * loadHtml — the single entry point for turning raw ERP HTML into a Cheerio
 * document.
 *
 * The SRM ERP ships inline `<script>` and `<style>` on nearly every page.
 * Cheerio's `.text()` walks *all* descendant text nodes, including the source
 * inside those tags, so any extractor that falls back to `$("body").text()` or
 * `$.root().text()` — the generic-table path does — can splice minified
 * JavaScript or a CSS rule block into what the UI renders as body copy.
 *
 * The frontend has a `looksLikeCode()` guard (see `lib/erp/sanitize.ts`), but
 * that is the last line, not the only one. Stripping non-content nodes here
 * means the code text never enters the payload in the first place.
 *
 * @module erpExtractors/loadHtml
 */

const cheerio = require("cheerio");

/** Elements whose text content is never page content. */
const NON_CONTENT_SELECTOR = "script, style, noscript, template, link, meta, head";

/**
 * Remove `<script>`/`<style>`/etc. and HTML comment nodes from a loaded
 * document, in place.
 *
 * @param {import("cheerio").CheerioAPI} $
 * @returns {import("cheerio").CheerioAPI} the same `$`, for chaining
 */
function stripNonContent($) {
  $(NON_CONTENT_SELECTOR).remove();

  // Comment nodes can carry commented-out markup or scripts; drop them too.
  $("*")
    .contents()
    .each((_i, node) => {
      if (node.type === "comment") $(node).remove();
    });

  return $;
}

/**
 * Load ERP HTML with non-content nodes already removed.
 *
 * @param {string} html
 * @param {Parameters<typeof cheerio.load>[1]} [options]
 * @returns {import("cheerio").CheerioAPI}
 */
function loadHtml(html, options) {
  const $ = cheerio.load(String(html || ""), options);
  return stripNonContent($);
}

module.exports = { loadHtml, stripNonContent, NON_CONTENT_SELECTOR };
