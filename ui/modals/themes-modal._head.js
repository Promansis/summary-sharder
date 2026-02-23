/**
 * Themes Modal for Summary Sharder
 * Provides theme switching with import/export/delete functionality
 */

import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../../popup.js';
import { escapeHtml } from '../common/ui-utils.js';
import { BUILTIN_THEMES } from '../common/builtin-themes.js';


// ===== Custom Themes Storage =====
let customThemes = {};

// ===== Combined Themes Getter =====
export function getThemes() {
    return { ...BUILTIN_THEMES, ...customThemes };
}

// Backward compatibility
export const THEMES = new Proxy({}, {
    get: (target, prop) => getThemes()[prop],
    ownKeys: () => Object.keys(getThemes()),
    getOwnPropertyDescriptor: (target, prop) => ({
        enumerable: true,
        configurable: true,
        value: getThemes()[prop]
    })
});

// ===== Current Theme State =====
let currentTheme = 'default';

/**
 * Required color properties for theme validation
 */
const REQUIRED_COLORS = [
    '--ss-primary',
    '--ss-bg-primary',
    '--ss-bg-secondary',
    '--ss-text-primary',
    '--ss-border',
    '--ss-success',
    '--ss-warning',
    '--ss-error',
];

/**
 * All valid color properties
 */
const VALID_COLOR_PROPS = [
    '--ss-primary', '--ss-primary-hover', '--ss-primary-active',
    '--ss-bg-primary', '--ss-bg-secondary', '--ss-bg-tertiary', '--ss-bg-input',
    '--ss-text-primary', '--ss-text-secondary', '--ss-text-muted',
    '--ss-border', '--ss-border-focus',
    '--ss-success', '--ss-warning', '--ss-error', '--ss-info',
    '--ss-weight-critical', '--ss-weight-major', '--ss-weight-moderate',
    '--ss-weight-minor', '--ss-weight-trivial',
    '--ss-nsfw-accent', '--ss-highlight', '--ss-quote',
    '--ss-shadow', '--ss-shadow-lg',
    '--ss-transition',
    '--ss-text-hint', '--ss-rescue-bg', '--ss-rescue-bg-hover',
    '--ss-stop-hover', '--ss-overlay-bg', '--ss-focus-glow',

    // Typography (optional)
    '--ss-font-primary', '--ss-font-secondary', '--ss-font-muted', '--ss-font-hint',
    '--ss-font-size-primary', '--ss-font-size-secondary', '--ss-font-size-muted', '--ss-font-size-hint',
];

/**
 * Initialize themes system
 * @param {Object} settings - Extension settings
 */
export function initializeThemes(settings) {
    // Load custom themes from settings
    if (settings.customThemes && typeof settings.customThemes === 'object') {
        customThemes = settings.customThemes;
    }
    
    // Load current theme
    currentTheme = settings.theme || 'default';
    
    // Verify theme exists, fallback to default
    if (!getThemes()[currentTheme]) {
        console.warn(`[SummarySharder] Theme "${currentTheme}" not found, falling back to default`);
        currentTheme = 'default';
    }
    
    applyTheme(currentTheme);
    console.log(`[SummarySharder] Theme initialized: ${currentTheme}`);
}

/**
 * Apply a theme
 * @param {string} themeId - Theme identifier
 */
export function applyTheme(themeId) {
    const themes = getThemes();
    const theme = themes[themeId];

    if (!theme) {
        console.warn(`[SummarySharder] Unknown theme: ${themeId}, falling back to default`);
        themeId = 'default';
    }

    const selectedTheme = themes[themeId] || themes['default'];

    // Apply CSS custom properties to extension elements only (not :root)
    // Target the main settings panel and all modals
    const targetSelectors = [
        '#summary-sharder-settings',
        '#summary-sharder-panel',
        '.ss-modal',
        '[class*="ss-"][class*="-modal"]'
    ];

    // Apply to existing elements
    targetSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            Object.entries(selectedTheme.colors).forEach(([property, value]) => {
                el.style.setProperty(property, value);
            });
        });
    });

    // Also apply to popup wrappers that contain our modals (for popup-controls buttons)
    document.querySelectorAll('.popup').forEach(popup => {
        if (popup.querySelector('[class*="ss-"][class*="-modal"]')) {
            Object.entries(selectedTheme.colors).forEach(([property, value]) => {
                popup.style.setProperty(property, value);
            });
        }
    });

    // Also inject a dynamic style block for future elements (modals that don't exist yet)
    let dynamicStyleEl = document.getElementById('ss-theme-dynamic-vars');
    if (dynamicStyleEl) {
        // Remove existing to ensure it's at the end (after main styles)
        dynamicStyleEl.remove();
    }
    dynamicStyleEl = document.createElement('style');
    dynamicStyleEl.id = 'ss-theme-dynamic-vars';
    document.head.appendChild(dynamicStyleEl);

    // Build CSS for dynamic application to future elements
    // Use higher specificity selectors to ensure they override defaults
    const cssVars = Object.entries(selectedTheme.colors)
        .map(([prop, val]) => `${prop}: ${val};`)
        .join('\n        ');

    dynamicStyleEl.textContent = `
        /* Theme override styles - higher specificity */
        html #summary-sharder-settings,
        html #summary-sharder-panel,
        html .ss-modal,
        html [class*="ss-"][class*="-modal"],
        html .popup:has([class*="ss-"][class*="-modal"]) {
            ${cssVars}
        }
    `;

    // Remove all theme classes
    Object.keys(themes).forEach(id => {
        document.body.classList.remove(`ss-theme-${id}`);
    });

    // Add current theme class
    document.body.classList.add(`ss-theme-${themeId}`);

    // Handle extra styles
    removeExtraStyles();
    if (selectedTheme.extraStyles) {
        injectExtraStyles(themeId, selectedTheme.extraStyles);
    }

    currentTheme = themeId;

    window.dispatchEvent(new CustomEvent('ss-theme-changed', {
        detail: { theme: themeId }
    }));
}

