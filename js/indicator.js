// js/indicator.js

const INDICATOR_RULES = [
  {
    id: "01",
    sig: "[2/1/1/1]",
    desc: "1 Pasang planet membentuk 1 jenis aspek resmi astrologi.",
  },
  {
    id: "02",
    sig: "[4/2/1/0]",
    desc: "2 Pasang planet berbeda terpisah, memiliki nilai derajat acak yang SAMA.",
  },
  {
    id: "03",
    sig: "[3/2/1/0]",
    desc: "2 Pasang planet berpusat pada 1 planet jangkar, memiliki derajat acak yang SAMA.",
  },
  {
    id: "04",
    sig: "[4/2/1/1]",
    desc: "2 Pasang planet berbeda terpisah, membentuk jenis aspek resmi yang SAMA.",
  },
  {
    id: "05",
    sig: "[3/2/2/2]",
    desc: "2 Pasang planet berpusat pada 1 planet jangkar, membentuk 2 aspek BERBEDA.",
  },
  {
    id: "06",
    sig: "[3/2/1/1]",
    desc: "2 Pasang planet berpusat pada 1 planet jangkar, membentuk aspek yang SAMA.",
  },
  {
    id: "07",
    sig: "[3/3/1/1]",
    desc: "3 Planet saling mengunci satu sama lain membentuk segitiga aspek SEJENIS.",
  },
];

