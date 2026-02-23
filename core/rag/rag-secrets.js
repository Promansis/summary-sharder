/**
 * Secure secret helpers for RAG embedding API keys.
 * Uses SillyTavern's secrets endpoints and stores only secret IDs in settings.
 */

import { getRequestHeaders } from '../../../../../../script.js';

const SECRET_KEY = 'api_key_custom';
const EMBEDDING_LABEL = 'Summary Sharder: RAG Embedding Key';

/**
 * @param {string} secretId
 * @returns {Promise<string|null>}
 */
async function findSecretById(secretId) {
    if (!secretId) return null;

    try {
        const response = await fetch('/api/secrets/find', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key: SECRET_KEY, id: secretId }),
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data?.value || null;
    } catch (error) {
        console.warn('[SummarySharder:RAG] Failed to read embedding secret:', error?.message || error);
        return null;
    }
}

/**
 * @param {string} value
 * @returns {Promise<string|null>}
 */
async function writeSecret(value, label = EMBEDDING_LABEL) {
    try {
        const response = await fetch('/api/secrets/write', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                key: SECRET_KEY,
                value,
                label,
            }),
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data?.id || null;
    } catch (error) {
        console.warn('[SummarySharder:RAG] Failed to write embedding secret:', error?.message || error);
        return null;
    }
}

/**
 * @param {string} secretId
 * @returns {Promise<boolean>}
 */
async function deleteSecret(secretId) {
    if (!secretId) return true;

    try {
        const response = await fetch('/api/secrets/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key: SECRET_KEY, id: secretId }),
        });
        return response.ok;
    } catch (error) {
        console.warn('[SummarySharder:RAG] Failed to delete embedding secret:', error?.message || error);
        return false;
    }
}

/**
 * Get active secret ID for the shared custom slot.
 * @returns {Promise<string|null>}
 */
async function getActiveCustomSecretId() {
    try {
        const response = await fetch('/api/secrets/read', {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        if (!response.ok) return null;
        const state = await response.json();
        const secrets = state?.[SECRET_KEY];
        if (!Array.isArray(secrets) || secrets.length === 0) return null;
        const active = secrets.find(s => s?.active === true);
        return active?.id || null;
    } catch (error) {
        console.warn('[SummarySharder:RAG] Failed to read active custom secret ID:', error?.message || error);
        return null;
    }
}

/**
 * Restore active secret ID in the shared custom slot.
 * @param {string|null} secretId
 * @returns {Promise<boolean>}
 */
async function restoreActiveCustomSecret(secretId) {
    if (!secretId) return true;
    try {
        const response = await fetch('/api/secrets/rotate', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key: SECRET_KEY, id: secretId }),
        });
        return response.ok;
    } catch (error) {
        console.warn('[SummarySharder:RAG] Failed to restore active custom secret:', error?.message || error);
        return false;
    }
}

/**
 * Store or replace the RAG embedding API key securely.
 * @param {Object} settings
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
export async function storeRagEmbeddingApiKey(settings, apiKey) {
    const value = String(apiKey || '').trim();
    if (!value) return false;

    if (!settings.rag) settings.rag = {};
    const currentId = settings.rag.embeddingSecretId || null;

    // Skip write if same value already stored.
    if (currentId) {
        const current = await findSecretById(currentId);
        if (current === value) {
            return true;
        }
    }

    // Preserve currently active custom key to avoid hijacking ST's Custom API key slot.
    const previousActiveId = await getActiveCustomSecretId();
    const newId = await writeSecret(value);
    if (!newId) {
        return false;
    }
    if (previousActiveId && previousActiveId !== newId) {
        await restoreActiveCustomSecret(previousActiveId);
    }

    settings.rag.embeddingSecretId = newId;

    // Best-effort cleanup for old secret if no other config references it.
    if (currentId && currentId !== newId) {
        const oldStillUsedBySavedApis = Array.isArray(settings.savedApiConfigs)
            && settings.savedApiConfigs.some(c => c?.secretId === currentId);
        if (!oldStillUsedBySavedApis) {
            await deleteSecret(currentId);
        }
    }

    return true;
}

/**
 * Remove stored embedding API key from secrets and settings.
 * @param {Object} settings
 * @returns {Promise<boolean>}
 */
