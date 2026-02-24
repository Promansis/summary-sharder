/**
 * Feature-specific API configuration resolver
 * Centralizes API settings management across Summary, Sharder, and Pre-Edit Events
 */

import { getApiKeyForConfig, getConfigById } from './legacy-api-config.js';

/**
 * Default generation parameters per feature
 */
const DEFAULT_GENERATION_PARAMS = {
    summary: { temperature: 0.4, topP: 1, maxTokens: 8096, queueDelayMs: 0, postProcessing: '', messageFormat: 'minimal' },
    sharder: { temperature: 0.25, topP: 1, maxTokens: 8096, queueDelayMs: 0, postProcessing: '', messageFormat: 'minimal' },
    events: { temperature: 0.4, topP: 1, maxTokens: 4096, queueDelayMs: 0, postProcessing: '', messageFormat: 'minimal' },
    chatManager: { temperature: 0.3, topP: 1, maxTokens: 4096, queueDelayMs: 0, postProcessing: '', messageFormat: 'minimal' }
};

/**
 * Get effective API settings for a specific feature
 * @param {Object} settings - Extension settings
 * @param {string} feature - Feature name ('summary', 'sharder', 'events', 'chatManager')
 * @returns {Promise<{useSillyTavernAPI: boolean, useConnectionProfile: boolean, connectionProfileId: string|null, apiUrl: string, apiKey: string, selectedModel: string, temperature: number, topP: number, maxTokens: number, queueDelayMs: number}>}
 * @throws {Error} If API is not configured for the feature
 */
export async function getFeatureApiSettings(settings, feature) {
    const featureConfig = settings.apiFeatures?.[feature];
    const defaults = DEFAULT_GENERATION_PARAMS[feature] || DEFAULT_GENERATION_PARAMS.summary;

    // Build generation params from feature config with defaults
    const generationParams = {
        temperature: featureConfig?.temperature ?? defaults.temperature,
        topP: featureConfig?.topP ?? defaults.topP,
        maxTokens: featureConfig?.maxTokens ?? defaults.maxTokens,
        queueDelayMs: featureConfig?.queueDelayMs ?? defaults.queueDelayMs,
        postProcessing: featureConfig?.postProcessing ?? defaults.postProcessing,
        messageFormat: featureConfig?.messageFormat ?? defaults.messageFormat
    };

    // Migration fallback - if new structure doesn't exist, use legacy settings
    if (!featureConfig) {
        const legacySettings = await getLegacyApiSettings(settings, feature);
        return { ...legacySettings, ...generationParams };
    }

    // Using SillyTavern API
    if (featureConfig.useSillyTavernAPI) {
        return {
            useSillyTavernAPI: true,
            useConnectionProfile: false,
            connectionProfileId: null,
            apiUrl: '',
            apiKey: '',
            selectedModel: '',
            ...generationParams
        };
    }

    // Using Connection Manager profile
    if (featureConfig.connectionProfileId) {
        return {
            useSillyTavernAPI: false,
            useConnectionProfile: true,
            connectionProfileId: featureConfig.connectionProfileId,
            apiUrl: '',
            apiKey: '',
            selectedModel: '',
            ...generationParams
        };
    }

    // Using external API - resolve saved config
    if (featureConfig.apiConfigId) {
        const config = getConfigById(settings, featureConfig.apiConfigId);

        if (!config) {
            throw new Error(`${feature} API configuration not found`);
        }

        const apiKey = await getApiKeyForConfig(settings, featureConfig.apiConfigId);

        if (!apiKey) {
            throw new Error(`Could not retrieve API key for ${feature}. Ensure allowKeysExposure is true in config.yaml and restart SillyTavern.`);
        }

        return {
            useSillyTavernAPI: false,
            useConnectionProfile: false,
            connectionProfileId: null,
            apiUrl: config.url,
            apiKey: apiKey,
            selectedModel: config.model || '',
            ...generationParams
        };
    }

    throw new Error(`${feature} API not configured`);
}

