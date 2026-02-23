/**
 * Lorebook Options Modal Component for Summary Sharder
 * Configures how summaries are saved to lorebooks
 */

import { saveSettings } from '../../../core/settings.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
import { createSegmentedToggle, createTagInput, parseCommaTags, tagsToString } from '../../common/index.js';
import { escapeHtml } from '../../common/ui-utils.js';
/**
 * Open the lorebook options modal
 */
export async function openLorebookOptionsModal(settings) {
    // Create working copy with defaults
    const modalState = {
        entryType: settings.lorebookEntryOptions?.entryType || 'constant',
        nameFormat: settings.lorebookEntryOptions?.nameFormat || 'Memory Shard {start}-{end}',
        keywordsEnabled: settings.lorebookEntryOptions?.keywordsEnabled !== false,
        keywordFormat: settings.lorebookEntryOptions?.keywordFormat || 'summary_{start}_{end}',
        additionalKeywords: settings.lorebookEntryOptions?.additionalKeywords || '',
        extractKeywords: settings.lorebookEntryOptions?.extractKeywords !== false,
        orderStrategy: settings.lorebookEntryOptions?.orderStrategy || 'recency',
        fixedOrderValue: settings.lorebookEntryOptions?.fixedOrderValue || 100,
    };

    const modalHtml = `
        <div class="ss-lorebook-options-modal">
            <h3>Lorebook Entry Options</h3>
            <p class="ss-option-hint ss-option-hint-intro">
                These settings apply to all summaries saved to lorebooks.
            </p>

            <div class="ss-option-group">
                <label for="ss-entry-type">Entry Type:</label>
                <select id="ss-entry-type" class="text_pole ss-option-control">
                    <option value="constant" ${modalState.entryType === 'constant' ? 'selected' : ''}>
                        Constant (Always active)
                    </option>
                    <option value="normal" ${modalState.entryType === 'normal' ? 'selected' : ''}>
                        Normal (Keyword triggered)
                    </option>
                    <option value="vectorized" ${modalState.entryType === 'vectorized' ? 'selected' : ''}>
                        Vectorized (Semantic search)
                    </option>
                    <option value="disabled" ${modalState.entryType === 'disabled' ? 'selected' : ''}>
                        Disabled (Saved but inactive)
                    </option>
                </select>
                <p class="ss-option-hint">
                    Constant entries are always included. Normal entries trigger on keywords.
                </p>
            </div>

            <div class="ss-option-group">
                <label for="ss-name-format">Entry Name Format:</label>
                <input id="ss-name-format" type="text" class="text_pole ss-option-control"
                       value="${escapeHtml(modalState.nameFormat)}" />
                <p class="ss-option-hint">
                    Variables: {start}, {end}, {date}, {character}
                </p>
            </div>

            <div class="ss-option-group">
                <label class="checkbox_label">
                    <input id="ss-extract-keywords" type="checkbox"
                           ${modalState.extractKeywords ? 'checked' : ''} />
                    <span>Extract keywords from summary (AI-generated)</span>
                </label>
                <p class="ss-option-hint">
                    AI will extract relevant keywords (names, events, topics) from the summary content.
                </p>
            </div>

            <div class="ss-option-group">
                <label class="checkbox_label">
                    <input id="ss-keywords-enabled" type="checkbox"
                           ${modalState.keywordsEnabled ? 'checked' : ''} />
                    <span>Use format-based keywords (fallback)</span>
                </label>
                <p class="ss-option-hint">
                    Used when AI extraction is disabled or returns no keywords.
                </p>
            </div>

            <div id="ss-keyword-options" class="${modalState.keywordsEnabled ? '' : 'ss-hidden'}">
                <div class="ss-option-group">
                    <label for="ss-keyword-format">Keyword Format:</label>
                    <input id="ss-keyword-format" type="text" class="text_pole ss-option-control"
                           value="${escapeHtml(modalState.keywordFormat)}" />
                    <p class="ss-option-hint">
                        Variables: {start}, {end}
                    </p>
                </div>
            </div>

            <div class="ss-option-group">
                <label>Additional Keywords:</label>
                <div id="ss-additional-keywords"></div>
                <p class="ss-option-hint">
                    Comma-separated list added to every entry (in addition to extracted/generated keywords)
                </p>
            </div>

            <hr class="ss-lorebook-separator" />

            <div class="ss-option-group">
                <label>Entry Order Strategy:</label>
                <div id="ss-order-strategy"></div>
                <p class="ss-option-hint">
                    Controls prompt inclusion priority. Higher order = included earlier in context.
                </p>
            </div>

            <div id="ss-fixed-order-options" class="${modalState.orderStrategy === 'fixed' ? '' : 'ss-hidden'}">
                <div class="ss-option-group">
                    <label for="ss-fixed-order-value">Fixed Order Value:</label>
                    <input id="ss-fixed-order-value" type="number" class="text_pole ss-option-control"
                           value="${modalState.fixedOrderValue}" min="0" max="999" />
                </div>
            </div>
        </div>
    `;

    const popup = new Popup(
        modalHtml,
        POPUP_TYPE.TEXT,
        null,
        {
            okButton: 'Save',
            cancelButton: 'Cancel',
            wide: false,
            large: false
        }
    );

    const showPromise = popup.show();

    // Attach event listeners after popup shows
    requestAnimationFrame(() => {
        const keywordOptions = document.getElementById('ss-keyword-options');
        const fixedOrderOptions = document.getElementById('ss-fixed-order-options');

        const updateKeywordOptionsVisibility = () => {
            keywordOptions?.classList.toggle('ss-hidden', !modalState.keywordsEnabled);
        };

        const updateFixedOrderVisibility = () => {
            fixedOrderOptions?.classList.toggle('ss-hidden', modalState.orderStrategy !== 'fixed');
        };

        document.getElementById('ss-entry-type')?.addEventListener('change', (e) => {
            modalState.entryType = e.target.value;
        });

        document.getElementById('ss-name-format')?.addEventListener('input', (e) => {
            modalState.nameFormat = e.target.value;
        });

        document.getElementById('ss-extract-keywords')?.addEventListener('change', (e) => {
            modalState.extractKeywords = e.target.checked;
        });

        document.getElementById('ss-keywords-enabled')?.addEventListener('change', (e) => {
            modalState.keywordsEnabled = e.target.checked;
            updateKeywordOptionsVisibility();
        });

        document.getElementById('ss-keyword-format')?.addEventListener('input', (e) => {
            modalState.keywordFormat = e.target.value;
        });

        const additionalKeywordsContainer = document.getElementById('ss-additional-keywords');
        if (additionalKeywordsContainer) {
            const tagInput = createTagInput({
                tags: parseCommaTags(modalState.additionalKeywords),
                placeholder: 'Add keyword...',
                onChange: (tags) => {
                    modalState.additionalKeywords = tagsToString(tags);
                }
            });
            additionalKeywordsContainer.replaceChildren(tagInput);
        }

        const orderStrategyContainer = document.getElementById('ss-order-strategy');
        if (orderStrategyContainer) {
            const segmentedToggle = createSegmentedToggle({
                options: [
                    { value: 'recency', label: 'Recency Priority' },
                    { value: 'fixed', label: 'Fixed Value' }
                ],
                value: modalState.orderStrategy,
                onChange: (value) => {
                    modalState.orderStrategy = value;
                    updateFixedOrderVisibility();
                }
            });
            orderStrategyContainer.replaceChildren(segmentedToggle);
        }

        document.getElementById('ss-fixed-order-value')?.addEventListener('input', (e) => {
            modalState.fixedOrderValue = parseInt(e.target.value, 10) || 100;
        });

        updateKeywordOptionsVisibility();
        updateFixedOrderVisibility();
    });

    const result = await showPromise;

    if (result === POPUP_RESULT.AFFIRMATIVE) {
        // Ensure lorebookEntryOptions object exists
        if (!settings.lorebookEntryOptions) {
            settings.lorebookEntryOptions = {};
        }

        // Save to settings
        settings.lorebookEntryOptions.entryType = modalState.entryType;
        settings.lorebookEntryOptions.nameFormat = modalState.nameFormat;
        settings.lorebookEntryOptions.extractKeywords = modalState.extractKeywords;
        settings.lorebookEntryOptions.keywordsEnabled = modalState.keywordsEnabled;
        settings.lorebookEntryOptions.keywordFormat = modalState.keywordFormat;
        settings.lorebookEntryOptions.additionalKeywords = modalState.additionalKeywords;
        settings.lorebookEntryOptions.orderStrategy = modalState.orderStrategy;
        settings.lorebookEntryOptions.fixedOrderValue = modalState.fixedOrderValue;

        saveSettings(settings);
        toastr.success('Lorebook options saved');
    }
}
