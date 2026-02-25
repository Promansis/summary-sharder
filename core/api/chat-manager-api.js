/**
 * Chat Manager API Functions
 * Extracted from chat-manager-modal.js - pure API/data functions with no DOM interaction.
 */

import { characters, getRequestHeaders } from '../../../../../../script.js';
import { getFeatureApiSettings } from './feature-api-config.js';
import { callSillyTavernAPI, callExternalAPI } from './api-client.js';
import { callConnectionProfileAPI } from './connection-profile-api.js';

/**
 * Load chat content from the API
 * @param {number} characterId - Character index
 * @param {string} chatFileName - Chat file name
 * @returns {Promise<Array>} Chat messages
 */
export async function loadChatContent(characterId, chatFileName) {
    const character = characters[characterId];
    if (!character) {
        throw new Error('Character not found');
    }

    const response = await fetch('/api/chats/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            ch_name: character.name,
            file_name: chatFileName.replace('.jsonl', ''),
            avatar_url: character.avatar
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to load chat');
    }

    const data = await response.json();
    return data;
}

/**
 * Delete a chat file
 * @param {number} characterId - Character index
 * @param {string} chatFileName - Chat file name
 * @returns {Promise<boolean>} True if successful
 */
export async function deleteChat(characterId, chatFileName) {
    const character = characters[characterId];
    if (!character) {
        throw new Error('Character not found');
    }

    const response = await fetch('/api/chats/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            chatfile: chatFileName,
            avatar_url: character.avatar,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to delete chat');
    }

    return true;
}

/**
 * Export chat as JSON
 * @param {number} characterId - Character index
 * @param {string} chatFileName - Chat file name
 * @returns {Promise<string>} Export result
 */
export async function exportChatJSON(characterId, chatFileName) {
    const character = characters[characterId];
    if (!character) {
        throw new Error('Character not found');
    }

    const response = await fetch('/api/chats/export', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            is_group: false,
            avatar_url: character.avatar,
            file: chatFileName,
            exportfilename: `${chatFileName.replace('.jsonl', '')}.jsonl`,
            format: 'jsonl',
        }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Failed to export chat');
    }

    return data.result;
}

/**
 * Build raw text export from chat messages
 * @param {Array} messages - Chat messages
 * @param {boolean} includeNames - Whether to include character names
 * @returns {string} Formatted text
 */
export function buildRawTextExport(messages, includeNames) {
    const lines = [];

    for (const msg of messages) {
        if (!msg || !msg.mes) continue;

        // Skip metadata entries
        if (msg.user_name !== undefined && msg.character_name !== undefined) continue;

        const content = msg.mes || '';
        if (includeNames) {
            const name = msg.name || (msg.is_user ? 'User' : 'Character');
            lines.push(`${name}: ${content}`);
        } else {
            lines.push(content);
        }
    }

    return lines.join('\n\n');
}

/**
 * Save content to a specific chat
 * @param {number} characterId - Character index
 * @param {string} chatFileName - Chat file name
 * @param {Array} messages - Messages to save
 * @returns {Promise<boolean>} True if successful
 */
export async function saveToChat(characterId, chatFileName, messages) {
    const character = characters[characterId];
    if (!character) {
        throw new Error('Character not found');
    }

    const response = await fetch('/api/chats/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            ch_name: character.name,
            file_name: chatFileName.replace('.jsonl', ''),
            chat: messages,
            avatar_url: character.avatar
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to save chat');
    }

    return true;
}

/**
 * Call summary API using centralized api-client
 * Routes through SillyTavern backend for security
 * @param {Object} settings - Extension settings
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @returns {Promise<string>} API response
 */
export async function callChatManagerAPI(settings, systemPrompt, userPrompt) {
    // Get effective API settings for chatManager feature
    const effectiveSettings = await getFeatureApiSettings(settings, 'chatManager');

    // Use per-feature generation settings
    const options = {
        temperature: effectiveSettings.temperature,
        topP: effectiveSettings.topP,
        maxTokens: effectiveSettings.maxTokens,
        messageFormat: effectiveSettings.messageFormat,
        removeStopStrings: effectiveSettings.removeStopStrings === true
    };

    if (effectiveSettings.useSillyTavernAPI) {
        return await callSillyTavernAPI(systemPrompt, userPrompt, options);
    } else if (effectiveSettings.useConnectionProfile) {
        return await callConnectionProfileAPI(effectiveSettings.connectionProfileId, systemPrompt, userPrompt, options);
    } else {
        return await callExternalAPI(effectiveSettings, systemPrompt, userPrompt, options);
    }
}
