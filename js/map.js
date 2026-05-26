// js/map.js
import { BODIES, state, getPersonaAnchorTime } from './store.js';
import { getSubPoint, formatCoord, getCelestialCoordinates, formatRA, getSubPointFromRA, getBodyPath, getTerminator } from './astro.js';

export let map;
export let markers = {}; 
export let paths = {};
export let terminatorPolygonLayer = null;
export let terminatorPolylineLayer = null;
let terminatorPaneReady = false;

const DRAGGABLE_IDS = new Set([...BODIES.map(b => b.id), 'cz', 'cn']);
const D2R = Math.PI / 180;

const dragCtx = {
    active: false,
    id: null,
    samples: null,
    refLng: 0,
    rafPending: false,
    prevIsPlaying: false
};

function shiftLng(latlngs, lngOffset) {
    return latlngs.map(([lat, lng]) => [lat, lng + lngOffset]);
}

function wrap180(lon) {
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return lon === -180 ? 180 : lon;
}

function unwrapToNear(lonWrapped, refLonUnwrapped) {
    const cands = [lonWrapped, lonWrapped + 360, lonWrapped - 360, lonWrapped + 720, lonWrapped - 720];
    let best = cands[0];
    let bestD = Math.abs(best - refLonUnwrapped);
    for (const c of cands.slice(1)) {
        const d = Math.abs(c - refLonUnwrapped);
        if (d < bestD) { bestD = d; best = c; }
    }
    return best;
}

function isDragModeAllowed() {
    // Sesuai permintaan: drag hanya aktif di mode simulasi (bukan real-time)
    return !state.isRealTime && state.simulationTimezoneConfirmed === true;
}

function getEffectiveDate() {
    return state.previewDate ? new Date(state.previewDate) : state.customDate;
}

function setDraggingEnabled(marker, enabled) {
    if (!marker || !marker.dragging) return;
    enabled ? marker.dragging.enable() : marker.dragging.disable();
}

function buildSamplesForId(id, centerDate, stepMin = 10, spanHours = 24) {
    // Build samples around centerDate for snapping.
    // stepMin: smaller = higher accuracy but heavier
    // spanHours: larger = longer scrubbing range but heavier
    const start = new Date(centerDate.getTime() - spanHours * 3600_000);
    const end = new Date(centerDate.getTime() + spanHours * 3600_000);

    const activePersona = state.personas.find(p => p.id === state.selectedPersonaId) || state.personas[0] || null;
    let czcnCoords = null;
    if (activePersona && (id === 'cz' || id === 'cn')) {
        const anchorTime = getPersonaAnchorTime(activePersona);
        czcnCoords = getCelestialCoordinates(activePersona.lat, activePersona.lng, anchorTime);
    }

    const raw = [];
    for (let t = start.getTime(); t <= end.getTime(); t += stepMin * 60_000) {
        const d = new Date(t);
        let pt = null;
        if (BODIES.some(b => b.id === id)) {
            pt = getSubPoint(id, d);
        } else if ((id === 'cz' || id === 'cn') && czcnCoords) {
            const target = id === 'cz' ? czcnCoords.zenith : czcnCoords.nadir;
            pt = getSubPointFromRA(target.ra, target.dec, d);
        }
        if (!pt) continue;
        raw.push({ lat: pt[0], lng: pt[1], timeMs: t });
    }
    if (raw.length < 2) return null;

    // Unwrap longitude to keep continuity
    const samples = [];
    let prevLng = null;
    let offset = 0;
    for (const p of raw) {
        let lng = p.lng;
        if (prevLng !== null) {
            const diff = lng - prevLng;
            if (diff > 180) offset -= 360;
            else if (diff < -180) offset += 360;
        }
        prevLng = lng;
        samples.push({ lat: p.lat, lng: lng + offset, timeMs: p.timeMs });
    }
    return samples;
}

