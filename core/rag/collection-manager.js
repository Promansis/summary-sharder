/**
 * Collection Manager - collection naming conventions and lifecycle.
 * Manages collection IDs and cleanup when chats are deleted.
 */

import { eventSource, event_types } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { purgeCollection } from './vector-client.js';
import { ragLog } from '../logger.js';
import {
    hasAnyBinding,
    resolveCollectionIds,
    resolveWriteTargetId,
} from './collection-bindings.js';

const SHARD_PREFIX = 'ss_shards_';
const STANDARD_PREFIX = 'ss_standard_';

function normalizeChatId(chatId) {
    const raw = String(chatId || '').trim();
    if (!raw) return '';
    return raw.replace(/\.jsonl$/i, '').replace(/\.json$/i, '').trim();
}

function toSafeCollectionKey(chatId) {
    const raw = normalizeChatId(chatId);

    let hash = 2166136261;
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

function getCurrentChatId() {
    return SillyTavern.getContext()?.chatId ?? null;
}

function getCurrentCharacterAvatar() {
    const ctx = SillyTavern.getContext();
    const idx = ctx?.characterId;
    if (idx === undefined || idx === null) return null;
    return ctx?.characters?.[idx]?.avatar ?? null;
}

export function getCollectionAlias(chatId) {
    const id = normalizeChatId(chatId || getCurrentChatId());
    if (!id) return null;
    const aliases = extension_settings?.summary_sharder?.collectionAliases;
    const alias = aliases && typeof aliases === 'object' ? aliases[id] : null;
    return alias ? String(alias) : null;
}

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

export function getShardCollectionId(chatId) {
    const id = chatId || getCurrentChatId();
    if (!id) {
        throw new Error('No chat ID available for shard collection');
    }
    return `${SHARD_PREFIX}${toSafeCollectionKey(id)}`;
}

export function getStandardCollectionId(chatId) {
    const id = chatId || getCurrentChatId();
    if (!id) {
        throw new Error('No chat ID available for standard collection');
    }
    return `${STANDARD_PREFIX}${toSafeCollectionKey(id)}`;
}

export function getCollectionIdOverride(chatId) {
    const id = normalizeChatId(chatId || getCurrentChatId());
    if (!id) return null;
    const overrides = extension_settings?.summary_sharder?.collectionIdOverrides;
    const override = overrides && typeof overrides === 'object' ? overrides[id] : null;
    return override ? String(override) : null;
}

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

export function getWriteTargetCollectionId(chatId, settings) {
    const resolvedChatId = normalizeChatId(chatId || getCurrentChatId());
    const isSharder = settings?.sharderMode === true;

    let ownId = '';
    try {
        if (resolvedChatId) {
            ownId = isSharder
                ? getShardCollectionId(resolvedChatId)
                : getStandardCollectionId(resolvedChatId);
        }
    } catch {
        // no active chat
    }

    const avatar = getCurrentCharacterAvatar();
    const writeTarget = resolveWriteTargetId(resolvedChatId, avatar, settings, ownId);
    if (writeTarget && writeTarget !== ownId) return writeTarget;

    const override = settings?.collectionIdOverrides?.[resolvedChatId];
    if (override) return String(override);

    const alias = settings?.collectionAliases?.[resolvedChatId];
    const targetChatId = normalizeChatId(alias ? String(alias) : resolvedChatId);

    return isSharder
        ? getShardCollectionId(targetChatId)
        : getStandardCollectionId(targetChatId);
}

export function getActiveCollectionId(chatId, settings) {
    return getWriteTargetCollectionId(chatId, settings);
}

// Backward-compatible alias during transition.
export function getPrimaryCollectionId(chatId, settings) {
    return getWriteTargetCollectionId(chatId, settings);
}

export function getActiveCollectionIds(chatId, settings) {
    const resolvedChatId = normalizeChatId(chatId || getCurrentChatId());
    const isSharder = settings?.sharderMode === true;

    let ownId = '';
    try {
        if (resolvedChatId) {
            ownId = isSharder
                ? getShardCollectionId(resolvedChatId)
                : getStandardCollectionId(resolvedChatId);
        }
    } catch {
        // no active chat
    }

    const avatar = getCurrentCharacterAvatar();
    if (hasAnyBinding(resolvedChatId, avatar, settings)) {
        return resolveCollectionIds(resolvedChatId, avatar, settings, ownId);
    }

    return ownId ? [ownId] : [];
}

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
