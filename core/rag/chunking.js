/**
 * RAG Chunking helpers for Summary Sharder.
 * Supports message chunking strategies, shard chunk creation, and scene tagging.
 */

import { normalizeExtractionResponse } from '../summarization/sharder-pipeline.js';

const LOG_PREFIX = '[SummarySharder:RAG]';

export const CHUNK_BEHAVIORS = {
    superseding: {
        sections: ['tone', 'currentState', 'worldState', 'characterNotes', 'voice'],
        defaultImportance: 65,
    },
    cumulative: {
        sections: ['events', 'keyDialogue', 'nsfwContent', 'scenes', 'sceneBreaks', 'characterStates', 'anchors', 'developments'],
        defaultImportance: 60,
    },
    rolling: {
        sections: ['relationshipShifts', 'callbacks', 'looseThreads'],
        defaultImportance: 70,
    },
};

export const SECTION_NAME_TO_KEY = {
    TONE: 'tone',
    CHARACTERS: 'characterNotes',
    'CHARACTER NOTES': 'characterNotes',
    WORLD: 'worldState',
    'WORLD STATE': 'worldState',
    TIMELINE: 'sceneBreaks',
    'SCENE BREAKS': 'sceneBreaks',
    EVENTS: 'events',
    NSFW: 'nsfwContent',
    'NSFW CONTENT': 'nsfwContent',
    DIALOGUE: 'keyDialogue',
    'KEY DIALOGUE': 'keyDialogue',
    VOICE: 'voice',
    STATES: 'characterStates',
    'CHARACTER STATES': 'characterStates',
    RELATIONSHIPS: 'relationshipShifts',
    'RELATIONSHIP SHIFTS': 'relationshipShifts',
    DEVELOPMENTS: 'developments',
    CALLBACKS: 'callbacks',
    THREADS: 'looseThreads',
    'LOOSE THREADS': 'looseThreads',
    SCENES: 'scenes',
    ANCHORS: 'anchors',
    CURRENT: 'currentState',
    'CURRENT STATE': 'currentState',
};

export const SECTION_KEY_TO_NAME = {
    tone: 'TONE',
    characterNotes: 'CHARACTERS',
    worldState: 'WORLD',
    sceneBreaks: 'TIMELINE',
    events: 'EVENTS',
    nsfwContent: 'NSFW',
    keyDialogue: 'DIALOGUE',
    voice: 'VOICE',
    characterStates: 'STATES',
    relationshipShifts: 'RELATIONSHIPS',
    developments: 'DEVELOPMENTS',
    callbacks: 'CALLBACKS',
    looseThreads: 'THREADS',
    scenes: 'SCENES',
    anchors: 'ANCHORS',
    currentState: 'CURRENT',
};

export const SECTION_KEY_TO_BEHAVIOR = Object.fromEntries(
    Object.entries(CHUNK_BEHAVIORS).flatMap(([behavior, config]) => (config.sections || []).map(sectionKey => [sectionKey, behavior])),
);

const CUMULATIVE_EVENT_WEIGHT_IMPORTANCE = new Map([
    ['🔴', 100],
    ['🟠', 80],
    ['🟡', 60],
    ['🟢', 40],
    ['⚪', 20],
]);

