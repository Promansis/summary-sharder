/**
 * Retrieval pipeline for Summary Sharder RAG.
 * Registers as generate interceptor via globalThis.summary_sharder_rearrangeChat.
 */

import { setExtensionPrompt } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { getActiveCollectionId, getShardCollectionId } from './collection-manager.js';
import { rerankDocuments } from './reranker-client.js';
import { hybridQuery, listChunks, queryChunks } from './vector-client.js';
import { keywordBoost, runClientHybridFusion, scoreAndRank } from './scoring.js';
import { getActiveRagSettings } from '../settings.js';

export const EXTENSION_PROMPT_TAG_SS = '5_summary_sharder_rag';

const LOG_PREFIX = '[SummarySharder:RAG]';

/** @type {Object|null} Last successful RAG injection snapshot. */
let lastInjectionData = null;

/**
 * Returns the most recent RAG injection data, or null if none yet.
 * @returns {Object|null}
 */
export function getLastInjectionData() {
    return lastInjectionData;
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function getFreshnessEndIndex(item) {
    const value = Number(
        item?.metadata?.freshnessEndIndex
        ?? item?.metadata?.endIndex
        ?? item?.metadata?.messageIndex
        ?? item?.index
        ?? -1,
    );
    return Number.isFinite(value) ? value : -1;
}

/**
 * @param {Object} item
 * @returns {string}
 */
function getRollingKey(item) {
    const sectionType = String(item?.metadata?.sectionType || '');
    const entityKey = String(item?.metadata?.entityKey || '');
    if (!sectionType || !entityKey) return '';
    return `${sectionType}|${entityKey}`;
}

/**
 * Keep the freshest rolling chunk for each sectionType|entityKey key.
 * @param {Array<Object>} items
 * @returns {Array<Object>}
 */
function dedupeLatestRolling(items) {
    const latestRolling = new Map();

    for (const item of (items || [])) {
        if (item?.metadata?.chunkBehavior !== 'rolling') continue;
        const rollingKey = getRollingKey(item);
        if (!rollingKey) continue;

        const existing = latestRolling.get(rollingKey);
        if (!existing || getFreshnessEndIndex(item) > getFreshnessEndIndex(existing)) {
            latestRolling.set(rollingKey, item);
        }
    }

    return [...latestRolling.values()];
}

/**
 * Merge query-derived and fallback rolling chunks, then dedupe by latest freshness.
 * Query items are traversed first so their key order is preserved for pinned output.
 * @param {Array<Object>} queryRolling
 * @param {Array<Object>} fallbackRolling
 * @returns {Array<Object>}
 */
function mergeLatestRolling(queryRolling, fallbackRolling) {
    return dedupeLatestRolling([...(queryRolling || []), ...(fallbackRolling || [])]);
}

const ROLLING_SECTION_ORDER = ['relationshipShifts', 'callbacks', 'looseThreads'];
const ROLLING_SECTION_LABELS = {
    relationshipShifts: 'RELATIONSHIPS',
    callbacks: 'CALLBACKS',
    looseThreads: 'THREADS',
};
const ANCHORS_SECTION_KEY = 'anchors';
const ANCHORS_SECTION_LABEL = 'ANCHORS';
const DEVELOPMENTS_SECTION_KEY = 'developments';
const DEVELOPMENTS_SECTION_LABEL = 'DEVELOPMENTS';

const CUMULATIVE_SECTION_ORDER = ['events', 'scenes', 'keyDialogue', 'characterStates', 'sceneBreaks', 'nsfwContent'];
const PINNED_TIER_ORDER = ['developments', 'anchors', 'relationshipShifts', 'callbacks', 'looseThreads'];

/**
 * @param {string} text
 * @returns {string}
 */
function stripLeadingSectionHeader(text) {
    const input = String(text || '').trim();
    if (!input) return '';
    const lines = input.split('\n');
    if (lines.length > 1 && /^###\s+/.test(String(lines[0] || '').trim())) {
        return lines.slice(1).join('\n').trim();
    }
    return input;
}

/**
 * Compact many per-entity rolling chunks into at most one chunk per rolling section.
 * Keeps full key coverage while avoiding repeated section headers in injection text.
 * @param {Array<Object>} rollingItems
 * @param {Object} [rag]
 * @returns {Array<Object>}
 */
function compactRollingPinnedChunks(rollingItems, rag) {
    const grouped = new Map();

    const maxItemsPerSection = Number(rag?.maxItemsPerCompactedSection) || 5;

    for (const item of (rollingItems || [])) {
        if (item?.metadata?.chunkBehavior !== 'rolling') continue;
        const rollingKey = getRollingKey(item);
        if (!rollingKey) continue;
        const sectionType = String(item?.metadata?.sectionType || '');
        if (!sectionType) continue;
        if (!grouped.has(sectionType)) {
            grouped.set(sectionType, []);
        }
        grouped.get(sectionType).push(item);
    }

    const sectionTypes = [
        ...ROLLING_SECTION_ORDER.filter(section => grouped.has(section)),
        ...[...grouped.keys()].filter(section => !ROLLING_SECTION_ORDER.includes(section)),
    ];

    const out = [];
    for (const sectionType of sectionTypes) {
        const items = grouped.get(sectionType) || [];
        if (items.length === 0) continue;

        items.sort((a, b) => getFreshnessEndIndex(b) - getFreshnessEndIndex(a));
        const seenBodies = new Set();
        const bodies = [];
        let freshest = -1;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const item of items) {
            if (bodies.length >= maxItemsPerSection) break;

            const body = stripLeadingSectionHeader(item?.text || '');
            if (!body) continue;
            const normalizedBody = normalizeText(body);
            if (!normalizedBody || seenBodies.has(normalizedBody)) continue;
            seenBodies.add(normalizedBody);
            bodies.push(body);
            freshest = Math.max(freshest, getFreshnessEndIndex(item));
            bestScore = Math.max(bestScore, Number(item?.score) || 0);
        }

        if (bodies.length === 0) continue;

        const heading = ROLLING_SECTION_LABELS[sectionType] || String(sectionType || '').toUpperCase();
        out.push({
            text: `### ${heading}\n${bodies.join('\n')}`.trim(),
            hash: `rolling-group|${sectionType}|${freshest}|${bodies.length}`,
            score: Number.isFinite(bestScore) ? bestScore : 0,
            metadata: {
                chunkBehavior: 'rolling',
                sectionType,
                sectionTypes: [sectionType],
                entityKey: '__pinned_group__',
                freshnessEndIndex: freshest,
                pinnedGroup: true,
                pinnedGroupCount: bodies.length,
            },
        });
    }

    return out;
}

