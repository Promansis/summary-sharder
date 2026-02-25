/**
 * Centralized API Client
 * Single source of truth for all API calls in Summary Sharder
 */

import {
    extractMessageFromData,
    generateRaw,
    getRequestHeaders,
    main_api,
} from '../../../../../../script.js';
import {
    createGenerationParameters,
    getChatCompletionModel,
    oai_settings,
} from '../../../../../openai.js';

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
 * @property {number} [temperature=0.7] - Temperature for generation
 * @property {number} [topP=1] - Nucleus sampling threshold (0-1)
 * @property {number} [maxTokens=4096] - Maximum tokens to generate
 * @property {string} [messageFormat='minimal'] - Message format: 'minimal' or 'alternating'
 * @property {AbortSignal|null} [signal=null] - Optional abort signal
 * @property {boolean} [removeStopStrings=false] - Remove stop strings for ST/Connection Profile generation
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
 * Convert unknown values to Error instances.
 * @param {unknown} value
 * @param {string} fallbackMessage
 * @returns {Error}
 */
function toError(value, fallbackMessage) {
    if (value instanceof Error) {
        return value;
    }
    if (typeof value === 'string' && value.trim()) {
        return new Error(value.trim());
    }
    return new Error(fallbackMessage);
}

/**
 * Normalize generated text and treat whitespace-only responses as empty.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeGeneratedText(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
}

/**
 * Clone current OAI settings defensively for compatibility retries.
 * @returns {Object}
 */
function cloneOaiSettings() {
    if (typeof structuredClone === 'function') {
        return structuredClone(oai_settings);
    }
    return JSON.parse(JSON.stringify(oai_settings));
}

/**
 * Extract assistant text from chat-completions response.
 * @param {any} data
 * @returns {string}
 */
function extractAssistantText(data) {
    const fromExtractor = normalizeGeneratedText(extractMessageFromData(data, 'openai'));
    if (fromExtractor) {
        return fromExtractor;
    }

    const fromMessage = normalizeGeneratedText(data?.choices?.[0]?.message?.content);
    if (fromMessage) {
        return fromMessage;
    }

    return normalizeGeneratedText(data?.content);
}

/**
 * Execute one compatibility request attempt.
 * @param {string} label
 * @param {Object} body
 * @param {AbortSignal|null} signal
 * @returns {Promise<string>}
 */
async function runCompatibilityAttempt(label, body, signal) {
    const fetchOptions = {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body),
    };

    if (signal) {
        fetchOptions.signal = signal;
    }

    const response = await fetch('/api/backends/chat-completions/generate', fetchOptions);
    const rawText = await response.text();

    if (!response.ok) {
        throw new Error(`${label}: Compatibility API error (${response.status}): ${rawText || response.statusText}`);
    }

    let data;
    try {
        data = rawText ? JSON.parse(rawText) : {};
    } catch {
        throw new Error(`${label}: Compatibility API returned non-JSON response: ${(rawText || '').slice(0, 300)}`);
    }

    if (data?.error) {
        throw new Error(`${label}: ${data.error.message || 'Compatibility API returned an error'}`);
    }

    const text = extractAssistantText(data);
    if (text) {
        return text;
    }

    const rawMessageContent = data?.choices?.[0]?.message?.content;
    const rawLength = typeof rawMessageContent === 'string' ? rawMessageContent.length : null;
    const preview = typeof rawMessageContent === 'string'
        ? JSON.stringify(rawMessageContent.slice(0, 40))
        : '[non-string]';

    throw new Error(`${label}: Compatibility response contained no usable assistant text (rawLen=${rawLength} rawPreview=${preview})`);
}

/**
 * Compatibility path for providers/proxies that reject quiet-mode requests.
 * Uses a swipe-shaped request with stream disabled.
 * @param {Array<{role: string, content: string}>} messages
 * @param {{maxTokens: number, temperature?: number|null, topP?: number|null, signal?: AbortSignal|null, removeStopStrings?: boolean}} options
 * @returns {Promise<string>}
 */