function fnv1a32(input, seed = 2166136261) {
    let hash = seed >>> 0;
    const str = String(input || '');
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/**
 * Build deterministic numeric chunk hash (safe uint53).
 * Similharity's Qdrant backend currently coerces hashes via parseInt(),
 * so decimal numeric hashes are required for consistent insert/delete/get behavior.
 * @param {string} input
 * @returns {number}
 */
export function buildChunkHash(input) {
    const base = String(input || '');
    const h1 = fnv1a32(`a|${base}`);
    const h2 = fnv1a32(`b|${base}`);

    // Keep within Number.MAX_SAFE_INTEGER.
    const hi21 = h1 & 0x001fffff;
    const lo32 = h2 >>> 0;
    const value = (hi21 * 4294967296) + lo32;

    return value > 0 ? value : 1;
}

/**
 * Normalize speaker label from a message object.
 * @param {Object} message
 * @returns {string}
 */
function getSpeaker(message) {
    if (!message) return 'unknown';
    if (message.name) return message.name;
    if (message.characterName) return message.characterName;
    if (message.is_user === true) return 'User';
    if (message.is_system === true) return 'System';
    return 'Assistant';
}

/**
 * Build stable text content from a message.
 * @param {Object} message
 * @returns {string}
 */
function getMessageText(message) {
    if (!message) return '';
    return String(message.mes ?? message.text ?? '').trim();
}

/**
 * Build metadata for non-summary (chat) chunk.
 * @param {number} messageIndex
 * @param {Object} message
 * @returns {Object}
 */
function buildChatMetadata(messageIndex, message) {
    return {
        messageIndex,
        speaker: getSpeaker(message),
        characterName: message?.characterName || message?.name || null,
        isSummaryChunk: false,
        sceneCode: null,
        timestamp: Date.now(),
    };
}

/**
 * Build a chunk object.
 * @param {string} text
 * @param {number} index
 * @param {Object} metadata
 * @returns {{text: string, hash: string, index: number, metadata: Object}}
 */
function makeChunk(text, index, metadata) {
    const normalizedText = String(text || '').trim();
    const identity = `${index}|${normalizedText}`;

    return {
        text: normalizedText,
        hash: buildChunkHash(identity),
        index,
        metadata,
    };
}

/**
 * Chunk messages based on configured strategy.
 * @param {Array<Object>} messages
 * @param {'per_message'|'conversation_turns'|'message_batch'|'scene_aware'} strategy
 * @param {number} batchSize
 * @returns {Array<{text: string, hash: string, index: number, metadata: Object}>}
 */
export function chunkMessages(messages, strategy = 'per_message', batchSize = 5) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return [];
    }

    const safeBatchSize = Math.max(1, Number(batchSize) || 5);
    const chunks = [];

    const effectiveStrategy = strategy === 'scene_aware' ? 'per_message' : strategy;

    if (effectiveStrategy === 'message_batch') {
        for (let i = 0; i < messages.length; i += safeBatchSize) {
            const group = messages.slice(i, i + safeBatchSize);
            const lines = group
                .map((m, offset) => {
                    const idx = i + offset;
                    const speaker = getSpeaker(m);
                    const text = getMessageText(m);
                    return text ? `[${idx}] ${speaker}: ${text}` : '';
                })
                .filter(Boolean);

            if (lines.length === 0) continue;

            const startIndex = i;
            const endIndex = i + group.length - 1;
            const text = lines.join('\n');
            const first = group[0];
            const metadata = {
                ...buildChatMetadata(startIndex, first),
                startIndex,
                endIndex,
                speaker: 'mixed',
            };

            chunks.push(makeChunk(text, startIndex, metadata));
        }

        return chunks;
    }

    if (effectiveStrategy === 'conversation_turns') {
        let pendingUser = null;

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const text = getMessageText(msg);
            if (!text) continue;

            const isUser = msg?.is_user === true;

            if (isUser) {
                pendingUser = { index: i, speaker: getSpeaker(msg), text, message: msg };
                continue;
            }

            if (pendingUser) {
                const aiSpeaker = getSpeaker(msg);
                const pairText = `[${pendingUser.index}] ${pendingUser.speaker}: ${pendingUser.text}\n[${i}] ${aiSpeaker}: ${text}`;
                const metadata = {
                    ...buildChatMetadata(pendingUser.index, pendingUser.message),
                    startIndex: pendingUser.index,
                    endIndex: i,
                    speaker: `${pendingUser.speaker}+${aiSpeaker}`,
                };
                chunks.push(makeChunk(pairText, pendingUser.index, metadata));
                pendingUser = null;
            } else {
                const metadata = buildChatMetadata(i, msg);
                chunks.push(makeChunk(`[${i}] ${getSpeaker(msg)}: ${text}`, i, metadata));
            }
        }

        if (pendingUser) {
            const metadata = buildChatMetadata(pendingUser.index, pendingUser.message);
            chunks.push(makeChunk(`[${pendingUser.index}] ${pendingUser.speaker}: ${pendingUser.text}`, pendingUser.index, metadata));
        }

        return chunks;
    }

    // Default: per_message
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const text = getMessageText(msg);
        if (!text) continue;

        const metadata = buildChatMetadata(i, msg);
        chunks.push(makeChunk(`[${i}] ${getSpeaker(msg)}: ${text}`, i, metadata));
    }

    return chunks;
}

/**
 * Build shard chunk (standard mode).
 * @param {string} shardText
 * @param {number} startIdx
 * @param {number} endIdx
 * @param {string[]} keywords
 * @returns {{text: string, hash: string, index: number, metadata: Object}}
 */
