// build-crafting.js
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
  if (!html) throw new Error("No HTML returned");

  return html;
}

/* ---------------- Helpers ---------------- */

// Parses recipe cell text like:
// "5 Platinum (+0.25kg) 1 Ruby"
function parseRecipeCell(text) {
  const materials = [];

  text = text.replace(/\s+/g, " ").trim();
  if (!text) return materials;

  const parts = text.match(/\d+\s+[A-Za-z ]+(?:\s*\(\+[\d.]+kg\))?/g);
  if (!parts) return materials;

  for (const part of parts) {
    const base = part.match(/^(\d+)\s+([A-Za-z ]+)/);
    if (!base) continue;

    const material = {
      amount: Number(base[1]),
      item: base[2].trim(),
    };

    const sizeMatch = part.match(/\+\s*([\d.]+)\s*kg/i);
    if (sizeMatch) {
      material.min_size = Number(sizeMatch[1]);
    }

    materials.push(material);
  }

  return materials;
}

// Parses stats like:
// "Luck 1–2.5", "Inventory Size 10–50"
function parseStatsCell($cell) {
  const stats = {
    base: {},
    star6: {}
  };

  const panels = $cell.find(".tabber__panel");

  function extract(panel, target) {
    panel.find(".equip-stat").each((_, row) => {
      const $row = $cell.find(row);

      const label = $row.find(".stat").text().trim();
      const rawVal = $row.find(".stat-val").text().trim();

      if (!label || !rawVal) return;

      const key = label
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w]/g, "");

      // 1️⃣ Range: X–Y
      let m = rawVal.match(
        /(-?\d+(?:\.\d+)?)\s*[–-]\s*(-?\d+(?:\.\d+)?)/);
      if (m) {
        target[key] = {
          min: Number(m[1]),
          max: Number(m[2])
        };
        return;
      }

      // 2️⃣ Single numeric value (e.g. "15", "+10", "15%")
      m = rawVal.match(/(-?\d+(?:\.\d+)?)/);
      if (m) {
        target[key] = {
          value: Number(m[1])
        };
        return;
      }

      // 3️⃣ Boolean-style values
      if (/^yes$/i.test(rawVal)) {
        target[key] = { value: true };
        return;
      }

      if (/^no$/i.test(rawVal)) {
        target[key] = { value: false };
      }
    });
  }

  if (panels.length >= 1) extract(panels.eq(0), stats.base);
  if (panels.length >= 2) extract(panels.eq(1), stats.star6);

  return stats;
}

/* ---------------- Main Extractor ---------------- */

function extractEquipmentFromList(html) {
  const $ = cheerio.load(html);
  const equipment = [];

  const tables = $("table.wikitable");
  if (!tables.length) return equipment;

  const rarityOrder = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
    "mythical",
  ];

  tables.each((i, table) => {
    const rarity = rarityOrder[i % rarityOrder.length];
    const availability = i < rarityOrder.length ? "normal" : "limited";

    $(table)
      .find("tr")
      .each((_, row) => {
        const cols = $(row).find("td");
        if (cols.length < 6) return;

        let img =
          $(cols[0]).find("img").attr("data-src") ||
          $(cols[0]).find("img").attr("src") ||
          null;

        if (img?.startsWith("//")) {
          img = "https:" + img;
        }

        const name = $(cols[1]).find("b, a").first().text().trim();
        if (!name) return;

        const description = $(cols[1])
          .clone()
          .children()
          .remove()
          .end()
          .text()
          .replace(/\s+/g, " ")
          .trim();

        const slot = $(cols[2]).text().trim();

        const recipeText = $(cols[3]).text();
        const materials = parseRecipeCell(recipeText);

        const stats = parseStatsCell($(cols[4]));

        const cost = Number(
          $(cols[5]).text().replace(/[^0-9]/g, "")
        );

        equipment.push({
          name,
          rarity,
          availability,
          slot,
          description,
          appearance: img,
          crafting: { materials },
          stats,
          cost,
        });
      });
  });

  return equipment;
}

/* ---------------- Build ---------------- */

async function main() {
  const index = JSON.parse(
    await fs.readFile("crafting-index.json", "utf8")
  );

  const page = index.page || "Equipment";
  const html = await getPageHtml(page);

  const equipment = extractEquipmentFromList(html);

  if (!equipment.length) {
    throw new Error("No equipment extracted — selectors may be wrong");
  }

  await fs.writeFile(
    "crafting.json",
    JSON.stringify({ equipment }, null, 2),
    "utf8"
  );

  console.log(
    `Wrote crafting.json with ${equipment.length} equipment entries`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
