/**
 * Themes modal composition for Summary Sharder
 */

import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../../../popup.js';
import { escapeHtml } from '../../common/ui-utils.js';
import { BUILTIN_THEMES } from '../../common/builtin-themes.js';
import {
    getThemes,
    getCustomThemes,
    applyTheme,
    importTheme,
    exportTheme,
    exportAllCustomThemes,
    deleteTheme,
    duplicateTheme
} from './theme-core.js';
import { showColorEditorModal } from './theme-editor-modal.js';

// Proxy to preserve existing code paths that reference customThemes directly
const customThemes = new Proxy({}, {
    get: (_, prop) => getCustomThemes()[prop],
    set: (_, prop, value) => { getCustomThemes()[prop] = value; return true; },
    deleteProperty: (_, prop) => delete getCustomThemes()[prop],
    ownKeys: () => Reflect.ownKeys(getCustomThemes()),
    getOwnPropertyDescriptor: (_, prop) => Object.getOwnPropertyDescriptor(getCustomThemes(), prop) || { enumerable: true, configurable: true },
});

// ===== MODAL UI =====

/**
 * Build theme card HTML
 */
function buildThemeCard(themeId, theme, isActive) {
    const activeClass = isActive ? 'ss-theme-card-active' : '';
    const isBuiltin = theme.builtin || BUILTIN_THEMES[themeId];
    const fallbackColors = BUILTIN_THEMES.default?.colors || {};
    const previewColors = {
        ...fallbackColors,
        ...(theme.colors || {})
    };
    const previewCssVars = Object.entries(previewColors)
        .map(([property, value]) => `${property}: ${value};`)
        .join(' ');

    return `
        <div class="ss-theme-card ${activeClass}" data-theme="${escapeHtml(themeId)}">
            <div class="ss-theme-preview" style="
                ${previewCssVars}
                background: ${previewColors['--ss-bg-primary']};
                border: 2px solid ${previewColors['--ss-primary']};
                --ss-card-font-primary: ${previewColors['--ss-font-primary'] || 'inherit'};
                --ss-card-font-secondary: ${previewColors['--ss-font-secondary'] || previewColors['--ss-font-primary'] || 'inherit'};
                --ss-card-font-muted: ${previewColors['--ss-font-muted'] || previewColors['--ss-font-secondary'] || previewColors['--ss-font-primary'] || 'inherit'};
                --ss-card-size-primary: ${previewColors['--ss-font-size-primary'] || '1em'};
                --ss-card-size-secondary: ${previewColors['--ss-font-size-secondary'] || '0.85em'};
                --ss-card-size-muted: ${previewColors['--ss-font-size-muted'] || '0.8em'};
                --ss-card-text-primary: ${previewColors['--ss-text-primary'] || 'inherit'};
                --ss-card-text-muted: ${previewColors['--ss-text-muted'] || previewColors['--ss-text-secondary'] || 'inherit'};
            ">
                <div class="ss-theme-preview-header" style="
                    background: ${previewColors['--ss-bg-secondary']};
                    color: ${previewColors['--ss-text-primary']};
                    border-bottom: 1px solid ${previewColors['--ss-border']};
                ">
                    <span style="color: ${previewColors['--ss-primary']}">&bull;</span>
                    ${escapeHtml(theme.preview)} ${escapeHtml(theme.name)}
                    ${isBuiltin ? '<span class="ss-builtin-badge">Built-in</span>' : '<span class="ss-custom-badge">Custom</span>'}
                </div>
                <div class="ss-theme-preview-body">
                    <div class="ss-preview-button" style="
                        background: ${previewColors['--ss-primary']};
                        color: ${previewColors['--ss-bg-primary']};
                    ">
                        Button
                    </div>
                    <div class="ss-theme-info">
                        <h4>${escapeHtml(theme.name)}</h4>
                        <p>${escapeHtml(theme.description || '')}</p>
                    </div>
                    <div class="ss-theme-actions">
                        ${isActive
                            ? '<span class="ss-theme-active-badge">&#10003; Active</span>'
                            : `<button class="menu_button ss-apply-theme-btn" data-theme="${escapeHtml(themeId)}">Apply</button>`
                        }
                        <button class="menu_button ss-export-theme-btn" data-theme="${escapeHtml(themeId)}" title="Export">&#128228;</button>
                        <button class="menu_button ss-duplicate-theme-btn" data-theme="${escapeHtml(themeId)}" title="Duplicate">&#128203;</button>
                        ${!isBuiltin ? `<button class="menu_button ss-delete-theme-btn" data-theme="${escapeHtml(themeId)}" title="Delete">&#128465;</button>` : ''}
                        ${!isBuiltin ? `<button class="menu_button ss-edit-theme-btn" data-theme="${escapeHtml(themeId)}" title="Edit Colors">&#127912;</button>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}
/**
 * Build modal HTML
 */
function buildModalHTML(currentThemeId) {
    const themes = getThemes();
    
    // Separate built-in and custom themes
    const builtinCards = Object.entries(BUILTIN_THEMES)
        .map(([id, theme]) => buildThemeCard(id, theme, id === currentThemeId))
        .join('');
    
    const customCards = Object.entries(customThemes)
        .map(([id, theme]) => buildThemeCard(id, theme, id === currentThemeId))
        .join('');
    
    return `
        <div class="ss-themes-modal ss-modal">
            <div class="ss-themes-header">
                <h3>🎨 Extension Themes</h3>
                <p>Customize the look and feel of Summary Sharder</p>
            </div>
            
            <!-- Import/Export Controls -->
            <div class="ss-themes-controls">
                <button class="menu_button ss-import-theme-btn">
                    <i class="fa fa-upload"></i> Import Theme
                </button>
                <button class="menu_button ss-export-all-btn" ${Object.keys(customThemes).length === 0 ? 'disabled' : ''}>
                    <i class="fa fa-download"></i> Export All Custom
                </button>
                <button class="menu_button ss-create-theme-btn">
                    <i class="fa fa-plus"></i> Create New
                </button>
            </div>
            
            <!-- Built-in Themes -->
            <div class="ss-themes-section">
                <h4>📦 Built-in Themes</h4>
                <div class="ss-themes-grid">
                    ${builtinCards}
                </div>
            </div>
            
            <!-- Custom Themes -->
            <div class="ss-themes-section">
                <h4>🎨 Custom Themes ${Object.keys(customThemes).length > 0 ? `(${Object.keys(customThemes).length})` : ''}</h4>
                <div class="ss-themes-grid">
                    ${customCards || '<p class="ss-no-custom-themes">No custom themes yet. Import one or create your own!</p>'}
                </div>
            </div>
            
            <div class="ss-themes-footer">
                <p class="ss-themes-hint">
                    <span class="ss-info-icon">ℹ️</span>
                    Your theme preference and custom themes are saved automatically.
                </p>
            </div>
        </div>
    `;
}

/**
 * Show import theme dialog
 */
async function showImportDialog(settings, saveSettingsFn, refreshModalFn) {
    const importHtml = `
        <div class="ss-import-modal ss-modal">
            <h3>📥 Import Theme</h3>
            <p>Paste theme JSON below or upload a file:</p>
            
            <div class="ss-import-file-section">
                <input type="file" id="ss-theme-file-input" accept=".json" style="display: none;">
                <button class="menu_button ss-upload-file-btn">
                    <i class="fa fa-folder-open"></i> Choose File
                </button>
                <span class="ss-file-name">No file selected</span>
            </div>
            
            <div class="ss-import-text-section">
                <label>Or paste JSON:</label>
                <textarea id="ss-theme-json-input" rows="12" placeholder='{
  "id": "my-theme",
  "name": "My Theme",
  "description": "A custom theme",
  "preview": "🎨",
  "colors": {
    "--ss-primary": "#ff6600",
    ...
  }
}'></textarea>
            </div>
            
            <div class="ss-import-actions">
                <button class="menu_button ss-do-import-btn">Import</button>
            </div>
        </div>
    `;
    
    const popup = new Popup(importHtml, POPUP_TYPE.TEXT, null, {
        okButton: 'Close',
        cancelButton: false,
        wide: true,
    });
    
    const showPromise = popup.show();
    
    // Wait for DOM to be ready
    await waitForElement('.ss-import-modal');
    
    // File upload handler
    const fileInput = document.getElementById('ss-theme-file-input');
    const uploadBtn = document.querySelector('.ss-upload-file-btn');
    const fileNameSpan = document.querySelector('.ss-file-name');
    const jsonInput = document.getElementById('ss-theme-json-input');
    
    uploadBtn?.addEventListener('click', () => fileInput?.click());
    
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
            fileNameSpan.textContent = file.name;
            const reader = new FileReader();
            reader.onload = (event) => {
                jsonInput.value = event.target.result;
            };
            reader.readAsText(file);
        }
    });
    
    // Import button handler
    document.querySelector('.ss-do-import-btn')?.addEventListener('click', async () => {
        const json = jsonInput?.value?.trim();
        if (!json) {
            toastr.warning('Please enter theme JSON or upload a file');
            return;
        }
        
        const result = await importTheme(json, settings, saveSettingsFn);
        
        if (result.success) {
            toastr.success(result.message || `Theme "${result.themeId}" imported successfully!`);
            popup.complete(POPUP_RESULT.OK);
            if (refreshModalFn) refreshModalFn();
        } else {
            toastr.error(result.error || 'Failed to import theme');
        }
    });
    
    return showPromise;
}


/**
 * Show create theme dialog
 */
async function showCreateDialog(settings, saveSettingsFn, refreshModalFn) {
    const createHtml = `
        <div class="ss-create-theme-modal ss-modal">
            <h3>✨ Create New Theme</h3>
            <p>Create a new theme based on an existing one, then customize it.</p>
            
            <div class="ss-create-form">
                <div class="ss-form-group">
                    <label>Theme ID (lowercase, no spaces):</label>
                    <input type="text" id="ss-new-theme-id" placeholder="my-custom-theme">                    
                </div>
                
                <div class="ss-form-group">
                    <label>Theme Name:</label>
                    <input type="text" id="ss-new-theme-name" placeholder="My Custom Theme">
                </div>
                
                <div class="ss-form-group">
                    <label>Description:</label>
                    <input type="text" id="ss-new-theme-desc" placeholder="A brief description of your theme">
                </div>
                
                <div class="ss-form-group">
                    <label>Preview Emoji:</label>
                    <input type="text" id="ss-new-theme-emoji" value="🎨" maxlength="2">
                </div>
                
                <div class="ss-form-group">
                    <label>Base Theme (copy colors from):</label>
                    <select id="ss-base-theme">
                        ${Object.entries(getThemes()).map(([id, t]) => 
                            `<option value="${id}">${t.name}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            
            <div class="ss-create-actions">
                <button class="menu_button ss-do-create-btn">Create Theme</button>
            </div>
        </div>
    `;
    
    const popup = new Popup(createHtml, POPUP_TYPE.TEXT, null, {
        okButton: 'Cancel',
        cancelButton: false,
    });
    
    // Track if we created a theme (to know if we need to refresh)
    let themeCreated = false;
    
    const showPromise = popup.show();
    
    // Wait for DOM to be ready
    try {
        await waitForElement('.ss-create-theme-modal');
    } catch (e) {
        console.warn('[SummarySharder] Create modal element not found:', e);
        return showPromise;
    }
    
    const createBtn = document.querySelector('.ss-do-create-btn');
    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            const id = document.getElementById('ss-new-theme-id')?.value?.trim();
            const name = document.getElementById('ss-new-theme-name')?.value?.trim();
            const desc = document.getElementById('ss-new-theme-desc')?.value?.trim();
            const emoji = document.getElementById('ss-new-theme-emoji')?.value?.trim() || '🎨';
            const baseId = document.getElementById('ss-base-theme')?.value;
            
            if (!id || !name) {
                toastr.warning('Please enter a theme ID and name');
                return;
            }
            
            if (!/^[a-z0-9_\-]+$/.test(id)) {
                toastr.warning('Theme ID must contain only lowercase letters, numbers, hyphens, and underscores');
                return;
            }
            
            if (getThemes()[id]) {
                toastr.warning(`Theme ID "${id}" already exists`);
                return;
            }
            
            const result = await duplicateTheme(baseId, id, name, settings, saveSettingsFn);
            
            if (result.success) {
                // Update description and emoji
                customThemes[id].description = desc;
                customThemes[id].preview = emoji;
                settings.customThemes = customThemes;
                await saveSettingsFn();
                
                themeCreated = true;
                toastr.success(`Theme "${name}" created! Click the 🎨 button to edit colors.`);
                popup.complete(POPUP_RESULT.OK);
            } else {
                toastr.error(result.error);
            }
        });
    }
    
    // Wait for popup to close
    await showPromise;
    
    // Refresh the modal only if a theme was created
    if (themeCreated && refreshModalFn) {
        refreshModalFn();
    }
}

