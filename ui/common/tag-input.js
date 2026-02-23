/**
 * Tag Input Component
 * Reusable comma/enter based tag editor.
 */

/**
 * Parse comma-separated tag string into trimmed tags.
 * @param {string} value
 * @returns {string[]}
 */
export function parseCommaTags(value = '') {
    return String(value)
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

/**
 * Serialize tags into a comma-separated string.
 * @param {string[]} tags
 * @returns {string}
 */
export function tagsToString(tags = []) {
    return normalizeTags(tags).join(', ');
}

/**
 * Create a reusable tag-input element.
 * @param {Object} config
 * @param {string[]} config.tags
 * @param {Function} config.onChange
 * @param {string} config.placeholder
 * @returns {HTMLElement} root with getTags/setTags methods
 */
export function createTagInput({ tags = [], onChange = () => {}, placeholder = 'Add tag...' } = {}) {
    const root = document.createElement('div');
    root.className = 'ss-tag-input';

    const tagContainer = document.createElement('div');
    tagContainer.className = 'ss-tag-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'text_pole ss-tag-input-field';
    input.placeholder = placeholder;
    input.autocomplete = 'off';

    let tagList = normalizeTags(tags);

    const render = () => {
        while (tagContainer.firstChild) {
            tagContainer.removeChild(tagContainer.firstChild);
        }
        tagList.forEach((tag, index) => {
            const tagEl = document.createElement('span');
            tagEl.className = 'ss-tag';
            tagEl.dataset.index = String(index);
            tagEl.textContent = tag;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'ss-tag-remove';
            removeBtn.dataset.index = String(index);
            removeBtn.setAttribute('aria-label', `Remove ${tag}`);
            removeBtn.textContent = 'x';

            tagEl.appendChild(removeBtn);
            tagContainer.appendChild(tagEl);
        });
        tagContainer.style.display = tagList.length > 0 ? '' : 'none';
    };

    const updateTags = (nextTags, shouldNotify = false) => {
        const normalized = normalizeTags(nextTags);
        if (areTagsEqual(tagList, normalized)) {
            return false;
        }
        tagList = normalized;
        render();
        if (shouldNotify) {
            onChange([...tagList]);
        }
        return true;
    };

    const addFromInput = () => {
        const pending = parseCommaTags(input.value);
        if (pending.length === 0) {
            input.value = '';
            return;
        }
        const changed = updateTags([...tagList, ...pending], true);
        if (changed || input.value) {
            input.value = '';
        }
    };

    root.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.ss-tag-remove');
        if (removeBtn) {
            const index = Number(removeBtn.dataset.index);
            if (!Number.isNaN(index) && index >= 0 && index < tagList.length) {
                const nextTags = [...tagList];
                nextTags.splice(index, 1);
                updateTags(nextTags, true);
            }
            return;
        }
        input.focus();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addFromInput();
        } else if (e.key === 'Backspace' && !input.value && tagList.length > 0) {
            const nextTags = [...tagList];
            nextTags.pop();
            updateTags(nextTags, true);
        }
    });

    input.addEventListener('blur', addFromInput);

    root.appendChild(tagContainer);
    root.appendChild(input);
    render();

    root.getTags = () => [...tagList];
    root.setTags = (nextTags) => updateTags(Array.isArray(nextTags) ? nextTags : parseCommaTags(nextTags), false);

    return root;
}

function normalizeTags(tags) {
    const seen = new Set();
    const normalized = [];

    (Array.isArray(tags) ? tags : []).forEach((tag) => {
        const value = String(tag ?? '').trim();
        if (!value) {
            return;
        }
        const lowered = value.toLowerCase();
        if (seen.has(lowered)) {
            return;
        }
        seen.add(lowered);
        normalized.push(value);
    });

    return normalized;
}

function areTagsEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
