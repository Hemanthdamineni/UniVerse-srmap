# `skills.json` — vendored skill vocabulary

`skills.json` is a cleaned, lower-cased list of ~1,400 technical skill / tool / concept
names used to *recognise* skills in uploaded résumés (see
`src/services/career/resumeParse.js` and `src/utils/skillNames.js`).

## Source

Derived from **jobzilla_ai** — `jz_skill_patterns.jsonl`
(<https://github.com/kingabzpro/jobzilla_ai>), MIT License, © Abid Ali Awan.

The spaCy token patterns were flattened to plain phrases, lower-cased, de-duplicated, and
filtered to drop non-skill entries (generic English words, soft skills, > 4-word phrases,
and a curated stop-list). No text from that project is redistributed verbatim beyond the
individual skill terms.

## Regenerating

The list is static and checked in. To rebuild it, re-run the flatten/clean step against a
fresh copy of `jz_skill_patterns.jsonl`. Display casing for the common ~700 skills is owned
by the curated `CANONICAL` / `ALIASES` tables in `src/utils/skillNames.js`; this list only
adds breadth of recognition.