/**
 * Download theme as JSON file
 */
function downloadTheme(themeId, filename) {
    try {
        const json = exportTheme(themeId);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `ss-theme-${themeId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toastr.success(`Theme "${themeId}" exported`);
    } catch (e) {
        toastr.error(`Failed to export: ${e.message}`);
    }
}

/**
 * Download all custom themes
 */
function downloadAllCustomThemes() {
    if (Object.keys(customThemes).length === 0) {
        toastr.warning('No custom themes to export');
        return;
    }
    
    const json = exportAllCustomThemes();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ss-custom-themes-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toastr.success(`Exported ${Object.keys(customThemes).length} custom theme(s)`);
}

/**
 * Attach event listeners to theme modal
 */
/**
 * Update modal UI without rebuilding (fixes button listener issue)
 */
function updateModalUI(currentThemeId) {
    document.querySelectorAll('.ss-theme-card').forEach(card => {
        const themeId = card.dataset.theme;
        const isActive = themeId === currentThemeId;
        const isBuiltin = BUILTIN_THEMES[themeId];
        
        // Update active class
        card.classList.toggle('ss-theme-card-active', isActive);
        
        // Update actions section
        const actionsDiv = card.querySelector('.ss-theme-actions');
        if (actionsDiv) {
            actionsDiv.innerHTML = `
                ${isActive
                    ? '<span class="ss-theme-active-badge">&#10003; Active</span>'
                    : `<button class="menu_button ss-apply-theme-btn" data-theme="${escapeHtml(themeId)}">Apply</button>`
                }
                <button class="menu_button ss-export-theme-btn" data-theme="${escapeHtml(themeId)}" title="Export">&#128228;</button>
                <button class="menu_button ss-duplicate-theme-btn" data-theme="${escapeHtml(themeId)}" title="Duplicate">&#128203;</button>
                ${!isBuiltin ? `<button class="menu_button ss-delete-theme-btn" data-theme="${escapeHtml(themeId)}" title="Delete">&#128465;</button>` : ''}
                ${!isBuiltin ? `<button class="menu_button ss-edit-theme-btn" data-theme="${escapeHtml(themeId)}" title="Edit Colors">&#127912;</button>` : ''}
            `;
        }
    });
}

/**
 * Attach event listeners using event delegation (fixes listener issue)
 */
function attachThemeListeners(settings, saveSettingsFn, refreshModalFn) {
    const modal = document.querySelector('.ss-themes-modal');
    if (!modal) return;
    
    // Use event delegation - attach to modal container, not individual buttons
    modal.addEventListener('click', async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const themeId = target.dataset.theme;
        
        // Apply theme
        if (target.classList.contains('ss-apply-theme-btn') && themeId) {
            e.stopPropagation();
            applyTheme(themeId);
            settings.theme = themeId;
            await saveSettingsFn();
            updateModalUI(themeId);
            toastr.success(`Theme changed to ${getThemes()[themeId].name}`);
        }
        
        // Export single theme
        if (target.classList.contains('ss-export-theme-btn') && themeId) {
            e.stopPropagation();
            downloadTheme(themeId);
        }
        
        // Duplicate theme
        if (target.classList.contains('ss-duplicate-theme-btn') && themeId) {
            e.stopPropagation();
            const themes = getThemes();
            const source = themes[themeId];
            const newId = `${themeId}-copy-${Date.now().toString(36)}`;
            const newName = `${source.name} (Copy)`;
            
            const result = await duplicateTheme(themeId, newId, newName, settings, saveSettingsFn);
            if (result.success) {
                toastr.success(`Theme duplicated as "${newName}"`);
                if (refreshModalFn) refreshModalFn();
            } else {
                toastr.error(result.error);
            }
        }
        
        // Delete theme
        if (target.classList.contains('ss-delete-theme-btn') && themeId) {
            e.stopPropagation();
            const themes = getThemes();
            const theme = themes[themeId];
            
            const confirmPopup = new Popup(
                `<div class="ss-confirm-delete ss-modal">
                    <h3>🗑️ Delete Theme</h3>
                    <p>Are you sure you want to delete "<strong>${escapeHtml(theme.name)}</strong>"?</p>
                    <p class="ss-warning-text">This action cannot be undone.</p>
                </div>`,
                POPUP_TYPE.CONFIRM,
                null,
                { okButton: 'Delete', cancelButton: 'Cancel' }
            );

            const confirmResult = await confirmPopup.show();

            if (confirmResult === POPUP_RESULT.AFFIRMATIVE) {
                const result = await deleteTheme(themeId, settings, saveSettingsFn);
                if (result.success) {
                    toastr.success(`Theme "${escapeHtml(theme.name)}" deleted`);
                    if (refreshModalFn) await refreshModalFn();
                } else {
                    toastr.error(result.error);
                }
            }
        }
        
        // Edit theme
        if (target.classList.contains('ss-edit-theme-btn') && themeId) {
            e.stopPropagation();
            await showColorEditorModal(themeId, settings, saveSettingsFn);
        }
        
            // Import button - AWAIT the dialog
            if (target.classList.contains('ss-import-theme-btn')) {
                e.stopPropagation();
                await showImportDialog(settings, saveSettingsFn, refreshModalFn);
                return;  // Prevent further processing
            }
                
            // Export all button
            if (target.classList.contains('ss-export-all-btn')) {
                e.stopPropagation();
                downloadAllCustomThemes();
                return;
            }
                
            // Create new button - AWAIT the dialog
            if (target.classList.contains('ss-create-theme-btn')) {
                e.stopPropagation();
                await showCreateDialog(settings, saveSettingsFn, refreshModalFn);
                return;
            }
    });
}
/**
 * Open themes modal
 * @param {Object} settings - Extension settings
 * @param {Function} saveSettingsFn - Callback to save settings
 * ****
 */

export async function openThemesModal(settings, saveSettingsFn) {
    const showModal = async () => {
        const currentThemeId = settings.theme || 'default';
        const modalHtml = buildModalHTML(currentThemeId);
        
        const popup = new Popup(
            modalHtml,
            POPUP_TYPE.TEXT,
            null,
            {
                okButton: 'Close',
                cancelButton: false,
                wide: true,
                allowVerticalScrolling: true,
            }
        );
        
        // Refresh function that closes current and opens new modal
        const refreshModal = async () => {
            popup.complete(POPUP_RESULT.OK);
            
            // Wait for old modal to be fully removed from DOM
            await new Promise(resolve => {
                const checkRemoval = () => {
                    if (!document.querySelector('.ss-themes-modal')) {
                        resolve();
                    } else {
                        requestAnimationFrame(checkRemoval);
                    }
                };
                // Start checking after a brief delay
                setTimeout(checkRemoval, 0);
            });
            
            // Now safe to show new modal
            showModal();
        };
        
        const showPromise = popup.show();
        
        // Wait for DOM to be ready, then attach listeners
        await waitForElement('.ss-themes-modal');
        attachThemeListeners(settings, saveSettingsFn, refreshModal);
        
        return showPromise;
    };
    
    return showModal();
}

/**
 * Wait for an element to exist in DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Max wait time in ms
 * @returns {Promise<Element>}
 */
function waitForElement(selector, timeout = 2000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }
        
        const observer = new MutationObserver((mutations, obs) => {
            const el = document.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        setTimeout(() => {
            observer.disconnect();
            const el = document.querySelector(selector);
            if (el) {
                resolve(el);
            } else {
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            }
        }, timeout);
    });
}

// CSS extracted to ui/styles/themes.css.js
export { THEMES_CSS as THEMES_MODAL_CSS } from '../../styles/themes.css.js';
