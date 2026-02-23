/**
 * Range Manager for Summary Sharder
 * Handles range validation against current chat state
 */

import { getChatRanges, saveChatRanges } from '../settings.js';

/**
 * Validate all ranges against current chat length
 * Removes invalid ranges and clamps out-of-bounds ranges
 * @returns {boolean} - Whether any ranges were modified
 */
export function validateAllRanges() {
    const ranges = getChatRanges();
    const context = SillyTavern.getContext();
    const chatLength = context?.chat?.length || 0;

    // If chat is empty, clear all ranges
    if (chatLength === 0) {
        if (ranges.length > 0) {
            saveChatRanges([]);
            return true;
        }
        return false;
    }

    let modified = false;
    const validRanges = [];

    for (const range of ranges) {
        let { start, end, hidden, ignoreCollapse, ignoreNames } = range;

        // Skip invalid ranges
        if (start < 0 || end < start) {
            modified = true;
            continue;
        }

        // Skip ranges that start beyond chat length
        if (start >= chatLength) {
            modified = true;
            continue;
        }

        // Clamp end to chat length
        if (end >= chatLength) {
            end = chatLength - 1;
            modified = true;
        }

        validRanges.push({ start, end, hidden, ignoreCollapse, ignoreNames });
    }

    if (modified) {
        saveChatRanges(validRanges);
    }

    return modified;
}
