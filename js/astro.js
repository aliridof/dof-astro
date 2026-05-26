// js/astro.js
import SwissEph from 'https://cdn.jsdelivr.net/gh/prolaxu/swisseph-wasm@main/src/swisseph.js';

let swe = null;

export async function initAstro() {
    if (!swe) {
        swe = new SwissEph();
        await swe.initSwissEph();
    }
}

const BODY_MAP = {
    'Sun': 0, // swe.SE_SUN
    'Moon': 1,
    'Mercury': 2,
    'Venus': 3,
    'Mars': 4,
    'Jupiter': 5,
    'Saturn': 6,
    'Uranus': 7,
    'Neptune': 8,
    'Pluto': 9
};

function getJD(date) {
    return swe.julday(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours() + (date.getUTCMinutes() / 60.0) + (date.getUTCSeconds() / 3600.0) + (date.getUTCMilliseconds() / 3600000.0)
    );
}

export function getSubPoint(bodyStr, date) {
    try {
        if (!swe) return [0, 0];
        
        const jd = getJD(date);
        const body = BODY_MAP[bodyStr];
        
        // Use Swiss Ephemeris for Equatorial Coordinates (2 = SEFLG_SWIEPH, 2048 = SEFLG_EQUATORIAL)
        const flags = swe.SEFLG_SWIEPH | swe.SEFLG_EQUATORIAL;
        const eq = swe.calc_ut(jd, body, flags);
        
        const raDeg = eq[0]; // RA in degrees
        const dec = eq[1]; // Declination in degrees
        
        const gstHours = swe.sidtime(jd);
        const gstDeg = gstHours * 15;
        
        let lon = raDeg - gstDeg;
        lon = ((lon % 360) + 360) % 360; 
        if (lon > 180) lon -= 360;
        
        return [dec, lon];
    } catch (e) {
        console.error("Math error for body:", bodyStr, e);
        return [0, 0];
    }
}

export function getSubPointFromRA(raHours, dec, date) {
    try {
        if (!swe) return [0, 0];
        const jd = getJD(date);
        const gstHours = swe.sidtime(jd);
        
        let lon = (raHours - gstHours) * 15;
        lon = ((lon % 360) + 360) % 360; 
        if (lon > 180) lon -= 360;
        
        return [dec, lon];
    } catch (e) {
        console.error("Math error subpoint from RA:", e);
        return [0, 0];
    }
}

export function formatCoord(val, isLat) {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${Math.abs(val).toFixed(4)}° ${dir}`;
}

export function getCelestialCoordinates(lat, lng, date) {
    try {
        if (!swe) return null;
        const jd = getJD(date);
        const gstHours = swe.sidtime(jd);
        
        let lstHours = gstHours + (lng / 15);
        lstHours = ((lstHours % 24) + 24) % 24;
        
        const zenithDec = lat;
        const zenithRa = lstHours;
        
        const nadirDec = -lat;
        const nadirRa = (lstHours + 12) % 24;
        
        return {
            gst: gstHours,
            lst: lstHours,
            zenith: { ra: zenithRa, dec: zenithDec },
            nadir: { ra: nadirRa, dec: nadirDec }
        };
    } catch (e) {
        console.error("Failed to calculate celestial coordinates", e);
        return null;
    }
}

export function formatRA(raHours) {
    const hours = Math.floor(raHours);
    const minutes = Math.floor((raHours - hours) * 60);
    const seconds = Math.floor(((raHours - hours) * 60 - minutes) * 60);
    const deg = (raHours * 15).toFixed(4);
    return `${hours.toString().padStart(2, '0')}j ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}d (${deg}°)`;
}

export function getBodyPath(bodyId, centerDate) {
    const path = [];
    for (let i = -24; i <= 24; i++) {
        const d = new Date(centerDate.getTime() + i * 1800000); // 30 mins
        path.push(getSubPoint(bodyId, d));
    }
    
    const unwrapped = [];
    let prevLng = null;
    let offset = 0;
    
    for (const [lat, lng] of path) {
        let currentLng = lng;
        if (prevLng !== null) {
            const diff = currentLng - prevLng;
            if (diff > 180) offset -= 360;
            else if (diff < -180) offset += 360;
        }
        prevLng = currentLng;
        unwrapped.push([lat, currentLng + offset]);
    }
    
    return [
        unwrapped.map(([lat, lng]) => [lat, lng - 360]),
        unwrapped,
        unwrapped.map(([lat, lng]) => [lat, lng + 360])
    ];
}

export function getTerminator(sunLat, sunLng) {
    // Terminator generator (leaflet-safe):
    // - Always output in lon range [-180, 180] to avoid self-intersecting polygons under world-wrap.
    // - Pick the correct "night" polygon by testing whether the anti-solar point is inside.
    const D2R = Math.PI / 180;
    const R2D = 180 / Math.PI;

    const wrap180 = (lon) => {
        lon = ((lon + 180) % 360 + 360) % 360 - 180;
        // normalize -180 to 180 so polygon closure is consistent
        return lon === -180 ? 180 : lon;
    };

    const pointInPolygon = (ringLatLng, pointLat, pointLng) => {
        // Ray casting; treat x=lng, y=lat
        let inside = false;
        for (let i = 0, j = ringLatLng.length - 1; i < ringLatLng.length; j = i++) {
            const yi = ringLatLng[i][0], xi = ringLatLng[i][1];
            const yj = ringLatLng[j][0], xj = ringLatLng[j][1];
            const intersect = ((yi > pointLat) !== (yj > pointLat)) &&
                (pointLng < (xj - xi) * (pointLat - yi) / ((yj - yi) || 1e-12) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    let latRad = sunLat * D2R;
    const lngRad = sunLng * D2R;

    // Avoid tan(0) explosion at equinox
    if (Math.abs(sunLat) < 0.1) {
        latRad = (sunLat >= 0 ? 0.1 : -0.1) * D2R;
    }

    // Build terminator line once for a single world: [-180..180]
    const stepDeg = 2; // smoother edge; still cheap
    const polyline = [];
    for (let lon = -180; lon <= 180; lon += stepDeg) {
        const lonRad = lon * D2R;
        const tanPhi = -Math.cos(lonRad - lngRad) / Math.tan(latRad);
        const phi = Math.atan(tanPhi) * R2D;
        polyline.push([phi, lon]);
    }

    const makeNightPoly = (closeLat) => {
        // Close polygon by running along the chosen pole from 180 back to -180.
        return [...polyline, [closeLat, 180], [closeLat, -180]];
    };

    // Anti-solar point should always lie in the night side
    const antiLat = -sunLat;
    const antiLon = wrap180(sunLng + 180);

    const candidateNorth = makeNightPoly(90);
    const candidateSouth = makeNightPoly(-90);

    // Select the polygon that contains the anti-solar point.
    const polygon = pointInPolygon(candidateNorth, antiLat, antiLon) ? candidateNorth : candidateSouth;

    return { polyline, polygon };
}

