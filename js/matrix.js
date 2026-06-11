// js/matrix.js

const ABBREVIATIONS = {
  "subject-terrestrial-zenith": "TZ",
  "subject-terrestrial-nadir": "TN",
  "subject-celestial-zenith": "CZ",
  "subject-celestial-nadir": "CN",
  Sun: "SOL",
  Moon: "LUN",
  Mercury: "MER",
  Venus: "VEN",
  Mars: "MAR",
  Jupiter: "JUP",
  Saturn: "SAT",
  Uranus: "URA",
  Neptune: "NEP",
  Pluto: "PLU",
  Sirius: "SIR",
};

function getMatrixHeaderHTML(entity) {
  const abbrev =
    ABBREVIATIONS[entity.id] || entity.id.substring(0, 3).toUpperCase();
  const symbol = entity.symbol;
  const isZenith = entity.id.includes("zenith");
  const isNadir = entity.id.includes("nadir");

  let markerHTML = "";
  if (isZenith) {
    markerHTML = `<div class="w-[22px] h-[22px] rounded-full border bg-white text-slate-950 border-slate-950 font-black font-mono text-[9px] flex items-center justify-center shadow-xs shrink-0 select-none">
            <span>${symbol}</span>
        </div>`;
  } else if (isNadir) {
    markerHTML = `<div class="w-[22px] h-[22px] rounded-full border border-white dark:border-slate-950 bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-black font-mono text-[9px] flex items-center justify-center shadow-xs shrink-0 select-none">
            <span>${symbol}</span>
        </div>`;
  } else {
    // Celestial body object
    markerHTML = `<div class="w-[22px] h-[22px] rounded-full border border-neutral-950 dark:border-white font-black font-mono text-[9.5px] flex items-center justify-center shadow-xs shrink-0 select-none text-white" style="background-color: ${entity.color || "#64748b"};">
            <span>${symbol}</span>
        </div>`;
  }

  return `<div class="flex flex-col items-center justify-center gap-1.5 py-1 select-none">
        ${markerHTML}
        <span class="text-[9px] font-bold font-mono tracking-wider text-neutral-600 dark:text-neutral-400 uppercase">${abbrev}</span>
    </div>`;
}

