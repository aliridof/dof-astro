// js/store.js

const state = {
    subjects: [
        { id: 'p1', label: "Ka'bah", name: "المطاف", lat: 21.4225079, lng: 39.826189, timezone: 'Asia/Riyadh', isRealTime: true, date: null, time: null, elevation: 277 }
    ],
    selectedSubjectId: 'p1',
    activeBodies: new Set([
        'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Sirius',
        'subject-terrestrial-zenith', 'subject-terrestrial-nadir', 
        'subject-celestial-zenith', 'subject-celestial-nadir'
    ]),
    showZenith: true,
    showNadir: true,
    isRealTime: true,
    timeMachineEnabled: false,
    timeSourceMode: 'MANUAL',
    playDirection: 'FORWARD',
    simulationTimezone: 'UTC',
    simulationTimezoneConfirmed: false,
    customDate: new Date(),
    isPlaying: false,
    speed: 1, // Time skip magnitude (seconds per tick)
    timeMachineMode: 'N', // 'N' for Normal, 'C' for Custom
    customSpeedValue: 1,
    customSpeedUnit: 1, // 1 for SECOND, 60 for MINUTE, 3600 for HOUR, 86400 for DAY
    zodiacConfig: 'IAU',
    coordConfig: 'Toposentris',
    mapMode: 'MAP'
};

function getSubjectAnchorTime(subject) {
    if (subject.isRealTime !== false && (!subject.date || !subject.time)) {
        return new Date(); // Wall clock currently
    } else {
        const { DateTime } = window.luxon || {};
        if (DateTime && subject.date && subject.time && subject.timezone) {
            const dt = DateTime.fromISO(`${subject.date}T${subject.time}`, { zone: subject.timezone }).toUTC();
            if (dt.isValid) return dt.toJSDate();
        }
        return new Date();
    }
}