/**
 * Get current theme ID
 */
export function getCurrentTheme() {
    return currentTheme;
}

/**
 * Inject extra theme styles
 */
function injectExtraStyles(themeId, css) {
    removeExtraStyles();
    const style = document.createElement('style');
    style.id = 'ss-theme-extra-styles';
    style.textContent = css;
    document.head.appendChild(style);
}

/**
 * Remove extra theme styles
 */
function removeExtraStyles() {
    const existing = document.getElementById('ss-theme-extra-styles');
    if (existing) existing.remove();
}

/**
 * Apply a CSS property to all extension elements for live preview
 * @param {string} prop - CSS custom property name
 * @param {string} value - Property value
 */
function applyLivePreview(prop, value) {
    const targetSelectors = [
        '#summary-sharder-settings',
        '#summary-sharder-panel',
        '.ss-modal',
        '[class*="ss-"][class*="-modal"]'
    ];

    const shouldRemove = value === null || value === undefined || value === '';

    targetSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
            if (shouldRemove) {
                el.style.removeProperty(prop);
            } else {
                el.style.setProperty(prop, value);
            }
        });
    });

    // Also apply to popup wrappers that contain our modals (for popup-controls buttons)
    document.querySelectorAll('.popup').forEach(popup => {
        if (popup.querySelector('[class*="ss-"][class*="-modal"]')) {
            if (shouldRemove) {
                popup.style.removeProperty(prop);
            } else {
                popup.style.setProperty(prop, value);
            }
        }
    });
}

// ===== VALIDATION =====

/**
 * Validate a theme object
 * @param {Object} theme - Theme to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTheme(theme) {
    const errors = [];
    
    // Check required fields
    if (!theme.id || typeof theme.id !== 'string') {
        errors.push('Theme must have a valid "id" string');
    } else if (!/^[a-z0-9_\-]+$/.test(theme.id)) {
        errors.push('Theme ID must contain only lowercase letters, numbers, hyphens, and underscores');
    } else if (BUILTIN_THEMES[theme.id]) {
        errors.push(`Theme ID "${theme.id}" conflicts with a built-in theme`);
    }
    
    if (!theme.name || typeof theme.name !== 'string') {
        errors.push('Theme must have a valid "name" string');
    }
    
    if (!theme.colors || typeof theme.colors !== 'object') {
        errors.push('Theme must have a "colors" object');
    } else {
        // Check required colors
        for (const prop of REQUIRED_COLORS) {
            if (!theme.colors[prop]) {
                errors.push(`Missing required color: ${prop}`);
            }
        }
        
        // Warn about unknown properties (non-fatal)
        for (const prop of Object.keys(theme.colors)) {
            if (!VALID_COLOR_PROPS.includes(prop)) {
                console.warn(`[SummarySharder] Unknown color property: ${prop}`);
            }
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Fill missing theme properties with defaults
 * @param {Object} theme - Theme to complete
 * @returns {Object} Complete theme
 */
function completeTheme(theme) {
    const defaultColors = BUILTIN_THEMES.default.colors;
    
    return {
        id: theme.id,
        name: theme.name || theme.id,
        description: theme.description || 'Custom theme',
        preview: theme.preview || '🎨',
        builtin: false,
        colors: { ...defaultColors, ...theme.colors },
        extraStyles: theme.extraStyles || ''
    };
}

// ===== IMPORT/EXPORT/DELETE =====

/**
 * Export a theme as JSON
 * @param {string} themeId - Theme to export
 * @returns {string} JSON string
 */
export function exportTheme(themeId) {
    const themes = getThemes();
    const theme = themes[themeId];
    
    if (!theme) {
        throw new Error(`Theme "${themeId}" not found`);
    }
    
    // Create export object (exclude builtin flag)
    const exportData = {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        preview: theme.preview,
        colors: { ...theme.colors },
        extraStyles: theme.extraStyles || ''
    };
    
    return JSON.stringify(exportData, null, 2);
}

/**
 * Export all custom themes
 * @returns {string} JSON string
 */
export function exportAllCustomThemes() {
    const exportData = {
        version: 1,
        exportDate: new Date().toISOString(),
        themes: Object.values(customThemes).map(theme => ({
            id: theme.id,
            name: theme.name,
            description: theme.description,
            preview: theme.preview,
            colors: { ...theme.colors },
            extraStyles: theme.extraStyles || ''
        }))
    };
    
    return JSON.stringify(exportData, null, 2);
}

/**
 * Import a theme from JSON
 * @param {string} jsonString - JSON theme data
 * @param {Object} settings - Extension settings
 * @param {Function} saveSettingsFn - Save callback
 * @returns {{ success: boolean, themeId?: string, error?: string }}
 */
export async function importTheme(jsonString, settings, saveSettingsFn) {
    try {
        const data = JSON.parse(jsonString);
        // Check if it's a plain array of themes (e.g., [{...}, {...}])
        if (Array.isArray(data)) {
            return importMultipleThemes(data, settings, saveSettingsFn);
        }
        // Check if it's a multi-theme export
        if (data.themes && Array.isArray(data.themes)) {
            return importMultipleThemes(data.themes, settings, saveSettingsFn);
        }
        
        // Single theme import
        const validation = validateTheme(data);
        if (!validation.valid) {
            return { 
                success: false, 
                error: `Invalid theme:\n${validation.errors.join('\n')}` 
            };
        }
        
        // Complete and add theme
        const completeThemeData = completeTheme(data);
        customThemes[completeThemeData.id] = completeThemeData;
        
        // Save to settings
        settings.customThemes = customThemes;
        if (saveSettingsFn) {
            await saveSettingsFn();
        }
        
        return { success: true, themeId: completeThemeData.id };
        
    } catch (e) {
        return { success: false, error: `Failed to parse JSON: ${e.message}` };
    }
}

