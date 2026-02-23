/**
 * Consolidated Range Operations for Summary Sharder
 * All core range manipulation functions in one place.
 *
 * Design principles:
 * - All functions read via getChatRanges(), save via saveChatRanges()
 * - All functions call recomputeVisibility() as final step (unless skipVisibilityUpdate flag)
 * - Reuses mergeOverlappingRanges from processing/utils.js
 */

import { getChatRanges, saveChatRanges, getSettings } from '../settings.js';
import { mergeOverlappingRanges } from '../processing/utils.js';
import { applyVisibilitySettings } from './visibility-manager.js';

/**
 * Normalize hidden ranges: sort, merge overlapping/adjacent, remove invalid
 * @param {Array<{start: number, end: number, hidden?: boolean, ignoreCollapse?: boolean, ignoreNames?: string}>} ranges - Ranges to normalize
 * @returns {Array} Normalized ranges
 */
export function normalizeHiddenRanges(ranges) {
    if (!ranges || ranges.length === 0) {
        return [];
    }

    const context = SillyTavern.getContext();
    const chatLength = context?.chat?.length || 0;

    // Filter out invalid ranges (negative, out of bounds, start > end)
    const validRanges = ranges.filter(range => {
        if (range.start < 0 || range.end < 0) return false;
        if (range.start > range.end) return false;
        if (range.start >= chatLength) return false;
        return true;
    }).map(range => ({
        start: range.start,
        end: Math.min(range.end, chatLength - 1), // Clamp end to chat bounds
        hidden: range.hidden !== undefined ? range.hidden : false,
        ignoreCollapse: range.ignoreCollapse || false,
        ignoreNames: range.ignoreNames || ''
    }));

    // Merge overlapping/adjacent ranges
    return mergeOverlappingRanges(validRanges);
}

/**
 * Add a hidden range and normalize
 * @param {number} start - Start index (inclusive)
 * @param {number} end - End index (inclusive)
 * @param {Object} opts - Options
 * @param {boolean} [opts.hidden=true] - Whether the range should be hidden
 * @param {boolean} [opts.ignoreCollapse=false] - Whether to ignore collapse for this range
 * @param {string} [opts.ignoreNames=''] - Names to ignore in this range
 * @param {boolean} [opts.skipVisibilityUpdate=false] - Skip calling recomputeVisibility
 * @returns {Promise<Array>} Updated ranges
 */
export async function addHiddenRange(start, end, opts = {}) {
    const {
        hidden = true,
        ignoreCollapse = false,
        ignoreNames = '',
        skipVisibilityUpdate = false
    } = opts;

    const ranges = getChatRanges();

    // Add the new range
    ranges.push({
        start,
        end,
        hidden,
        ignoreCollapse,
        ignoreNames
    });

    // Normalize (sort, merge, validate)
    const normalized = normalizeHiddenRanges(ranges);
    saveChatRanges(normalized);

    if (!skipVisibilityUpdate) {
        await recomputeVisibility();
    }

    return normalized;
}

/**
 * Subtract/remove a range from existing hidden ranges (for unhide support)
 * Splits ranges that overlap with the subtracted range
 * @param {number} start - Start index to unhide (inclusive)
 * @param {number} end - End index to unhide (inclusive)
 * @param {Object} opts - Options
 * @param {boolean} [opts.skipVisibilityUpdate=false] - Skip calling recomputeVisibility
 * @returns {Promise<Array>} Updated ranges
 */
export async function subtractHiddenRange(start, end, opts = {}) {
    const { skipVisibilityUpdate = false } = opts;

    const ranges = getChatRanges();
    const result = [];

    for (const range of ranges) {
        // Case 1: No overlap - subtracted range is completely outside this range
        if (end < range.start || start > range.end) {
            result.push({ ...range });
            continue;
        }

        // Case 2: Complete overlap - subtracted range covers entire range
        if (start <= range.start && end >= range.end) {
            // Don't add this range (it's completely removed)
            continue;
        }

        // Case 3: Partial overlap at start - subtracted range overlaps beginning
        if (start <= range.start && end < range.end) {
            result.push({ ...range, start: end + 1 });
            continue;
        }

        // Case 4: Partial overlap at end - subtracted range overlaps ending
        if (start > range.start && end >= range.end) {
            result.push({ ...range, end: start - 1 });
            continue;
        }

        // Case 5: Subtracted range is in the middle - split into two ranges
        if (start > range.start && end < range.end) {
            result.push({ ...range, end: start - 1 }); // Left part
            result.push({ ...range, start: end + 1 }); // Right part
            continue;
        }
    }

    // Filter out any invalid ranges that might result
    const validResult = result.filter(r => r.start <= r.end && r.start >= 0);
    saveChatRanges(validResult);

    if (!skipVisibilityUpdate) {
        await recomputeVisibility();
    }

    return validResult;
}

/**
 * Shift ranges when messages are inserted
 * @param {number} insertionIndex - Index where message(s) were inserted
 * @param {number} count - Number of messages inserted (default 1)
 * @param {Object} opts - Options
 * @param {boolean} [opts.skipVisibilityUpdate=false] - Skip calling recomputeVisibility
 * @returns {Promise<boolean>} Whether any ranges were modified
 */
