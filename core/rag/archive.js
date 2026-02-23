/**
 * Archive helpers for Summary Sharder RAG.
 * Warm archive inserts vector chunks into shard collection with archive metadata.
 * Cold archive stores entries in per-chat metadata for persistent audit/history.
 */

import { chat_metadata, saveChatConditional } from '../../../../../../script.js';
import { buildChunkHash } from './chunking.js';
import { getShardCollectionId } from './collection-manager.js';
import { extractKeywordsTfIdf } from './vectorize.js';
import { insertChunks, listChunks } from './vector-client.js';

const LOG_PREFIX = '[SummarySharder:RAG:Archive]';
const DEFAULT_COLD_ARCHIVE_LIMIT = 100;

/**
 * @returns {number|null}
 */
function toFiniteNumberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * @param {any} value
 * @returns {string[]}
 */
function normalizeSceneCodes(value) {
    if (!Array.isArray(value)) return [];

    const seen = new Set();
    const out = [];

    for (const item of value) {
        const code = typeof item === 'string'
            ? item.trim()
            : String(item?.code || '').trim();
        if (!code || seen.has(code)) continue;
        seen.add(code);
        out.push(code);
    }

    return out;
}

/**
 * @param {any} item
 * @returns {{text: string, sectionKey: string|null, itemId: string|null, sceneCodes: string[], source: string|null, metadata: Object}}
 */
function normalizeArchiveItem(item) {
    if (typeof item === 'string') {
        return {
            text: item.trim(),
            sectionKey: null,
            itemId: null,
            sceneCodes: [],
            source: null,
            metadata: {},
        };
    }

    const text = String(item?.content ?? item?.text ?? '').trim();
    return {
        text,
        sectionKey: item?.sectionKey ? String(item.sectionKey) : null,
        itemId: item?.itemId ? String(item.itemId) : null,
        sceneCodes: normalizeSceneCodes(item?.sceneCodes),
        source: item?.source ? String(item.source) : null,
        metadata: (item?.metadata && typeof item.metadata === 'object') ? item.metadata : {},
    };
}

/**
 * @param {Array<any>|any} items
 * @returns {Array<{text: string, sectionKey: string|null, itemId: string|null, sceneCodes: string[], source: string|null, metadata: Object}>}
 */
function normalizeArchiveItems(items) {
    const list = Array.isArray(items) ? items : [items];
    return list
        .map(normalizeArchiveItem)
        .filter(item => !!item.text);
}

/**
 * @param {string} text
 * @returns {{start: number|null, end: number|null}}
 */
function extractRangeFromSceneCodes(text) {
    const regex = /[\[(]S(\d+):(\d+)[\])]/g;
    const starts = [];
    let match;

    while ((match = regex.exec(String(text || ''))) !== null) {
        starts.push(parseInt(match[1], 10));
    }

    if (starts.length === 0) return { start: null, end: null };
    const sorted = starts.filter(Number.isFinite).sort((a, b) => a - b);
    return { start: sorted[0], end: sorted[sorted.length - 1] };
}

/**
 * @param {number|null} startIndex
 * @param {number|null} endIndex
 * @param {{text:string}} item
 * @returns {{startIndex: number, endIndex: number}}
 */
function resolveItemRange(startIndex, endIndex, item) {
    const explicitStart = toFiniteNumberOrNull(startIndex);
    const explicitEnd = toFiniteNumberOrNull(endIndex);
    if (explicitStart !== null && explicitEnd !== null) {
        return { startIndex: explicitStart, endIndex: explicitEnd };
    }

    const fromText = extractRangeFromSceneCodes(item?.text || '');
    const derivedStart = fromText.start ?? explicitStart ?? 0;
    const derivedEnd = fromText.end ?? explicitEnd ?? derivedStart;
    return { startIndex: derivedStart, endIndex: derivedEnd };
}

/**
 * @param {string} collectionId
 * @param {Object} ragSettings
 * @returns {Promise<Set<string>>}
 */
async function listExistingHashes(collectionId, ragSettings) {
    const seen = new Set();
    let offset = 0;
    const limit = 200;

    while (true) {
        const { items, hasMore } = await listChunks(collectionId, ragSettings, { offset, limit });
        if (!Array.isArray(items) || items.length === 0) break;

        items.forEach((item) => {
            if (item?.hash !== undefined && item?.hash !== null) {
                seen.add(String(item.hash));
            }
        });

        if (!hasMore) break;
        offset += items.length;
    }

    return seen;
}

/**
 * Insert archive items into shard collection with archive metadata tags.
 * @param {Array<any>|any} items
 * @param {number} startIndex
 * @param {number} endIndex
 * @param {Object} settings
 * @param {Object} metadata
 * @returns {Promise<{success:boolean, total:number, inserted:number, skipped:number, collectionId?:string, reason?:string, error?:string}>}
 */
