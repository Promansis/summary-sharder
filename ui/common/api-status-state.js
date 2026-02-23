/**
 * API Status Display State
 * Extracted to break circular dependency between ui-manager.js and api-config-modal.js
 */

import { getFeatureApiDisplayString } from '../../core/api/feature-api-config.js';
import { isSharderMode } from './active-mode-state.js';

/**
 * Update API status displays for each feature
 * Shows which API each feature is currently configured to use
 */
export function updateApiStatusDisplays(settings) {
    // Update Summary API display (always visible)
    const summaryDisplay = document.getElementById('ss-summary-api-display');
    if (summaryDisplay) {
        summaryDisplay.textContent = getFeatureApiDisplayString(settings, 'summary');
    }

    const sharderMode = isSharderMode(settings);
    // Update Sharder API display
    const singlePassStatus = document.getElementById('ss-single-pass-api-status');
    const singlePassDisplay = document.getElementById('ss-single-pass-api-display');
    if (singlePassStatus && singlePassDisplay) {
        singlePassStatus.classList.toggle('ss-hidden', !sharderMode);
        singlePassDisplay.textContent = getFeatureApiDisplayString(settings, 'sharder');
    }

    // Update Events API display (visible if advancedUserControl enabled)
    const eventsStatus = document.getElementById('ss-events-api-status');
    const eventsDisplay = document.getElementById('ss-events-api-display');
    if (eventsStatus && eventsDisplay) {
        eventsStatus.classList.toggle('ss-hidden', !settings.advancedUserControl);
        eventsDisplay.textContent = getFeatureApiDisplayString(settings, 'events');
    }
}
