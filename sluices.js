/* =========================================================
   SLUICE CALCULATOR
========================================================= */

let sluices = [];
let sluiceMinerals = [];
let sluiceLocationNames = new Set();

const sluiceSelect = document.getElementById("sluiceSelect");
const sluiceSearch = document.getElementById("sluiceSearch");
const sluiceLocationSelect = document.getElementById("sluiceLocationSelect");
const sluiceLocationFilter = document.getElementById("sluiceLocationFilter");
const sluiceLuckInput = document.getElementById("sluiceLuckInput");
const sluiceCapacityInput = document.getElementById("sluiceCapacityInput");
const sluiceEfficiencyInput = document.getElementById("sluiceEfficiencyInput");
const sluiceSelfPropulsionInput = document.getElementById("selfPropulsionInput");
const sluiceAutocollectInput = document.getElementById("autocollectInput");

/* =========================================================
   FORMAT HELPERS
========================================================= */

function sluiceFmtPct(value, digits = 5) {
    if (!Number.isFinite(value)) return "—";
    return (value * 100).toFixed(digits) + "%";
}

function sluiceFmtOneInFromProb(probability) {
    if (!Number.isFinite(probability) || probability <= 0) {
        return "∞";
    }

    if (probability >= 1) {
        return "1";
    }

    return Math.round(1 / probability).toLocaleString();
}

function sluiceFmtDuration(seconds) {
    if (seconds === Infinity) return "∞";
    if (!Number.isFinite(seconds) || seconds < 0) return "—";

    const totalSeconds = Math.round(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }

    return `${secs}s`;
}

/* =========================================================
   LUCK CALCULATION
========================================================= */

/*
   Sluice luck formula:

   Chance = Luck ÷ Ore Odds

   Example:

   Luck = 600,000
   Ore odds = 1,000,000

   600,000 ÷ 1,000,000 = 0.60 = 60%

   The result is capped at 100%.
*/

function sluiceLuckAdjustedProbability(baseProbability, luck) {
    const p = Number(baseProbability);
    const L = Math.max(0, Number(luck) || 0);

    if (!Number.isFinite(p) || p <= 0 || L <= 0) {
        return 0;
    }

    if (p >= 1) {
        return 1;
    }

    const oreOdds = 1 / p;
    const adjustedProbability = L / oreOdds;

    return Math.min(1, Math.max(0, adjustedProbability));
}

/* =========================================================
   SLUICE PRODUCTION
========================================================= */

function getSluiceMineralsPerTenMinutes() {
    return Math.max(
        0,
        Number(sluiceEfficiencyInput?.value) || 0
    );
}

function getSluiceMineralsPerMinute() {
    return getSluiceMineralsPerTenMinutes() / 10;
}

function getSluiceMineralsPerHour() {
    return getSluiceMineralsPerMinute() * 60;
}

function getSluiceMineralsPerDay() {
    return getSluiceMineralsPerHour() * 24;
}

/* =========================================================
   TIME TO FILL
========================================================= */

function getSluiceTimeToFillSeconds() {
    const capacity = Math.max(
        1,
        Number(sluiceCapacityInput?.value) || 1
    );

    const mineralsPerMinute = getSluiceMineralsPerMinute();

    if (mineralsPerMinute <= 0) {
        return Infinity;
    }

    return (capacity / mineralsPerMinute) * 60;
}

/* =========================================================
   LOAD DATA
========================================================= */