function snapToSamples(samples, targetLat, targetLngUnwrapped) {
    if (!samples || samples.length < 2) return null;
    let best = null;
    let bestD2 = Infinity;

    for (let i = 0; i < samples.length - 1; i++) {
        const a = samples[i];
        const b = samples[i + 1];

        // Scale longitude by cos(lat) to reduce distortion
        const meanLat = (a.lat + b.lat) / 2;
        const k = Math.cos(meanLat * D2R) || 1e-6;

        const ax = a.lng * k, ay = a.lat;
        const bx = b.lng * k, by = b.lat;
        const px = targetLngUnwrapped * k, py = targetLat;

        const abx = bx - ax, aby = by - ay;
        const apx = px - ax, apy = py - ay;
        const denom = abx * abx + aby * aby || 1e-12;
        let t = (apx * abx + apy * aby) / denom;
        if (t < 0) t = 0;
        if (t > 1) t = 1;

        const lat = a.lat + t * (b.lat - a.lat);
        const lng = a.lng + t * (b.lng - a.lng);
        const timeMs = a.timeMs + t * (b.timeMs - a.timeMs);

        const dx = (targetLngUnwrapped - lng) * k;
        const dy = targetLat - lat;
        const d2 = dx * dx + dy * dy;

        if (d2 < bestD2) {
            bestD2 = d2;
            best = { lat, lng, timeMs };
        }
    }
    return best;
}

function syncMarkerCopiesToUnwrapped(id, lat, lngUnwrapped) {
    if (!markers[id] || !Array.isArray(markers[id])) return;
    const base = wrap180(lngUnwrapped);
    markers[id][0].setLatLng([lat, base - 360]);
    markers[id][1].setLatLng([lat, base]);
    markers[id][2].setLatLng([lat, base + 360]);
}

function bindDragHandlers(marker, id) {
    if (!marker || marker._tmDragBound) return;
    marker._tmDragBound = true;

    marker.on('dragstart', () => {
        if (!isDragModeAllowed() || !DRAGGABLE_IDS.has(id)) return;
        dragCtx.active = true;
        dragCtx.id = id;
        dragCtx.prevIsPlaying = state.isPlaying;
        state.isPlaying = false; // pause playback while dragging

        // Higher zoom => denser samples for better snapping precision.
        const z = map ? map.getZoom() : 2;
        const stepMin = z >= 4 ? 2 : (z >= 3 ? 5 : 10);
        const spanHours = z >= 4 ? 12 : (z >= 3 ? 18 : 24);

        dragCtx.samples = buildSamplesForId(id, state.customDate, stepMin, spanHours);
        dragCtx.refLng = dragCtx.samples ? dragCtx.samples[Math.floor(dragCtx.samples.length / 2)].lng : 0;

        // Enter preview mode immediately
        state.previewDate = new Date(state.customDate);
        window.dispatchEvent(new CustomEvent('preview-changed'));
    });

    marker.on('drag', (e) => {
        if (!dragCtx.active || dragCtx.id !== id || !dragCtx.samples) return;
        const ll = e.target.getLatLng();
        const targetLng = unwrapToNear(ll.lng, dragCtx.refLng);
        const snapped = snapToSamples(dragCtx.samples, ll.lat, targetLng);
        if (!snapped) return;

        dragCtx.refLng = snapped.lng;
        state.previewDate = new Date(snapped.timeMs);
        syncMarkerCopiesToUnwrapped(id, snapped.lat, snapped.lng);

        if (!dragCtx.rafPending) {
            dragCtx.rafPending = true;
            requestAnimationFrame(() => {
                dragCtx.rafPending = false;
                window.dispatchEvent(new CustomEvent('preview-changed'));
            });
        }
    });

    marker.on('dragend', () => {
        if (!dragCtx.active || dragCtx.id !== id) return;
        dragCtx.active = false;
        dragCtx.id = null;
        dragCtx.samples = null;
        dragCtx.rafPending = false;

        // After drag ends, re-render everything at preview time (still not applied until user clicks Apply).
        updateMap();
        window.dispatchEvent(new CustomEvent('preview-changed'));
    });
}

