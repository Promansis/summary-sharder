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

    const modalHtml = `
        <div class="ss-clean-context-modal">
            <h3 class="ss-clean-context-title">Context Cleanup Options</h3>

            <div class="ss-cleanup-toggles">
                <div class="ss-block">
                    <label class="checkbox_label">
                        <input id="ss-modal-cleanup-html" type="checkbox" ${settings.contextCleanup.stripHtml ? 'checked' : ''} />
                        <span>Strip HTML tags</span>
                    </label>
                    <p class="ss-clean-context-hint">
                        Removes &lt;div&gt;, &lt;span&gt;, and other HTML tags
                    </p>
                </div>

                <div class="ss-block">
                    <label class="checkbox_label">
                        <input id="ss-modal-cleanup-code" type="checkbox" ${settings.contextCleanup.stripCodeBlocks ? 'checked' : ''} />
                        <span>Remove code blocks</span>
                    </label>
                    <p class="ss-clean-context-hint">
                        Removes \`\`\`code\`\`\` blocks entirely
                    </p>
                </div>

                <div class="ss-block">
                    <label class="checkbox_label">
                        <input id="ss-modal-cleanup-urls" type="checkbox" ${settings.contextCleanup.stripUrls ? 'checked' : ''} />
                        <span>Remove URLs</span>
                    </label>
                    <p class="ss-clean-context-hint">
                        Replaces http/https URLs with [url]
                    </p>
                </div>

                <div class="ss-block">
                    <label class="checkbox_label">
                        <input id="ss-modal-cleanup-emojis" type="checkbox" ${settings.contextCleanup.stripEmojis ? 'checked' : ''} />
                        <span>Remove emojis</span>
                    </label>
                    <p class="ss-clean-context-hint">
                        Strips emoji characters from text
                    </p>
                </div>

                <div class="ss-block">
                    <label class="checkbox_label">
                        <input id="ss-modal-cleanup-meta" type="checkbox" ${settings.contextCleanup.stripBracketedMeta ? 'checked' : ''} />
                        <span>Remove [OOC] / (OOC) markers</span>
                    </label>
                    <p class="ss-clean-context-hint">
                        Removes out-of-character markers and their contents
                    </p>
                </div>

                <div class="ss-block">
                    <label class="checkbox_label">
                        <input id="ss-modal-cleanup-reasoning" type="checkbox" ${settings.contextCleanup.stripReasoningBlocks !== false ? 'checked' : ''} />
                        <span>Remove reasoning blocks</span>
                    </label>
                    <p class="ss-clean-context-hint">
                        Removes &lt;thinking&gt; and &lt;think&gt; tags and their contents
                    </p>
                </div>

                <div class="ss-block">
                    <label class="checkbox_label">
                        <input id="ss-modal-cleanup-hidden" type="checkbox" ${settings.contextCleanup.stripHiddenMessages !== false ? 'checked' : ''} />
                        <span>Skip hidden messages</span>
                    </label>
                    <p class="ss-clean-context-hint">
                        Excludes messages marked as hidden in SillyTavern
                    </p>
                </div>
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
        modalContainer.querySelector('#ss-modal-cleanup-html').addEventListener('change', (e) => {
            settings.contextCleanup.stripHtml = e.target.checked;
            saveSettings(settings);
        });

        modalContainer.querySelector('#ss-modal-cleanup-code').addEventListener('change', (e) => {
            settings.contextCleanup.stripCodeBlocks = e.target.checked;
            saveSettings(settings);
        });

        modalContainer.querySelector('#ss-modal-cleanup-urls').addEventListener('change', (e) => {
            settings.contextCleanup.stripUrls = e.target.checked;
            saveSettings(settings);
        });

        modalContainer.querySelector('#ss-modal-cleanup-emojis').addEventListener('change', (e) => {
            settings.contextCleanup.stripEmojis = e.target.checked;
            saveSettings(settings);
        });

        modalContainer.querySelector('#ss-modal-cleanup-meta').addEventListener('change', (e) => {
            settings.contextCleanup.stripBracketedMeta = e.target.checked;
            saveSettings(settings);
        });

        modalContainer.querySelector('#ss-modal-cleanup-reasoning').addEventListener('change', (e) => {
            settings.contextCleanup.stripReasoningBlocks = e.target.checked;
            saveSettings(settings);
        });

        modalContainer.querySelector('#ss-modal-cleanup-hidden').addEventListener('change', (e) => {
            settings.contextCleanup.stripHiddenMessages = e.target.checked;
            saveSettings(settings);
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

