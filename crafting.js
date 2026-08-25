let equipment = [];
let filteredEquipment = [];
let currentItem = null;
let activeStatsMode = "base";

const MUTATION_MULTIPLIERS = [
  { id: "m110", label: "Mutation ×1.1", value: 1.1 },
  { id: "m120", label: "Mutation ×1.2", value: 1.2 },
  { id: "m135", label: "Mutation ×1.35", value: 1.35 },
  { id: "granite", label: "Granite ×1.36", value: 1.36 },
  { id: "overclocked", label: "Overclocked ×1.36", value: 1.36 },
  { id: "m140", label: "Mutation ×1.4", value: 1.4 },
  { id: "m160", label: "Mutation ×1.6", value: 1.6 }
];

const PERCENT_STATS = new Set([
  "dig_speed",
  "shake_speed",
  "sell_boost",
  "size_boost",
  "modifier_boost",
  "treasure_map_chance",
  "status_timer_speed"
]);

const equipSearch = document.getElementById("equipSearch");
const equipRarityFilter = document.getElementById("equipRarityFilter");
const equipSelect = document.getElementById("equipSelect");

const equipLabel = document.getElementById("equipLabel");
const equipRarityTag = document.getElementById("equipRarityTag");
const equipRarityDot = document.getElementById("equipRarityDot");
const equipAvailability = document.getElementById("equipAvailability");

const equipMaterialsCount =
  document.getElementById("equipMaterialsCount");

const equipMaterialsHint =
  document.getElementById("equipMaterialsHint");

const equipUnlockType =
  document.getElementById("equipUnlockType");

const equipUnlockHint =
  document.getElementById("equipUnlockHint");

const equipCost =
  document.getElementById("equipCost");

const equipSlot =
  document.getElementById("equipSlot");

fetch("./crafting.json?v=" + Date.now())
  .then(r => {
    if (!r.ok) {
      throw new Error(`Failed to load crafting.json (${r.status})`);
    }

    return r.json();
  })
  .then(data => {
    equipment = data.equipment || [];
    filteredEquipment = [...equipment];
    populateEquipmentDropdown();
  })
  .catch(err =>
    console.error("Failed to load crafting.json", err)
  );

function renderStatsToGrid(
  gridId,
  stats,
  multiplier,
  extraBonuses = null
) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const bonuses = extraBonuses || {};

  const keys = Array.from(new Set([
    ...Object.keys(stats || {}),
    ...Object.keys(bonuses)
  ]));

  if (!keys.length) {
    grid.innerHTML =
      `<div class="note">No stats available</div>`;
    return;
  }

  grid.innerHTML = keys.map(key => {
    const val = stats ? stats[key] : undefined;

    let baseMin;
    let baseMax;
    let baseVal;

    if (typeof val === "object" && val !== null) {
      if ("min" in val && "max" in val) {
        baseMin = val.min;
        baseMax = val.max;
      } else if ("value" in val) {
        baseVal = val.value;
      }
    } else if (typeof val === "number") {
      baseVal = val;
    }

    const hasBonus = typeof bonuses[key] === "number";
    const bonus = hasBonus ? bonuses[key] : 0;

    let display;

    if (baseMin != null && baseMax != null) {
      const minMult =
        baseMin < 0 ? 1 / multiplier : multiplier;

      const maxMult =
        baseMax < 0 ? 1 / multiplier : multiplier;

      let minVal = baseMin * minMult;
      let maxVal = baseMax * maxMult;

      if (hasBonus) {
        minVal += bonus;
        maxVal += bonus;
      }

      display =
        `${roundStat(key, minVal)} – ` +
        `${roundStat(key, maxVal)}`;
    } else {
      if (baseVal == null && hasBonus) {
        baseVal = 0;
      }

      if (baseVal == null && !hasBonus) {
        return "";
      }

      const effectiveMultiplier =
        baseVal < 0 ? 1 / multiplier : multiplier;

      let finalValue =
        baseVal * effectiveMultiplier;

      if (hasBonus) {
        finalValue += bonus;
      }

      display = roundStat(key, finalValue);
    }

    if (display === "") return "";

    if (PERCENT_STATS.has(key)) {
      display += "%";
    }

    const cls = `stat-${key}`;

    return `
      <div class="statItem">
        <div class="statLabel">${prettyStat(key)}</div>
        <div class="statValue ${cls}">${display}</div>
      </div>
    `;
  }).join("");
}

