/**
 * Shared pure helpers used by retrieval and debug pipeline flows.
 */

export const ROLLING_SECTION_ORDER = ['relationshipShifts', 'callbacks', 'looseThreads'];
export const ROLLING_SECTION_LABELS = {
    relationshipShifts: 'RELATIONSHIPS',
    callbacks: 'CALLBACKS',
    looseThreads: 'THREADS',
};
export const ANCHORS_SECTION_KEY = 'anchors';
export const ANCHORS_SECTION_LABEL = 'ANCHORS';
export const DEVELOPMENTS_SECTION_KEY = 'developments';
export const DEVELOPMENTS_SECTION_LABEL = 'DEVELOPMENTS';
export const CUMULATIVE_SECTION_ORDER = ['events', 'scenes', 'keyDialogue', 'characterStates', 'sceneBreaks', 'nsfwContent'];
export const PINNED_TIER_ORDER = ['developments', 'anchors', 'relationshipShifts', 'callbacks', 'looseThreads'];

/**
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

/**
 * @param {Object} item
 * @returns {number}
 */
export function getFreshnessEndIndex(item) {
    const value = Number(
        item?.metadata?.freshnessEndIndex
        ?? item?.metadata?.endIndex
        ?? item?.metadata?.messageIndex
        ?? item?.index
        ?? -1,
    );
    return Number.isFinite(value) ? value : -1;
}

/**
 * @param {Object} item
 * @returns {string}
 */
export function getRollingKey(item) {
    const sectionType = String(item?.metadata?.sectionType || '');
    const entityKey = String(item?.metadata?.entityKey || '');
    if (!sectionType || !entityKey) return '';
    return `${sectionType}|${entityKey}`;
}

/**
 * Keep the freshest rolling chunk for each sectionType|entityKey key.
 * @param {Array<Object>} items
 * @returns {Array<Object>}
 */
export function dedupeLatestRolling(items) {
    const latestRolling = new Map();

    for (const item of (items || [])) {
        if (item?.metadata?.chunkBehavior !== 'rolling') continue;
        const rollingKey = getRollingKey(item);
        if (!rollingKey) continue;

        const existing = latestRolling.get(rollingKey);
        if (!existing || getFreshnessEndIndex(item) > getFreshnessEndIndex(existing)) {
            latestRolling.set(rollingKey, item);
        }
    }

    return [...latestRolling.values()];
}

/**
 * Merge query-derived and fallback rolling chunks, then dedupe by latest freshness.
 * Query items are traversed first so their key order is preserved for pinned output.
 * @param {Array<Object>} queryRolling
 * @param {Array<Object>} fallbackRolling
 * @returns {Array<Object>}
 */
export function mergeLatestRolling(queryRolling, fallbackRolling) {
    return dedupeLatestRolling([...(queryRolling || []), ...(fallbackRolling || [])]);
}

/**
 * @param {string} text
 * @returns {string}
 */
export function stripLeadingSectionHeader(text) {
    const input = String(text || '').trim();
    if (!input) return '';
    const lines = input.split('\n');
    if (lines.length > 1 && /^###\s+/.test(String(lines[0] || '').trim())) {
        return lines.slice(1).join('\n').trim();
    }
    return input;
}

/**
 * Compact many per-entity rolling chunks into at most one chunk per rolling section.
 * Keeps full key coverage while avoiding repeated section headers in injection text.
 * @param {Array<Object>} rollingItems
 * @param {Object} [rag]
 * @returns {Array<Object>}
 */
export function compactRollingPinnedChunks(rollingItems, rag) {
    const grouped = new Map();

    const maxItemsPerSection = Number(rag?.maxItemsPerCompactedSection) || 5;

    for (const item of (rollingItems || [])) {
        if (item?.metadata?.chunkBehavior !== 'rolling') continue;
        const rollingKey = getRollingKey(item);
        if (!rollingKey) continue;
        const sectionType = String(item?.metadata?.sectionType || '');
        if (!sectionType) continue;
        if (!grouped.has(sectionType)) {
            grouped.set(sectionType, []);
        }
        grouped.get(sectionType).push(item);
    }

    const sectionTypes = [
        ...ROLLING_SECTION_ORDER.filter(section => grouped.has(section)),
        ...[...grouped.keys()].filter(section => !ROLLING_SECTION_ORDER.includes(section)),
    ];

    const out = [];
    for (const sectionType of sectionTypes) {
        const items = grouped.get(sectionType) || [];
        if (items.length === 0) continue;

        items.sort((a, b) => getFreshnessEndIndex(b) - getFreshnessEndIndex(a));
        const seenBodies = new Set();
        const bodies = [];
        let freshest = -1;
        let bestScore = Number.NEGATIVE_INFINITY;

        for (const item of items) {
            if (bodies.length >= maxItemsPerSection) break;

            const body = stripLeadingSectionHeader(item?.text || '');
            if (!body) continue;
            const normalizedBody = normalizeText(body);
            if (!normalizedBody || seenBodies.has(normalizedBody)) continue;
            seenBodies.add(normalizedBody);
            bodies.push(body);
            freshest = Math.max(freshest, getFreshnessEndIndex(item));
            bestScore = Math.max(bestScore, Number(item?.score) || 0);
        }

        if (bodies.length === 0) continue;

        const heading = ROLLING_SECTION_LABELS[sectionType] || String(sectionType || '').toUpperCase();
        out.push({
            text: `### ${heading}\n${bodies.join('\n')}`.trim(),
            hash: `rolling-group|${sectionType}|${freshest}|${bodies.length}`,
            score: Number.isFinite(bestScore) ? bestScore : 0,
            metadata: {
                chunkBehavior: 'rolling',
                sectionType,
                sectionTypes: [sectionType],
                entityKey: '__pinned_group__',
                freshnessEndIndex: freshest,
                pinnedGroup: true,
                pinnedGroupCount: bodies.length,
            },
        });
    }

    return out;
}

