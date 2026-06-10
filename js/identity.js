// js/identity.js

/**
 * Global configurations and core aspects for identity matching.
 */
const ASPECTS_CORE = [
    { id: 'CONJ', name: 'Konjungsi', angle: 0, symbol: '☌', color: '#10b981' },   // Emerald Green
    { id: 'SEXTILE', name: 'Sekstil', angle: 60, symbol: '⚹', color: '#3b82f6' },  // Blue
    { id: 'QUINTILE', name: 'Kuintil', angle: 72, symbol: 'Q', color: '#a855f7' },  // Purple
    { id: 'SQUARE', name: 'Kuadrat', angle: 90, symbol: '□', color: '#ef4444' },   // Red
    { id: 'TRINE', name: 'Trigon', angle: 120, symbol: '△', color: '#f59e0b' },   // Amber Orange
    { id: 'OPPO', name: 'Oposisi', angle: 180, symbol: '☍', color: '#64748b' }    // Slate Gray
];

const defaultOrbConfig = {
    mode: 'default',
    default_value: 3.5, // Default orb threshold (dalam derajat)
    custom_values: {
        'CONJ': 3.5,
        'SEXTILE': 3.0,
        'QUINTILE': 2.0,
        'SQUARE': 3.0,
        'TRINE': 3.0,
        'OPPO': 3.5
    }
};

/**
 * Mengambil nilai ORB (Offset Limit) untuk aspeks tertentu.
 *
 * @param {string} aspect_id - ID aspek
 * @param {Object} config - Konfigurasi ORB
 * @returns {number} Nilai ORB dalam derajat
 */
function getOrb(aspect_id, config = defaultOrbConfig) {
    if (!config) return 3.5;
    if (config.mode === 'default') {
        return config.default_value;
    }
    const customValue = config.custom_values ? config.custom_values[aspect_id] : undefined;
    return (customValue !== undefined) ? customValue : config.default_value;
}

/**
 * Mendapatkan daftar aspek kustom aktif (jika ada).
 *
 * @returns {Array} Aspek kustom aktif
 */
function getActiveCustomAspects() {
    return (window.activeCustomAspects || []);
}

/**
 * Mencari aspek yang paling cocok untuk sudut θ (Nearest-ORB).
 *
 * @param {number} theta - Jarak sudut aktual dalam derajat
 * @param {Object} orbConfig - Konfigurasi ORB
 * @returns {Object|null} Objek aspek terpilih lengkap dengan deviasi, atau null
 */
function matchAspect(theta, orbConfig = defaultOrbConfig) {
    if (theta === null || theta === undefined) return null;

    const allAspects = [...ASPECTS_CORE, ...getActiveCustomAspects()];
    let bestAspect = null;
    let bestDeviation = Infinity;

    for (const aspect of allAspects) {
        const orb = getOrb(aspect.id, orbConfig);
        const deviation = Math.abs(theta - aspect.angle);

        // Cek: (1) deviasi harus masuk di bawah batas ORB, (2) deviasi terkecil (Nearest-ORB)
        if (deviation <= orb && deviation < bestDeviation) {
            bestDeviation = deviation;
            bestAspect = {
                id: aspect.id,
                name: aspect.name,
                angle: aspect.angle,
                symbol: aspect.symbol,
                color: aspect.color,
                orbUsed: orb,
                deviation: deviation
            };
        }
    }

    return bestAspect;
}

/**
 * Menghitung vektor unit 3D dari Altitude dan Azimuth (Great-Circle path).
 *
 * @param {number} az - Azimuth dalam derajat [0, 360]
 * @param {number} alt - Altitude dalam derajat [-90, +90]
 * @param {Object} [entity] - Referensi entitas jika persona khusus
 * @returns {number[]} Array vektor unit 3D [x, y, z]
 */
function calculate3DVector(az, alt, entity) {
    if (entity) {
        if (entity.id === 'subject-terrestrial-zenith' || entity.id === 'subject-celestial-zenith') {
            return [0, 0, 1]; // Zenith mengarah tepat ke atas
        }
        if (entity.id === 'subject-terrestrial-nadir' || entity.id === 'subject-celestial-nadir') {
            return [0, 0, -1]; // Nadir mengarah tepat ke bawah
        }
    }

    const azRad = az * Math.PI / 180;
    const altRad = alt * Math.PI / 180;

    const x = Math.cos(altRad) * Math.cos(azRad);
    const y = Math.cos(altRad) * Math.sin(azRad);
    const z = Math.sin(altRad);

    return [x, y, z];
}

