/**
 * API Configuration Modal
 * Tabbed interface for configuring API settings per feature (Summary, Sharder, Pre-Edit Events)
 */

import { saveSettings } from '../../../core/settings.js';
import { getApiConfigs, getConfigById } from '../../../core/api/legacy-api-config.js';
import { Popup, POPUP_TYPE } from '../../../../../../popup.js';
import { updateApiStatusDisplays } from '../../common/api-status-state.js';
import { createSegmentedToggle } from '../../common/index.js';

/**
 * Render a single feature's API configuration tab
 * @param {Object} settings - Extension settings
 * @param {string} feature - Feature key ('summary', 'sharder', 'events')
 * @param {HTMLElement} container - Tab panel container
 */
function renderFeatureTab(settings, feature, container) {
    const featureConfig = settings.apiFeatures?.[feature] || {
        useSillyTavernAPI: false,
        apiConfigId: null
    };

    const savedConfigs = getApiConfigs(settings);
    const usingST = featureConfig.useSillyTavernAPI;
    const selectedConfigId = featureConfig.apiConfigId;

    // Feature display names
    const featureNames = {
        summary: 'Summary',
        sharder: 'Sharder',
        events: 'Pre-Edit Events'
    };
    const featureName = featureNames[feature] || feature;

    const html = `
        <div class="ss-api-feature-config">
            <h3>${featureName} API Configuration</h3>
            <p class="ss-api-feature-description">
                Choose which API this feature should use for generating content.
            </p>
            <p class="ss-api-autosave-hint ss-text-hint">
                Changes are saved immediately.
            </p>

            <div class="ss-api-mode-selector">
                <label class="ss-api-radio-label">
                    <input type="radio" name="${feature}-api-mode" value="st" ${usingST ? 'checked' : ''} />
                    <strong>Use SillyTavern's Current API</strong>
                    <p class="ss-api-radio-hint">
                        Uses whichever API is currently active in SillyTavern's main settings.
                    </p>
                </label>

                <label class="ss-api-radio-label">
                    <input type="radio" name="${feature}-api-mode" value="external" ${!usingST ? 'checked' : ''} />
                    <strong>Use External API</strong>
                    <p class="ss-api-radio-hint">
                        Choose a saved API configuration from the list below.
                    </p>
                </label>

                <div class="ss-external-api-selection ${usingST ? 'ss-disabled-section' : ''}">
                    <select id="${feature}-api-select" class="text_pole ss-api-select">
                        <option value="">-- Select API Configuration --</option>
                        ${savedConfigs.map(config => `
                            <option value="${config.id}" ${selectedConfigId === config.id ? 'selected' : ''}>
                                ${config.name}
                            </option>
                        `).join('')}
                    </select>

                    <button id="${feature}-manage-apis" class="menu_button ss-api-manage-apis-btn">
                        Manage Saved APIs...
                    </button>
                </div>
            </div>

            <!-- Generation Settings Section -->
            <hr class="sysHR ss-api-config-divider" />
            <div class="ss-generation-settings">
                <h4>Generation Settings</h4>
                <p class="ss-api-generation-settings-hint">
                    Configure API call parameters for ${featureName}.
                </p>
                <div class="ss-setting-row ss-api-setting-row">
                    <div class="ss-api-setting-col">
                        <label for="${feature}-queue-delay">Queue Delay (ms):</label>
                        <input type="number" id="${feature}-queue-delay" class="text_pole"
                               value="${featureConfig.queueDelayMs || 0}" min="0" step="100"
                               title="Delay between API calls when processing multiple items" />
                    </div>
                    <div class="ss-api-setting-col">
                        <label for="${feature}-temperature">Temperature:</label>
                        <input type="number" id="${feature}-temperature" class="text_pole"
                               value="${featureConfig.temperature ?? 0.4}" min="0" max="2" step="0.1"
                               title="Controls randomness in generation (0-2)" />
                    </div>
                    <div class="ss-api-setting-col">
                        <label for="${feature}-top-p">Top P:</label>
                        <input type="number" id="${feature}-top-p" class="text_pole"
                               value="${featureConfig.topP ?? 1}" min="0" max="1" step="0.05"
                               title="Nucleus sampling threshold (0-1)" />
                    </div>
                    <div class="ss-api-setting-col">
                        <label for="${feature}-max-tokens">Max Tokens:</label>
                        <input type="number" id="${feature}-max-tokens" class="text_pole"
                               value="${featureConfig.maxTokens ?? 8096}" min="100" max="128000" step="100"
                               title="Maximum response length in tokens" />
                    </div>
                </div>

                <div class="ss-setting-row ss-api-secondary-setting-row">
                    <div class="ss-api-option-column ${usingST ? 'ss-disabled-section' : ''}">
                        <label for="${feature}-post-processing">Prompt Post-Processing:</label>
                        <select id="${feature}-post-processing" class="text_pole"
                                title="Transform messages before sending to API. Only applies to External API mode."
                                ${usingST ? 'disabled' : ''}>
                            <option value="" ${(featureConfig.postProcessing || '') === '' ? 'selected' : ''}>None</option>
                            <option value="merge" ${featureConfig.postProcessing === 'merge' ? 'selected' : ''}>Merge (same-role)</option>
                            <option value="semi" ${featureConfig.postProcessing === 'semi' ? 'selected' : ''}>Semi-strict alternating</option>
                            <option value="strict" ${featureConfig.postProcessing === 'strict' ? 'selected' : ''}>Strict alternating</option>
                            <option value="single" ${featureConfig.postProcessing === 'single' ? 'selected' : ''}>Single user message</option>
                        </select>
                        <p class="ss-api-option-hint">
                            Transforms message roles before sending to the API.
                            Use "Strict" for APIs requiring alternating user/assistant roles.
                            Only applies when using External API.
                        </p>
                    </div>

                    <div class="ss-api-option-column ss-api-message-format-column">
                        <label for="${feature}-message-format">Message Format:</label>
                        <div id="${feature}-message-format-host"></div>
                        <p class="ss-api-option-hint">
                            Use "Alternating" if your API requires assistant turns between messages.
                            Recommended for proxy APIs. Applies to both ST and External API modes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Event handlers for this tab
    const stRadio = container.querySelector(`input[name="${feature}-api-mode"][value="st"]`);
    const externalRadio = container.querySelector(`input[name="${feature}-api-mode"][value="external"]`);
    const externalSelection = container.querySelector('.ss-external-api-selection');
    const apiSelect = container.querySelector(`#${feature}-api-select`);
    const manageButton = container.querySelector(`#${feature}-manage-apis`);

    // Toggle external selection visibility
    const updateVisibility = () => {
        const isExternal = externalRadio.checked;
        externalSelection?.classList.toggle('ss-disabled-section', !isExternal);

        // Post-processing only applies to external API
        const ppSelect = container.querySelector(`#${feature}-post-processing`);
        const ppSection = ppSelect?.closest('.ss-api-option-column');
        if (ppSelect) {
            ppSelect.disabled = !isExternal;
            ppSection?.classList.toggle('ss-disabled-section', !isExternal);
        }
    };

    stRadio.addEventListener('change', updateVisibility);
    externalRadio.addEventListener('change', updateVisibility);

    // Save changes when mode or selection changes
    const saveChanges = () => {
        if (!settings.apiFeatures) {
            settings.apiFeatures = {};
        }
        if (!settings.apiFeatures[feature]) {
            settings.apiFeatures[feature] = {};
        }

        settings.apiFeatures[feature].useSillyTavernAPI = stRadio.checked;
        settings.apiFeatures[feature].apiConfigId = apiSelect.value || null;

        saveSettings(settings);
        console.log(`[SummarySharder] Updated ${feature} API config:`, settings.apiFeatures[feature]);

        // Update display in main UI
        updateApiStatusDisplays(settings);
    };

    stRadio.addEventListener('change', saveChanges);
    externalRadio.addEventListener('change', saveChanges);
    apiSelect.addEventListener('change', saveChanges);

    // Generation settings event handlers
    const queueDelayInput = container.querySelector(`#${feature}-queue-delay`);
    const temperatureInput = container.querySelector(`#${feature}-temperature`);
    const topPInput = container.querySelector(`#${feature}-top-p`);
    const maxTokensInput = container.querySelector(`#${feature}-max-tokens`);
    const messageFormatHost = container.querySelector(`#${feature}-message-format-host`);
    if (messageFormatHost) {
        const messageFormatToggle = createSegmentedToggle({
            options: [
                { value: 'minimal', label: 'Minimal' },
                { value: 'alternating', label: 'Alternating' },
            ],
            value: featureConfig.messageFormat || 'minimal',
        });
        messageFormatToggle.id = `${feature}-message-format`;
        messageFormatHost.replaceChildren(messageFormatToggle);
    }

    const saveGenerationSettings = () => {
        if (!settings.apiFeatures) {
            settings.apiFeatures = {};
        }
        if (!settings.apiFeatures[feature]) {
            settings.apiFeatures[feature] = {};
        }

        settings.apiFeatures[feature].queueDelayMs = Math.max(0, parseInt(queueDelayInput.value, 10) || 0);
        settings.apiFeatures[feature].temperature = Math.min(2, Math.max(0, parseFloat(temperatureInput.value) || 0.4));
        settings.apiFeatures[feature].topP = Math.min(1, Math.max(0, parseFloat(topPInput.value) || 1));
        settings.apiFeatures[feature].maxTokens = Math.min(128000, Math.max(100, parseInt(maxTokensInput.value, 10) || 8096));

        saveSettings(settings);
        console.log(`[SummarySharder] Updated ${feature} generation settings`);
    };

    queueDelayInput?.addEventListener('change', saveGenerationSettings);
    temperatureInput?.addEventListener('change', saveGenerationSettings);
    topPInput?.addEventListener('change', saveGenerationSettings);
    maxTokensInput?.addEventListener('change', saveGenerationSettings);

    // Post-processing dropdown handler
    const postProcessingSelect = container.querySelector(`#${feature}-post-processing`);
    postProcessingSelect?.addEventListener('change', () => {
        if (!settings.apiFeatures) settings.apiFeatures = {};
        if (!settings.apiFeatures[feature]) settings.apiFeatures[feature] = {};

        settings.apiFeatures[feature].postProcessing = postProcessingSelect.value;

        saveSettings(settings);
        console.log(`[SummarySharder] Updated ${feature} post-processing: ${postProcessingSelect.value || 'none'}`);
    });

    // Message format dropdown handler
    const messageFormatSelect = container.querySelector(`#${feature}-message-format`);
    messageFormatSelect?.addEventListener('change', () => {
        if (!settings.apiFeatures) settings.apiFeatures = {};
        if (!settings.apiFeatures[feature]) settings.apiFeatures[feature] = {};

        settings.apiFeatures[feature].messageFormat = messageFormatSelect.getValue?.()
            || messageFormatSelect.dataset?.value
            || messageFormatSelect.value
            || 'minimal';

        saveSettings(settings);
        console.log(`[SummarySharder] Updated ${feature} message format: ${settings.apiFeatures[feature].messageFormat}`);
    });

    // Manage APIs button
    manageButton.addEventListener('click', async () => {
        const { openSavedApisModal } = await import('./saved-apis-modal.js');
        await openSavedApisModal(settings);

        // Re-render this tab to reflect any changes
        renderFeatureTab(settings, feature, container);
    });
}

