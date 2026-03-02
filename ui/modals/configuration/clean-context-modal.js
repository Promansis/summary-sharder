/**
 * Clean Context Modal Component for Summary Sharder
 * Modal for managing context cleanup options and custom regexes
 */

import { saveSettings } from '../../../core/settings.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
import { escapeHtml } from '../../common/ui-utils.js';
import { showSsConfirm } from '../../common/modal-base.js';

/**
 * Generate a unique ID for a regex
 */
function generateRegexId() {
    return `regex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Render the list of custom regexes
 */
function renderRegexList(settings, container) {
    const regexes = settings.contextCleanup?.customRegexes || [];

    if (regexes.length === 0) {
        container.innerHTML = `
            <p class="ss-regex-empty ss-clean-context-regex-empty">
                No custom regex patterns defined. Click "Add Regex" to create one.
            </p>
        `;
        return;
    }

    container.innerHTML = '';

    regexes.forEach((regex, index) => {
        const item = document.createElement('div');
        item.className = 'ss-regex-item';

        item.innerHTML = `
            <div class="ss-regex-left">
                <input type="checkbox" class="ss-regex-toggle" ${regex.enabled ? 'checked' : ''} />
            </div>
            <div class="ss-regex-center">
                <div class="ss-regex-name">${escapeHtml(regex.name)}</div>
                <div class="ss-regex-pattern">${escapeHtml(regex.pattern)}</div>
            </div>
            <div class="ss-regex-right">
                <button class="ss-regex-edit menu_button" title="Edit">Edit</button>
                <button class="ss-regex-delete menu_button" title="Delete">Delete</button>
            </div>
        `;

        // Toggle enabled
        item.querySelector('.ss-regex-toggle').addEventListener('change', (e) => {
            settings.contextCleanup.customRegexes[index].enabled = e.target.checked;
            saveSettings(settings);
        });

        // Edit regex
        item.querySelector('.ss-regex-edit').addEventListener('click', async () => {
            await editRegex(settings, index, container);
        });

        // Delete regex
        item.querySelector('.ss-regex-delete').addEventListener('click', async () => {
            const confirm = await showSsConfirm(
                'Delete Regex',
                `Are you sure you want to delete "${regex.name}"?`
            );
            if (confirm === POPUP_RESULT.AFFIRMATIVE) {
                settings.contextCleanup.customRegexes.splice(index, 1);
                saveSettings(settings);
                renderRegexList(settings, container);
                toastr.success('Regex deleted');
            }
        });

        container.appendChild(item);
    });
}

/**
 * Edit a regex (or create new one if index is -1)
 */
async function editRegex(settings, index, listContainer) {
    const isNew = index === -1;
    const regex = isNew
        ? { id: generateRegexId(), name: '', pattern: '', enabled: true }
        : settings.contextCleanup.customRegexes[index];

    const editHtml = `
        <div class="ss-regex-edit-modal">
            <div class="ss-block ss-clean-context-edit-block">
                <label>Name:</label>
                <input id="ss-regex-name" type="text" class="text_pole" placeholder="My Custom Regex"
                    value="${escapeHtml(regex.name)}" />
            </div>
            <div class="ss-block ss-clean-context-edit-block">
                <label>Pattern (regex):</label>
                <input id="ss-regex-pattern" type="text" class="text_pole ss-clean-context-pattern-input" placeholder="\\*.*?\\*"
                    value="${escapeHtml(regex.pattern)}" />
                <p class="ss-clean-context-edit-hint">
                    Enter a JavaScript regular expression pattern. Matches will be removed from context.
                </p>
            </div>
            <div class="ss-block">
                <label class="checkbox_label">
                    <input id="ss-regex-enabled" type="checkbox" ${regex.enabled ? 'checked' : ''} />
                    <span>Enabled</span>
                </label>
            </div>
        </div>
    `;

    const captured = {
        name: regex.name || '',
        pattern: regex.pattern || '',
        enabled: regex.enabled !== false,
    };

    const popup = new Popup(
        editHtml,
        POPUP_TYPE.TEXT,
        null,
        {
            okButton: isNew ? 'Add' : 'Save',
            cancelButton: 'Cancel',
            onClosing: (activePopup) => {
                const popupRoot = activePopup?.dlg;
                const nameEl = popupRoot?.querySelector('#ss-regex-name');
                const patternEl = popupRoot?.querySelector('#ss-regex-pattern');
                const enabledEl = popupRoot?.querySelector('#ss-regex-enabled');

                captured.name = String(nameEl?.value || '').trim();
                captured.pattern = String(patternEl?.value || '').trim();
                captured.enabled = !!enabledEl?.checked;

                if (activePopup?.result !== POPUP_RESULT.AFFIRMATIVE) {
                    return true;
                }

                if (!captured.name) {
                    toastr.error('Please enter a name for the regex');
                    nameEl?.focus();
                    return false;
                }

                if (!captured.pattern) {
                    toastr.error('Please enter a regex pattern');
                    patternEl?.focus();
                    return false;
                }

                try {
                    new RegExp(captured.pattern);
                } catch (e) {
                    toastr.error(`Invalid regex pattern: ${e.message}`);
                    patternEl?.focus();
                    return false;
                }

                return true;
            },
        }
    );

    const result = await popup.show();
    if (result !== POPUP_RESULT.AFFIRMATIVE) {
        return;
    }

    if (isNew) {
        if (!settings.contextCleanup.customRegexes) {
            settings.contextCleanup.customRegexes = [];
        }
        settings.contextCleanup.customRegexes.push({
            id: regex.id,
            name: captured.name,
            pattern: captured.pattern,
            enabled: captured.enabled
        });
        toastr.success('Regex added');
    } else {
        settings.contextCleanup.customRegexes[index] = {
            ...regex,
            name: captured.name,
            pattern: captured.pattern,
            enabled: captured.enabled
        };
        toastr.success('Regex updated');
    }

    saveSettings(settings);
    renderRegexList(settings, listContainer);
}

/**
 * Open the clean context modal
 */
export async function openCleanContextModal(settings) {
    // Ensure settings structure exists
    if (!settings.contextCleanup) {
        settings.contextCleanup = {
            enabled: false,
            stripHtml: true,
            stripCodeBlocks: false,
            stripUrls: false,
            stripEmojis: false,
            stripBracketedMeta: false,
            stripReasoningBlocks: true,
            stripHiddenMessages: true,
            customRegex: '',
            customRegexes: []
        };
    }

    if (!Array.isArray(settings.contextCleanup.customRegexes)) {
        settings.contextCleanup.customRegexes = [];
    }

    // Define cleanup options for dynamic rendering and sorting
    const options = [
        { id: 'ss-modal-cleanup-html', key: 'stripHtml', label: 'Strip HTML tags', hint: 'Removes &lt;div&gt;, &lt;span&gt;, and other HTML tags' },
        { id: 'ss-modal-cleanup-code', key: 'stripCodeBlocks', label: 'Remove code blocks', hint: 'Removes ```code``` blocks entirely' },
        { id: 'ss-modal-cleanup-urls', key: 'stripUrls', label: 'Remove URLs', hint: 'Replaces http/https URLs with [url]' },
        { id: 'ss-modal-cleanup-emojis', key: 'stripEmojis', label: 'Remove emojis', hint: 'Strips emoji characters from text' },
        { id: 'ss-modal-cleanup-meta', key: 'stripBracketedMeta', label: 'Remove [OOC] / (OOC) markers', hint: 'Removes out-of-character markers and their contents' },
        { id: 'ss-modal-cleanup-reasoning', key: 'stripReasoningBlocks', label: 'Remove reasoning blocks', hint: 'Removes &lt;thinking&gt; and &lt;think&gt; tags and their contents' },
        { id: 'ss-modal-cleanup-hidden', key: 'stripHiddenMessages', label: 'Skip hidden messages', hint: 'Excludes messages marked as hidden in SillyTavern' },
    ];

    // Helper to check if an option is enabled based on current settings
    const isOptionEnabled = (opt) => {
        if (opt.key === 'stripReasoningBlocks' || opt.key === 'stripHiddenMessages') {
            return settings.contextCleanup[opt.key] !== false;
        }
        return !!settings.contextCleanup[opt.key];
    };

    // Sort enabled options to the top
    options.sort((a, b) => (isOptionEnabled(b) ? 1 : 0) - (isOptionEnabled(a) ? 1 : 0));

    const togglesHtml = options.map(opt => `
                <div class="ss-block">
                    <label class="checkbox_label">
                        <input id="${opt.id}" type="checkbox" ${isOptionEnabled(opt) ? 'checked' : ''} />
                        <span>${opt.label}</span>
                    </label>
                    <p class="ss-clean-context-hint">
                        ${opt.hint}
                    </p>
                </div>
    `).join('');

    const modalHtml = `
        <div class="ss-clean-context-modal">
            <h3 class="ss-clean-context-title">Context Cleanup Options</h3>

            <div class="ss-cleanup-toggles">
                ${togglesHtml}
            </div>

            <hr class="sysHR" />

            <div class="ss-custom-regexes-section ss-clean-context-custom-section">
                <div class="ss-clean-context-custom-header">
                    <h4 class="ss-clean-context-custom-title">Custom Regex Patterns</h4>
                    <input id="ss-modal-add-regex" class="menu_button" type="button" value="Add Regex" />
                </div>
                <div id="ss-modal-regex-list" class="ss-regex-list ss-clean-context-regex-list-scroll"></div>
            </div>
        </div>
    `;

    const popup = new Popup(
        modalHtml,
        POPUP_TYPE.TEXT,
        null,
        {
            okButton: 'Close',
            cancelButton: null,
            wide: true
        }
    );

    const showPromise = popup.show();

    // Set up event listeners after popup shows
    requestAnimationFrame(() => {
        const modalContainer = document.querySelector('.ss-clean-context-modal');
        if (!modalContainer) return;

        const regexListContainer = modalContainer.querySelector('#ss-modal-regex-list');
        renderRegexList(settings, regexListContainer);

        // Cleanup toggle event listeners
        options.forEach(opt => {
            const el = modalContainer.querySelector(`#${opt.id}`);
            if (el) {
                el.addEventListener('change', (e) => {
                    settings.contextCleanup[opt.key] = e.target.checked;
                    saveSettings(settings);
                });
            }
        });

        // Add regex button
        modalContainer.querySelector('#ss-modal-add-regex').addEventListener('click', () => {
            editRegex(settings, -1, regexListContainer);
        });
    });

    await showPromise;

    // Update main UI checkbox state when modal closes
    const mainToggle = document.getElementById('ss-context-cleanup');
    if (mainToggle) {
        mainToggle.checked = settings.contextCleanup.enabled;
    }
}