export function chunkShard(shardText, startIdx, endIdx, keywords = []) {
    const text = String(shardText || '').trim();
    const startIndex = Number.isFinite(startIdx) ? startIdx : 0;
    const endIndex = Number.isFinite(endIdx) ? endIdx : startIndex;

    const metadata = {
        isSummaryChunk: true,
        startIndex,
        endIndex,
        messageIndex: startIndex,
        speaker: 'SummarySharder',
        characterName: null,
        keywords: Array.isArray(keywords) ? keywords : [],
        importance: 100,
        sceneCode: null,
        timestamp: Date.now(),
    };

    return makeChunk(text, startIndex, metadata);
}

/**
 * Build shard chunk (scene-aware mode).
 * @param {string} shardText
 * @param {number} startIdx
 * @param {number} endIdx
 * @param {string[]} keywords
 * @param {string|null} sceneCode
 * @returns {{text: string, hash: string, index: number, metadata: Object}}
 */
export function chunkShardSceneAware(shardText, startIdx, endIdx, keywords = [], sceneCode = null) {
    const chunk = chunkShard(shardText, startIdx, endIdx, keywords);
    chunk.metadata.sceneCode = sceneCode || null;
    return chunk;
}

/**
 * Extract normalized scene code tokens from text.
 * Supports [S12:3] and (S12:3) forms.
 * @param {string} text
 * @returns {string[]}
 */
export function extractSceneCodesFromText(text) {
    const input = String(text || '');
    const regex = /[\[(]S(\d+):(\d+)[\])]/g;
    const out = [];
    const seen = new Set();
    let match;

    while ((match = regex.exec(input)) !== null) {
        const code = `S${match[1]}:${match[2]}`;
        if (!seen.has(code)) {
            seen.add(code);
            out.push(code);
        }
    }

    return out;
}

function normalizeHeaderName(name) {
    return String(name || '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function toSectionKeyFromHeader(headerName) {
    const normalized = normalizeHeaderName(headerName);
    return SECTION_NAME_TO_KEY[normalized] || null;
}

function parseSectionHeader(line) {
    const match = String(line || '').match(/^###\s+\S+\s+(.+?)\s*$/);
    if (!match) return null;
    return toSectionKeyFromHeader(match[1]);
}

function splitSectionItems(sectionText) {
    const input = String(sectionText || '').trim();
    if (!input) return [];

    const lines = input.split('\n');
    const items = [];
    let current = '';

    const isNewItem = (line) => {
        const trimmed = String(line || '').trim();
        if (!trimmed) return false;
        return /^[-*•]\s+/.test(trimmed)
            || /^\d+\.\s+/.test(trimmed)
            || /^[\[(]S\d+:\d+[\])]/.test(trimmed)
            || /\|/.test(trimmed)
            || /→/.test(trimmed);
    };

    const flush = () => {
        const text = current.trim();
        if (text) items.push(text);
        current = '';
    };

    for (const rawLine of lines) {
        const line = String(rawLine || '');
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (!current) {
            current = trimmed;
            continue;
        }

        if (isNewItem(trimmed)) {
            flush();
            current = trimmed;
        } else {
            current += `\n${trimmed}`;
        }
    }

    flush();
    return items;
}

export function parseSectionsFromShardText(text) {
    const normalized = normalizeExtractionResponse(String(text || ''));
    const lines = normalized.split('\n');
    const sections = new Map();
    let activeKey = null;
    let buffer = [];

    const flush = () => {
        if (!activeKey) return;
        const value = buffer.join('\n').trim();
        if (value) {
            sections.set(activeKey, value);
        }
        buffer = [];
    };

    for (const line of lines) {
        const sectionKey = parseSectionHeader(line);
        if (sectionKey) {
            flush();
            activeKey = sectionKey;
            continue;
        }

        if (activeKey) {
            buffer.push(line);
        }
    }

    flush();
    return sections;
}

export function groupItemsBySceneCode(sectionText) {
    const buckets = new Map();
    const items = splitSectionItems(sectionText);

    for (const item of items) {
        const codes = extractSceneCodesFromText(item);
        const sceneCode = codes[0] || null;
        if (!buckets.has(sceneCode)) {
            buckets.set(sceneCode, []);
        }
        buckets.get(sceneCode).push(item);
    }

    return buckets;
}

export function parseRollingEntityKey(sectionType, itemText) {
    const input = String(itemText || '').trim();
    if (!input) return null;

    if (sectionType === 'relationshipShifts') {
        const match = input.match(/\[([^\]]+)\]\s*(?:→|->)\s*\[([^\]]+)\]/);
        if (!match) return null;
        const from = String(match[1] || '').trim().toLowerCase();
        const to = String(match[2] || '').trim().toLowerCase();
        if (!from || !to) return null;
        return `${from}->${to}`;
    }

    if (sectionType === 'callbacks' || sectionType === 'looseThreads') {
        const firstField = input.split('|')[0];
        const key = String(firstField || '').replace(/^[-*•]\s+/, '').trim().toLowerCase();
        return key || null;
    }

    return null;
}