/**
 * Handle tab switching
 */
function switchTab(tabId, container) {
    // Update tab buttons
    container.querySelectorAll('.ss-tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update tab panels
    container.querySelectorAll('.ss-tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `ss-api-tab-${tabId}`);
    });
}

/**
 * Open the API configuration modal
 * @param {Object} settings - Extension settings
 * @returns {Promise<void>}
 */
export async function openApiConfigModal(settings) {
    const modalHtml = `
        <div class="ss-api-config-modal">
            <div class="ss-tab-header">
                <button class="ss-tab-button active" data-tab="summary">Summary API</button>
                <button class="ss-tab-button" data-tab="sharder">Sharder API</button>
                <button class="ss-tab-button" data-tab="events">Events API</button>
            </div>

            <div class="ss-tab-content">
                <div id="ss-api-tab-summary" class="ss-tab-panel active"></div>
                <div id="ss-api-tab-sharder" class="ss-tab-panel"></div>
                <div id="ss-api-tab-events" class="ss-tab-panel"></div>
            </div>
        </div>
    `;

    const popup = new Popup(
        modalHtml,
        POPUP_TYPE.TEXT,
        null,
        {
            okButton: 'Save and Exit',
            cancelButton: 'Cancel',
            wide: true,
            large: false
        }
    );

    const showPromise = popup.show();

    // Set up content after popup shows
    requestAnimationFrame(() => {
        const modalContainer = document.querySelector('.ss-api-config-modal');
        if (!modalContainer) return;

        const summaryPanel = modalContainer.querySelector('#ss-api-tab-summary');
        const sharderPanel = modalContainer.querySelector('#ss-api-tab-sharder');
        const eventsPanel = modalContainer.querySelector('#ss-api-tab-events');

        // Render initial tab content
        renderFeatureTab(settings, 'summary', summaryPanel);
        renderFeatureTab(settings, 'sharder', sharderPanel);
        renderFeatureTab(settings, 'events', eventsPanel);

        // Tab switching
        modalContainer.querySelectorAll('.ss-tab-button').forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.dataset.tab, modalContainer);
            });
        });
    });

    await showPromise;
}