/**
 * Menghitung sudut pisah (angular separation) antara dua vektor unit 3D menggunakan Dot Product.
 * Menerapkan Clamping untuk pencegahan bias kepresisian angka desimal berlebih (NaN protection).
 *
 * @param {number[]} v1 - Vektor unit pertama [x, y, z]
 * @param {number[]} v2 - Vektor unit kedua [x, y, z]
 * @returns {number|null} Sudut pemisah dalam derajat [0, 180] atau null jika tidak valid
 */
function calculateAngularSeparation(v1, v2) {
    if (!v1 || !v2 || v1.length !== 3 || v2.length !== 3) return null;
    
    // Hasil perkalian dot product v1 . v2
    const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
    
    // Clamping untuk memotong presisi berlebih di luar jangkauan [-1.0, 1.0]
    const dotClamped = Math.max(-1.0, Math.min(1.0, dot));
    
    // Hitung arccos untuk memperoleh sudut dalam radian
    const rad = Math.acos(dotClamped);
    
    // Konversi ke derajat
    return rad * 180 / Math.PI;
}

/**
 * Mendapatkan koordinat/stats astronomi aktif dari suatu entitas.
 *
 * @param {string} entityId - ID entitas yang ingin dicari
 * @param {Date} date - Waktu kalkulasi
 * @param {Object} activeSubject - Pengamat terestrial utama
 * @param {Object} [reqConfig] - Konfigurasi tambahan (Zodiac / Koordinat sistem)
 * @returns {Object|null} Statistik toposentris aktif (az, alt, ra, dec, zodiac, subLat, subLon, dll.)
 */
function getActiveEntityStats(entityId, date = state.customDate, activeSubject = null, reqConfig = null) {
    if (typeof ENTITIES === 'undefined') return null;
    const entity = ENTITIES.find(e => e.id === entityId);
    if (!entity) return null;

    const subject = activeSubject || (typeof state !== 'undefined' ? state.subjects.find(s => s.id === state.selectedSubjectId) || state.subjects[0] : null);
    if (!subject) return null;

    const config = reqConfig || { zodiac: state.zodiacConfig, coord: state.coordConfig };
    let stats = null;

    if (entity.type === 'OBJECT') {
        if (typeof getBodyStats === 'function') {
            stats = getBodyStats(entity.id, date, subject, config);
        }
    } else if (entity.type === 'TERRESTRIAL') {
        if (typeof getTerrestrialStaticStats === 'function') {
            stats = getTerrestrialStaticStats(entity.isZenith, date, subject, config);
        }
    } else if (entity.type === 'CELESTIAL') {
        const anchorTime = typeof getSubjectAnchorTime === 'function' ? getSubjectAnchorTime(subject) : date;
        if (typeof getCelestialCoordinates === 'function' && typeof getImaginaryPointStats === 'function') {
            const coords = getCelestialCoordinates(subject.lat, subject.lng, anchorTime);
            if (coords) {
                const coordPoint = entity.isZenith ? coords.zenith : coords.nadir;
                stats = getImaginaryPointStats(coordPoint.ra * 15, coordPoint.dec, date, subject, config);
            }
        }
    }

    return stats;
}

/**
 * Helper untuk memeriksa apakah entitas berada di belahan Zenith.
 *
 * @param {Object} entity
 * @param {boolean} isAbove - Apakah alt >= H_threshold
 * @returns {boolean}
 */
function isZenithSide(entity, isAbove) {
    if (entity.id === 'subject-terrestrial-zenith' || entity.id === 'subject-celestial-zenith') return true;
    if (entity.id === 'subject-terrestrial-nadir' || entity.id === 'subject-celestial-nadir') return false;
    return isAbove;
}

/**
 * Helper untuk memeriksa apakah entitas berada di belahan Nadir.
 *
 * @param {Object} entity
 * @param {boolean} isAbove - Apakah alt >= H_threshold
 * @returns {boolean}
 */
