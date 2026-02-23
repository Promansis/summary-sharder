/**
 * Canonical sanitizer for sharder shard output.
 * Keeps parsing deterministic before validation/review.
 */

import { parseSceneCodes } from '../summarization/sharder-pipeline.js';

/**
 * Sanitize parsed sections in-place safe clone.
 * @param {Object} sections
 * @param {{startIndex?: number, endIndex?: number, inheritedPrefixes?: Set<number>}} context
 * @returns {{ sections: Object, changes: string[], sceneCodeFixes: number, fixedCodes: string[] }}
 */
export function sanitizeSinglePassSections(sections, context = {}) {
    const cloned = JSON.parse(JSON.stringify(sections || {}));
    const changes = [];
    const fixedCodes = [];
    let sceneCodeFixes = 0;

    const rangeStart = Number.isFinite(context?.startIndex) ? context.startIndex : undefined;
    const rangeEnd = Number.isFinite(context?.endIndex) ? context.endIndex : rangeStart;
    const inheritedPrefixes = context?.inheritedPrefixes instanceof Set
        ? context.inheritedPrefixes
        : new Set();

    Object.keys(cloned).forEach((key) => {
        if (key.startsWith('_')) return;
        const items = Array.isArray(cloned[key]) ? cloned[key] : [];

        const sanitized = items
            .map((item) => {
                const content = String(item?.content || '')
                    .replace(/\r\n/g, '\n')
                    .replace(/[ \t]+$/gm, '')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();

                const normalizedContent = content
                    .replace(/\[S(\d+)[-.](\d+)\]/g, '[S$1:$2]')
                    .replace(/\(S(\d+):(\d+)\)/g, '[S$1:$2]');

                let finalContent = normalizedContent;

                if (rangeStart !== undefined) {
                    finalContent = normalizedContent.replace(/\[S(\d+):(\d+)\]/g, (full, prefix, sceneNum) => {
                        const startMsg = parseInt(prefix, 10);
                        const inRange = startMsg >= rangeStart && startMsg <= rangeEnd;
                        const isInherited = inheritedPrefixes.has(startMsg);

                        if (inRange || isInherited) {
                            return full;
                        }

                        const corrected = `[S${rangeStart}:${sceneNum}]`;
                        sceneCodeFixes++;
                        fixedCodes.push(`${full} -> ${corrected}`);
                        return corrected;
                    });
                }

                if (content !== normalizedContent || normalizedContent !== finalContent) {
                    changes.push(`Normalized scene code format in ${key}`);
                }

                return {
                    ...item,
                    content: finalContent,
                    sceneCodes: parseSceneCodes(finalContent),
                    selected: item?.selected !== false,
                };
            })
            .filter((item) => item.content && item.content.trim().length > 0);

        if (sanitized.length !== items.length) {
            changes.push(`Removed ${items.length - sanitized.length} empty item(s) from ${key}`);
        }

        cloned[key] = sanitized;
    });

    return { sections: cloned, changes, sceneCodeFixes, fixedCodes };
}