/**
 * Get legacy API settings for backward compatibility
 * Handles old settings structure before apiFeatures was introduced
 * @param {Object} settings - Extension settings
 * @param {string} feature - Feature name
 * @returns {Promise<Object>} Legacy API settings
 */
async function getLegacyApiSettings(settings, feature) {
    // Events had alternate API support in legacy structure
    if (feature === 'events' && settings.useAlternateEventsApi && settings.eventsApiConfigId) {
        const config = getConfigById(settings, settings.eventsApiConfigId);

        if (config) {
            const apiKey = await getApiKeyForConfig(settings, settings.eventsApiConfigId);

            if (apiKey) {
                return {
                    useSillyTavernAPI: false,
                    useConnectionProfile: false,
                    connectionProfileId: null,
                    apiUrl: config.url,
                    apiKey: apiKey,
                    selectedModel: config.model || settings.selectedModel
                };
            }
        }
    }

    // Default legacy behavior - use main API settings
    // If activeApiConfigId is set, use that saved config
    if (!settings.useSillyTavernAPI && settings.activeApiConfigId) {
        const config = getConfigById(settings, settings.activeApiConfigId);

        if (config) {
            const apiKey = await getApiKeyForConfig(settings, settings.activeApiConfigId);

            if (apiKey) {
                return {
                    useSillyTavernAPI: false,
                    useConnectionProfile: false,
                    connectionProfileId: null,
                    apiUrl: config.url,
                    apiKey: apiKey,
                    selectedModel: config.model || settings.selectedModel
                };
            }
        }
    }

    // Fall back to direct settings (manual entry mode)
    return {
        useSillyTavernAPI: settings.useSillyTavernAPI || false,
        useConnectionProfile: false,
        connectionProfileId: null,
        apiUrl: settings.apiUrl || '',
        apiKey: settings.apiKey || '',
        selectedModel: settings.selectedModel || ''
    };
}

/**
 * Get display string for feature's current API configuration
 * @param {Object} settings - Extension settings
 * @param {string} feature - Feature name ('summary', 'sharder', 'events')
 * @returns {string} Display string (e.g., "SillyTavern Current" or "ConfigName - model")
 */
export function getFeatureApiDisplayString(settings, feature) {
    const featureConfig = settings.apiFeatures?.[feature];

    // Migration fallback
    if (!featureConfig) {
        return getLegacyApiDisplayString(settings, feature);
    }

    // Using SillyTavern API
    if (featureConfig.useSillyTavernAPI) {
        return 'SillyTavern Current';
    }

    if (featureConfig.connectionProfileId) {
        const profile = SillyTavern.getContext()
            ?.extensionSettings
            ?.connectionManager
            ?.profiles
            ?.find(p => p.id === featureConfig.connectionProfileId);

        return profile ? `Profile: ${profile.name}` : 'Unknown Profile';
    }

    // Using external API
    if (featureConfig.apiConfigId) {
        const config = getConfigById(settings, featureConfig.apiConfigId);

        if (config) {
            return config.name;
        }

        return 'Unknown Configuration';
    }

    return 'Not Configured';
}

/**
 * Get legacy display string for backward compatibility
 * @param {Object} settings - Extension settings
 * @param {string} feature - Feature name
 * @returns {string} Display string
 */
function getLegacyApiDisplayString(settings, feature) {
    // Events had alternate API support
    if (feature === 'events' && settings.useAlternateEventsApi && settings.eventsApiConfigId) {
        const config = getConfigById(settings, settings.eventsApiConfigId);
        if (config) {
            return config.name;
        }
    }

    // Check main API configuration
    if (settings.useSillyTavernAPI) {
        return 'SillyTavern Current';
    }

    if (settings.activeApiConfigId) {
        const config = getConfigById(settings, settings.activeApiConfigId);
        if (config) {
            return config.name;
        }
    }

    // Manual entry mode
    if (settings.apiUrl) {
        return 'Manual Entry';
    }

    return 'Not Configured';
}