/**
 * @param {string} text
 * @param {string} headingName
 * @returns {string}
 */
function extractSectionBodyByHeading(text, headingName) {
    const lines = String(text || '').split('\n');
    const target = String(headingName || '').trim().toUpperCase();
    let inTarget = false;
    const buffer = [];

    for (const rawLine of lines) {
        const line = String(rawLine || '');
        const header = line.match(/^###\s+(.+?)\s*$/);
        if (header) {
            const headerName = String(header[1] || '').trim().toUpperCase();
            if (inTarget && headerName !== target) break;
            inTarget = headerName === target;
            continue;
        }
        if (inTarget) {
            buffer.push(line);
        }
    }

    return buffer.join('\n').trim();
}

/**
 * @param {string} sectionText
 * @returns {Array<string>}
 */
function splitSectionListItems(sectionText) {
    const input = String(sectionText || '').trim();
    if (!input) return [];

    const lines = input.split('\n');
    const items = [];
    let current = '';

    const flush = () => {
        const value = String(current || '').trim();
        if (value) items.push(value);
        current = '';
    };

    for (const rawLine of lines) {
        const line = String(rawLine || '').trim();
        if (!line) continue;

        if (/^[-*•]\s+/.test(line)) {
            flush();
            current = line;
        } else if (!current) {
            current = line;
        } else {
            current += ` ${line}`;
        }
    }

    flush();
    return items;
}

/**
 * @param {string} itemText
 * @returns {string}
 */
function getAnchorKey(itemText) {
    const text = String(itemText || '')
        .replace(/^[-*•]\s+/, '')
        .trim();
    if (!text) return '';
    return String(text.split('|')[0] || '').trim().toLowerCase();
}

/**
 * Extract latest anchors by anchor key from candidate chunks.
 * @param {Array<Object>} items
 * @returns {Array<{key: string, text: string, freshness: number, score: number}>}
 */
function collectLatestAnchors(items) {
    const latest = new Map();

    for (const item of (items || [])) {
        const sectionTypes = Array.isArray(item?.metadata?.sectionTypes)
            ? item.metadata.sectionTypes
            : [];
        const likelyHasAnchors = sectionTypes.includes(ANCHORS_SECTION_KEY)
            || /(^|\n)###\s+ANCHORS\b/i.test(String(item?.text || ''));
        if (!likelyHasAnchors) continue;

        const sectionBody = extractSectionBodyByHeading(item?.text || '', ANCHORS_SECTION_LABEL);
        if (!sectionBody) continue;

        const entries = splitSectionListItems(sectionBody);
        for (const entry of entries) {
            const key = getAnchorKey(entry);
            if (!key) continue;

            const normalized = String(entry || '').trim();
            if (!normalized) continue;
            const freshness = getFreshnessEndIndex(item);
            const score = Number(item?.score) || 0;
            const value = {
                key,
                text: /^[-*•]\s+/.test(normalized) ? normalized : `- ${normalized}`,
                freshness,
                score,
            };

            const existing = latest.get(key);
            if (!existing || freshness > existing.freshness) {
                latest.set(key, value);
            }
        }
    }

    return [...latest.values()];
}

/**
 * @param {Array<{key: string, text: string, freshness: number, score: number}>} queryAnchors
 * @param {Array<{key: string, text: string, freshness: number, score: number}>} fallbackAnchors
 * @returns {Array<{key: string, text: string, freshness: number, score: number}>}
 */
function mergeLatestAnchors(queryAnchors, fallbackAnchors) {
    const latest = new Map();
    for (const entry of [...(queryAnchors || []), ...(fallbackAnchors || [])]) {
        const key = String(entry?.key || '').trim();
        if (!key) continue;
        const freshness = Number(entry?.freshness);
        const existing = latest.get(key);
        if (!existing || freshness > Number(existing?.freshness)) {
            latest.set(key, entry);
        }
    }
    return [...latest.values()];
}

/**
 * @param {Array<{key: string, text: string, freshness: number, score: number}>} anchorEntries
 * @returns {Array<Object>}
 */
/**
 * Compact multiple anchor chunks into a single block.
 * @param {Array<Object>} anchorEntries
 * @param {Object} [rag]
 * @returns {Array<Object>}
 */
function compactAnchorsPinnedChunks(anchorEntries, rag) {
    const safeEntries = Array.isArray(anchorEntries) ? anchorEntries : [];
    if (safeEntries.length === 0) return [];

    const maxAnchors = Number(rag?.maxItemsPerCompactedSection) || 5;

    safeEntries.sort((a, b) => Number(b?.freshness || -1) - Number(a?.freshness || -1));

    const lines = [];
    const seen = new Set();
    let freshest = -1;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const entry of safeEntries) {
        if (lines.length >= maxAnchors) break;

        const line = String(entry?.text || '').trim();
        if (!line) continue;
        const normalized = normalizeText(line);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        lines.push(line);
        freshest = Math.max(freshest, Number(entry?.freshness || -1));
        bestScore = Math.max(bestScore, Number(entry?.score) || 0);
    }

    if (lines.length === 0) return [];

    return [{
        text: `### ${ANCHORS_SECTION_LABEL}\n${lines.join('\n')}`.trim(),
        hash: `anchors-group|${freshest}|${lines.length}`,
        score: Number.isFinite(bestScore) ? bestScore : 0,
        metadata: {
            chunkBehavior: 'cumulative',
            sectionType: ANCHORS_SECTION_KEY,
            sectionTypes: [ANCHORS_SECTION_KEY],
            entityKey: '__pinned_group__',
            freshnessEndIndex: freshest,
            pinnedGroup: true,
            pinnedGroupCount: lines.length,
        },
    }];
}