function parseRollingStatus(sectionType, itemText) {
    if (sectionType !== 'callbacks' && sectionType !== 'looseThreads') {
        return null;
    }

    const match = String(itemText || '').match(/status\s*:\s*([A-Z_]+)/i);
    if (!match) return null;
    return String(match[1] || '').trim().toUpperCase();
}

export function calculateCumulativeImportance(items) {
    const safeItems = Array.isArray(items) ? items : [];
    let maxImportance = CHUNK_BEHAVIORS.cumulative.defaultImportance;

    for (const item of safeItems) {
        const text = String(item || '');
        for (const [emoji, weight] of CUMULATIVE_EVENT_WEIGHT_IMPORTANCE.entries()) {
            if (text.includes(emoji)) {
                maxImportance = Math.max(maxImportance, weight);
            }
        }
    }

    return maxImportance;
}

function buildSectionBlock(sectionKey, sectionText) {
    const sectionName = SECTION_KEY_TO_NAME[sectionKey] || String(sectionKey || '').toUpperCase();
    const text = String(sectionText || '').trim();
    return `### ${sectionName}\n${text}`;
}

export function chunkShardBySection(shardText, startIdx, endIdx, keywords = [], shardTimestamp = Date.now()) {
    const sections = parseSectionsFromShardText(shardText);
    const chunks = [];
    const resolvedEntities = [];
    const resolvedKeys = new Set();
    const startIndex = Number.isFinite(startIdx) ? startIdx : 0;
    const endIndex = Number.isFinite(endIdx) ? endIdx : startIndex;
    const safeKeywords = Array.isArray(keywords) ? keywords : [];
    const baseTimestamp = Number.isFinite(shardTimestamp) ? shardTimestamp : Date.now();

    let indexOffset = 0;
    const nextIndex = () => {
        const value = startIndex + indexOffset;
        indexOffset += 1;
        return value;
    };

    const supersedingBlocks = [];
    for (const sectionKey of CHUNK_BEHAVIORS.superseding.sections) {
        const sectionText = sections.get(sectionKey);
        if (!sectionText) continue;
        supersedingBlocks.push(buildSectionBlock(sectionKey, sectionText));
    }

    if (supersedingBlocks.length > 0) {
        const text = supersedingBlocks.join('\n\n').trim();
        const index = nextIndex();
        const chunk = makeChunk(text, index, {
            isSummaryChunk: true,
            startIndex,
            endIndex,
            messageIndex: startIndex,
            speaker: 'SummarySharder',
            characterName: null,
            keywords: safeKeywords,
            importance: CHUNK_BEHAVIORS.superseding.defaultImportance,
            sceneCode: null,
            timestamp: baseTimestamp,
            chunkBehavior: 'superseding',
            sectionTypes: [...CHUNK_BEHAVIORS.superseding.sections],
            freshnessEndIndex: endIndex,
        });
        chunk.hash = buildChunkHash(`${index}|superseding|${text}|${startIndex}|${endIndex}`);
        chunks.push(chunk);
    }

    const cumulativeByScene = new Map();
    for (const sectionKey of CHUNK_BEHAVIORS.cumulative.sections) {
        const sectionText = sections.get(sectionKey);
        if (!sectionText) continue;

        const grouped = groupItemsBySceneCode(sectionText);
        for (const [sceneCode, items] of grouped.entries()) {
            if (items.length === 0) continue;
            const sceneKey = sceneCode || null;
            if (!cumulativeByScene.has(sceneKey)) {
                cumulativeByScene.set(sceneKey, new Map());
            }
            const sectionMap = cumulativeByScene.get(sceneKey);
            if (!sectionMap.has(sectionKey)) {
                sectionMap.set(sectionKey, []);
            }
            sectionMap.get(sectionKey).push(...items);
        }
    }

    for (const [sceneCode, sectionMap] of cumulativeByScene.entries()) {
        const sectionBlocks = [];
        const sectionTypes = [];
        const allItems = [];

        for (const [sectionKey, items] of sectionMap.entries()) {
            if (!items || items.length === 0) continue;
            sectionTypes.push(sectionKey);
            allItems.push(...items);
            sectionBlocks.push(buildSectionBlock(sectionKey, items.join('\n')));
        }

        if (sectionBlocks.length === 0) continue;

        const text = sectionBlocks.join('\n\n').trim();
        const index = nextIndex();
        const chunk = makeChunk(text, index, {
            isSummaryChunk: true,
            startIndex,
            endIndex,
            messageIndex: startIndex,
            speaker: 'SummarySharder',
            characterName: null,
            keywords: safeKeywords,
            importance: calculateCumulativeImportance(allItems),
            sceneCode,
            timestamp: baseTimestamp,
            chunkBehavior: 'cumulative',
            sectionTypes,
            freshnessEndIndex: endIndex,
        });
        chunk.hash = buildChunkHash(`${index}|cumulative|${sceneCode || 'none'}|${text}|${startIndex}|${endIndex}`);
        chunks.push(chunk);
    }

    for (const sectionKey of CHUNK_BEHAVIORS.rolling.sections) {
        const sectionText = sections.get(sectionKey);
        if (!sectionText) continue;
        const items = splitSectionItems(sectionText);

        for (const item of items) {
            const entityKey = parseRollingEntityKey(sectionKey, item);
            if (!entityKey) continue;
            const sceneCode = extractSceneCodesFromText(item)[0] || null;
            const status = parseRollingStatus(sectionKey, item);
            const text = buildSectionBlock(sectionKey, item);
            const index = nextIndex();

            const chunk = makeChunk(text, index, {
                isSummaryChunk: true,
                startIndex,
                endIndex,
                messageIndex: startIndex,
                speaker: 'SummarySharder',
                characterName: null,
                keywords: safeKeywords,
                importance: CHUNK_BEHAVIORS.rolling.defaultImportance,
                sceneCode,
                timestamp: baseTimestamp,
                chunkBehavior: 'rolling',
                sectionType: sectionKey,
                sectionTypes: [sectionKey],
                entityKey,
                status,
                freshnessEndIndex: endIndex,
            });
            chunk.hash = buildChunkHash(`${index}|rolling|${sectionKey}|${entityKey}|${sceneCode || 'none'}|${item}|${startIndex}|${endIndex}`);
            chunks.push(chunk);

            const isResolvedCallback = sectionKey === 'callbacks' && status === 'FIRED';
            const isResolvedThread = sectionKey === 'looseThreads' && status === 'RESOLVED';
            if (isResolvedCallback || isResolvedThread) {
                const resolvedKey = `${sectionKey}|${entityKey}`;
                if (!resolvedKeys.has(resolvedKey)) {
                    resolvedKeys.add(resolvedKey);
                    resolvedEntities.push({
                        sectionType: sectionKey,
                        entityKey,
                        status,
                    });
                }
            }
        }
    }

    console.log(`${LOG_PREFIX} Built ${chunks.length} section-aware chunk(s) from shard ${startIndex}-${endIndex}`);
    return { chunks, resolvedEntities };
}

