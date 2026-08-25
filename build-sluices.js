// build-sluices.js
import fs from "node:fs/promises";
import * as cheerio from "cheerio";

const BASE = "https://prospecting.miraheze.org";
const API = `${BASE}/w/api.php`;

/* ---------------- API ---------------- */

async function api(params) {
  const url =
    API +
    "?" +
    new URLSearchParams({
      format: "json",
      origin: "*",
      redirects: "1",
      ...params,
    });

  const res = await fetch(url, {
    headers: {
      "User-Agent": "prospecting-calc-builder/1.0 (mwbal)",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function getPageHtml(title) {
  const data = await api({
    action: "parse",
    page: title,
    prop: "text",
  });

  const html = data?.parse?.text?.["*"];

  if (!html) {
    throw new Error(`No HTML returned for page "${title}"`);
  }

  return html;
}

/* ---------------- Helpers ---------------- */

function parseNumber(value) {
  if (value === null || value === undefined) return null;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/[^\d.+-]/g, "")
    .trim();

  if (!cleaned) return null;

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractName($, cell) {
  const linked = $(cell)
    .find("b a, strong a, a")
    .first()
    .text();

  if (linked) return cleanText(linked);

  const bold = $(cell)
    .find("b, strong")
    .first()
    .text();

  if (bold) return cleanText(bold);

  return cleanText($(cell).text());
}

function extractLabeledNumber(text, label) {
  const regex = new RegExp(
    `${label}\\s*:?\\s*([+-]?\\d[\\d,]*(?:\\.\\d+)?)`,
    "i"
  );

  const match = text.match(regex);

  if (!match) return null;

  return parseNumber(match[1]);
}

function extractLocation(text) {
  const match = text.match(
    /\bToughness\s*:?\s*[+-]?\d[\d,]*(?:\.\d+)?\s+(.+)$/i
  );

  if (!match) return null;

  return cleanText(match[1]);
}

/* ---------------- Sluice Extraction ---------------- */

function extractSluicesFromPage(html) {
  const $ = cheerio.load(html);
  const sluices = [];

  $("table.wikitable").each((tableIndex, table) => {
    $(table)
      .find("tr")
      .each((rowIndex, row) => {
        const cols = $(row).find("td");

        if (!cols.length) return;

        const rowText = cleanText($(row).text());

        const luck = extractLabeledNumber(rowText, "Luck");
        const capacity = extractLabeledNumber(rowText, "Capacity");
        const efficiency = extractLabeledNumber(rowText, "Efficiency");
        const toughness = extractLabeledNumber(rowText, "Toughness");

        // Ignore rows that aren't sluice entries.
        if (
          luck === null ||
          capacity === null ||
          efficiency === null ||
          toughness === null
        ) {
          return;
        }

        /*
         * Find the sluice name.
         */
        let name = "";

        for (let i = 0; i < Math.min(cols.length, 3); i++) {
          const candidate = extractName($, cols[i]);

          if (
            candidate &&
            !/^(image|name|sluice|type)$/i.test(candidate)
          ) {
            name = candidate;
            break;
          }
        }

        if (!name) return;

        if (
          /^(name|sluice|sluices|image|stats?)$/i.test(name)
        ) {
          return;
        }

        /*
         * Extract the location/vendor.
         *
         * Example:
         *
         * Toughness 4 Shady Merchant
         *
         * -> Shady Merchant
         */
        const location = extractLocation(rowText);

        sluices.push({
          name,
          stats: {
            luck,
            capacity,
            efficiency,
            toughness,
          },
          location,
        });
      });
  });

  /*
   * Remove duplicates.
   */
  const unique = [];
  const seen = new Set();

  for (const sluice of sluices) {
    const key = sluice.name.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(sluice);
  }

  return unique;
}

/* ---------------- Validation ---------------- */

function validateSluices(sluices) {
  const errors = [];

  for (const sluice of sluices) {
    if (!sluice.name) {
      errors.push("Sluice with no name");
      continue;
    }

    if (sluice.stats.luck === null) {
      errors.push(`${sluice.name}: missing Luck`);
    }

    if (sluice.stats.capacity === null) {
      errors.push(`${sluice.name}: missing Capacity`);
    }

    if (sluice.stats.efficiency === null) {
      errors.push(`${sluice.name}: missing Efficiency`);
    }

    if (sluice.stats.toughness === null) {
      errors.push(`${sluice.name}: missing Toughness`);
    }

    if (!sluice.location) {
      errors.push(`${sluice.name}: missing location/vendor`);
    }
  }

  return errors;
}

/* ---------------- Build ---------------- */

async function main() {
  const page = "Sluices";

  console.log(`Fetching ${page}...`);

  const html = await getPageHtml(page);

  console.log(
    `Received ${html.length.toLocaleString()} characters`
  );

  const sluices = extractSluicesFromPage(html);

  if (!sluices.length) {
    throw new Error(
      "No sluices extracted — selectors may be wrong or the wiki structure has changed"
    );
  }

  const validationErrors = validateSluices(sluices);

  if (validationErrors.length) {
    console.error("\nValidation errors:");

    for (const error of validationErrors) {
      console.error(`  - ${error}`);
    }

    throw new Error(
      `${validationErrors.length} validation error(s) found`
    );
  }

  /*
   * Sort alphabetically.
   */
  sluices.sort((a, b) =>
    a.name.localeCompare(b.name, "en", {
      sensitivity: "base",
    })
  );

  await fs.writeFile(
    "sluices.json",
    JSON.stringify({ sluices }, null, 2),
    "utf8"
  );

  console.log(
    `\nWrote sluices.json with ${sluices.length} sluice entries\n`
  );

  for (const sluice of sluices) {
    console.log(
      `${sluice.name}: ` +
      `Luck ${sluice.stats.luck.toLocaleString()} · ` +
      `Capacity ${sluice.stats.capacity.toLocaleString()} · ` +
      `Efficiency ${sluice.stats.efficiency} · ` +
      `Toughness ${sluice.stats.toughness} · ` +
      `Location ${sluice.location}`
    );
  }
}

main().catch((err) => {
  console.error("\nBuild failed:");
  console.error(err);
  process.exit(1);
});