/**
 * Import multiple themes
 */
async function importMultipleThemes(themes, settings, saveSettingsFn) {
    const results = { imported: [], failed: [] };
    
    for (const theme of themes) {
        const validation = validateTheme(theme);
        if (validation.valid) {
            const complete = completeTheme(theme);
            customThemes[complete.id] = complete;
            results.imported.push(complete.name);
        } else {
            results.failed.push({ name: theme.name || theme.id, errors: validation.errors });
        }
    }
    
    // Save
    settings.customThemes = customThemes;
    if (saveSettingsFn) {
        await saveSettingsFn();
    }
    
    if (results.failed.length === 0) {
        return { 
            success: true, 
            message: `Imported ${results.imported.length} theme(s): ${results.imported.join(', ')}` 
        };
    } else {
        return {
            success: results.imported.length > 0,
            message: `Imported: ${results.imported.length}, Failed: ${results.failed.length}`,
            details: results
        };
    }
}

/**
 * Delete a custom theme
 * @param {string} themeId - Theme to delete
 * @param {Object} settings - Extension settings
 * @param {Function} saveSettingsFn - Save callback
 * @returns {{ success: boolean, error?: string }}
 */
export async function deleteTheme(themeId, settings, saveSettingsFn) {
    // Prevent deleting built-in themes
    if (BUILTIN_THEMES[themeId]) {
        return { success: false, error: 'Cannot delete built-in themes' };
    }
    
    // Check if theme exists
    if (!customThemes[themeId]) {
        return { success: false, error: `Theme "${themeId}" not found` };
    }
    
    // If currently active, switch to default
    if (currentTheme === themeId) {
        applyTheme('default');
        settings.theme = 'default';
    }
    
    // Delete
    delete customThemes[themeId];
    settings.customThemes = customThemes;
    
    if (saveSettingsFn) {
        await saveSettingsFn();
    }
    
    return { success: true };
}

/**
 * Duplicate a theme for editing
 * @param {string} themeId - Source theme
 * @param {string} newId - New theme ID
 * @param {string} newName - New theme name
 * @param {Object} settings - Extension settings
 * @param {Function} saveSettingsFn - Save callback
 */
export async function duplicateTheme(themeId, newId, newName, settings, saveSettingsFn) {
    const themes = getThemes();
    const source = themes[themeId];
    
    if (!source) {
        return { success: false, error: `Source theme "${themeId}" not found` };
    }
    
    if (themes[newId]) {
        return { success: false, error: `Theme ID "${newId}" already exists` };
    }
    
    const newTheme = {
        id: newId,
        name: newName,
        description: `Based on ${source.name}`,
        preview: source.preview,
        builtin: false,
        colors: { ...source.colors },
        extraStyles: source.extraStyles || ''
    };
    
    customThemes[newId] = newTheme;
    settings.customThemes = customThemes;
    
    if (saveSettingsFn) {
        await saveSettingsFn();
    }
    
    return { success: true, themeId: newId };
}

// ===== MODAL UI =====

/**
 * Build theme card HTML
 */