export async function archiveToWarm(items, startIndex, endIndex, settings, metadata = {}) {
    const ragSettings = settings?.rag;
    if (!ragSettings?.enabled) {
        return { success: false, total: 0, inserted: 0, skipped: 0, reason: 'rag-disabled' };
    }

    const normalized = normalizeArchiveItems(items);
    if (normalized.length === 0) {
        return { success: true, total: 0, inserted: 0, skipped: 0 };
    }

    const timestamp = Date.now();
    let collectionId;
    try {
        collectionId = getShardCollectionId(metadata?.chatId);
    } catch (error) {
        return {
            success: false,
            total: normalized.length,
            inserted: 0,
            skipped: 0,
            reason: 'no-chat-id',
            error: String(error?.message || error),
        };
    }

    const chunks = normalized.map((item, idx) => {
        const range = resolveItemRange(startIndex, endIndex, item);
        const keywords = extractKeywordsTfIdf(item.text);
        const sectionKey = item.sectionKey || (metadata?.sectionKey ? String(metadata.sectionKey) : null);
        const itemId = item.itemId || (metadata?.itemId ? String(metadata.itemId) : null);
        const source = item.source || (metadata?.source ? String(metadata.source) : 'archive');
        const sceneCodes = normalizeSceneCodes(item.sceneCodes);

        const hashIdentity = [
            'archive-warm',
            range.startIndex,
            range.endIndex,
            sectionKey || '',
            itemId || '',
            sceneCodes.join('|'),
            item.text,
        ].join('|');

        return {
            text: item.text,
            hash: buildChunkHash(hashIdentity),
            index: range.startIndex,
            metadata: {
                isSummaryChunk: true,
                startIndex: range.startIndex,
                endIndex: range.endIndex,
                messageIndex: range.startIndex,
                speaker: 'SummarySharder',
                characterName: null,
                keywords,
                importance: 45,
                sceneCode: sceneCodes[0] || null,
                timestamp,
                archived: true,
                archiveTier: 'warm',
                archiveSource: source,
                archiveSectionKey: sectionKey,
                archiveItemId: itemId,
                archiveSceneCodes: sceneCodes,
                archiveTimestamp: timestamp,
                archiveBatchIndex: idx,
                archiveMetadata: {
                    ...item.metadata,
                    ...(metadata?.extra && typeof metadata.extra === 'object' ? metadata.extra : {}),
                },
            },
        };
    });

    try {
        const existingHashes = await listExistingHashes(collectionId, ragSettings);
        const toInsert = chunks.filter(chunk => !existingHashes.has(String(chunk.hash)));

        if (toInsert.length === 0) {
            return {
                success: true,
                total: chunks.length,
                inserted: 0,
                skipped: chunks.length,
                collectionId,
            };
        }

        const insertResult = await insertChunks(collectionId, toInsert, ragSettings);
        const inserted = Number(insertResult?.inserted ?? toInsert.length);
        const skipped = chunks.length - toInsert.length;

        return {
            success: true,
            total: chunks.length,
            inserted,
            skipped,
            collectionId,
        };
    } catch (error) {
        console.warn(`${LOG_PREFIX} Warm archive failed:`, error?.message || error);
        return {
            success: false,
            total: chunks.length,
            inserted: 0,
            skipped: 0,
            collectionId,
            error: String(error?.message || error),
        };
    }
}

/**
 * Store archive items in per-chat metadata (cold archive).
 * @param {Array<any>|any} items
 * @param {number} startIndex
 * @param {number} endIndex
 * @param {string|null} chatId
 * @param {Object} metadata
 * @returns {Promise<{success:boolean, appended:number, trimmed:number, total:number, reason?:string, error?:string}>}
 */
export async function archiveToCold(items, startIndex, endIndex, chatId = null, metadata = {}) {
    const normalized = normalizeArchiveItems(items);
    if (normalized.length === 0) {
        return { success: true, appended: 0, trimmed: 0, total: 0 };
    }

    if (!chat_metadata) {
        return { success: false, appended: 0, trimmed: 0, total: 0, reason: 'no-chat-metadata' };
    }

    try {
        if (!chat_metadata.summary_sharder) {
            chat_metadata.summary_sharder = {};
        }
        if (!Array.isArray(chat_metadata.summary_sharder.coldArchive)) {
            chat_metadata.summary_sharder.coldArchive = [];
        }

        const now = Date.now();
        const resolvedChatId = chatId || SillyTavern.getContext()?.chatId || null;
        const entries = normalized.map((item, idx) => {
            const range = resolveItemRange(startIndex, endIndex, item);
            return {
                id: `cold_${now}_${idx}_${Math.random().toString(36).slice(2, 8)}`,
                chatId: resolvedChatId,
                timestamp: now,
                startIndex: range.startIndex,
                endIndex: range.endIndex,
                text: item.text,
                source: item.source || (metadata?.source ? String(metadata.source) : 'archive'),
                sectionKey: item.sectionKey || (metadata?.sectionKey ? String(metadata.sectionKey) : null),
                itemId: item.itemId || (metadata?.itemId ? String(metadata.itemId) : null),
                sceneCodes: item.sceneCodes,
                metadata: {
                    ...item.metadata,
                    ...(metadata?.extra && typeof metadata.extra === 'object' ? metadata.extra : {}),
                },
            };
        });

        chat_metadata.summary_sharder.coldArchive.push(...entries);

        const limit = Math.max(1, Number(metadata?.limit || DEFAULT_COLD_ARCHIVE_LIMIT));
        let trimmed = 0;
        while (chat_metadata.summary_sharder.coldArchive.length > limit) {
            chat_metadata.summary_sharder.coldArchive.shift();
            trimmed += 1;
        }

        await saveChatConditional();

        return {
            success: true,
            appended: entries.length,
            trimmed,
            total: chat_metadata.summary_sharder.coldArchive.length,
        };
    } catch (error) {
        console.warn(`${LOG_PREFIX} Cold archive failed:`, error?.message || error);
        return {
            success: false,
            appended: 0,
            trimmed: 0,
            total: chat_metadata?.summary_sharder?.coldArchive?.length || 0,
            error: String(error?.message || error),
        };
    }
}
