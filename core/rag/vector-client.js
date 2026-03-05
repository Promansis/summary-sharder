/**
 * Vector Client - Similharity plugin REST API wrapper
 * All vector operations go through the plugin's unified API.
 * The plugin handles embedding generation, backend abstraction, and storage.
 */

import { getRequestHeaders } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { resolveRagEmbeddingApiKey } from './rag-secrets.js';
import { getAbortSignal, throwIfAborted } from '../api/abort-controller.js';
import { ragLog } from '../logger.js';

const PLUGIN_BASE = '/api/plugins/similharity';
const QDRANT_DIMENSION_HINTS = [
    'dimension',
    'dimensions',
    'vector size',
    'expected',
    'got',
    'mismatch',
    'wrong vector',
    'invalid vector',
];

/**
 * Plugin fetch error with endpoint + payload context.
 */
class PluginRequestError extends Error {
    /**
     * @param {{ status: number, endpoint: string, message: string, raw: string }} options
     */
    constructor(options) {
        super(options.message);
        this.name = 'PluginRequestError';
        this.status = Number(options.status) || 0;
        this.endpoint = String(options.endpoint || '');
        this.raw = String(options.raw || '');
        this.kind = 'plugin-request-failed';
    }
}

/**
 * @param {number} status
 * @param {string} endpoint
 * @param {string} rawText
 * @returns {PluginRequestError}
 */
function buildPluginRequestError(status, endpoint, rawText = '') {
    const raw = String(rawText || '').trim();
    let details = raw;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            details = String(
                parsed.error
                ?? parsed.message
                ?? parsed.details
                ?? raw
            ).trim();
        }
    } catch {
        // Ignore JSON parsing errors; raw text is still useful.
    }

    return new PluginRequestError({
        status,
        endpoint,
        raw,
        message: `Plugin error (${status}) [${endpoint}]: ${details || 'Request failed'}`,
    });
}

/**
 * @param {any} error
 * @returns {boolean}
 */
export function isQdrantDimensionMismatchError(error) {
    const haystack = [
        String(error?.message || ''),
        String(error?.raw || ''),
    ].join('\n').toLowerCase();

    if (!haystack) return false;
    return QDRANT_DIMENSION_HINTS.some(hint => haystack.includes(hint));
}

/**
 * @returns {string}
 */
export function getQdrantDimensionMismatchToastMessage() {
    return 'RAG insert failed: Qdrant vector dimensions do not match this collection. Revectorize the collection using your current RAG settings (RAG Browser -> Revectorize Collection).';
}

/**
 * @param {any} error
 * @param {Object|null} ragSettings
 * @returns {'qdrant-dimension-mismatch'|'plugin-insert-failed'}
 */
export function classifyInsertError(error, ragSettings = null) {
    const backend = String(ragSettings?.backend || '').toLowerCase();
    if (backend === 'qdrant' && isQdrantDimensionMismatchError(error)) {
        return 'qdrant-dimension-mismatch';
    }
    return 'plugin-insert-failed';
}

/**
 * Sources that are always direct (never proxy through Similharity).
 */
const ALWAYS_DIRECT_SOURCES = new Set(['custom', 'linkapi']);

/**
 * OpenAI-compatible sources that CAN go direct when the user provides
 * their own apiUrl or apiKey (the Similharity plugin ignores overrides
 * for these sources, so direct is the only way user config takes effect).
 */
const OPENAI_COMPATIBLE_SOURCES = new Set(['openai', 'openrouter', 'togetherai', 'mistral', 'electronhub']);

/**
 * Default base URLs for sources that support direct mode.
 * Used as fallback when the user hasn't set a custom apiUrl.
 */
const DIRECT_SOURCE_DEFAULT_URLS = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    linkapi: 'https://api.linkapi.ai/v1',
    togetherai: 'https://api.together.xyz/v1',
    mistral: 'https://api.mistral.ai/v1',
    electronhub: 'https://api.electronhub.ai/v1',
};

