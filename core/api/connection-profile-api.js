/**
 * Connection-profile backed API calls via SillyTavern Connection Manager.
 */

import { ConnectionManagerRequestService } from '../../../../shared.js';
import { getRequestHeaders } from '../../../../../../script.js';
import { chat_completion_sources } from '../../../../../openai.js';
import { textgen_types } from '../../../../../textgen-settings.js';
import { SECRET_KEYS } from '../../../../../secrets.js';

const PROFILE_MODE_ERROR_HINT = 'Enable Connection Manager or switch the feature API mode.';
const MAX_ERROR_CHAIN_DEPTH = 8;
let secretRotationLock = Promise.resolve();

/**
 * Build the messages array based on the configured message format.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} messageFormat
 * @returns {Array<{role: string, content: string}>}
 */
function buildMessages(systemPrompt, userPrompt, messageFormat) {
    if (messageFormat === 'alternating') {
        return [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Process the following task according to the system instructions.' },
            { role: 'assistant', content: 'Understood. I will follow the instructions precisely.' },
            { role: 'user', content: userPrompt }
        ];
    }

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];
}

/**
 * Flatten nested Error.cause chains into readable messages.
 * @param {unknown} error
 * @returns {string}
 */
function getErrorDetails(error) {
    const messages = [];
    const seen = new Set();
    let current = error;
    let depth = 0;

    while (current && depth < MAX_ERROR_CHAIN_DEPTH && !seen.has(current)) {
        seen.add(current);
        depth += 1;

        if (typeof current === 'string') {
            const text = current.trim();
            if (text) messages.push(text);
            break;
        }

        if (typeof current === 'object') {
            const msg = String(current?.message || '').trim();
            if (msg) messages.push(msg);
            current = current?.cause;
            continue;
        }

        const fallback = String(current || '').trim();
        if (fallback) messages.push(fallback);
        break;
    }

    const filtered = messages.filter((msg, idx) => {
        if (!msg) return false;
        if (idx === 0) return true;
        // Drop repeated generic wrapper text to surface actionable backend details.
        return !/^api request failed$/i.test(msg) && msg !== messages[idx - 1];
    });

    return filtered.join(' -> ') || 'Unknown profile request error';
}

/**
 * @param {object} selectedApiMap
 * @returns {string|null}
 */
