/**
 * Vector Client - Similharity plugin REST API wrapper
 * All vector operations go through the plugin's unified API.
 * The plugin handles embedding generation, backend abstraction, and storage.
 */

import { getRequestHeaders } from '../../../../../../script.js';
import { extension_settings } from '../../../../../extensions.js';
import { resolveRagEmbeddingApiKey } from './rag-secrets.js';

const LOG_PREFIX = '[SummarySharder:RAG]';
const PLUGIN_BASE = '/api/plugins/similharity';

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
 * @param {Object} ragSettings
 * @param {string} embeddingApiKey
 * @returns {Object}
 */
function getProviderRequestParams(ragSettings, embeddingApiKey = '') {
    const source = String(ragSettings?.source || 'transformers');
    const vectors = extension_settings?.vectors || {};
    const provider = (vectors && typeof vectors[source] === 'object') ? vectors[source] : {};

    const pick = (...keys) => {
        for (const key of keys) {
            if (provider?.[key] !== undefined && provider?.[key] !== null && provider?.[key] !== '') {
                return provider[key];
            }
            if (vectors?.[key] !== undefined && vectors?.[key] !== null && vectors?.[key] !== '') {
                return vectors[key];
            }
            if (ragSettings?.[key] !== undefined && ragSettings?.[key] !== null && ragSettings?.[key] !== '') {
                return ragSettings[key];
            }
        }
        return '';
    };

    const params = {};

    if (source === 'bananabread') {
        const apiUrl = pick('apiUrl', 'api_url', 'url', 'endpointUrl');
        if (apiUrl) {
            params.apiUrl = apiUrl;
        }
        if (embeddingApiKey) {
            params.apiKey = embeddingApiKey;
        }
    }

    if (source === 'ollama') {
        const apiUrl = pick('apiUrl', 'api_url', 'url', 'endpointUrl');
        if (apiUrl) {
            params.apiUrl = apiUrl;
        }
        const keep = pick('keep', 'ollama_keep');
        if (keep !== '') {
            params.keep = !!keep;
        }
    }

    if (source === 'llamacpp' || source === 'vllm' || source === 'koboldcpp') {
        const apiUrl = pick('apiUrl', 'api_url', 'url', 'endpointUrl');
        if (apiUrl) {
            params.apiUrl = apiUrl;
        }
    }

    if (source === 'extras') {
        const extrasUrl = pick('extrasUrl', 'extras_url', 'apiUrl', 'url');
        if (extrasUrl) {
            params.extrasUrl = extrasUrl;
        }
        if (embeddingApiKey) {
            params.extrasKey = embeddingApiKey;
        } else {
            const extrasKey = pick('extrasKey', 'extras_key');
            if (extrasKey) {
                params.extrasKey = extrasKey;
            }
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
        source: ragSettings.source || 'transformers',
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
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: getRequestHeaders(),
        ...options,
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${LOG_PREFIX} Plugin error (${response.status}): ${errorText}`);
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
        console.warn(`${LOG_PREFIX} Plugin not available:`, error.message);
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
    const safeItems = (ragSettings?.backend === 'qdrant')
        ? (items || []).map(item => {
            const fallbackIdentity = `${item?.index ?? 0}|${String(item?.text || '')}`;
            return {
                ...item,
                hash: toQdrantPointId(item?.hash, fallbackIdentity),
            };
        })
        : items;

    const body = await buildRequestBody(collectionId, ragSettings, { items: safeItems });
    const data = await pluginFetch('/chunks/insert', {
        method: 'POST',
        body,
    });
    return { success: data.success ?? false, inserted: data.inserted ?? 0 };
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
    const body = await buildRequestBody(collectionId, ragSettings, {
        searchText,
        topK,
        threshold,
    });
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
    const extra = { searchText, topK, threshold };
    if (hybridOptions) {
        extra.hybridOptions = hybridOptions;
    }
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
    return {
        items: data.items || [],
        total: data.total ?? 0,
        hasMore: data.hasMore ?? false,
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
        console.warn(`${LOG_PREFIX} Failed to get embedding sources:`, error.message);
        return { sources: [] };
    }
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
    const overrideApiKey = String(options?.apiKeyOverride || '').trim();
    const embeddingApiKey = overrideApiKey || await resolveRagEmbeddingApiKey(ragSettings);
    const providerParams = getProviderRequestParams(ragSettings, embeddingApiKey);
    const data = await pluginFetch('/get-embedding', {
        method: 'POST',
        body: {
            source: ragSettings.source || 'transformers',
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
