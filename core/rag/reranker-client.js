import { getRequestHeaders } from '../../../../../../script.js';
import { resolveRagRerankerApiKey } from './rag-secrets.js';

const LOG_PREFIX = '[SummarySharder:RAG]';
const PLUGIN_RERANK_URL = '/api/plugins/similharity/rerank';

function summarize(value, max = 120) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function toScore(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function resolveScore(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return toScore(
        entry.score
        ?? entry.relevance_score
        ?? entry.relevanceScore
        ?? entry.similarity
        ?? entry.value,
    );
}

function resolveEntryIndex(entry, fallbackIndex, maxLength) {
    const candidates = [
        entry?.index,
        entry?.idx,
        entry?.documentIndex,
        entry?.document_index,
        entry?.position,
    ];

    for (const candidate of candidates) {
        const idx = Number(candidate);
        if (Number.isInteger(idx) && idx >= 0 && idx < maxLength) {
            return idx;
        }
    }

    if (Number.isInteger(fallbackIndex) && fallbackIndex >= 0 && fallbackIndex < maxLength) {
        return fallbackIndex;
    }

    return -1;
}

function extractScores(payload, expectedLength) {
    const scores = Array.from({ length: expectedLength }, () => null);

    const directScores = Array.isArray(payload?.scores) ? payload.scores : null;
    if (directScores) {
        const limit = Math.min(expectedLength, directScores.length);
        for (let i = 0; i < limit; i++) {
            const score = toScore(directScores[i]);
            if (score !== null) {
                scores[i] = score;
            }
        }
        return scores;
    }

    const entries = Array.isArray(payload?.results)
        ? payload.results
        : (Array.isArray(payload?.data) ? payload.data : []);

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const score = resolveScore(entry);
        if (score === null) continue;
        const idx = resolveEntryIndex(entry, i, expectedLength);
        if (idx < 0) continue;

        if (scores[idx] === null || score > scores[idx]) {
            scores[idx] = score;
        }
    }

    return scores;
}

function normalizeMode(ragSettings) {
    const mode = String(ragSettings?.reranker?.mode || '').trim().toLowerCase();
    return mode === 'direct' ? 'direct' : 'similharity';
}

function buildPassthroughResult(documents, mode, target, error = '') {
    return {
        success: false,
        mode,
        target,
        error: summarize(error),
        ranked: (documents || []).map((document, index) => ({
            index,
            document,
            score: null,
        })),
    };
}

/**
 * Re-rank document strings using configured re-ranker provider.
 * @param {string} query
 * @param {Array<string>} documents
 * @param {Object} ragSettings
 * @param {Object} [options={}]
 * @returns {Promise<{success: boolean, mode: string, target: string, error: string, ranked: Array<{index:number,document:string,score:number|null}>}>}
 */
export async function rerankDocuments(query, documents, ragSettings, options = {}) {
    const safeQuery = String(query || '').trim();
    const safeDocs = Array.isArray(documents)
        ? documents.map(document => String(document || ''))
        : [];
    const reranker = ragSettings?.reranker || {};
    const mode = normalizeMode(ragSettings);
    const apiUrl = String(reranker.apiUrl || '').trim();
    const target = mode === 'similharity' ? PLUGIN_RERANK_URL : apiUrl;

    if (!reranker.enabled || !safeQuery || safeDocs.length === 0) {
        return {
            success: true,
            mode,
            target,
            error: '',
            ranked: safeDocs.map((document, index) => ({ index, document, score: null })),
        };
    }

    if (!apiUrl) {
        return buildPassthroughResult(safeDocs, mode, target, 'Missing re-ranker API URL');
    }

    const topK = Math.max(1, Math.min(safeDocs.length, Number(options.topK) || safeDocs.length));
    const model = String(reranker.model || '').trim();
    const overrideApiKey = String(options?.apiKeyOverride || '').trim();
    const apiKey = overrideApiKey || await resolveRagRerankerApiKey(ragSettings);

    try {
        const requestBody = {
            query: safeQuery,
            documents: safeDocs,
            top_k: topK,
            model,
        };

        let response;
        if (mode === 'direct') {
            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) {
                headers.Authorization = `Bearer ${apiKey}`;
            }
            // Normalize URL: append /rerank if not already present
            const directUrl = apiUrl.endsWith('/rerank') ? apiUrl
                : apiUrl.replace(/\/+$/, '') + '/rerank';
            response = await fetch(directUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
            });
        } else {
            response = await fetch(PLUGIN_RERANK_URL, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    ...requestBody,
                    apiUrl,
                    ...(apiKey ? { apiKey } : {}),
                }),
            });
        }

        const rawText = await response.text();
        if (!response.ok) {
            return buildPassthroughResult(
                safeDocs,
                mode,
                target,
                `HTTP ${response.status}${rawText ? `: ${rawText}` : ''}`,
            );
        }

        let payload = {};
        try {
            payload = rawText ? JSON.parse(rawText) : {};
        } catch (_error) {
            payload = {};
        }

        const scores = extractScores(payload, safeDocs.length);
        const scored = [];
        const unscored = [];

        for (let i = 0; i < safeDocs.length; i++) {
            const entry = {
                index: i,
                document: safeDocs[i],
                score: toScore(scores[i]),
            };
            if (entry.score === null) {
                unscored.push(entry);
            } else {
                scored.push(entry);
            }
        }

        scored.sort((a, b) => {
            const delta = (b.score ?? 0) - (a.score ?? 0);
            if (delta !== 0) return delta;
            return a.index - b.index;
        });

        return {
            success: true,
            mode,
            target,
            error: '',
            ranked: [...scored, ...unscored],
        };
    } catch (error) {
        console.warn(`${LOG_PREFIX} Re-ranker request failed:`, error?.message || error);
        return buildPassthroughResult(safeDocs, mode, target, error?.message || String(error));
    }
}