function resolveProfileSecretKey(selectedApiMap) {
    if (!selectedApiMap) return null;

    if (selectedApiMap.selected === 'openai') {
        switch (selectedApiMap.source) {
            case chat_completion_sources.OPENAI: return SECRET_KEYS.OPENAI;
            case chat_completion_sources.CLAUDE: return SECRET_KEYS.CLAUDE;
            case chat_completion_sources.OPENROUTER: return SECRET_KEYS.OPENROUTER;
            case chat_completion_sources.AI21: return SECRET_KEYS.AI21;
            case chat_completion_sources.MAKERSUITE: return SECRET_KEYS.MAKERSUITE;
            case chat_completion_sources.VERTEXAI: return SECRET_KEYS.VERTEXAI;
            case chat_completion_sources.MISTRALAI: return SECRET_KEYS.MISTRALAI;
            case chat_completion_sources.CUSTOM: return SECRET_KEYS.CUSTOM;
            case chat_completion_sources.COHERE: return SECRET_KEYS.COHERE;
            case chat_completion_sources.PERPLEXITY: return SECRET_KEYS.PERPLEXITY;
            case chat_completion_sources.GROQ: return SECRET_KEYS.GROQ;
            case chat_completion_sources.ELECTRONHUB: return SECRET_KEYS.ELECTRONHUB;
            case chat_completion_sources.CHUTES: return SECRET_KEYS.CHUTES;
            case chat_completion_sources.NANOGPT: return SECRET_KEYS.NANOGPT;
            case chat_completion_sources.DEEPSEEK: return SECRET_KEYS.DEEPSEEK;
            case chat_completion_sources.AIMLAPI: return SECRET_KEYS.AIMLAPI;
            case chat_completion_sources.XAI: return SECRET_KEYS.XAI;
            case chat_completion_sources.POLLINATIONS: return SECRET_KEYS.POLLINATIONS;
            case chat_completion_sources.MOONSHOT: return SECRET_KEYS.MOONSHOT;
            case chat_completion_sources.FIREWORKS: return SECRET_KEYS.FIREWORKS;
            case chat_completion_sources.COMETAPI: return SECRET_KEYS.COMETAPI;
            case chat_completion_sources.AZURE_OPENAI: return SECRET_KEYS.AZURE_OPENAI;
            case chat_completion_sources.ZAI: return SECRET_KEYS.ZAI;
            case chat_completion_sources.SILICONFLOW: return SECRET_KEYS.SILICONFLOW;
            default: return null;
        }
    }

    if (selectedApiMap.selected === 'textgenerationwebui') {
        switch (selectedApiMap.type) {
            case textgen_types.OOBA: return SECRET_KEYS.OOBA;
            case textgen_types.MANCER: return SECRET_KEYS.MANCER;
            case textgen_types.VLLM: return SECRET_KEYS.VLLM;
            case textgen_types.APHRODITE: return SECRET_KEYS.APHRODITE;
            case textgen_types.TABBY: return SECRET_KEYS.TABBY;
            case textgen_types.KOBOLDCPP: return SECRET_KEYS.KOBOLDCPP;
            case textgen_types.TOGETHERAI: return SECRET_KEYS.TOGETHERAI;
            case textgen_types.LLAMACPP: return SECRET_KEYS.LLAMACPP;
            case textgen_types.OLLAMA: return null;
            case textgen_types.INFERMATICAI: return SECRET_KEYS.INFERMATICAI;
            case textgen_types.DREAMGEN: return SECRET_KEYS.DREAMGEN;
            case textgen_types.OPENROUTER: return SECRET_KEYS.OPENROUTER;
            case textgen_types.FEATHERLESS: return SECRET_KEYS.FEATHERLESS;
            case textgen_types.HUGGINGFACE: return SECRET_KEYS.HUGGINGFACE;
            case textgen_types.GENERIC: return SECRET_KEYS.GENERIC;
            default: return null;
        }
    }

    return null;
}

/**
 * @returns {Promise<Object>}
 */
async function readSecretsStateRaw() {
    const response = await fetch('/api/secrets/read', {
        method: 'POST',
        headers: getRequestHeaders({ omitContentType: true }),
    });

    if (!response.ok) {
        throw new Error(`Could not read secrets state (${response.status})`);
    }

    return await response.json();
}

/**
 * @param {string} secretKey
 * @param {string} secretId
 * @returns {Promise<void>}
 */
async function rotateSecretRaw(secretKey, secretId) {
    const response = await fetch('/api/secrets/rotate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ key: secretKey, id: secretId }),
    });

    if (!response.ok) {
        throw new Error(`Could not rotate secret ${secretKey} to ${secretId} (${response.status})`);
    }
}

/**
 * Ensures profile-specific secret is active only for the request duration.
 * Restores previous active secret immediately after completion.
 * @param {Object} profile
 * @param {Object} selectedApiMap
 * @param {() => Promise<any>} run
 * @returns {Promise<any>}
 */
async function withProfileSecret(profile, selectedApiMap, run) {
    const requestedSecretId = String(profile?.['secret-id'] || '').trim();
    const secretKey = resolveProfileSecretKey(selectedApiMap);

    if (!requestedSecretId || !secretKey) {
        return await run();
    }

    const executeLocked = async () => {
        const state = await readSecretsStateRaw();
        const secrets = Array.isArray(state?.[secretKey]) ? state[secretKey] : [];
        if (secrets.length === 0) {
            throw new Error(`Profile secret key ${secretKey} has no configured secrets`);
        }

        const targetSecret = secrets.find(secret => secret?.id === requestedSecretId);
        if (!targetSecret) {
            throw new Error(`Profile secret ${requestedSecretId} is missing for key ${secretKey}`);
        }

        const activeSecret = secrets.find(secret => secret?.active);
        const activeSecretId = String(activeSecret?.id || '').trim() || null;
        const needsRotation = activeSecretId !== requestedSecretId;

        if (needsRotation) {
            await rotateSecretRaw(secretKey, requestedSecretId);
        }

        try {
            return await run();
        } finally {
            if (needsRotation && activeSecretId) {
                try {
                    await rotateSecretRaw(secretKey, activeSecretId);
                } catch (restoreError) {
                    console.error('[SummarySharder] Failed to restore previously active secret:', restoreError);
                }
            }
        }
    };

    const queued = secretRotationLock.then(executeLocked, executeLocked);
    secretRotationLock = queued.catch(() => {});
    return await queued;
}