function buildThemeCard(themeId, theme, isActive) {
    const activeClass = isActive ? 'ss-theme-card-active' : '';
    const isBuiltin = theme.builtin || BUILTIN_THEMES[themeId];

    return `
        <div class="ss-theme-card ${activeClass}" data-theme="${escapeHtml(themeId)}">
            <div class="ss-theme-preview" style="
                background: ${theme.colors['--ss-bg-primary']};
                border: 2px solid ${theme.colors['--ss-primary']};
            ">
                <div class="ss-theme-preview-header" style="
                    background: ${theme.colors['--ss-bg-secondary']};
                    color: ${theme.colors['--ss-text-primary']};
                    border-bottom: 1px solid ${theme.colors['--ss-border']};
                ">
                    <span style="color: ${theme.colors['--ss-primary']}">●</span>
                    ${escapeHtml(theme.preview)} ${escapeHtml(theme.name)}
                    ${isBuiltin ? '<span class="ss-builtin-badge">Built-in</span>' : '<span class="ss-custom-badge">Custom</span>'}
                </div>
                <div class="ss-theme-preview-body">
                    <div class="ss-preview-button" style="
                        background: ${theme.colors['--ss-primary']};
                        color: ${theme.colors['--ss-bg-primary']};
                    ">
                        Button
                    </div>
                </div>
            </div>
            <div class="ss-theme-info">
                <h4>${escapeHtml(theme.name)}</h4>
                <p>${escapeHtml(theme.description || '')}</p>
            </div>
            <div class="ss-theme-actions">
                ${isActive
                    ? '<span class="ss-theme-active-badge">✓ Active</span>'
                    : `<button class="menu_button ss-apply-theme-btn" data-theme="${escapeHtml(themeId)}">Apply</button>`
                }
                <button class="menu_button ss-export-theme-btn" data-theme="${escapeHtml(themeId)}" title="Export">📤</button>
                <button class="menu_button ss-duplicate-theme-btn" data-theme="${escapeHtml(themeId)}" title="Duplicate">📋</button>
                ${!isBuiltin ? `<button class="menu_button ss-delete-theme-btn" data-theme="${escapeHtml(themeId)}" title="Delete">🗑️</button>` : ''}
                ${!isBuiltin ? `<button class="menu_button ss-edit-theme-btn" data-theme="${escapeHtml(themeId)}" title="Edit Colors">🎨</button>` : ''}
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
                    ? '<span class="ss-theme-active-badge">✓ Active</span>'
                    : `<button class="menu_button ss-apply-theme-btn" data-theme="${escapeHtml(themeId)}">Apply</button>`
                }
                <button class="menu_button ss-export-theme-btn" data-theme="${escapeHtml(themeId)}" title="Export">📤</button>
                <button class="menu_button ss-duplicate-theme-btn" data-theme="${escapeHtml(themeId)}" title="Duplicate">📋</button>
                ${!isBuiltin ? `<button class="menu_button ss-delete-theme-btn" data-theme="${escapeHtml(themeId)}" title="Delete">🗑️</button>` : ''}
                ${!isBuiltin ? `<button class="menu_button ss-edit-theme-btn" data-theme="${escapeHtml(themeId)}" title="Edit Colors">🎨</button>` : ''}
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
 * Color editor modal for custom themes
 */
async function showColorEditorModal(themeId, settings, saveSettingsFn) {
    const themes = getThemes();
    const theme = themes[themeId];
    
    if (!theme || BUILTIN_THEMES[themeId]) {
        toastr.error('Cannot edit built-in themes. Duplicate it first!');
        return;
    }
    
    // Group colors by category for better UX
    const colorGroups = {
        'Primary Colors': ['--ss-primary', '--ss-primary-hover', '--ss-primary-active'],
        'Backgrounds': ['--ss-bg-primary', '--ss-bg-secondary', '--ss-bg-tertiary', '--ss-bg-input'],
        'Text': ['--ss-text-primary', '--ss-text-secondary', '--ss-text-muted', '--ss-text-hint'],
        'Borders': ['--ss-border', '--ss-border-focus'],
        'Status': ['--ss-success', '--ss-warning', '--ss-error', '--ss-info'],
        'Accents': ['--ss-nsfw-accent', '--ss-highlight', '--ss-quote'],
        'Buttons': ['--ss-rescue-bg', '--ss-rescue-bg-hover', '--ss-stop-hover'],
        'Effects': ['--ss-shadow', '--ss-shadow-lg', '--ss-overlay-bg', '--ss-focus-glow', '--ss-transition'],
    };
    
    // Helper to make property names readable
    const formatPropName = (prop) => {
        return prop.replace('--ss-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };
    
    // Helper to check if value is a color (not a CSS variable or complex value)
    const isSimpleColor = (value) => {
        return /^#[0-9a-fA-F]{3,8}$/.test(value) || /^rgba?\(/.test(value);
    };
    
    // Helper to check if bg-primary uses SillyTavern default
    const isBgPrimaryST = (value) => {
        return value === 'var(--SmartThemeBlurTintColor)';
    };

    const FONT_OPTIONS = [
        // Web-safe / common
        'Arial',
        'Arial Black',
        'Calibri',
        'Cambria',
        'Candara',
        'Comic Sans MS',
        'Consolas',
        'Courier New',
        'Georgia',
        'Impact',
        'Lucida Console',
        'Lucida Sans Unicode',
        'Palatino Linotype',
        'Segoe UI',
        'Tahoma',
        'Times New Roman',
        'Trebuchet MS',
        'Verdana',

        // Common “theme-y” fonts (may or may not be installed)
        'Cinzel',
        'Garamond',
        'Merriweather',
        'Roboto',
        'Open Sans',
        'Lato',
        'Montserrat',
        'Source Sans Pro',
        'Inter',
    ];

    const fontDatalistHtml = `
        <datalist id="ss-font-options">
            ${FONT_OPTIONS.map(f => `<option value="${escapeHtml(f)}"></option>`).join('')}
        </datalist>
    `;

    const TEXT_GROUPS = [
        {
            key: 'primary',
            title: 'Primary Text',
            colorProp: '--ss-text-primary',
            fontProp: '--ss-font-primary',
            sizeProp: '--ss-font-size-primary',
            desc: 'Used for most text, labels, and input text.'
        },
        {
            key: 'secondary',
            title: 'Secondary Text',
            colorProp: '--ss-text-secondary',
            fontProp: '--ss-font-secondary',
            sizeProp: '--ss-font-size-secondary',
            desc: 'Used for secondary labels and supporting UI text.'
        },
        {
            key: 'muted',
            title: 'Muted Text',
            colorProp: '--ss-text-muted',
            fontProp: '--ss-font-muted',
            sizeProp: '--ss-font-size-muted',
            desc: 'Used for descriptions and less prominent text.'
        },
        {
            key: 'hint',
            title: 'Hint Text',
            colorProp: '--ss-text-hint',
            fontProp: '--ss-font-hint',
            sizeProp: '--ss-font-size-hint',
            desc: 'Used for fine-print hints and helper notes.'
        },
    ];

    const parsePx = (val) => {
        if (!val) return '';
        const m = String(val).trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
        return m ? m[1] : '';
    };

    const buildTextGroupEditor = () => {
        return TEXT_GROUPS.map(g => {
            const colorVal = theme.colors[g.colorProp] || '';
            const isColor = isSimpleColor(colorVal);
            const fontVal = theme.colors[g.fontProp] || '';
            const sizeVal = parsePx(theme.colors[g.sizeProp]);

            return `
                <div class="ss-text-style-block" data-text-group="${g.key}">
                    <div class="ss-text-style-header">
                        <div class="ss-text-style-title" title="${escapeHtml(g.colorProp)}">${escapeHtml(g.title)}</div>
                        <div class="ss-text-style-desc">${escapeHtml(g.desc)}</div>
                    </div>

                    <div class="ss-text-style-controls">
                        <div class="ss-text-style-control">
                            <label title="${escapeHtml(g.colorProp)}">Color</label>
                            <div class="ss-color-inputs">
                                ${isColor ? `<input type="color" class="ss-color-picker" data-prop="${g.colorProp}" value="${colorVal.startsWith('#') ? colorVal : '#888888'}">` : ''}
                                <input type="text" class="ss-color-text" data-prop="${g.colorProp}" value="${escapeHtml(colorVal)}" placeholder="${escapeHtml(g.colorProp)}">
                            </div>
                        </div>

                        <div class="ss-text-style-control">
                            <label title="${escapeHtml(g.fontProp)}">Font</label>
                            <input type="text" class="ss-typo-font" data-prop="${g.fontProp}" list="ss-font-options" value="${escapeHtml(fontVal)}" placeholder="inherit / custom">
                        </div>

                        <div class="ss-text-style-control">
                            <label title="${escapeHtml(g.sizeProp)}">Size (px)</label>
                            <input type="number" class="ss-typo-size" data-prop="${g.sizeProp}" value="${escapeHtml(sizeVal)}" min="6" max="64" step="1" placeholder="inherit">
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Build color inputs HTML
    let groupsHtml = '';
    for (const [groupName, props] of Object.entries(colorGroups)) {
        let inputsHtml = '';

        if (groupName === 'Text') {
            inputsHtml = `
                <div class="ss-text-style-group">
                    <div class="ss-text-style-note">
                        Each text group controls both color and typography. Clear a font/size field to inherit the default.
                    </div>
                    ${buildTextGroupEditor()}
                </div>
            `;
        } else {
            for (const prop of props) {
                const value = theme.colors[prop] || '';
                const isColor = isSimpleColor(value);

                // Special handling for --ss-bg-primary
                if (prop === '--ss-bg-primary') {
                    const isSTDefault = isBgPrimaryST(value);
                    inputsHtml += `
                        <div class="ss-color-row ss-bg-primary-row">
                            <label title="${prop}">${formatPropName(prop)}</label>
                            <div class="ss-bg-primary-controls">
                                <select class="ss-bg-primary-select" data-prop="${prop}">
                                    <option value="st-default" ${isSTDefault ? 'selected' : ''}>SillyTavern Default</option>
                                    <option value="custom" ${!isSTDefault ? 'selected' : ''}>Custom</option>
                                </select>
                                <div class="ss-bg-primary-custom" style="display: ${isSTDefault ? 'none' : 'flex'}; align-items: center; gap: 6px; margin-top: 6px;">
                                    ${!isSTDefault && isColor ? `<input type="color" class="ss-color-picker" data-prop="${prop}" value="${value.startsWith('#') ? value : '#888888'}">` : ''}
                                    <input type="text" class="ss-color-text" data-prop="${prop}" value="${isSTDefault ? '' : value}" placeholder="e.g. rgba(0,0,0,0.3)">
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    inputsHtml += `
                        <div class="ss-color-row">
                            <label title="${prop}">${formatPropName(prop)}</label>
                            <div class="ss-color-inputs">
                                ${isColor ? `<input type="color" class="ss-color-picker" data-prop="${prop}" value="${value.startsWith('#') ? value : '#888888'}">` : ''}
                                <input type="text" class="ss-color-text" data-prop="${prop}" value="${value}" placeholder="${prop}">
                            </div>
                        </div>
                    `;
                }
            }
        }

        groupsHtml += `
            <div class="ss-color-group">
                <h4>${groupName}</h4>
                ${inputsHtml}
            </div>
        `;
    }
    
    const editorHtml = `
        <div class="ss-color-editor-modal ss-modal">
            <div class="ss-editor-header">
                <h3>🎨 Edit Theme: ${escapeHtml(theme.name)}</h3>
                <p>Modify colors below. Changes are previewed live.</p>
            </div>

            ${fontDatalistHtml}

            <div class="ss-editor-meta">
                <div class="ss-meta-row">
                    <label>Theme Name:</label>
                    <input type="text" id="ss-edit-theme-name" value="${escapeHtml(theme.name)}">
                </div>
                <div class="ss-meta-row">
                    <label>Description:</label>
                    <input type="text" id="ss-edit-theme-desc" value="${escapeHtml(theme.description || '')}">
                </div>
                <div class="ss-meta-row">
                    <label>Preview Emoji:</label>
                    <input type="text" id="ss-edit-theme-emoji" value="${escapeHtml(theme.preview || '🎨')}" maxlength="2">
                </div>
            </div>

            <div class="ss-color-groups">
                ${groupsHtml}
            </div>

            <div class="ss-editor-extra">
                <h4>Extra CSS (Advanced)</h4>
                <textarea id="ss-edit-extra-css" rows="4" placeholder="/* Custom CSS rules */">${escapeHtml(theme.extraStyles || '')}</textarea>
            </div>

            <div class="ss-editor-actions">
                <button class="menu_button ss-reset-colors-btn">Reset to Saved</button>
                <button class="menu_button ss-save-theme-btn">💾 Save Changes</button>
            </div>
        </div>
    `;
    
    const popup = new Popup(editorHtml, POPUP_TYPE.TEXT, null, {
        okButton: 'Close',
        cancelButton: false,
        wide: true,
        allowVerticalScrolling: true,
    });
    
    // Store original values for reset
    const originalColors = { ...theme.colors };
    const originalMeta = { name: theme.name, description: theme.description, preview: theme.preview, extraStyles: theme.extraStyles };
    
    const showPromise = popup.show();

    // Wait for DOM to be ready
    await waitForElement('.ss-color-editor-modal');
    
    const modal = document.querySelector('.ss-color-editor-modal');
    if (!modal) return;
        
        // Live preview: sync color picker with text input
        modal.querySelectorAll('.ss-color-picker').forEach(picker => {
            picker.addEventListener('input', (e) => {
                const prop = e.target.dataset.prop;
                const textInput = modal.querySelector(`.ss-color-text[data-prop="${prop}"]`);
                if (textInput) textInput.value = e.target.value;

                // Apply live to extension elements only
                applyLivePreview(prop, e.target.value);
            });
        });
        
        // bg-primary dropdown handler
        modal.querySelector('.ss-bg-primary-select')?.addEventListener('change', (e) => {
            const customDiv = modal.querySelector('.ss-bg-primary-custom');
            const textInput = modal.querySelector('.ss-color-text[data-prop="--ss-bg-primary"]');
            if (e.target.value === 'st-default') {
                if (customDiv) customDiv.style.display = 'none';
                if (textInput) textInput.value = 'var(--SmartThemeBlurTintColor)';
                applyLivePreview('--ss-bg-primary', 'var(--SmartThemeBlurTintColor)');
            } else {
                if (customDiv) customDiv.style.display = 'flex';
                if (textInput) textInput.value = '';
                textInput?.focus();
            }
        });

        // Live preview: text input changes
        modal.querySelectorAll('.ss-color-text').forEach(input => {
            input.addEventListener('input', (e) => {
                const prop = e.target.dataset.prop;
                const picker = modal.querySelector(`.ss-color-picker[data-prop="${prop}"]`);
                if (picker && /^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                    picker.value = e.target.value;
                }

                // Apply live to extension elements only
                applyLivePreview(prop, e.target.value);
            });
        });

        // Live preview: typography (font family)
        modal.querySelectorAll('.ss-typo-font').forEach(input => {
            input.addEventListener('input', (e) => {
                const prop = e.target.dataset.prop;
                const value = e.target.value.trim();
                applyLivePreview(prop, value);
            });
        });

        // Live preview: typography (font size, px)
        modal.querySelectorAll('.ss-typo-size').forEach(input => {
            input.addEventListener('input', (e) => {
                const prop = e.target.dataset.prop;
                const raw = String(e.target.value || '').trim();
                const value = raw ? `${raw}px` : '';
                applyLivePreview(prop, value);
            });
        });
        
        // Reset button
        modal.querySelector('.ss-reset-colors-btn')?.addEventListener('click', () => {
            // Reset form values (colors)
            for (const [prop, value] of Object.entries(originalColors)) {
                const textInput = modal.querySelector(`.ss-color-text[data-prop="${prop}"]`);
                const picker = modal.querySelector(`.ss-color-picker[data-prop="${prop}"]`);
                if (textInput) textInput.value = value;
                if (picker && /^#[0-9a-fA-F]{6}$/.test(value)) picker.value = value;

                // Reapply to extension elements only
                applyLivePreview(prop, value);
            }

            // Reset typography
            const typoProps = [
                '--ss-font-primary', '--ss-font-secondary', '--ss-font-muted', '--ss-font-hint',
                '--ss-font-size-primary', '--ss-font-size-secondary', '--ss-font-size-muted', '--ss-font-size-hint',
            ];

            // Clear all first (to ensure removed values truly revert)
            typoProps.forEach(prop => applyLivePreview(prop, ''));

            // Restore any saved values
            typoProps.forEach(prop => {
                const saved = originalColors[prop];
                if (saved) {
                    applyLivePreview(prop, saved);
                }
            });

            // Restore UI fields
            modal.querySelectorAll('.ss-typo-font').forEach(input => {
                const prop = input.dataset.prop;
                input.value = originalColors[prop] || '';
            });

            modal.querySelectorAll('.ss-typo-size').forEach(input => {
                const prop = input.dataset.prop;
                input.value = parsePx(originalColors[prop]);
            });
            
            // Reset meta
            document.getElementById('ss-edit-theme-name').value = originalMeta.name;
            document.getElementById('ss-edit-theme-desc').value = originalMeta.description || '';
            document.getElementById('ss-edit-theme-emoji').value = originalMeta.preview || '🎨';
            document.getElementById('ss-edit-extra-css').value = originalMeta.extraStyles || '';
            
            toastr.info('Reset to saved values');
        });
        
        // Save button
        modal.querySelector('.ss-save-theme-btn')?.addEventListener('click', async () => {
            // Collect all color values
            const newColors = {};
            modal.querySelectorAll('.ss-color-text').forEach(input => {
                const prop = input.dataset.prop;
                const value = input.value.trim();
                if (prop && value) {
                    newColors[prop] = value;
                }
            });

            // Collect typography (font family)
            modal.querySelectorAll('.ss-typo-font').forEach(input => {
                const prop = input.dataset.prop;
                const value = input.value.trim();
                if (prop && value) {
                    newColors[prop] = value;
                }
            });

            // Collect typography (font size)
            modal.querySelectorAll('.ss-typo-size').forEach(input => {
                const prop = input.dataset.prop;
                const raw = String(input.value || '').trim();
                if (prop && raw) {
                    newColors[prop] = `${raw}px`;
                }
            });

            // Handle bg-primary dropdown
            const bgPrimarySelect = modal.querySelector('.ss-bg-primary-select');
            if (bgPrimarySelect && bgPrimarySelect.value === 'st-default') {
                newColors['--ss-bg-primary'] = 'var(--SmartThemeBlurTintColor)';
            }
            
            // Keep any colors not shown in editor (but allow typography fields to be cleared)
            const typographyProps = new Set([
                '--ss-font-primary', '--ss-font-secondary', '--ss-font-muted', '--ss-font-hint',
                '--ss-font-size-primary', '--ss-font-size-secondary', '--ss-font-size-muted', '--ss-font-size-hint',
            ]);

            for (const [prop, value] of Object.entries(theme.colors)) {
                if (!newColors[prop] && !typographyProps.has(prop)) {
                    newColors[prop] = value;
                }
            }
            
            // Update theme
            customThemes[themeId] = {
                ...theme,
                name: document.getElementById('ss-edit-theme-name')?.value?.trim() || theme.name,
                description: document.getElementById('ss-edit-theme-desc')?.value?.trim() || '',
                preview: document.getElementById('ss-edit-theme-emoji')?.value?.trim() || '🎨',
                colors: newColors,
                extraStyles: document.getElementById('ss-edit-extra-css')?.value || '',
            };
            
            // Save to settings
            settings.customThemes = customThemes;
            await saveSettingsFn();
            
            // Reapply if this is the active theme
            if (currentTheme === themeId) {
                applyTheme(themeId);
            }
            
            toastr.success(`Theme "${customThemes[themeId].name}" saved!`);
            popup.complete(POPUP_RESULT.OK);
        });
    
    
    return showPromise;
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

// ===== Additional CSS for Theme Modal =====
export const THEMES_MODAL_CSS = `
/* Theme Modal Styles */
.ss-themes-modal {
    padding: 20px;
    min-width: 600px;
    max-width: 900px;
}

.ss-themes-header {
    text-align: center;
    margin-bottom: 20px;
}

.ss-themes-header h3 {
    margin: 0 0 8px 0;
    font-size: 1.4em;
}

.ss-themes-header p {
    margin: 0;
    color: var(--ss-text-muted);
}

/* Controls bar */
.ss-themes-controls {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-bottom: 20px;
    padding: 15px;
    background: var(--ss-bg-secondary);
    border-radius: 8px;
    flex-wrap: wrap;
}

.ss-themes-controls .menu_button {
    display: flex;
    align-items: center;
    gap: 6px;
}

.ss-themes-controls .menu_button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Sections */
.ss-themes-section {
    margin-bottom: 25px;
}

.ss-themes-section h4 {
    margin: 0 0 15px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--ss-border);
    color: var(--ss-text-primary);
}

/* Grid */
.ss-themes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 15px;
}

/* Theme cards */
.ss-theme-card {
    background: var(--ss-bg-secondary);
    border: 2px solid var(--ss-border);
    border-radius: 10px;
    padding: 12px;
    transition: all var(--ss-transition);
}

.ss-theme-card:hover {
    border-color: var(--ss-primary);
    transform: translateY(-2px);
    box-shadow: var(--ss-shadow);
}

.ss-theme-card-active {
    border-color: var(--ss-primary);
    background: var(--ss-highlight);
}

/* Preview section */
.ss-theme-preview {
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 10px;
}

.ss-theme-preview-header {
    padding: 6px 10px;
    font-size: 0.8em;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}

.ss-theme-preview-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
}

.ss-preview-button {
    padding: 5px 14px;
    border-radius: 4px;
    font-size: 0.75em;
    font-weight: 600;
}

/* Badges */
.ss-builtin-badge,
.ss-custom-badge {
    font-size: 0.7em;
    padding: 2px 6px;
    border-radius: 3px;
    margin-left: auto;
}

.ss-builtin-badge {
    background: var(--ss-info);
    color: white;
}

.ss-custom-badge {
    background: var(--ss-success);
    color: white;
}

/* Theme info */
.ss-theme-info {
    margin-bottom: 10px;
}

.ss-theme-info h4 {
    margin: 0 0 4px 0;
    font-size: 1em;
    border: none;
    padding: 0;
}

.ss-theme-info p {
    margin: 0;
    font-size: 0.8em;
    color: var(--ss-text-muted);
}

/* Actions row */
.ss-theme-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
}

.ss-theme-actions .menu_button {
    padding: 5px 10px;
    font-size: 0.85em;
}

.ss-theme-active-badge {
    background: var(--ss-success);
    color: white;
    padding: 5px 12px;
    border-radius: 4px;
    font-size: 0.8em;
    font-weight: 600;
}

/* No custom themes message */
.ss-no-custom-themes {
    text-align: center;
    padding: 30px;
    color: var(--ss-text-muted);
    font-style: italic;
    grid-column: 1 / -1;
}

/* Footer */
.ss-themes-footer {
    border-top: 1px solid var(--ss-border);
    padding-top: 15px;
    margin-top: 10px;
}

.ss-themes-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 0.85em;
    color: var(--ss-text-muted);
}