Promise.all([
    fetch("./sluices.json?v=" + Date.now()).then(response => {
        if (!response.ok) {
            throw new Error(
                `Failed to load sluices.json (${response.status})`
            );
        }

        return response.json();
    }),

    fetch("./minerals.json?v=" + Date.now()).then(response => {
        if (!response.ok) {
            throw new Error(
                `Failed to load minerals.json (${response.status})`
            );
        }

        return response.json();
    })
])
.then(([sluiceData, mineralData]) => {
    sluices = (sluiceData.sluices || [])
        .slice()
        .sort((a, b) =>
            (a.name || "").localeCompare(
                b.name || "",
                "en",
                { sensitivity: "base" }
            )
        );

    sluiceMinerals = (mineralData.minerals || [])
        .slice()
        .sort((a, b) =>
            (a.mineral || "").localeCompare(
                b.mineral || "",
                "en",
                { sensitivity: "base" }
            )
        );

    for (const mineral of sluiceMinerals) {
        for (const location of mineral.locations || []) {
            if (location.location) {
                sluiceLocationNames.add(location.location);
            }
        }
    }

    if (sluiceLocationFilter) {
        const locations = [...sluiceLocationNames].sort((a, b) =>
            a.localeCompare(b)
        );

        const existingValues = new Set(
            [...sluiceLocationFilter.options].map(
                option => option.value
            )
        );

        for (const location of locations) {
            if (existingValues.has(location)) {
                continue;
            }

            const option = document.createElement("option");
            option.value = location;
            option.textContent = location;

            sluiceLocationFilter.appendChild(option);
        }
    }

    populateSluices(true);
    populateSluiceLocations();
    calculateSluice();
})
.catch(error => {
    console.error(
        "Failed to load sluice calculator data:",
        error
    );
});

/* =========================================================
   SLUICE DROPDOWN
========================================================= */

function populateSluices(keepSelection = false) {
    if (!sluiceSelect) return;

    const query = (sluiceSearch?.value || "")
        .toLowerCase()
        .trim();

    const previous = keepSelection
        ? sluiceSelect.value
        : null;

    const filtered = sluices.filter(sluice =>
        (sluice.name || "")
            .toLowerCase()
            .includes(query)
    );

    sluiceSelect.innerHTML = "";

    for (const sluice of filtered) {
        const option = document.createElement("option");
        option.value = sluice.name;
        option.textContent = sluice.name;

        sluiceSelect.appendChild(option);
    }

    if (
        previous &&
        filtered.some(sluice => sluice.name === previous)
    ) {
        sluiceSelect.value = previous;
    } else if (filtered.length) {
        sluiceSelect.selectedIndex = 0;
    }

    loadSelectedSluiceStats();
}

/* =========================================================
   LOAD SLUICE STATS
========================================================= */

function loadSelectedSluiceStats() {
    const selected = sluices.find(
        sluice =>
            sluice.name === sluiceSelect?.value
    );

    if (!selected) return;

    if (sluiceLuckInput) {
        sluiceLuckInput.value =
            selected.stats?.luck ?? 0;
    }

    if (sluiceCapacityInput) {
        sluiceCapacityInput.value =
            selected.stats?.capacity ?? 1;
    }

    if (sluiceEfficiencyInput) {
        sluiceEfficiencyInput.value =
            selected.stats?.efficiency ?? 0;
    }

    updateSluiceLabels();
    calculateSluice();
}

/* =========================================================
   LOCATION DROPDOWN
========================================================= */

function populateSluiceLocations() {
    if (!sluiceLocationSelect) return;

    const previous = sluiceLocationSelect.value;

    sluiceLocationSelect.innerHTML = "";

    const locations = [...sluiceLocationNames].sort(
        (a, b) => a.localeCompare(b)
    );

    for (const location of locations) {
        const option = document.createElement("option");
        option.value = location;
        option.textContent = location;

        sluiceLocationSelect.appendChild(option);
    }

    if (
        previous &&
        locations.includes(previous)
    ) {
        sluiceLocationSelect.value = previous;
    } else if (locations.length) {
        sluiceLocationSelect.selectedIndex = 0;
    }

    calculateSluice();
}

/* =========================================================
   MINERALS AT LOCATION
========================================================= */