/**
 * Check whether direct embedding mode is active.
 * Direct mode is used when:
 *  - source is 'custom' or 'linkapi' (always direct), OR
 *  - source is an OpenAI-compatible provider AND the user has set an apiUrl or apiKey
 *    (the plugin ignores overrides for these, so we must call the API directly).
 * @param {Object} ragSettings
 * @returns {boolean}
 */
function isDirectEmbeddingMode(ragSettings) {
    const source = String(ragSettings?.source || '').toLowerCase();
    if (ALWAYS_DIRECT_SOURCES.has(source)) return true;
    if (OPENAI_COMPATIBLE_SOURCES.has(source)) {
        const hasUrl = !!String(ragSettings?.apiUrl || '').trim();
        const hasKey = !!ragSettings?.embeddingSecretId;
        return hasUrl || hasKey;
    }
    return false;
}

/**
 * Call an external OpenAI-compatible embedding API directly from the browser.
 * Returns an array of embedding vectors (one per input text).
 * @param {string[]} texts - Input texts to embed
 * @param {Object} ragSettings - RAG settings containing apiUrl, model, etc.
 * @param {string} [apiKeyOverride=''] - Optional runtime API key override
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
async function fetchDirectEmbedding(texts, ragSettings, apiKeyOverride = '') {
    const source = String(ragSettings?.source || '').toLowerCase();
    const apiUrl = String(ragSettings?.apiUrl || '').trim()
        || DIRECT_SOURCE_DEFAULT_URLS[source]
        || '';
    if (!apiUrl) throw new Error('Direct embedding: API URL is missing');

    const apiKey = apiKeyOverride || await resolveRagEmbeddingApiKey(ragSettings);
    const model = String(ragSettings?.model || '').trim();

    // Build OpenAI-compatible /v1/embeddings request
    const url = apiUrl.endsWith('/embeddings') ? apiUrl
        : apiUrl.replace(/\/+$/, '') + '/embeddings';

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const body = { input: texts };
    if (model) body.model = model;

    const signal = getAbortSignal();
    throwIfAborted('rag embedding');
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Direct embedding failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    // OpenAI format: { data: [{ embedding: [...], index: 0 }, ...] }
    if (!Array.isArray(data?.data)) {
        throw new Error('Direct embedding: unexpected response format');
    }
    data.data.sort((a, b) => a.index - b.index);
    return data.data.map(d => d.embedding);
}

function fnv1a32(input, seed = 2166136261) {
    let hash = seed >>> 0;
    const str = String(input || '');
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/**
 * Force a Qdrant-compatible numeric point id.
 * @param {any} hash
 * @param {string} fallbackIdentity
 * @returns {number}
 */
function toQdrantPointId(hash, fallbackIdentity = '') {
    if (typeof hash === 'number' && Number.isFinite(hash) && hash > 0) {
        return Math.floor(hash);
    }

    const raw = String(hash ?? '').trim();
    if (/^\d+$/.test(raw)) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.floor(parsed);
        }
    }

    const h1 = fnv1a32(`qdrant|a|${raw}|${fallbackIdentity}`);
    const h2 = fnv1a32(`qdrant|b|${raw}|${fallbackIdentity}`);
    const hi21 = h1 & 0x001fffff;
    const id = (hi21 * 4294967296) + h2;
    return id > 0 ? id : 1;
}

/**
 * Map UI source names to plugin-compatible source names.
 * LinkAPI is OpenAI-compatible, so we map it to 'openai' for the plugin.
 * @param {string} source - Source from ragSettings
 * @returns {string} Plugin-compatible source name
 */
function mapSourceForPlugin(source) {
    const normalized = String(source || 'transformers').toLowerCase();
    // Both 'custom' and 'linkapi' are OpenAI-compatible; map to 'openai' for the plugin
    return (normalized === 'linkapi' || normalized === 'custom') ? 'openai' : normalized;
}