export async function clearRagEmbeddingApiKey(settings) {
    const currentId = settings?.rag?.embeddingSecretId || null;
    if (!currentId) {
        if (settings?.rag) settings.rag.embeddingSecretId = null;
        return true;
    }

    const deleted = await deleteSecret(currentId);
    if (settings?.rag) settings.rag.embeddingSecretId = null;
    return deleted;
}

/**
 * Check whether a valid embedding secret currently exists.
 * @param {Object} settings
 * @returns {Promise<boolean>}
 */
export async function hasRagEmbeddingApiKey(settings) {
    const currentId = settings?.rag?.embeddingSecretId || null;
    if (!currentId) return false;
    const value = await findSecretById(currentId);
    return !!value;
}

/**
 * Resolve embedding API key for runtime requests from rag settings.
 * @param {Object} ragSettings
 * @returns {Promise<string>}
 */
export async function resolveRagEmbeddingApiKey(ragSettings) {
    const secretId = ragSettings?.embeddingSecretId || null;
    if (!secretId) return '';
    const value = await findSecretById(secretId);
    return value || '';
}

// ---------------------------------------------------------------------------
// Re-ranker API key helpers (mirrors embedding key pattern)
// ---------------------------------------------------------------------------

const RERANKER_LABEL = 'Summary Sharder: RAG Re-ranker Key';

/**
 * Store or replace the RAG re-ranker API key securely.
 * @param {Object} settings
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
export async function storeRagRerankerApiKey(settings, apiKey) {
    const value = String(apiKey || '').trim();
    if (!value) return false;

    if (!settings.rag) settings.rag = {};
    if (!settings.rag.reranker) settings.rag.reranker = {};
    const currentId = settings.rag.reranker.secretId || null;

    if (currentId) {
        const current = await findSecretById(currentId);
        if (current === value) return true;
    }

    const previousActiveId = await getActiveCustomSecretId();
    const newId = await writeSecret(value, RERANKER_LABEL);
    if (!newId) return false;
    if (previousActiveId && previousActiveId !== newId) {
        await restoreActiveCustomSecret(previousActiveId);
    }

    settings.rag.reranker.secretId = newId;

    if (currentId && currentId !== newId) {
        const oldStillUsedBySavedApis = Array.isArray(settings.savedApiConfigs)
            && settings.savedApiConfigs.some(c => c?.secretId === currentId);
        if (!oldStillUsedBySavedApis) {
            await deleteSecret(currentId);
        }
    }

    return true;
}

/**
 * Remove stored re-ranker API key from secrets and settings.
 * @param {Object} settings
 * @returns {Promise<boolean>}
 */
export async function clearRagRerankerApiKey(settings) {
    const currentId = settings?.rag?.reranker?.secretId || null;
    if (!currentId) {
        if (settings?.rag?.reranker) settings.rag.reranker.secretId = null;
        return true;
    }

    const deleted = await deleteSecret(currentId);
    if (settings?.rag?.reranker) settings.rag.reranker.secretId = null;
    return deleted;
}

/**
 * Check whether a valid re-ranker secret currently exists.
 * @param {Object} settings
 * @returns {Promise<boolean>}
 */
export async function hasRagRerankerApiKey(settings) {
    const currentId = settings?.rag?.reranker?.secretId || null;
    if (!currentId) return false;
    const value = await findSecretById(currentId);
    return !!value;
}

/**
 * Resolve re-ranker API key for runtime requests from rag settings.
 * @param {Object} ragSettings
 * @returns {Promise<string>}
 */
export async function resolveRagRerankerApiKey(ragSettings) {
    const secretId = ragSettings?.reranker?.secretId || null;
    if (!secretId) return '';
    const value = await findSecretById(secretId);
    return value || '';
}
