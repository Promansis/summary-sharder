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
            const sectionType = String(item?.metadata?.sectionType || '');
            const entityKey = String(item?.metadata?.entityKey || '');
            if (!sectionType || !entityKey) {
                passthrough.push(item);
                continue;
            }

            const rollingKey = `${sectionType}|${entityKey}`;
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
    const lines = (results || []).map(item => cleanChunkText(String(item?.text || ''))).filter(Boolean);
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
            return chat;
        }

        if (abort?.aborted) {
            return chat;
        }

        const queryText = buildQueryText(chat, rag.queryCount);
        if (!queryText) {
            clearRagPromptInjection(rag);
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
        merged = dedupeAgainstRecentContext(merged, chat, rag.protectCount);
        merged = applyImportanceBoost(merged);

        const rerankMeta = await applyReranker(merged, queryText, rag);
        merged = rerankMeta.results;

        if (!rerankMeta.metadata?.applied) {
            merged.sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));
        }
        merged = merged.slice(0, Math.max(1, Number(rag.insertCount) || 5));

        // Scene grouping only applies to Sharder Mode
        merged = isSharder ? orderWithSceneGrouping(merged) : merged;

        const injection = formatInjectionText(rag.template, merged);
        applyInjection(injection, rag);

        console.log(`${LOG_PREFIX} Retrieval complete`, {
            mode: isSharder ? 'sharder' : 'standard',
            backend: rag.backend,
            useNativeHybrid,
            useClientHybrid,
            shardResults: shardResults.length,
            sceneExpanded: sceneExpanded.length,
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