function isNadirSide(entity, isAbove) {
    if (entity.id === 'subject-terrestrial-nadir' || entity.id === 'subject-celestial-nadir') return true;
    if (entity.id === 'subject-terrestrial-zenith' || entity.id === 'subject-celestial-zenith') return false;
    return !isAbove;
}

/**
 * Kelas Identity merepresentasikan hubungan interaksi spasial 3D / hubungan logis antara 2 buah entitas.
 */
class Identity {
    /**
     * @param {Object|string} entityA - Entitas pertama (objek utuh atau ID)
     * @param {Object|string} entityB - Entitas kedua (objek utuh atau ID)
     * @param {Date} [date] - Waktu kalkulasi
     * @param {Object} [activeSubject] - Subjek pengamat terestrial
     * @param {Object} [orbConfig] - Konfigurasi ORB aspek
     */
    constructor(entityA, entityB, date = (typeof state !== 'undefined' ? state.customDate : new Date()), activeSubject = null, orbConfig = null) {
        if (typeof ENTITIES === 'undefined') {
            throw new Error('ENTITIES is not defined. Ensure js/entity.js is loaded.');
        }

        // Resolusi Entitas
        this.entityA = typeof entityA === 'string' ? ENTITIES.find(e => e.id === entityA) : entityA;
        this.entityB = typeof entityB === 'string' ? ENTITIES.find(e => e.id === entityB) : entityB;

        if (!this.entityA || !this.entityB) {
            throw new Error(`Invalid entities provided to Identity: ${entityA}, ${entityB}`);
        }

        this.date = date;
        this.subject = activeSubject || (typeof state !== 'undefined' ? state.subjects.find(s => s.id === state.selectedSubjectId) || state.subjects[0] : null);
        this.orbConfig = orbConfig || defaultOrbConfig;

        // Tarik data koordinat rill toposentris aktif kedua objek
        this.statsA = getActiveEntityStats(this.entityA.id, this.date, this.subject);
        this.statsB = getActiveEntityStats(this.entityB.id, this.date, this.subject);

        // Jika data koordinat tersedia, hitung sudut & kecocokan aspek
        if (this.statsA && this.statsB) {
            this.vecA = calculate3DVector(this.statsA.az, this.statsA.alt, this.entityA);
            this.vecB = calculate3DVector(this.statsB.az, this.statsB.alt, this.entityB);
            
            // Hitung Sudut Pisah Terpendek (Great-Circle Path)
            this.theta = calculateAngularSeparation(this.vecA, this.vecB);
            
            // Cari Aspek Aktif (Nearest-ORB)
            this.aspect = matchAspect(this.theta, this.orbConfig);

            const hThreshold = (typeof state !== 'undefined' && state.horizonThreshold !== undefined) ? state.horizonThreshold : 3.0;
            this.isAboveA = this.statsA.alt >= hThreshold;
            this.isAboveB = this.statsB.alt >= hThreshold;

            this.isZenithSideA = isZenithSide(this.entityA, this.isAboveA);
            this.isZenithSideB = isZenithSide(this.entityB, this.isAboveB);
            this.isNadirSideA = isNadirSide(this.entityA, this.isAboveA);
            this.isNadirSideB = isNadirSide(this.entityB, this.isAboveB);

            // Klasifikasi Zona Kubah Belahan Langit
            this.isZenithZone = this.isZenithSideA && this.isZenithSideB; // Hanya aktif jika kedua objek di Zenith
            this.isNadirZone = this.isNadirSideA && this.isNadirSideB;   // Hanya aktif jika kedua objek di Nadir
        } else {
            this.vecA = null;
            this.vecB = null;
            this.theta = null;
            this.aspect = null;
            this.isZenithZone = false;
            this.isNadirZone = false;
        }
    }

    /**
     * Mengembalikan status representasi apakah hubungan Identity aktif untuk tipe matriks tertentu.
     *
     * @param {string} matrixType - 'ZENITH', 'NADIR', or 'MATRIX' (general)
     * @returns {boolean} True jika aktif di zona matriks tersebut
     */
    isActiveInMatrix(matrixType) {
        if (matrixType === 'ZENITH') {
            return this.isZenithZone;
        }
        if (matrixType === 'NADIR') {
            return this.isNadirZone;
        }
        // General 'MATRIX' selalu aktif
        return true;
    }
}
