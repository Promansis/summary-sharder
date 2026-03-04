/**
 * Collection Manager - Collection naming conventions and lifecycle
 * Manages collection IDs and cleanup when chats are deleted.
 */

import { eventSource, event_types } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { purgeCollection } from './vector-client.js';
import { ragLog } from '../logger.js';

const SHARD_PREFIX = 'ss_shards_';
const STANDARD_PREFIX = 'ss_standard_';

/**
 * Normalize chat IDs to avoid extension-based collection splits.
 * @param {string} chatId
 * @returns {string}
 */
function normalizeChatId(chatId) {
    const raw = String(chatId || '').trim();
    if (!raw) return '';
    return raw.replace(/\.jsonl$/i, '').replace(/\.json$/i, '').trim();
}

/**
 * Produce backend-safe collection key from a chat ID.
 * Qdrant path-based APIs can break on reserved URL characters like '#',
 * so we sanitize aggressively and append a stable hash to avoid collisions.
 * @param {string} chatId
 * @returns {string}
 */
function toSafeCollectionKey(chatId) {
    const raw = normalizeChatId(chatId);

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
 * Get the alias source chat ID for a chat (if any).
 * @param {string} [chatId] - Chat ID (defaults to current chat)
 * @returns {string|null}
 */
export function getCollectionAlias(chatId) {
    const id = normalizeChatId(chatId || getCurrentChatId());
    if (!id) return null;
    const aliases = extension_settings?.summary_sharder?.collectionAliases;
    const alias = aliases && typeof aliases === 'object' ? aliases[id] : null;
    return alias ? String(alias) : null;
}

/**
 * Set or clear an alias for a chat's collection.
 * @param {string} [chatId] - Chat ID (defaults to current chat)
 * @param {string|null} sourceChatId - Source chat ID to alias to, or null to clear
 */
export function setCollectionAlias(chatId, sourceChatId) {
    const id = normalizeChatId(chatId || getCurrentChatId());
    if (!id) return;

    const ss = extension_settings.summary_sharder;
    if (!ss.collectionAliases || typeof ss.collectionAliases !== 'object') {
        ss.collectionAliases = {};
    }

    if (!sourceChatId) {
        delete ss.collectionAliases[id];
        return;
    }

    ss.collectionAliases[id] = normalizeChatId(sourceChatId);
}

/**
 * Get the collection ID for Memory Shards
 * @param {string} [chatId] - Chat ID (defaults to current chat)
 * @returns {string} Collection ID in format 'ss_shards_{chatId}'
 */
export function getShardCollectionId(chatId) {
    const id = chatId || getCurrentChatId();
    if (!id) {
        throw new Error('No chat ID available for shard collection');
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
        throw new Error('No chat ID available for standard collection');
    }
    return `${STANDARD_PREFIX}${toSafeCollectionKey(id)}`;
}

/**
 * Get the direct collection ID override for a chat (if any).
 * @param {string} [chatId] - Chat ID (defaults to current chat)
 * @returns {string|null}
 */
export function getCollectionIdOverride(chatId) {
    const id = normalizeChatId(chatId || getCurrentChatId());
    if (!id) return null;
    const overrides = extension_settings?.summary_sharder?.collectionIdOverrides;
    const override = overrides && typeof overrides === 'object' ? overrides[id] : null;
    return override ? String(override) : null;
}

/**
 * Set or clear a direct collection ID override for a chat.
 * @param {string} [chatId] - Chat ID (defaults to current chat)
 * @param {string|null} collectionId - Collection ID to bind, or null to clear
 */
export function setCollectionIdOverride(chatId, collectionId) {
    const id = normalizeChatId(chatId || getCurrentChatId());
    if (!id) return;

    const ss = extension_settings.summary_sharder;
    if (!ss.collectionIdOverrides || typeof ss.collectionIdOverrides !== 'object') {
        ss.collectionIdOverrides = {};
    }

    if (!collectionId) {
        delete ss.collectionIdOverrides[id];
        return;
    }

    ss.collectionIdOverrides[id] = String(collectionId);
}

/**
 * Get the active collection ID based on the current mode.
 * Uses shard collection in sharder mode, standard collection otherwise.
 * A direct collectionIdOverride takes precedence over chat-level aliases.
 * @param {string|null} [chatId] - Chat ID (defaults to current chat)
 * @param {Object} [settings] - Extension settings
 * @returns {string}
 */
export function getActiveCollectionId(chatId, settings) {
    const resolvedChatId = normalizeChatId(chatId || getCurrentChatId());

    const override = settings?.collectionIdOverrides?.[resolvedChatId];
    if (override) return String(override);

    const alias = settings?.collectionAliases?.[resolvedChatId];
    const targetChatId = normalizeChatId(alias ? String(alias) : resolvedChatId);

    return (settings?.sharderMode === true)
        ? getShardCollectionId(targetChatId)
        : getStandardCollectionId(targetChatId);
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

        await purgeCollection(shardId, ragSettings);

        ragLog.log(`Shard collection purged for chat ${chatId}`);
    } catch (error) {
        ragLog.warn(`Error purging collections for chat ${chatId}:`, error.message);
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
            await purgeAllCollections(chatId, ragSettings);
        }

        if (ragStdSettings?.enabled) {
            try {
                const safeKey = toSafeCollectionKey(chatId);
                const standardId = `${STANDARD_PREFIX}${safeKey}`;
                await purgeCollection(standardId, ragStdSettings);
                ragLog.log(`Standard collection purged for chat ${chatId}`);
            } catch (error) {
                ragLog.warn(`Error purging standard collection for chat ${chatId}:`, error.message);
            }
        }
    });

    ragLog.log('Collection lifecycle initialized');
}