function analyzeMatrixIndicators(matrixType, items, date) {
  const validPairs = [];

  // First, collect all eligible relations
  for (let rowIndex = 0; rowIndex < items.length; rowIndex++) {
    for (let colIndex = rowIndex + 1; colIndex < items.length; colIndex++) {
      const rowItem = items[rowIndex];
      const colItem = items[colIndex];

      let isEligible = false;
      try {
        const identity = new Identity(rowItem, colItem, date);
        if (matrixType === "ZENITH") {
          isEligible = identity.isZenithZone;
        } else if (matrixType === "NADIR") {
          isEligible = identity.isNadirZone;
        } else if (matrixType === "MATRIX") {
          const isCrossDome = identity.isZenithSideA !== identity.isZenithSideB;
          if (!isCrossDome) {
            isEligible = true;
          } else {
            if (identity.isZenithSideA) {
              isEligible = true;
            }
          }
        }

        if (
          isEligible &&
          identity.statsA &&
          identity.statsB &&
          identity.theta !== null
        ) {
          const sortedIds = [identity.entityA.id, identity.entityB.id].sort();
          const pairId = `${sortedIds[0]}-${sortedIds[1]}`;
          if (!validPairs.find((v) => v.pairId === pairId)) {
            validPairs.push({
              pairId: pairId,
              p1: identity.entityA,
              p2: identity.entityB,
              theta: identity.theta,
              aspect: identity.aspect, // may be null
            });
          }
        }
      } catch (e) {}
    }

    // Also check lower triangle for cross-dome because Zenith > Nadir vs Nadir > Zenith
    if (matrixType === "MATRIX") {
      for (let colIndex = 0; colIndex < rowIndex; colIndex++) {
        const rowItem = items[rowIndex];
        const colItem = items[colIndex];

        let isEligible = false;
        try {
          const identity = new Identity(rowItem, colItem, date);
          const isCrossDome = identity.isZenithSideA !== identity.isZenithSideB;
          if (isCrossDome && identity.isNadirSideA) {
            isEligible = true;
          }
          if (
            isEligible &&
            identity.statsA &&
            identity.statsB &&
            identity.theta !== null
          ) {
            const sortedIds = [identity.entityA.id, identity.entityB.id].sort();
            const pairId = `${sortedIds[0]}-${sortedIds[1]}`;
            if (!validPairs.find((v) => v.pairId === pairId)) {
              validPairs.push({
                pairId: pairId,
                p1: identity.entityA,
                p2: identity.entityB,
                theta: identity.theta,
                aspect: identity.aspect,
              });
            }
          }
        } catch (e) {}
      }
    }
  }

  const results = {
    "00": [],
    "01": [],
    "02": [],
    "03": [],
    "04": [],
    "05": [],
    "06": [],
    "07": [],
  };

  validPairs.forEach((pair) => {
    if (!pair.aspect) {
      results["00"].push([pair]);
    } else {
      results["01"].push([pair]);
    }
  });

  const noAspectPairs = validPairs.filter((p) => !p.aspect);
  const aspectPairs = validPairs.filter((p) => p.aspect);

  for (let i = 0; i < noAspectPairs.length; i++) {
    for (let j = i + 1; j < noAspectPairs.length; j++) {
      const pA = noAspectPairs[i];
      const pB = noAspectPairs[j];
      const aMap = [pA.p1.id, pA.p2.id];
      const bMap = [pB.p1.id, pB.p2.id];

      const shared = aMap.filter((x) => bMap.includes(x));
      const angleMatch = Math.round(pA.theta) === Math.round(pB.theta);

      if (angleMatch) {
        if (shared.length === 0) {
          results["02"].push([pA, pB]);
        } else if (shared.length === 1) {
          results["03"].push([pA, pB]);
        }
      }
    }
  }

  for (let i = 0; i < aspectPairs.length; i++) {
    for (let j = i + 1; j < aspectPairs.length; j++) {
      const pA = aspectPairs[i];
      const pB = aspectPairs[j];
      const aMap = [pA.p1.id, pA.p2.id];
      const bMap = [pB.p1.id, pB.p2.id];

      const shared = aMap.filter((x) => bMap.includes(x));
      const sameAspect = pA.aspect.id === pB.aspect.id;

      if (shared.length === 0 && sameAspect) {
        results["04"].push([pA, pB]);
      } else if (shared.length === 1) {
        if (!sameAspect) {
          results["05"].push([pA, pB]);
        } else {
          results["06"].push([pA, pB]);
        }
      }
    }
  }

  for (let i = 0; i < aspectPairs.length; i++) {
    for (let j = i + 1; j < aspectPairs.length; j++) {
      for (let k = j + 1; k < aspectPairs.length; k++) {
        const pA = aspectPairs[i];
        const pB = aspectPairs[j];
        const pC = aspectPairs[k];
        if (pA.aspect.id === pB.aspect.id && pB.aspect.id === pC.aspect.id) {
          const nodes = new Set([
            pA.p1.id,
            pA.p2.id,
            pB.p1.id,
            pB.p2.id,
            pC.p1.id,
            pC.p2.id,
          ]);
          if (nodes.size === 3) {
            results["07"].push([pA, pB, pC]);
          }
        }
      }
    }
  }

  let activeTz = "UTC";
  if (
    typeof state !== "undefined" &&
    state.subjects &&
    state.subjects.length > 0
  ) {
    activeTz = state.subjects[0].timezone || "UTC";
  }

  let timeSignature = "";
  const { DateTime } = window.luxon || {};
  if (DateTime) {
    try {
      const dt = DateTime.fromJSDate(new Date(date)).setZone(activeTz);
      const y = dt.toFormat("yyyy");
      const m = dt.toFormat("MM");
      const d = dt.toFormat("dd");
      const day = dt.toFormat("EEE").toUpperCase();
      const offsetHours = dt.offset / 60;
      let zoneStr = offsetHours.toString();
      if (offsetHours >= 0 && !zoneStr.startsWith("+")) {
        zoneStr = "+" + zoneStr;
      }
      const h = dt.toFormat("HH");
      const min = dt.toFormat("mm");
      const sStr = dt.toFormat("ss");
      timeSignature = `${y}_${m}_${d}_${day}_${zoneStr}_${h}_${min}_${sStr}`;
    } catch (e) {
      console.error(e);
    }
  }

  if (!timeSignature) {
    const dateObj = new Date(date);
    const y = dateObj.getFullYear();
    const mF = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const day = days[dateObj.getDay()];
    const offset = -dateObj.getTimezoneOffset() / 60;
    const zoneStr = (offset >= 0 ? "+" : "") + offset;
    const h = String(dateObj.getHours()).padStart(2, "0");
    const min = String(dateObj.getMinutes()).padStart(2, "0");
    const sStr = String(dateObj.getSeconds()).padStart(2, "0");
    timeSignature = `${y}_${mF}_${d}_${day}_${zoneStr}_${h}_${min}_${sStr}`;
  }

  let html = "";
  INDICATOR_RULES.forEach((rule) => {
    const hits = results[rule.id] || [];
    if (hits.length === 0) return;

    const logId = `${rule.id}_${timeSignature}`;

    let logTextLines = [];
    logTextLines.push(`=== INDICATOR ${rule.id} ===`);
    logTextLines.push(`SIG: ${rule.sig}`);
    logTextLines.push(`DESC: ${rule.desc}`);
    logTextLines.push(`LOGS (${hits.length}):`);

    let instancesHtml = "";
    hits.forEach((hit, hitIndex) => {
      let hitText = `<div class="mb-2 p-1.5 border border-dashed border-neutral-300 dark:border-neutral-700">`;
      hit.forEach((pairItem) => {
        const aName = `${pairItem.p1.symbol} ${pairItem.p1.shortName || pairItem.p1.id.substring(0, 3)}`;
        const bName = `${pairItem.p2.symbol} ${pairItem.p2.shortName || pairItem.p2.id.substring(0, 3)}`;
        const rel = pairItem.aspect
          ? pairItem.aspect.name.toUpperCase()
          : `${Math.round(pairItem.theta)}°`;
        hitText += `<div class="text-[9px] font-mono leading-tight mb-1 truncate text-black dark:text-white">[\u2022] ${aName} - ${bName} = ${rel}</div>`;
        logTextLines.push(`[\u2022] ${aName} - ${bName} = ${rel}`);
      });
      hitText += `<div class="text-[8px] text-neutral-400 dark:text-neutral-500 font-mono mt-1 pt-1 border-t border-neutral-200 dark:border-neutral-800">LOG_ID: ${logId}</div>`;
      hitText += `</div>`;
      instancesHtml += `<div class="w-full">${hitText}</div>`;

      logTextLines.push(`LOG_ID: ${logId}`);
      logTextLines.push(``); // Blank line between hits
    });

    // Add raw text data back to the card using a hidden element
    const rawData = encodeURIComponent(logTextLines.join("\n"));

    html += `
        <div class="indicator-card shrink-0 w-[240px] border border-black dark:border-neutral-700 bg-white dark:bg-black flex flex-col shadow-sm" data-log-text="${rawData}">
            <div class="px-3 py-2 border-b border-dashed border-neutral-300 dark:border-neutral-700 flex justify-between items-center bg-neutral-100 dark:bg-neutral-900">
                <span class="text-lg font-black font-sans tracking-tight text-black dark:text-white">${rule.id}</span>
                <span class="text-[9px] font-mono font-bold bg-white dark:bg-black px-1 border border-neutral-300 dark:border-neutral-700 text-black dark:text-white">${rule.sig}</span>
            </div>
            <div class="px-3 py-3 grow flex flex-col bg-transparent">
                <p class="text-[10px] leading-snug font-mono text-neutral-800 dark:text-neutral-300 mb-4">${rule.desc}</p>
                <div class="mt-auto border border-neutral-200 dark:border-neutral-800">
                    <div class="bg-neutral-50 dark:bg-neutral-900 p-1 border-b border-neutral-200 dark:border-neutral-800 text-[8px] font-bold tracking-wider font-mono text-black dark:text-white uppercase flex items-center justify-between">
                        <span>LOG</span>
                        <span class="bg-black dark:bg-white text-white dark:text-black px-1 rounded-sm">${hits.length}</span>
                    </div>
                    <div class="max-h-[80px] overflow-y-auto p-1.5 custom-scrollbar bg-white dark:bg-black">
                        ${instancesHtml}
                    </div>
                </div>
            </div>
        </div>
        `;
  });

  return html;
}

