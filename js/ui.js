// js/ui.js
import { state, BODIES, getPersonaAnchorTime } from './store.js';
import { getSubPoint, formatCoord, getCelestialCoordinates, formatRA } from './astro.js';
import { updateMap } from './map.js';

let lastNominatimRequestTime = 0;

export function renderTabs() {
    const switcher = document.getElementById('tab-switcher');
    switcher.innerHTML = `
        <button id="tab-location" class="tm-tab ${state.currentTab === 'location' ? 'tm-tab--active' : ''}">
          <i data-feather="compass" class="w-3.5 h-3.5"></i> PERSONA
        </button>
        <button id="tab-simulation" class="tm-tab ${state.currentTab === 'simulation' ? 'tm-tab--active' : ''}">
          <i data-feather="clock" class="w-3.5 h-3.5"></i> SIMULASI
        </button>
    `;
    window.feather.replace();

    document.getElementById('tab-location').addEventListener('click', () => { state.currentTab = 'location'; renderTabs(); renderSidebar(); });
    document.getElementById('tab-simulation').addEventListener('click', () => { state.currentTab = 'simulation'; renderTabs(); renderSidebar(); });
}

export function renderSidebar() {
    const container = document.getElementById('sidebar-content');
    if (state.currentTab === 'location') {
        container.innerHTML = `
            <div class="space-y-4 animate-fade-in flex flex-col h-full">
                <button id="add-persona-btn" class="tm-btn tm-btn--primary w-full">
                    <i data-feather="plus" class="w-3.5 h-3.5"></i> <span>Tambah Persona</span>
                </button>
                <div id="personas-list" class="space-y-2 mt-4 flex-1 overflow-y-auto"></div>
            </div>
        `;
        
        const pList = document.getElementById('personas-list');
        state.personas.forEach(p => {
            const div = document.createElement('div');
            div.className = `tm-card p-3 ${state.selectedPersonaId === p.id ? 'tm-card--active' : ''} cursor-pointer transition select-none flex flex-col relative group`;
            div.id = `persona-card-${p.id}`;
            
            let localTimeStr = '';
            const { DateTime } = window.luxon || {};
            if (DateTime && p.timezone) {
                try {
                    const dt = DateTime.fromJSDate(state.customDate).setZone(p.timezone);
                    const offsetInMinutes = dt.offset;
                    const hours = Math.floor(Math.abs(offsetInMinutes) / 60);
                    const mins = Math.abs(offsetInMinutes) % 60;
                    const sign = offsetInMinutes >= 0 ? '+' : '-';
                    const offsetStr = mins === 0 ? `${sign}${hours}` : `${sign}${hours}:${mins.toString().padStart(2, '0')}`;
                    localTimeStr = dt.toFormat('HH:mm:ss') + ' [' + offsetStr + '] (' + p.timezone + ')';
                } catch (e) {
                    console.error("Luxon format error in card", e);
                }
            }

            const latDir = p.lat >= 0 ? 'LU' : 'LS';
            const lngDir = p.lng >= 0 ? 'BT' : 'BB';
            const latStr = Math.abs(p.lat).toFixed(4) + '° ' + latDir;
            const lngStr = Math.abs(p.lng).toFixed(4) + '° ' + lngDir;
            const mainLocStr = p.name ? (p.name.split(',')[0].trim() || 'Koordinat') : 'Koordinat';

            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0 pr-2">
                        <div class="font-bold text-sm text-slate-900 uppercase tracking-tighter flex items-center justify-between gap-1 flex-wrap">
                             <span>${p.label}</span>
                        </div>
                        <div class="text-[11px] text-slate-500 mt-0.5 truncate">${p.name}</div>
                        <div class="mt-1">
                             <span id="p-time-badge-${p.id}" class="tm-badge tm-badge--muted font-mono tracking-normal normal-case inline-block">${localTimeStr}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button class="tm-btn tm-btn--icon edit-persona-btn" data-id="${p.id}" title="Edit Persona" aria-label="Edit Persona">
                            <i data-feather="edit-2" class="w-3.5 h-3.5"></i>
                        </button>
                        <button class="tm-btn tm-btn--icon delete-persona-btn hover:text-red-600" data-id="${p.id}" title="Hapus Persona" aria-label="Hapus Persona">
                            <i data-feather="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                        ${state.selectedPersonaId === p.id ? '<div class="w-1.5 h-1.5 rounded-full bg-slate-900"></div>' : ''}
                    </div>
                </div>
                <div class="text-[10px] font-mono mt-3 pt-2 text-slate-400 font-medium border-t border-slate-100 flex justify-between items-center flex-wrap gap-1">
                    <span>📍 ${mainLocStr} (${latStr}, ${lngStr})</span>
                    ${p.elevation !== undefined ? `<span class="tm-badge font-mono">ELEV ${p.elevation}m</span>` : ''}
                </div>
            `;
            div.addEventListener('click', () => {
                state.selectedPersonaId = p.id;
                const pIsRealTime = p.isRealTime !== false && (!p.date || !p.time);
                if (pIsRealTime) {
                    state.isRealTime = true;
                    state.customDate = new Date();
                    state.previewDate = null;
                } else {
                    if (DateTime && p.date && p.time && p.timezone) {
                        const rawLocal = `${p.date}T${p.time}`;
                        const dt = DateTime.fromISO(rawLocal, { zone: p.timezone }).toUTC();
                        if (dt.isValid) {
                            state.customDate = dt.toJSDate();
                            state.isRealTime = false;
                            state.previewDate = null;
                        }
                    }
                }
                renderSidebar();
                renderBodies();
                updateMap();
            });
            const editBtn = div.querySelector('.edit-persona-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent card selection action
                    showPersonaModal(p.id);
                });
            }
            const deleteBtn = div.querySelector('.delete-persona-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent card selection action
                    if (state.personas.length <= 1) {
                        return;
                    }
                    state.personas = state.personas.filter(x => x.id !== p.id);
                    if (state.selectedPersonaId === p.id) {
                        const fallbackP = state.personas[0];
                        state.selectedPersonaId = fallbackP.id;
                        const pIsRealTime = fallbackP.isRealTime !== false && (!fallbackP.date || !fallbackP.time);
                        if (pIsRealTime) {
                            state.isRealTime = true;
                            state.customDate = new Date();
                            state.previewDate = null;
                        } else {
                            if (DateTime && fallbackP.date && fallbackP.time && fallbackP.timezone) {
                                const rawLocal = `${fallbackP.date}T${fallbackP.time}`;
                                const dt = DateTime.fromISO(rawLocal, { zone: fallbackP.timezone }).toUTC();
                                if (dt.isValid) {
                                    state.customDate = dt.toJSDate();
                                    state.isRealTime = false;
                                    state.previewDate = null;
                                }
                            }
                        }
                    }
                    renderSidebar();
                    renderBodies();
                    updateMap();
                });
            }
            pList.appendChild(div);
        });
        document.getElementById('add-persona-btn').addEventListener('click', () => showPersonaModal());
    } else {
        let timezones = [];
        try {
            timezones = Intl.supportedValuesOf('timeZone');
        } catch (e) {
            timezones = ['UTC', 'Asia/Jakarta', 'Asia/Riyadh', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/Paris'];
        }
        if (!timezones.includes('UTC')) {
            timezones.unshift('UTC');
        }
        const { DateTime } = window.luxon || {};
        const tzOptions = timezones.map(tz => {
            let label = tz;
            let offsetSearchStr = '';
            if (DateTime) {
                try {
                    const dt = DateTime.now().setZone(tz);
                    const offsetInMinutes = dt.offset;
                    const hours = Math.floor(Math.abs(offsetInMinutes) / 60);
                    const mins = Math.abs(offsetInMinutes) % 60;
                    const sign = offsetInMinutes >= 0 ? '+' : '-';
                    const offsetStr = mins === 0 ? `${sign}${hours}` : `${sign}${hours}:${mins.toString().padStart(2, '0')}`;
                    label = `[${offsetStr}] ${tz}`;
                    offsetSearchStr = offsetStr;
                } catch (e) {
                    console.error("Format error for tz", tz, e);
                }
            }
            return { tz, label, offsetSearchStr };
        });

        let formOrMachineHtml = '';
        if (state.isRealTime) {
            formOrMachineHtml = `
                <div class="p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-3 animate-fade-in shadow-inner">
                    <div class="w-10 h-10 rounded-full bg-slate-150 dark:bg-slate-850 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <i data-feather="clock" class="w-5 h-5 animate-pulse"></i>
                    </div>
                    <div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono">Sinkronisasi Real-Time Aktif</div>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 max-w-[240px]">Nonaktifkan sinkronisasi di atas terlebih dahulu untuk menggunakan fitur simulasi (Time Machine).</p>
                </div>
            `;
        } else if (!state.simulationTimezoneConfirmed) {
            // Show timezone select form
            formOrMachineHtml = `
                <div class="space-y-4 animate-fade-in bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl shadow-xs">
                    <div class="space-y-1">
                        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Set Zona Waktu Simulasi</label>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400">Pilih zona waktu sebelum mengaktifkan Time Machine untuk perhitungan transit lokal yang akurat.</p>
                    </div>
                    
                    <div class="relative" id="sim-tz-autocomplete-container">
                        <input type="text" id="sim-tz-search" placeholder="Cari zona waktu (Cth: Jakarta, New York)..." class="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:outline-none dark:text-white font-mono" autocomplete="off">
                        <input type="hidden" id="sim-tz-value" value="${state.simulationTimezone || ''}">
                        <div id="sim-tz-list" class="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg max-h-40 overflow-y-auto hidden shadow-lg divide-y divide-slate-100 dark:divide-slate-800"></div>
                    </div>

                    <button id="btn-confirm-sim-tz" class="w-full py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50" ${state.simulationTimezone ? '' : 'disabled'}>
                        Aktifkan Time Machine
                    </button>
                </div>
            `;
        } else {
            // Show standard controls or confirmed tz simulator controls
            const timezoneLabel = state.simulationTimezone || 'UTC';
            formOrMachineHtml = `
                <div class="p-3 bg-slate-100/60 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex justify-between items-center mb-2">
                    <div>
                        <div class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Zona Waktu Simulasi</div>
                        <div class="text-xs font-mono font-bold text-slate-800 dark:text-gray-100">${state.simulationTimezone}</div>
                    </div>
                    <button id="btn-change-sim-tz" class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded transition-colors cursor-pointer">
                        Ubah
                    </button>
                </div>

                <div class="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner transition-opacity">
                    <div class="flex items-center justify-between gap-1.5 flex-wrap md:flex-nowrap">
                        <div class="flex items-center gap-1.5 w-full sm:w-auto">
                            <button id="btn-play" class="flex-1 sm:flex-none h-9 px-4 text-xs font-bold uppercase tracking-wider bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 flex justify-center items-center shadow-sm cursor-pointer transition-colors">
                                ${state.isPlaying ? '<i data-feather="pause" class="w-3.5 h-3.5 mr-1.5"></i> Jeda' : '<i data-feather="play" class="w-3.5 h-3.5 mr-1.5"></i> Putar'}
                            </button>
                            <button id="btn-reset" class="h-9 w-9 flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm transition-colors" title="Kembali ke Saat Ini">
                                <i data-feather="rotate-ccw" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <div class="flex items-center gap-0.5 bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/40 dark:border-slate-700 mt-2 md:mt-0 w-full sm:w-auto overflow-hidden">
                            ${[ { label: '1M', val: 60 }, { label: '30M', val: 1800 }, { label: '1H', val: 3600 }, { label: '1D', val: 86400 } ].map(opt => `
                                <button type="button" class="flex-1 sm:flex-none speed-btn text-[10px] font-mono font-bold px-2 py-1.5 rounded transition-all cursor-pointer ${state.speed === opt.val ? 'bg-white dark:bg-slate-950 text-slate-950 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}" data-val="${opt.val}">${opt.label}</button>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div class="space-y-2 pt-2">
                    <label class="text-[10px] sm:text-xs uppercase font-bold text-slate-400 tracking-wider">Pilih Tanggal Simulasi (${timezoneLabel})</label>
                    <input type="datetime-local" id="custom-time" class="w-full text-sm font-mono bg-white dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 p-3 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 focus:border-transparent transition-shadow shadow-sm">
                </div>

                <!-- Time scrubber: maju/mundur secara halus tanpa drag marker -->
                <div class="space-y-2 pt-3">
                    <div class="flex items-center justify-between gap-2">
                        <label class="text-[10px] sm:text-xs uppercase font-bold text-slate-400 tracking-wider">Scrub Waktu (±24 jam)</label>
                        <div id="time-scrub-label" class="text-[10px] font-mono font-bold text-slate-600">+00:00</div>
                    </div>
                    <input
                        type="range"
                        id="time-scrub"
                        min="-1440"
                        max="1440"
                        step="1"
                        value="0"
                        class="w-full accent-slate-900"
                    />
                    <div class="text-[10px] text-slate-500">
                        Geser untuk preview, lalu klik <b>Apply</b> di banner atas untuk menerapkan.
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="space-y-4 animate-fade-in">
                <div class="bg-slate-100 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-850 flex items-center justify-between mb-2 cursor-pointer select-none transition-colors hover:bg-slate-150/50" id="realtime-wrapper">
                    <span class="text-xs font-black text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <i data-feather="rss" class="w-3.5 h-3.5"></i> Real-Time Sync
                    </span>
                    <label class="relative inline-flex items-center cursor-pointer pointer-events-none">
                      <input type="checkbox" id="realtime-toggle" class="sr-only peer" ${state.isRealTime ? 'checked' : ''}>
                      <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900 dark:peer-checked:bg-slate-100 shadow-inner"></div>
                    </label>
                </div>

                ${formOrMachineHtml}
            </div>
        `;

        document.getElementById('realtime-wrapper').addEventListener('click', () => {
            state.isRealTime = !state.isRealTime;
            if (state.isRealTime) {
                state.isPlaying = false;
                state.simulationTimezoneConfirmed = false;
                state.previewDate = null;
            } else {
                state.customDate = new Date();
                state.simulationTimezoneConfirmed = false; // Require them to pick a timezone first
                state.previewDate = null;
            }
            renderSidebar();
            updateMap();
        });

        if (state.isRealTime) {
            // No extra events needed for simulation except realtime-wrapper
        } else if (!state.simulationTimezoneConfirmed) {
            // Setup events for TZ selection form
            const simSearchInput = document.getElementById('sim-tz-search');
            const simHiddenTzInput = document.getElementById('sim-tz-value');
            const simResultsContainer = document.getElementById('sim-tz-list');
            const simConfirmBtn = document.getElementById('btn-confirm-sim-tz');

            if (state.simulationTimezone && simSearchInput) {
                const match = tzOptions.find(opt => opt.tz === state.simulationTimezone);
                simSearchInput.value = match ? match.label : state.simulationTimezone;
            }

            const filterSimTimezones = (query) => {
                if (!simResultsContainer) return;
                query = query.toLowerCase().trim();
                const matches = tzOptions.filter(opt => {
                    return opt.tz.toLowerCase().includes(query) || 
                           opt.label.toLowerCase().includes(query) ||
                           (opt.offsetSearchStr && opt.offsetSearchStr.toLowerCase().includes(query));
                });
                
                simResultsContainer.innerHTML = '';
                if (matches.length === 0) {
                    simResultsContainer.innerHTML = `<div class="p-2 text-xs text-slate-400 text-center font-mono">Tidak ada zona waktu yang cocok</div>`;
                    return;
                }
                
                matches.forEach(match => {
                    const row = document.createElement('div');
                    row.className = 'p-2.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300 font-mono transition-colors';
                    row.innerText = match.label;
                    row.addEventListener('click', () => {
                        if (simSearchInput && simHiddenTzInput) {
                            simSearchInput.value = match.label;
                            simHiddenTzInput.value = match.tz;
                            state.simulationTimezone = match.tz;
                        }
                        if (simConfirmBtn) {
                            simConfirmBtn.removeAttribute('disabled');
                        }
                        simResultsContainer.classList.add('hidden');
                    });
                    simResultsContainer.appendChild(row);
                });
            };

            if (simSearchInput) {
                simSearchInput.addEventListener('focus', () => {
                    filterSimTimezones(simSearchInput.value);
                    simResultsContainer?.classList.remove('hidden');
                });

                simSearchInput.addEventListener('input', (e) => {
                    filterSimTimezones(e.target.value);
                    simResultsContainer?.classList.remove('hidden');
                    if (simConfirmBtn) {
                        const val = e.target.value;
                        if (val === '') {
                            simConfirmBtn.setAttribute('disabled', 'true');
                        } else {
                            const exactMatch = tzOptions.some(opt => opt.label === val || opt.tz === val);
                            if (exactMatch) {
                                simConfirmBtn.removeAttribute('disabled');
                            } else {
                                simConfirmBtn.setAttribute('disabled', 'true');
                            }
                        }
                    }
                });
            }

            document.addEventListener('click', (e) => {
                if (simSearchInput && simResultsContainer && !simSearchInput.contains(e.target) && !simResultsContainer.contains(e.target)) {
                    simResultsContainer.classList.add('hidden');
                }
            });

            simConfirmBtn?.addEventListener('click', () => {
                const tzVal = simHiddenTzInput ? simHiddenTzInput.value : state.simulationTimezone;
                if (tzVal) {
                    state.simulationTimezone = tzVal;
                    state.simulationTimezoneConfirmed = true;
                    renderSidebar();
                    updateMap();
                }
            });
        } else {
            // Setup events for confirmed time machine
            let scrubBaseMs = state.customDate.getTime();

            document.getElementById('btn-change-sim-tz')?.addEventListener('click', () => {
                state.simulationTimezoneConfirmed = false;
                renderSidebar();
            });

            document.getElementById('btn-play')?.addEventListener('click', () => {
                state.isPlaying = !state.isPlaying;
                renderSidebar();
            });

            document.getElementById('btn-reset')?.addEventListener('click', () => {
                state.customDate = new Date();
                state.previewDate = null;
                updateTimeUI();
                updateMap();
            });

            document.getElementById('custom-time')?.addEventListener('change', (e) => {
                if (e.target.value) {
                    const { DateTime } = window.luxon || {};
                    if (DateTime && state.simulationTimezone) {
                        const dt = DateTime.fromISO(e.target.value, { zone: state.simulationTimezone }).toUTC();
                        if (dt.isValid) {
                            state.customDate = dt.toJSDate();
                            state.previewDate = null;
                            scrubBaseMs = state.customDate.getTime();
                        }
                    } else if (DateTime) {
                        const dt = DateTime.fromISO(e.target.value, { zone: 'utc' });
                        if (dt.isValid) {
                            state.customDate = dt.toJSDate();
                            state.previewDate = null;
                            scrubBaseMs = state.customDate.getTime();
                        }
                    } else {
                        state.customDate = new Date(e.target.value + 'Z');
                        state.previewDate = null;
                        scrubBaseMs = state.customDate.getTime();
                    }
                    updateMap();
                }
            });

            const fmtOffset = (mins) => {
                const sign = mins >= 0 ? '+' : '-';
                mins = Math.abs(mins);
                const h = String(Math.floor(mins / 60)).padStart(2, '0');
                const m = String(mins % 60).padStart(2, '0');
                return `${sign}${h}:${m}`;
            };

            const scrub = document.getElementById('time-scrub');
            const scrubLabel = document.getElementById('time-scrub-label');

            const syncScrubUI = () => {
                if (!scrub || !scrubLabel) return;
                if (state.previewDate) {
                    const offsetMin = Math.round((new Date(state.previewDate).getTime() - state.customDate.getTime()) / 60000);
                    // Clamp into range (±24h)
                    const clamped = Math.max(-1440, Math.min(1440, offsetMin));
                    scrub.value = String(clamped);
                    scrubLabel.textContent = fmtOffset(clamped);
                } else {
                    scrub.value = '0';
                    scrubLabel.textContent = '+00:00';
                }
            };

            // initialize label
            syncScrubUI();

            const beginScrub = () => {
                // Start preview relative to current committed time
                state.isPlaying = false;
                scrubBaseMs = state.customDate.getTime();
                if (!state.previewDate) {
                    state.previewDate = new Date(scrubBaseMs);
                    updateMap();
                    window.dispatchEvent(new CustomEvent('preview-changed'));
                }
            };
            scrub?.addEventListener('mousedown', beginScrub);
            scrub?.addEventListener('touchstart', beginScrub, { passive: true });

            scrub?.addEventListener('input', (e) => {
                const mins = parseInt(e.target.value || '0', 10);
                if (scrubLabel) scrubLabel.textContent = fmtOffset(mins);
                state.previewDate = new Date(scrubBaseMs + mins * 60_000);
                updateMap();
                window.dispatchEvent(new CustomEvent('preview-changed'));
            });

            // Scrubber akan disinkronkan juga oleh updateTimeUI() saat waktu berubah.

            document.querySelectorAll('.speed-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    state.speed = parseInt(e.target.dataset.val);
                    renderSidebar();
                });
            });
        }
        
        updateTimeUI();
    }
    window.feather.replace();
}

export function showPersonaModal(editPersonaId = null) {
    const isEdit = editPersonaId !== null;
    const persona = isEdit ? state.personas.find(p => p.id === editPersonaId) : null;

    const modal = document.getElementById('persona-modal');

    const d = new Date();
    const defaultDate = isEdit && persona.date ? persona.date : d.toISOString().split('T')[0];
    const defaultTime = isEdit && persona.time ? persona.time : d.toTimeString().slice(0, 5);
    const defaultTimezone = isEdit ? persona.timezone : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const defaultElevation = isEdit ? (persona.elevation !== undefined ? persona.elevation : '') : '';

    modal.innerHTML = `
        <div class="tm-modal p-6 animate-fade-in relative">
            <div class="absolute top-0 left-0 w-full h-1.5 bg-slate-900"></div>
            <div class="flex justify-between items-center mb-5 shrink-0">
                <h2 class="text-md font-black uppercase text-slate-900 tracking-widest text-[14px]">${isEdit ? 'Edit Lokasi / Persona' : 'Tambah Lokasi'}</h2>
                <button id="close-modal" class="tm-btn tm-btn--icon" aria-label="Tutup modal"><i data-feather="x" class="w-4 h-4"></i></button>
            </div>
            
            <div class="space-y-4 overflow-y-auto flex-1 pr-1 pb-1 scrollbar-thin">
                <!-- 1. Label Section -->
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Label Persona</label>
                    <input type="text" id="p-label" value="${isEdit ? (persona.label || '') : ''}" placeholder="Cth: Rumah, Kantor, Masjid" class="tm-input">
                </div>

                <!-- 1.1 Time Mode Selection -->
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Mode Waktu (Time Mode)</label>
                    <div class="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                        <button type="button" id="btn-mode-realtime" class="py-1.5 px-3 rounded-lg text-xs font-bold text-center transition-all focus:outline-none select-none">
                            Real-Time
                        </button>
                        <button type="button" id="btn-mode-manual" class="py-1.5 px-3 rounded-lg text-xs font-bold text-center transition-all focus:outline-none select-none">
                            Manual
                        </button>
                    </div>
                </div>

                <!-- 2 & 3. Date & Time Section (Hidden under Real-Time) -->
                <div id="wrapper-specific-time" class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Tanggal (Date)</label>
                        <input type="date" id="p-date" value="${defaultDate}" class="tm-input tm-input--mono">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Waktu (Time)</label>
                        <input type="time" id="p-time" value="${defaultTime}" class="tm-input tm-input--mono">
                    </div>
                </div>

                <!-- 4. Time Zone Section -->
                <div class="relative" id="timezone-autocomplete-container">
                    <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Zona Waktu (Time Zone)</label>
                    <div class="relative">
                        <input type="text" id="p-timezone-search" placeholder="Cari zona waktu (Cth: Jakarta, UTC)..." class="tm-input tm-input--mono" autocomplete="off">
                        <input type="hidden" id="p-timezone" value="">
                        <!-- Dropdown list -->
                        <div id="p-timezone-list" class="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto hidden shadow-lg divide-y divide-slate-100"></div>
                    </div>
                </div>

                <!-- 5. Location Section with on-demand search -->
                <div class="space-y-1.5">
                    <label class="block text-xs font-bold text-slate-600 uppercase tracking-wide">Lokasi / Kota (Location)</label>
                    <div class="flex gap-2">
                        <input type="text" id="p-location" value="${isEdit ? (persona.name || '') : ''}" placeholder="Cari kota, tempat ibadah... (Nominatim)" class="tm-input flex-1">
                        <button type="button" id="p-search-btn" class="tm-btn tm-btn--secondary shrink-0">
                            <i data-feather="search" class="w-3.5 h-3.5"></i> <span>Cari</span>
                        </button>
                    </div>
                    <div id="p-search-error" class="text-[10px] text-rose-500 hidden font-semibold"></div>
                    <div id="p-search-results" class="mt-2 border border-slate-100 rounded-lg max-h-36 overflow-y-auto hidden bg-slate-50/50 divide-y divide-slate-100"></div>
                </div>

                <!-- 6 & 7. Latitude & Longitude Section -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Latitude</label>
                        <input type="number" step="any" min="-90" max="90" id="p-lat" value="${isEdit ? persona.lat : ''}" placeholder="-6.2088" class="tm-input tm-input--mono">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Longitude</label>
                        <input type="number" step="any" min="-180" max="180" id="p-lng" value="${isEdit ? persona.lng : ''}" placeholder="106.8456" class="tm-input tm-input--mono">
                    </div>
                </div>

                <!-- 8. Elevation Section -->
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Elevasi (meter)</label>
                    <input type="number" step="any" id="p-elevation" value="${defaultElevation}" placeholder="Elevasi tempat (meter)" class="tm-input tm-input--mono">
                </div>
                
                <div class="text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 flex items-center gap-1.5 leading-normal">
                    <i data-feather="info" class="w-3.5 h-3.5 text-slate-500 shrink-0"></i>
                    <span>Anda juga dapat mengklik peta untuk otomatis mengisi Latitude, Longitude, Elevasi, dan Nama Lokasi.</span>
                </div>
            </div>

            <button id="save-persona" class="tm-btn tm-btn--primary w-full mt-3 shrink-0">
                ${isEdit ? 'Simpan Perubahan' : 'Simpan Persona Baru'}
            </button>
        </div>
    `;

    // Populate Time Zones with UTC offset label alphabetically using Luxon
    let timezones = [];
    try {
        timezones = Intl.supportedValuesOf('timeZone');
    } catch (e) {
        timezones = ['UTC', 'Asia/Jakarta', 'Asia/Riyadh', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/Paris'];
    }
    if (!timezones.includes('UTC')) {
        timezones.unshift('UTC');
    }

    const { DateTime, IANAZone } = window.luxon || {};
    
    const tzOptions = timezones.map(tz => {
        let label = tz;
        let offsetSearchStr = '';
        if (DateTime) {
            try {
                const dt = DateTime.now().setZone(tz);
                const offsetInMinutes = dt.offset;
                const hours = Math.floor(Math.abs(offsetInMinutes) / 60);
                const mins = Math.abs(offsetInMinutes) % 60;
                const sign = offsetInMinutes >= 0 ? '+' : '-';
                const offsetStr = mins === 0 ? `${sign}${hours}` : `${sign}${hours}:${mins.toString().padStart(2, '0')}`;
                label = `[${offsetStr}] ${tz}`;
                offsetSearchStr = offsetStr;
            } catch (e) {
                console.error("Format error for tz", tz, e);
            }
        }
        return {
            tz,
            label,
            offsetSearchStr
        };
    });

    const searchInput = document.getElementById('p-timezone-search');
    const hiddenTzInput = document.getElementById('p-timezone');
    const resultsContainer = document.getElementById('p-timezone-list');

    // Prefill the search input and hidden input
    const initialTzOption = tzOptions.find(opt => opt.tz === defaultTimezone) || { tz: defaultTimezone, label: defaultTimezone };
    if (searchInput && hiddenTzInput) {
        searchInput.value = initialTzOption.label;
        hiddenTzInput.value = initialTzOption.tz;
    }

    function filterTimezones(query) {
        if (!resultsContainer) return;
        query = query.toLowerCase().trim();
        const matches = tzOptions.filter(opt => {
            return opt.tz.toLowerCase().includes(query) || 
                   opt.label.toLowerCase().includes(query) ||
                   (opt.offsetSearchStr && opt.offsetSearchStr.toLowerCase().includes(query));
        });
        
        resultsContainer.innerHTML = '';
        if (matches.length === 0) {
            resultsContainer.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center font-mono">Tidak ada zona waktu yang cocok</div>`;
            return;
        }
        
        matches.forEach(match => {
            const row = document.createElement('div');
            row.className = 'p-3 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300 font-mono transition-colors';
            row.innerText = match.label;
            row.addEventListener('click', () => {
                if (searchInput && hiddenTzInput) {
                    searchInput.value = match.label;
                    hiddenTzInput.value = match.tz;
                }
                resultsContainer.classList.add('hidden');
            });
            resultsContainer.appendChild(row);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('focus', () => {
            filterTimezones(searchInput.value);
            resultsContainer?.classList.remove('hidden');
        });

        searchInput.addEventListener('input', (e) => {
            filterTimezones(e.target.value);
            resultsContainer?.classList.remove('hidden');
        });
    }

    const outsideClickListener = (e) => {
        if (searchInput && resultsContainer && !searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.classList.add('hidden');
        }
    };
    document.addEventListener('click', outsideClickListener);

    // Dynamic Time Mode Switching & Toggling Visibility
    const isRealTimeVal = isEdit ? (persona.isRealTime !== false && (!persona.date || !persona.time)) : true;
    let currentIsRealTime = isRealTimeVal;

    const btnRealtime = document.getElementById('btn-mode-realtime');
    const btnManual = document.getElementById('btn-mode-manual');
    const wrapperSpecific = document.getElementById('wrapper-specific-time');

    function updateTimeModeUI() {
        if (currentIsRealTime) {
            btnRealtime.className = "py-1.5 px-3 rounded-lg text-xs font-bold text-center transition-all focus:outline-none select-none bg-white text-slate-900 shadow-sm border border-slate-200/50 cursor-pointer";
            btnManual.className = "py-1.5 px-3 rounded-lg text-xs font-semibold text-center transition-all focus:outline-none select-none text-slate-500 hover:text-slate-700 cursor-pointer";
            if (wrapperSpecific) {
                wrapperSpecific.style.display = 'none';
            }
        } else {
            btnManual.className = "py-1.5 px-3 rounded-lg text-xs font-bold text-center transition-all focus:outline-none select-none bg-white text-slate-900 shadow-sm border border-slate-200/50 cursor-pointer";
            btnRealtime.className = "py-1.5 px-3 rounded-lg text-xs font-semibold text-center transition-all focus:outline-none select-none text-slate-500 hover:text-slate-700 cursor-pointer";
            if (wrapperSpecific) {
                wrapperSpecific.style.display = 'grid';
            }
        }
    }

    if (btnRealtime && btnManual) {
        btnRealtime.addEventListener('click', () => {
            currentIsRealTime = true;
            updateTimeModeUI();
        });

        btnManual.addEventListener('click', () => {
            currentIsRealTime = false;
            updateTimeModeUI();
        });

        updateTimeModeUI();
    }

    window.feather.replace();
    modal.classList.add('is-open');

    function checkRateLimit() {
        const now = Date.now();
        const diff = now - lastNominatimRequestTime;
        if (diff < 1100) {
            const remaining = ((1100 - diff) / 1000).toFixed(1);
            showError(`Harap tunggu ${remaining} detik sebelum me-request.`);
            return false;
        }
        lastNominatimRequestTime = now;
        return true;
    }

    function showError(msg) {
        const el = document.getElementById('p-search-error');
        if (msg) {
            el.innerText = msg;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    async function fetchElevation(lat, lng) {
        const elevInput = document.getElementById('p-elevation');
        if (!elevInput) return;
        elevInput.placeholder = "Memuat elevasi...";
        try {
            const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
            const data = await res.json();
            if (data && data.elevation && data.elevation.length > 0) {
                elevInput.value = Math.round(data.elevation[0]);
            } else {
                elevInput.placeholder = "Gagal (isi manual)";
            }
        } catch (e) {
            console.error("Gagal mendapat elevasi", e);
            elevInput.placeholder = "Gagal (isi manual)";
        }
    }

    async function searchLocation() {
        showError('');
        const query = document.getElementById('p-location').value.trim();
        if (!query) {
            showError('Silakan masukkan kata kunci pencarian lokasi.');
            return;
        }

        if (!checkRateLimit()) return;

        const resultsContainer = document.getElementById('p-search-results');
        resultsContainer.innerHTML = `<div class="p-3 text-xs text-slate-400 font-mono text-center">Mencari...</div>`;
        resultsContainer.classList.remove('hidden');

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&accept-language=id`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'DOF-ASTRO/1.0',
                    'Accept-Language': 'id'
                }
            });
            const data = await res.json();

            if (!data || data.length === 0) {
                resultsContainer.innerHTML = `<div class="p-3 text-xs text-rose-400 font-mono text-center">Lokasi tidak ditemukan.</div>`;
                return;
            }

            resultsContainer.innerHTML = '';
            data.forEach(item => {
                const row = document.createElement('div');
                row.className = 'p-2 text-xs hover:bg-slate-150 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-300 transition-colors';
                const displayName = item.display_name;
                const shortName = displayName.split(',')[0] + (displayName.split(',')[1] ? ', ' + displayName.split(',')[1] : '');
                
                row.innerHTML = `<div class="font-semibold truncate">${displayName}</div><div class="text-[10px] text-slate-450 mt-0.5 font-mono">LAT: ${parseFloat(item.lat).toFixed(4)} | LNG: ${parseFloat(item.lon).toFixed(4)}</div>`;
                
                row.addEventListener('click', () => {
                    document.getElementById('p-location').value = shortName;
                    const latVal = parseFloat(item.lat);
                    const lngVal = parseFloat(item.lon);
                    document.getElementById('p-lat').value = latVal;
                    document.getElementById('p-lng').value = lngVal;
                    resultsContainer.classList.add('hidden');
                    
                    fetchElevation(latVal, lngVal);
                });
                resultsContainer.appendChild(row);
            });
        } catch (e) {
            console.error(e);
            resultsContainer.innerHTML = `<div class="p-3 text-xs text-rose-500 text-center font-semibold">Gagal memuat hasil pencarian.</div>`;
        }
    }

    async function reverseGeocode(lat, lng) {
        showError('');
        if (isNaN(lat) || isNaN(lng)) return;

        if (!checkRateLimit()) return;

        const locInput = document.getElementById('p-location');
        if (locInput) {
            locInput.value = 'Mendeteksi lokasi...';
        }

        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=id`;
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'DOF-ASTRO/1.0',
                    'Accept-Language': 'id'
                }
            });
            const data = await res.json();
            if (data && data.display_name) {
                const parts = data.display_name.split(',');
                const simplified = parts[0] + (parts[1] ? ', ' + parts[1].trim() : '');
                if (locInput) {
                    locInput.value = simplified;
                }
            } else if (locInput) {
                locInput.value = `Koordinat (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
            }
        } catch (e) {
            console.error(e);
            if (locInput) {
                locInput.value = 'Tidak diketahui';
            }
        }
    }

    // Map click dynamic integration
    const mapClickedHandler = async (e) => {
        const latVal = parseFloat(e.detail.lat);
        const lngVal = parseFloat(e.detail.lng);
        
        const latInput = document.getElementById('p-lat');
        const lngInput = document.getElementById('p-lng');
        if (latInput && lngInput) {
            latInput.value = latVal.toFixed(6);
            lngInput.value = lngVal.toFixed(6);
            
            fetchElevation(latVal, lngVal);
            reverseGeocode(latVal, lngVal);
        }
    };
    window.addEventListener('map-clicked', mapClickedHandler);

    function closeModal() {
        modal.classList.remove('is-open');
        window.removeEventListener('map-clicked', mapClickedHandler);
        document.removeEventListener('click', outsideClickListener);
    }

    document.getElementById('p-search-btn').addEventListener('click', searchLocation);
    document.getElementById('p-location').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchLocation();
        }
    });

    document.getElementById('close-modal').addEventListener('click', closeModal);

    document.getElementById('save-persona').addEventListener('click', () => {
        const label = document.getElementById('p-label').value.trim() || 'Lokasi';
        const locationVal = document.getElementById('p-location').value.trim() || 'Tidak Diketahui';
        const lat = parseFloat(document.getElementById('p-lat').value);
        const lng = parseFloat(document.getElementById('p-lng').value);
        const elevation = parseFloat(document.getElementById('p-elevation').value) || 0;
        const timezone = (document.getElementById('p-timezone')?.value || '').trim() || 'UTC';
        
        let date = null;
        let time = null;
        if (!currentIsRealTime) {
            date = document.getElementById('p-date').value;
            time = document.getElementById('p-time').value;
            if (!date || !time) {
                showError('Tanggal dan waktu harus diisi dalam mode Manual.');
                return;
            }
        }

        if (isNaN(lat) || lat < -90 || lat > 90) {
            showError('Latitude harus berkisar antara -90 s/d 90.');
            return;
        }
        if (isNaN(lng) || lng < -180 || lng > 180) {
            showError('Longitude harus berkisar antara -180 s/d 180.');
            return;
        }

        const { DateTime, IANAZone } = window.luxon || {};
        if (IANAZone && !IANAZone.isValidZone(timezone)) {
            showError('Zona waktu tidak valid. Silakan pilih dari dropdown.');
            return;
        }

        if (isEdit && persona) {
            persona.label = label;
            persona.name = locationVal;
            persona.lat = lat;
            persona.lng = lng;
            persona.timezone = timezone;
            persona.isRealTime = currentIsRealTime;
            persona.date = date;
            persona.time = time;
            persona.elevation = elevation;
        } else {
            const newId = 'p_' + Date.now();
            state.personas.push({
                id: newId,
                label,
                name: locationVal,
                lat,
                lng,
                timezone,
                isRealTime: currentIsRealTime,
                date,
                time,
                elevation
            });
            state.selectedPersonaId = newId;
        }

        // Sync with global customDate state
        if (currentIsRealTime) {
            state.isRealTime = true;
            state.customDate = new Date();
            state.previewDate = null;
        } else {
            if (DateTime && date && time) {
                const rawLocal = `${date}T${time}`;
                const dt = DateTime.fromISO(rawLocal, { zone: timezone }).toUTC();
                if (dt.isValid) {
                    state.customDate = dt.toJSDate();
                    state.isRealTime = false;
                    state.previewDate = null;
                }
            }
        }
        
        closeModal();
        renderSidebar();
        renderBodies();
        updateMap();
    });
}

const expandedBodies = new Set();

export function renderTerrestrial() {
    const container = document.getElementById('terrestrial-list');
    if (!container) return;
    container.innerHTML = '';

    const activePersona = state.personas.find(p => p.id === state.selectedPersonaId) || state.personas[0];
    if (!activePersona) return;

    // Zenith Details
    const zenithLat = activePersona.lat;
    const zenithLng = activePersona.lng;

    // Nadir Details
    const nadirLat = -activePersona.lat;
    let nadirLng = activePersona.lng + 180;
    if (nadirLng > 180) nadirLng -= 360;

    const items = [
        {
            id: 'persona-terrestrial-zenith',
            label: 'PERSONA - TERRESTRIAL - ZENITH',
            subLabel: `Titik Overhead • ${activePersona.label || "Ka'bah"} (${activePersona.name || "المطاف"})`,
            symbol: 'TZ',
            lat: zenithLat,
            lng: zenithLng,
            isActive: state.showZenith,
            toggleKey: 'showZenith'
        },
        {
            id: 'persona-terrestrial-nadir',
            label: 'PERSONA - TERRESTRIAL - NADIR',
            subLabel: `Titik Nadir (Antipoda) • ${activePersona.label || "Ka'bah"} (${activePersona.name || "المطاف"})`,
            symbol: 'TN',
            lat: nadirLat,
            lng: nadirLng,
            isActive: state.showNadir,
            toggleKey: 'showNadir'
        }
    ];

    items.forEach(item => {
        const isActive = item.isActive;
        const div = document.createElement('div');
        div.className = `w-full flex flex-col relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-4 transition-all hover:bg-slate-50/20 dark:hover:bg-slate-850/20 select-none ${isActive ? 'opacity-100' : 'opacity-70'}`;
        div.id = `terrestrial-card-${item.id}`;
        
        div.innerHTML = `
            <div class="w-full flex items-center justify-between gap-3">
                <div class="flex items-center gap-4">
                    <div class="w-11 h-11 rounded-full flex items-center justify-center border border-slate-950 dark:border-white bg-slate-950 dark:bg-white text-white dark:text-slate-950 font-bold font-mono text-xs shrink-0 select-none shadow-md">
                        <span>${item.symbol}</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-sm text-slate-900 dark:text-white leading-tight uppercase tracking-wider font-sans select-none">${item.label}</h3>
                        <p class="text-xs text-slate-400 dark:text-slate-500 font-medium leading-none mt-1 select-none">${item.subLabel}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <!-- Info Button -->
                    <button class="info-toggle-btn p-2 rounded-full text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer" title="Lihat Detail">
                        <i data-feather="info" class="w-4 h-4"></i>
                    </button>
                    <!-- Toggle Switch -->
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input type="checkbox" value="${item.id}" class="sr-only peer terrestrial-toggle-checkbox" ${isActive ? 'checked' : ''}>
                      <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900 dark:peer-checked:bg-slate-100 border border-slate-100 dark:border-slate-900/60 shadow-inner"></div>
                    </label>
                </div>
            </div>
            
            <!-- Info Collapsed Drawer -->
            <div class="terrestrial-info w-full mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-3 text-[11px] text-slate-600 dark:text-slate-400 hidden animate-fade-in">
                <div class="space-y-1.5">
                    <span class="text-[9px] text-slate-400 dark:text-slate-500 font-sans uppercase font-bold tracking-widest block">Koordinat Terestrial</span>
                    <div class="text-slate-800 dark:text-slate-200 font-semibold bg-slate-50/80 dark:bg-slate-950/80 px-2.5 pt-2 pb-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 text-xs font-mono shadow-inner tracking-widest block text-center sm:text-left truncate">
                      LAT ${formatCoord(item.lat, true)} <span class="text-slate-300 dark:text-slate-700">|</span> LON ${formatCoord(item.lng, false)}
                    </div>
                </div>
            </div>
        `;

        // Handle clicks nicely
        div.addEventListener('click', (e) => {
            const infoBtn = e.target.closest('.info-toggle-btn');
            if (infoBtn) {
                e.preventDefault();
                e.stopPropagation();
                const infoDiv = div.querySelector('.terrestrial-info');
                infoDiv.classList.toggle('hidden');
                return;
            }

            // Otherwise toggle state
            e.preventDefault();
            state[item.toggleKey] = !state[item.toggleKey];
            renderTerrestrial();
            updateMap();
        });

        container.appendChild(div);
    });
}

export function renderCelestial() {
    const container = document.getElementById('celestial-list');
    if (!container) return;
    container.innerHTML = '';

    const activePersona = state.personas.find(p => p.id === state.selectedPersonaId) || state.personas[0];
    if (!activePersona) return;

    const anchorTime = getPersonaAnchorTime(activePersona);
    const coords = getCelestialCoordinates(activePersona.lat, activePersona.lng, anchorTime);
    if (!coords) return;

    const items = [
        {
            id: 'persona-celestial-zenith',
            label: 'PERSONA - CELESTIAL - ZENITH',
            subLabel: `Titik Langit Atas Kepala • ${activePersona.label || "Ka'bah"}`,
            symbol: 'CZ',
            ra: coords.zenith.ra,
            dec: coords.zenith.dec
        },
        {
            id: 'persona-celestial-nadir',
            label: 'PERSONA - CELESTIAL - NADIR',
            subLabel: `Titik Langit Bawah Kaki • ${activePersona.label || "Ka'bah"}`,
            symbol: 'CN',
            ra: coords.nadir.ra,
            dec: coords.nadir.dec
        }
    ];

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `w-full flex flex-col relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-4 transition-all hover:bg-slate-50/20 dark:hover:bg-slate-850/20 select-none`;
        div.id = `celestial-card-${item.id}`;
        
        div.innerHTML = `
            <div class="w-full flex items-center justify-between gap-3">
                <div class="flex items-center gap-4">
                    <div class="w-11 h-11 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white text-slate-950 font-bold font-mono text-sm shrink-0 select-none shadow-md">
                        <span>${item.symbol}</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-sm text-slate-900 dark:text-white leading-tight uppercase tracking-wider font-sans select-none">${item.label}</h3>
                        <p class="text-xs text-slate-400 dark:text-slate-500 font-medium leading-none mt-1 select-none">${item.subLabel}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <!-- Info Button -->
                    <button class="info-toggle-btn p-2 rounded-full text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer" title="Lihat Detail">
                        <i data-feather="info" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
            
            <!-- Info Collapsed Drawer -->
            <div class="celestial-info w-full mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-3 text-[11px] text-slate-600 dark:text-slate-400 hidden animate-fade-in">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="space-y-1">
                        <span class="text-[9px] text-slate-400 dark:text-slate-500 font-sans uppercase font-bold tracking-widest block">Right Ascension (RA)</span>
                        <div class="text-slate-800 dark:text-slate-200 font-semibold bg-slate-50/80 dark:bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 text-xs font-mono shadow-inner truncate text-center">
                          ${formatRA(item.ra)}
                        </div>
                    </div>
                    <div class="space-y-1">
                        <span class="text-[9px] text-slate-400 dark:text-slate-500 font-sans uppercase font-bold tracking-widest block">Declination (Dec)</span>
                        <div class="text-slate-800 dark:text-slate-200 font-semibold bg-slate-50/80 dark:bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 text-xs font-mono shadow-inner truncate text-center">
                          ${formatCoord(item.dec, true)}
                        </div>
                    </div>
                </div>
                <div class="text-[10px] text-slate-400 dark:text-slate-500 italic mt-1 leading-snug">
                    *Bergantung pada rotasi Bumi (LST: ${formatRA(coords.lst)}). RA bergerak dinamis setiap detik/menit.
                </div>
            </div>
        `;

        // Handle clicks nicely
        div.addEventListener('click', (e) => {
            e.preventDefault();
            const infoDiv = div.querySelector('.celestial-info');
            infoDiv.classList.toggle('hidden');
        });

        container.appendChild(div);
    });
}

export function renderBodies() {
    const container = document.getElementById('bodies-list');
    container.innerHTML = '';
    
    BODIES.forEach(b => {
        const isActive = state.activeBodies.has(b.id);
        const div = document.createElement('div');
        div.className = `w-full flex flex-col relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-4 transition-all hover:bg-slate-50/20 dark:hover:bg-slate-850/20 select-none ${isActive ? 'opacity-100' : 'opacity-70'}`;
        div.id = `body-card-${b.id}`;
        div.innerHTML = `
            <div class="w-full flex items-center justify-between gap-3">
                <div class="flex items-center gap-4">
                    <div class="w-11 h-11 rounded-full flex items-center justify-center border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 text-slate-800 dark:text-gray-100 font-bold text-lg shadow-xs shrink-0 select-none">
                        <span style="color:${b.color}">${b.symbol}</span>
                    </div>
                    <div>
                        <h3 class="font-bold text-sm text-slate-900 dark:text-white leading-tight uppercase tracking-wider font-sans select-none">${b.label}</h3>
                        <p class="text-xs text-slate-400 dark:text-slate-500 font-medium leading-none mt-1 select-none">${b.subLabel}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <!-- Info Button -->
                    <button class="info-toggle-btn p-2 rounded-full text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer" title="Lihat Detail">
                        <i data-feather="info" class="w-4 h-4"></i>
                    </button>
                    <!-- Toggle Switch -->
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input type="checkbox" value="${b.id}" class="sr-only peer body-toggle-checkbox" ${isActive ? 'checked' : ''}>
                      <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900 dark:peer-checked:bg-slate-100 border border-slate-100 dark:border-slate-900/60 shadow-inner"></div>
                    </label>
                </div>
            </div>
            <!-- Collapsed by default unless info button clicked -->
            <div class="body-info w-full mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-3 text-[11px] text-slate-600 dark:text-slate-400 hidden animate-fade-in">
                <div class="space-y-1.5" id="stats-${b.id}">
                    <div class="font-mono text-[10px]">Menghitung...</div>
                </div>
            </div>
        `;
        
        // Handle click events correctly
        div.addEventListener('click', (e) => {
            // Check if user clicked or hovered over info button
            const infoBtn = e.target.closest('.info-toggle-btn');
            if (infoBtn) {
                e.preventDefault();
                e.stopPropagation();
                if (expandedBodies.has(b.id)) {
                    expandedBodies.delete(b.id);
                } else {
                    expandedBodies.add(b.id);
                }
                renderBodies();
                return;
            }

            // Otherwise toggle active bodies list
            e.preventDefault();
            state.activeBodies.has(b.id) ? state.activeBodies.delete(b.id) : state.activeBodies.add(b.id);
            renderBodies();
            updateMap();
        });

        // Expand info drawer if present in expanded set
        if (expandedBodies.has(b.id)) {
           const info = div.querySelector('.body-info');
           info.classList.remove('hidden');
        }

        container.appendChild(div);
    });
    
    renderTerrestrial();
    renderCelestial();
    if (window.feather) {
        window.feather.replace();
    }
    updateBodyStats();
}

export function updateTimeUI() {
    const { DateTime } = window.luxon || {};
    const effectiveDate = state.previewDate ? new Date(state.previewDate) : state.customDate;
    if(state.currentTab === 'simulation') {
        const input = document.getElementById('custom-time');
        if(input && !state.isRealTime){
            let isoString = '';
            if (DateTime) {
                const zone = state.simulationTimezoneConfirmed ? (state.simulationTimezone || 'UTC') : 'UTC';
                isoString = DateTime.fromJSDate(effectiveDate).setZone(zone).toFormat("yyyy-MM-dd'T'HH:mm");
            } else {
                isoString = effectiveDate.toISOString().slice(0, 16);
            }
            if (input.value !== isoString) { // minimize DOM updates
                input.value = isoString;
            }
        }
    }
    
    // Dynamic Time Banner update (Replaces display-time)
    const banner = document.getElementById('simulation-banner');
    if (banner) {
        // Determine active timezone
        let activeTz = 'UTC';
        let activeTzLabel = 'UTC';
        if (!state.isRealTime) {
            if (state.currentTab === 'simulation') {
                activeTz = state.simulationTimezone || 'UTC';
                activeTzLabel = `Simulasi (${activeTz})`;
            } else {
                const selectedP = state.personas.find(p => p.id === state.selectedPersonaId);
                if (selectedP) {
                    activeTz = selectedP.timezone || 'UTC';
                    activeTzLabel = `${selectedP.label || 'Persona'} (${activeTz})`;
                }
            }
        }

        // Local time
        let localTimeStr = '--';
        if (DateTime) {
            try {
                localTimeStr = DateTime.fromJSDate(effectiveDate).setZone(activeTz).toFormat('yyyy-MM-dd EEEE HH:mm:ss').toUpperCase();
            } catch (err) {
                localTimeStr = effectiveDate.toISOString().replace('T', ' ').substring(0, 19);
            }
        } else {
            localTimeStr = effectiveDate.toISOString().replace('T', ' ').substring(0, 19);
        }

        if (!state.isRealTime) {
            // Playback speed label
            let speedLabel = 'Jeda';
            if (state.isPlaying) {
                if (state.speed === 60) speedLabel = '1 Menit / dtk';
                else if (state.speed === 1800) speedLabel = '30 Menit / dtk';
                else if (state.speed === 3600) speedLabel = '1 Jam / dtk';
                else if (state.speed === 86400) speedLabel = '1 Hari / dtk';
                else speedLabel = `${state.speed} dtk / dtk`;
            }

            banner.className = "block mb-6 animate-fade-in";
            banner.innerHTML = `
                <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                    <div class="flex items-center gap-2">
                        <span class="flex h-2.5 w-2.5 relative">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                        </span>
                        <span class="font-black text-amber-800 uppercase tracking-widest font-mono">${state.previewDate ? 'Preview Waktu' : 'Simulasi Aktif'}</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-slate-600">
                        <div>ZONA: <span class="font-bold text-slate-900">${activeTzLabel}</span></div>
                        <div>WAKTU LOKAL: <span class="font-bold text-slate-900">${localTimeStr}</span></div>
                        <div>KECEPATAN: <span class="font-bold text-amber-800 bg-amber-500/20 px-2 py-0.5 rounded">${speedLabel}</span></div>
                    </div>
                </div>
                ${state.previewDate ? `
                <div class="mt-2 flex gap-2">
                    <button id="btn-apply-preview" class="tm-btn tm-btn--primary">Apply</button>
                    <button id="btn-cancel-preview" class="tm-btn tm-btn--secondary">Batal</button>
                </div>
                ` : ``}
            `;

            // Bind preview actions (safe to rebind each tick; uses direct onclick assignment)
            const applyBtn = document.getElementById('btn-apply-preview');
            if (applyBtn) {
                applyBtn.onclick = () => {
                    state.customDate = new Date(state.previewDate);
                    state.previewDate = null;
                    updateMap();
                    updateTimeUI();
                    updateBodyStats();
                };
            }
            const cancelBtn = document.getElementById('btn-cancel-preview');
            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    state.previewDate = null;
                    updateMap();
                    updateTimeUI();
                    updateBodyStats();
                };
            }
        } else {
            banner.className = "block mb-6 animate-fade-in";
            banner.innerHTML = `
                <div class="bg-slate-100 border border-slate-200 rounded-xl p-4 flex justify-between items-center text-xs">
                    <span class="font-black text-slate-500 uppercase tracking-widest font-mono">Waktu Sistem (UTC)</span>
                    <div class="font-mono text-xl md:text-2xl font-black text-slate-950 tracking-tighter">${localTimeStr}</div>
                </div>
            `;
        }
    }
    
    // Smoothly update all badge times inside active Cards to prevent full DOM rewriting/flickering
    updatePersonaTimeBadges();
}

export function updatePersonaTimeBadges() {
    if (state.currentTab !== 'location') return;
    const { DateTime } = window.luxon || {};
    if (!DateTime) return;
    const effectiveDate = state.previewDate ? new Date(state.previewDate) : state.customDate;
    state.personas.forEach(p => {
        const badge = document.getElementById(`p-time-badge-${p.id}`);
        if (badge && p.timezone) {
            try {
                const dt = DateTime.fromJSDate(effectiveDate).setZone(p.timezone);
                const offsetInMinutes = dt.offset;
                const hours = Math.floor(Math.abs(offsetInMinutes) / 60);
                const mins = Math.abs(offsetInMinutes) % 60;
                const sign = offsetInMinutes >= 0 ? '+' : '-';
                const offsetStr = mins === 0 ? `${sign}${hours}` : `${sign}${hours}:${mins.toString().padStart(2, '0')}`;
                const localStr = dt.toFormat('HH:mm:ss') + ' [' + offsetStr + '] (' + p.timezone + ')';
                if (badge.innerText !== localStr) {
                    badge.innerText = localStr;
                }
            } catch (e) {
                console.error("Failed badge update", e);
            }
        }
    });
}

export function updateBodyStats() {
    const effectiveDate = state.previewDate ? new Date(state.previewDate) : state.customDate;
    BODIES.forEach(b => {
         if (state.activeBodies.has(b.id)) {
             const infoDiv = document.querySelector(`#body-card-${b.id} .body-info`);
             if(infoDiv && !infoDiv.classList.contains('hidden')){
                const point = getSubPoint(b.id, effectiveDate);
                document.getElementById(`stats-${b.id}`).innerHTML = `
                    <span class="text-[9px] text-slate-400 dark:text-slate-500 font-sans uppercase font-bold tracking-widest block">Terrestrial Zenith</span>
                    <div class="text-slate-800 dark:text-slate-200 font-semibold bg-slate-50/80 dark:bg-slate-950/80 px-2.5 pt-2 pb-1.5 rounded-lg border border-slate-200/80 dark:border-slate-800/80 text-xs font-mono shadow-inner tracking-widest block text-center sm:text-left truncate">
                      LAT ${formatCoord(point[0], true)} <span class="text-slate-300 dark:text-slate-700">|</span> LON ${formatCoord(point[1], false)}
                    </div>
                `;
             }
         }
    });
}