/**
 * @param {string} text
 * @param {string} headingName
 * @returns {string}
 */
export function extractSectionBodyByHeading(text, headingName) {
    const lines = String(text || '').split('\n');
    const target = String(headingName || '').trim().toUpperCase();
    let inTarget = false;
    const buffer = [];

    for (const rawLine of lines) {
        const line = String(rawLine || '');
        const header = line.match(/^###\s+(.+?)\s*$/);
        if (header) {
            const headerName = String(header[1] || '').trim().toUpperCase();
            if (inTarget && headerName !== target) break;
            inTarget = headerName === target;
            continue;
        }
        if (inTarget) {
            buffer.push(line);
        }
    }

    return buffer.join('\n').trim();
}

/**
 * @param {string} sectionText
 * @returns {Array<string>}
 */
export function splitSectionListItems(sectionText) {
    const input = String(sectionText || '').trim();
    if (!input) return [];

    const lines = input.split('\n');
    const items = [];
    let current = '';

    const flush = () => {
        const value = String(current || '').trim();
        if (value) items.push(value);
        current = '';
    };

    for (const rawLine of lines) {
        const line = String(rawLine || '').trim();
        if (!line) continue;

        if (/^[-*\u2022]\s+/.test(line)) {
            flush();
            current = line;
        } else if (!current) {
            current = line;
        } else {
            current += ` ${line}`;
        }
    }

    flush();
    return items;
}

/**
 * @param {string} itemText
 * @returns {string}
 */
export function getAnchorKey(itemText) {
    const text = String(itemText || '')
        .replace(/^[-*\u2022]\s+/, '')
        .trim();
    if (!text) return '';
    return String(text.split('|')[0] || '').trim().toLowerCase();
}

/**
 * Extract latest anchors by anchor key from candidate chunks.
 * @param {Array<Object>} items
 * @returns {Array<{key: string, text: string, freshness: number, score: number}>}
 */
export function collectLatestAnchors(items) {
    const latest = new Map();

    for (const item of (items || [])) {
        const sectionTypes = Array.isArray(item?.metadata?.sectionTypes)
            ? item.metadata.sectionTypes
            : [];
        const likelyHasAnchors = sectionTypes.includes(ANCHORS_SECTION_KEY)
            || /(^|\n)###\s+ANCHORS\b/i.test(String(item?.text || ''));
        if (!likelyHasAnchors) continue;

        const sectionBody = extractSectionBodyByHeading(item?.text || '', ANCHORS_SECTION_LABEL);
        if (!sectionBody) continue;

        const entries = splitSectionListItems(sectionBody);
        for (const entry of entries) {
            const key = getAnchorKey(entry);
            if (!key) continue;

            const normalized = String(entry || '').trim();
            if (!normalized) continue;
            const freshness = getFreshnessEndIndex(item);
            const score = Number(item?.score) || 0;
            const value = {
                key,
                text: /^[-*\u2022]\s+/.test(normalized) ? normalized : `- ${normalized}`,
                freshness,
                score,
            };

            const existing = latest.get(key);
            if (!existing || freshness > existing.freshness) {
                latest.set(key, value);
            }
        }
    }

    return [...latest.values()];
}

/**
 * @param {Array<{key: string, text: string, freshness: number, score: number}>} queryAnchors
 * @param {Array<{key: string, text: string, freshness: number, score: number}>} fallbackAnchors
 * @returns {Array<{key: string, text: string, freshness: number, score: number}>}
 */
export function mergeLatestAnchors(queryAnchors, fallbackAnchors) {
    const latest = new Map();
    for (const entry of [...(queryAnchors || []), ...(fallbackAnchors || [])]) {
        const key = String(entry?.key || '').trim();
        if (!key) continue;
        const freshness = Number(entry?.freshness);
        const existing = latest.get(key);
        if (!existing || freshness > Number(existing?.freshness)) {
            latest.set(key, entry);
        }
    }
    return [...latest.values()];
}

/**
 * Compact multiple anchor chunks into a single block.
 * @param {Array<Object>} anchorEntries
 * @param {Object} [rag]
 * @returns {Array<Object>}
 */
export function compactAnchorsPinnedChunks(anchorEntries, rag) {
    const safeEntries = Array.isArray(anchorEntries) ? anchorEntries : [];
    if (safeEntries.length === 0) return [];

    const maxAnchors = Number(rag?.maxItemsPerCompactedSection) || 5;

    safeEntries.sort((a, b) => Number(b?.freshness || -1) - Number(a?.freshness || -1));

    const lines = [];
    const seen = new Set();
    let freshest = -1;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const entry of safeEntries) {
        if (lines.length >= maxAnchors) break;

        const line = String(entry?.text || '').trim();
        if (!line) continue;
        const normalized = normalizeText(line);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        lines.push(line);
        freshest = Math.max(freshest, Number(entry?.freshness || -1));
        bestScore = Math.max(bestScore, Number(entry?.score) || 0);
    }

    if (lines.length === 0) return [];

    return [{
        text: `### ${ANCHORS_SECTION_LABEL}\n${lines.join('\n')}`.trim(),
        hash: `anchors-group|${freshest}|${lines.length}`,
        score: Number.isFinite(bestScore) ? bestScore : 0,
        metadata: {
            chunkBehavior: 'cumulative',
            sectionType: ANCHORS_SECTION_KEY,
            sectionTypes: [ANCHORS_SECTION_KEY],
            entityKey: '__pinned_group__',
            freshnessEndIndex: freshest,
            pinnedGroup: true,
            pinnedGroupCount: lines.length,
        },
    }];
}