/* Import Modal */
.ss-import-modal {
    padding: 20px;
    min-width: 500px;
}

.ss-import-modal h3 {
    margin: 0 0 10px 0;
}

.ss-import-file-section {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
    padding: 10px;
    background: var(--ss-bg-secondary);
    border-radius: 6px;
}

.ss-file-name {
    font-size: 0.9em;
    color: var(--ss-text-muted);
}

.ss-import-text-section {
    margin-bottom: 15px;
}

.ss-import-text-section label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
}

.ss-import-text-section textarea {
    width: 100%;
    font-family: monospace;
    font-size: 12px;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    padding: 10px;
    color: var(--ss-text-primary);
    resize: vertical;
}

.ss-import-actions {
    display: flex;
    justify-content: flex-end;
}

/* Create Theme Modal */
.ss-create-theme-modal {
    padding: 20px;
    min-width: 400px;
}

.ss-create-theme-modal h3 {
    margin: 0 0 10px 0;
}

.ss-create-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 15px;
}

.ss-form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.ss-form-group label {
    font-size: 0.9em;
    font-weight: 500;
}

.ss-form-group input,
.ss-form-group select {
    padding: 8px 10px;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
}

.ss-form-group input:focus,
.ss-form-group select:focus {
    border-color: var(--ss-border-focus);
    outline: none;
}