/**
 * @param {string} text
 * @param {string} headingName
 * @returns {{text: string, removed: boolean}}
 */
function stripSectionByHeading(text, headingName) {
    const lines = String(text || '').split('\n');
    const target = String(headingName || '').trim().toUpperCase();
    const kept = [];
    let skipping = false;
    let removed = false;

    for (const rawLine of lines) {
        const line = String(rawLine || '');
        const header = line.match(/^###\s+(.+?)\s*$/);
        if (header) {
            const headerName = String(header[1] || '').trim().toUpperCase();
            skipping = headerName === target;
            if (skipping) {
                removed = true;
                continue;
            }
            kept.push(line);
            continue;
        }

        if (!skipping) {
            kept.push(line);
        }
    }

    return {
        text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        removed,
    };
}

/**
 * Remove ANCHORS section blocks from cumulative chunks so compact pinned anchors
 * can be appended once without duplicating the same section repeatedly.
 * @param {Array<Object>} results
 * @returns {Array<Object>}
 */
function stripAnchorsFromCumulativeResults(results) {
    const out = [];

    for (const item of (results || [])) {
        if (item?.metadata?.chunkBehavior !== 'cumulative') {
            out.push(item);
            continue;
        }

        const sectionTypes = Array.isArray(item?.metadata?.sectionTypes)
            ? item.metadata.sectionTypes
            : [];
        const likelyHasAnchors = sectionTypes.includes(ANCHORS_SECTION_KEY)
            || /(^|\n)###\s+ANCHORS\b/i.test(String(item?.text || ''));
        if (!likelyHasAnchors) {
            out.push(item);
            continue;
        }

        const stripped = stripSectionByHeading(item?.text || '', ANCHORS_SECTION_LABEL);
        if (!stripped.removed) {
            out.push(item);
            continue;
        }

        if (!stripped.text) continue;
        const nextSectionTypes = sectionTypes.length > 0
            ? sectionTypes.filter(section => section !== ANCHORS_SECTION_KEY)
            : sectionTypes;

        out.push({
            ...item,
            text: stripped.text,
            metadata: {
                ...(item?.metadata || {}),
                ...(sectionTypes.length > 0 ? { sectionTypes: nextSectionTypes } : {}),
            },
        });
    }

    return out;
}

/**
 * Extract latest developments items from cumulative chunks.
 * @param {Array<Object>} items
 * @returns {Array<{text: string, freshness: number, score: number}>}
 */
function collectLatestDevelopments(items) {
    const seen = new Set();
    const developments = [];

    for (const item of (items || [])) {
        const sectionTypes = Array.isArray(item?.metadata?.sectionTypes)
            ? item.metadata.sectionTypes
            : [];
        const likelyHasDevelopments = sectionTypes.includes(DEVELOPMENTS_SECTION_KEY)
            || /(^|\n)###\s+DEVELOPMENTS\b/i.test(String(item?.text || ''));
        if (!likelyHasDevelopments) continue;

        const sectionBody = extractSectionBodyByHeading(item?.text || '', DEVELOPMENTS_SECTION_LABEL);
        if (!sectionBody) continue;

        const entries = splitSectionListItems(sectionBody);
        const freshness = getFreshnessEndIndex(item);
        const score = Number(item?.score) || 0;

        for (const entry of entries) {
            const normalized = normalizeText(String(entry || '').trim());
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);

            const text = /^[-*•]\s+/.test(String(entry || '').trim())
                ? String(entry || '').trim()
                : `- ${String(entry || '').trim()}`;
            developments.push({ text, freshness, score });
        }
    }

    return developments;
}

/**
 * @param {Array<{text: string, freshness: number, score: number}>} queryDevs
 * @param {Array<{text: string, freshness: number, score: number}>} fallbackDevs
 * @returns {Array<{text: string, freshness: number, score: number}>}
 */
function mergeLatestDevelopments(queryDevs, fallbackDevs) {
    const seen = new Set();
    const latest = [];
    for (const entry of [...(queryDevs || []), ...(fallbackDevs || [])]) {
        const normalized = normalizeText(String(entry?.text || ''));
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        latest.push(entry);
    }
    return latest;
}

/**
 * @param {Array<{text: string, freshness: number, score: number}>} devEntries
 * @returns {Array<Object>}
 */
function compactDevelopmentsPinnedChunks(devEntries) {
    const safeEntries = Array.isArray(devEntries) ? devEntries : [];
    if (safeEntries.length === 0) return [];

    safeEntries.sort((a, b) => Number(b?.freshness || -1) - Number(a?.freshness || -1));

    const lines = [];
    const seen = new Set();
    let freshest = -1;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const entry of safeEntries) {
        const line = String(entry?.text || '').trim();
        if (!line) continue;
        const normalized = normalizeText(line);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        lines.push(line);
        freshest = Math.max(freshest, Number(entry?.freshness || -1));
        bestScore = Math.max(bestScore, Number(entry?.score) || 0);
    }

    if (lines.length === 0) return [];

    return [{
        text: `### ${DEVELOPMENTS_SECTION_LABEL}\n${lines.join('\n')}`.trim(),
        hash: `developments-group|${freshest}|${lines.length}`,
        score: Number.isFinite(bestScore) ? bestScore : 0,
        metadata: {
            chunkBehavior: 'cumulative',
            sectionType: DEVELOPMENTS_SECTION_KEY,
            sectionTypes: [DEVELOPMENTS_SECTION_KEY],
            entityKey: '__pinned_group__',
            freshnessEndIndex: freshest,
            pinnedGroup: true,
            pinnedGroupCount: lines.length,
        },
    }];
}

