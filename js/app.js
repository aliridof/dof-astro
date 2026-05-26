// js/app.js
import { state } from './store.js';
import { initAstro } from './astro.js';
import { initMap, updateMap } from './map.js';
import { renderTabs, renderSidebar, renderBodies, updateTimeUI, updateBodyStats } from './ui.js';

function gameLoop() {
    if (state.isRealTime && !state.isPlaying) {
        state.customDate = new Date();
    }
    
    updateMap();
    updateTimeUI();
    updateBodyStats();
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Swiss Ephemeris WASM module
    await initAstro();

    initMap();
    renderTabs();
    renderSidebar();
    renderBodies();

    // When marker dragging updates preview time, refresh UI without forcing full game loop.
    window.addEventListener('preview-changed', () => {
        updateTimeUI();
        updateBodyStats();
    });
    
    // Interval for regular 1-second ticks in real-time mode
    setInterval(() => {
        if (state.isRealTime) {
            gameLoop();
        }
    }, 1000);
    
    // Low-latency high-frequency interval for smooth playback multiplier logic
    setInterval(() => {
        if (!state.isRealTime && state.isPlaying) {
            // Advancing the clock heavily requires fractional incrementing per ms interval
            // Adding Speed amount of seconds / 10 since this triggers 10 times a second
            state.customDate = new Date(state.customDate.getTime() + (state.speed * 100));
            gameLoop();
        }
    }, 100);
    
    // Boot up
    gameLoop();
});