.ss-create-actions {
    display: flex;
    justify-content: flex-end;
}

/* Confirm delete modal */
.ss-confirm-delete {
    padding: 20px;
    text-align: center;
}

.ss-confirm-delete h3 {
    margin: 0 0 15px 0;
}

.ss-confirm-delete .ss-warning-text {
    color: var(--ss-error);
    font-size: 0.9em;
}

/* Mobile adjustments */
@media (max-width: 768px) {
    .ss-themes-modal {
        min-width: auto;
        padding: 15px;
    }
    
    .ss-themes-grid {
        grid-template-columns: 1fr;
    }
    
    .ss-themes-controls {
        flex-direction: column;
    }
    
    .ss-theme-actions {
        justify-content: center;
    }
    
    .ss-import-modal,
    .ss-create-theme-modal {
        min-width: auto;
    }
}
/* bg-primary dropdown controls */
.ss-bg-primary-controls {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.ss-bg-primary-controls select {
    padding: 5px 8px;
    font-size: 0.85em;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
}

.ss-bg-primary-custom {
    display: flex;
    align-items: center;
    gap: 6px;
}

    /* Color Editor Modal */
.ss-color-editor-modal {
    padding: 20px;
    min-width: 550px;
    max-height: 80vh;
    overflow-y: auto;
}

.ss-editor-header {
    margin-bottom: 15px;
}

.ss-editor-header h3 {
    margin: 0 0 5px 0;
}

.ss-editor-header p {
    margin: 0;
    font-size: 0.9em;
    color: var(--ss-text-muted);
}

.ss-editor-meta {
    background: var(--ss-bg-secondary);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 15px;
}

.ss-meta-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.ss-meta-row:last-child {
    margin-bottom: 0;
}

.ss-meta-row label {
    width: 120px;
    font-weight: 500;
    flex-shrink: 0;
}

.ss-meta-row input {
    flex: 1;
    padding: 6px 10px;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
}

.ss-color-groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
    margin-bottom: 15px;
}