/**
 * Remove DEVELOPMENTS section blocks from cumulative chunks so compact pinned developments
 * can be appended once without duplicating the same section repeatedly.
 * @param {Array<Object>} results
 * @returns {Array<Object>}
 */
function stripDevelopmentsFromCumulativeResults(results) {
    const out = [];

    for (const item of (results || [])) {
        if (item?.metadata?.chunkBehavior !== 'cumulative') {
            out.push(item);
            continue;
        }

        const sectionTypes = Array.isArray(item?.metadata?.sectionTypes)
            ? item.metadata.sectionTypes
            : [];
        const likelyHasDevelopments = sectionTypes.includes(DEVELOPMENTS_SECTION_KEY)
            || /(^|\n)###\s+DEVELOPMENTS\b/i.test(String(item?.text || ''));
        if (!likelyHasDevelopments) {
            out.push(item);
            continue;
        }

        const stripped = stripSectionByHeading(item?.text || '', DEVELOPMENTS_SECTION_LABEL);
        if (!stripped.removed) {
            out.push(item);
            continue;
        }

        if (!stripped.text) continue;
        const nextSectionTypes = sectionTypes.length > 0
            ? sectionTypes.filter(section => section !== DEVELOPMENTS_SECTION_KEY)
            : sectionTypes;

        out.push({
            ...item,
            text: stripped.text,
            metadata: {
                ...(item?.metadata || {}),
                ...(sectionTypes.length > 0 ? { sectionTypes: nextSectionTypes } : {}),
            },
        });
    }

    return out;
}

/**
 * Parse scene code into numeric parts for sorting.
 * Supports S{shard}:{scene} format.
 * @param {string} code
 * @returns {{shard: number, scene: number}|null}
 */
function parseSceneCode(code) {
    const match = String(code || '').match(/S(\d+):(\d+)/i);
    if (!match) return null;
    return {
        shard: parseInt(match[1], 10),
        scene: parseInt(match[2], 10),
    };
}

/**
 * Compare two items chronologically.
 * Prioritizes parsed scene codes, falls back to freshness index.
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
function compareChronologically(a, b) {
    const codeA = a?.metadata?.sceneCode;
    const codeB = b?.metadata?.sceneCode;
    const pA = parseSceneCode(codeA);
    const pB = parseSceneCode(codeB);

    if (pA && pB) {
        if (pA.shard !== pB.shard) return pA.shard - pB.shard;
        return pA.scene - pB.scene;
    }

    const fA = getFreshnessEndIndex(a);
    const fB = getFreshnessEndIndex(b);
    if (fA !== fB) return fA - fB;

    // Same freshness (likely same shard), prefer the one with a scene code
    if (pA && !pB) return -1;
    if (!pA && pB) return 1;

    return 0;
}

/**
 * @param {Array<Object>} chat
 * @param {number} queryCount
 * @returns {string}
 */
function buildQueryText(chat, queryCount) {
    if (!Array.isArray(chat) || chat.length === 0) return '';

    const safeCount = Math.max(1, Number(queryCount) || 2);
    const start = Math.max(0, chat.length - safeCount);
    const lines = [];

    for (let i = start; i < chat.length; i++) {
        const msg = chat[i];
        const text = String(msg?.mes ?? msg?.text ?? '').trim();
        if (!text) continue;
        const speaker = String(msg?.name || (msg?.is_user ? 'User' : 'Assistant'));
        lines.push(`[${i}] ${speaker}: ${text}`);
    }

    return lines.join('\n');
}

/**
 * @param {Array<Object>} results
 * @returns {Array<Object>}
 */
function dedupeResults(results) {
    const exactSeen = new Set();
    const exactDeduped = [];

    for (const item of (results || [])) {
        const key = `${item?.hash || ''}|${normalizeText(item?.text || '')}`;
        if (!key || exactSeen.has(key)) continue;
        exactSeen.add(key);
        exactDeduped.push(item);
    }

    let latestSuperseding = null;
    const latestRolling = new Map();
    const passthrough = [];

    for (const item of exactDeduped) {
        const behavior = item?.metadata?.chunkBehavior || null;

        if (behavior === 'superseding') {
            if (!latestSuperseding || getFreshnessEndIndex(item) > getFreshnessEndIndex(latestSuperseding)) {
                latestSuperseding = item;
            }
            continue;
        }

        if (behavior === 'rolling') {
            const rollingKey = getRollingKey(item);
            if (!rollingKey) {
                passthrough.push(item);
                continue;
            }

            const existing = latestRolling.get(rollingKey);
            if (!existing || getFreshnessEndIndex(item) > getFreshnessEndIndex(existing)) {
                latestRolling.set(rollingKey, item);
            }
            continue;
        }

        passthrough.push(item);
    }

    const out = [];
    if (latestSuperseding) out.push(latestSuperseding);
    out.push(...passthrough);
    out.push(...latestRolling.values());
    return out;
}

/**
 * Explicitly fetch the latest superseding chunk from the collection.
 * Used as a fallback to ensure "Current State" is always present.
 * @param {string} collectionId
 * @param {Object} rag
 * @returns {Promise<Object|null>}
 */
async function fetchLatestSuperseding(collectionId, rag) {
    try {
        const { items } = await listChunks(collectionId, rag, {
            limit: 20,
            metadataFilter: { chunkBehavior: 'superseding' },
        });
        if (!Array.isArray(items) || items.length === 0) return null;

        items.sort((a, b) => getFreshnessEndIndex(b) - getFreshnessEndIndex(a));
        return items[0];
    } catch (error) {
        console.warn(`${LOG_PREFIX} Fallback superseding fetch failed:`, error?.message || error);
        return null;
    }
}

