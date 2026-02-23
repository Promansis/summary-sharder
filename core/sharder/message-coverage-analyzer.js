/**
 * Message Coverage Analyzer
 * Detects which input chat messages are NOT represented in the sharder output.
 * Runs purely client-side â€” no API calls. Uses lexical overlap between each input
 * message and the pooled output tokens to identify uncovered story content.
 */

import { tokenize } from './evidence-checker.js';

/** Regex to split chat text built with indexFormat:'msg' into individual messages. */
const MSG_PATTERN = /\[Msg\s+(\d+)\]\s*\[([^\]]+)\]:\s*/g;

/**
 * Parse chatText (built by chat-text-builder with indexFormat:'msg') into messages.
 * @param {string} chatText
 * @returns {Array<{msgIndex:number, name:string, content:string}>}
 */
function parseMessages(chatText) {
    if (!chatText) return [];

    const messages = [];
    const matches = [...chatText.matchAll(MSG_PATTERN)];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const msgIndex = parseInt(match[1], 10);
        const name = match[2];
        const contentStart = match.index + match[0].length;
        const contentEnd = i + 1 < matches.length ? matches[i + 1].index : chatText.length;
        const content = chatText.slice(contentStart, contentEnd).trim();

        if (content) {
            messages.push({ msgIndex, name, content });
        }
    }

    return messages;
}

/**
 * Build a single token pool from all output section items.
 * @param {Object} outputSections - Parsed sections from the sharder pipeline
 * @returns {Set<string>}
 */
function poolOutputTokens(outputSections) {
    const pool = new Set();
    if (!outputSections || typeof outputSections !== 'object') return pool;

    for (const [key, items] of Object.entries(outputSections)) {
        if (key.startsWith('_') || !Array.isArray(items)) continue;
        for (const item of items) {
            const content = String(item?.content || '').trim();
            if (!content) continue;
            for (const token of tokenize(content)) {
                pool.add(token);
            }
        }
    }

    return pool;
}

/**
 * Analyze which input messages are NOT covered by the sharder output.
 *
 * @param {string} chatText - Chat text built with indexFormat:'msg'
 * @param {Object} outputSections - Parsed output sections from the pipeline
 * @param {{startIndex:number, endIndex:number}} _context - Message range context
 * @returns {{totalUncovered:number, uncoveredMessages:Array<{msgIndex:number, name:string, preview:string, coverageRatio:number}>}}
 */
export function analyzeMessageCoverage(chatText, outputSections, _context) {
    const report = {
        totalUncovered: 0,
        uncoveredMessages: [],
    };

    const messages = parseMessages(chatText);
    if (messages.length === 0) return report;

    const outputPool = poolOutputTokens(outputSections);
    if (outputPool.size === 0) return report;

    const COVERAGE_THRESHOLD = 0.15;
    const MIN_TOKENS = 4;

    for (const msg of messages) {
        const tokens = [...tokenize(msg.content)];
        if (tokens.length < MIN_TOKENS) continue;

        const overlap = tokens.filter((t) => outputPool.has(t)).length;
        const ratio = overlap / tokens.length;

        if (ratio < COVERAGE_THRESHOLD) {
            report.uncoveredMessages.push({
                msgIndex: msg.msgIndex,
                name: msg.name,
                preview: msg.content.substring(0, 150),
                coverageRatio: ratio,
            });
        }
    }

    report.totalUncovered = report.uncoveredMessages.length;

    if (report.totalUncovered > 0) {
        console.debug(
            `[SummarySharder] Message coverage: ${report.totalUncovered}/${messages.length} messages uncovered`
        );
    }

    return report;
}

