/**
 * Keyword Analysis
 * Pure text analysis functions for keyword extraction and event coverage scoring.
 * Extracted from summary-review-modal.js.
 */

/**
 * Common stop words to filter from keyword extraction
 */
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
    'he', 'she', 'him', 'her', 'his', 'hers', 'we', 'us', 'our', 'you', 'your',
    'i', 'me', 'my', 'myself', 'who', 'what', 'when', 'where', 'why', 'how',
    'all', 'each', 'every', 'both', 'few', 'more', 'most', 'some', 'any',
    'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'under', 'again', 'further', 'then', 'once', 'here', 'there', 'why', 'how',
    'about', 'against', 'also', 'being', 'because', 'such', 'while', 'until'
]);

/**
 * Extract significant keywords from text
 * @param {string} text - Text to extract keywords from
 * @returns {Set<string>} Set of normalized keywords
 */
export function extractKeywords(text) {
    if (!text) return new Set();

    // Normalize: lowercase, split on whitespace/punctuation
    const words = text.toLowerCase()
        .replace(/[^\w\s'-]/g, ' ')
        .split(/\s+/)
        .filter(word => {
            // Filter: not a stop word, at least 3 chars, not just numbers
            return word.length >= 3 &&
                   !STOP_WORDS.has(word) &&
                   !/^\d+$/.test(word);
        });

    return new Set(words);
}

/**
 * Calculate coverage score for an event against the summary
 * @param {Object} event - Event object with description
 * @param {Set<string>} summaryKeywords - Pre-extracted summary keywords
 * @returns {number} Coverage score 0-1
 */
export function calculateEventCoverage(event, summaryKeywords) {
    const description = event.userDescription || event.originalDescription || '';
    const eventKeywords = extractKeywords(description);

    if (eventKeywords.size === 0) {
        return 0;
    }

    let matchCount = 0;
    for (const keyword of eventKeywords) {
        if (summaryKeywords.has(keyword)) {
            matchCount++;
        } else {
            // Check for partial/stem matching
            for (const summaryWord of summaryKeywords) {
                if (summaryWord.includes(keyword) || keyword.includes(summaryWord)) {
                    matchCount += 0.5;
                    break;
                }
            }
        }
    }

    return Math.min(1, matchCount / eventKeywords.size);
}

/**
 * Determine coverage status from score
 * @param {number} score - Coverage score 0-1
 * @returns {'covered' | 'partial' | 'missing'}
 */
export function getCoverageStatus(score) {
    if (score > 0.5) return 'covered';
    if (score >= 0.2) return 'partial';
    return 'missing';
}

/**
 * Analyze event coverage in the summary
 * @param {Array} events - Selected events from events modal
 * @param {string} summary - Generated summary text
 * @returns {Array<{event: Object, score: number, status: string}>}
 */
export function analyzeEventCoverage(events, summary) {
    const summaryKeywords = extractKeywords(summary);

    return events.map(event => {
        const score = calculateEventCoverage(event, summaryKeywords);
        const status = getCoverageStatus(score);

        return {
            event,
            score,
            status
        };
    });
}
