/**
 * API Configuration management for Summary Sharder
 * Handles saving, loading, and deleting API configurations
 * Uses SillyTavern's secrets system for secure key storage
 */

import { saveSettings, getSettings } from '../settings.js';
import { getRequestHeaders } from '../../../../../../script.js';

// Use SillyTavern's predefined custom API key slot
// Custom keys don't work with /find endpoint due to getSecretState() only returning SECRET_KEYS
const SECRET_KEY = 'api_key_custom';

/**
 * Generate a unique ID for a new API config
 * @returns {string} Unique config ID
 */
function generateConfigId() {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Write a secret to the SillyTavern secrets system
 * @param {string} key - Secret key name
 * @param {string} value - Secret value (API key)
 * @param {string} label - Label for the secret
 * @returns {Promise<string|null>} Secret ID or null on failure
 */
async function writeSecretDirect(key, value, label) {
    try {
        const response = await fetch('/api/secrets/write', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, value, label }),
        });

        if (!response.ok) {
            console.error('[SummarySharder] Failed to write secret:', response.status);
            return null;
        }

        const data = await response.json();
        return data.id || null;
    } catch (error) {
        console.error('[SummarySharder] Error writing secret:', error);
        return null;
    }
}

/**
 * Read a secret from the SillyTavern secrets system
 * Note: Requires allowKeysExposure: true in ST config
 * @param {string} key - Secret key name
 * @param {string} [id] - Optional specific secret ID
 * @returns {Promise<string|null>} Secret value or null
 */
async function findSecretDirect(key, id) {
    try {
        const response = await fetch('/api/secrets/find', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, id }),
        });

        if (!response.ok) {
            if (response.status === 403) {
                console.warn('[SummarySharder] Key exposure disabled in ST config');
            }
            return null;
        }

        const data = await response.json();
        return data.value || null;
    } catch (error) {
        console.error('[SummarySharder] Error finding secret:', error);
        return null;
    }
}

/**
 * Delete a secret from the SillyTavern secrets system
 * @param {string} key - Secret key name
 * @param {string} [id] - Optional specific secret ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteSecretDirect(key, id) {
    try {
        const response = await fetch('/api/secrets/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, id }),
        });

        return response.ok;
    } catch (error) {
        console.error('[SummarySharder] Error deleting secret:', error);
        return false;
    }
}

/**
 * Find an existing secretId that stores the given API key value.
 * Iterates saved configs and compares via server round-trip (findSecretDirect).
 * @param {Object} settings - Current settings
 * @param {string} apiKey - The API key value to search for
 * @param {string} [excludeConfigId] - Optional config ID to skip during search
 * @returns {Promise<string|null>} Existing secretId or null
 */
async function findExistingSecretForKey(settings, apiKey, excludeConfigId) {
    if (!Array.isArray(settings.savedApiConfigs)) return null;

    for (const config of settings.savedApiConfigs) {
        if (!config.secretId) continue;
        if (excludeConfigId && config.id === excludeConfigId) continue;

        const storedKey = await findSecretDirect(SECRET_KEY, config.secretId);
        if (storedKey === apiKey) {
            return config.secretId;
        }
    }
    return null;
}

/**
 * Save the current API configuration
 * @param {Object} settings - Current settings
 * @param {string} name - Name for the saved configuration
 * @returns {Promise<{success: boolean, configId?: string, error?: string}>}
 */
export async function saveCurrentApiConfig(settings, name) {
    if (!name || !name.trim()) {
        return { success: false, error: 'Configuration name is required' };
    }

    if (!settings.apiUrl) {
        return { success: false, error: 'API URL is required' };
    }

    if (!settings.apiKey) {
        return { success: false, error: 'API Key is required' };
    }

    const configId = generateConfigId();

    // Check if this API key already exists in another config's secret
    const existingSecretId = await findExistingSecretForKey(settings, settings.apiKey);

    let secretId;
    if (existingSecretId) {
        // Reuse existing secret instead of creating a duplicate
        secretId = existingSecretId;
    } else {
        // Store the API key in SillyTavern's secrets system
        secretId = await writeSecretDirect(SECRET_KEY, settings.apiKey, `Summary Sharder: ${name}`);

        if (!secretId) {
            return { success: false, error: 'Failed to save API key securely' };
        }
    }

    // Create config object (without the actual API key)
    const config = {
        id: configId,
        name: name.trim(),
        url: settings.apiUrl,
        secretId: secretId,
        model: settings.selectedModel || '',
    };

    // Add to saved configs
    if (!Array.isArray(settings.savedApiConfigs)) {
        settings.savedApiConfigs = [];
    }

    settings.savedApiConfigs.push(config);
    settings.activeApiConfigId = configId;

    // Clear apiKey from settings - it's stored securely in the secrets system
    settings.apiKey = '';
    saveSettings(settings);

    return { success: true, configId };
}

/**
 * Create a blank API configuration (no URL/key yet)
 * @param {Object} settings - Current settings
 * @param {string} name - Name for the configuration
 * @returns {Promise<{success: boolean, configId?: string, error?: string}>}
 */
export async function createBlankApiConfig(settings, name) {
    if (!name || !name.trim()) {
        return { success: false, error: 'Configuration name is required' };
    }

    const configId = generateConfigId();

    const config = {
        id: configId,
        name: name.trim(),
        url: '',
        secretId: null,
        model: '',
    };

    if (!Array.isArray(settings.savedApiConfigs)) {
        settings.savedApiConfigs = [];
    }

    settings.savedApiConfigs.push(config);
    settings.activeApiConfigId = configId;
    saveSettings(settings);

    return { success: true, configId };
}

