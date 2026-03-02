/**
 * Debug pipeline utilities for RAG retrieval introspection.
 * Mirrors retrieval.js flow without prompt injection side-effects.
 */

import { getRequestHeaders } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { getShardCollectionId } from './collection-manager.js';
import { bm25Score, keywordBoost, runClientHybridFusion, scoreAndRank } from './scoring.js';
import { resolveRagEmbeddingApiKey } from './rag-secrets.js';
import { rerankDocuments } from './reranker-client.js';
import { hybridQuery, listChunks, queryChunks } from './vector-client.js';
import {
    ANCHORS_SECTION_KEY,
    ANCHORS_SECTION_LABEL,
    buildQueryText,
    collectLatestAnchors,
    collectLatestDevelopments,
    compactAnchorsPinnedChunks,
    compactDevelopmentsPinnedChunks,
    compactRollingPinnedChunks,
    compareChronologically,
    CUMULATIVE_SECTION_ORDER,
    dedupeLatestRolling,
    DEVELOPMENTS_SECTION_KEY,
    DEVELOPMENTS_SECTION_LABEL,
    extractSectionBodyByHeading,
    getAnchorKey,
    getFreshnessEndIndex,
    getRollingKey,
    mergeLatestAnchors,
    mergeLatestDevelopments,
    mergeLatestRolling,
    normalizeText,
    parseSceneCode,
    PINNED_TIER_ORDER,
    ROLLING_SECTION_LABELS,
    ROLLING_SECTION_ORDER,
    splitSectionListItems,
    stripAnchorsFromCumulativeResults,
    stripLeadingSectionHeader,
    stripSectionByHeading,
} from './retrieval-shared.js';
import { tokenizeAndStem } from './stemmer.js';

const DEBUG_VERSION = 1;

/**
 * @param {Array<Object>} results
 * @returns {{items: Array<Object>, metadata: Object}}
 */
function dedupeResultsWithMeta(results) {
    const exactSeen = new Set();
    const exactDeduped = [];
    const exactRemoved = [];

    for (const item of (results || [])) {
        const key = `${item?.hash || ''}|${normalizeText(item?.text || '')}`;
        if (!key || exactSeen.has(key)) {
            exactRemoved.push(item);
            continue;
        }
        exactSeen.add(key);
        exactDeduped.push(item);
    }

    let latestSuperseding = null;
    const latestRolling = new Map();
    const passthrough = [];
    const behaviorRemoved = [];

    for (const item of exactDeduped) {
        const behavior = item?.metadata?.chunkBehavior || null;

        if (behavior === 'superseding') {
            if (!latestSuperseding || getFreshnessEndIndex(item) > getFreshnessEndIndex(latestSuperseding)) {
                if (latestSuperseding) {
                    behaviorRemoved.push({ reason: 'superseded', item: latestSuperseding });
                }
                latestSuperseding = item;
            } else {
                behaviorRemoved.push({ reason: 'superseded', item });
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
                if (existing) {
                    behaviorRemoved.push({ reason: 'rolling-replaced', item: existing });
                }
                latestRolling.set(rollingKey, item);
            } else {
                behaviorRemoved.push({ reason: 'rolling-replaced', item });
            }
            continue;
        }

        passthrough.push(item);
    }

    const out = [];
    if (latestSuperseding) out.push(latestSuperseding);
    out.push(...passthrough);
    out.push(...latestRolling.values());

    return {
        items: out,
        metadata: {
            exactRemoved: exactRemoved.length,
            behaviorRemoved: behaviorRemoved.length,
            droppedReasons: [
                ...exactRemoved.map(item => ({ reason: 'exact-duplicate', item })),
                ...behaviorRemoved,
            ],
        },
    };
}

/**
 * @param {Array<Object>} results
 * @param {Array<Object>} chat
 * @param {number} protectCount
 * @returns {{items: Array<Object>, metadata: Object}}
 */
