/**
 * Length control utilities for Summary Sharder
 * Shared functions for applying summary length constraints
 */

/**
 * Count words in text
 * @param {string} text - The text to count words in
 * @returns {number} Word count
 */
export function countWords(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Build length instruction for the prompt
 * @param {string|number} chatTextOrWordCount - The input chat text, or a pre-computed word count
 * @param {number} percent - Target percentage (1-30)
 * @returns {string} Formatted length instruction
 */
export function buildLengthInstruction(chatTextOrWordCount, percent) {
    // Support both text (for backward compatibility) and pre-computed word count
    const inputWordCount = typeof chatTextOrWordCount === 'number'
        ? chatTextOrWordCount
        : countWords(chatTextOrWordCount);
    const targetWordCount = Math.max(50, Math.round(inputWordCount * (percent / 100)));

    return `

---
TARGET LENGTH: Approximately ${targetWordCount} words (${percent}% of ${inputWordCount}-word input).
Write a complete, natural summary of approximately this length. Do not truncate or pad artificially.`;
}