/**
 * Treat entire prose summary as a single chunk (Standard Mode).
 * @param {string} text
 * @param {number} startIdx
 * @param {number} endIdx
 * @param {string[]} keywords
 * @returns {Array<{text: string, hash: string, index: number, metadata: Object}>}
 */
export function chunkProseByFull(text, startIdx, endIdx, keywords = []) {
    const normalizedText = String(text || '').trim();
    const startIndex = Number.isFinite(startIdx) ? startIdx : 0;
    const endIndex = Number.isFinite(endIdx) ? endIdx : startIndex;
    const safeKeywords = Array.isArray(keywords) ? keywords : [];

    if (!normalizedText) return [];

    const metadata = {
        isSummaryChunk: true,
        startIndex,
        endIndex,
        messageIndex: startIndex,
        speaker: 'SummarySharder',
        characterName: null,
        keywords: safeKeywords,
        importance: 100,
        sceneCode: null,
        timestamp: Date.now(),
    };

    return [makeChunk(normalizedText, startIndex, metadata)];
}

/**
 * Split prose summary by paragraph breaks for Standard Mode.
 * @param {string} text
 * @param {number} startIdx
 * @param {number} endIdx
 * @param {string[]} keywords
 * @returns {Array<{text: string, hash: string, index: number, metadata: Object}>}
 */