async function callSillyTavernAPICompatibility(messages, options) {
    const {
        maxTokens = 4096,
        temperature = null,
        topP = null,
        signal = null,
        removeStopStrings = false,
    } = options || {};

    if (main_api !== 'openai') {
        throw new Error(`Compatibility retry is only available for main_api=openai (current: ${main_api || 'unknown'})`);
    }

    const compatSettings = cloneOaiSettings();
    compatSettings.openai_max_tokens = maxTokens;
    if (typeof temperature === 'number' && Number.isFinite(temperature)) {
        compatSettings.temp_openai = temperature;
    }
    if (typeof topP === 'number' && Number.isFinite(topP)) {
        compatSettings.top_p_openai = topP;
    }

    const model = getChatCompletionModel(compatSettings);
    const { generate_data } = await createGenerationParameters(compatSettings, model, 'swipe', messages);
    const defaultBody = {
        ...generate_data,
        type: 'swipe',
        stream: false,
        max_tokens: maxTokens,
        n: 1,
    };

    const hasStops = Array.isArray(defaultBody.stop) && defaultBody.stop.length > 0;
    const noStopBody = hasStops ? { ...defaultBody, stop: [] } : defaultBody;

    const attempts = [];
    if (removeStopStrings && hasStops) {
        attempts.push({ label: 'no-stop', body: noStopBody });
    } else {
        attempts.push({ label: 'default-stop', body: defaultBody });
    }

    const errors = [];
    for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        try {
            return await runCompatibilityAttempt(attempt.label, attempt.body, signal);
        } catch (error) {
            const normalizedError = toError(error, `${attempt.label} compatibility request failed`);
            errors.push(normalizedError.message);

        }
    }

    throw new Error(errors.join('. ') || 'Compatibility retry failed');
}

/**
 * Call SillyTavern's current chat API using generateRaw (without context injection).
 * For custom chat-completion source, use no-stop compatibility path first to avoid
 * provider-side truncation to newline from shared stop strings.
 * @param {string} systemPrompt - The system prompt
 * @param {string} userPrompt - The user prompt
 * @param {APICallOptions} [options={}] - Optional parameters
 * @returns {Promise<string>} The API response
 */
export async function callSillyTavernAPI(systemPrompt, userPrompt, options = {}) {
    const {
        maxTokens = 4096,
        temperature = null,
        topP = null,
        messageFormat = 'minimal',
        signal = null,
        removeStopStrings = false
    } = options;
    const messages = buildMessages(systemPrompt, userPrompt, messageFormat);

    if (removeStopStrings) {
        if (main_api !== 'openai') {
            console.warn('[SummarySharder] Remove Stop Strings is only supported on chat-completions main_api=openai. Using default quiet path.', {
                mainApi: main_api,
            });
        } else {
            const source = String(oai_settings?.chat_completion_source || 'unknown');
            const model = (() => {
                try {
                    return String(getChatCompletionModel(oai_settings) || 'unknown');
                } catch {
                    return 'unknown';
                }
            })();
            try {
                return await callSillyTavernAPICompatibility(messages, {
                    maxTokens,
                    temperature,
                    topP,
                    signal,
                    removeStopStrings: true,
                });
            } catch (error) {
                const compatibilityFailure = toError(error, 'Remove-stop compatibility request failed');
                throw new Error(
                    `SillyTavern API failed with Remove Stop Strings enabled. ` +
                    `Source=${source} Model=${model}. ${compatibilityFailure.message}`
                );
            }
        }
    }

    try {
        let result;
        if (messageFormat === 'alternating') {
            result = await generateRaw({ prompt: messages, responseLength: maxTokens });
        } else {
            result = await generateRaw({
                prompt: userPrompt,
                systemPrompt: systemPrompt,
                responseLength: maxTokens
            });
        }

        const normalized = normalizeGeneratedText(result);
        if (normalized) {
            return normalized;
        }
        throw new Error('No response from SillyTavern API');
    } catch (error) {
        throw toError(error, 'SillyTavern quiet request failed');
    }
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

    // Pass API key via custom_include_headers - ST backend merges these after the default
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
