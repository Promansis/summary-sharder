/**
 * Shared shard parsing helpers used by sharder selection and pruning flows.
 */

import { parseSceneCodes } from './sharder-pipeline.js';

/**
 * Parse consolidated shard format (different from extraction format)
 * @param {string} text - Consolidated shard text
 * @returns {Object} Parsed sections
 */
export function parseConsolidatedShard(text) {
    text = String(text || '').replace(/===END===/g, '').trim();

    const sections = {
        key: [],
        tone: [],
        characters: [],
        world: [],
        timeline: [],
        events: [],
        states: [],
        relationships: [],
        developments: [],
        nsfwRegistry: [],
        dialogueKeys: [],
        callbacks: [],
        looseThreads: [],
        scenesExpanded: [],
        currentState: [],
        sourceMap: [],
    };

    const sectionMappings = [
        { pattern: /\[(KEY|SHARD KEY)\]/i, key: 'key' },
        { pattern: /\[TONE\]/i, key: 'tone' },
        { pattern: /\[(CHARACTERS|CHARACTER REGISTRY|CHR)\]/i, key: 'characters' },
        { pattern: /\[(WORLD|WORLD STATE|WLD)\]/i, key: 'world' },
        { pattern: /\[TIMELINE\]/i, key: 'timeline' },
        { pattern: /\[EVENTS\]/i, key: 'events' },
        { pattern: /\[STATES\]/i, key: 'states' },
        { pattern: /\[(RELATIONSHIPS|REL)\]/i, key: 'relationships' },
        { pattern: /\[(DEVELOPMENTS|DEV)\]/i, key: 'developments' },
        { pattern: /\[(NSFW REGISTRY|NSFW)\]/i, key: 'nsfwRegistry' },
        { pattern: /\[(DIALOGUE KEYS|DIALOGUE|DIA)\]/i, key: 'dialogueKeys' },
        { pattern: /\[(CALLBACKS|CBK)\]/i, key: 'callbacks' },
        { pattern: /\[(LOOSE THREADS|THREADS|THR)\]/i, key: 'looseThreads' },
        { pattern: /\[(SCENES EXPANDED|SCENES|SCN)\]/i, key: 'scenesExpanded' },
        { pattern: /\[(CURRENT STATE|CURRENT|CUR)\]/i, key: 'currentState' },
        { pattern: /\[(SOURCE MAP|SCENE CODE MAP)\]/i, key: 'sourceMap' },
    ];

    const lineSplitSectionKeys = new Set([
        'characters',
        'relationships',
        'developments',
        'callbacks',
        'looseThreads',
        'world',
        'sourceMap',
        'currentState',
        'key',
        'timeline',
        'events',
        'states',
        'dialogueKeys',
        'scenesExpanded',
        'nsfwRegistry',
    ]);

    const nextSectionPattern = /\n\[[A-Z][A-Z\s]*\]/;

    for (const mapping of sectionMappings) {
        const startMatch = text.match(mapping.pattern);
        if (!startMatch) continue;

        const contentStart = startMatch.index + startMatch[0].length;
        const remainingText = text.slice(contentStart);
        const nextMatch = remainingText.match(nextSectionPattern);
        const contentEnd = nextMatch ? contentStart + nextMatch.index : text.length;
        const content = text.slice(contentStart, contentEnd).trim();
        const parser = lineSplitSectionKeys.has(mapping.key) ? parseLineItems : parseSectionItems;
        sections[mapping.key] = parser(content);
    }

    return sections;
}

/**
 * Check if item content is empty or just formatting
 * @param {string} content - Item content
 * @returns {boolean}
 */
export function isEmptyItem(content) {
    if (!content) return true;
    const trimmed = content.trim();
    const lower = trimmed.toLowerCase();

    return trimmed === '---'
        || trimmed === '-'
        || trimmed === '—'
        || trimmed === '–'
        || lower === 'none'
        || lower === 'none.'
        || lower === '(none)'
        || lower === 'n/a'
        || lower === 'na'
        || lower.startsWith('none present')
        || lower.startsWith('none.')
        || lower.startsWith('none new')
        || (lower.startsWith('no ') && lower.length < 25);
}

function parseLineItems(content) {
    if (!content) return [];

    const trimmed = content.trim();
    const lower = trimmed.toLowerCase();
    if (lower === 'none'
        || lower === 'none.'
        || lower === '(none)'
        || lower === 'n/a'
        || lower === '-'
        || lower === '—'
        || lower === '–'
        || lower.startsWith('none present')
        || lower.startsWith('none.')
        || lower.startsWith('none new')
        || (lower.startsWith('no ') && lower.length < 25)) {
        return [];
    }

    const items = [];
    const lines = content.split('\n');
    for (const line of lines) {
        const l = String(line || '').trim();
        if (!l || isEmptyItem(l)) continue;
        items.push({
            content: l,
            sceneCodes: parseSceneCodes(l),
        });
    }
    return items;
}

function parseSectionItems(content) {
    if (!content) return [];

    const trimmed = content.trim();
    const lower = trimmed.toLowerCase();
    if (lower === 'none'
        || lower === 'none.'
        || lower === '(none)'
        || lower === 'n/a'
        || lower === '-'
        || lower === '—'
        || lower === '–'
        || lower.startsWith('none present')
        || lower.startsWith('none.')
        || lower.startsWith('none new')
        || (lower.startsWith('no ') && lower.length < 25)) {
        return [];
    }

    const items = [];
    const lines = content.split('\n');
    let currentItem = null;

    for (const line of lines) {
        const trimmedLine = String(line || '').trim();
        if (!trimmedLine) continue;

        const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*');
        const numberedMatch = trimmedLine.match(/^(\d+)\.\s*/);

        if (isBullet || numberedMatch) {
            if (currentItem && !isEmptyItem(currentItem.content)) {
                items.push(currentItem);
            }
            const itemContent = isBullet
                ? trimmedLine.replace(/^[-•*]\s*/, '').trim()
                : trimmedLine.replace(/^\d+\.\s*/, '').trim();

            currentItem = {
                content: itemContent,
                sceneCodes: parseSceneCodes(itemContent),
            };
        } else if (currentItem) {
            currentItem.content += '\n' + trimmedLine;
            currentItem.sceneCodes = parseSceneCodes(currentItem.content);
        } else {
            currentItem = {
                content: trimmedLine,
                sceneCodes: parseSceneCodes(trimmedLine),
            };
        }
    }

    if (currentItem && !isEmptyItem(currentItem.content)) {
        items.push(currentItem);
    }

    return items;
}

/**
 * Fuzzy match two strings to determine similarity
 * @param {string} a
 * @param {string} b
 * @param {number} threshold
 * @returns {boolean}
 */
export function fuzzyMatch(a, b, threshold) {
    if (!a || !b) return false;

    const normA = a.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const normB = b.toLowerCase().replace(/[^\w\s]/g, '').trim();

    if (normA === normB) return true;

    const wordsA = normA.split(/\s+/).filter(w => w.length > 3);
    const wordsB = normB.split(/\s+/).filter(w => w.length > 3);

    if (wordsA.length === 0 || wordsB.length === 0) {
        return normA.includes(normB) || normB.includes(normA);
    }

    let matches = 0;
    for (const wordA of wordsA) {
        if (wordsB.some(wordB => wordA === wordB || wordA.includes(wordB) || wordB.includes(wordA))) {
            matches++;
        }
    }

    const similarity = matches / Math.max(wordsA.length, wordsB.length);
    return similarity >= threshold;
}