/**
 * @param {Object} ragSettings
 * @param {string} embeddingApiKey
 * @returns {Object}
 */
function getProviderRequestParams(ragSettings, embeddingApiKey = '') {
    const source = String(ragSettings?.source || 'transformers');
    const params = {};

    // All provider configuration comes from RAG settings only
    // No fallback to vectors extension to keep RAG self-contained

    if (source === 'transformers') {
        const apiUrl = String(ragSettings?.apiUrl || '').trim();
        if (apiUrl) {
            params.apiUrl = apiUrl;
        }
    }

    if (source === 'bananabread') {
        const apiUrl = String(ragSettings?.apiUrl || '').trim();
        if (apiUrl) {
            params.apiUrl = apiUrl;
        }
        if (embeddingApiKey) {
            params.apiKey = embeddingApiKey;
        }
    }

    if (source === 'ollama') {
        const apiUrl = String(ragSettings?.apiUrl || '').trim();
        if (apiUrl) {
            params.apiUrl = apiUrl;
        }
    }

    if (source === 'llamacpp' || source === 'vllm' || source === 'koboldcpp') {
        const apiUrl = String(ragSettings?.apiUrl || '').trim();
        if (apiUrl) {
            params.apiUrl = apiUrl;
        }
    }

    if (source === 'openai' || source === 'togetherai' || source === 'mistral' || source === 'electronhub' || source === 'openrouter' || source === 'linkapi') {
        const apiUrl = String(ragSettings?.apiUrl || '').trim();
        if (apiUrl) params.apiUrl = apiUrl;
        if (embeddingApiKey) params.apiKey = embeddingApiKey;
    }

    if (source === 'extras') {
        const apiUrl = String(ragSettings?.apiUrl || '').trim();
        if (apiUrl) {
            params.extrasUrl = apiUrl;
        }
        if (embeddingApiKey) {
            params.extrasKey = embeddingApiKey;
        }
    }

    return params;
}

/**
 * Build the common request body fields from RAG settings
 * @param {string} collectionId - Collection identifier
 * @param {Object} ragSettings - The settings.rag object
 * @param {Object} [extra={}] - Additional fields to merge
 * @returns {Object} Request body with backend, collectionId, source, model + extra
 */
async function buildRequestBody(collectionId, ragSettings, extra = {}) {
    const embeddingApiKey = await resolveRagEmbeddingApiKey(ragSettings);
    const providerParams = getProviderRequestParams(ragSettings, embeddingApiKey);

    return {
        backend: ragSettings.backend || 'vectra',
        collectionId,
        source: mapSourceForPlugin(ragSettings.source),
        model: ragSettings.model || '',
        ...(embeddingApiKey ? { embeddingApiKey } : {}),
        ...providerParams,
        ...extra,
    };
}

/**
 * Make an authenticated request to the Similharity plugin
 * @param {string} endpoint - Path relative to plugin base (e.g. '/chunks/insert')
 * @param {Object} [options={}] - Fetch options override
 * @returns {Promise<Object>} Parsed JSON response
 */
