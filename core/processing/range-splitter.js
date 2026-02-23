/**
 * Range splitting helpers for batch sharder mode.
 */

function estimateMessageTokens(message) {
    const text = String(message?.mes || message?.message || '').trim();
    if (!text) return 0;
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.round(words * 1.3);
}

/**
 * Split a range into chunks by message count with optional token budget.
 * Token budget never truncates mid-message; chunk ends at last message that fits.
 * @param {Array} messages - Chat messages array
 * @param {number} start - Start index (inclusive)
 * @param {number} end - End index (inclusive)
 * @param {number} chunkSize - Max messages per chunk
 * @param {number} [tokenBudget=0] - Max estimated tokens per chunk (0 = no limit)
 * @returns {Array<{start: number, end: number}>}
 */
export function splitRange(messages, start, end, chunkSize, tokenBudget = 0) {
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('No messages available');
    }

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
        throw new Error('Start and end must be integers');
    }

    if (start < 0 || end < 0) {
        throw new Error('Start and end must be non-negative');
    }

    if (start > end) {
        throw new Error('Start index must be less than or equal to end index');
    }

    if (end >= messages.length) {
        throw new Error(`End index cannot exceed ${messages.length - 1}`);
    }

    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
        throw new Error('Chunk size must be a positive integer');
    }

    if (!Number.isFinite(tokenBudget) || tokenBudget < 0) {
        throw new Error('Token budget must be 0 or a positive number');
    }

    const ranges = [];
    let cursor = start;

    while (cursor <= end) {
        const maxChunkEnd = Math.min(cursor + chunkSize - 1, end);

        if (!tokenBudget || tokenBudget <= 0) {
            ranges.push({ start: cursor, end: maxChunkEnd });
            cursor = maxChunkEnd + 1;
            continue;
        }

        let tokenTotal = 0;
        let chunkEnd = cursor;

        for (let i = cursor; i <= maxChunkEnd; i++) {
            const messageTokens = estimateMessageTokens(messages[i]);

            // Always include at least one message per chunk.
            if (i === cursor) {
                tokenTotal += messageTokens;
                chunkEnd = i;
                continue;
            }

            if (tokenTotal + messageTokens > tokenBudget) {
                break;
            }

            tokenTotal += messageTokens;
            chunkEnd = i;
        }

        ranges.push({ start: cursor, end: chunkEnd });
        cursor = chunkEnd + 1;
    }

    return ranges;
}