export async function shiftRangesOnInsert(insertionIndex, count = 1, opts = {}) {
    const { skipVisibilityUpdate = false } = opts;

    if (insertionIndex < 0 || count <= 0) {
        return false;
    }

    const ranges = getChatRanges();
    if (ranges.length === 0) {
        return false;
    }

    let modified = false;
    const updatedRanges = ranges.map(range => {
        const newRange = { ...range };

        // If range starts at or after insertion, shift start
        if (range.start >= insertionIndex) {
            newRange.start = range.start + count;
            modified = true;
        }

        // If range ends at or after insertion, shift end
        if (range.end >= insertionIndex) {
            newRange.end = range.end + count;
            modified = true;
        }

        return newRange;
    });

    if (modified) {
        saveChatRanges(updatedRanges);
        if (!skipVisibilityUpdate) {
            await recomputeVisibility();
        }
    }

    return modified;
}

/**
 * Shift ranges when messages are deleted
 * Supports single or multi-message deletion
 * @param {number} startIndex - Start index of deleted range (inclusive)
 * @param {number} endIndex - End index of deleted range (inclusive, defaults to startIndex for single delete)
 * @param {Object} opts - Options
 * @param {boolean} [opts.skipVisibilityUpdate=false] - Skip calling recomputeVisibility
 * @returns {Promise<boolean>} Whether any ranges were modified
 */
export async function shiftRangesOnDelete(startIndex, endIndex = startIndex, opts = {}) {
    const { skipVisibilityUpdate = false } = opts;

    if (startIndex < 0) {
        return false;
    }

    // Ensure endIndex >= startIndex
    if (endIndex < startIndex) {
        endIndex = startIndex;
    }

    const deletedCount = endIndex - startIndex + 1;

    const ranges = getChatRanges();
    if (ranges.length === 0) {
        return false;
    }

    const context = SillyTavern.getContext();
    const chatLength = context?.chat?.length || 0;

    let modified = false;
    const updatedRanges = [];

    for (const range of ranges) {
        let { start, end, hidden, ignoreCollapse, ignoreNames } = range;

        // Case 1: Deletion entirely before range - shift both down
        if (endIndex < start) {
            start -= deletedCount;
            end -= deletedCount;
            modified = true;
        }
        // Case 2: Deletion entirely after range - no change
        else if (startIndex > end) {
            // Keep range as-is
        }
        // Case 3: Deletion covers entire range - remove range
        else if (startIndex <= start && endIndex >= end) {
            modified = true;
            continue; // Don't add to updatedRanges
        }
        // Case 4: Deletion overlaps start of range
        else if (startIndex <= start && endIndex < end) {
            // How much of range is deleted
            const overlapEnd = Math.min(endIndex, end);
            const deletedFromRange = overlapEnd - start + 1;
            // New start becomes old start shifted to where deletion ended
            start = startIndex;
            end = end - deletedCount;
            modified = true;
        }
        // Case 5: Deletion overlaps end of range
        else if (startIndex > start && endIndex >= end) {
            // Shrink end to just before deletion
            end = startIndex - 1;
            modified = true;
        }
        // Case 6: Deletion is entirely within range
        else if (startIndex > start && endIndex < end) {
            // Shrink range by the number of deleted messages
            end = end - deletedCount;
            modified = true;
        }

        // Validate range is still valid
        if (start >= 0 && end >= start && start < chatLength) {
            // Clamp end to chat length if needed
            if (end >= chatLength) {
                end = chatLength - 1;
            }
            updatedRanges.push({ start, end, hidden, ignoreCollapse, ignoreNames });
        }
        // else: range is completely invalid, don't include it
    }

    if (modified) {
        // Merge any ranges that now overlap after adjustment
        const mergedRanges = mergeOverlappingRanges(updatedRanges);
        saveChatRanges(mergedRanges);

        if (!skipVisibilityUpdate) {
            await recomputeVisibility();
        }
    }

    return modified;
}

/**
 * Recompute visibility by calling applyVisibilitySettings
 * Wrapper for convenience
 * @returns {Promise<void>}
 */
export async function recomputeVisibility() {
    const settings = getSettings();
    await applyVisibilitySettings(settings);
}

/**
 * Convert a set of indices to consolidated ranges
 * @param {Set<number>} indices - Set of hidden message indices
 * @returns {Array} Array of range objects
 */
export function buildRangesFromIndices(indices) {
    if (indices.size === 0) return [];

    const sorted = Array.from(indices).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === end + 1) {
            // Consecutive - extend range
            end = sorted[i];
        } else {
            // Gap - save current range, start new one
            ranges.push({
                start,
                end,
                hidden: true,
                ignoreCollapse: false,
                ignoreNames: '',
            });
            start = sorted[i];
            end = sorted[i];
        }
    }

    // Don't forget the last range
    ranges.push({
        start,
        end,
        hidden: true,
        ignoreCollapse: false,
        ignoreNames: '',
    });

    return ranges;
}

/**
 * Check if two range arrays represent the same hidden messages
 * @param {Array} ranges1 - First range array
 * @param {Array} ranges2 - Second range array
 * @returns {boolean} True if they cover the same indices
 */
export function rangesMatch(ranges1, ranges2) {
    const set1 = new Set();
    const set2 = new Set();

    for (const r of ranges1) {
        if (r.hidden !== false) {  // Include if hidden or undefined
            for (let i = r.start; i <= r.end; i++) set1.add(i);
        }
    }

    for (const r of ranges2) {
        if (r.hidden !== false) {
            for (let i = r.start; i <= r.end; i++) set2.add(i);
        }
    }

    if (set1.size !== set2.size) return false;
    for (const i of set1) {
        if (!set2.has(i)) return false;
    }
    return true;
}
