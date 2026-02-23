/**
 * Evidence checker for sharder output.
 * Uses literal overlap heuristics against source chat text to flag likely unsupported lines.
 */

/**
 * Tokenize text to lowercase words.
 * @param {string} text
 * @returns {Set<string>}
 */
export function tokenize(text) {
    return new Set(
        String(text || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((t) => t.length >= 4)
    );
}

/**
 * @param {Object} sections
 * @param {string} sourceText
 * @returns {{ diagnostics: Array<{level:'warning'|'info', code:string, message:string}>, stats: {checked:number, lowEvidence:number} }}
 */
export function checkSinglePassEvidence(sections, sourceText) {
    const diagnostics = [];
    const sourceTokens = tokenize(sourceText);

    let checked = 0;
    let lowEvidence = 0;

    if (!sourceTokens.size) {
        return { diagnostics, stats: { checked, lowEvidence } };
    }

    Object.entries(sections || {}).forEach(([key, items]) => {
        if (key.startsWith('_') || !Array.isArray(items)) return;

        items.forEach((item, idx) => {
            if (item?.selected === false) return;
            const content = String(item?.content || '').trim();
            if (!content) return;

            checked++;
            const tokens = [...tokenize(content)];
            if (tokens.length === 0) return;

            const overlap = tokens.filter((t) => sourceTokens.has(t)).length;
            const ratio = overlap / tokens.length;

            if (ratio < 0.2 && tokens.length >= 4) {
                lowEvidence++;
                diagnostics.push({
                    level: 'warning',
                    code: 'LOW_EVIDENCE',
                    message: `${key}[${idx}] has low lexical evidence overlap (${Math.round(ratio * 100)}%).`
                });
            }
        });
    });

    if (checked > 0 && lowEvidence === 0) {
        diagnostics.push({
            level: 'info',
            code: 'EVIDENCE_OK',
            message: 'No low-evidence lines were detected by lexical heuristic.'
        });
    }

    return { diagnostics, stats: { checked, lowEvidence } };
}

