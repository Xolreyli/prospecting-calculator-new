// build-data.js
import fs from "node:fs/promises";
import * as cheerio from "cheerio";

const BASE = "https://prospecting.miraheze.org";
const API = `${BASE}/w/api.php`;

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
    headers: { "User-Agent": "prospecting-calc-builder/1.0 (mwbal)" },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function getPageHtml(title) {
  // MediaWiki parse API returns rendered HTML
  const data = await api({
    action: "parse",
    page: title,
    prop: "text",
  });

  const html = data?.parse?.text?.["*"];
  if (!html) throw new Error("No HTML returned");
  return html;
}

// Extracts lines like:
// <li>...<a>Azuralite Oasis</a>...</b> - 36.9786% (~1 in 3)</li>
function extractLocationsFromHtml(html) {
  const $ = cheerio.load(html);
  const out = [];

  $("li").each((_, li) => {
    const $li = $(li);

    // Get readable text for parsing percent
    const text = $li.text().replace(/\s+/g, " ").trim();

    // Must contain a percent like "36.9786%"
    const m = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
    if (!m) return;

    const chance_percent = Number(m[1]);
    if (!Number.isFinite(chance_percent)) return;

    // Location name: prefer the first <a> text inside the <li>
    // (your snippet uses <a href="/wiki/...">Location Name</a>)
    let location = $li.find("a").first().text().replace(/\s+/g, " ").trim();

    // Fallback: try to take left side before " - "
    if (!location) {
      const left = text.split(" - ")[0]?.trim() ?? "";
      location = left;
    }

    // Clean any trailing junk
    location = location.replace(/\(\s*if in loot pool\s*\)/i, "").trim();

    // Must be non-empty and not obviously the mineral name
    if (!location) return;

    out.push({ location, chance_percent });
  });

  // Deduplicate by location (keep last seen)
  const map = new Map();
  for (const r of out) map.set(r.location, r.chance_percent);

  return [...map.entries()].map(([location, chance_percent]) => ({
    location,
    chance_percent,
  }));
}

// Optional: keep rarity blank for now (you can add later once we see how it’s stored)
async function getRarityFromHtml(_html) {
  return "";
}

async function main() {
  // Uses your existing minerals-index.json like:
  // { "minerals": ["Gold","Copper",...]}
  const index = JSON.parse(await fs.readFile("minerals-index.json", "utf8"));
  const mineralPages = index.minerals ?? [];

  if (!mineralPages.length) {
    throw new Error(
      'minerals-index.json has no "minerals" array. Example: { "minerals": ["Amethyst"] }'
    );
  }

  const minerals = [];

  for (const title of mineralPages) {
    try {
      const html = await getPageHtml(title);

      const locations = extractLocationsFromHtml(html);
      if (!locations.length) {
        console.warn(`WARN: ${title} -> no Locations & Chances`);
        continue;
      }

      const rarity = await getRarityFromHtml(html);

      minerals.push({
        mineral: title,
        rarity,
        locations,
      });

      console.log(`OK: ${title} (${locations.length} locations)`);
    } catch (e) {
      console.warn(`WARN: ${title} -> ${e?.message ?? String(e)}`);
    }
  }

  const out = { minerals };
  await fs.writeFile("minerals.json", JSON.stringify(out, null, 2), "utf8");
  console.log(`\nWrote minerals.json with ${minerals.length} minerals.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});