function getSluiceMineralsAtLocation() {
    const selectedLocation =
        sluiceLocationSelect?.value;

    if (!selectedLocation) {
        return [];
    }

    return sluiceMinerals.filter(mineral =>
        (mineral.locations || []).some(
            location =>
                location.location === selectedLocation
        )
    );
}

/* =========================================================
   BASE ORE CHANCE
========================================================= */

function getSluiceMineralLocationChance(
    mineral,
    location
) {
    const entry = (mineral.locations || []).find(
        item => item.location === location
    );

    if (!entry) {
        return 0;
    }

    const chance = Number(entry.chance_percent);

    if (
        !Number.isFinite(chance) ||
        chance <= 0
    ) {
        return 0;
    }

    return chance / 100;
}

/* =========================================================
   MINERAL TABLE
========================================================= */

function buildSluiceMineralTable() {
    const tbody = document.getElementById(
        "sluiceMineralsTable"
    );

    if (!tbody) return;

    tbody.innerHTML = "";

    const location =
        sluiceLocationSelect?.value;

    const luck = Math.max(
        0,
        Number(sluiceLuckInput?.value) || 0
    );

    if (!location) return;

    const locationMinerals =
        getSluiceMineralsAtLocation();

    const mineralsPerSecond =
        getSluiceMineralsPerMinute() / 60;

    for (const mineral of locationMinerals) {
        const baseProbability =
            getSluiceMineralLocationChance(
                mineral,
                location
            );

        const adjustedProbability =
            sluiceLuckAdjustedProbability(
                baseProbability,
                luck
            );

        /*
           Expected time is based on the current
           sluice production rate and the adjusted
           chance of receiving the ore.
        */

        let timeToOre = Infinity;

        if (
            adjustedProbability > 0 &&
            mineralsPerSecond > 0
        ) {
            const expectedMinerals =
                1 / adjustedProbability;

            timeToOre =
                expectedMinerals /
                mineralsPerSecond;
        }

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${mineral.mineral}</td>
            <td>${sluiceFmtPct(baseProbability, 5)}</td>
            <td>${sluiceFmtPct(adjustedProbability, 5)}</td>
            <td>~1 in ${sluiceFmtOneInFromProb(adjustedProbability)}</td>
            <td>${sluiceFmtDuration(timeToOre)}</td>
        `;

        tbody.appendChild(tr);
    }
}

/* =========================================================
   MAIN CALCULATION
========================================================= */

function calculateSluice() {
    const selected = sluices.find(
        sluice =>
            sluice.name === sluiceSelect?.value
    );

    if (!selected) return;

    const luck = Math.max(
        0,
        Number(sluiceLuckInput?.value) || 0
    );

    const capacity = Math.max(
        1,
        Number(sluiceCapacityInput?.value) || 1
    );

    const efficiency = Math.max(
        0,
        Number(sluiceEfficiencyInput?.value) || 0
    );

    const mineralsPer10 = efficiency;
    const mineralsPerMinute =
        mineralsPer10 / 10;

    const mineralsPerHour =
        mineralsPerMinute * 60;

    const mineralsPerDay =
        mineralsPerHour * 24;

    const fillTime =
        getSluiceTimeToFillSeconds();

    const luckDisplay =
        document.getElementById(
            "sluiceLuckDisplay"
        );

    if (luckDisplay) {
        luckDisplay.textContent =
            luck.toLocaleString();
    }

    const capacityDisplay =
        document.getElementById(
            "sluiceCapacityDisplay"
        );

    if (capacityDisplay) {
        capacityDisplay.textContent =
            capacity.toLocaleString();
    }

    const efficiencyDisplay =
        document.getElementById(
            "sluiceEfficiencyDisplay"
        );

    if (efficiencyDisplay) {
        efficiencyDisplay.textContent =
            efficiency.toLocaleString();
    }

    const minerals10Display =
        document.getElementById("sluice10Min");

    if (minerals10Display) {
        minerals10Display.textContent =
            mineralsPer10.toFixed(2);
    }

    const mineralsHourDisplay =
        document.getElementById("sluiceHour");

    if (mineralsHourDisplay) {
        mineralsHourDisplay.textContent =
            mineralsPerHour.toFixed(2);
    }

    const mineralsDayDisplay =
        document.getElementById("sluiceDay");

    if (mineralsDayDisplay) {
        mineralsDayDisplay.textContent =
            mineralsPerDay.toFixed(2);
    }

    const fillDisplay =
        document.getElementById(
            "sluiceFillTime"
        );

    if (fillDisplay) {
        fillDisplay.textContent =
            sluiceFmtDuration(fillTime);
    }

    const locationDisplay =
        document.getElementById(
            "sluiceLocationDisplay"
        );

    if (locationDisplay) {
        locationDisplay.textContent =
            sluiceLocationSelect?.value || "—";
    }

    buildSluiceMineralTable();

    const calculationNote =
        document.getElementById(
            "sluiceCalculationNote"
        );

    if (calculationNote) {
        calculationNote.textContent =
            `Luck=${luck.toLocaleString()} · ` +
            `Capacity=${capacity.toLocaleString()} · ` +
            `Efficiency=${efficiency.toLocaleString()} · ` +
            `Production=${mineralsPer10.toFixed(2)} minerals/10m · ` +
            `Fill time=${sluiceFmtDuration(fillTime)}`;
    }
}

/* =========================================================
   UI LABELS
========================================================= */

function updateSluiceLabels() {
    const selected = sluices.find(
        sluice =>
            sluice.name === sluiceSelect?.value
    );

    if (!selected) return;

    const name =
        document.getElementById("sluiceName");

    if (name) {
        name.textContent = selected.name;
    }

    const baseLuck =
        document.getElementById(
            "sluiceBaseLuck"
        );

    if (baseLuck) {
        baseLuck.textContent =
            selected.stats?.luck
                ?.toLocaleString() ?? "—";
    }

    const baseCapacity =
        document.getElementById(
            "sluiceBaseCapacity"
        );

    if (baseCapacity) {
        baseCapacity.textContent =
            selected.stats?.capacity
                ?.toLocaleString() ?? "—";
    }

    const baseEfficiency =
        document.getElementById(
            "sluiceBaseEfficiency"
        );

    if (baseEfficiency) {
        baseEfficiency.textContent =
            selected.stats?.efficiency
                ?.toLocaleString() ?? "—";
    }

    const baseToughness =
        document.getElementById(
            "sluiceBaseToughness"
        );

    if (baseToughness) {
        baseToughness.textContent =
            selected.stats?.toughness
                ?.toLocaleString() ?? "—";
    }
}

/* =========================================================
   EVENTS
========================================================= */

if (sluiceSelect) {
    sluiceSelect.addEventListener(
        "change",
        loadSelectedSluiceStats
    );
}

if (sluiceSearch) {
    sluiceSearch.addEventListener(
        "input",
        () => populateSluices(false)
    );
}

[
    sluiceLocationSelect,
    sluiceLuckInput,
    sluiceCapacityInput,
    sluiceEfficiencyInput,
    sluiceSelfPropulsionInput,
    sluiceAutocollectInput
].forEach(element => {
    if (!element) return;

    element.addEventListener(
        "input",
        calculateSluice
    );

    element.addEventListener(
        "change",
        calculateSluice
    );
});

if (sluiceLocationFilter) {
    sluiceLocationFilter.addEventListener(
        "change",
        () => {
            if (!sluiceLocationSelect) return;

            const selected =
                sluiceLocationFilter.value;

            if (selected === "all") {
                populateSluiceLocations();
                return;
            }

            const exists =
                [...sluiceLocationSelect.options]
                    .some(
                        option =>
                            option.value === selected
                    );

            if (exists) {
                sluiceLocationSelect.value =
                    selected;
            }

            calculateSluice();
        }
    );
}