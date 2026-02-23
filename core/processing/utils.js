/**
 * Utility functions for Summary Sharder
 */

/**
 * Parse range string into array of range objects
 * @param {string} rangeString - Input like "1-3, 4-7, 10-16" or "5-10"
 * @param {number} maxIndex - Maximum valid index for range validation
 * @returns {Array<{start: number, end: number}>} Array of parsed ranges
 * @throws {Error} If validation fails with descriptive message
 */
export function parseRanges(rangeString, maxIndex) {
    if (!rangeString || typeof rangeString !== 'string') {
        throw new Error('Please enter a valid range');
    }

    const trimmed = rangeString.trim();
    if (!trimmed) {
        throw new Error('Please enter a valid range');
    }

    // Split by comma and process each segment
    const segments = trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);

    if (segments.length === 0) {
        throw new Error('Please enter a valid range');
    }

    const ranges = [];

    for (const segment of segments) {
        // Check if segment contains exactly one hyphen (not at start/end)
        const hyphenCount = (segment.match(/-/g) || []).length;

        if (hyphenCount === 0) {
            throw new Error(`Invalid format: '${segment}' - use hyphen (e.g., '1-5')`);
        }

        if (hyphenCount > 1) {
            throw new Error(`Invalid format: '${segment}' - too many hyphens`);
        }

        // Split by hyphen
        const parts = segment.split('-').map(p => p.trim());

        if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
            throw new Error(`Invalid format: '${segment}' - use format 'X-Y'`);
        }

        // Parse as integers
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);

        // Validate parsed values
        if (isNaN(start) || isNaN(end)) {
            throw new Error(`Invalid range: '${segment}' - values must be numbers`);
        }

        if (start < 0 || end < 0) {
            throw new Error(`Invalid range: '${segment}' - values must be non-negative`);
        }

        if (start > end) {
            throw new Error(`Invalid range: '${segment}' - start must be ≤ end`);
        }

        if (end > maxIndex) {
            throw new Error(`Range '${segment}' exceeds max index ${maxIndex}`);
        }

        ranges.push({ start, end });
    }

    return ranges;
}

/**
 * Merge overlapping or adjacent ranges into consolidated ranges
 * @param {Array<{start: number, end: number, hidden?: boolean, ignoreCollapse?: boolean, ignoreNames?: string}>} ranges - Array of ranges to merge
 * @returns {Array<{start: number, end: number, hidden: boolean, ignoreCollapse: boolean, ignoreNames: string}>} Merged ranges
 */
export function mergeOverlappingRanges(ranges) {
    if (!ranges || ranges.length <= 1) {
        return ranges || [];
    }

    // Sort by start index
    const sorted = [...ranges].sort((a, b) => a.start - b.start);

    // Deep copy the first range to avoid modifying originals
    const merged = [{
        start: sorted[0].start,
        end: sorted[0].end,
        hidden: sorted[0].hidden || false,
        ignoreCollapse: sorted[0].ignoreCollapse || false,
        ignoreNames: sorted[0].ignoreNames || ''
    }];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];

        // Check if overlapping or adjacent (current.start <= last.end + 1)
        if (current.start <= last.end + 1) {
            // Merge: extend the end to the maximum
            last.end = Math.max(last.end, current.end);
            // Keep hidden if either was hidden
            last.hidden = last.hidden || (current.hidden || false);
            // Keep ignoreCollapse if either had it
            last.ignoreCollapse = last.ignoreCollapse || (current.ignoreCollapse || false);
            // Merge ignoreNames (deduplicated)
            const existingNames = (last.ignoreNames || '').split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
            const newNames = (current.ignoreNames || '').split(',').map(n => n.trim().toLowerCase()).filter(Boolean);
            const allNames = [...new Set([...existingNames, ...newNames])];
            last.ignoreNames = allNames.join(', ');
        } else {
            // No overlap - add as new range
            merged.push({
                start: current.start,
                end: current.end,
                hidden: current.hidden || false,
                ignoreCollapse: current.ignoreCollapse || false,
                ignoreNames: current.ignoreNames || ''
            });
        }
    }

    return merged;
}

/**
 * Capture insertion point UIDs before processing begins
 * Uses send_date as a de-facto UID to track where summaries should be inserted
 * @param {Array<{start: number, end: number}>} ranges - Array of ranges to process
 * @param {Array} chat - The chat array from SillyTavern context
 * @returns {Array<{start: number, end: number, insertAfterUID: string|null}>} Ranges with insertion UIDs
 */
export function captureRangeInsertionPoints(ranges, chat) {
    return ranges.map(range => ({
        ...range,
        insertAfterUID: chat[range.end]?.send_date || null
    }));
}

/**
 * Find current index of a message by its send_date
 * @param {Array} chat - The chat array from SillyTavern context
 * @param {string} sendDate - The send_date to search for
 * @returns {number} The current index of the message, or -1 if not found
 */
export function findIndexByUID(chat, sendDate) {
    if (!sendDate) return -1;
    return chat.findIndex(msg => msg.send_date === sendDate);
}

/**
 * Adjust ranges when a message is inserted at a specific index.
 * All ranges with indices >= insertion point are shifted by +1.
 * @param {Array<{start: number, end: number, hidden?: boolean, ignoreCollapse?: boolean, ignoreNames?: string}>} ranges - Array of ranges
 * @param {number} insertionIndex - The index where a message was inserted
 * @returns {Array} Adjusted ranges with shifted indices
 */
export function adjustRangesForInsertion(ranges, insertionIndex) {
    if (!ranges || ranges.length === 0) {
        return [];
    }

    return ranges.map(range => {
        const newRange = { ...range };

        // If the range starts at or after the insertion, shift start
        if (range.start >= insertionIndex) {
            newRange.start = range.start + 1;
        }

        // If the range ends at or after the insertion, shift end
        if (range.end >= insertionIndex) {
            newRange.end = range.end + 1;
        }

        return newRange;
    });
}

/**
 * Split ranges to exclude a specific index.
 * Used to ensure an injected message is not hidden by any range.
 * @param {Array<{start: number, end: number, hidden?: boolean, ignoreCollapse?: boolean, ignoreNames?: string}>} ranges - Array of ranges
 * @param {number} index - The index to exclude from all ranges
 * @returns {Array} Modified ranges with the index excluded
 */
export function splitRangeAtIndex(ranges, index) {
    if (!ranges || ranges.length === 0) {
        return [];
    }

    const result = [];

    for (const range of ranges) {
        if (index < range.start || index > range.end) {
            // Index outside this range - keep as-is
            result.push({ ...range });
        } else if (index === range.start && index === range.end) {
            // Single-message range exactly at index - remove entirely
            continue;
        } else if (index === range.start) {
            // Index at start - shift range start forward
            result.push({ ...range, start: index + 1 });
        } else if (index === range.end) {
            // Index at end - shrink range end backward
            result.push({ ...range, end: index - 1 });
        } else {
            // Index in middle - split into two ranges
            result.push({ ...range, end: index - 1 });
            result.push({ ...range, start: index + 1 });
        }
    }

    // Filter out invalid ranges (where start > end after adjustment)
    return result.filter(r => r.start <= r.end);
}