function dedupeAgainstRecentContextWithMeta(results, chat, protectCount) {
    if (!Array.isArray(results) || results.length === 0) return { items: [], metadata: { droppedReasons: [] } };
    if (!Array.isArray(chat) || chat.length === 0) return { items: [...results], metadata: { droppedReasons: [] } };

    const safeProtect = Math.max(0, Number(protectCount) || 0);
    if (safeProtect <= 0) return { items: [...results], metadata: { droppedReasons: [] } };

    const start = Math.max(0, chat.length - safeProtect);
    const inContext = new Set();
    for (let i = start; i < chat.length; i++) {
        const text = String(chat[i]?.mes ?? chat[i]?.text ?? '').trim();
        if (!text) continue;
        inContext.add(normalizeText(text));
    }

    const droppedReasons = [];
    const items = [];
    for (const item of results) {
        const text = normalizeText(item?.text || '');
        if (text && inContext.has(text)) {
            droppedReasons.push({ reason: 'already-in-recent-context', item });
            continue;
        }
        items.push(item);
    }

    return { items, metadata: { droppedReasons } };
}

/**
 * Remove DEVELOPMENTS section blocks from cumulative chunks.
 * @param {Array<Object>} results
 * @returns {{items: Array<Object>, metadata: Object}}
 */
function stripDevelopmentsFromCumulativeResults(results) {
    const out = [];
    const droppedReasons = [];

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

        if (!stripped.text) {
            droppedReasons.push({ reason: 'developments-stripped-empty', item });
            continue;
        }

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

    return { items: out, metadata: { droppedReasons } };
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

    return dedupeResultsWithMeta(ordered).items;
}

/**
 * @param {Array<Object>} results
 * @returns {Array<Object>}
 */
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
            _importanceBoost: boost,
        };
    });
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
        const text = String(item?.text || '').trim();
        if (!text) continue;

        // Add scene code group header for cumulative chunks
        const sceneCode = item?.metadata?.sceneCode || null;
        if (sceneCode && item?.metadata?.chunkBehavior === 'cumulative' && sceneCode !== lastSceneCode) {
            lines.push(`Timeline [${sceneCode}]`);
            lastSceneCode = sceneCode;
        }

        lines.push(text);
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

        const room = Math.max(1, maxSceneExpansionChunks - expanded.length);
        try {
            const { items } = await listChunks(collectionId, rag, {
                limit: room,
                metadataFilter: { sceneCode },
            });
            for (const item of (items || [])) {
                expanded.push(item);
                if (expanded.length >= maxSceneExpansionChunks) break;
            }
        } catch (error) {
            console.warn('[SummarySharder:RAG] Scene expansion failed:', error?.message || error);
        }
    }

    return expanded;
}