async function pluginFetch(endpoint, options = {}) {
    const url = `${PLUGIN_BASE}${endpoint}`;
    const {
        method = 'GET',
        body,
        signal: optionSignal,
        ...rest
    } = options || {};
    const signal = optionSignal ?? getAbortSignal();
    throwIfAborted('rag request');
    const response = await fetch(url, {
        method,
        headers: getRequestHeaders(),
        ...rest,
        ...(body ? { body: JSON.stringify(body) } : {}),
        ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw buildPluginRequestError(response.status, endpoint, errorText);
    }

    return response.json();
}

/**
 * Check if the Similharity plugin is available and healthy
 * @returns {Promise<{available: boolean, backends: string[], version: string}>}
 */
export async function checkPluginAvailability() {
    try {
        const data = await pluginFetch('/health');
        return {
            available: data.status === 'ok',
            backends: data.backends || [],
            version: data.version || 'unknown',
        };
    } catch (error) {
        ragLog.warn('Plugin not available:', error.message);
        return { available: false, backends: [], version: '' };
    }
}

/**
 * Check health of a specific backend
 * @param {string} backend - Backend name ('vectra'|'lancedb'|'qdrant'|'milvus')
 * @returns {Promise<{healthy: boolean, message: string}>}
 */
export async function checkBackendHealth(backend) {
    try {
        const data = await pluginFetch(`/backend/health/${backend}`);
        return {
            healthy: data.healthy ?? false,
            message: data.message || '',
        };
    } catch (error) {
        return { healthy: false, message: error.message };
    }
}

/**
 * Initialize a remote backend (Qdrant/Milvus) with connection details
 * @param {string} backend - Backend name
 * @param {Object} config - Connection config (host, port, apiKey, url, etc.)
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function initBackend(backend, config) {
    const data = await pluginFetch(`/backend/init/${backend}`, {
        method: 'POST',
        body: config,
    });
    return { success: data.success ?? false, message: data.message || '' };
}

/**
 * Insert chunks into a collection (plugin auto-embeds if no vector provided)
 * @param {string} collectionId - Collection identifier
 * @param {Array<{hash: string|number, text: string, index: number, metadata?: Object}>} items
 * @param {Object} ragSettings - The settings.rag object
 * @returns {Promise<{success: boolean, inserted: number}>}
 */
export async function insertChunks(collectionId, items, ragSettings) {
    let safeItems = (ragSettings?.backend === 'qdrant')
        ? (items || []).map(item => {
            const fallbackIdentity = `${item?.index ?? 0}|${String(item?.text || '')}`;
            return {
                ...item,
                hash: toQdrantPointId(item?.hash, fallbackIdentity),
            };
        })
        : (items || []);

    const isDirect = isDirectEmbeddingMode(ragSettings);

    if (isDirect) {
        const texts = safeItems.map(item => String(item.text || ''));

        try {
            const vectors = await fetchDirectEmbedding(texts, ragSettings);
            safeItems = safeItems.map((item, i) => ({ ...item, vector: vectors[i] }));
        } catch (error) {
            console.error('[Vector Client] Embedding fetch failed:', error);
            throw new Error(`Failed to fetch embeddings: ${error?.message || error}`);
        }
    }

    try {
        const body = await buildRequestBody(collectionId, ragSettings, { items: safeItems });
        const data = await pluginFetch('/chunks/insert', {
            method: 'POST',
            body,
        });

        return { success: data.success ?? false, inserted: data.inserted ?? 0 };
    } catch (error) {
        const wrapped = error instanceof Error ? error : new Error(String(error));
        wrapped.kind = classifyInsertError(wrapped, ragSettings);
        throw wrapped;
    }
}

/**
 * Query chunks by semantic similarity
 * @param {string} collectionId - Collection identifier
 * @param {string} searchText - Text to search for (plugin auto-embeds)
 * @param {number} topK - Number of results to return
 * @param {number} threshold - Minimum similarity score (0-1)
 * @param {Object} ragSettings - The settings.rag object
 * @returns {Promise<{results: Array<{hash: string, text: string, score: number, metadata: Object}>}>}
 */
export async function queryChunks(collectionId, searchText, topK, threshold, ragSettings) {
    const extra = { topK, threshold };

    if (isDirectEmbeddingMode(ragSettings)) {
        const [vector] = await fetchDirectEmbedding([searchText], ragSettings);
        extra.queryVector = vector;
    } else {
        extra.searchText = searchText;
    }

    const body = await buildRequestBody(collectionId, ragSettings, extra);
    const data = await pluginFetch('/chunks/query', {
        method: 'POST',
        body,
    });
    return { results: data.results || [] };
}

/**
 * Hybrid query combining vector similarity + keyword search (Qdrant/Milvus only)
 * @param {string} collectionId - Collection identifier
 * @param {string} searchText - Text to search for
 * @param {number} topK - Number of results to return
 * @param {number} threshold - Minimum similarity score
 * @param {Object} ragSettings - The settings.rag object
 * @param {Object} [hybridOptions] - Optional hybrid search tuning
 * @returns {Promise<{results: Array}>}
 */
export async function hybridQuery(collectionId, searchText, topK, threshold, ragSettings, hybridOptions) {
    const extra = { topK, threshold };

    if (isDirectEmbeddingMode(ragSettings)) {
        const [vector] = await fetchDirectEmbedding([searchText], ragSettings);
        extra.queryVector = vector;
    } else {
        extra.searchText = searchText;
    }

    if (hybridOptions) {
        extra.hybridOptions = hybridOptions;
    }
    // searchText is still needed for BM25 keyword component of hybrid search
    extra.searchText = searchText;

    const body = await buildRequestBody(collectionId, ragSettings, extra);
    const data = await pluginFetch('/chunks/hybrid-query', {
        method: 'POST',
        body,
    });
    return { results: data.results || [] };
}

/**
 * List chunks in a collection
 * @param {string} collectionId - Collection identifier
 * @param {Object} ragSettings - The settings.rag object
 * @param {Object} [options={}] - Pagination options {offset, limit, includeVectors}
 * @returns {Promise<{items: Array, total: number, hasMore: boolean}>}
 */
export async function listChunks(collectionId, ragSettings, options = {}) {
    const body = await buildRequestBody(collectionId, ragSettings, {
        offset: options.offset ?? 0,
        limit: options.limit ?? 100,
        includeVectors: options.includeVectors ?? false,
        filter: options.filter ?? undefined,
        metadataFilter: options.metadataFilter ?? undefined,
        indexRange: options.indexRange ?? undefined,
    });
    const data = await pluginFetch('/chunks/list', {
        method: 'POST',
        body,
    });

    // The Similharity plugin has returned different response shapes across versions/backends.
    // Normalize here so the UI doesn't depend on one exact schema.
    const items = data?.items ?? data?.chunks ?? data?.results ?? [];
    const total = data?.total
        ?? data?.chunkCount
        ?? data?.chunk_count
        ?? data?.totalChunks
        ?? data?.total_chunks
        ?? data?.totalItems
        ?? data?.total_items
        ?? data?.count
        ?? data?.totalCount
        ?? data?.total_count
        ?? data?.pagination?.total
        ?? data?.pagination?.count
        ?? data?.stats?.count
        ?? data?.stats?.total
        ?? 0;
    const hasMore = data?.hasMore ?? data?.has_more ?? data?.more ?? false;

    return {
        items: Array.isArray(items) ? items : [],
        total: Number(total || 0) || 0,
        hasMore: !!hasMore,
    };
}

/**
 * Delete chunks by hash
 * @param {string} collectionId - Collection identifier
 * @param {Array<string|number>} hashes - Chunk hashes to delete
 * @param {Object} ragSettings - The settings.rag object
 * @returns {Promise<{success: boolean, deleted: number}>}
 */
export async function deleteChunks(collectionId, hashes, ragSettings) {
    const safeHashes = (ragSettings?.backend === 'qdrant')
        ? (hashes || []).map(hash => toQdrantPointId(hash, String(hash ?? '')))
        : hashes;

    const body = await buildRequestBody(collectionId, ragSettings, { hashes: safeHashes });
    const data = await pluginFetch('/chunks/delete', {
        method: 'POST',
        body,
    });

    return { success: data.success ?? false, deleted: data.deleted ?? 0 };
}

/**
 * Purge an entire collection
 * @param {string} collectionId - Collection identifier
 * @param {Object} ragSettings - The settings.rag object
 * @returns {Promise<{success: boolean}>}
 */
export async function purgeCollection(collectionId, ragSettings) {
    const body = await buildRequestBody(collectionId, ragSettings);
    const data = await pluginFetch('/chunks/purge', {
        method: 'POST',
        body,
    });
    return { success: data.success ?? false };
}

/**
 * Get collection statistics
 * @param {string} collectionId - Collection identifier
 * @param {Object} ragSettings - The settings.rag object
 * @returns {Promise<{stats: Object}>}
 */
export async function getCollectionStats(collectionId, ragSettings) {
    const body = await buildRequestBody(collectionId, ragSettings);
    const data = await pluginFetch('/chunks/stats', {
        method: 'POST',
        body,
    });
    const nestedStats = (data && typeof data.stats === 'object' && data.stats) ? data.stats : {};
    const resolvedCount = Number(
        nestedStats.count
        ?? nestedStats.total
        ?? data?.count
        ?? data?.total
        ?? 0
    ) || 0;

    return {
        stats: {
            ...nestedStats,
            count: resolvedCount,
            total: Number(nestedStats.total ?? resolvedCount) || 0,
        },
    };
}

/**
 * Get available embedding sources from the plugin
 * @returns {Promise<{sources: string[]}>}
 */
export async function getEmbeddingSources() {
    try {
        const data = await pluginFetch('/sources');
        return { sources: data.sources || [] };
    } catch (error) {
        ragLog.warn('Failed to get embedding sources:', error.message);
        return { sources: [] };
    }
}

/**
 * List all collections available in the current backend/plugin context.
 * @param {string} [backend=''] - Optional backend filter ('vectra'|'lancedb'|'qdrant'|'milvus'). Omit to use plugin default.
 * @returns {Promise<Array<{id: string, source: string, backend: string, chunkCount: number, modelCount: number, model?: string}>>}
 */
export async function listAllCollections(backend = '') {
    const url = backend
        ? `${PLUGIN_BASE}/collections?backend=${encodeURIComponent(backend)}`
        : `${PLUGIN_BASE}/collections`;
    const resp = await fetch(url, {
        method: 'GET',
        headers: getRequestHeaders(),
    });
    if (!resp.ok) throw new Error(`Collections list failed: ${resp.status}`);
    const data = await resp.json();
    return Array.isArray(data?.collections) ? data.collections : [];
}

/**
 * Test embedding connectivity for the configured source/model without vector DB writes.
 * @param {Object} ragSettings - The settings.rag object
 * @param {string} [text='connection test'] - Probe text
 * @param {{ apiKeyOverride?: string }} [options={}] - Optional runtime API key override
 * @returns {Promise<{success: boolean, dimensions: number}>}
 */
export async function testEmbeddingConnection(
    ragSettings,
    text = 'Summary Sharder embedding connection test',
    options = {},
) {
    if (isDirectEmbeddingMode(ragSettings)) {
        const overrideApiKey = String(options?.apiKeyOverride || '').trim();
        const vectors = await fetchDirectEmbedding(
            [text],
            ragSettings,
            overrideApiKey,
        );
        const dimensions = Array.isArray(vectors?.[0]) ? vectors[0].length : 0;
        return { success: dimensions > 0, dimensions };
    }

    const overrideApiKey = String(options?.apiKeyOverride || '').trim();
    const embeddingApiKey = overrideApiKey || await resolveRagEmbeddingApiKey(ragSettings);
    const providerParams = getProviderRequestParams(ragSettings, embeddingApiKey);

    const data = await pluginFetch('/get-embedding', {
        method: 'POST',
        body: {
            source: mapSourceForPlugin(ragSettings.source),
            model: ragSettings.model || '',
            text,
            ...(embeddingApiKey ? { apiKey: embeddingApiKey } : {}),
            ...providerParams,
        },
    });

    const embedding = data?.embedding;
    const dimensions = Array.isArray(embedding) ? embedding.length : 0;

    return {
        success: !!(data?.success && dimensions > 0),
        dimensions,
    };
}