/**
 * Explicitly fetch rolling chunks and keep latest per sectionType|entityKey.
 * Used as a fallback to ensure rolling section coverage is not query-score bound.
 * @param {string} collectionId
 * @param {Object} rag
 * @param {number} [limit=50]
 * @returns {Promise<{items: Array<Object>, fetchedCount: number, hasMore: boolean}>}
 */
async function fetchLatestRolling(collectionId, rag, limit = 50) {
    try {
        const safeLimit = Math.max(1, Number(limit) || 50);
        const { items, hasMore } = await listChunks(collectionId, rag, {
            limit: safeLimit,
            metadataFilter: { chunkBehavior: 'rolling' },
        });

        const safeItems = Array.isArray(items) ? items : [];
        return {
            items: dedupeLatestRolling(safeItems),
            fetchedCount: safeItems.length,
            hasMore: !!hasMore,
        };
    } catch (error) {
        console.warn(`${LOG_PREFIX} Fallback rolling fetch failed:`, error?.message || error);
        return {
            items: [],
            fetchedCount: 0,
            hasMore: false,
        };
    }
}

/**
 * Explicitly fetch cumulative chunks and keep latest anchors by anchor key.
 * @param {string} collectionId
 * @param {Object} rag
 * @param {number} [limit=50]
 * @returns {Promise<{items: Array<{key: string, text: string, freshness: number, score: number}>, fetchedCount: number, hasMore: boolean}>}
 */
async function fetchLatestAnchors(collectionId, rag, limit = 50) {
    try {
        const safeLimit = Math.max(1, Number(limit) || 50);
        const { items, hasMore } = await listChunks(collectionId, rag, {
            limit: safeLimit,
            metadataFilter: { chunkBehavior: 'cumulative' },
        });

        const safeItems = Array.isArray(items) ? items : [];
        return {
            items: collectLatestAnchors(safeItems),
            fetchedCount: safeItems.length,
            hasMore: !!hasMore,
        };
    } catch (error) {
        console.warn(`${LOG_PREFIX} Fallback anchors fetch failed:`, error?.message || error);
        return {
            items: [],
            fetchedCount: 0,
            hasMore: false,
        };
    }
}

/**
 * Explicitly fetch developments items from cumulative chunks.
 * @param {string} collectionId
 * @param {Object} rag
 * @param {number} [limit=50]
 * @returns {Promise<{items: Array<{text: string, freshness: number, score: number}>, fetchedCount: number, hasMore: boolean}>}
 */
async function fetchLatestDevelopments(collectionId, rag, limit = 50) {
    try {
        const safeLimit = Math.max(1, Number(limit) || 50);
        const { items, hasMore } = await listChunks(collectionId, rag, {
            limit: safeLimit,
            metadataFilter: { chunkBehavior: 'cumulative' },
        });

        const safeItems = Array.isArray(items) ? items : [];
        return {
            items: collectLatestDevelopments(safeItems),
            fetchedCount: safeItems.length,
            hasMore: !!hasMore,
        };
    } catch (error) {
        console.warn(`${LOG_PREFIX} Fallback developments fetch failed:`, error?.message || error);
        return {
            items: [],
            fetchedCount: 0,
            hasMore: false,
        };
    }
}

/**
 * @param {Array<Object>} results
 * @param {Array<Object>} chat
 * @param {number} protectCount
 * @returns {Array<Object>}
 */
function dedupeAgainstRecentContext(results, chat, protectCount) {
    if (!Array.isArray(results) || results.length === 0) return [];
    if (!Array.isArray(chat) || chat.length === 0) return [...results];

    const safeProtect = Math.max(0, Number(protectCount) || 0);
    if (safeProtect <= 0) return [...results];

    const start = Math.max(0, chat.length - safeProtect);
    const inContext = new Set();
    for (let i = start; i < chat.length; i++) {
        const text = String(chat[i]?.mes ?? chat[i]?.text ?? '').trim();
        if (!text) continue;
        inContext.add(normalizeText(text));
    }

    return results.filter(item => {
        const text = normalizeText(item?.text || '');
        return text && !inContext.has(text);
    });
}

/**
 * @param {Array<Object>} results
 * @returns {Array<Object>}
 */