function generateMatrixHTML(matrixType) {
  const items = ENTITIES.filter((item) => state.activeBodies.has(item.id)); // Filtered dynamically using activeBodies
  let html = "";

  // Determine the active mode for this matrixType: ANGLE or ASPECT
  let mode = "ANGLE";
  if (matrixType === "ZENITH") {
    mode = state.matrixModeZenith || "ANGLE";
  } else if (matrixType === "NADIR") {
    mode = state.matrixModeNadir || "ANGLE";
  } else {
    mode = state.matrixModeGeneral || "ANGLE";
  }

  // Column Headers
  html +=
    '<thead><tr class="divide-x divide-neutral-200 dark:divide-neutral-800 border-b border-black dark:border-white">';

  // Top Left First Cell (0,0)
  if (matrixType === "ZENITH") {
    html += `<th class="w-[90px] min-w-[90px] px-3 py-3 text-center bg-white dark:bg-black text-[10px] font-black tracking-widest font-sans border-r border-black dark:border-white uppercase text-black dark:text-white">
            ZENITH
        </th>`;
  } else if (matrixType === "NADIR") {
    html += `<th class="w-[90px] min-w-[90px] px-3 py-3 text-center bg-black dark:bg-white text-white dark:text-black text-[10px] font-black tracking-widest font-sans border-r border-black dark:border-white uppercase">
            NADIR
        </th>`;
  } else {
    html += `<th class="w-[90px] min-w-[90px] px-3 py-3 text-center bg-white dark:bg-black text-[10px] font-black tracking-widest font-sans border-r border-black dark:border-white uppercase text-black dark:text-white">
            MATRIX
        </th>`;
  }

  // The rest of the column headers
  items.forEach((item, index) => {
    const headerBadge = getMatrixHeaderHTML(item);
    html += `<th data-matrix-col="${index}" class="w-[80px] min-w-[80px] text-center bg-neutral-50/70 dark:bg-neutral-950/70 py-1 font-semibold leading-none transition-colors duration-150">
            ${headerBadge}
        </th>`;
  });
  html += "</tr></thead>";

  // Data Rows
  html += '<tbody class="divide-y divide-neutral-200 dark:divide-neutral-800">';

  items.forEach((rowItem, rowIndex) => {
    html +=
      '<tr class="divide-x divide-neutral-200 dark:divide-neutral-800 transition-colors hover:bg-neutral-50/20 dark:hover:bg-neutral-900/10">';

    // Row Title (Header Column)
    const rowHeaderBadge = getMatrixHeaderHTML(rowItem);
    html += `<td data-matrix-row="${rowIndex}" class="w-[90px] min-w-[90px] bg-neutral-50/70 dark:bg-neutral-950/70 text-center font-bold border-r border-black dark:border-white py-1.5 shrink-0 select-none transition-colors duration-150">
            ${rowHeaderBadge}
        </td>`;

    // Grid intersections
    items.forEach((colItem, colIndex) => {
      const isDiagonal = rowIndex === colIndex;
      if (isDiagonal) {
        const diagonalBadge = getMatrixHeaderHTML(rowItem);
        html += `<td data-col="${colIndex}" data-row="${rowIndex}" class="matrix-cell w-[80px] min-w-[80px] p-1 bg-neutral-100 dark:bg-neutral-900 text-center scale-95 transition-all cursor-pointer">
                    ${diagonalBadge}
                </td>`;
      } else {
        const isUpper = rowIndex < colIndex;
        const isLower = rowIndex > colIndex;

        let isKosong = false;
        if (matrixType === "ZENITH" && isLower) {
          isKosong = true;
        } else if (matrixType === "NADIR" && isUpper) {
          isKosong = true;
        }

        if (isKosong) {
          html += `<td data-col="${colIndex}" data-row="${rowIndex}" class="w-[80px] min-w-[80px] bg-neutral-50/40 dark:bg-neutral-950/40 select-none pointer-events-none"></td>`;
        } else {
          let cellContent = "-";
          let cellClass =
            "matrix-cell w-[80px] min-w-[80px] p-2 text-center font-mono text-[10px] select-none cursor-pointer transition-colors duration-100 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/30 text-neutral-350 dark:text-neutral-750";
          let cellStyle = "";

          try {
            const identity = new Identity(rowItem, colItem, state.customDate);

            let isEligible = false;
            if (matrixType === "ZENITH") {
              isEligible = identity.isZenithZone;
            } else if (matrixType === "NADIR") {
              isEligible = identity.isNadirZone;
            } else if (matrixType === "MATRIX") {
              const isCrossDome =
                identity.isZenithSideA !== identity.isZenithSideB;
              if (isCrossDome) {
                if (isUpper && identity.isZenithSideA) {
                  isEligible = true;
                } else if (isLower && identity.isNadirSideA) {
                  isEligible = true;
                }
              }
            }

            if (identity.statsA && identity.statsB && isEligible) {
              const theta = identity.theta;

              if (mode === "ANGLE") {
                cellContent = `
                                    <div class="flex flex-col items-center justify-center select-none leading-none">
                                        <span class="text-[10px] font-bold text-neutral-800 dark:text-neutral-200">${theta.toFixed(1)}°</span>
                                    </div>
                                `;
                cellClass =
                  "matrix-cell w-[80px] min-w-[80px] p-2 text-center font-mono leading-none select-none cursor-pointer transition-colors duration-100 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40 text-neutral-600 dark:text-neutral-300";
              } else {
                // ASPECT Mode
                const aspect = identity.aspect;
                if (aspect) {
                  cellContent = `
                                        <div class="flex flex-col items-center justify-center gap-0.5 select-none leading-none">
                                            <span class="text-xs font-extrabold flex items-center gap-0.5 mb-0.5 tracking-tighter shadow-3xs" style="color: ${aspect.color};">
                                                <span class="text-xs leading-none mr-0.5">${aspect.symbol}</span>
                                                <span class="text-[8px] leading-none uppercase font-black">${aspect.id}</span>
                                            </span>
                                            <span class="text-[9.5px] font-bold text-neutral-800 dark:text-neutral-200">${theta.toFixed(1)}°</span>
                                            <span class="text-[8px] text-neutral-400 dark:text-neutral-500 font-semibold font-mono">dev ${aspect.deviation.toFixed(1)}°</span>
                                        </div>
                                    `;
                  cellClass =
                    "matrix-cell w-[80px] min-w-[80px] p-1.5 text-center font-sans border-t border-b select-none cursor-pointer transition-all duration-100 transform hover:scale-102 hover:shadow-2xs";
                  cellStyle = `background-color: ${aspect.color}0f; border-color: ${aspect.color}40;`;
                } else {
                  // Empty / faded dash indicator for no aspect in aspect mode
                  cellContent = `
                                        <div class="flex items-center justify-center select-none font-mono text-[10px] text-neutral-200 dark:text-neutral-800/40">-</div>
                                    `;
                  cellClass =
                    "matrix-cell w-[80px] min-w-[80px] p-2 text-center select-none opacity-20 pointer-events-none";
                }
              }
            } else {
              // Blocked (crossed dome or not matching current matrix criteria)
              cellContent = `
                                <div class="flex items-center justify-center select-none font-mono text-[10px] text-neutral-200/50 dark:text-neutral-800/40">✕</div>
                            `;
              cellClass =
                "matrix-cell w-[80px] min-w-[80px] p-2 text-center bg-neutral-550/5 dark:bg-neutral-50/5 select-none cursor-not-allowed opacity-40";
            }
          } catch (err) {
            console.error("Error calculating matrix cell:", err);
          }

          html += `<td data-col="${colIndex}" data-row="${rowIndex}" class="${cellClass}" ${cellStyle ? `style="${cellStyle}"` : ""}>
                        ${cellContent}
                    </td>`;
        }
      }
    });

    html += "</tr>";
  });

  html += "</tbody>";
  return html;
}

