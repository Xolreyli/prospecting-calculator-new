let minerals = [];
let filtered = [];
let allLocationNames = new Set();

const mineralSelect   = document.getElementById("mineralSelect");
const mineralSearch   = document.getElementById("mineralSearch");
const rarityFilter    = document.getElementById("rarityFilter");
const locationSelect  = document.getElementById("locationSelect");
const locationFilter  = document.getElementById("locationFilter");
const luckInput       = document.getElementById("luckInput");
const capacityInput   = document.getElementById("capacityInput");

const timeMethod      = document.getElementById("timeMethod");
const shakeSpeedInput = document.getElementById("shakeSpeedInput");
const sInput          = document.getElementById("sInput");
const nInput          = document.getElementById("nInput");
const dInput          = document.getElementById("dInput");
const autopanExtras   = document.getElementById("autopanExtras");

const MAX_SHAKE = 3000;


/* -------------------------
   STAT / FORMAT HELPERS
------------------------- */

function fmtPct(x, digits = 5) {
  if (!isFinite(x)) return "—";
  return (x * 100).toFixed(digits) + "%";
}

function fmtOneInFromProb(p) {
  if (!isFinite(p) || p <= 0) return "∞";
  return Math.round(1 / p).toLocaleString();
}

function attemptsForTarget(pAttempt, target) {
  if (!isFinite(pAttempt) || pAttempt <= 0) return Infinity;
  if (pAttempt >= 1) return 1;
  return Math.log(1 - target) / Math.log(1 - pAttempt);
}

function fmtDuration(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "—";
  if (seconds === Infinity) return "∞";

  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}


/* -------------------------
   SHAKE SPEED % -> SHAKES/SECOND
------------------------- */

const SHAKE_SPEED_DATA = [
  [304, 6.43776824],
  [353, 5.244755245],
  [399, 5.752636625],
  [449, 8.462623413],
  [501, 7.067137809],
  [554, 6.802721088],
  [600, 9.360374415],
  [650, 9.009009009],
  [700, 7.761966365],
  [752, 8.287292818],
  [804, 7.947019868],
  [847, 8.053691275],
  [901, 10.657193606],
  [952, 11.152416357],
  [999, 10.733452594],
  [1046, 10],
  [1104, 9.493670886],
  [1148, 9.433962264],
  [1203, 10.23890785],
  [1249, 10.221465077],
  [1303, 9.868421053],
  [1346, 10.204081633],
  [1397, 10.291595197],
  [1449, 10.23890785],
  [1498, 10.434782609],
  [1553, 10.050251256],
  [1597, 10.327022375],
  [1650, 10.526315789],
  [1702, 10.676156584],
  [1751, 12.631578947],
  [1803, 12.345679012],
  [1849, 12.422360248],
  [1899, 12.875536481],
  [1951, 12.195121951],
  [2000, 12.345679012]
];

function shakeSpeedToR(value) {
  const shakeSpeed = Number(value);

  if (!Number.isFinite(shakeSpeed) || shakeSpeed < 0) return 0;

  const first = SHAKE_SPEED_DATA[0];
  const last = SHAKE_SPEED_DATA[SHAKE_SPEED_DATA.length - 1];

  if (shakeSpeed <= first[0]) return first[1];
  if (shakeSpeed >= last[0]) return last[1];

  for (let i = 0; i < SHAKE_SPEED_DATA.length - 1; i++) {
    const [speedA, shakesA] = SHAKE_SPEED_DATA[i];
    const [speedB, shakesB] = SHAKE_SPEED_DATA[i + 1];

    if (shakeSpeed >= speedA && shakeSpeed <= speedB) {
      const position =
        (shakeSpeed - speedA) / (speedB - speedA);

      return shakesA + ((shakesB - shakesA) * position);
    }
  }

  return 0;
}


/* -------------------------
   CYCLE TIME MODEL
------------------------- */