function orderWithSceneGrouping(results) {
    if (!Array.isArray(results) || results.length <= 1) return results || [];

    const superseding = [];
    const cumulativeByScene = new Map();
    const cumulativeNoScene = [];
    const pinned = [];
    const legacyNoScene = [];

    // --- Categorize into three tiers ---
    for (const item of results) {
        const behavior = item?.metadata?.chunkBehavior || null;
        const sectionType = item?.metadata?.sectionType || '';
        const sectionTypes = Array.isArray(item?.metadata?.sectionTypes) ? item.metadata.sectionTypes : [];

        if (behavior === 'superseding') {
            superseding.push(item);
            continue;
        }

        if (behavior === 'rolling') {
            pinned.push(item);
            continue;
        }

        // Developments and anchors pinned groups go to pinned tier
        if (item?.metadata?.pinnedGroup && (sectionType === 'developments' || sectionType === 'anchors')) {
            pinned.push(item);
            continue;
        }

        // Regular cumulative
        if (behavior === 'cumulative') {
            const sceneCode = item?.metadata?.sceneCode || null;
            if (sceneCode) {
                if (!cumulativeByScene.has(sceneCode)) {
                    cumulativeByScene.set(sceneCode, []);
                }
                cumulativeByScene.get(sceneCode).push(item);
            } else {
                cumulativeNoScene.push(item);
            }
            continue;
        }

        legacyNoScene.push(item);
    }

    // --- Sort each tier ---
    superseding.sort((a, b) => getFreshnessEndIndex(b) - getFreshnessEndIndex(a));

    // Sort cumulative scene buckets chronologically, and intra-scene items by section order
    const sortedSceneCodes = [...cumulativeByScene.keys()].sort((a, b) => {
        const pA = parseSceneCode(a);
        const pB = parseSceneCode(b);
        if (pA && pB) {
            if (pA.shard !== pB.shard) return pA.shard - pB.shard;
            return pA.scene - pB.scene;
        }
        return 0;
    });

    for (const bucket of cumulativeByScene.values()) {
        bucket.sort((a, b) => {
            const getSectionPriority = (item) => {
                const types = Array.isArray(item?.metadata?.sectionTypes) ? item.metadata.sectionTypes : [];
                let best = CUMULATIVE_SECTION_ORDER.length;
                for (const t of types) {
                    const idx = CUMULATIVE_SECTION_ORDER.indexOf(t);
                    if (idx >= 0 && idx < best) best = idx;
                }
                return best;
            };
            return getSectionPriority(a) - getSectionPriority(b);
        });
    }

    cumulativeNoScene.sort(compareChronologically);

    // Sort pinned by PINNED_TIER_ORDER
    pinned.sort((a, b) => {
        const getOrder = (item) => {
            const st = item?.metadata?.sectionType || '';
            const idx = PINNED_TIER_ORDER.indexOf(st);
            return idx >= 0 ? idx : PINNED_TIER_ORDER.length;
        };
        return getOrder(a) - getOrder(b);
    });

    legacyNoScene.sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));

    // --- Assemble three-tier output ---
    const ordered = [];

    // Tier 1: Superseding
    ordered.push(...superseding);

    // Tier 2: Cumulative (chronological by scene code)
    for (const sceneCode of sortedSceneCodes) {
        const items = cumulativeByScene.get(sceneCode) || [];
        if (items.length > 0) {
            ordered.push(...items);
        }
    }
    ordered.push(...cumulativeNoScene);

    // Tier 3: Pinned (rolling + developments + anchors)
    ordered.push(...pinned);

    // Legacy at the very end
    ordered.push(...legacyNoScene);

    return dedupeResults(ordered);
}

/**
 * @param {Object} settings
 * @param {Array<Object>} shardResults
 * @returns {Promise<Array<Object>>}
 */
async function expandByScene(settings, shardResults) {
    const rag = settings?.rag;
    if (!rag?.sceneExpansion || !Array.isArray(shardResults) || shardResults.length === 0) {
        return [];
    }

    const expandable = shardResults.filter(item => {
        const behavior = item?.metadata?.chunkBehavior || null;
        return behavior === null || behavior === 'cumulative';
    });

    const sceneCodes = [...new Set(expandable
        .map(r => r?.metadata?.sceneCode)
        .filter(Boolean))];

    if (sceneCodes.length === 0) return [];

    const collectionId = getShardCollectionId();
    const expanded = [];
    const maxSceneExpansionChunks = Math.max(0, Number(rag.maxSceneExpansionChunks) || 10);

    for (const sceneCode of sceneCodes) {
        if (expanded.length >= maxSceneExpansionChunks) break;

        try {
            const room = Math.max(1, maxSceneExpansionChunks - expanded.length);
            const { items } = await listChunks(collectionId, rag, {
                limit: room,
                metadataFilter: { sceneCode },
            });
            for (const item of (items || [])) {
                expanded.push(item);
                if (expanded.length >= maxSceneExpansionChunks) break;
            }
        } catch (error) {
            console.warn(`${LOG_PREFIX} Scene expansion failed for ${sceneCode}:`, error?.message || error);
        }
    }

    return expanded;
}

function applyImportanceBoost(results) {
    if (!Array.isArray(results) || results.length === 0) return [];
    return results.map(item => {
        const base = Number(item?.score) || 0;
        const importance = Number(item?.metadata?.importance);
        if (!Number.isFinite(importance)) {
            return item;
        }

        const boost = (importance - 50) / 500;
        return {
            ...item,
            score: base + boost,
        };
    });
}

/**
 * @param {Array<Object>} results
 * @param {string} queryText
 * @param {Object} rag
 * @returns {Promise<{results: Array<Object>, metadata: Object}>}
 */
async function applyReranker(results, queryText, rag) {
    const safeResults = Array.isArray(results) ? results : [];
    if (safeResults.length === 0 || !rag?.reranker?.enabled) {
        return {
            results: safeResults,
            metadata: { applied: false, skipped: true },
        };
    }

    const documents = safeResults.map(item => String(item?.text || ''));
    const reranked = await rerankDocuments(queryText, documents, rag, { topK: documents.length });
    if (!reranked.success || !Array.isArray(reranked.ranked) || reranked.ranked.length === 0) {
        return {
            results: safeResults,
            metadata: {
                applied: false,
                skipped: false,
                mode: reranked.mode || 'similharity',
                target: reranked.target || '',
                error: reranked.error || 'rerank failed',
            },
        };
    }

    const ordered = [];
    const used = new Set();

    for (const row of reranked.ranked) {
        const idx = Number(row?.index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= safeResults.length || used.has(idx)) continue;
        used.add(idx);
        ordered.push({
            ...safeResults[idx],
            _reranked: true,
            ...(Number.isFinite(Number(row?.score)) ? { _rerankScore: Number(row.score) } : {}),
        });
    }

    for (let i = 0; i < safeResults.length; i++) {
        if (used.has(i)) continue;
        ordered.push(safeResults[i]);
    }

    return {
        results: ordered,
        metadata: {
            applied: true,
            mode: reranked.mode || 'similharity',
            target: reranked.target || '',
            error: '',
        },
    };
}

/**
 * Strip machine-only metadata from chunk text before LLM injection.
 * Scene codes and weight emojis have already served their purpose in the
 * RAG pipeline (scene expansion, importance scoring) and are noise for the
 * receiving model.
 * @param {string} text
 * @returns {string}
 */
