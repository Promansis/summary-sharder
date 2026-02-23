/**
 * Saved APIs Management Modal
 * CRUD interface for managing the shared pool of saved API configurations
 */

import { saveSettings } from '../../../core/settings.js';
import {
    getApiConfigs,
    getConfigById,
    createBlankApiConfig,
    updateApiConfig,
    deleteApiConfig,
    getApiKeyForConfig
} from '../../../core/api/legacy-api-config.js';
import { fetchExternalModels } from '../../../core/api/summary-api.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
import { showSsConfirm, showSsInput } from '../../common/modal-base.js';

/**
 * Render the saved APIs management interface
 * @param {Object} settings - Extension settings
 * @param {HTMLElement} container - Modal container
 * @param {string} selectedConfigId - Currently selected config ID
 */
function renderSavedApisInterface(settings, container, selectedConfigId = null) {
    const savedConfigs = getApiConfigs(settings);
    const selectedConfig = selectedConfigId ? getConfigById(settings, selectedConfigId) : null;

    const html = `
        <div class="ss-saved-apis-interface">
            <div class="ss-saved-api-selector-section">
                <label class="ss-saved-api-selector-label">
                    Saved API Configurations
                </label>
                <select id="ss-saved-api-select" class="text_pole ss-saved-api-selector">
                    <option value="">-- Select Configuration --</option>
                    ${savedConfigs.map(config => `
                        <option value="${config.id}" ${selectedConfigId === config.id ? 'selected' : ''}>
                            ${config.name}
                        </option>
                    `).join('')}
                </select>

                <div class="ss-saved-api-actions">
                    <button id="ss-new-api-btn" class="menu_button">New</button>
                    <button id="ss-delete-api-btn" class="menu_button" ${!selectedConfigId ? 'disabled' : ''}>Delete</button>
                </div>
            </div>

            <hr class="sysHR ss-saved-api-divider" />

            <div id="ss-api-form" class="ss-saved-api-form ${!selectedConfigId ? 'ss-disabled-section' : ''}">
                <div class="ss-saved-api-field">
                    <label class="ss-saved-api-field-label">
                        Configuration Name
                    </label>
                    <input type="text" id="ss-config-name" class="text_pole ss-saved-api-input"
                           value="${selectedConfig ? selectedConfig.name : ''}" placeholder="My API Config" />
                </div>

                <div class="ss-saved-api-field">
                    <label class="ss-saved-api-field-label">
                        API URL
                    </label>
                    <input type="text" id="ss-config-url" class="text_pole ss-saved-api-input"
                           value="${selectedConfig ? selectedConfig.url : ''}"
                           placeholder="https://api.example.com/v1" />
                    <small class="ss-saved-api-help">Base URL (with or without /chat/completions or /models)</small>
                </div>

                <div class="ss-saved-api-field">
                    <label class="ss-saved-api-field-label">
                        API Key
                    </label>
                    <input type="password" id="ss-config-key" class="text_pole ss-saved-api-input"
                           placeholder="Enter API key..." />
                    <small class="ss-saved-api-help">Leave blank to keep existing key</small>
                </div>

                <div class="ss-saved-api-field">
                    <label class="ss-saved-api-field-label">
                        Model
                    </label>
                    <div class="ss-saved-api-model-row">
                        <select id="ss-config-model" class="text_pole ss-saved-api-model-select">
                            <option value="">-- Click Fetch Models --</option>
                            ${selectedConfig && selectedConfig.model ? `<option value="${selectedConfig.model}" selected>${selectedConfig.model}</option>` : ''}
                        </select>
                        <button id="ss-fetch-models-btn" class="menu_button">Fetch Models</button>
                    </div>
                    <small class="ss-saved-api-help">Model to use with this API</small>
                </div>

                <div class="ss-saved-api-footer-actions">
                    <button id="ss-save-changes-btn" class="menu_button ss-saved-api-save-btn">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Get DOM elements
    const apiSelect = container.querySelector('#ss-saved-api-select');
    const newBtn = container.querySelector('#ss-new-api-btn');
    const deleteBtn = container.querySelector('#ss-delete-api-btn');
    const apiForm = container.querySelector('#ss-api-form');
    const configName = container.querySelector('#ss-config-name');
    const configUrl = container.querySelector('#ss-config-url');
    const configKey = container.querySelector('#ss-config-key');
    const configModel = container.querySelector('#ss-config-model');
    const fetchModelsBtn = container.querySelector('#ss-fetch-models-btn');
    const saveBtn = container.querySelector('#ss-save-changes-btn');

    // Load API key for selected config
    if (selectedConfigId) {
        getApiKeyForConfig(settings, selectedConfigId).then(key => {
            if (key) {
                configKey.placeholder = '••••••••••••';
            }
        });
    }

    // Selection change handler
    apiSelect.addEventListener('change', () => {
        const newSelectedId = apiSelect.value;
        renderSavedApisInterface(settings, container, newSelectedId);
    });

    // New button handler
    newBtn.addEventListener('click', async () => {
        const name = await showSsInput('Create New API Configuration', 'Enter configuration name:', '');
        if (!name) return;

        const result = await createBlankApiConfig(settings, name);
        if (result.success) {
            toastr.success(`Created configuration: ${name}`);
            renderSavedApisInterface(settings, container, result.configId);
        } else {
            toastr.error(result.error || 'Failed to create configuration');
        }
    });

    // Delete button handler
    deleteBtn.addEventListener('click', async () => {
        if (!selectedConfigId) return;

        const config = getConfigById(settings, selectedConfigId);
        const confirmed = await showSsConfirm(
            'Delete Configuration',
            `Are you sure you want to delete "${config.name}"?`
        );

        if (confirmed !== POPUP_RESULT.AFFIRMATIVE) return;

        const result = await deleteApiConfig(settings, selectedConfigId);
        if (result.success) {
            toastr.success('Configuration deleted');
            renderSavedApisInterface(settings, container, null);
        } else {
            toastr.error(result.error || 'Failed to delete configuration');
        }
    });

    // Fetch models handler
    fetchModelsBtn.addEventListener('click', async () => {
        if (!selectedConfigId) return;

        const url = configUrl.value.trim();
        const key = configKey.value.trim();

        if (!url) {
            toastr.warning('Please enter an API URL');
            return;
        }

        // Use existing key if not provided
        let apiKey = key;
        if (!apiKey) {
            apiKey = await getApiKeyForConfig(settings, selectedConfigId);
            if (!apiKey) {
                toastr.warning('Please enter an API Key');
                return;
            }
        }

        const testSettings = {
            apiUrl: url,
            apiKey: apiKey
        };

        fetchModelsBtn.disabled = true;
        fetchModelsBtn.textContent = 'Fetching...';

        try {
            const models = await fetchExternalModels(testSettings);

            if (models.length > 0) {
                // Get currently selected model
                const currentModel = configModel.value;

                // Populate dropdown with models
                configModel.innerHTML = '';

                const modelNames = models.map(m => m.id || m.name || m).filter(Boolean);
                modelNames.forEach(modelName => {
                    const option = document.createElement('option');
                    option.value = modelName;
                    option.textContent = modelName;
                    if (modelName === currentModel) {
                        option.selected = true;
                    }
                    configModel.appendChild(option);
                });

                // If no model was previously selected or the previous model isn't in the list, select the first one
                if (!currentModel || !modelNames.includes(currentModel)) {
                    configModel.selectedIndex = 0;
                }

                toastr.success(`Found ${models.length} models`);
            } else {
                toastr.warning('Connection successful but no models found');
                configModel.innerHTML = '<option value="">-- No models found --</option>';
            }
        } catch (error) {
            console.error('[SummarySharder] Fetch models failed:', error);
            toastr.error(`Failed to fetch models: ${error.message}`);
            configModel.innerHTML = '<option value="">-- Failed to fetch models --</option>';
        } finally {
            fetchModelsBtn.disabled = false;
            fetchModelsBtn.textContent = 'Fetch Models';
        }
    });

    // Save changes handler
    saveBtn.addEventListener('click', async () => {
        if (!selectedConfigId) return;

        const name = configName.value.trim();
        const url = configUrl.value.trim();
        const key = configKey.value.trim();
        const model = configModel.value.trim();

        if (!name) {
            toastr.warning('Configuration name is required');
            return;
        }

        if (!url) {
            toastr.warning('API URL is required');
            return;
        }

        // Update config name
        const config = getConfigById(settings, selectedConfigId);
        config.name = name;

        // Temporarily set settings for updateApiConfig to read
        settings.apiUrl = url;
        settings.selectedModel = model;

        // Only set apiKey if user entered a new one
        if (key) {
            settings.apiKey = key;
        } else {
            // Use existing key
            const existingKey = await getApiKeyForConfig(settings, selectedConfigId);
            if (!existingKey) {
                toastr.warning('API Key is required');
                return;
            }
            settings.apiKey = existingKey;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        const result = await updateApiConfig(settings, selectedConfigId);

        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';

        if (result.success) {
            toastr.success('Configuration saved');
            // Clear temporary password field
            configKey.value = '';
            configKey.placeholder = '••••••••••••';
            // Re-render to show updated name in dropdown
            renderSavedApisInterface(settings, container, selectedConfigId);
        } else {
            toastr.error(result.error || 'Failed to save configuration');
        }
    });
}

/**
 * Open the saved APIs management modal
 * @param {Object} settings - Extension settings
 * @returns {Promise<void>}
 */
export async function openSavedApisModal(settings) {
    const modalHtml = `
        <div class="ss-saved-apis-modal">
            <p class="ss-saved-api-intro">
                Manage your saved API configurations. These can be used by any feature (Summary, Sharder, or Events).
            </p>
            <div id="ss-saved-apis-content"></div>
        </div>
    `;

    const popup = new Popup(
        modalHtml,
        POPUP_TYPE.TEXT,
        null,
        {
            okButton: 'Close',
            cancelButton: null,
            wide: true,
            large: false
        }
    );

    const showPromise = popup.show();

    // Set up content after popup shows
    requestAnimationFrame(() => {
        const modalContainer = document.querySelector('.ss-saved-apis-modal');
        if (!modalContainer) return;

        const contentDiv = modalContainer.querySelector('#ss-saved-apis-content');
        renderSavedApisInterface(settings, contentDiv, null);
    });

    await showPromise;
}

