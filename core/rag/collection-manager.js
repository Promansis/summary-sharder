/**
 * Collection Manager - Collection naming conventions and lifecycle
 * Manages collection IDs and cleanup when chats are deleted.
 */

import { eventSource, event_types } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { purgeCollection } from './vector-client.js';

const LOG_PREFIX = '[SummarySharder:RAG]';
const SHARD_PREFIX = 'ss_shards_';
const STANDARD_PREFIX = 'ss_standard_';

/**
 * Produce backend-safe collection key from a chat ID.
 * Qdrant path-based APIs can break on reserved URL characters like '#',
 * so we sanitize aggressively and append a stable hash to avoid collisions.
 * @param {string} chatId
 * @returns {string}
 */
function toSafeCollectionKey(chatId) {
    const raw = String(chatId || '').trim();

    let hash = 2166136261; // FNV-1a 32-bit offset basis
    for (let i = 0; i < raw.length; i++) {
        hash ^= raw.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const hashHex = (hash >>> 0).toString(16).padStart(8, '0');

    const ascii = raw.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
    const cleaned = ascii
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);

    const stem = cleaned || 'chat';
    return `${stem}_${hashHex}`;
}

/**
 * Get the current chat ID from SillyTavern context
 * @returns {string|null}
 */
function getCurrentChatId() {
    return SillyTavern.getContext()?.chatId ?? null;
}

/**
 * Get the collection ID for Memory Shards
 * @param {string} [chatId] - Chat ID (defaults to current chat)
 * @returns {string} Collection ID in format 'ss_shards_{chatId}'
 */
export function getShardCollectionId(chatId) {
    const id = chatId || getCurrentChatId();
    if (!id) {
        throw new Error(`${LOG_PREFIX} No chat ID available for shard collection`);
    }
    return `${SHARD_PREFIX}${toSafeCollectionKey(id)}`;
}

/**
 * Get the collection ID for Standard Mode summaries
 * @param {string} [chatId] - Chat ID (defaults to current chat)
 * @returns {string} Collection ID in format 'ss_standard_{chatId}'
 */
export function getStandardCollectionId(chatId) {
    const id = chatId || getCurrentChatId();
    if (!id) {
        throw new Error(`${LOG_PREFIX} No chat ID available for standard collection`);
    }
    return `${STANDARD_PREFIX}${toSafeCollectionKey(id)}`;
}

/**
 * Get the active collection ID based on the current mode.
 * Uses shard collection in sharder mode, standard collection otherwise.
 * @param {string|null} [chatId] - Chat ID (defaults to current chat)
 * @param {Object} [settings] - Extension settings
 * @returns {string}
 */
export function getActiveCollectionId(chatId, settings) {
    return (settings?.sharderMode === true)
        ? getShardCollectionId(chatId)
        : getStandardCollectionId(chatId);
}

/**
 * Purge shard collection for a given chat
 * @param {string} chatId - Chat ID to purge collections for
 * @param {Object} ragSettings - The settings.rag object
 */
export async function purgeAllCollections(chatId, ragSettings) {
    if (!chatId || !ragSettings?.enabled) return;

    try {
        const safeKey = toSafeCollectionKey(chatId);
        const shardId = `${SHARD_PREFIX}${safeKey}`;

        console.log(`${LOG_PREFIX} Purging shard collection for chat ${chatId}`);

        await purgeCollection(shardId, ragSettings);

        console.log(`${LOG_PREFIX} Shard collection purged for chat ${chatId}`);
    } catch (error) {
        console.warn(`${LOG_PREFIX} Error purging collections for chat ${chatId}:`, error.message);
    }
}

/**
 * Initialize collection lifecycle management
 * Registers event handlers for automatic cleanup when chats are deleted.
 */
export function initCollectionLifecycle() {
    eventSource.on(event_types.CHAT_DELETED, async (chatId) => {
        const ss = extension_settings.summary_sharder;
        const ragSettings = ss?.rag;
        const ragStdSettings = ss?.ragStandard;

        if (ragSettings?.enabled) {
            console.log(`${LOG_PREFIX} Chat deleted: ${chatId}, cleaning up shard vector collection`);
            await purgeAllCollections(chatId, ragSettings);
        }

        if (ragStdSettings?.enabled) {
            try {
                const safeKey = toSafeCollectionKey(chatId);
                const standardId = `${STANDARD_PREFIX}${safeKey}`;
                console.log(`${LOG_PREFIX} Purging standard collection for chat ${chatId}`);
                await purgeCollection(standardId, ragStdSettings);
            } catch (error) {
                console.warn(`${LOG_PREFIX} Error purging standard collection for chat ${chatId}:`, error.message);
            }
        }
    });

    console.log(`${LOG_PREFIX} Collection lifecycle initialized`);
}
