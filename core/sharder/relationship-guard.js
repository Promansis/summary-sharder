/**
 * Relationship coherence guard for sharder output.
 */

/**
 * Parse relationship lines of style:
 * [A]â†’[B]: trust=61 (+4), tension=22 (-3), intimacy=48 (+2)
 */
function parseRelationshipLine(line) {
    const content = String(line || '');
    const pairMatch = content.match(/\[(.+?)\]\s*â†’\s*\[(.+?)\]/);
    if (!pairMatch) return null;

    const values = {};
    const regex = /(trust|tension|intimacy)\s*=\s*(\d+)/gi;
    let m;
    while ((m = regex.exec(content)) !== null) {
        values[m[1].toLowerCase()] = Number(m[2]);
    }

    return {
        from: pairMatch[1].trim(),
        to: pairMatch[2].trim(),
        values,
        raw: content
    };
}

/**
 * @param {Object} sections
 * @returns {{ diagnostics: Array<{level:'warning'|'info', code:string, message:string}>, stats: {relationships:number, outOfBounds:number} }}
 */
export function checkRelationshipCoherence(sections) {
    const diagnostics = [];
    const relItems = Array.isArray(sections?.relationshipShifts) ? sections.relationshipShifts : [];

    let relationships = 0;
    let outOfBounds = 0;

    relItems.forEach((item, idx) => {
        if (item?.selected === false) return;
        const parsed = parseRelationshipLine(item?.content);
        if (!parsed) {
            diagnostics.push({
                level: 'warning',
                code: 'RELATIONSHIP_FORMAT',
                message: `relationshipShifts[${idx}] is not in canonical relationship format.`
            });
            return;
        }

        relationships++;

        for (const [metric, value] of Object.entries(parsed.values)) {
            if (value < 0 || value > 100) {
                outOfBounds++;
                diagnostics.push({
                    level: 'warning',
                    code: 'RELATIONSHIP_BOUNDS',
                    message: `${parsed.from}â†’${parsed.to} ${metric}=${value} is out of bounds (0-100).`
                });
            }
        }
    });

    if (relationships === 0) {
        diagnostics.push({
            level: 'info',
            code: 'NO_RELATIONSHIPS',
            message: 'No relationship deltas were detected.'
        });
    }

    return {
        diagnostics,
        stats: { relationships, outOfBounds }
    };
}

