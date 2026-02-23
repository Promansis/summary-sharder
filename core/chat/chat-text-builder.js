/**
 * Chat Text Builder
 * Unified function for building text representations of chat messages.
 * Consolidates three near-identical variants that differed only in line prefix format.
 */

/**
 * Build text representation of chat messages
 * @param {Array} messages - All chat messages
 * @param {number} startIndex - Start index
 * @param {number} endIndex - End index
 * @param {Object} [options] - Options
 * @param {Object|null} [options.cleanup] - Cleanup settings for filtering hidden messages
 * @param {'none'|'msg'|'message'} [options.indexFormat='none'] - Line prefix format:
 *   - 'none':    [Name]: text
 *   - 'msg':     [Msg N] [Name]: text
 *   - 'message': [Message N] [Name]: text
 * @returns {string} Formatted chat text
 */
export function buildChatText(messages, startIndex, endIndex, options = {}) {
    const { cleanup = null, indexFormat = 'none' } = options;
    const lines = [];

    for (let i = startIndex; i <= endIndex; i++) {
        const msg = messages[i];
        if (!msg) continue;

        // Skip hidden messages if configured. Hidden messages may be flagged
        // via `is_hidden` or promoted to `is_system` by visibility handling.
        if (cleanup?.stripHiddenMessages && (msg.is_hidden || msg.is_system)) continue;

        const name = msg.name || (msg.is_user ? 'User' : 'Character');
        const text = msg.mes || msg.message || '';

        let prefix;
        switch (indexFormat) {
            case 'msg':
                prefix = `[Msg ${i}] [${name}]`;
                break;
            case 'message':
                prefix = `[Message ${i}] [${name}]`;
                break;
            default:
                prefix = `[${name}]`;
                break;
        }

        lines.push(`${prefix}: ${text}`);
    }

    return lines.join('\n\n');
}
