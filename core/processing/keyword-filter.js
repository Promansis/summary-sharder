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
    const list = Array.isArray(keywords) ? keywords : [];

    // Always return a new array. Some callers clear/mutate their input array after
    // filtering; returning the same reference would accidentally wipe results.
    if (!bannedSet || bannedSet.size === 0) return [...list];

    return list.filter(k => !bannedSet.has(String(k).toLowerCase()));
}