function setupMatrixHover(table) {
  let activeRowHeader = null;
  let activeColHeader = null;
  let activeCell = null;

  table.addEventListener("mousemove", (e) => {
    const cell = e.target.closest("td.matrix-cell");
    if (cell === activeCell) return;

    // Clean up previous highlights
    if (activeRowHeader) {
      activeRowHeader.classList.add(
        "bg-neutral-50/70",
        "dark:bg-neutral-950/70",
      );
      activeRowHeader.classList.remove(
        "bg-neutral-200/90",
        "dark:bg-neutral-800/95",
        "text-neutral-900",
        "dark:text-neutral-50",
      );
      activeRowHeader = null;
    }
    if (activeColHeader) {
      activeColHeader.classList.add(
        "bg-neutral-50/70",
        "dark:bg-neutral-950/70",
      );
      activeColHeader.classList.remove(
        "bg-neutral-200/90",
        "dark:bg-neutral-800/95",
        "text-neutral-900",
        "dark:text-neutral-50",
      );
      activeColHeader = null;
    }
    if (activeCell) {
      activeCell.classList.remove(
        "ring-1",
        "ring-inset",
        "ring-neutral-400",
        "dark:ring-neutral-500",
        "bg-neutral-100/50",
        "dark:bg-neutral-900/30",
      );
      activeCell = null;
    }

    if (!cell) return;

    activeCell = cell;
    const colIndex = cell.getAttribute("data-col");
    const rowIndex = cell.getAttribute("data-row");

    if (colIndex !== null && rowIndex !== null) {
      // Find headers
      const rowHeader = table.querySelector(
        `td[data-matrix-row="${rowIndex}"]`,
      );
      const colHeader = table.querySelector(
        `th[data-matrix-col="${colIndex}"]`,
      );

      if (rowHeader) {
        rowHeader.classList.remove(
          "bg-neutral-50/70",
          "dark:bg-neutral-950/70",
        );
        rowHeader.classList.add(
          "bg-neutral-200/90",
          "dark:bg-neutral-800/95",
          "text-neutral-900",
          "dark:text-neutral-50",
        );
        activeRowHeader = rowHeader;
      }
      if (colHeader) {
        colHeader.classList.remove(
          "bg-neutral-50/70",
          "dark:bg-neutral-950/70",
        );
        colHeader.classList.add(
          "bg-neutral-200/90",
          "dark:bg-neutral-800/95",
          "text-neutral-900",
          "dark:text-neutral-50",
        );
        activeColHeader = colHeader;
      }

      // Highlight the exact hovered cell slightly
      cell.classList.add(
        "ring-1",
        "ring-inset",
        "ring-neutral-400",
        "dark:ring-neutral-500",
        "bg-neutral-100/50",
        "dark:bg-neutral-900/30",
      );
    }
  });

  table.addEventListener("mouseleave", () => {
    if (activeRowHeader) {
      activeRowHeader.classList.add(
        "bg-neutral-50/70",
        "dark:bg-neutral-950/70",
      );
      activeRowHeader.classList.remove(
        "bg-neutral-200/90",
        "dark:bg-neutral-800/95",
        "text-neutral-900",
        "dark:text-neutral-50",
      );
      activeRowHeader = null;
    }
    if (activeColHeader) {
      activeColHeader.classList.add(
        "bg-neutral-50/70",
        "dark:bg-neutral-950/70",
      );
      activeColHeader.classList.remove(
        "bg-neutral-200/90",
        "dark:bg-neutral-800/95",
        "text-neutral-900",
        "dark:text-neutral-50",
      );
      activeColHeader = null;
    }
    if (activeCell) {
      activeCell.classList.remove(
        "ring-1",
        "ring-inset",
        "ring-neutral-400",
        "dark:ring-neutral-500",
        "bg-neutral-100/50",
        "dark:bg-neutral-900/30",
      );
      activeCell = null;
    }
  });
}

