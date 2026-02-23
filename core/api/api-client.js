/**
 * Centralized API Client
 * Single source of truth for all API calls in Summary Sharder
 */

import { generateRaw, getRequestHeaders } from '../../../../../../script.js';

/**
 * Normalize API URL by removing endpoint-specific paths
 * @param {string} url - The API URL to normalize
 * @returns {string} Normalized base URL
 */
export function normalizeApiUrl(url) {
    if (!url) return '';

    let normalized = url.trim();

    // Remove /chat/completions or /models endpoint if present
    if (normalized.endsWith('/chat/completions')) {
        normalized = normalized.slice(0, -'/chat/completions'.length);
    } else if (normalized.endsWith('/models')) {
        normalized = normalized.slice(0, -'/models'.length);
    }

    // Remove trailing slash
    if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }

    return normalized;
}

/**
 * @typedef {Object} APICallOptions
 * @property {number} [temperature=0.7] - Temperature for generation (external API only)
 * @property {number} [topP=1] - Nucleus sampling threshold (0-1)
 * @property {number} [maxTokens=4096] - Maximum tokens to generate
 * @property {string} [messageFormat='minimal'] - Message format: 'minimal' or 'alternating'
 */

/**
 * Build the messages array based on the configured message format.
 * 'alternating' adds an assistant turn so proxy APIs get proper role alternation.
 * @param {string} systemPrompt - The system prompt
 * @param {string} userPrompt - The user prompt
 * @param {string} messageFormat - 'minimal' or 'alternating'
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
 * Call SillyTavern's current chat API using generateRaw (without context injection)
 * @param {string} systemPrompt - The system prompt
 * @param {string} userPrompt - The user prompt
 * @param {APICallOptions} [options={}] - Optional parameters
 * @returns {Promise<string>} The API response
 */
export async function callSillyTavernAPI(systemPrompt, userPrompt, options = {}) {
    const { maxTokens = 4096, messageFormat = 'minimal' } = options;

    let result;
    if (messageFormat === 'alternating') {
        // Pass full message array to generateRaw for proper role alternation
        const messages = buildMessages(systemPrompt, userPrompt, messageFormat);
        result = await generateRaw({ prompt: messages, responseLength: maxTokens });
    } else {
        result = await generateRaw({
            prompt: userPrompt,
            systemPrompt: systemPrompt,
            responseLength: maxTokens
        });
    }

    if (!result || typeof result !== 'string') {
        throw new Error('No response from SillyTavern API');
    }

    return result.trim();
}

/**
 * Call external API by routing through SillyTavern's backend using CUSTOM source.
 * Routes requests through /api/backends/chat-completions/generate for:
 * - Proper request logging in SillyTavern console
 * - API key security (passed via custom_include_headers, not stored in shared secret slot)
 * - CORS compliance (no direct cross-origin requests)
 *
 * @param {Object} settings - API configuration settings (apiUrl, selectedModel, apiKey)
 * @param {string} systemPrompt - The system prompt
 * @param {string} userPrompt - The user prompt
 * @param {APICallOptions} [options={}] - Optional parameters
 * @returns {Promise<string>} The API response
 */
export async function callExternalAPI(settings, systemPrompt, userPrompt, options = {}) {
    const { temperature = 0.7, topP = 1, maxTokens = 4096, signal = null } = options;

    if (!settings.apiUrl) {
        throw new Error('API URL is not configured');
    }

    // Normalize URL to base (without /chat/completions or /models)
    let baseUrl = settings.apiUrl.trim();
    if (baseUrl.endsWith('/chat/completions')) {
        baseUrl = baseUrl.slice(0, -'/chat/completions'.length);
    } else if (baseUrl.endsWith('/models')) {
        baseUrl = baseUrl.slice(0, -'/models'.length);
    }
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }

    // Build request using CUSTOM source
    // API key is passed via custom_include_headers to override the Authorization header
    // This avoids writing to the shared api_key_custom secret slot
    const messageFormat = settings.messageFormat || 'minimal';
    const requestBody = {
        chat_completion_source: 'custom',
        custom_url: baseUrl,
        model: settings.selectedModel || 'gpt-4',
        messages: buildMessages(systemPrompt, userPrompt, messageFormat),
        max_tokens: maxTokens,
        temperature: temperature,
        top_p: topP,
        stream: false
    };

    // Add prompt post-processing if configured (transforms message roles before sending to API)
    if (settings.postProcessing) {
        requestBody.custom_prompt_post_processing = settings.postProcessing;
    }

    // Pass API key via custom_include_headers — ST backend merges these after the default
    // Authorization header, so this overrides it without touching the api_key_custom secret slot
    if (settings.apiKey) {
        requestBody.custom_include_headers = `Authorization: "Bearer ${settings.apiKey}"`;
    }

    // Route through SillyTavern backend (provides logging, security, CORS handling)
    const fetchOptions = {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(requestBody)
    };

    // Add abort signal if provided
    if (signal) {
        fetchOptions.signal = signal;
    }

    const response = await fetch('/api/backends/chat-completions/generate', fetchOptions);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`External API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Handle error responses from backend
    if (data.error) {
        throw new Error(data.error.message || 'API returned an error');
    }

    // Extract response from OpenAI-style response format
    if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content.trim();
    }

    // Handle alternative response format (some backends return direct content)
    if (data.content) {
        return data.content.trim();
    }

    throw new Error('Unexpected response format from external API');
}

/**
 * Unified API caller that routes to the appropriate API based on settings
 * @param {Object} settings - API configuration settings
 * @param {string} systemPrompt - The system prompt
 * @param {string} userPrompt - The user prompt
 * @param {boolean} useExternalAPI - Whether to use external API
 * @param {APICallOptions} [options={}] - Optional parameters (temperature, maxTokens)
 * @returns {Promise<string>} The API response
 */
export async function callAPI(settings, systemPrompt, userPrompt, useExternalAPI = false, options = {}) {
    // Pass messageFormat from settings to options for the ST API path
    const effectiveOptions = { ...options, messageFormat: settings.messageFormat || options.messageFormat || 'minimal' };

    if (useExternalAPI) {
        return await callExternalAPI(settings, systemPrompt, userPrompt, effectiveOptions);
    } else {
        return await callSillyTavernAPI(systemPrompt, userPrompt, effectiveOptions);
    }
}