/**
 * @param {string} text
 * @param {string} headingName
 * @returns {{text: string, removed: boolean}}
 */
export function stripSectionByHeading(text, headingName) {
    const lines = String(text || '').split('\n');
    const target = String(headingName || '').trim().toUpperCase();
    const kept = [];
    let skipping = false;
    let removed = false;

    for (const rawLine of lines) {
        const line = String(rawLine || '');
        const header = line.match(/^###\s+(.+?)\s*$/);
        if (header) {
            const headerName = String(header[1] || '').trim().toUpperCase();
            skipping = headerName === target;
            if (skipping) {
                removed = true;
                continue;
            }
            kept.push(line);
            continue;
        }

        if (!skipping) {
            kept.push(line);
        }
    }

    return {
        text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        removed,
    };
}

/**
 * Remove ANCHORS section blocks from cumulative chunks so compact pinned anchors
 * can be appended once without duplicating the same section repeatedly.
 * @param {Array<Object>} results
 * @returns {Array<Object>}
 */
export function stripAnchorsFromCumulativeResults(results) {
    const out = [];

    for (const item of (results || [])) {
        if (item?.metadata?.chunkBehavior !== 'cumulative') {
            out.push(item);
            continue;
        }

        const sectionTypes = Array.isArray(item?.metadata?.sectionTypes)
            ? item.metadata.sectionTypes
            : [];
        const likelyHasAnchors = sectionTypes.includes(ANCHORS_SECTION_KEY)
            || /(^|\n)###\s+ANCHORS\b/i.test(String(item?.text || ''));
        if (!likelyHasAnchors) {
            out.push(item);
            continue;
        }

        const stripped = stripSectionByHeading(item?.text || '', ANCHORS_SECTION_LABEL);
        if (!stripped.removed) {
            out.push(item);
            continue;
        }

        if (!stripped.text) continue;
        const nextSectionTypes = sectionTypes.length > 0
            ? sectionTypes.filter(section => section !== ANCHORS_SECTION_KEY)
            : sectionTypes;

        out.push({
            ...item,
            text: stripped.text,
            metadata: {
                ...(item?.metadata || {}),
                ...(sectionTypes.length > 0 ? { sectionTypes: nextSectionTypes } : {}),
            },
        });
    }

    return out;
}

/**
 * Extract latest developments items from cumulative chunks.
 * @param {Array<Object>} items
 * @returns {Array<{text: string, freshness: number, score: number}>}
 */
export function collectLatestDevelopments(items) {
    const seen = new Set();
    const developments = [];

    for (const item of (items || [])) {
        const sectionTypes = Array.isArray(item?.metadata?.sectionTypes)
            ? item.metadata.sectionTypes
            : [];
        const likelyHasDevelopments = sectionTypes.includes(DEVELOPMENTS_SECTION_KEY)
            || /(^|\n)###\s+DEVELOPMENTS\b/i.test(String(item?.text || ''));
        if (!likelyHasDevelopments) continue;

        const sectionBody = extractSectionBodyByHeading(item?.text || '', DEVELOPMENTS_SECTION_LABEL);
        if (!sectionBody) continue;

        const entries = splitSectionListItems(sectionBody);
        const freshness = getFreshnessEndIndex(item);
        const score = Number(item?.score) || 0;

        for (const entry of entries) {
            const normalized = normalizeText(String(entry || '').trim());
            if (!normalized || seen.has(normalized)) continue;
            seen.add(normalized);

            const text = /^[-*\u2022]\s+/.test(String(entry || '').trim())
                ? String(entry || '').trim()
                : `- ${String(entry || '').trim()}`;
            developments.push({ text, freshness, score });
        }
    }

    return developments;
}

/**
 * @param {Array<{text: string, freshness: number, score: number}>} queryDevs
 * @param {Array<{text: string, freshness: number, score: number}>} fallbackDevs
 * @returns {Array<{text: string, freshness: number, score: number}>}
 */
export function mergeLatestDevelopments(queryDevs, fallbackDevs) {
    const seen = new Set();
    const latest = [];
    for (const entry of [...(queryDevs || []), ...(fallbackDevs || [])]) {
        const normalized = normalizeText(String(entry?.text || ''));
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        latest.push(entry);
    }
    return latest;
}

/**
 * @param {Array<{text: string, freshness: number, score: number}>} devEntries
 * @returns {Array<Object>}
 */
export function compactDevelopmentsPinnedChunks(devEntries) {
    const safeEntries = Array.isArray(devEntries) ? devEntries : [];
    if (safeEntries.length === 0) return [];

    safeEntries.sort((a, b) => Number(b?.freshness || -1) - Number(a?.freshness || -1));

    const lines = [];
    const seen = new Set();
    let freshest = -1;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const entry of safeEntries) {
        const line = String(entry?.text || '').trim();
        if (!line) continue;
        const normalized = normalizeText(line);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        lines.push(line);
        freshest = Math.max(freshest, Number(entry?.freshness || -1));
        bestScore = Math.max(bestScore, Number(entry?.score) || 0);
    }

    if (lines.length === 0) return [];

    return [{
        text: `### ${DEVELOPMENTS_SECTION_LABEL}\n${lines.join('\n')}`.trim(),
        hash: `developments-group|${freshest}|${lines.length}`,
        score: Number.isFinite(bestScore) ? bestScore : 0,
        metadata: {
            chunkBehavior: 'cumulative',
            sectionType: DEVELOPMENTS_SECTION_KEY,
            sectionTypes: [DEVELOPMENTS_SECTION_KEY],
            entityKey: '__pinned_group__',
            freshnessEndIndex: freshest,
            pinnedGroup: true,
            pinnedGroupCount: lines.length,
        },
    }];
}

