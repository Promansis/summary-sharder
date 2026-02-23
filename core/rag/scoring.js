/**
 * Client-side scoring helpers for Summary Sharder RAG retrieval.
 * Used for backends without native hybrid fusion.
 */

import { tokenizeAndStem } from './stemmer.js';

const LOG_PREFIX = '[SummarySharder:RAG]';

const WORD_RE = /[a-z0-9][a-z0-9'_\-]*/gi;
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'this', 'that', 'these', 'those', 'it', 'its', 'they',
    'them', 'their', 'you', 'your', 'we', 'our', 'i', 'me', 'my', 'he', 'she',
    'his', 'her', 'not', 'so', 'if', 'then', 'than', 'too', 'very', 'can',
    'could', 'would', 'should', 'will', 'just', 'about', 'into', 'over', 'after',
]);

function tokenize(text) {
    const raw = String(text || '').toLowerCase();
    const matches = raw.match(WORD_RE) || [];
    return matches.filter(t => t.length >= 2 && !STOP_WORDS.has(t));
}

function getItemKey(item) {
    return `${String(item?.hash || '')}|${String(item?.text || '').trim().toLowerCase()}`;
}

function sortByScore(results) {
    return [...(results || [])].sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));
}

function normalizeByMax(value, maxValue) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (!Number.isFinite(maxValue) || maxValue <= 0) return 0;
    return Math.min(1, value / maxValue);
}

export function keywordBoost(results, queryText) {
    if (!Array.isArray(results) || results.length === 0) return [];

    const queryTokens = tokenize(queryText);
    if (queryTokens.length === 0) return [...results];

    const querySet = new Set(queryTokens);

    return results.map(item => {
        const textTokens = tokenize(item?.text || '');
        const keywordTokens = Array.isArray(item?.metadata?.keywords)
            ? item.metadata.keywords.map(k => String(k).toLowerCase())
            : [];

        let boost = 0;

        for (const token of textTokens) {
            if (querySet.has(token)) boost += 0.03;
        }

        for (const kw of keywordTokens) {
            if (querySet.has(kw)) {
                boost += 0.08;
            } else {
                for (const qt of querySet) {
                    if (kw.includes(qt) || qt.includes(kw)) {
                        boost += 0.03;
                        break;
                    }
                }
            }
        }

        const base = Number(item?.score) || 0;
        return {
            ...item,
            score: base + boost,
            _baseScore: base,
            _keywordBoost: boost,
        };
    });
}

export function bm25Score(results, queryText, params = {}) {
    if (!Array.isArray(results) || results.length === 0) return [];

    const k1 = Number.isFinite(params.k1) ? params.k1 : 1.8;
    const b = Number.isFinite(params.b) ? params.b : 0.5;
    const alpha = Number.isFinite(params.alpha) ? params.alpha : 0.4;
    const beta = Number.isFinite(params.beta) ? params.beta : 0.6;

    const queryTokens = tokenizeAndStem(queryText);
    if (queryTokens.length === 0) return [...results];

    const docs = results.map(r => tokenizeAndStem(r?.text || ''));
    const avgdl = Math.max(1, docs.reduce((sum, d) => sum + d.length, 0) / docs.length);

    const df = new Map();
    for (const tokens of docs) {
        const uniq = new Set(tokens);
        for (const token of uniq) {
            df.set(token, (df.get(token) || 0) + 1);
        }
    }

    const N = docs.length;

    return results.map((item, idx) => {
        const docTokens = docs[idx];
        const dl = Math.max(1, docTokens.length);
        const tf = new Map();
        for (const token of docTokens) {
            tf.set(token, (tf.get(token) || 0) + 1);
        }

        let bm25 = 0;
        for (const q of queryTokens) {
            const termTf = tf.get(q) || 0;
            if (termTf <= 0) continue;

            const termDf = df.get(q) || 0;
            const idf = Math.log(1 + (N - termDf + 0.5) / (termDf + 0.5));
            const denom = termTf + k1 * (1 - b + b * (dl / avgdl));
            bm25 += idf * ((termTf * (k1 + 1)) / Math.max(0.0001, denom));
        }

        const base = Number(item?.score) || 0;
        const combined = (alpha * base) + (beta * bm25);

        return {
            ...item,
            score: combined,
            _baseScore: base,
            _bm25: bm25,
        };
    });
}