function cleanChunkText(text) {
    let cleaned = text;
    // Strip scene codes: [S31:1] or (S31:1)
    cleaned = cleaned.replace(/[\[(]S\d+:\d+[\])]\s*/g, '');
    // Strip weight emojis used in EVENTS section
    cleaned = cleaned.replace(/[🔴🟠🟡🟢⚪]\s*/g, '');
    // Clean orphaned leading pipe separators and excess whitespace
    cleaned = cleaned.replace(/^\s*\|\s*/gm, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned.trim();
}

/**
 * @param {string} template
 * @param {Array<Object>} results
 * @returns {string}
 */
function formatInjectionText(template, results) {
    const lines = [];
    let lastSceneCode = null;

    for (const item of (results || [])) {
        const cleaned = cleanChunkText(String(item?.text || ''));
        if (!cleaned) continue;

        // Add scene code group header for cumulative chunks
        const sceneCode = item?.metadata?.sceneCode || null;
        if (sceneCode && item?.metadata?.chunkBehavior === 'cumulative' && sceneCode !== lastSceneCode) {
            lines.push(`Timeline [${sceneCode}]`);
            lastSceneCode = sceneCode;
        }

        lines.push(cleaned);
    }

    if (lines.length === 0) return '';

    const textBlock = lines.join('\n\n');
    const tpl = String(template || 'Recalled memories:\n{{text}}');
    if (tpl.includes('{{text}}')) {
        return tpl.replace(/\{\{text\}\}/g, textBlock);
    }
    return `${tpl}\n${textBlock}`;
}

/**
 * Clear the extension prompt slot unconditionally.
 */
function clearExtensionPrompt() {
    if (typeof setExtensionPrompt === 'function') {
        setExtensionPrompt(EXTENSION_PROMPT_TAG_SS, '', 0, 0);
    }
}

/**
 * Apply RAG injection using the configured mode.
 * - 'extension_prompt': injects at a fixed position/depth via setExtensionPrompt
 * - 'variable': sets a local chat variable so {{getvar::name}} resolves in prompt templates
 * @param {string} text
 * @param {Object} rag
 */
function applyInjection(text, rag) {
    const mode = rag?.injectionMode ?? 'extension_prompt';
    if (mode === 'variable') {
        clearExtensionPrompt();
        const varName = rag?.injectionVariableName || 'ss_rag_memory';
        globalThis.SillyTavern?.getContext()?.variables?.local?.set(varName, text || '');
    } else {
        if (typeof setExtensionPrompt !== 'function') return;
        setExtensionPrompt(EXTENSION_PROMPT_TAG_SS, text || '', Number(rag?.position) || 0, Number(rag?.depth) || 0);
    }
}

/**
 * Clear Summary Sharder RAG prompt injection (both extension prompt and variable).
 * @param {Object} [rag]
 */
export function clearRagPromptInjection(rag) {
    clearExtensionPrompt();
    if (rag?.injectionMode === 'variable') {
        const varName = rag?.injectionVariableName || 'ss_rag_memory';
        globalThis.SillyTavern?.getContext()?.variables?.local?.set(varName, '');
    }
}

/**
 * Generate interceptor entrypoint.
 * @param {Array<Object>} chat
 * @param {number} contextSize
 * @param {AbortSignal|Object|null} abort
 * @param {string} type
 * @returns {Promise<Array<Object>>}
 */
export async function rearrangeChat(chat, contextSize, abort, type) {
    try {
        const settings = extension_settings?.summary_sharder;
        const rag = getActiveRagSettings(settings);
        const isSharder = settings?.sharderMode === true;

        if (type === 'quiet' || !rag?.enabled) {
            clearRagPromptInjection(rag);
            lastInjectionData = null;
            return chat;
        }

        if (abort?.aborted) {
            return chat;
        }

        const queryText = buildQueryText(chat, rag.queryCount);
        if (!queryText) {
            clearRagPromptInjection(rag);
            lastInjectionData = null;
            return chat;
        }

        const wantsHybrid = rag.scoringMethod === 'hybrid';
        const useNativeHybrid = wantsHybrid && (rag.backend === 'qdrant' || rag.backend === 'milvus');
        const useClientHybrid = wantsHybrid && !useNativeHybrid;

        const overfetchMultiplier = Math.max(1, Number(rag.hybridOverfetchMultiplier) || 4);
        const topK = Math.max(1, (Number(rag.insertCount) || 5) * (wantsHybrid ? overfetchMultiplier : 4));
        const threshold = Math.max(0, Math.min(1, Number(rag.scoreThreshold) || 0.25));

        const collectionId = getActiveCollectionId(null, settings);

        const queryFn = useNativeHybrid ? hybridQuery : queryChunks;

        const shardRes = await queryFn(collectionId, queryText, topK, threshold, rag);
        const shardResults = Array.isArray(shardRes?.results) ? shardRes.results : [];

        let merged = dedupeResults(shardResults);

        if (useClientHybrid) {
            merged = runClientHybridFusion(merged, queryText, rag);
            merged = keywordBoost(merged, queryText);
        } else if (!wantsHybrid) {
            merged = scoreAndRank(merged, queryText, settings);
        } else {
            merged = keywordBoost(merged, queryText);
        }

        merged = merged.filter(item => (Number(item?.score) || 0) >= threshold);

        // Scene expansion only applies to Sharder Mode (which has [S{n}:{n}] scene codes)
        const sceneExpanded = isSharder ? await expandByScene(settings, shardResults) : [];

        merged = dedupeResults([...merged, ...sceneExpanded]);

        // Fallback: If no superseding chunk was found by the initial query, fetch the latest one explicitly.
        // This ensures the "Current State" summary is always available if it exists in the collection.
        if (isSharder && !merged.some(item => item?.metadata?.chunkBehavior === 'superseding')) {
            const latest = await fetchLatestSuperseding(collectionId, rag);
            if (latest) {
                merged.push(latest);
                merged = dedupeResults(merged);
            }
        }

        const queryRolling = isSharder ? dedupeLatestRolling(merged) : [];
        const queryAnchors = isSharder ? collectLatestAnchors(merged) : [];
        const queryDevelopments = isSharder ? collectLatestDevelopments(merged) : [];
        let rollingPinned = [];
        let rollingPinnedCompacted = [];
        let anchorsPinned = [];
        let anchorsPinnedCompacted = [];
        let developmentsPinned = [];
        let developmentsPinnedCompacted = [];
        let rollingFallbackFetched = 0;
        let rollingFallbackHasMore = false;
        let anchorsFallbackFetched = 0;
        let anchorsFallbackHasMore = false;
        let developmentsFallbackFetched = 0;
        let developmentsFallbackHasMore = false;
        if (isSharder) {
            const fallbackRolling = await fetchLatestRolling(collectionId, rag, 50);
            rollingPinned = mergeLatestRolling(queryRolling, fallbackRolling.items);
            rollingPinnedCompacted = compactRollingPinnedChunks(rollingPinned, rag);
            rollingFallbackFetched = fallbackRolling.fetchedCount;
            rollingFallbackHasMore = fallbackRolling.hasMore;

            const fallbackAnchors = await fetchLatestAnchors(collectionId, rag, 50);
            anchorsPinned = mergeLatestAnchors(queryAnchors, fallbackAnchors.items);
            anchorsPinnedCompacted = compactAnchorsPinnedChunks(anchorsPinned, rag);
            anchorsFallbackFetched = fallbackAnchors.fetchedCount;
            anchorsFallbackHasMore = fallbackAnchors.hasMore;

            const fallbackDevelopments = await fetchLatestDevelopments(collectionId, rag, 50);
            developmentsPinned = mergeLatestDevelopments(queryDevelopments, fallbackDevelopments.items);
            developmentsPinnedCompacted = compactDevelopmentsPinnedChunks(developmentsPinned);
            developmentsFallbackFetched = fallbackDevelopments.fetchedCount;
            developmentsFallbackHasMore = fallbackDevelopments.hasMore;
        }

        merged = dedupeAgainstRecentContext(merged, chat, rag.protectCount);
        merged = applyImportanceBoost(merged);

        const rerankMeta = await applyReranker(merged, queryText, rag);
        merged = rerankMeta.results;

        if (!rerankMeta.metadata?.applied) {
            merged.sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));
        }

        // Always prioritize the latest superseding chunk to ensure it's not sliced out by the reranker/limit.
        const superseding = merged.filter(item => item?.metadata?.chunkBehavior === 'superseding');
        const others = merged.filter(item => item?.metadata?.chunkBehavior !== 'superseding');
        const insertCount = Math.max(1, Number(rag.insertCount) || 5);
        merged = [...superseding, ...others].slice(0, insertCount);

        // Scene grouping only applies to Sharder Mode
        merged = isSharder ? orderWithSceneGrouping(merged) : merged;

        if (isSharder && (rollingPinnedCompacted.length > 0 || anchorsPinnedCompacted.length > 0 || developmentsPinnedCompacted.length > 0)) {
            let mergedShaped = merged;
            if (rollingPinnedCompacted.length > 0) {
                mergedShaped = mergedShaped.filter(item => item?.metadata?.chunkBehavior !== 'rolling');
            }
            if (anchorsPinnedCompacted.length > 0) {
                mergedShaped = stripAnchorsFromCumulativeResults(mergedShaped);
            }
            if (developmentsPinnedCompacted.length > 0) {
                mergedShaped = stripDevelopmentsFromCumulativeResults(mergedShaped);
            }
            merged = dedupeResults([...mergedShaped, ...rollingPinnedCompacted, ...anchorsPinnedCompacted, ...developmentsPinnedCompacted]);
        }

        const injection = formatInjectionText(rag.template, merged);
        applyInjection(injection, rag);

        lastInjectionData = {
            timestamp: Date.now(),
            entries: merged.map(item => ({
                text: item?.text || '',
                score: item?.score ?? null,
                metadata: item?.metadata || {},
                hash: item?.hash || '',
            })),
            injectionMode: rag.injectionMode ?? 'extension_prompt',
            position: rag.injectionMode === 'variable' ? null : (Number(rag.position) || 0),
            depth: rag.injectionMode === 'variable' ? null : (Number(rag.depth) || 0),
            variableName: rag.injectionMode === 'variable' ? (rag.injectionVariableName || 'ss_rag_memory') : null,
            template: rag.template || 'Recalled memories:\n{{text}}',
            injectionText: injection,
            scoringMethod: rag.scoringMethod || 'keyword',
            backend: rag.backend,
            rerankerApplied: !!rerankMeta.metadata?.applied,
            rerankerMode: rerankMeta.metadata?.mode || 'none',
            mode: isSharder ? 'sharder' : 'standard',
        };

        console.log(`${LOG_PREFIX} Retrieval complete`, {
            mode: isSharder ? 'sharder' : 'standard',
            backend: rag.backend,
            useNativeHybrid,
            useClientHybrid,
            shardResults: shardResults.length,
            sceneExpanded: sceneExpanded.length,
            rollingPinned: rollingPinned.length,
            rollingPinnedCompacted: rollingPinnedCompacted.length,
            rollingFallbackFetched,
            rollingFallbackHasMore,
            anchorsPinned: anchorsPinned.length,
            anchorsPinnedCompacted: anchorsPinnedCompacted.length,
            anchorsFallbackFetched,
            anchorsFallbackHasMore,
            developmentsPinned: developmentsPinned.length,
            developmentsPinnedCompacted: developmentsPinnedCompacted.length,
            developmentsFallbackFetched,
            developmentsFallbackHasMore,
            rerankerApplied: !!rerankMeta.metadata?.applied,
            rerankerMode: rerankMeta.metadata?.mode || 'none',
            finalResults: merged.length,
        });
    } catch (error) {
        console.warn(`${LOG_PREFIX} Retrieval failed:`, error?.message || error);
        clearExtensionPrompt();
    }

    return chat;
}