function getCycleSeconds(C) {
  const shakeSpeed =
    Math.max(0, Number(shakeSpeedInput?.value) || 0);

  const strength =
    Math.max(0.0001, Number(sInput?.value) || 0.0001);

  const totalDigs =
    Math.max(0, Number(nInput?.value) || 0);

  const digSpeed =
    Math.max(0.0001, Number(dInput?.value) || 0.0001);

  const shakesPerSecond =
    shakeSpeedToR(shakeSpeed);

  if (shakesPerSecond <= 0) return Infinity;

  /*
   * Total shakes required for the pan.
   */
  const totalShakes = C / strength;

  const shakeDuration =
    totalShakes / shakesPerSecond;

  /*
   * Shared duration of one dig.
   */
  const digDuration =
    143.9 * Math.pow(digSpeed, -0.9324);

  if (timeMethod?.value === "autopan") {
    return (
      shakeDuration +
      1.15 +
      (totalDigs * digDuration)
    );
  }

  return (
    shakeDuration +
    0.75 +
    (Math.max(0, totalDigs - 1) * digDuration)
  );
}


/* -------------------------
   UI
------------------------- */

function syncAutopanUI() {
  if (!autopanExtras || !timeMethod) return;

  autopanExtras.style.display =
    timeMethod.value === "autopan"
      ? ""
      : "none";
}


/* -------------------------
   DATA LOAD
------------------------- */

fetch("./minerals.json?v=" + Date.now())
  .then(r => r.json())
  .then(d => {

    minerals =
      (d.minerals || [])
        .slice()
        .sort((a, b) =>
          a.mineral.localeCompare(
            b.mineral,
            "en",
            { sensitivity: "base" }
          )
        );

    /*
     * Build the location filter.
     *
     * This filter ONLY affects the table.
     * It does NOT affect the large stat boxes.
     */
    for (const m of minerals) {
      for (const loc of (m.locations || [])) {

        if (loc.location) {
          allLocationNames.add(loc.location);
        }

      }
    }

    if (locationFilter) {

      const locs =
        [...allLocationNames]
          .sort((a, b) =>
            a.localeCompare(b)
          );

      for (const name of locs) {

        const opt =
          document.createElement("option");

        opt.value = name;
        opt.textContent = name;

        locationFilter.appendChild(opt);
      }
    }

    filtered = minerals.slice();

    populateMinerals(true);
  })
  .catch(err => {
    console.error(
      "Failed to load minerals.json:",
      err
    );
  });


/* -------------------------
   EVENTS
------------------------- */

[
  mineralSelect,
  locationSelect,
  luckInput,
  capacityInput,
  locationFilter,
  timeMethod,
  shakeSpeedInput,
  sInput,
  nInput,
  dInput
].forEach(el => {

  if (!el) return;

  el.addEventListener("input", () => {

    if (el === mineralSelect) {
      populateLocations();
      return;
    }

    if (el === timeMethod) {
      syncAutopanUI();
    }

    calculate();
  });

});


if (rarityFilter) {

  rarityFilter.addEventListener(
    "change",
    () => populateMinerals(false)
  );

}


if (mineralSearch) {

  mineralSearch.addEventListener(
    "input",
    () => populateMinerals(false)
  );

}


if (locationFilter) {

  locationFilter.addEventListener(
    "change",
    calculate
  );

}


if (timeMethod) {
  timeMethod.value = "autopan";
}

syncAutopanUI();


/* -------------------------
   DROPDOWNS
------------------------- */

function populateMinerals(keepSelection) {

  const q =
    (mineralSearch?.value || "")
      .toLowerCase();

  const r =
    rarityFilter?.value || "all";

  const prev =
    keepSelection
      ? mineralSelect?.value
      : null;


  filtered =
    minerals.filter(m => {

      const okName =
        (m.mineral || "")
          .toLowerCase()
          .includes(q);

      const okRarity =
        r === "all"
          ? true
          : (m.rarity || "") === r;

      return okName && okRarity;
    });


  if (!mineralSelect) return;

  mineralSelect.innerHTML = "";


  for (const m of filtered) {

    const opt =
      document.createElement("option");

    opt.value = m.mineral;
    opt.textContent = m.mineral;

    mineralSelect.appendChild(opt);
  }


  if (
    prev &&
    filtered.some(
      m => m.mineral === prev
    )
  ) {

    mineralSelect.value = prev;
  }


  populateLocations();
}


/* -------------------------
   LOCATION DROPDOWN
------------------------- */

