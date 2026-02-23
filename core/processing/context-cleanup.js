/**
 * Context Cleanup Module (Functional)
 * Handles all context cleaning operations and related UI events
 */

const defaultOptions = {
    enabled: false,
    stripHtml: false,
    stripCodeBlocks: false,
    stripUrls: false,
    stripEmojis: false,
    stripBracketedMeta: false,
    stripThinkingBlocks: true,  // NEW - enabled by default
    customRegex: '',
    customRegexes: []
};

/**
 * Strip HTML tags from text
 * @param {string} text - Input text
 * @returns {string} Text without HTML
 */
function stripHtml(text) {
    return text.replace(/<[^>]*>/g, '');
}

/**
 * Strip code blocks from text
 * @param {string} text - Input text
 * @returns {string} Text without code blocks
 */
function stripCodeBlocks(text) {
    return text.replace(/```[\s\S]*?```/g, '[code block removed]');
}

/**
 * Strip URLs from text
 * @param {string} text - Input text
 * @returns {string} Text without URLs
 */
function stripUrls(text) {
    return text.replace(/https?:\/\/[^\s]+/g, '[url]');
}

/**
 * Strip emojis from text
 * @param {string} text - Input text
 * @returns {string} Text without emojis
 */
function stripEmojis(text) {
    return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
}

/**
 * Strip bracketed meta content (OOC, etc.)
 * @param {string} text - Input text
 * @returns {string} Text without bracketed meta
 */
function stripBracketedMeta(text) {
    let result = text;
    result = result.replace(/\[OOC[:\]]?[^\]]*\]/gi, '');
    result = result.replace(/\(OOC[:\)]?[^)]*\)/gi, '');
    result = result.replace(/\(+\s*OOC[:\)]?[^)]*\)+/gi, '');
    result = result.replace(/\[{2}\s*OOC[:\]]?[^\]]*\]{2}/gi, '');
    return result;
}

/**
 * Apply custom regex pattern
 * @param {string} text - Input text
 * @param {string} pattern - Regex pattern
 * @returns {string} Text with pattern applied
 */
function applyCustomRegex(text, pattern) {
    if (!pattern?.trim()) return text;

    try {
        const regex = new RegExp(pattern, 'g');
        return text.replace(regex, '');
    } catch (e) {
        console.warn('[SummarySharder] Invalid custom regex:', e.message);
        return text;
    }
}

/**
 * Clean up excess whitespace
 * @param {string} text - Input text
 * @returns {string} Text with normalized whitespace
 */
function cleanWhitespace(text) {
    return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Apply context cleanup operations to text before summarization
 * Unified cleanup function handling all cleanup options from both legacy and new formats.
 * @param {string} text - The raw chat text
 * @param {Object} cleanup - Cleanup settings object
 * @returns {string} Cleaned text
 */
export function applyContextCleanup(text, cleanup) {
    if (!cleanup?.enabled) return text;

    let result = text;

    if (cleanup.stripHtml) {
        result = stripHtml(result);
    }

    if (cleanup.stripCodeBlocks) {
        result = stripCodeBlocks(result);
    }

    if (cleanup.stripUrls) {
        result = stripUrls(result);
    }

    if (cleanup.stripEmojis) {
        result = stripEmojis(result);
    }

    if (cleanup.stripBracketedMeta) {
        result = stripBracketedMeta(result);
    }

    // Remove reasoning blocks (<thinking> and <think> tags)
    if (cleanup.stripReasoningBlocks) {
        result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
        result = result.replace(/<think>[\s\S]*?<\/think>/gi, '');
    }

    // Apply all enabled custom regexes from array (new format)
    if (cleanup.customRegexes && Array.isArray(cleanup.customRegexes)) {
        cleanup.customRegexes
            .filter(r => r.enabled && r.pattern)
            .forEach(regex => {
                result = applyCustomRegex(result, regex.pattern);
            });
    }

    // Backward compatibility: also check old single customRegex
    if (cleanup.customRegex?.trim()) {
        result = applyCustomRegex(result, cleanup.customRegex);
    }

    // Clean up excess whitespace from removals
    result = cleanWhitespace(result);

    return result;
}

/**
 * Clean context based on cleanup settings
 * @param {string} context - Raw context string
 * @param {Object} options - Cleanup options
 * @returns {string} Cleaned context
 */
export function cleanContext(context, options = null) {
    const opts = options || defaultOptions;

    if (!opts.enabled) return context;

    let cleaned = context;

    if (opts.stripHtml) {
        cleaned = stripHtml(cleaned);
    }

    if (opts.stripCodeBlocks) {
        cleaned = stripCodeBlocks(cleaned);
    }

    if (opts.stripUrls) {
        cleaned = stripUrls(cleaned);
    }

    if (opts.stripEmojis) {
        cleaned = stripEmojis(cleaned);
    }

    if (opts.stripBracketedMeta) {
        cleaned = stripBracketedMeta(cleaned);
    }

    // Apply all enabled custom regexes from array (new format)
    if (opts.customRegexes && Array.isArray(opts.customRegexes)) {
        opts.customRegexes
            .filter(r => r.enabled && r.pattern)
            .forEach(regex => {
                cleaned = applyCustomRegex(cleaned, regex.pattern);
            });
    }

    // Backward compatibility: also check old single customRegex
    if (opts.customRegex) {
        cleaned = applyCustomRegex(cleaned, opts.customRegex);
    }

    // Always clean up excess whitespace from removals
    cleaned = cleanWhitespace(cleaned);

    return cleaned;
}

