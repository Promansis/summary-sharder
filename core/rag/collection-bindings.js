/**
 * Collection Bindings — Multi-collection assignment system for RAG
 *
 * Two scope levels:
 *   - character bindings: apply to every chat with that character
 *   - chat bindings: override character-level for one specific chat
 *
 * Resolution order (highest → lowest priority):
 *   1. Chat-level binding  (+own collection if includeOwn is true, default true)
 *   2. Character-level binding  (+own collection always appended)
 *   3. Fallback: own auto-generated collection only
 *
 * "primaryCollection" is where new vectorizations are written.
 * All collections in the resolved list are queried at retrieval time.
 */

import { extension_settings } from '../../../../../extensions.js';
import { ragLog } from '../logger.js';

/**
 * @typedef {Object} CharacterBinding
 * @property {string[]} collections - Extra collection IDs to query alongside own
 * @property {string} primaryCollection - Collection ID where new vectors are written
 */

/**
 * @typedef {Object} ChatBinding
 * @property {string[]} collections - Collection IDs to query
 * @property {string} primaryCollection - Collection ID where new vectors are written
 * @property {boolean} includeOwn - Whether to also query the chat's auto-generated collection
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * @param {string|null|undefined} id
 * @returns {string}
 */
function normalize(id) {
    return String(id || '').trim().replace(/\.jsonl$/i, '').replace(/\.json$/i, '').trim();
}

/**
 * Ensure the collectionBindings sub-tree exists on settings and return it.
 * Mutates `settings` in place so callers can write immediately.
 * @param {Object} [settings]
 * @returns {{characters: Object, chats: Object}|null}
 */
function ensureBindingsRoot(settings) {
    const ss = settings || extension_settings?.summary_sharder;
    if (!ss || typeof ss !== 'object') return null;

    if (!ss.collectionBindings || typeof ss.collectionBindings !== 'object') {
        ss.collectionBindings = { characters: {}, chats: {} };
    }
    if (!ss.collectionBindings.characters || typeof ss.collectionBindings.characters !== 'object') {
        ss.collectionBindings.characters = {};
    }
    if (!ss.collectionBindings.chats || typeof ss.collectionBindings.chats !== 'object') {
        ss.collectionBindings.chats = {};
    }

    return ss.collectionBindings;
}

/**
 * Read-only: returns the bindings root if it exists, without creating it.
 * @param {Object} [settings]
 * @returns {{characters: Object, chats: Object}|null}
 */
function getBindingsRoot(settings) {
    const ss = settings || extension_settings?.summary_sharder;
    const root = ss?.collectionBindings;
    if (!root || typeof root !== 'object') return null;
    return root;
}

// ---------------------------------------------------------------------------
// Character-level bindings
// ---------------------------------------------------------------------------

/**
 * Get character-level collection binding.
 * @param {string} avatar - Character avatar filename (e.g. "Alice.png")
 * @param {Object} [settings]
 * @returns {CharacterBinding|null}
 */
export function getCharacterBinding(avatar, settings) {
    const key = String(avatar || '').trim();
    if (!key) return null;

    const root = getBindingsRoot(settings);
    if (!root) return null;

    const raw = root.characters?.[key];
    if (!raw || !Array.isArray(raw.collections) || raw.collections.length === 0) return null;

    return {
        collections: raw.collections.map(String).filter(Boolean),
        primaryCollection: String(raw.primaryCollection || ''),
    };
}

/**
 * Set or clear a character-level collection binding.
 * @param {string} avatar - Character avatar filename
 * @param {CharacterBinding|null} binding - New binding, or null to remove
 * @param {Object} [settings]
 */
export function setCharacterBinding(avatar, binding, settings) {
    const key = String(avatar || '').trim();
    if (!key) return;

    const root = ensureBindingsRoot(settings);
    if (!root) return;

    if (!binding) {
        delete root.characters[key];
        return;
    }

    root.characters[key] = {
        collections: (Array.isArray(binding.collections) ? binding.collections : []).map(String).filter(Boolean),
        primaryCollection: String(binding.primaryCollection || ''),
    };
}

// ---------------------------------------------------------------------------
// Chat-level bindings
// ---------------------------------------------------------------------------

/**
 * Get chat-level collection binding.
 * @param {string} chatId
 * @param {Object} [settings]
 * @returns {ChatBinding|null}
 */
export function getChatBinding(chatId, settings) {
    const key = normalize(chatId);
    if (!key) return null;

    const root = getBindingsRoot(settings);
    if (!root) return null;

    const raw = root.chats?.[key];
    if (!raw || !Array.isArray(raw.collections) || raw.collections.length === 0) return null;

    return {
        collections: raw.collections.map(String).filter(Boolean),
        primaryCollection: String(raw.primaryCollection || ''),
        includeOwn: raw.includeOwn !== false,
    };
}

/**
 * Set or clear a chat-level collection binding.
 * @param {string} chatId
 * @param {ChatBinding|null} binding - New binding, or null to remove
 * @param {Object} [settings]
 */
