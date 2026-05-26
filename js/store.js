// js/store.js

export const BODIES = [
    { id: 'Sun', label: 'SUN', subLabel: 'Matahari / شمس (Syams)', color: '#f59e0b', symbol: '☉', class: 'sun-marker' },
    { id: 'Moon', label: 'MOON', subLabel: 'Bulan / قمر (Qamar)', color: '#94a3b8', symbol: '☽', class: 'moon-marker' },
    { id: 'Mercury', label: 'MERCURY', subLabel: 'Merkurius / عطارد (Atarid)', color: '#f87171', symbol: '☿', class: 'mercury-marker' },
    { id: 'Venus', label: 'VENUS', subLabel: 'Venus / زهرة (Zuhrah)', color: '#facc15', symbol: '♀', class: 'venus-marker' },
    { id: 'Mars', label: 'MARS', subLabel: 'Mars / مريخ (Marrikh)', color: '#ef4444', symbol: '♂', class: 'mars-marker' },
    { id: 'Jupiter', label: 'JUPITER', subLabel: 'Jupiter / مشتری (Musytari)', color: '#ea580c', symbol: '♃', class: 'jupiter-marker' },
    { id: 'Saturn', label: 'SATURN', subLabel: 'Saturnus / زحل (Zuhal)', color: '#fbbf24', symbol: '♄', class: 'saturn-marker' },
    { id: 'Uranus', label: 'URANUS', subLabel: 'Uranus / أورانوس (Uranus)', color: '#38bdf8', symbol: '♅', class: 'uranus-marker' },
    { id: 'Neptune', label: 'NEPTUNE', subLabel: 'Neptunus / نبتون (Nibtun)', color: '#3b82f6', symbol: '♆', class: 'neptune-marker' },
    { id: 'Pluto', label: 'PLUTO', subLabel: 'Pluto / بلوتو (Bluto)', color: '#a855f7', symbol: '♇', class: 'pluto-marker' },
];

export const state = {
    personas: [
        { id: 'p1', label: "Ka'bah", name: "المطاف", lat: 21.4225079, lng: 39.826189, timezone: 'Asia/Riyadh', isRealTime: true, date: null, time: null, elevation: 277 }
    ],
    selectedPersonaId: 'p1',
    activeBodies: new Set(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']),
    showZenith: true,
    showNadir: true,
    isRealTime: true,
    simulationTimezone: 'UTC',
    simulationTimezoneConfirmed: false,
    customDate: new Date(),
    // Preview time used when dragging markers (simulation only). Apply/Cancel will commit/revert.
    previewDate: null,
    isPlaying: false,
    speed: 3600, // Time skip magnitude (seconds per tick)
    currentTab: 'location'
};

export function getPersonaAnchorTime(persona) {
    if (persona.isRealTime !== false && (!persona.date || !persona.time)) {
        return new Date(); // Wall clock currently
    } else {
        const { DateTime } = window.luxon || {};
        if (DateTime && persona.date && persona.time && persona.timezone) {
            const dt = DateTime.fromISO(`${persona.date}T${persona.time}`, { zone: persona.timezone }).toUTC();
            if (dt.isValid) return dt.toJSDate();
        }
        return new Date();
    }
}