/**
 * Parse scene code into numeric parts for sorting.
 * Supports S{shard}:{scene} format.
 * @param {string} code
 * @returns {{shard: number, scene: number}|null}
 */
export function parseSceneCode(code) {
    const match = String(code || '').match(/S(\d+):(\d+)/i);
    if (!match) return null;
    return {
        shard: parseInt(match[1], 10),
        scene: parseInt(match[2], 10),
    };
}

/**
 * Compare two items chronologically.
 * Prioritizes parsed scene codes, falls back to freshness index.
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function compareChronologically(a, b) {
    const codeA = a?.metadata?.sceneCode;
    const codeB = b?.metadata?.sceneCode;
    const pA = parseSceneCode(codeA);
    const pB = parseSceneCode(codeB);

    if (pA && pB) {
        if (pA.shard !== pB.shard) return pA.shard - pB.shard;
        return pA.scene - pB.scene;
    }

    const fA = getFreshnessEndIndex(a);
    const fB = getFreshnessEndIndex(b);
    if (fA !== fB) return fA - fB;

    // Same freshness (likely same shard), prefer the one with a scene code
    if (pA && !pB) return -1;
    if (!pA && pB) return 1;

    return 0;
}

/**
 * @param {Array<Object>} chat
 * @param {number} queryCount
 * @returns {string}
 */
export function buildQueryText(chat, queryCount) {
    if (!Array.isArray(chat) || chat.length === 0) return '';

    const safeCount = Math.max(1, Number(queryCount) || 2);
    const start = Math.max(0, chat.length - safeCount);
    const lines = [];

    for (let i = start; i < chat.length; i++) {
        const msg = chat[i];
        const text = String(msg?.mes ?? msg?.text ?? '').trim();
        if (!text) continue;
        const speaker = String(msg?.name || (msg?.is_user ? 'User' : 'Assistant'));
        lines.push(`[${i}] ${speaker}: ${text}`);
    }

    return lines.join('\n');
}
