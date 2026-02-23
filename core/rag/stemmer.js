/**
 * Lightweight Porter stemmer for English terms used in BM25 matching.
 * Adapted to keep footprint small for browser-side usage.
 */

const WORD_RE = /[a-z0-9][a-z0-9'_\-]*/gi;
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'this', 'that', 'these', 'those', 'it', 'its', 'they',
    'them', 'their', 'you', 'your', 'we', 'our', 'i', 'me', 'my', 'he', 'she',
    'his', 'her', 'not', 'so', 'if', 'then', 'than', 'too', 'very', 'can',
    'could', 'would', 'should', 'will', 'just', 'about', 'into', 'over', 'after',
]);

const VOWEL_RE = /[aeiouy]/;

function isConsonant(word, i) {
    const ch = word[i];
    if ('aeiou'.includes(ch)) return false;
    if (ch === 'y') {
        if (i === 0) return true;
        return !isConsonant(word, i - 1);
    }
    return true;
}

function measure(word) {
    let m = 0;
    let inVowelSeq = false;
    for (let i = 0; i < word.length; i++) {
        if (isConsonant(word, i)) {
            if (inVowelSeq) {
                m++;
                inVowelSeq = false;
            }
        } else {
            inVowelSeq = true;
        }
    }
    return m;
}

function containsVowel(word) {
    return VOWEL_RE.test(word);
}

function endsWithDoubleConsonant(word) {
    if (word.length < 2) return false;
    const a = word[word.length - 1];
    const b = word[word.length - 2];
    return a === b && isConsonant(word, word.length - 1);
}

function cvc(word) {
    if (word.length < 3) return false;
    const i = word.length - 1;
    if (!isConsonant(word, i) || isConsonant(word, i - 1) || !isConsonant(word, i - 2)) {
        return false;
    }
    const ch = word[i];
    return ch !== 'w' && ch !== 'x' && ch !== 'y';
}

/**
 * @param {string} input
 * @returns {string}
 */
export function stem(input) {
    let word = String(input || '').toLowerCase();
    if (word.length < 3) return word;

    // Step 1a
    if (word.endsWith('sses')) {
        word = `${word.slice(0, -4)}ss`;
    } else if (word.endsWith('ies')) {
        word = `${word.slice(0, -3)}i`;
    } else if (word.endsWith('ss')) {
        // keep as-is
    } else if (word.endsWith('s')) {
        word = word.slice(0, -1);
    }

    // Step 1b
    let step1bApplied = false;
    if (word.endsWith('eed')) {
        const stemPart = word.slice(0, -3);
        if (measure(stemPart) > 0) {
            word = `${stemPart}ee`;
        }
    } else if (word.endsWith('ed')) {
        const stemPart = word.slice(0, -2);
        if (containsVowel(stemPart)) {
            word = stemPart;
            step1bApplied = true;
        }
    } else if (word.endsWith('ing')) {
        const stemPart = word.slice(0, -3);
        if (containsVowel(stemPart)) {
            word = stemPart;
            step1bApplied = true;
        }
    }

    if (step1bApplied) {
        if (word.endsWith('at') || word.endsWith('bl') || word.endsWith('iz')) {
            word = `${word}e`;
        } else if (endsWithDoubleConsonant(word) && !/[lsz]$/.test(word)) {
            word = word.slice(0, -1);
        } else if (measure(word) === 1 && cvc(word)) {
            word = `${word}e`;
        }
    }

    // Step 1c
    if (word.endsWith('y')) {
        const stemPart = word.slice(0, -1);
        if (containsVowel(stemPart)) {
            word = `${stemPart}i`;
        }
    }

    // Step 2 (subset focused on high-impact suffixes)
    const step2 = [
        ['ational', 'ate'],
        ['tional', 'tion'],
        ['enci', 'ence'],
        ['anci', 'ance'],
        ['izer', 'ize'],
        ['abli', 'able'],
        ['alli', 'al'],
        ['entli', 'ent'],
        ['eli', 'e'],
        ['ousli', 'ous'],
        ['ization', 'ize'],
        ['ation', 'ate'],
        ['ator', 'ate'],
        ['alism', 'al'],
        ['iveness', 'ive'],
        ['fulness', 'ful'],
        ['ousness', 'ous'],
        ['aliti', 'al'],
        ['iviti', 'ive'],
        ['biliti', 'ble'],
    ];
    for (const [suffix, replacement] of step2) {
        if (!word.endsWith(suffix)) continue;
        const stemPart = word.slice(0, -suffix.length);
        if (measure(stemPart) > 0) {
            word = `${stemPart}${replacement}`;
        }
        break;
    }

    // Step 3 (subset)
    const step3 = [
        ['icate', 'ic'],
        ['ative', ''],
        ['alize', 'al'],
        ['iciti', 'ic'],
        ['ical', 'ic'],
        ['ful', ''],
        ['ness', ''],
    ];
    for (const [suffix, replacement] of step3) {
        if (!word.endsWith(suffix)) continue;
        const stemPart = word.slice(0, -suffix.length);
        if (measure(stemPart) > 0) {
            word = `${stemPart}${replacement}`;
        }
        break;
    }

    // Step 4 (subset)
    const step4 = [
        'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement',
        'ment', 'ent', 'ion', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize',
    ];
    for (const suffix of step4) {
        if (!word.endsWith(suffix)) continue;
        const stemPart = word.slice(0, -suffix.length);
        if (suffix === 'ion' && !/[st]$/.test(stemPart)) {
            continue;
        }
        if (measure(stemPart) > 1) {
            word = stemPart;
        }
        break;
    }

    // Step 5
    if (word.endsWith('e')) {
        const stemPart = word.slice(0, -1);
        const m = measure(stemPart);
        if (m > 1 || (m === 1 && !cvc(stemPart))) {
            word = stemPart;
        }
    }
    if (measure(word) > 1 && endsWithDoubleConsonant(word) && word.endsWith('l')) {
        word = word.slice(0, -1);
    }

    return word;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeAndStem(text) {
    const raw = String(text || '').toLowerCase();
    const matches = raw.match(WORD_RE) || [];
    return matches
        .filter(t => t.length >= 2 && !STOP_WORDS.has(t))
        .map(stem)
        .filter(t => t.length >= 2);
}