function appendFlatBonusStat(gridId, key, value) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const display =
    roundStat(key, value) +
    (PERCENT_STATS.has(key) ? "%" : "");

  grid.insertAdjacentHTML(
    "beforeend",
    `
      <div class="statItem bonusStat">
        <div class="statLabel">${prettyStat(key)}</div>
        <div class="statValue">+${display}</div>
      </div>
    `
  );
}

function roundStat(key, value) {
  if (value == null || isNaN(value)) {
    return value;
  }

  const abs = Math.abs(value);

  if (
    key === "walkspeed" ||
    key === "jump_power"
  ) {
    return Math.round(value * 10) / 10;
  }

  if (abs > 0 && abs < 1) {
    return Math.round(value * 10) / 10;
  }

  return Math.round(value);
}

function renderStats() {
  if (!currentItem) return;

  const stats =
    currentItem.stats?.[activeStatsMode];

  if (!stats) return;

  renderStatsToGrid(
    "statsGrid",
    stats,
    1
  );

  MUTATION_MULTIPLIERS.forEach(m => {
    const gridId = `statsGrid-${m.id}`;

    let bonuses = null;

    if (m.id === "m140") {
      bonuses = {
        luck: 50,
        size_boost: 10
      };
    }

    if (m.id === "granite") {
      bonuses = {
        dig_strength: 24,
        shake_strength: 6
      };
    }

    if (m.id === "overclocked") {
      bonuses = {
        dig_speed: 10,
        shake_speed: 10
      };
    }

    renderStatsToGrid(
      gridId,
      stats,
      m.value,
      bonuses
    );
  });
}

function populateEquipmentDropdown() {
  if (!equipSelect) return;

  equipSelect.innerHTML = "";

  filteredEquipment.forEach(item => {
    const opt =
      document.createElement("option");

    opt.value = item.name;
    opt.textContent = item.name;

    equipSelect.appendChild(opt);
  });

  if (filteredEquipment.length) {
    equipSelect.value =
      filteredEquipment[0].name;

    updateEquipmentDetails(
      filteredEquipment[0]
    );
  }
}

function applyEquipmentFilters() {
  const search =
    (equipSearch?.value || "").toLowerCase();

  const rarity =
    equipRarityFilter?.value || "all";

  filteredEquipment =
    equipment.filter(e => {
      const matchesSearch =
        !search ||
        e.name.toLowerCase().includes(search);

      const matchesRarity =
        rarity === "all" ||
        e.rarity === rarity;

      return matchesSearch &&
             matchesRarity;
    });

  populateEquipmentDropdown();
}

if (equipSearch) {
  equipSearch.addEventListener(
    "input",
    applyEquipmentFilters
  );
}

if (equipRarityFilter) {
  equipRarityFilter.addEventListener(
    "change",
    applyEquipmentFilters
  );
}

if (equipSelect) {
  equipSelect.addEventListener(
    "change",
    () => {
      const selected =
        equipment.find(
          e => e.name === equipSelect.value
        );

      if (selected) {
        updateEquipmentDetails(selected);
      }
    }
  );
}

function updateEquipmentDetails(item) {
  currentItem = item;

  if (equipLabel) {
    equipLabel.textContent =
      `Equipment: ${item.name}`;
  }

  if (equipRarityTag) {
    equipRarityTag.textContent =
      item.rarity ?? "—";
  }

  if (equipAvailability) {
    equipAvailability.textContent =
      item.availability ?? "normal";
  }

  if (equipRarityDot) {
    equipRarityDot.style.background =
      rarityColor(item.rarity);
  }

  if (equipCost) {
    equipCost.textContent =
      formatCost(item);
  }

  if (equipSlot) {
    equipSlot.textContent =
      item.slot
        ? `Slot: ${item.slot}`
        : "—";
  }

  const mats =
    item.crafting?.materials ?? [];

  if (equipMaterialsCount) {
    equipMaterialsCount.textContent =
      mats.length || "0";
  }

  if (equipMaterialsHint) {
    equipMaterialsHint.textContent =
      mats.length
        ? mats.map(m =>
            `${m.amount} ${m.item}` +
            `${m.min_size ? ` (≥ ${m.min_size}kg)` : ""}`
          ).join(", ")
        : "No crafting required";
  }

  renderStats();
  renderUnlock(item);
}