function fuseRrf(vectorRanked, bm25Ranked, k = 60) {
    const safeK = Math.max(1, Number(k) || 60);
    const vecRanks = new Map();
    const bmRanks = new Map();
    const merged = new Map();

    vectorRanked.forEach((item, idx) => {
        const key = getItemKey(item);
        vecRanks.set(key, idx + 1);
        merged.set(key, { ...item });
    });
    bm25Ranked.forEach((item, idx) => {
        const key = getItemKey(item);
        bmRanks.set(key, idx + 1);
        if (!merged.has(key)) {
            merged.set(key, { ...item });
        }
    });

    const out = [];
    const maxRaw = (1 / (safeK + 1)) * 2;
    for (const [key, item] of merged.entries()) {
        const vecRank = vecRanks.get(key);
        const bmRank = bmRanks.get(key);
        const vecScore = vecRank ? (1 / (safeK + vecRank)) : 0;
        const bmScore = bmRank ? (1 / (safeK + bmRank)) : 0;
        const raw = vecScore + bmScore;
        out.push({
            ...item,
            score: maxRaw > 0 ? (raw / maxRaw) : raw,
            _fusionMethod: 'rrf',
            _rrfVector: vecScore,
            _rrfBm25: bmScore,
        });
    }

    return sortByScore(out);
}

function fuseWeighted(vectorRanked, bm25Ranked, alpha = 0.4, beta = 0.6) {
    const safeAlpha = Math.max(0, Number(alpha) || 0.4);
    const safeBeta = Math.max(0, Number(beta) || 0.6);
    const combinedWeight = safeAlpha + safeBeta;
    const normAlpha = combinedWeight > 0 ? (safeAlpha / combinedWeight) : 0.4;
    const normBeta = combinedWeight > 0 ? (safeBeta / combinedWeight) : 0.6;

    const bm25ByKey = new Map();
    for (const item of bm25Ranked) {
        bm25ByKey.set(getItemKey(item), item);
    }

    const vecMax = Math.max(0.0001, ...vectorRanked.map(r => Number(r?.score) || 0));
    const bmMax = Math.max(0.0001, ...bm25Ranked.map(r => Number(r?._bm25) || Number(r?.score) || 0));

    const out = [];
    for (const vectorItem of vectorRanked) {
        const key = getItemKey(vectorItem);
        const bmItem = bm25ByKey.get(key);
        const vecBase = Number(vectorItem?.score) || 0;
        const bmBase = Number(bmItem?._bm25);
        const bmValue = Number.isFinite(bmBase) ? bmBase : (Number(bmItem?.score) || 0);
        const vecNorm = normalizeByMax(vecBase, vecMax);
        const bmNorm = normalizeByMax(bmValue, bmMax);

        out.push({
            ...vectorItem,
            score: (normAlpha * vecNorm) + (normBeta * bmNorm),
            _fusionMethod: 'weighted',
            _vectorNorm: vecNorm,
            _bm25Norm: bmNorm,
        });
    }

    return sortByScore(out);
}

/**
 * Run client-side hybrid fusion using vector + BM25 signals.
 * @param {Array<Object>} results
 * @param {string} queryText
 * @param {Object} rag
 * @returns {Array<Object>}
 */
export function runClientHybridFusion(results, queryText, rag = {}) {
    if (!Array.isArray(results) || results.length === 0) return [];

    const vectorRanked = sortByScore(results);
    const bm25Ranked = sortByScore(bm25Score(results, queryText, { alpha: 0, beta: 1 }));
    const method = rag?.hybridFusionMethod === 'weighted' ? 'weighted' : 'rrf';

    if (method === 'weighted') {
        return fuseWeighted(vectorRanked, bm25Ranked, rag?.hybridAlpha, rag?.hybridBeta);
    }

    return fuseRrf(vectorRanked, bm25Ranked, rag?.hybridRrfK);
}

export function scoreAndRank(results, queryText, settings) {
    if (!Array.isArray(results) || results.length === 0) return [];

    const rag = settings?.rag || settings || {};
    const method = rag.scoringMethod || 'keyword';

    let scored;
    if (method === 'bm25') {
        scored = bm25Score(results, queryText);
    } else if (method === 'hybrid') {
        scored = runClientHybridFusion(results, queryText, rag);
        scored = keywordBoost(scored, queryText);
    } else {
        scored = keywordBoost(results, queryText);
    }

    scored = sortByScore(scored);

    console.debug(`${LOG_PREFIX} scoreAndRank complete`, {
        method,
        count: scored.length,
    });

    return scored;
}