.ss-color-group {
    background: var(--ss-bg-secondary);
    border-radius: 6px;
    padding: 12px;
}

.ss-color-group h4 {
    margin: 0 0 10px 0;
    font-size: 0.95em;
    color: var(--ss-text-primary);
    border-bottom: 1px solid var(--ss-border);
    padding-bottom: 6px;
}

.ss-color-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    gap: 8px;
}

.ss-color-row:last-child {
    margin-bottom: 0;
}

.ss-color-row label {
    font-size: 0.85em;
    color: var(--ss-text-secondary);
    flex: 1;
    min-width: 80px;
}

.ss-color-inputs {
    display: flex;
    align-items: center;
    gap: 6px;
}

.ss-text-style-note {
    font-size: 0.85em;
    color: var(--ss-text-muted);
    margin-bottom: 10px;
}

.ss-text-style-block {
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    padding: 10px;
    background: var(--ss-bg-tertiary);
    margin-bottom: 10px;
}

.ss-text-style-block:last-child {
    margin-bottom: 0;
}

.ss-text-style-header {
    margin-bottom: 8px;
}

.ss-text-style-title {
    font-weight: 600;
    color: var(--ss-text-primary);
}

.ss-text-style-desc {
    font-size: 0.85em;
    color: var(--ss-text-muted);
}