/**
 * @returns {boolean}
 */
export function isConnectionManagerAvailable() {
    const context = SillyTavern?.getContext?.();
    if (!context?.extensionSettings) {
        return false;
    }

    if (context.extensionSettings.disabledExtensions?.includes('connection-manager')) {
        return false;
    }

    return typeof ConnectionManagerRequestService?.sendRequest === 'function';
}

/**
 * @returns {Array<{type: string, label: string, profiles: Array<{id: string, name: string}>}>}
 */
export function getConnectionProfiles() {
    if (!isConnectionManagerAvailable()) {
        return [];
    }

    try {
        const allowedTypes = ConnectionManagerRequestService.getAllowedTypes();
        const groupsByType = {};
        for (const [type, label] of Object.entries(allowedTypes)) {
            groupsByType[type] = { type, label, profiles: [] };
        }

        const profiles = ConnectionManagerRequestService.getSupportedProfiles();
        for (const profile of profiles) {
            let selectedType = null;
            try {
                selectedType = ConnectionManagerRequestService.validateProfile(profile)?.selected || null;
            } catch {
                continue;
            }
            const group = groupsByType[selectedType];
            if (!group) continue;

            group.profiles.push({
                id: profile.id,
                name: profile.name
            });
        }

        return Object.values(groupsByType)
            .map(group => ({
                ...group,
                profiles: group.profiles.sort((a, b) => a.name.localeCompare(b.name))
            }))
            .filter(group => group.profiles.length > 0);
    } catch (error) {
        console.warn('[SummarySharder] Failed to load Connection Manager profiles:', error);
        return [];
    }
}

/**
 * Call a specific Connection Manager profile without changing global active connection state.
 * @param {string} profileId
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{temperature?: number, topP?: number, maxTokens?: number, signal?: AbortSignal, messageFormat?: string}} options
 * @returns {Promise<string>}
 */
export async function callConnectionProfileAPI(profileId, systemPrompt, userPrompt, options = {}) {
    if (!profileId) {
        throw new Error(`No connection profile selected. ${PROFILE_MODE_ERROR_HINT}`);
    }

    if (!isConnectionManagerAvailable()) {
        throw new Error(`Connection Manager is not available. ${PROFILE_MODE_ERROR_HINT}`);
    }

    const profile = ConnectionManagerRequestService.getSupportedProfiles().find(p => p.id === profileId);
    if (!profile) {
        throw new Error(`Connection profile not found: ${profileId}. ${PROFILE_MODE_ERROR_HINT}`);
    }
    const selectedApiMap = ConnectionManagerRequestService.validateProfile(profile);

    const {
        temperature = 0.7,
        topP = 1,
        maxTokens = 4096,
        signal = null,
        messageFormat = 'minimal'
    } = options;

    const messages = buildMessages(systemPrompt, userPrompt, messageFormat);
    const custom = {
        stream: false,
        signal,
        extractData: true,
        includePreset: true,
        includeInstruct: false
    };

    const overridePayload = {
        temperature,
        top_p: topP
    };

    let result;
    try {
        result = await withProfileSecret(profile, selectedApiMap, async () => {
            return await ConnectionManagerRequestService.sendRequest(
                profile.id,
                messages,
                maxTokens,
                custom,
                overridePayload
            );
        });
    } catch (error) {
        if (error?.message?.includes('Connection Manager is not available')) {
            throw new Error(`Connection Manager is not available. ${PROFILE_MODE_ERROR_HINT}`);
        }
        const details = getErrorDetails(error);
        throw new Error(`Connection profile request failed (${profile.name}): ${details}. ${PROFILE_MODE_ERROR_HINT}`);
    }

    const content = String(result?.content || '').trim();
    if (!content) {
        throw new Error(`Connection profile returned an empty response. ${PROFILE_MODE_ERROR_HINT}`);
    }

    return content;
}
