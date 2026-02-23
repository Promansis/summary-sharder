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
import { tokenizeAndStem } from './stemmer.js';

const DEBUG_VERSION = 1;

/**
 * Keep aligned with retrieval.js helper.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * Keep aligned with retrieval.js helper.
 * @param {Object} item
 * @returns {number}
 */
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
 * Keep aligned with retrieval.js helper.
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
 * Keep aligned with retrieval.js helper.
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
            const sectionType = String(item?.metadata?.sectionType || '');
            const entityKey = String(item?.metadata?.entityKey || '');
            if (!sectionType || !entityKey) {
                passthrough.push(item);
                continue;
            }

            const rollingKey = `${sectionType}|${entityKey}`;
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
 * Keep aligned with retrieval.js helper.
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
 * Keep aligned with retrieval.js helper.
 * @param {Array<Object>} results
 * @returns {Array<Object>}
 */
function orderWithSceneGrouping(results) {
    if (!Array.isArray(results) || results.length <= 1) return results || [];

    const sceneBuckets = new Map();
    const cumulativeNoScene = [];
    const rolling = [];
    const superseding = [];
    const legacyNoScene = [];

    for (const item of results) {
        const behavior = item?.metadata?.chunkBehavior || null;
        if (behavior === 'superseding') {
            superseding.push(item);
            continue;
        }

        if (behavior === 'rolling') {
            rolling.push(item);
            continue;
        }

        const sceneCode = item?.metadata?.sceneCode || null;
        if (!sceneCode) {
            if (behavior === 'cumulative') {
                cumulativeNoScene.push(item);
            } else {
                legacyNoScene.push(item);
            }
            continue;
        }

        if (!sceneBuckets.has(sceneCode)) {
            sceneBuckets.set(sceneCode, []);
        }
        sceneBuckets.get(sceneCode).push(item);
    }

    for (const bucket of sceneBuckets.values()) {
        bucket.sort((a, b) => getFreshnessEndIndex(a) - getFreshnessEndIndex(b));
    }

    superseding.sort((a, b) => getFreshnessEndIndex(b) - getFreshnessEndIndex(a));
    cumulativeNoScene.sort((a, b) => getFreshnessEndIndex(a) - getFreshnessEndIndex(b));
    rolling.sort((a, b) => {
        const scoreDelta = (Number(b?.score) || 0) - (Number(a?.score) || 0);
        if (scoreDelta !== 0) return scoreDelta;
        return String(a?.metadata?.sectionType || '').localeCompare(String(b?.metadata?.sectionType || ''));
    });
    legacyNoScene.sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));

    const ordered = [...superseding];
    const usedScenes = new Set();

    const sceneLeads = [...results]
        .filter(item => !!item?.metadata?.sceneCode)
        .sort((a, b) => getFreshnessEndIndex(a) - getFreshnessEndIndex(b));

    for (const item of sceneLeads) {
        const sceneCode = item?.metadata?.sceneCode || null;
        if (!sceneCode || usedScenes.has(sceneCode)) continue;
        usedScenes.add(sceneCode);
        ordered.push(...(sceneBuckets.get(sceneCode) || []));
    }

    ordered.push(...cumulativeNoScene);
    ordered.push(...rolling);
    ordered.push(...legacyNoScene);
    return dedupeResultsWithMeta(ordered).items;
}

/**
 * Keep aligned with retrieval.js helper.
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
 * Keep aligned with retrieval.js helper.
 * @param {string} template
 * @param {Array<Object>} results
 * @returns {string}
 */
function formatInjectionText(template, results) {
    const lines = (results || []).map(item => String(item?.text || '').trim()).filter(Boolean);
    if (lines.length === 0) return '';

    const textBlock = lines.join('\n\n');
    const tpl = String(template || 'Recalled memories:\n{{text}}');
    if (tpl.includes('{{text}}')) {
        return tpl.replace(/\{\{text\}\}/g, textBlock);
    }
    return `${tpl}\n${textBlock}`;
}

/**
 * Keep aligned with retrieval.js helper.
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
 * Full retrieval simulation without prompt injection.
 * @param {Object} overrides
 * @returns {Promise<Object>}
 */
export async function runDebugPipeline(overrides = {}) {
    const settings = extension_settings?.summary_sharder || {};
    const ragBase = settings?.rag || {};
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
            return {
                results: input,
                metadata: { skipped: true },
            };
        }

        const docs = input.map(item => String(item?.text || ''));
        const reranked = await rerankDocuments(queryText, docs, rag, { topK: docs.length });
        if (!reranked.success || !Array.isArray(reranked.ranked) || reranked.ranked.length === 0) {
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
        const sorted = rag?.reranker?.enabled
            ? [...input]
            : [...input].sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));
        return {
            results: sorted.slice(0, Math.max(1, Number(rag.insertCount) || 5)),
            metadata: {
                insertCount: Math.max(1, Number(rag.insertCount) || 5),
                sortedBy: rag?.reranker?.enabled ? 'reranker' : 'score',
            },
        };
    }, baseMeta);

    working = await runStage(stages, 'sceneGrouping', working, async (input) => ({
        results: orderWithSceneGrouping(input),
    }), baseMeta);

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
