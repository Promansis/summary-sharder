/**
 * Abort Controller Manager for Summary Sharder
 * Manages abort signals for all summarization operations
 */

import { eventSource, event_types } from '../../../../../../script.js';

let currentAbortController = null;
let isSummarizationRunning = false;

/**
 * Create a new AbortController for a summarization operation
 * Aborts any existing operation first
 * @returns {AbortController} The new controller
 */
export function createAbortController() {
    // Abort any existing controller first
    if (currentAbortController) {
        currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    isSummarizationRunning = true;
    return currentAbortController;
}

/**
 * Get the current abort signal
 * @returns {AbortSignal|null} The current signal or null if none
 */
export function getAbortSignal() {
    return currentAbortController?.signal || null;
}

/**
 * Abort the current summarization operation
 * Also emits GENERATION_STOPPED for SillyTavern API calls
 */
export function abortCurrentOperation() {
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
    }
    isSummarizationRunning = false;

    // Emit SillyTavern's stop event for generateRaw calls
    eventSource.emit(event_types.GENERATION_STOPPED);
}

/**
 * Clear the abort controller (called after operation completes)
 */
export function clearAbortController() {
    currentAbortController = null;
    isSummarizationRunning = false;
}

/**
 * Check if summarization is currently running
 * @returns {boolean}
 */
export function isRunning() {
    return isSummarizationRunning;
}

/**
 * Set the running state
 * @param {boolean} running
 */
export function setRunning(running) {
    isSummarizationRunning = running;
}