let tabsInitialized = false;

function setupMatrixTabs() {
  if (tabsInitialized) return;
  tabsInitialized = true;

  const configs = [
    { type: "general", stateKey: "matrixModeGeneral" },
    { type: "zenith", stateKey: "matrixModeZenith" },
    { type: "nadir", stateKey: "matrixModeNadir" },
  ];

  configs.forEach((cfg) => {
    const angleBtn = document.getElementById(`tab-${cfg.type}-angle`);
    const aspectBtn = document.getElementById(`tab-${cfg.type}-aspect`);

    if (angleBtn) {
      angleBtn.addEventListener("click", () => {
        state[cfg.stateKey] = "ANGLE";
        updateTabVisuals();
        renderAspectMatrices();
      });
    }
    if (aspectBtn) {
      aspectBtn.addEventListener("click", () => {
        state[cfg.stateKey] = "ASPECT";
        updateTabVisuals();
        renderAspectMatrices();
      });
    }
  });
}

function updateTabVisuals() {
  if (!state.matrixModeGeneral) state.matrixModeGeneral = "ANGLE";
  if (!state.matrixModeZenith) state.matrixModeZenith = "ANGLE";
  if (!state.matrixModeNadir) state.matrixModeNadir = "ANGLE";

  const configs = [
    { type: "general", val: state.matrixModeGeneral },
    { type: "zenith", val: state.matrixModeZenith },
    { type: "nadir", val: state.matrixModeNadir },
  ];

  configs.forEach((cfg) => {
    const bgActive = [
      "bg-black",
      "dark:bg-white",
      "text-white",
      "dark:text-black",
    ];
    const bgInactive = [
      "text-neutral-500",
      "dark:text-neutral-400",
      "hover:text-black",
      "dark:hover:text-white",
    ];

    const angleBtn = document.getElementById(`tab-${cfg.type}-angle`);
    const aspectBtn = document.getElementById(`tab-${cfg.type}-aspect`);

    if (angleBtn) {
      angleBtn.classList.remove(...bgActive, ...bgInactive);
      if (cfg.val === "ANGLE") {
        angleBtn.classList.add(...bgActive);
      } else {
        angleBtn.classList.add(...bgInactive);
      }
    }

    if (aspectBtn) {
      aspectBtn.classList.remove(...bgActive, ...bgInactive);
      if (cfg.val === "ASPECT") {
        aspectBtn.classList.add(...bgActive);
      } else {
        aspectBtn.classList.add(...bgInactive);
      }
    }
  });
}

