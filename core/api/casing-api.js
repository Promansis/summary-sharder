/**
 * Draft extraction and draft-based summary generation for Drafting Mode
 */

import { getActivePrompt, getCasingPrompt } from '../summarization/prompts.js';
import { buildLengthInstruction, countWords } from '../summarization/length-utils.js';
import { getRequestHeaders } from '../../../../../../script.js';
import { applyContextCleanup } from '../processing/context-cleanup.js';
import { buildChatText } from '../chat/chat-text-builder.js';

// Import shared API client functions
import { callSillyTavernAPI, callExternalAPI, normalizeApiUrl } from './api-client.js';
import { callConnectionProfileAPI } from './connection-profile-api.js';

// Import feature API resolver
import { getFeatureApiSettings } from './feature-api-config.js';

// Import abort controller
import { getAbortSignal } from './abort-controller.js';
import { log } from '../logger.js';

/**
 * Call the appropriate API based on settings
 * Uses feature-specific API configuration
 * @param {Object} settings - Extension settings
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {string} feature - Feature key ('casing' or 'summary')
 */
async function callAPI(settings, systemPrompt, userPrompt, feature = 'casing') {
    // Get effective API settings for the specified feature
    const effectiveSettings = await getFeatureApiSettings(settings, feature);

    const options = {
        temperature: effectiveSettings.temperature,
        topP: effectiveSettings.topP,
        maxTokens: effectiveSettings.maxTokens,
        signal: getAbortSignal(),
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

/**
 * Parse JSON from LLM response, handling markdown code blocks
 */
function parseJSONFromResponse(response) {
    // Try direct parse first
    try {
        return JSON.parse(response);
    } catch (e) {
        // Not direct JSON, continue
    }

    // Try to extract from markdown code blocks
    const jsonBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
        try {
            return JSON.parse(jsonBlockMatch[1].trim());
        } catch (e) {
            // Not valid JSON in code block
        }
    }

    // Try to find array in response
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        try {
            return JSON.parse(arrayMatch[0]);
        } catch (e) {
            // Not valid JSON array
        }
    }

    throw new Error('Could not parse JSON from response');
}

/**
 * Transform raw event data to SummaryEvent objects
 */
function transformToSummaryEvents(rawEvents, startIndex, endIndex) {
    if (!Array.isArray(rawEvents)) {
        throw new Error('Expected array of events');
    }

    return rawEvents.map((event, index) => {
        // Validate and clamp message range
        const eventStart = Math.max(startIndex, event.startIndex ?? startIndex);
        const eventEnd = Math.min(endIndex, event.endIndex ?? endIndex);

        return {
            id: `event-${index + 1}`,
            messageRange: {
                startIndex: eventStart,
                endIndex: eventEnd
            },
            time: event.time || null,
            date: event.date || null,
            location: event.location || null,
            characters: Array.isArray(event.characters) ? event.characters : [],
            originalDescription: event.description || 'No description provided',
            userDescription: null,
            selected: true
        };
    });
}

/**
 * Extract events from messages using LLM
 * @param {Array} messages - All chat messages
 * @param {number} startIndex - Start index of range to analyze
 * @param {number} endIndex - End index of range to analyze
 * @param {Object} settings - Extension settings
 * @returns {Promise<{events: Array, originalContextWordCount: number}>} Events and original context word count
 */
export async function extractDraftEvents(messages, startIndex, endIndex, settings) {
    // Always honor hidden-message filtering even when full cleanup is disabled.
    const cleanupForBuild = settings.contextCleanup?.enabled
        ? settings.contextCleanup
        : { stripHiddenMessages: settings.contextCleanup?.stripHiddenMessages !== false };
    let chatText = buildChatText(messages, startIndex, endIndex, { cleanup: cleanupForBuild, indexFormat: 'message' });

    // Apply context cleanup if enabled
    if (settings.contextCleanup?.enabled) {
        chatText = applyContextCleanup(chatText, settings.contextCleanup);
    }

    if (!chatText.trim()) {
        throw new Error('Selected message range is empty');
    }

    // Capture original context word count for length calculations
    const originalContextWordCount = countWords(chatText);

    const systemPrompt = getCasingPrompt(settings);

    const userPrompt = `CHAT CONTENT (Messages ${startIndex} to ${endIndex}):

${chatText}

Extract all significant events from the above conversation and return them as a JSON array.`;

    log.log('Extracting events from messages...');

    const response = await callAPI(settings, systemPrompt, userPrompt, 'casing');

    log.log('Event extraction response received');

    const rawEvents = parseJSONFromResponse(response);
    const events = transformToSummaryEvents(rawEvents, startIndex, endIndex);

    // Sort events chronologically by start index
    events.sort((a, b) => a.messageRange.startIndex - b.messageRange.startIndex);

    log.log(`Extracted ${events.length} events`);

    return { events, originalContextWordCount };
}

/**
 * Generate summary from selected events
 * @param {Array} selectedEvents - Array of selected SummaryEvent objects
 * @param {Object} settings - Extension settings
 * @param {string} userNote - Optional user note for regeneration
 * @param {number} originalContextWordCount - Word count of original context (for length calculations)
 * @param {boolean} extractKeywords - Whether to append keyword extraction instruction
 * @returns {Promise<string>} Generated summary text (may include KEYWORDS line if extractKeywords is true)
 */
export async function generateDraftSummary(selectedEvents, settings, userNote = '', originalContextWordCount = null, extractKeywords = false) {
    const summaryPrompt = getActivePrompt(settings);

    if (!summaryPrompt) {
        throw new Error('No summary prompt selected');
    }

    // Build events text
    const eventsText = selectedEvents.map((event, i) => {
        const description = event.userDescription ?? event.originalDescription;
        const metaParts = [];

        if (event.time) metaParts.push(event.time);
        if (event.date) metaParts.push(event.date);
        if (event.location) metaParts.push(event.location);

        const meta = metaParts.length > 0 ? ` (${metaParts.join(' | ')})` : '';

        return `Event ${i + 1}${meta}:
Characters: ${event.characters.length > 0 ? event.characters.join(', ') : 'Unknown'}
${description}`;
    }).join('\n\n---\n\n');

    // Build user prompt with optional user note for regeneration
    let userPrompt = `Based on the following extracted events, generate a summary following the protocol above.

EVENTS TO SUMMARIZE:

${eventsText}`;

    // Append user note if provided (used during regeneration with specific instructions)
    if (userNote && userNote.trim()) {
        userPrompt += `

---
USER NOTE: ${userNote.trim()}
Please incorporate this feedback into the summary.`;
    }

    // Add length control instruction if enabled
    // Use original context word count if provided, otherwise fall back to events text
    if (settings.summaryLengthControl) {
        const wordCountForLength = originalContextWordCount ?? eventsText;
        userPrompt += buildLengthInstruction(wordCountForLength, settings.summaryLengthPercent || 10);
    }

    // Add keyword extraction instruction if enabled
    if (extractKeywords) {
        userPrompt += `

---
After your summary, on a new line, provide exactly 5 keywords that capture the key characters, locations, events, or topics from this content. Format as:
KEYWORDS: keyword1, keyword2, keyword3, keyword4, keyword5`;
    }

    log.log('Generating event-based summary...');

    const result = await callAPI(settings, summaryPrompt, userPrompt, 'summary');

    log.log('Event-based summary generated');
    return result;
}

