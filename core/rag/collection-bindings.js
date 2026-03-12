/**
 * Collection Bindings - additive multi-collection assignment system for RAG.
 *
 * Scope model:
 *   - character bindings: default shared collections for every chat with that character
 *   - chat bindings: extra collections and/or a write-target override for one chat
 *
 * Effective read model:
 *   character collections + chat collections + own auto-generated collection
 *
 * Effective write model:
 *   chat writeTarget -> character writeTarget -> own auto-generated collection
 */

import { extension_settings } from '../../../../../extensions.js';
import { ragLog } from '../logger.js';

/**
 * @typedef {Object} CharacterBinding
 * @property {string[]} collections - Shared collections read by all chats with this character
 * @property {string} writeTarget - Default destination for new vector writes
 */

/**
 * @typedef {Object} ChatBinding
 * @property {string[]} collections - Extra collections read only by this chat
 * @property {string} writeTarget - Optional chat-specific destination for new vector writes
 */

function normalize(id) {
    return String(id || '').trim().replace(/\.jsonl$/i, '').replace(/\.json$/i, '').trim();
}

function normalizeCollectionList(values) {
    const seen = new Set();
    const out = [];

    for (const value of (Array.isArray(values) ? values : [])) {
        const id = String(value || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }

    return out;
}

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

function getBindingsRoot(settings) {
    const ss = settings || extension_settings?.summary_sharder;
    const root = ss?.collectionBindings;
    if (!root || typeof root !== 'object') return null;
    return root;
}

function normalizeStoredBinding(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const collections = normalizeCollectionList(raw.collections);
    const writeTarget = String(raw.writeTarget || raw.primaryCollection || '').trim();
    if (collections.length === 0 && !writeTarget) return null;

    return { collections, writeTarget };
}

function createSourceMapEntries(ids = [], source = '') {
    const out = {};
    for (const id of ids) {
        if (!id) continue;
        if (!out[id]) out[id] = [];
        if (!out[id].includes(source)) out[id].push(source);
    }
    return out;
}

function mergeSourceMaps(...maps) {
    const out = {};
    for (const map of maps) {
        for (const [id, sources] of Object.entries(map || {})) {
            if (!out[id]) out[id] = [];
            for (const source of (Array.isArray(sources) ? sources : [])) {
                if (!out[id].includes(source)) out[id].push(source);
            }
        }
    }
    return out;
}

export function getCharacterBinding(avatar, settings) {
    const key = String(avatar || '').trim();
    if (!key) return null;

    const root = getBindingsRoot(settings);
    if (!root) return null;

    return normalizeStoredBinding(root.characters?.[key]);
}

export function setCharacterBinding(avatar, binding, settings) {
    const key = String(avatar || '').trim();
    if (!key) return;

    const root = ensureBindingsRoot(settings);
    if (!root) return;

    const normalized = normalizeStoredBinding(binding);
    if (!normalized) {
        delete root.characters[key];
        return;
    }

    root.characters[key] = {
        collections: normalized.collections,
        writeTarget: normalized.writeTarget,
    };
}

export function getChatBinding(chatId, settings) {
    const key = normalize(chatId);
    if (!key) return null;

    const root = getBindingsRoot(settings);
    if (!root) return null;

    return normalizeStoredBinding(root.chats?.[key]);
}

export function setChatBinding(chatId, binding, settings) {
    const key = normalize(chatId);
    if (!key) return;

    const root = ensureBindingsRoot(settings);
    if (!root) return;

    const normalized = normalizeStoredBinding(binding);
    if (!normalized) {
        delete root.chats[key];
        return;
    }

    root.chats[key] = {
        collections: normalized.collections,
        writeTarget: normalized.writeTarget,
    };
}

export function hasAnyBinding(chatId, characterAvatar, settings) {
    return !!resolveEffectiveBindingState(chatId, characterAvatar, settings, '').hasAnyBinding;
}

export function resolveEffectiveBindingState(chatId, characterAvatar, settings, ownCollectionId) {
    const own = String(ownCollectionId || '').trim();
    const chatKey = normalize(chatId);
    const charKey = String(characterAvatar || '').trim();
    const root = getBindingsRoot(settings);

    const characterBinding = charKey ? normalizeStoredBinding(root?.characters?.[charKey]) : null;
    const chatBinding = chatKey ? normalizeStoredBinding(root?.chats?.[chatKey]) : null;

    const characterCollections = characterBinding?.collections || [];
    const chatCollections = chatBinding?.collections || [];
    const ownCollections = own ? [own] : [];

    const sourceMap = mergeSourceMaps(
        createSourceMapEntries(characterCollections, 'character'),
        createSourceMapEntries(chatCollections, 'chat'),
        createSourceMapEntries(ownCollections, 'own'),
    );

    const effectiveReadIds = normalizeCollectionList([
        ...characterCollections,
        ...chatCollections,
        ...ownCollections,
    ]);

    const duplicateIds = Object.entries(sourceMap)
        .filter(([, sources]) => Array.isArray(sources) && sources.length > 1)
        .map(([id]) => id);

    const characterWriteTarget = String(characterBinding?.writeTarget || '').trim();
    const chatWriteTarget = String(chatBinding?.writeTarget || '').trim();

    const validTargets = new Set(effectiveReadIds);
    if (own) validTargets.add(own);

    let effectiveWriteTarget = own;
    let effectiveWriteSource = own ? 'own' : '';
    let invalidWriteTarget = '';
    let invalidWriteSource = '';

    if (chatWriteTarget) {
        if (validTargets.has(chatWriteTarget)) {
            effectiveWriteTarget = chatWriteTarget;
            effectiveWriteSource = 'chat';
        } else {
            invalidWriteTarget = chatWriteTarget;
            invalidWriteSource = 'chat';
        }
    }

    if (effectiveWriteSource !== 'chat' && characterWriteTarget) {
        if (validTargets.has(characterWriteTarget)) {
            effectiveWriteTarget = characterWriteTarget;
            effectiveWriteSource = 'character';
        } else if (!invalidWriteTarget) {
            invalidWriteTarget = characterWriteTarget;
            invalidWriteSource = 'character';
        }
    }

    if (!effectiveWriteTarget && effectiveReadIds.length > 0) {
        effectiveWriteTarget = effectiveReadIds[0];
        effectiveWriteSource = sourceMap[effectiveWriteTarget]?.[0] || '';
    }

    return {
        chatId: chatKey,
        characterAvatar: charKey,
        ownCollectionId: own,
        characterBinding,
        chatBinding,
        characterCollections,
        chatCollections,
        effectiveReadIds,
        duplicateIds,
        sourceMap,
        effectiveWriteTarget,
        effectiveWriteSource,
        invalidWriteTarget,
        invalidWriteSource,
        hasAnyBinding: !!(characterBinding || chatBinding),
    };
}

export function resolveCollectionIds(chatId, characterAvatar, settings, ownCollectionId) {
    return resolveEffectiveBindingState(chatId, characterAvatar, settings, ownCollectionId).effectiveReadIds;
}

export function resolveWriteTargetId(chatId, characterAvatar, settings, ownCollectionId) {
    return resolveEffectiveBindingState(chatId, characterAvatar, settings, ownCollectionId).effectiveWriteTarget;
}

// Backward-compatible alias during transition.
export function resolvePrimaryCollectionId(chatId, characterAvatar, settings, ownCollectionId) {
    return resolveWriteTargetId(chatId, characterAvatar, settings, ownCollectionId);
}

export function migrateToCollectionBindings(settings, getShardIdFn, getStandardIdFn) {
    let migrated = false;
    const root = ensureBindingsRoot(settings);
    if (!root) return false;

    const isSharder = settings.sharderMode === true;

    for (const [avatar, raw] of Object.entries(root.characters || {})) {
        const normalized = normalizeStoredBinding(raw);
        if (!normalized) {
            delete root.characters[avatar];
            migrated = true;
            continue;
        }

        if (raw.writeTarget !== normalized.writeTarget || raw.primaryCollection !== undefined || raw.includeOwn !== undefined) {
            root.characters[avatar] = {
                collections: normalized.collections,
                writeTarget: normalized.writeTarget,
            };
            migrated = true;
        }
    }

    for (const [chatId, raw] of Object.entries(root.chats || {})) {
        const normalized = normalizeStoredBinding(raw);
        if (!normalized) {
            delete root.chats[chatId];
            migrated = true;
            continue;
        }

        if (raw.writeTarget !== normalized.writeTarget || raw.primaryCollection !== undefined || raw.includeOwn !== undefined) {
            root.chats[chatId] = {
                collections: normalized.collections,
                writeTarget: normalized.writeTarget,
            };
            migrated = true;
        }
    }

    const overrides = settings.collectionIdOverrides;
    if (overrides && typeof overrides === 'object') {
        for (const [chatId, collectionId] of Object.entries(overrides)) {
            const key = normalize(chatId);
            const collection = String(collectionId || '').trim();
            if (!key || !collection || root.chats[key]) continue;

            root.chats[key] = {
                collections: [collection],
                writeTarget: collection,
            };
            migrated = true;
            ragLog.log(`Migrated collectionIdOverrides[${key}] -> collectionBindings.chats`);
        }
    }

    const aliases = settings.collectionAliases;
    if (aliases && typeof aliases === 'object') {
        for (const [chatId, sourceChatId] of Object.entries(aliases)) {
            const key = normalize(chatId);
            const sourceKey = normalize(sourceChatId);
            if (!key || !sourceKey || root.chats[key]) continue;

            let collectionId = '';
            try {
                collectionId = isSharder
                    ? getShardIdFn(sourceKey)
                    : getStandardIdFn(sourceKey);
            } catch {
                continue;
            }

            if (!collectionId) continue;
            root.chats[key] = {
                collections: [String(collectionId)],
                writeTarget: String(collectionId),
            };
            migrated = true;
            ragLog.log(`Migrated collectionAliases[${key}] -> collectionBindings.chats`);
        }
    }

    return migrated;
}