/**
 * Update an existing API configuration
 * @param {Object} settings - Current settings
 * @param {string} configId - ID of config to update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateApiConfig(settings, configId) {
    const configIndex = settings.savedApiConfigs?.findIndex(c => c.id === configId);

    if (configIndex === -1 || configIndex === undefined) {
        return { success: false, error: 'Configuration not found' };
    }

    const config = settings.savedApiConfigs[configIndex];

    // Validation
    if (!settings.apiUrl) {
        return { success: false, error: 'API URL is required' };
    }

    if (!settings.apiKey) {
        return { success: false, error: 'API Key is required' };
    }

    // Update URL and model directly
    config.url = settings.apiUrl;
    config.model = settings.selectedModel || '';

    // Handle secret update
    if (!config.secretId) {
        // First time saving key for this config (was created blank) — check for reuse
        const existingSecretId = await findExistingSecretForKey(settings, settings.apiKey, configId);
        if (existingSecretId) {
            config.secretId = existingSecretId;
        } else {
            const secretId = await writeSecretDirect(SECRET_KEY, settings.apiKey, `Summary Sharder: ${config.name}`);
            if (!secretId) {
                return { success: false, error: 'Failed to save API key securely' };
            }
            config.secretId = secretId;
        }
    } else {
        // Check if API key changed
        const currentKey = await findSecretDirect(SECRET_KEY, config.secretId);

        if (currentKey !== settings.apiKey) {
            const oldSecretId = config.secretId;

            // Check if the new key already exists in another config
            const existingSecretId = await findExistingSecretForKey(settings, settings.apiKey, configId);
            if (existingSecretId) {
                config.secretId = existingSecretId;
            } else {
                const newSecretId = await writeSecretDirect(SECRET_KEY, settings.apiKey, `Summary Sharder: ${config.name}`);
                if (!newSecretId) {
                    return { success: false, error: 'Failed to update API key' };
                }
                config.secretId = newSecretId;
            }

            // Only delete old secret if no other config references it
            const oldSecretStillUsed = settings.savedApiConfigs.some(
                c => c.id !== configId && c.secretId === oldSecretId
            );
            if (!oldSecretStillUsed) {
                await deleteSecretDirect(SECRET_KEY, oldSecretId);
            }
        }
    }

    // Clear apiKey from settings - it's stored securely in the secrets system
    settings.apiKey = '';
    saveSettings(settings);
    return { success: true };
}

/**
 * Load a saved API configuration
 * @param {Object} settings - Current settings
 * @param {string} configId - ID of config to load
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function loadApiConfig(settings, configId) {
    if (!configId) {
        // Loading "manual" mode - clear active config
        settings.activeApiConfigId = null;
        saveSettings(settings);
        return { success: true };
    }

    const config = settings.savedApiConfigs?.find(c => c.id === configId);

    if (!config) {
        return { success: false, error: 'Configuration not found' };
    }

    // Verify the API key is retrievable from secrets
    const apiKey = await findSecretDirect(SECRET_KEY, config.secretId);

    if (!apiKey) {
        return {
            success: false,
            error: 'Cannot retrieve API key. Ensure allowKeysExposure is true in config.yaml and restart SillyTavern.'
        };
    }

    // Update settings with loaded config (apiKey retrieved at call time by getFeatureApiSettings)
    settings.apiUrl = config.url;
    settings.apiKey = '';
    settings.selectedModel = config.model || '';
    settings.activeApiConfigId = configId;
    saveSettings(settings);

    return { success: true };
}

/**
 * Delete a saved API configuration
 * @param {Object} settings - Current settings
 * @param {string} configId - ID of config to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteApiConfig(settings, configId) {
    const configIndex = settings.savedApiConfigs?.findIndex(c => c.id === configId);

    if (configIndex === -1 || configIndex === undefined) {
        return { success: false, error: 'Configuration not found' };
    }

    const config = settings.savedApiConfigs[configIndex];

    // Only delete the secret if no other config shares the same secretId
    if (config.secretId) {
        const secretStillUsed = settings.savedApiConfigs.some(
            c => c.id !== configId && c.secretId === config.secretId
        );
        if (!secretStillUsed) {
            await deleteSecretDirect(SECRET_KEY, config.secretId);
        }
    }

    // Remove from saved configs
    settings.savedApiConfigs.splice(configIndex, 1);

    // Clear active config if it was the deleted one
    if (settings.activeApiConfigId === configId) {
        settings.activeApiConfigId = null;
    }

    // Also clear events API if it was using the deleted config
    if (settings.eventsApiConfigId === configId) {
        settings.eventsApiConfigId = null;
    }

    saveSettings(settings);

    return { success: true };
}

/**
 * Get list of saved API configurations (for dropdown)
 * @param {Object} settings - Current settings
 * @returns {Array<{id: string, name: string, url: string}>}
 */
export function getApiConfigs(settings) {
    if (!Array.isArray(settings.savedApiConfigs)) {
        return [];
    }

    return settings.savedApiConfigs.map(config => ({
        id: config.id,
        name: config.name,
        url: config.url,
    }));
}

/**
 * Get API key for a specific config (for making API calls)
 * @param {Object} settings - Current settings
 * @param {string} configId - Config ID to get key for
 * @returns {Promise<string|null>} API key or null
 */
export async function getApiKeyForConfig(settings, configId) {
    const config = settings.savedApiConfigs?.find(c => c.id === configId);

    if (!config) {
        return null;
    }

    return await findSecretDirect(SECRET_KEY, config.secretId);
}

/**
 * Get full config details for a config ID
 * @param {Object} settings - Current settings
 * @param {string} configId - Config ID
 * @returns {Object|null} Config object or null
 */
export function getConfigById(settings, configId) {
    return settings.savedApiConfigs?.find(c => c.id === configId) || null;
}