export function chunkProseByParagraph(text, startIdx, endIdx, keywords = []) {
    const normalizedText = String(text || '').trim();
    const startIndex = Number.isFinite(startIdx) ? startIdx : 0;
    const endIndex = Number.isFinite(endIdx) ? endIdx : startIndex;
    const safeKeywords = Array.isArray(keywords) ? keywords : [];

    if (!normalizedText) return [];

    const paragraphs = normalizedText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    if (paragraphs.length === 0) return [];

    const timestamp = Date.now();
    return paragraphs.map((para, offset) => {
        const index = startIndex + offset;
        const metadata = {
            isSummaryChunk: true,
            startIndex,
            endIndex,
            messageIndex: startIndex,
            speaker: 'SummarySharder',
            characterName: null,
            keywords: safeKeywords,
            importance: 100,
            sceneCode: null,
            timestamp,
        };
        return makeChunk(para, index, metadata);
    });
}

/**
 * Dispatcher: chunk a prose summary using the configured mode (Standard Mode).
 * @param {string} text
 * @param {number} startIdx
 * @param {number} endIdx
 * @param {string[]} keywords
 * @param {'full_summary'|'paragraph'} proseChunkingMode
 * @returns {Array<{text: string, hash: string, index: number, metadata: Object}>}
 */
export function chunkProseSummary(text, startIdx, endIdx, keywords = [], proseChunkingMode = 'paragraph') {
    return proseChunkingMode === 'full_summary'
        ? chunkProseByFull(text, startIdx, endIdx, keywords)
        : chunkProseByParagraph(text, startIdx, endIdx, keywords);
}

/**
 * Build scene-aware shard chunks based on explicit scene codes in content.
 * If no scene codes are present, emits a single chunk with optional override.
 * @param {string} shardText
 * @param {number} startIdx
 * @param {number} endIdx
 * @param {string[]} keywords
 * @param {string|null} sceneCodeOverride
 * @returns {Array<{text: string, hash: string, index: number, metadata: Object}>}
 */
export function chunkShardBySceneCodes(shardText, startIdx, endIdx, keywords = [], sceneCodeOverride = null) {
    const text = String(shardText || '').trim();
    if (!text) return [];

    const explicitCodes = extractSceneCodesFromText(text);
    if (explicitCodes.length === 0) {
        return [chunkShardSceneAware(text, startIdx, endIdx, keywords, sceneCodeOverride || null)];
    }

    const lines = text.split('\n');
    const buckets = new Map();
    let activeCode = explicitCodes[0];

    for (const code of explicitCodes) {
        buckets.set(code, []);
    }

    for (const rawLine of lines) {
        const line = String(rawLine || '');
        const codes = extractSceneCodesFromText(line);
        if (codes.length > 0) {
            activeCode = codes[0];
            if (!buckets.has(activeCode)) {
                buckets.set(activeCode, []);
            }
        }

        if (!buckets.has(activeCode)) {
            buckets.set(activeCode, []);
        }
        buckets.get(activeCode).push(line);
    }

    const chunks = [];
    let offset = 0;
    for (const [code, bucketLines] of buckets.entries()) {
        const bucketText = bucketLines.join('\n').trim();
        if (!bucketText) continue;
        const chunk = chunkShardSceneAware(bucketText, startIdx, endIdx, keywords, code);
        chunk.index = (Number.isFinite(startIdx) ? startIdx : 0) + offset;
        chunk.hash = buildChunkHash(`${chunk.index}|${bucketText}|${code}`);
        chunks.push(chunk);
        offset += 1;
    }

    if (chunks.length === 0) {
        return [chunkShardSceneAware(text, startIdx, endIdx, keywords, sceneCodeOverride || explicitCodes[0] || null)];
    }

    console.log(`${LOG_PREFIX} Built ${chunks.length} scene chunk(s) from explicit scene codes`);
    return chunks;
}