/**
 * @param {Object} ragSettings
 * @returns {Promise<{enabled: boolean, healthy: boolean, statusText: string}>}
 */
export async function checkRerankerHealth(ragSettings) {
    const reranker = ragSettings?.reranker || {};
    const enabled = !!reranker.enabled;
    const mode = normalizeMode(ragSettings);
    const modeText = mode === 'direct' ? 'direct' : 'similharity';
    const apiUrl = String(reranker.apiUrl || '').trim();
    const model = String(reranker.model || '').trim() || 'default';

    if (!enabled) {
        return {
            enabled: false,
            healthy: true,
            statusText: `Disabled - mode ${modeText}; model ${model}`,
        };
    }

    if (!apiUrl) {
        return {
            enabled: true,
            healthy: false,
            statusText: `Unhealthy - missing API URL; mode ${modeText}; model ${model}`,
        };
    }

    const result = await rerankDocuments(
        'health check',
        ['ping', 'pong'],
        ragSettings,
        { topK: 2 },
    );

    if (!result.success) {
        return {
            enabled: true,
            healthy: false,
            statusText: `Unhealthy - ${summarize(result.error || 'request failed')}; mode ${modeText}; model ${model}`,
        };
    }

    return {
        enabled: true,
        healthy: true,
        statusText: `Healthy - mode ${modeText}; model ${model}`,
    };
}

/**
 * Execute a quick explicit re-ranker connectivity test.
 * @param {Object} ragSettings
 * @param {{ apiKeyOverride?: string }} [options={}] - Optional runtime API key override
 * @returns {Promise<{success: boolean, mode: string, target: string, message: string}>}
 */
export async function testRerankerConnection(ragSettings, options = {}) {
    const reranker = ragSettings?.reranker || {};
    const mode = normalizeMode(ragSettings);
    const modeText = mode === 'direct' ? 'direct' : 'similharity';
    const target = mode === 'direct'
        ? String(reranker.apiUrl || '').trim()
        : PLUGIN_RERANK_URL;

    if (!reranker.enabled) {
        return {
            success: false,
            mode,
            target,
            message: 'Re-ranker is disabled.',
        };
    }

    if (!String(reranker.apiUrl || '').trim()) {
        return {
            success: false,
            mode,
            target,
            message: 'Re-ranker API URL is missing.',
        };
    }

    const result = await rerankDocuments(
        'connection test',
        ['alpha', 'beta'],
        ragSettings,
        {
            topK: 2,
            apiKeyOverride: options?.apiKeyOverride || '',
        },
    );

    if (!result.success) {
        return {
            success: false,
            mode,
            target,
            message: summarize(result.error || `Re-ranker request failed (${modeText})`),
        };
    }

    return {
        success: true,
        mode,
        target,
        message: `passed (${modeText})`,
    };
}
