/**
 * Chat State Tracking for Summary Sharder
 * Tracks message state to detect which message index was deleted
 */

// Cache of message identifiers (send_dates) for each index
let cachedMessageIds = [];

/**
 * Cache the current chat state for deletion detection
 * Call this after chat changes and after message events
 */
export function cacheCurrentChatState() {
    const context = SillyTavern.getContext();
    if (!context?.chat) {
        cachedMessageIds = [];
        return;
    }

    cachedMessageIds = context.chat.map(msg => msg.send_date || null);
}

/**
 * Find the index of the deleted message by comparing current chat to cached state
 * @param {Array} currentChat - The current chat array after deletion
 * @returns {number} - The index that was deleted, or -1 if cannot determine
 */
export function findDeletedIndex(currentChat) {
    if (!currentChat || cachedMessageIds.length === 0) {
        return -1;
    }

    // If lengths match, no deletion occurred
    if (currentChat.length >= cachedMessageIds.length) {
        return -1;
    }

    // Find the first mismatch - that's where the deletion happened
    for (let i = 0; i < currentChat.length; i++) {
        const cached = cachedMessageIds[i];
        const current = currentChat[i]?.send_date;

        if (cached !== current) {
            // Found the deletion point
            return i;
        }
    }

    // If no mismatch found in remaining messages, deletion was at the end
    return cachedMessageIds.length - 1;
}

/**
 * Get the cached chat length
 * @returns {number} - The length of the cached chat
 */
export function getCachedLength() {
    return cachedMessageIds.length;
}

/**
 * Clear the cached state
 */
export function clearCachedState() {
    cachedMessageIds = [];
}

/**
 * Get all messages from current chat
 * @returns {Array} Chat messages array, or empty array if unavailable
 */
export function getAllMessages() {
    const context = SillyTavern.getContext();
    if (context && Array.isArray(context.chat)) {
        return context.chat;
    }
    return [];
}