function toClone(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

function toScore(value) {
    const score = Number(value?.score) || 0;
    return Number.isFinite(score) ? score : 0;
}

function getResultKey(item) {
    return `${String(item?.hash || '')}|${normalizeText(item?.text || '')}`;
}

function asSafeResults(items) {
    return Array.isArray(items) ? items.map(item => ({ ...item })) : [];
}

function nowMs() {
    return (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();
}

function buildConfigSnapshot(rag, overrides, chat, queryText) {
    return {
        backend: rag?.backend || 'vectra',
        source: rag?.source || 'transformers',
        scoringMethod: rag?.scoringMethod || 'keyword',
        insertCount: Math.max(1, Number(rag?.insertCount) || 5),
        queryCount: Math.max(1, Number(rag?.queryCount) || 2),
        threshold: Math.max(0, Math.min(1, Number(rag?.scoreThreshold) || 0.25)),
        sceneExpansion: rag?.sceneExpansion !== false,
        rerankerEnabled: !!rag?.reranker?.enabled,
        rerankerMode: String(rag?.reranker?.mode || 'similharity'),
        overrides: { ...overrides },
        chatLength: Array.isArray(chat) ? chat.length : 0,
        queryLength: String(queryText || '').length,
    };
}

/**
 * BM25 term-level introspection.
 * @param {Array<Object>} results
 * @param {string} queryText
 * @returns {Array<Object>}
 */
export function runBm25Breakdown(results, queryText) {
    const safeResults = asSafeResults(results);
    if (safeResults.length === 0) return [];

    const docs = safeResults.map(item => tokenizeAndStem(item?.text || ''));
    const queryTokens = tokenizeAndStem(queryText);
    if (queryTokens.length === 0) return safeResults.map(() => ({ terms: [], bm25: 0 }));

    const avgdl = Math.max(1, docs.reduce((sum, d) => sum + d.length, 0) / docs.length);
    const N = docs.length;
    const df = new Map();
    for (const tokens of docs) {
        const uniq = new Set(tokens);
        for (const token of uniq) {
            df.set(token, (df.get(token) || 0) + 1);
        }
    }

    const k1 = 1.8;
    const b = 0.5;

    return safeResults.map((item, idx) => {
        const docTokens = docs[idx];
        const dl = Math.max(1, docTokens.length);
        const tf = new Map();
        for (const token of docTokens) {
            tf.set(token, (tf.get(token) || 0) + 1);
        }

        const terms = [];
        let bm25 = 0;
        for (const q of queryTokens) {
            const termTf = tf.get(q) || 0;
            const termDf = df.get(q) || 0;
            const idf = Math.log(1 + ((N - termDf + 0.5) / (termDf + 0.5)));
            let contribution = 0;
            if (termTf > 0) {
                const denom = termTf + k1 * (1 - b + b * (dl / avgdl));
                contribution = idf * ((termTf * (k1 + 1)) / Math.max(0.0001, denom));
                bm25 += contribution;
            }
            terms.push({
                term: q,
                tf: termTf,
                df: termDf,
                idf,
                contribution,
            });
        }

        return {
            hash: item?.hash ?? '',
            terms,
            bm25,
        };
    });
}

/**
 * Stage-by-stage scoring introspection for a fixed result set.
 * @param {Array<Object>} results
 * @param {string} queryText
 * @param {Object} ragSettings
 * @returns {Array<Object>}
 */
export function runScoringBreakdown(results, queryText, ragSettings = {}) {
    const safe = asSafeResults(results);
    if (safe.length === 0) return [];

    const rag = { ...(ragSettings || {}) };
    const keyByIndex = safe.map(getResultKey);

    const withKeyword = keywordBoost(safe, queryText);
    const withBm25 = bm25Score(withKeyword, queryText);
    let scored;
    if ((rag.scoringMethod || 'keyword') === 'bm25') {
        scored = bm25Score(safe, queryText);
    } else if ((rag.scoringMethod || 'keyword') === 'hybrid') {
        scored = keywordBoost(runClientHybridFusion(safe, queryText, rag), queryText);
    } else {
        scored = keywordBoost(safe, queryText);
    }

    const withImportance = applyImportanceBoost(scored);
    const bm25Breakdown = runBm25Breakdown(safe, queryText);

    const byKey = arr => {
        const map = new Map();
        for (const item of arr) {
            map.set(getResultKey(item), item);
        }
        return map;
    };

    const kwMap = byKey(withKeyword);
    const bmMap = byKey(withBm25);
    const scoredMap = byKey(scored);
    const impMap = byKey(withImportance);
    const bmTermsMap = new Map();
    for (const entry of bm25Breakdown) {
        bmTermsMap.set(`${String(entry?.hash || '')}`, entry?.terms || []);
    }

    return keyByIndex.map((key, idx) => {
        const base = safe[idx];
        const kw = kwMap.get(key) || base;
        const bm = bmMap.get(key) || kw;
        const scoreStage = scoredMap.get(key) || kw;
        const imp = impMap.get(key) || scoreStage;
        const baseScore = toScore(base);
        const kwScore = toScore(kw);
        const bmScore = toScore(bm);
        const stageScore = toScore(scoreStage);
        const finalScore = toScore(imp);
        const importance = Number(base?.metadata?.importance);
        const importanceBoost = Number.isFinite(importance) ? ((importance - 50) / 500) : 0;
        const hashKey = String(base?.hash || '');

        return {
            hash: base?.hash ?? '',
            index: base?.index ?? null,
            text: base?.text || '',
            metadata: base?.metadata || {},
            steps: {
                base: baseScore,
                keyword: {
                    before: baseScore,
                    after: kwScore,
                    delta: kwScore - baseScore,
                    boost: Number(kw?._keywordBoost) || 0,
                },
                bm25: {
                    before: kwScore,
                    after: bmScore,
                    alpha: 0.4,
                    beta: 0.6,
                    bm25Raw: Number(bm?._bm25) || 0,
                    terms: bmTermsMap.get(hashKey) || [],
                },
                scoring: {
                    method: rag.scoringMethod || 'keyword',
                    after: stageScore,
                },
                importance: {
                    before: stageScore,
                    after: finalScore,
                    importance: Number.isFinite(importance) ? importance : null,
                    boost: importanceBoost,
                },
            },
            finalScore,
        };
    });
}

async function runStage(stages, stageName, input, fn, metadata = {}) {
    const before = nowMs();
    const inputArr = asSafeResults(input);
    const stageState = await fn(inputArr);
    const outputArr = asSafeResults(stageState?.results);
    const durationMs = nowMs() - before;
    stages.push({
        stageName,
        durationMs,
        inputCount: inputArr.length,
        outputCount: outputArr.length,
        removedCount: Math.max(0, inputArr.length - outputArr.length),
        results: toClone(outputArr),
        metadata: {
            ...metadata,
            ...(stageState?.metadata || {}),
        },
    });
    return outputArr;
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
        console.warn('[SummarySharder:RAG] Debug fallback superseding fetch failed:', error?.message || error);
        return null;
    }
}

/**
 * Explicitly fetch rolling chunks and keep latest per sectionType|entityKey.
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
        console.warn('[SummarySharder:RAG] Debug fallback rolling fetch failed:', error?.message || error);
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
        console.warn('[SummarySharder:RAG] Debug fallback anchors fetch failed:', error?.message || error);
        return {
            items: [],
            fetchedCount: 0,
            hasMore: false,
        };
    }
}

/**
 * Full retrieval simulation without prompt injection.
 * @param {Object} overrides
 * @returns {Promise<Object>}
 */
export async function runDebugPipeline(overrides = {}) {
    const settings = extension_settings?.summary_sharder || {};
    const ragBase = settings?.rag || {};
    const isSharder = settings?.sharderMode === true;
    const context = SillyTavern.getContext?.() || {};
    const chat = Array.isArray(overrides.chat) ? overrides.chat : (Array.isArray(context.chat) ? context.chat : []);

    const rag = {
        ...ragBase,
        ...(overrides.rag || {}),
    };
    if (overrides.scoringMethod) rag.scoringMethod = overrides.scoringMethod;
    if (typeof overrides.sceneExpansion === 'boolean') rag.sceneExpansion = overrides.sceneExpansion;

    const shardCollectionId = getShardCollectionId();
    const stages = [];
    const t0 = nowMs();
    const queryText = String(overrides.queryText || buildQueryText(chat, rag.queryCount));

    const baseMeta = {
        scoringMethod: rag.scoringMethod || 'keyword',
        sceneExpansion: rag.sceneExpansion !== false,
    };
    let rerankerApplied = false;
    const rollingPinState = {
        items: [],
        compactedItems: [],
        fetchedCount: 0,
        hasMore: false,
    };
    const anchorsPinState = {
        items: [],
        compactedItems: [],
        fetchedCount: 0,
        hasMore: false,
    };

    let sourceResults = [];
    await runStage(stages, 'buildQueryText', [], async () => ({
        results: [],
        metadata: {
            queryText,
            queryLength: queryText.length,
        },
    }), baseMeta);

    if (!queryText) {
        const totalDuration = nowMs() - t0;
        return {
            debugVersion: DEBUG_VERSION,
            timestamp: Date.now(),
            totalDurationMs: totalDuration,
            queryText,
            stages,
            injectionText: '',
            finalResults: [],
            configSnapshot: buildConfigSnapshot(rag, overrides, chat, queryText),
        };
    }

    const wantsHybrid = rag.scoringMethod === 'hybrid';
    const useNativeHybrid = wantsHybrid && (rag.backend === 'qdrant' || rag.backend === 'milvus');
    const useClientHybrid = wantsHybrid && !useNativeHybrid;
    const overfetchMultiplier = Math.max(1, Number(rag.hybridOverfetchMultiplier) || 4);
    const topK = Math.max(1, (Number(rag.insertCount) || 5) * (wantsHybrid ? overfetchMultiplier : 4));
    const threshold = Math.max(0, Math.min(1, Number(rag.scoreThreshold) || 0.25));
    const queryFn = useNativeHybrid ? hybridQuery : queryChunks;

    sourceResults = await runStage(stages, 'vectorQuery', [], async () => {
        const shardRes = await queryFn(shardCollectionId, queryText, topK, threshold, rag);
        const shardResults = Array.isArray(shardRes?.results) ? shardRes.results : [];
        return {
            results: shardResults,
            metadata: {
                backend: rag.backend,
                topK,
                threshold,
                useNativeHybrid,
                useClientHybrid,
            },
        };
    }, baseMeta);

    let working = await runStage(stages, 'dedupeResults', sourceResults, async (input) => {
        const deduped = dedupeResultsWithMeta(input);
        return {
            results: deduped.items,
            metadata: deduped.metadata,
        };
    }, baseMeta);

    working = await runStage(stages, 'scoring', working, async (input) => {
        let scored = input;
        if (useClientHybrid) {
            scored = runClientHybridFusion(scored, queryText, rag);
            scored = keywordBoost(scored, queryText);
        } else if (!wantsHybrid) {
            scored = scoreAndRank(scored, queryText, { rag });
        } else {
            scored = keywordBoost(scored, queryText);
        }
        return { results: scored };
    }, baseMeta);

    working = await runStage(stages, 'thresholdFilter', working, async (input) => {
        const droppedReasons = [];
        const filtered = [];
        for (const item of input) {
            const score = Number(item?.score) || 0;
            if (score >= threshold) {
                filtered.push(item);
            } else {
                droppedReasons.push({ reason: 'below-threshold', score, item });
            }
        }
        return {
            results: filtered,
            metadata: {
                threshold,
                droppedReasons,
            },
        };
    }, baseMeta);

    const sceneExpanded = await runStage(stages, 'sceneExpansion', sourceResults, async () => {
        if (rag.sceneExpansion === false) {
            return { results: [], metadata: { skipped: true } };
        }
        return { results: await expandByScene({ rag }, sourceResults) };
    }, baseMeta);

    working = await runStage(stages, 'mergeAndDedup', [...working, ...sceneExpanded], async (input) => {
        const deduped = dedupeResultsWithMeta(input);
        return {
            results: deduped.items,
            metadata: deduped.metadata,
        };
    }, baseMeta);

    working = await runStage(stages, 'supersedingFallback', working, async (input) => {
        if (!isSharder || input.some(item => item?.metadata?.chunkBehavior === 'superseding')) {
            return { results: input, metadata: { skipped: true } };
        }
        const latest = await fetchLatestSuperseding(shardCollectionId, rag);
        if (!latest) return { results: input, metadata: { found: false } };

        const results = [...input, latest];
        return {
            results: dedupeResultsWithMeta(results).items,
            metadata: { found: true },
        };
    }, baseMeta);

    working = await runStage(stages, 'rollingFallback', working, async (input) => {
        if (!isSharder) {
            rollingPinState.items = [];
            rollingPinState.compactedItems = [];
            rollingPinState.fetchedCount = 0;
            rollingPinState.hasMore = false;
            return { results: input, metadata: { skipped: true } };
        }

        const queryRolling = dedupeLatestRolling(input);
        const fallback = await fetchLatestRolling(shardCollectionId, rag, 50);
        const pinned = mergeLatestRolling(queryRolling, fallback.items);

        rollingPinState.items = pinned;
        rollingPinState.compactedItems = compactRollingPinnedChunks(pinned, rag);
        rollingPinState.fetchedCount = fallback.fetchedCount;
        rollingPinState.hasMore = fallback.hasMore;

        return {
            results: input,
            metadata: {
                skipped: false,
                queryRollingCount: queryRolling.length,
                fallbackFetchedCount: fallback.fetchedCount,
                fallbackHasMore: fallback.hasMore,
                pinnedRollingCount: pinned.length,
                pinnedRollingCompactedCount: rollingPinState.compactedItems.length,
                rollingKeysCovered: pinned.map(getRollingKey).filter(Boolean),
            },
        };
    }, baseMeta);

    working = await runStage(stages, 'anchorsFallback', working, async (input) => {
        if (!isSharder) {
            anchorsPinState.items = [];
            anchorsPinState.compactedItems = [];
            anchorsPinState.fetchedCount = 0;
            anchorsPinState.hasMore = false;
            return { results: input, metadata: { skipped: true } };
        }

        const queryAnchors = collectLatestAnchors(input);
        const fallback = await fetchLatestAnchors(shardCollectionId, rag, 50);
        const pinned = mergeLatestAnchors(queryAnchors, fallback.items);

        anchorsPinState.items = pinned;
        anchorsPinState.compactedItems = compactAnchorsPinnedChunks(pinned, rag);
        anchorsPinState.fetchedCount = fallback.fetchedCount;
        anchorsPinState.hasMore = fallback.hasMore;

        return {
            results: input,
            metadata: {
                skipped: false,
                queryAnchorsCount: queryAnchors.length,
                fallbackFetchedCount: fallback.fetchedCount,
                fallbackHasMore: fallback.hasMore,
                pinnedAnchorsCount: pinned.length,
                pinnedAnchorsCompactedCount: anchorsPinState.compactedItems.length,
                anchorKeysCovered: pinned.map(entry => entry.key).filter(Boolean),
            },
        };
    }, baseMeta);

    working = await runStage(stages, 'contextDedup', working, async (input) => {
        const deduped = dedupeAgainstRecentContextWithMeta(input, chat, rag.protectCount);
        return {
            results: deduped.items,
            metadata: deduped.metadata,
        };
    }, baseMeta);

    working = await runStage(stages, 'importanceBoost', working, async (input) => ({
        results: applyImportanceBoost(input),
    }), baseMeta);

    working = await runStage(stages, 'reranker', working, async (input) => {
        if (!rag?.reranker?.enabled) {
            rerankerApplied = false;
            return {
                results: input,
                metadata: { skipped: true },
            };
        }

        const docs = input.map(item => String(item?.text || ''));
        const reranked = await rerankDocuments(queryText, docs, rag, { topK: docs.length });
        if (!reranked.success || !Array.isArray(reranked.ranked) || reranked.ranked.length === 0) {
            rerankerApplied = false;
            return {
                results: input,
                metadata: {
                    skipped: false,
                    applied: false,
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
            if (!Number.isInteger(idx) || idx < 0 || idx >= input.length || used.has(idx)) continue;
            used.add(idx);
            ordered.push({
                ...input[idx],
                _reranked: true,
                ...(Number.isFinite(Number(row?.score)) ? { _rerankScore: Number(row.score) } : {}),
            });
        }

        for (let i = 0; i < input.length; i++) {
            if (!used.has(i)) {
                ordered.push(input[i]);
            }
        }
        rerankerApplied = true;

        return {
            results: ordered,
            metadata: {
                skipped: false,
                applied: true,
                mode: reranked.mode || 'similharity',
                target: reranked.target || '',
                rankedCount: ordered.length,
            },
        };
    }, baseMeta);

    working = await runStage(stages, 'topKSlice', working, async (input) => {
        const sorted = rerankerApplied
            ? [...input]
            : [...input].sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));

        // Always prioritize the latest superseding chunk to ensure it's not sliced out by the reranker/limit.
        const superseding = sorted.filter(item => item?.metadata?.chunkBehavior === 'superseding');
        const others = sorted.filter(item => item?.metadata?.chunkBehavior !== 'superseding');
        const insertCount = Math.max(1, Number(rag.insertCount) || 5);
        const sliced = [...superseding, ...others].slice(0, insertCount);

        return {
            results: sliced,
            metadata: {
                insertCount,
                sortedBy: rerankerApplied ? 'reranker' : 'score',
                prioritizedSuperseding: superseding.length,
            },
        };
    }, baseMeta);

    working = await runStage(stages, 'sceneGrouping', working, async (input) => ({
        results: orderWithSceneGrouping(input),
    }), baseMeta);

    working = await runStage(stages, 'rollingPin', working, async (input) => {
        if (!isSharder || rollingPinState.compactedItems.length === 0) {
            return {
                results: input,
                metadata: {
                    skipped: true,
                    pinnedRollingCount: 0,
                },
            };
        }

        const withoutRolling = input.filter(item => item?.metadata?.chunkBehavior !== 'rolling');
        const combined = dedupeResultsWithMeta([...withoutRolling, ...rollingPinState.compactedItems]);
        return {
            results: combined.items,
            metadata: {
                skipped: false,
                pinnedRollingCount: rollingPinState.items.length,
                pinnedRollingCompactedCount: rollingPinState.compactedItems.length,
                fallbackFetchedCount: rollingPinState.fetchedCount,
                fallbackHasMore: rollingPinState.hasMore,
                ...combined.metadata,
            },
        };
    }, baseMeta);

    working = await runStage(stages, 'anchorsPin', working, async (input) => {
        if (!isSharder || anchorsPinState.compactedItems.length === 0) {
            return {
                results: input,
                metadata: {
                    skipped: true,
                    pinnedAnchorsCount: 0,
                },
            };
        }

        const stripped = stripAnchorsFromCumulativeResults(input);
        const combined = dedupeResultsWithMeta([...stripped, ...anchorsPinState.compactedItems]);
        return {
            results: combined.items,
            metadata: {
                skipped: false,
                pinnedAnchorsCount: anchorsPinState.items.length,
                pinnedAnchorsCompactedCount: anchorsPinState.compactedItems.length,
                fallbackFetchedCount: anchorsPinState.fetchedCount,
                fallbackHasMore: anchorsPinState.hasMore,
                ...combined.metadata,
            },
        };
    }, baseMeta);

    const formatInput = working;
    await runStage(stages, 'formatInjection', formatInput, async (input) => ({
        results: input,
        metadata: {
            injectionText: formatInjectionText(rag.template, input),
        },
    }), baseMeta);

    const injectionText = formatInjectionText(rag.template, working);
    const totalDurationMs = nowMs() - t0;

    return {
        debugVersion: DEBUG_VERSION,
        timestamp: Date.now(),
        totalDurationMs,
        queryText,
        stages,
        injectionText,
        finalResults: toClone(working),
        configSnapshot: buildConfigSnapshot(rag, overrides, chat, queryText),
    };
}

/**
 * Get raw embedding vector for a text probe.
 * @param {Object} ragSettings
 * @param {string} text
 * @returns {Promise<Array<number>>}
 */
export async function getEmbeddingVector(ragSettings, text) {
    const rag = ragSettings || {};
    const embeddingApiKey = await resolveRagEmbeddingApiKey(rag);
    const response = await fetch('/api/plugins/similharity/get-embedding', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            source: rag.source || 'transformers',
            model: rag.model || '',
            text: String(text || ''),
            apiUrl: rag.apiUrl || '',
            ...(embeddingApiKey ? { apiKey: embeddingApiKey } : {}),
        }),
    });

    if (!response.ok) {
        throw new Error(`Embedding request failed (${response.status})`);
    }

    const data = await response.json();
    const embedding = data?.embedding;
    return Array.isArray(embedding) ? embedding : [];
}

/**
 * @param {Array<number>} vecA
 * @param {Array<number>} vecB
 * @returns {number}
 */
export function cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
        return 0;
    }
    const len = Math.min(vecA.length, vecB.length);
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < len; i++) {
        const a = Number(vecA[i]) || 0;
        const b = Number(vecB[i]) || 0;
        dot += a * b;
        magA += a * a;
        magB += b * b;
    }
    if (magA <= 0 || magB <= 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