.ss-text-style-controls {
    display: grid;
    grid-template-columns: 1.2fr 1fr 0.6fr;
    gap: 8px;
    align-items: end;
}

.ss-text-style-control label {
    display: block;
    font-size: 0.8em;
    color: var(--ss-text-secondary);
    margin-bottom: 4px;
}

.ss-typo-font,
.ss-typo-size {
    width: 100%;
    padding: 5px 8px;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
}

.ss-typo-font:focus,
.ss-typo-size:focus {
    border-color: var(--ss-border-focus);
    outline: none;
}

.ss-color-picker {
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    cursor: pointer;
    background: transparent;
}

.ss-color-picker::-webkit-color-swatch-wrapper {
    padding: 2px;
}

.ss-color-picker::-webkit-color-swatch {
    border-radius: 2px;
    border: none;
}

.ss-color-text {
    width: 140px;
    padding: 5px 8px;
    font-family: monospace;
    font-size: 0.85em;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
}

.ss-color-text:focus {
    border-color: var(--ss-border-focus);
    outline: none;
}

.ss-editor-extra {
    background: var(--ss-bg-secondary);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 15px;
}

.ss-editor-extra h4 {
    margin: 0 0 8px 0;
    font-size: 0.95em;
}

.ss-editor-extra textarea {
    width: 100%;
    font-family: monospace;
    font-size: 0.85em;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    padding: 8px;
    color: var(--ss-text-primary);
    resize: vertical;
}

.ss-editor-actions {
    display: flex;
    justify-content: space-between;
    gap: 10px;
}

.ss-editor-actions .ss-save-theme-btn {
    background: var(--ss-primary);
    color: white;
    border-color: var(--ss-primary);
}

.ss-editor-actions .ss-save-theme-btn:hover {
    background: var(--ss-primary-hover);
}

/* Mobile adjustments */
@media (max-width: 768px) {
    .ss-color-editor-modal {
        min-width: auto;
        padding: 15px;
    }
    
    .ss-color-groups {
        grid-template-columns: 1fr;
    }
    
    .ss-color-row {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .ss-color-inputs {
        width: 100%;
    }
    
    .ss-color-text {
        flex: 1;
    }
    
    .ss-meta-row {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .ss-meta-row label {
        width: auto;
    }
    
    .ss-meta-row input {
        width: 100%;
    }
}
`;