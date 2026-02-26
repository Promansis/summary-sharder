/**
 * API Configuration Modal
 * Tabbed interface for configuring API settings per feature (Summary, Sharder, Pre-Edit Events, Chat Manager)
 */

import { saveSettings } from '../../../core/settings.js';
import { getApiConfigs } from '../../../core/api/legacy-api-config.js';
import { getConnectionProfiles, isConnectionManagerAvailable } from '../../../core/api/connection-profile-api.js';
import { Popup, POPUP_TYPE } from '../../../../../../popup.js';
import { updateApiStatusDisplays } from '../../common/api-status-state.js';
import { createSegmentedToggle } from '../../common/index.js';

/**
 * Render a single feature's API configuration tab
 * @param {Object} settings - Extension settings
 * @param {string} feature - Feature key ('summary', 'sharder', 'events', 'chatManager')
 * @param {HTMLElement} container - Tab panel container
 */
function renderFeatureTab(settings, feature, container) {
    const featureConfig = settings.apiFeatures?.[feature] || {
        useSillyTavernAPI: false,
        apiConfigId: null,
        connectionProfileId: null
    };

    const savedConfigs = getApiConfigs(settings);
    const connectionManagerAvailable = isConnectionManagerAvailable();
    const profileGroups = connectionManagerAvailable ? getConnectionProfiles() : [];
    const selectedProfileId = featureConfig.connectionProfileId || null;
    const usingST = featureConfig.useSillyTavernAPI === true;
    const usingProfile = !usingST && !!selectedProfileId;
    const currentMode = usingST ? 'st' : (usingProfile ? 'profile' : 'external');
    const selectedConfigId = featureConfig.apiConfigId;

    // Feature display names
    const featureNames = {
        summary: 'Summary',
        sharder: 'Sharder',
        events: 'Pre-Edit Events',
        chatManager: 'Chat Manager'
    };
    const featureName = featureNames[feature] || feature;
    const profileUnavailableTitle = 'Connection Manager extension is unavailable. Enable it in Extensions to use profile mode.';
    const selectedProfileFound = profileGroups.some(group => group.profiles.some(profileEntry => profileEntry.id === selectedProfileId));
    const profileOptionsHtml = profileGroups.map(group => `
        <optgroup label="${group.label}">
            ${group.profiles.map(profileEntry => `
                <option value="${profileEntry.id}" ${selectedProfileId === profileEntry.id ? 'selected' : ''}>
                    ${profileEntry.name}
                </option>
            `).join('')}
        </optgroup>
    `).join('');
    const fallbackProfileOption = selectedProfileId && !selectedProfileFound
        ? `<option value="${selectedProfileId}" selected>Unknown Profile (${selectedProfileId})</option>`
        : '';
    const profileWarningHtml = !connectionManagerAvailable && usingProfile
        ? `<p class="ss-api-profile-warning ss-text-hint">
            Profile mode is active but Connection Manager is unavailable. Enable Connection Manager or switch this feature API mode.
        </p>`
        : '';

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
                    <input type="radio" name="${feature}-api-mode" value="st" ${currentMode === 'st' ? 'checked' : ''} />
                    <strong>Use SillyTavern's Current API</strong>
                    <p class="ss-api-radio-hint">
                        Uses whichever API is currently active in SillyTavern's main settings.
                    </p>
                </label>

                <label class="ss-api-radio-label">
                    <input type="radio" name="${feature}-api-mode" value="external" ${currentMode === 'external' ? 'checked' : ''} />
                    <strong>Use External API</strong>
                    <p class="ss-api-radio-hint">
                        Choose a saved API configuration from the list below.
                    </p>
                </label>

                <div class="ss-external-api-selection ${currentMode === 'external' ? '' : 'ss-disabled-section'}">
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

                <label class="ss-api-radio-label"
                    ${connectionManagerAvailable ? '' : `title="${profileUnavailableTitle}"`}>
                    <input type="radio"
                        name="${feature}-api-mode"
                        value="profile"
                        ${currentMode === 'profile' ? 'checked' : ''}
                        ${connectionManagerAvailable ? '' : 'disabled'}
                        ${connectionManagerAvailable ? '' : `title="${profileUnavailableTitle}"`} />
                    <strong>Use Connection Profile</strong>
                    <p class="ss-api-radio-hint">
                        Use a specific Connection Manager profile without changing SillyTavern's global active connection.
                    </p>
                </label>

                <div class="ss-profile-api-selection ${currentMode === 'profile' ? '' : 'ss-disabled-section'}"
                    ${connectionManagerAvailable ? '' : `title="${profileUnavailableTitle}"`}>
                    <select id="${feature}-profile-select"
                        class="text_pole ss-api-select"
                        ${connectionManagerAvailable && currentMode === 'profile' ? '' : 'disabled'}
                        ${connectionManagerAvailable ? '' : `title="${profileUnavailableTitle}"`}>
                        <option value="">-- Select Connection Profile --</option>
                        ${fallbackProfileOption}
                        ${profileOptionsHtml}
                    </select>
                </div>

                ${profileWarningHtml}
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
                    <div class="ss-api-option-column ${currentMode === 'external' ? '' : 'ss-disabled-section'}">
                        <label for="${feature}-post-processing">Prompt Post-Processing:</label>
                        <select id="${feature}-post-processing" class="text_pole"
                                title="Transform messages before sending to API. Only applies to External API mode."
                                ${currentMode === 'external' ? '' : 'disabled'}>
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
                            Recommended for proxy APIs. Applies to ST, External, and Connection Profile modes.
                        </p>
                    </div>

                    <div class="ss-api-option-column">
                        <label class="checkbox_label" for="${feature}-remove-stop-strings">
                            <input type="checkbox"
                                id="${feature}-remove-stop-strings"
                                ${featureConfig.removeStopStrings === true ? 'checked' : ''} />
                            <span>Remove Stop Strings</span>
                        </label>
                        <p class="ss-api-option-hint">
                            Sends requests without stop strings for SillyTavern/Connection Profile modes.
                            Useful for proxies that return empty output when stops are present.
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
    const profileRadio = container.querySelector(`input[name="${feature}-api-mode"][value="profile"]`);
    const externalSelection = container.querySelector('.ss-external-api-selection');
    const profileSelection = container.querySelector('.ss-profile-api-selection');
    const apiSelect = container.querySelector(`#${feature}-api-select`);
    const profileSelect = container.querySelector(`#${feature}-profile-select`);
    const manageButton = container.querySelector(`#${feature}-manage-apis`);

    const getSelectedMode = () => {
        if (stRadio?.checked) return 'st';
        if (profileRadio?.checked) return 'profile';
        return 'external';
    };

    // Toggle mode-dependent sections and controls
    const updateVisibility = () => {
        const mode = getSelectedMode();
        const isExternal = mode === 'external';
        const isProfile = mode === 'profile';

        externalSelection?.classList.toggle('ss-disabled-section', !isExternal);
        if (apiSelect) apiSelect.disabled = !isExternal;
        if (manageButton) manageButton.disabled = !isExternal;

        profileSelection?.classList.toggle('ss-disabled-section', !isProfile);
        if (profileSelect) {
            profileSelect.disabled = !isProfile || !connectionManagerAvailable;
        }

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
    profileRadio?.addEventListener('change', updateVisibility);

    // Save changes when mode or selection changes
    const saveChanges = () => {
        if (!settings.apiFeatures) {
            settings.apiFeatures = {};
        }
        if (!settings.apiFeatures[feature]) {
            settings.apiFeatures[feature] = {};
        }

        const mode = getSelectedMode();
        const existingProfileId = settings.apiFeatures[feature].connectionProfileId || selectedProfileId || null;

        if (mode === 'st') {
            settings.apiFeatures[feature].useSillyTavernAPI = true;
            settings.apiFeatures[feature].apiConfigId = null;
            settings.apiFeatures[feature].connectionProfileId = null;
        } else if (mode === 'external') {
            settings.apiFeatures[feature].useSillyTavernAPI = false;
            settings.apiFeatures[feature].apiConfigId = apiSelect?.value || null;
            settings.apiFeatures[feature].connectionProfileId = null;
        } else {
            settings.apiFeatures[feature].useSillyTavernAPI = false;
            settings.apiFeatures[feature].connectionProfileId = profileSelect?.value || existingProfileId || null;
            settings.apiFeatures[feature].apiConfigId = null;
        }

        saveSettings(settings);
        console.log(`[SummarySharder] Updated ${feature} API config:`, settings.apiFeatures[feature]);

        // Update display in main UI
        updateApiStatusDisplays(settings);
    };

    stRadio.addEventListener('change', saveChanges);
    externalRadio.addEventListener('change', saveChanges);
    profileRadio?.addEventListener('change', saveChanges);
    apiSelect.addEventListener('change', saveChanges);
    profileSelect?.addEventListener('change', saveChanges);
    updateVisibility();

    // Generation settings event handlers
    const queueDelayInput = container.querySelector(`#${feature}-queue-delay`);
    const temperatureInput = container.querySelector(`#${feature}-temperature`);
    const topPInput = container.querySelector(`#${feature}-top-p`);
    const maxTokensInput = container.querySelector(`#${feature}-max-tokens`);
    const removeStopStringsInput = container.querySelector(`#${feature}-remove-stop-strings`);
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
        settings.apiFeatures[feature].removeStopStrings = removeStopStringsInput?.checked === true;

        saveSettings(settings);
        console.log(`[SummarySharder] Updated ${feature} generation settings`);
    };

    queueDelayInput?.addEventListener('change', saveGenerationSettings);
    temperatureInput?.addEventListener('change', saveGenerationSettings);
    topPInput?.addEventListener('change', saveGenerationSettings);
    maxTokensInput?.addEventListener('change', saveGenerationSettings);
    removeStopStringsInput?.addEventListener('change', saveGenerationSettings);

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
                <button class="ss-tab-button" data-tab="chat-manager">Chat Manager API</button>
            </div>

            <div class="ss-tab-content">
                <div id="ss-api-tab-summary" class="ss-tab-panel active"></div>
                <div id="ss-api-tab-sharder" class="ss-tab-panel"></div>
                <div id="ss-api-tab-events" class="ss-tab-panel"></div>
                <div id="ss-api-tab-chat-manager" class="ss-tab-panel"></div>
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
        const chatManagerPanel = modalContainer.querySelector('#ss-api-tab-chat-manager');

        // Render initial tab content
        renderFeatureTab(settings, 'summary', summaryPanel);
        renderFeatureTab(settings, 'sharder', sharderPanel);
        renderFeatureTab(settings, 'events', eventsPanel);
        renderFeatureTab(settings, 'chatManager', chatManagerPanel);

        // Tab switching
        modalContainer.querySelectorAll('.ss-tab-button').forEach(btn => {
            btn.addEventListener('click', () => {
                switchTab(btn.dataset.tab, modalContainer);
            });
        });
    });

    await showPromise;
}