// Set up copy listeners when script loads
document.addEventListener("DOMContentLoaded", () => {
  const attachCopyListener = (btnId, containerId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const container = document.getElementById(containerId);
      if (!container) return;

      const cards = container.querySelectorAll(".indicator-card");
      let allText = [];
      cards.forEach((c) => {
        let data = c.getAttribute("data-log-text");
        if (data) {
          allText.push(decodeURIComponent(data));
        }
      });

      if (allText.length === 0) {
        alert("No logs to copy.");
        return;
      }

      const copyStr = allText.join("\n\n");
      navigator.clipboard
        .writeText(copyStr)
        .then(() => {
          const originalHTML = btn.innerHTML;
          btn.innerHTML = `<i data-feather="check" class="w-3.5 h-3.5 text-green-500 pointer-events-none"></i>`;
          if (window.feather) window.feather.replace();
          setTimeout(() => {
            btn.innerHTML = originalHTML;
            if (window.feather) window.feather.replace();
          }, 2000);
        })
        .catch((e) => {
          alert("Failed to copy logs.");
          console.error(e);
        });
    });
  };

  attachCopyListener("copy-general-log", "general-indicator-container");
  attachCopyListener("copy-zenith-log", "zenith-indicator-container");
  attachCopyListener("copy-nadir-log", "nadir-indicator-container");
});
