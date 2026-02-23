/**
 * Banned keyword filtering for Summary Sharder.
 * Filters keywords from lorebook entries and RAG vector metadata.
 */

/**
 * Parse banned keywords string into a normalized Set for fast lookup.
 * @param {string} bannedStr - Comma-separated banned keywords
 * @returns {Set<string>} Lowercased banned words
 */
export function parseBannedKeywords(bannedStr) {
    if (!bannedStr) return new Set();
    return new Set(
        bannedStr.split(',')
            .map(k => k.trim().toLowerCase())
            .filter(k => k)
    );
}

/**
 * Filter an array of keywords, removing any that match the banned set.
 * Case-insensitive matching.
 * @param {string[]} keywords
 * @param {Set<string>} bannedSet - From parseBannedKeywords()
 * @returns {string[]}
 */
export function filterBannedKeywords(keywords, bannedSet) {
    if (!bannedSet || bannedSet.size === 0) return keywords;
    return keywords.filter(k => !bannedSet.has(k.toLowerCase()));
}