function populateLocations() {

  const m =
    filtered.find(
      x =>
        x.mineral ===
        mineralSelect?.value
    ) ||
    minerals.find(
      x =>
        x.mineral ===
        mineralSelect?.value
    );


  if (!m || !locationSelect) {

    if (locationSelect) {
      locationSelect.innerHTML = "";
    }

    calculate();
    return;
  }


  const prevLoc =
    locationSelect.options.length
      ? locationSelect
          .options[
            locationSelect.selectedIndex
          ]?.textContent
      : null;


  locationSelect.innerHTML = "";


  for (const l of (m.locations || [])) {

    const opt =
      document.createElement("option");

    opt.value =
      String(l.chance_percent);

    opt.textContent =
      l.location;

    locationSelect.appendChild(opt);
  }


  if (prevLoc) {

    const idx =
      [...locationSelect.options]
        .findIndex(
          o =>
            o.textContent ===
            prevLoc
        );

    locationSelect.selectedIndex =
      idx >= 0
        ? idx
        : 0;

  } else {

    locationSelect.selectedIndex = 0;
  }


  calculate();
}


/* -------------------------
   MAIN CALC
------------------------- */

function calculate() {

  const selectedMineral =
    mineralSelect?.value;

  const m =
    minerals.find(
      x =>
        x.mineral ===
        selectedMineral
    ) ||
    filtered.find(
      x =>
        x.mineral ===
        selectedMineral
    );


  if (
    !m ||
    !locationSelect?.value
  ) {
    return;
  }


  const luck =
    Math.max(
      0,
      Number(luckInput?.value) || 0
    );

  const C =
    Math.max(
      1,
      Number(capacityInput?.value) || 1
    );


  /*
   * Rolls produced by one completed pan.
   */
  const rollsPerPan =
    luck * Math.sqrt(C);


  /*
   * Cycle time is independent of mineral/location.
   */
  const cycleSeconds =
    getCycleSeconds(C);


  const rollsPerSecond =
    isFinite(cycleSeconds) &&
    cycleSeconds > 0
      ? rollsPerPan / cycleSeconds
      : 0;


  const pansPerMinute =
    isFinite(cycleSeconds) &&
    cycleSeconds > 0
      ? 60 / cycleSeconds
      : 0;


  const shakeSpeed =
    Math.max(
      0,
      Number(shakeSpeedInput?.value) || 0
    );

  const r =
    shakeSpeedToR(shakeSpeed);


  const strength =
    Math.max(
      0.0001,
      Number(sInput?.value) || 0.0001
    );


  const totalShakes =
    C / strength;


  const n =
    Math.max(
      0,
      Number(nInput?.value) || 0
    );


  const d =
    Math.max(
      0.0001,
      Number(dInput?.value) || 0.0001
    );


  let cycleFormulaText = "";
  let methodStatsText = "";


  if (timeMethod?.value === "autopan") {

    cycleFormulaText =
      `Autopan cycle = (C/Strength)/Ss + 1.15 + Td×(143.9×Sd^-0.9324) = ` +
      `(${C.toFixed(2)}/${strength.toFixed(2)})/${r.toFixed(2)} + 1.15 + ` +
      `${n.toFixed(2)}×(143.9×${d.toFixed(2)}^-0.9324)`;


    methodStatsText =
      `Strength=${strength.toFixed(2)} · ` +
      `Derived total shakes Ts=${totalShakes.toFixed(2)} · ` +
      `Total digs Td=${n.toFixed(2)} · ` +
      `Dig speed Sd=${d.toFixed(2)} · `;

  } else {

    cycleFormulaText =
      `Sandshaking cycle = (C/Strength)/Ss + 0.75 + (Td−1)×(143.9×Sd^-0.9324) = ` +
      `(${C.toFixed(2)}/${strength.toFixed(2)})/${r.toFixed(2)} + 0.75 + ` +
      `(${n.toFixed(2)}−1)×(143.9×${d.toFixed(2)}^-0.9324)`;


    methodStatsText =
      `Strength=${strength.toFixed(2)} · ` +
      `Derived total shakes Ts=${totalShakes.toFixed(2)} · ` +
      `Total digs Td=${n.toFixed(2)} · ` +
      `Dig speed Sd=${d.toFixed(2)} · `;
  }


  const rollsNote =
    document.getElementById(
      "rollsNote"
    );


  if (rollsNote) {

    rollsNote.textContent =
      `Effective rolls per pan: ${rollsPerPan.toFixed(2)} ` +
      `(Luck ${luck} × √Capacity ${Math.sqrt(C).toFixed(2)}) · ` +
      `Shake speed ${shakeSpeed.toFixed(0)}% ⇒ ${r.toFixed(2)} shakes/sec · ` +
      methodStatsText +
      `${cycleFormulaText} · ` +
      `Cycle time: ${
        isFinite(cycleSeconds)
          ? cycleSeconds.toFixed(2) + "s"
          : "∞"
      } · ` +
      `Rolls/sec: ${
        isFinite(rollsPerSecond)
          ? rollsPerSecond.toFixed(4)
          : "—"
      } · ` +
      `Pans/min: ${
        isFinite(pansPerMinute)
          ? pansPerMinute.toFixed(2)
          : "—"
      }`;
  }


  const mineralLabel =
    document.getElementById(
      "mineralLabel"
    );

  if (mineralLabel) {
    mineralLabel.textContent =
      `Mineral: ${m.mineral}`;
  }


  const rarity =
    m.rarity || "unknown";


  const rarityTag =
    document.getElementById(
      "rarityTag"
    );

  if (rarityTag) {
    rarityTag.textContent = rarity;
  }


  const c =
    rarityColor(rarity);

  const rarityDot =
    document.getElementById(
      "rarityDot"
    );


  if (rarityDot) {

    rarityDot.style.background = c;

    rarityDot.style.boxShadow =
      `0 0 0 3px ${c}22`;
  }


  /* =====================================================
     BEST LOCATION
     
     IMPORTANT:
     The large boxes ALWAYS use the best location.
     
     The location filter below ONLY affects the table.
  ===================================================== */

  const validLocations =
    (m.locations || [])
      .map(l => ({
        ...l,
        numericChance:
          Number(l.chance_percent)
      }))
      .filter(
        l =>
          Number.isFinite(l.numericChance) &&
          l.numericChance > 0
      );


  const bestLocationData =
    validLocations.length
      ? validLocations.reduce(
          (best, current) =>
            current.numericChance >
            best.numericChance
              ? current
              : best
        )
      : null;


  /*
   * Use the BEST location for the big boxes.
   */
  const basePercent =
    bestLocationData
      ? bestLocationData.numericChance
      : 0;


  const p =
    basePercent / 100;


  const pAttempt =
    1 - Math.pow(
      1 - p,
      rollsPerPan
    );


  const expected =
    rollsPerPan * p;


  const a50 =
    attemptsForTarget(
      pAttempt,
      0.50
    );


  const a90 =
    attemptsForTarget(
      pAttempt,
      0.90
    );


  const a99 =
    attemptsForTarget(
      pAttempt,
      0.99
    );


  const t50 =
    isFinite(a50) &&
    isFinite(cycleSeconds)
      ? a50 * cycleSeconds
      : Infinity;


  const t90 =
    isFinite(a90) &&
    isFinite(cycleSeconds)
      ? a90 * cycleSeconds
      : Infinity;


  const t99 =
    isFinite(a99) &&
    isFinite(cycleSeconds)
      ? a99 * cycleSeconds
      : Infinity;


  /*
   * Display which location the big boxes are using.
   */
  const bestLocation =
    document.getElementById(
      "bestLocation"
    );


  if (bestLocation) {

    bestLocation.textContent =
      bestLocationData
        ? `${bestLocationData.location} (~1 in ${fmtOneInFromProb(pAttempt)})`
        : "—";
  }


  /* -------------------------
     BIG STAT BOXES
  ------------------------- */

  const chanceCell =
    document.getElementById(
      "chanceCell"
    );

  if (chanceCell) {
    chanceCell.textContent =
      fmtPct(pAttempt, 5);
  }


  const oneInAttempt =
    document.getElementById(
      "oneInAttempt"
    );

  if (oneInAttempt) {

    oneInAttempt.textContent =
      `~1 in ${fmtOneInFromProb(pAttempt)} (pan)`;
  }


  const expectedCell =
    document.getElementById(
      "expectedCell"
    );

  if (expectedCell) {
    expectedCell.textContent =
      expected.toFixed(4);
  }


  const expectedSub =
    document.getElementById(
      "expectedSub"
    );

  if (expectedSub) {

    expectedSub.textContent =
      `Expected finds per pan · 99% pans: ${
        isFinite(a99)
          ? a99.toFixed(2)
          : "∞"
      }`;
  }


  const atLeastOneCell =
    document.getElementById(
      "atLeastOneCell"
    );

  if (atLeastOneCell) {
    atLeastOneCell.textContent =
      fmtPct(pAttempt, 2);
  }


  const atLeastSub =
    document.getElementById(
      "atLeastSub"
    );

  if (atLeastSub) {

    atLeastSub.textContent =
      `Chance of ≥1 in one pan · 99% time: ${
        fmtDuration(t99)
      }`;
  }


  /* =====================================================
     ALL LOCATIONS TABLE

     The location filter ONLY affects this table.
  ===================================================== */

  const tbody =
    document.getElementById(
      "allLocationsTable"
    );


  if (!tbody) return;


  tbody.innerHTML = "";


  const locFilterVal =
    locationFilter?.value || "all";


  const rows = [];


  for (const l of (m.locations || [])) {

    /*
     * Filter only the table.
     */
    if (
      locFilterVal !== "all" &&
      l.location !== locFilterVal
    ) {
      continue;
    }


    const bp =
      Number(l.chance_percent) / 100;


    const pAtt =
      1 - Math.pow(
        1 - bp,
        rollsPerPan
      );


    const row50 =
      attemptsForTarget(
        pAtt,
        0.50
      );


    const row90 =
      attemptsForTarget(
        pAtt,
        0.90
      );


    const row99 =
      attemptsForTarget(
        pAtt,
        0.99
      );


    const rowT50 =
      isFinite(row50) &&
      isFinite(cycleSeconds)
        ? row50 * cycleSeconds
        : Infinity;


    const rowT90 =
      isFinite(row90) &&
      isFinite(cycleSeconds)
        ? row90 * cycleSeconds
        : Infinity;


    const rowT99 =
      isFinite(row99) &&
      isFinite(cycleSeconds)
        ? row99 * cycleSeconds
        : Infinity;


    rows.push({

      location:
        l.location,

      basePercent:
        Number(l.chance_percent),

      baseOneIn:
        fmtOneInFromProb(bp),

      pAtt,

      attemptOneIn:
        fmtOneInFromProb(pAtt),

      a50:
        row50,

      a90:
        row90,

      a99:
        row99,

      t50:
        rowT50,

      t90:
        rowT90,

      t99:
        rowT99
    });
  }


  /*
   * Highlight the actual BEST location,
   * even when the table is filtered.
   */
  for (const rRow of rows) {

    const tr =
      document.createElement("tr");


    if (
      bestLocationData &&
      rRow.location ===
        bestLocationData.location
    ) {

      tr.classList.add(
        "bestRow"
      );
    }


    tr.innerHTML = `
      <td>${rRow.location}</td>

      <td>
        ${rRow.basePercent.toFixed(8)}%
      </td>

      <td>
        ~1 in ${rRow.baseOneIn}
      </td>

      <td>
        ${fmtPct(rRow.pAtt, 5)}
      </td>

      <td>
        ~1 in ${rRow.attemptOneIn}
      </td>

      <td>
        ${
          isFinite(rRow.a50)
            ? rRow.a50.toFixed(2)
            : "∞"
        }
      </td>

      <td>
        ${
          isFinite(rRow.a90)
            ? rRow.a90.toFixed(2)
            : "∞"
        }
      </td>

      <td>
        ${
          isFinite(rRow.a99)
            ? rRow.a99.toFixed(2)
            : "∞"
        }
      </td>

      <td>
        ${fmtDuration(rRow.t50)}
      </td>

      <td>
        ${fmtDuration(rRow.t90)}
      </td>

      <td>
        ${fmtDuration(rRow.t99)}
      </td>
    `;


    tbody.appendChild(tr);
  }
}