function renderAspectMatrices() {
  setupMatrixTabs();
  updateTabVisuals();

  const generalTable = document.getElementById("matrix-general-table");
  const zenithTable = document.getElementById("matrix-zenith-table");
  const nadirTable = document.getElementById("matrix-nadir-table");

  if (generalTable) {
    generalTable.style.tableLayout = "fixed";
    generalTable.innerHTML = generateMatrixHTML("MATRIX");
    setupMatrixHover(generalTable);
  }
  if (zenithTable) {
    zenithTable.style.tableLayout = "fixed";
    zenithTable.innerHTML = generateMatrixHTML("ZENITH");
    setupMatrixHover(zenithTable);
  }
  if (nadirTable) {
    nadirTable.style.tableLayout = "fixed";
    nadirTable.innerHTML = generateMatrixHTML("NADIR");
    setupMatrixHover(nadirTable);
  }
}

function updateAspectMatrices() {
  updateMatrixCells("MATRIX", document.getElementById("matrix-general-table"));
  updateMatrixCells("ZENITH", document.getElementById("matrix-zenith-table"));
  updateMatrixCells("NADIR", document.getElementById("matrix-nadir-table"));
}

function updateMatrixCells(matrixType, tableElement) {
  if (!tableElement || !tableElement.innerHTML.trim()) return;

  const items = ENTITIES.filter((item) => state.activeBodies.has(item.id));
  let mode = "ANGLE";
  if (matrixType === "ZENITH") {
    mode = state.matrixModeZenith || "ANGLE";
  } else if (matrixType === "NADIR") {
    mode = state.matrixModeNadir || "ANGLE";
  } else {
    mode = state.matrixModeGeneral || "ANGLE";
  }

  // It's possible the list of bodies changed, if so, we should do a full render
  // Let's check table size
  const currentRows = tableElement.querySelectorAll("tbody tr");
  if (currentRows.length !== items.length) {
    tableElement.innerHTML = generateMatrixHTML(matrixType);
    setupMatrixHover(tableElement);
    return;
  }

  const cells = tableElement.querySelectorAll("td[data-col][data-row]");
  cells.forEach((cell) => {
    const colIndex = parseInt(cell.getAttribute("data-col"));
    const rowIndex = parseInt(cell.getAttribute("data-row"));

    const isDiagonal = rowIndex === colIndex;
    if (isDiagonal) return;

    const isUpper = rowIndex < colIndex;
    const isLower = rowIndex > colIndex;

    let isKosong = false;
    if (matrixType === "ZENITH" && isLower) {
      isKosong = true;
    } else if (matrixType === "NADIR" && isUpper) {
      isKosong = true;
    }

    if (isKosong) return;

    const rowItem = items[rowIndex];
    const colItem = items[colIndex];
    if (!rowItem || !colItem) return;

    let cellContent = "-";
    let cellClass =
      "matrix-cell w-[80px] min-w-[80px] p-2 text-center font-mono text-[10px] select-none cursor-pointer transition-colors duration-100 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/30 text-neutral-350 dark:text-neutral-750";
    let cellStyle = "";
    let dataSignature = "";

    // Preserve hover outlines
    const isActiveHover = cell.classList.contains("ring-1");

    try {
      const identity = new Identity(rowItem, colItem, state.customDate);

      let isEligible = false;
      if (matrixType === "ZENITH") {
        isEligible = identity.isZenithZone;
      } else if (matrixType === "NADIR") {
        isEligible = identity.isNadirZone;
      } else if (matrixType === "MATRIX") {
        const isCrossDome = identity.isZenithSideA !== identity.isZenithSideB;
        if (isCrossDome) {
          if (isUpper && identity.isZenithSideA) {
            isEligible = true;
          } else if (isLower && identity.isNadirSideA) {
            isEligible = true;
          }
        }
      }

      if (identity.statsA && identity.statsB && isEligible) {
        const theta = identity.theta;

        if (mode === "ANGLE") {
          dataSignature = `angle-${theta.toFixed(1)}`;
          cellContent = `
                        <div class="flex flex-col items-center justify-center select-none leading-none">
                            <span class="text-[10px] font-bold text-neutral-800 dark:text-neutral-200">${theta.toFixed(1)}°</span>
                        </div>
                    `;
          cellClass =
            "matrix-cell w-[80px] min-w-[80px] p-2 text-center font-mono leading-none select-none cursor-pointer transition-colors duration-100 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40 text-neutral-600 dark:text-neutral-300";
        } else {
          const aspect = identity.aspect;
          if (aspect) {
            dataSignature = `aspect-${aspect.id}-${theta.toFixed(1)}-${aspect.deviation.toFixed(1)}`;
            cellContent = `
                            <div class="flex flex-col items-center justify-center gap-0.5 select-none leading-none">
                                <span class="text-xs font-extrabold flex items-center gap-0.5 mb-0.5 tracking-tighter shadow-3xs" style="color: ${aspect.color};">
                                    <span class="text-xs leading-none mr-0.5">${aspect.symbol}</span>
                                    <span class="text-[8px] leading-none uppercase font-black">${aspect.id}</span>
                                </span>
                                <span class="text-[9.5px] font-bold text-neutral-800 dark:text-neutral-200">${theta.toFixed(1)}°</span>
                                <span class="text-[8px] text-neutral-400 dark:text-neutral-500 font-semibold font-mono">dev ${aspect.deviation.toFixed(1)}°</span>
                            </div>
                        `;
            cellClass =
              "matrix-cell w-[80px] min-w-[80px] p-1.5 text-center font-sans border-t border-b select-none cursor-pointer transition-all duration-100 transform hover:scale-102 hover:shadow-2xs";
            cellStyle = `background-color: ${aspect.color}0f; border-color: ${aspect.color}40;`;
          } else {
            dataSignature = "aspect-none";
            cellContent = `
                            <div class="flex items-center justify-center select-none font-mono text-[10px] text-neutral-200 dark:text-neutral-800/40">-</div>
                        `;
            cellClass =
              "matrix-cell w-[80px] min-w-[80px] p-2 text-center select-none opacity-20 pointer-events-none";
          }
        }
      } else {
        dataSignature = "blocked";
        cellContent = `
                    <div class="flex items-center justify-center select-none font-mono text-[10px] text-neutral-200/50 dark:text-neutral-800/40">✕</div>
                `;
        cellClass =
          "matrix-cell w-[80px] min-w-[80px] p-2 text-center bg-neutral-550/5 dark:bg-neutral-50/5 select-none cursor-not-allowed opacity-40";
      }
    } catch (err) {
      dataSignature = "error";
      console.error("Error updating matrix cell:", err);
    }

    if (isActiveHover) {
      cellClass +=
        " ring-1 ring-inset ring-neutral-400 dark:ring-neutral-500 bg-neutral-100/50 dark:bg-neutral-900/30";
    }

    const currentClass = cell.className.replace(/\s*flash-update/g, "");
    const currentSignature = cell.getAttribute("data-signature");

    if (currentSignature !== dataSignature || currentClass !== cellClass) {
      cell.setAttribute("data-signature", dataSignature);
      cell.className = cellClass;
      cell.innerHTML = cellContent;
      if (cellStyle) {
        cell.style.cssText = cellStyle;
      } else {
        cell.removeAttribute("style");
      }

      // Add flash effect
      cell.classList.remove("flash-update");
      void cell.offsetWidth; // trigger reflow
      cell.classList.add("flash-update");
    }
  });

  // Render indicators
  let containerId;
  if (matrixType === "MATRIX") containerId = "general-indicator-container";
  else if (matrixType === "ZENITH") containerId = "zenith-indicator-container";
  else if (matrixType === "NADIR") containerId = "nadir-indicator-container";

  if (containerId) {
    const container = document.getElementById(containerId);
    if (container && typeof analyzeMatrixIndicators === "function") {
      const indicatorsHtml = analyzeMatrixIndicators(
        matrixType,
        items,
        state.customDate,
      );
      if (container.innerHTML !== indicatorsHtml) {
        container.innerHTML = indicatorsHtml;
      }
    }
  }
}