function renderUnlock(item) {
  const unlock = item.unlock;

  if (
    !unlock ||
    unlock.type === "craft"
  ) {
    if (equipUnlockType) {
      equipUnlockType.textContent =
        "Craft Only";
    }

    if (equipUnlockHint) {
      equipUnlockHint.innerHTML =
        "No blueprint required";
    }

    return;
  }

  if (unlock.type === "quest") {
    if (equipUnlockType) {
      equipUnlockType.textContent =
        "Quest";
    }

    const q = unlock.quest;

    let html =
      `<strong>${q.name}</strong>`;

    if (q.giver) {
      html += `
        <br>
        <span class="muted">
          From ${q.giver.name}
          ${q.giver.location
            ? " — " + q.giver.location
            : ""}
        </span>
      `;
    }

    if (Array.isArray(q.stages)) {
      q.stages.forEach(stage => {
        html += `
          <div class="questStage">
            <div class="questStageTitle">
              ${stage.title}
            </div>
            <ul class="questList">
              ${stage.tasks
                .map(t => `<li>${t}</li>`)
                .join("")}
            </ul>
          </div>
        `;
      });
    } else if (Array.isArray(q.tasks)) {
      html += `
        <ul class="questList">
          ${q.tasks
            .map(t => `<li>${t}</li>`)
            .join("")}
        </ul>
      `;
    }

    if (equipUnlockHint) {
      equipUnlockHint.innerHTML = html;
    }

    return;
  }

  if (unlock.type === "npc") {
    if (equipUnlockType) {
      equipUnlockType.textContent =
        "NPC Blueprint";
    }

    if (equipUnlockHint) {
      equipUnlockHint.innerHTML = `
        <strong>${unlock.npc.name}</strong>
        <br>
        <span class="muted">
          ${unlock.npc.location ?? ""}
        </span>
      `;
    }

    return;
  }

  if (unlock.type === "event") {
    if (equipUnlockType) {
      equipUnlockType.textContent =
        "Event";
    }

    if (equipUnlockHint) {
      equipUnlockHint.innerHTML = `
        <strong>${unlock.event.name}</strong>
        <br>
        <span class="muted">
          ${unlock.event.note ?? ""}
        </span>
      `;
    }
  }
}

function rarityColor(r) {
  switch (r) {
    case "common":
      return "#a3a3a3";
    case "uncommon":
      return "#22c55e";
    case "rare":
      return "#3b82f6";
    case "epic":
      return "#a855f7";
    case "legendary":
      return "#f59e0b";
    case "mythic":
    case "mythical":
      return "#cf0064";
    case "exotic":
      return "#ff0011";
    case "ascended":
      return "#eceee0";
    default:
      return "#7c8cff";
  }
}

function prettyStat(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatCost(item) {
  const cost = item.cost;

  if (
    !cost ||
    cost.amount == null
  ) {
    return "—";
  }

  const amount =
    cost.amount.toLocaleString();

  switch (cost.currency) {
    case "candies":
      return `${amount} Candies`;

    case "ornaments":
      return `${amount} Ornaments`;

    case "easter eggs":
      return `${amount} Easter Eggs`;

    case "sand dollars":
      return `${amount} Sand Dollars`;

    case "money":
    default:
      return `$${amount}`;
  }
}

const statsBaseBtn =
  document.getElementById("statsBaseBtn");

const statsStarBtn =
  document.getElementById("statsStarBtn");

if (statsBaseBtn) {
  statsBaseBtn.onclick = () => {
    activeStatsMode = "base";
    setStatsToggle(true);
    renderStats();
  };
}

if (statsStarBtn) {
  statsStarBtn.onclick = () => {
    activeStatsMode = "star6";
    setStatsToggle(false);
    renderStats();
  };
}

function setStatsToggle(baseActive) {
  if (statsBaseBtn) {
    statsBaseBtn.classList.toggle(
      "active",
      baseActive
    );
  }

  if (statsStarBtn) {
    statsStarBtn.classList.toggle(
      "active",
      !baseActive
    );
  }
}