export function setChatBinding(chatId, binding, settings) {
    const key = normalize(chatId);
    if (!key) return;

    const root = ensureBindingsRoot(settings);
    if (!root) return;

    if (!binding) {
        delete root.chats[key];
        return;
    }

    root.chats[key] = {
        collections: (Array.isArray(binding.collections) ? binding.collections : []).map(String).filter(Boolean),
        primaryCollection: String(binding.primaryCollection || ''),
        includeOwn: binding.includeOwn !== false,
    };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Returns true if any explicit binding exists for this chat or character.
 * @param {string} chatId
 * @param {string} characterAvatar
 * @param {Object} [settings]
 * @returns {boolean}
 */
export function hasAnyBinding(chatId, characterAvatar, settings) {
    const root = getBindingsRoot(settings);
    if (!root) return false;

    const chatKey = normalize(chatId);
    if (chatKey && root.chats?.[chatKey] && Array.isArray(root.chats[chatKey].collections) && root.chats[chatKey].collections.length > 0) {
        return true;
    }

    const charKey = String(characterAvatar || '').trim();
    if (charKey && root.characters?.[charKey] && Array.isArray(root.characters[charKey].collections) && root.characters[charKey].collections.length > 0) {
        return true;
    }

    return false;
}

/**
 * Resolve all collection IDs to query for a chat.
 * Returns an ordered, deduplicated array.
 *
 * @param {string} chatId
 * @param {string} characterAvatar
 * @param {Object} [settings]
 * @param {string} ownCollectionId - The chat's auto-generated collection ID
 * @returns {string[]}
 */
export function resolveCollectionIds(chatId, characterAvatar, settings, ownCollectionId) {
    const own = String(ownCollectionId || '').trim();
    const chatKey = normalize(chatId);
    const charKey = String(characterAvatar || '').trim();
    const root = getBindingsRoot(settings);

    // Chat-level binding wins
    if (chatKey && root?.chats?.[chatKey]) {
        const raw = root.chats[chatKey];
        if (Array.isArray(raw.collections) && raw.collections.length > 0) {
            const ids = raw.collections.map(String).filter(Boolean);
            if (own && raw.includeOwn !== false) ids.push(own);
            return [...new Set(ids)];
        }
    }

    // Character-level binding
    if (charKey && root?.characters?.[charKey]) {
        const raw = root.characters[charKey];
        if (Array.isArray(raw.collections) && raw.collections.length > 0) {
            const ids = raw.collections.map(String).filter(Boolean);
            if (own) ids.push(own);
            return [...new Set(ids)];
        }
    }

    // Fallback: own collection only
    return own ? [own] : [];
}

/**
 * Resolve the primary collection ID (where new vectorizations go).
 * Returns `ownCollectionId` when no binding overrides the primary.
 *
 * @param {string} chatId
 * @param {string} characterAvatar
 * @param {Object} [settings]
 * @param {string} ownCollectionId
 * @returns {string}
 */
export function resolvePrimaryCollectionId(chatId, characterAvatar, settings, ownCollectionId) {
    const own = String(ownCollectionId || '').trim();
    const chatKey = normalize(chatId);
    const charKey = String(characterAvatar || '').trim();
    const root = getBindingsRoot(settings);

    if (chatKey && root?.chats?.[chatKey]) {
        const primary = String(root.chats[chatKey]?.primaryCollection || '').trim();
        if (primary) return primary;
    }

    if (charKey && root?.characters?.[charKey]) {
        const primary = String(root.characters[charKey]?.primaryCollection || '').trim();
        if (primary) return primary;
    }

    return own;
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Migrate legacy `collectionIdOverrides` and `collectionAliases` entries into
 * the new `collectionBindings` structure. Idempotent — skips entries that
 * already have a chat-level binding.
 *
 * @param {Object} settings
 * @param {function(string): string} getShardIdFn
 * @param {function(string): string} getStandardIdFn
 * @returns {boolean} Whether any migrations were performed
 */
export function migrateToCollectionBindings(settings, getShardIdFn, getStandardIdFn) {
    let migrated = false;
    const root = ensureBindingsRoot(settings);
    if (!root) return false;

    const isSharder = settings.sharderMode === true;

    // --- Migrate collectionIdOverrides ---
    const overrides = settings.collectionIdOverrides;
    if (overrides && typeof overrides === 'object') {
        for (const [chatId, collectionId] of Object.entries(overrides)) {
            const key = normalize(chatId);
            if (!key || !collectionId) continue;
            if (root.chats[key]) continue; // already has a binding

            root.chats[key] = {
                collections: [String(collectionId)],
                primaryCollection: String(collectionId),
                includeOwn: false,
            };
            migrated = true;
            ragLog.log(`Migrated collectionIdOverrides[${key}] → collectionBindings.chats`);
        }
    }

    // --- Migrate collectionAliases ---
    const aliases = settings.collectionAliases;
    if (aliases && typeof aliases === 'object') {
        for (const [chatId, sourceChatId] of Object.entries(aliases)) {
            const key = normalize(chatId);
            const sourceKey = normalize(sourceChatId);
            if (!key || !sourceKey) continue;
            if (root.chats[key]) continue; // already migrated

            let collectionId = '';
            try {
                collectionId = isSharder
                    ? getShardIdFn(sourceKey)
                    : getStandardIdFn(sourceKey);
            } catch {
                continue;
            }

            if (collectionId) {
                root.chats[key] = {
                    collections: [collectionId],
                    primaryCollection: collectionId,
                    includeOwn: false,
                };
                migrated = true;
                ragLog.log(`Migrated collectionAliases[${key}] → collectionBindings.chats`);
            }
        }
    }

    return migrated;
}