export function initMap() {
    map = window.L.map('map', {
        worldCopyJump: true,
        maxBoundsViscosity: 1.0,
        minZoom: 1.5,
        zoomDelta: 0.25,
        zoomSnap: 0,
        wheelPxPerZoomLevel: 100, // Makes scroll zooming smoother
        wheelDebounceTime: 20,
        fadeAnimation: true,
        markerZoomAnimation: true,
        zoomControl: false, // Custom position instead
        attributionControl: false // Hide default attribution for a cleaner look
    }).setView([15, 45], 2.2); // Initial center

    // Dedicated pane so terminator is always above tiles and below markers
    if (!terminatorPaneReady) {
        const pane = map.createPane('terminatorPane');
        pane.style.zIndex = 350; // tilePane=200, overlayPane=400, markerPane=600
        terminatorPaneReady = true;
    }

    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Add minimal zoom control to bottom right
    window.L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Make the map more interactive with cursor changes
    map.getContainer().style.cursor = 'crosshair';

    map.on('click', (e) => {
        const wrapped = e.latlng.wrap();
        const event = new CustomEvent('map-clicked', {
            detail: { lat: wrapped.lat, lng: wrapped.lng }
        });
        window.dispatchEvent(event);
    });
}

function removeMarker(id) {
    if (markers[id]) {
        if (Array.isArray(markers[id])) {
            markers[id].forEach(m => map.removeLayer(m));
        } else {
            map.removeLayer(markers[id]);
        }
        delete markers[id];
    }
}

function syncMarker(id, point, icon, popupContent, zIndexOffset = 1000) {
    const canBeDragged = DRAGGABLE_IDS.has(id);
    if (!markers[id]) {
        markers[id] = [
            window.L.marker([point[0], point[1] - 360], { icon, zIndexOffset, draggable: canBeDragged }).addTo(map),
            window.L.marker(point, { icon, zIndexOffset, draggable: canBeDragged }).addTo(map),
            window.L.marker([point[0], point[1] + 360], { icon, zIndexOffset, draggable: canBeDragged }).addTo(map)
        ];
        markers[id].forEach(m => m.bindPopup(popupContent));
        if (canBeDragged) {
            markers[id].forEach(m => bindDragHandlers(m, id));
        }
    } else {
        markers[id][0].setLatLng([point[0], point[1] - 360]);
        markers[id][1].setLatLng(point);
        markers[id][2].setLatLng([point[0], point[1] + 360]);
        markers[id].forEach(m => {
            const popup = m.getPopup();
            if(popup && popup.isOpen()){
                popup.setContent(popupContent);
            }
        });
    }

    // Enable drag only in simulation mode; otherwise disable.
    if (canBeDragged) {
        const enabled = isDragModeAllowed();
        markers[id].forEach(m => setDraggingEnabled(m, enabled));
    }
}

