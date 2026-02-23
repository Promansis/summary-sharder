/**
 * Shared visibility state for Summary Sharder
 * Separate module to avoid circular imports between index.js and visibility-manager.js
 */

// Guard flag to prevent MutationObserver from triggering during our own visibility updates
// This prevents the cascade: applyVisibilitySettings -> observer -> onExternalVisibilityChange -> range overwrite
let isApplyingVisibility = false;

// Reference to the visibility change timer (set by index.js)
let visibilityChangeTimerRef = { timer: null };

/**
 * Set the timer reference so we can clear it from visibility-manager.js
 * @param {Object} ref - Object with timer property
 */
export function setVisibilityTimerRef(ref) {
    visibilityChangeTimerRef = ref;
}

/**
 * Clear any pending visibility change timers
 * Called before applying visibility to prevent stale callbacks from running
 */
export function clearPendingVisibilityTimers() {
    if (visibilityChangeTimerRef.timer) {
        clearTimeout(visibilityChangeTimerRef.timer);
        visibilityChangeTimerRef.timer = null;
    }
}

/**
 * Check if visibility is currently being applied
 * @returns {boolean}
 */
export function getApplyingVisibility() {
    return isApplyingVisibility;
}

/**
 * Set the visibility application guard flag
 * @param {boolean} value - Whether visibility is currently being applied
 */
export function setApplyingVisibility(value) {
    isApplyingVisibility = value;
}