export function updateMap() {
    if (!map) return;
    const effectiveDate = getEffectiveDate();
    
    // Draw Day-Night Terminator
    const sunPoint = getSubPoint('Sun', effectiveDate);
    const terminator = getTerminator(sunPoint[0], sunPoint[1]);

    // Multi-wrap terminator so the line/polygon stays continuous when panning across world copies.
    const terminatorPolylineWrapped = [
        shiftLng(terminator.polyline, -360),
        terminator.polyline,
        shiftLng(terminator.polyline, 360),
    ];
    const terminatorPolygonWrapped = [
        shiftLng(terminator.polygon, -360),
        terminator.polygon,
        shiftLng(terminator.polygon, 360),
    ];
    
    if (!terminatorPolygonLayer) {
        terminatorPolygonLayer = window.L.polygon(terminatorPolygonWrapped, {
            color: 'transparent',
            stroke: false,
            fillColor: '#0f172a', // slate-900 / dark mode blueish
            fillOpacity: 0.35,
            interactive: false,
            noClip: true,
            pane: 'terminatorPane'
        }).addTo(map);
        
        terminatorPolylineLayer = window.L.polyline(terminatorPolylineWrapped, {
            color: '#eab308', // gold/yellow
            weight: 2.25,
            opacity: 0.9,
            interactive: false,
            noClip: true,
            pane: 'terminatorPane'
        }).addTo(map);
    } else {
        terminatorPolygonLayer.setLatLngs(terminatorPolygonWrapped);
        terminatorPolylineLayer.setLatLngs(terminatorPolylineWrapped);
    }
    
    BODIES.forEach(b => {
        if (!state.activeBodies.has(b.id)) {
            removeMarker(b.id);
            if (paths[b.id]) {
                map.removeLayer(paths[b.id]);
                delete paths[b.id];
            }
            return;
        }

        const point = getSubPoint(b.id, effectiveDate);
        
        // Draw Multi-Wrap trajectory
        const wrappedPaths = getBodyPath(b.id, effectiveDate);
        if (!paths[b.id]) {
            paths[b.id] = window.L.polyline(wrappedPaths, {
                color: b.color,
                weight: 1.5,
                opacity: 0.5,
                dashArray: '4, 4'
            }).addTo(map);
        } else {
            paths[b.id].setLatLngs(wrappedPaths);
        }
        
        const iconElement = document.createElement('div');
        iconElement.className = 'w-7 h-7 bg-white dark:bg-slate-800 rounded-full border-2 border-white dark:border-slate-900 shadow-md flex items-center justify-center text-lg font-bold transition-transform transform hover:scale-110 relative z-10';
        iconElement.innerHTML = `<span style="color: ${b.color}">${b.symbol}</span>`;
        
        const icon = window.L.divIcon({
            className: '',
            html: iconElement.outerHTML,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        });
        
        const popupContent = `<div class="font-bold text-center text-slate-800 uppercase tracking-wide">${b.label}</div>
                 <div class="text-[11px] text-slate-500 font-mono text-center mt-1">
                 ${formatCoord(point[0], true)} <br/> ${formatCoord(point[1], false)}
                 </div>`;
        
        syncMarker(b.id, point, icon, popupContent, 1000);
    });

    const activePersona = state.personas.find(p => p.id === state.selectedPersonaId) || state.personas[0];
    if (activePersona) {
        // Zenith (TZ)
        if (!state.showZenith) {
            removeMarker('zenith');
        } else {
            const zLat = activePersona.lat;
            const zLng = activePersona.lng;
            const point = [zLat, zLng];
            
            const iconElement = document.createElement('div');
            iconElement.className = 'w-7 h-7 bg-slate-950 dark:bg-white rounded-full border border-white dark:border-slate-950 shadow-md flex items-center justify-center text-xs font-mono font-bold text-white dark:text-slate-950 transition-transform transform hover:scale-110 relative z-20';
            iconElement.innerHTML = `<span>TZ</span>`;
            
            const icon = window.L.divIcon({
                className: '',
                html: iconElement.outerHTML,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            });
            
            const popupContent = `<div class="font-bold text-center text-slate-800 uppercase tracking-wide font-sans">Terrestrial Zenith (TZ)</div>
                     <div class="text-[10px] text-center text-slate-400 font-medium leading-tight mt-0.5">Overhead Observer Point</div>
                     <div class="text-[11px] text-slate-500 font-mono text-center mt-1.5 border-t border-slate-100 pt-1.5">
                     ${activePersona.label || "Ka'bah"} <br/>
                     ${formatCoord(point[0], true)} <span class="text-slate-300">|</span> ${formatCoord(point[1], false)}
                     </div>`;
                     
            syncMarker('zenith', point, icon, popupContent, 2000);
        }

        // Celestial Zenith (CZ)
        if (!state.showZenith) {
            removeMarker('cz');
        } else {
            const anchorTime = getPersonaAnchorTime(activePersona);
            const coords = getCelestialCoordinates(activePersona.lat, activePersona.lng, anchorTime);
            let point = [activePersona.lat, activePersona.lng];
            if (coords) {
                point = getSubPointFromRA(coords.zenith.ra, coords.zenith.dec, effectiveDate);
            }
            
            const popupContent = coords ? 
                `<div class="font-bold text-center text-slate-850 uppercase tracking-wide font-sans">Celestial Zenith (CZ)</div>
                 <div class="text-[10px] text-center text-slate-400 font-medium leading-none mt-0.5">Local Horizon Zenith Projection</div>
                 <div class="text-[11px] text-slate-6050 font-mono text-center mt-2 border-t border-slate-100 pt-2 space-y-1">
                   <div>Dec: <span class="font-semibold text-slate-800">${formatCoord(coords.zenith.dec, true)}</span></div>
                   <div>RA: <span class="font-semibold text-slate-800">${formatRA(coords.zenith.ra)}</span></div>
                 </div>` : 
                `<div class="font-bold text-center text-slate-800 uppercase tracking-wide font-sans">Celestial Zenith (CZ)</div>`;

            const iconElement = document.createElement('div');
            iconElement.className = 'w-7 h-7 bg-white text-slate-950 rounded-full border-2 border-slate-950 shadow-md flex items-center justify-center text-xs font-mono font-bold transition-transform transform hover:scale-110 relative z-30';
            iconElement.innerHTML = `<span>CZ</span>`;
            
            const icon = window.L.divIcon({
                className: '',
                html: iconElement.outerHTML,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            });
            
            syncMarker('cz', point, icon, popupContent, 3000);
        }

        // Nadir (TN)
        if (!state.showNadir) {
            removeMarker('nadir');
        } else {
            const nLat = -activePersona.lat;
            let nLng = activePersona.lng + 180;
            if (nLng > 180) nLng -= 360;
            const point = [nLat, nLng];
            
            const iconElement = document.createElement('div');
            iconElement.className = 'w-7 h-7 bg-slate-950 dark:bg-white rounded-full border border-white dark:border-slate-950 shadow-md flex items-center justify-center text-xs font-mono font-bold text-white dark:text-slate-950 transition-transform transform hover:scale-110 relative z-20';
            iconElement.innerHTML = `<span>TN</span>`;
            
            const icon = window.L.divIcon({
                className: '',
                html: iconElement.outerHTML,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            });
            
            const popupContent = `<div class="font-bold text-center text-slate-800 uppercase tracking-wide font-sans">Terrestrial Nadir (TN)</div>
                     <div class="text-[10px] text-center text-slate-400 font-medium leading-tight mt-0.5">Antipodal Observer Point</div>
                     <div class="text-[11px] text-slate-500 font-mono text-center mt-1.5 border-t border-slate-100 pt-1.5">
                     ${activePersona.label || "Ka'bah"} Antipod <br/>
                     ${formatCoord(point[0], true)} <span class="text-slate-300">|</span> ${formatCoord(point[1], false)}
                     </div>`;
                     
            syncMarker('nadir', point, icon, popupContent, 2000);
        }

        // Celestial Nadir (CN)
        if (!state.showNadir) {
            removeMarker('cn');
        } else {
            const anchorTime = getPersonaAnchorTime(activePersona);
            const coords = getCelestialCoordinates(activePersona.lat, activePersona.lng, anchorTime);
            let point = [0, 0];
            if (coords) {
                point = getSubPointFromRA(coords.nadir.ra, coords.nadir.dec, effectiveDate);
            } else {
                let nLng = activePersona.lng + 180;
                if (nLng > 180) nLng -= 360;
                point = [-activePersona.lat, nLng];
            }
            
            const popupContent = coords ? 
                `<div class="font-bold text-center text-slate-850 uppercase tracking-wide font-sans">Celestial Nadir (CN)</div>
                 <div class="text-[10px] text-center text-slate-400 font-medium leading-none mt-0.5">Local Horizon Nadir Projection</div>
                 <div class="text-[11px] text-slate-6050 font-mono text-center mt-2 border-t border-slate-100 pt-2 space-y-1">
                   <div>Dec: <span class="font-semibold text-slate-800">${formatCoord(coords.nadir.dec, true)}</span></div>
                   <div>RA: <span class="font-semibold text-slate-800">${formatRA(coords.nadir.ra)}</span></div>
                 </div>` : 
                `<div class="font-bold text-center text-slate-800 uppercase tracking-wide font-sans">Celestial Nadir (CN)</div>`;

            const iconElement = document.createElement('div');
            iconElement.className = 'w-7 h-7 bg-white text-slate-950 rounded-full border-2 border-slate-950 shadow-md flex items-center justify-center text-xs font-mono font-bold transition-transform transform hover:scale-110 relative z-30';
            iconElement.innerHTML = `<span>CN</span>`;
            
            const icon = window.L.divIcon({
                className: '',
                html: iconElement.outerHTML,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
            });
            
            syncMarker('cn', point, icon, popupContent, 3000);
        }
    }
}
