/**
 * Color editor modal for custom themes
 */

import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../../../popup.js';
import { escapeHtml } from '../../common/ui-utils.js';
import { BUILTIN_THEMES } from '../../common/builtin-themes.js';
import {
    getThemes,
    updateCustomTheme
} from './theme-core.js';

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

/**
 * Color editor modal for custom themes
 */
export async function showColorEditorModal(themeId, settings, saveSettingsFn) {
    const themes = getThemes();
    const theme = themes[themeId];

    if (!theme || BUILTIN_THEMES[themeId]) {
        toastr.error('Cannot edit built-in themes. Duplicate it first!');
        return;
    }

    // Group colors by category for better UX
    const colorGroups = {
        'Primary Colors': ['--ss-primary', '--ss-primary-hover', '--ss-primary-active'],
        Backgrounds: ['--ss-bg-primary', '--ss-bg-secondary', '--ss-bg-tertiary', '--ss-bg-input'],
        Text: ['--ss-text-primary', '--ss-text-secondary', '--ss-text-muted', '--ss-text-hint'],
        Borders: ['--ss-border', '--ss-border-focus'],
        Status: ['--ss-success', '--ss-warning', '--ss-error', '--ss-info'],
        Accents: ['--ss-nsfw-accent', '--ss-highlight', '--ss-quote'],
        Buttons: ['--ss-rescue-bg', '--ss-rescue-bg-hover', '--ss-stop-hover'],
        Effects: ['--ss-shadow', '--ss-shadow-lg', '--ss-overlay-bg', '--ss-focus-glow', '--ss-transition'],
    };

    const PROP_LABELS = {
        // Primary Colors
        '--ss-primary': 'Accent Color',
        '--ss-primary-hover': 'Accent Hover',
        '--ss-primary-active': 'Accent Pressed',
        // Backgrounds
        '--ss-bg-primary': 'Modal & Panel Background',
        '--ss-bg-secondary': 'Section & Card Background',
        '--ss-bg-tertiary': 'Inner Content Background',
        '--ss-bg-input': 'Input Field Background',
        // Borders
        '--ss-border': 'Border Color',
        '--ss-border-focus': 'Focused Border Color',
        // Status
        '--ss-success': 'Success',
        '--ss-warning': 'Warning',
        '--ss-error': 'Error',
        '--ss-info': 'Info',
        // Accents
        '--ss-nsfw-accent': 'NSFW Accent',
        '--ss-highlight': 'Hover Highlight',
        '--ss-quote': 'Quote & Dialogue',
        // Buttons
        '--ss-rescue-bg': 'Rescue Button',
        '--ss-rescue-bg-hover': 'Rescue Button Hover',
        '--ss-stop-hover': 'Stop Button Hover',
        // Effects
        '--ss-shadow': 'Card Shadow',
        '--ss-shadow-lg': 'Modal Shadow',
        '--ss-overlay-bg': 'Overlay Backdrop',
        '--ss-focus-glow': 'Focus Glow',
        '--ss-transition': 'Transition Speed',
    };

    const PROP_DESCS = {
        '--ss-primary': 'Main accent used on buttons, active tabs, checkboxes, and highlights.',
        '--ss-primary-hover': 'Accent color when hovering primary buttons.',
        '--ss-primary-active': 'Accent color when pressing primary buttons.',
        '--ss-bg-primary': 'Outermost background for modals, settings panel, and FAB.',
        '--ss-bg-secondary': 'Background for sections, cards, and panels inside modals.',
        '--ss-bg-tertiary': 'Deepest inset layer - accordion content, scrollbar track, inner lists.',
        '--ss-bg-input': 'Background for text inputs, textareas, selects, and dropdowns.',
        '--ss-border': 'Default border for panels, inputs, dividers, and scrollbar thumb.',
        '--ss-border-focus': 'Border color when an input or dropdown is focused.',
        '--ss-success': 'Active/selected states, success badges, and confirmations.',
        '--ss-warning': 'Summarized message borders, warning badges, and caution indicators.',
        '--ss-error': 'Error text, missing status indicators, and destructive actions.',
        '--ss-info': 'Informational badges and built-in theme indicators.',
        '--ss-nsfw-accent': 'NSFW badge, section borders, and warning text color.',
        '--ss-highlight': 'Background tint on hovered items, cards, and dropdown options.',
        '--ss-quote': 'Quote/dialogue text color and scene badge styling.',
        '--ss-rescue-bg': 'Background for message rescue utility buttons.',
        '--ss-rescue-bg-hover': 'Hover state for rescue buttons.',
        '--ss-stop-hover': 'Hover state for the stop/cancel button.',
        '--ss-shadow': 'Small box shadow on cards and interactive elements.',
        '--ss-shadow-lg': 'Larger shadow on modals and popup overlays.',
        '--ss-overlay-bg': 'Page-dimming backdrop behind open modals.',
        '--ss-focus-glow': 'Glow ring around focused search inputs.',
        '--ss-transition': 'Duration/easing for all hover and state animations (e.g. "0.2s ease").',
    };

    const formatPropName = (prop) => PROP_LABELS[prop]
        || prop.replace('--ss-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Helper to check if value is a color (not a CSS variable or complex value)
    const isSimpleColor = (value) => {
        return /^#[0-9a-fA-F]{3,8}$/.test(value) || /^rgba?\(/.test(value);
    };

    /**
     * Parse any simple color string into { hex: '#RRGGBB', alpha: 0-1 }
     */
    const parseColorToHexAlpha = (value) => {
        if (!value) return { hex: '#888888', alpha: 1 };
        const v = value.trim();

        // #RRGGBB
        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
            return { hex: v, alpha: 1 };
        }
        // #RRGGBBAA
        if (/^#[0-9a-fA-F]{8}$/.test(v)) {
            const a = parseInt(v.slice(7, 9), 16) / 255;
            return { hex: v.slice(0, 7), alpha: Math.round(a * 100) / 100 };
        }
        // #RGB
        if (/^#[0-9a-fA-F]{3}$/.test(v)) {
            const r = v[1], g = v[2], b = v[3];
            return { hex: `#${r}${r}${g}${g}${b}${b}`, alpha: 1 };
        }
        // rgba(r, g, b, a) or rgb(r, g, b)
        const rgbaMatch = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
        if (rgbaMatch) {
            const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
            const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
            const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
            const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
            return { hex: `#${r}${g}${b}`, alpha: Math.round(a * 100) / 100 };
        }
        return { hex: '#888888', alpha: 1 };
    };

    /**
     * Combine hex color + alpha into rgba() string
     */
    const hexAlphaToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const a = Math.round(alpha * 100) / 100;
        return a >= 1 ? `rgba(${r}, ${g}, ${b}, 1)` : `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    /**
     * Build the color picker + alpha slider HTML for a given property
     */
    const buildColorPickerHtml = (prop, value) => {
        const { hex, alpha } = parseColorToHexAlpha(value);
        return `<input type="color" class="ss-color-picker" data-prop="${prop}" value="${hex}">` +
            `<input type="range" class="ss-alpha-slider" data-prop="${prop}" min="0" max="1" step="0.01" value="${alpha}">` +
            `<span class="ss-alpha-label" data-prop="${prop}">${Math.round(alpha * 100)}%</span>`;
    };

    // Helper to check if bg-primary uses SillyTavern default
    const isBgPrimaryST = (value) => {
        return value === 'var(--SmartThemeBlurTintColor)';
    };

    const SHADOW_PROPS = new Set(['--ss-shadow', '--ss-shadow-lg']);

    const splitShadowLayers = (shadowValue) => {
        if (!shadowValue || typeof shadowValue !== 'string') return [];
        const layers = [];
        let current = '';
        let depth = 0;

        for (const ch of shadowValue) {
            if (ch === '(') depth++;
            if (ch === ')' && depth > 0) depth--;

            if (ch === ',' && depth === 0) {
                if (current.trim()) layers.push(current.trim());
                current = '';
                continue;
            }

            current += ch;
        }

        if (current.trim()) layers.push(current.trim());
        return layers;
    };

    const parseShadowNumber = (token, fallback = 0) => {
        const cleaned = String(token || '').trim().replace(/px$/i, '');
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const normalizeShadowNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
    };

    const formatShadowPx = (value) => `${normalizeShadowNumber(value)}px`;

    const getDefaultShadowLayer = (layerIndex = 0) => {
        return layerIndex === 0
            ? { x: 0, y: 4, blur: 16, spread: 0, color: 'rgba(0, 0, 0, 0.5)', inset: false }
            : { x: 0, y: 0, blur: 30, spread: 0, color: 'rgba(0, 0, 0, 0.2)', inset: false };
    };

    const parseShadowLayer = (layerString, fallbackLayer = getDefaultShadowLayer()) => {
        if (!layerString || typeof layerString !== 'string') {
            return { ...fallbackLayer };
        }

        let rest = layerString.trim();
        const inset = /\binset\b/i.test(rest);
        if (inset) {
            rest = rest.replace(/\binset\b/ig, ' ').trim();
        }

        const colorMatch = rest.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/i);
        const color = colorMatch && isSimpleColor(colorMatch[1]) ? colorMatch[1].trim() : fallbackLayer.color;
        if (colorMatch) {
            rest = rest.replace(colorMatch[0], ' ').trim();
        }

        const numberTokens = rest
            .split(/\s+/)
            .filter(Boolean)
            .filter(token => /^-?\d*\.?\d+(?:px)?$/i.test(token));

        return {
            x: parseShadowNumber(numberTokens[0], fallbackLayer.x),
            y: parseShadowNumber(numberTokens[1], fallbackLayer.y),
            blur: parseShadowNumber(numberTokens[2], fallbackLayer.blur),
            spread: parseShadowNumber(numberTokens[3], fallbackLayer.spread),
            color,
            inset,
        };
    };

    const parseShadowValue = (value) => {
        const layers = splitShadowLayers(value);
        return [
            parseShadowLayer(layers[0], getDefaultShadowLayer(0)),
            parseShadowLayer(layers[1], getDefaultShadowLayer(1)),
        ];
    };

    const serializeShadowLayer = (layer) => {
        const color = String(layer?.color || '').trim() || getDefaultShadowLayer().color;
        return `${layer?.inset ? 'inset ' : ''}${formatShadowPx(layer?.x)} ${formatShadowPx(layer?.y)} ${formatShadowPx(layer?.blur)} ${formatShadowPx(layer?.spread)} ${color}`;
    };

    const serializeShadowLayers = (layerA, layerB) => {
        return `${serializeShadowLayer(layerA)}, ${serializeShadowLayer(layerB)}`;
    };

    const buildShadowColorPickerHtml = (prop, layerIndex, colorValue) => {
        const { hex, alpha } = parseColorToHexAlpha(colorValue);
        return `
            <input type="color" class="ss-color-picker ss-shadow-color-picker" data-prop="${prop}" data-layer="${layerIndex}" value="${hex}">
            <input type="range" class="ss-alpha-slider ss-shadow-alpha-slider" data-prop="${prop}" data-layer="${layerIndex}" min="0" max="1" step="0.01" value="${alpha}">
            <span class="ss-alpha-label ss-shadow-alpha-label" data-prop="${prop}" data-layer="${layerIndex}">${Math.round(alpha * 100)}%</span>
            <input type="text" class="ss-shadow-color-text" data-prop="${prop}" data-layer="${layerIndex}" value="${escapeHtml(colorValue)}" placeholder="rgba(0, 0, 0, 0.5)">
        `;
    };

    const buildShadowEditorRow = (prop, value, desc) => {
        const [layer1, layer2] = parseShadowValue(value);

        const buildLayerHtml = (layer, layerIndex) => `
            <div class="ss-shadow-layer" data-prop="${prop}" data-layer="${layerIndex}">
                <div class="ss-shadow-layer-head">
                    <span class="ss-shadow-layer-title">Layer ${layerIndex + 1}</span>
                    <label class="ss-shadow-inset-toggle">
                        <input type="checkbox" class="ss-shadow-inset-input" data-prop="${prop}" data-layer="${layerIndex}" ${layer.inset ? 'checked' : ''}>
                        Inset
                    </label>
                </div>
                <div class="ss-shadow-metrics">
                    <label class="ss-shadow-metric-field">
                        <span>X</span>
                        <input type="number" class="ss-shadow-metric" data-prop="${prop}" data-layer="${layerIndex}" data-metric="x" value="${normalizeShadowNumber(layer.x)}" step="1">
                    </label>
                    <label class="ss-shadow-metric-field">
                        <span>Y</span>
                        <input type="number" class="ss-shadow-metric" data-prop="${prop}" data-layer="${layerIndex}" data-metric="y" value="${normalizeShadowNumber(layer.y)}" step="1">
                    </label>
                    <label class="ss-shadow-metric-field">
                        <span>Blur</span>
                        <input type="number" class="ss-shadow-metric" data-prop="${prop}" data-layer="${layerIndex}" data-metric="blur" value="${normalizeShadowNumber(layer.blur)}" min="0" step="1">
                    </label>
                    <label class="ss-shadow-metric-field">
                        <span>Spread</span>
                        <input type="number" class="ss-shadow-metric" data-prop="${prop}" data-layer="${layerIndex}" data-metric="spread" value="${normalizeShadowNumber(layer.spread)}" step="1">
                    </label>
                </div>
                <div class="ss-color-inputs ss-shadow-color-inputs">
                    ${buildShadowColorPickerHtml(prop, layerIndex, layer.color)}
                </div>
            </div>
        `;

        return `
            <div class="ss-color-row ss-shadow-row" data-prop="${prop}">
                <label title="${prop}">${formatPropName(prop)}</label>
                ${desc ? `<div class="ss-color-desc">${escapeHtml(desc)}</div>` : ''}
                <div class="ss-shadow-editor" data-prop="${prop}">
                    ${buildLayerHtml(layer1, 0)}
                    ${buildLayerHtml(layer2, 1)}
                    <div class="ss-color-row ss-shadow-raw-row">
                        <label title="${prop}-raw">Raw CSS</label>
                        <div class="ss-color-inputs">
                            <input type="text" class="ss-color-text ss-shadow-raw-text" data-prop="${prop}" value="${escapeHtml(value || '')}" placeholder="0 4px 16px rgba(0,0,0,0.8), 0 0 30px rgba(...)">
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const FONT_OPTIONS = [...new Set([
        'Arial', 'Arial Black', 'Bahnschrift', 'Baskerville', 'Book Antiqua', 'Bookman Old Style',
        'Calibri', 'Cambria', 'Candara', 'Century Gothic', 'Cinzel', 'Comic Sans MS',
        'Consolas', 'Constantia', 'Copperplate Gothic', 'Corbel', 'Courier New',
        'Didot', 'Fira Code', 'Fira Sans', 'Franklin Gothic Medium', 'Garamond',
        'Georgia', 'Gill Sans', 'Helvetica', 'Helvetica Neue', 'IBM Plex Mono',
        'IBM Plex Sans', 'IBM Plex Serif', 'Impact', 'Inconsolata', 'Inter',
        'JetBrains Mono', 'Lato', 'Lucida Console', 'Lucida Sans Unicode',
        'Marker Felt', 'Menlo', 'Merriweather', 'Monaco', 'Montserrat',
        'Noto Sans', 'Noto Serif', 'Nunito', 'Open Sans', 'Optima',
        'Oswald', 'Palatino Linotype', 'Playfair Display', 'Poppins', 'PT Sans',
        'Quicksand', 'Raleway', 'Roboto', 'Rockwell', 'Segoe Print',
        'Segoe Script', 'Segoe UI', 'Segoe UI Variable', 'Source Code Pro',
        'Source Sans Pro', 'Space Grotesk', 'Tahoma', 'Times New Roman',
        'Trebuchet MS', 'Ubuntu', 'Verdana'
    ])];

    const TEXT_GROUPS = [
        {
            key: 'primary',
            title: 'Primary Text',
            colorProp: '--ss-text-primary',
            fontProp: '--ss-font-primary',
            sizeProp: '--ss-font-size-primary',
            desc: 'Used for most text, labels, and input text.',
            fontDesc: 'Font family for primary text.',
            sizeDesc: 'Font size for primary text.'
        },
        {
            key: 'secondary',
            title: 'Secondary Text',
            colorProp: '--ss-text-secondary',
            fontProp: '--ss-font-secondary',
            sizeProp: '--ss-font-size-secondary',
            desc: 'Used for secondary labels and supporting UI text.',
            fontDesc: 'Font family for secondary text.',
            sizeDesc: 'Font size for secondary text.'
        },
        {
            key: 'muted',
            title: 'Muted Text',
            colorProp: '--ss-text-muted',
            fontProp: '--ss-font-muted',
            sizeProp: '--ss-font-size-muted',
            desc: 'Used for descriptions and less prominent text.',
            fontDesc: 'Font family for muted text.',
            sizeDesc: 'Font size for muted text.'
        },
        {
            key: 'hint',
            title: 'Hint Text',
            colorProp: '--ss-text-hint',
            fontProp: '--ss-font-hint',
            sizeProp: '--ss-font-size-hint',
            desc: 'Used for fine-print hints and helper notes.',
            fontDesc: 'Font family for hint text.',
            sizeDesc: 'Font size for hint text.'
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
                <div class="ss-text-row-group" data-text-group="${g.key}">
                    <div class="ss-text-group-title">${escapeHtml(g.title)}</div>

                    <div class="ss-color-row">
                        <label title="${escapeHtml(g.colorProp)}">Color</label>
                        <div class="ss-color-desc">${escapeHtml(g.desc)}</div>
                        <div class="ss-color-inputs">
                            ${isColor ? buildColorPickerHtml(g.colorProp, colorVal) : ''}
                            <input type="text" class="ss-color-text" data-prop="${g.colorProp}" value="${escapeHtml(colorVal)}" placeholder="${escapeHtml(g.colorProp)}">
                        </div>
                    </div>

                    <div class="ss-color-row">
                        <label title="${escapeHtml(g.fontProp)}">Font</label>
                        <div class="ss-color-desc">${escapeHtml(g.fontDesc)}</div>
                        <div class="ss-color-inputs">
                            <input type="text" class="ss-typo-font" data-prop="${g.fontProp}" value="${escapeHtml(fontVal)}" placeholder="inherit / custom" autocomplete="off" spellcheck="false">
                        </div>
                    </div>

                    <div class="ss-color-row">
                        <label title="${escapeHtml(g.sizeProp)}">Size</label>
                        <div class="ss-color-desc">${escapeHtml(g.sizeDesc)}</div>
                        <div class="ss-color-inputs">
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
                <div class="ss-text-row-section">
                    ${buildTextGroupEditor()}
                </div>
            `;
        } else {
            for (const prop of props) {
                const value = theme.colors[prop] || '';
                const isColor = isSimpleColor(value);
                const desc = PROP_DESCS[prop];

                if (SHADOW_PROPS.has(prop)) {
                    inputsHtml += buildShadowEditorRow(prop, value, desc);
                    continue;
                }

                // Special handling for --ss-bg-primary
                if (prop === '--ss-bg-primary') {
                    const isSTDefault = isBgPrimaryST(value);
                    inputsHtml += `
                        <div class="ss-color-row ss-bg-primary-row">
                            <label title="${prop}">${formatPropName(prop)}</label>
                            ${desc ? `<div class="ss-color-desc">${escapeHtml(desc)}</div>` : ''}
                            <div class="ss-bg-primary-controls">
                                <select class="ss-bg-primary-select" data-prop="${prop}">
                                    <option value="st-default" ${isSTDefault ? 'selected' : ''}>SillyTavern Default</option>
                                    <option value="custom" ${!isSTDefault ? 'selected' : ''}>Custom</option>
                                </select>
                                <div class="ss-bg-primary-custom" style="display: ${isSTDefault ? 'none' : 'flex'}; align-items: center; gap: 6px; margin-top: 6px;">
                                    ${!isSTDefault && isColor ? buildColorPickerHtml(prop, value) : ''}
                                    <input type="text" class="ss-color-text" data-prop="${prop}" value="${isSTDefault ? '' : value}" placeholder="e.g. rgba(0,0,0,0.3)">
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    inputsHtml += `
                        <div class="ss-color-row">
                            <label title="${prop}">${formatPropName(prop)}</label>
                            ${desc ? `<div class="ss-color-desc">${escapeHtml(desc)}</div>` : ''}
                            <div class="ss-color-inputs">
                                ${isColor ? buildColorPickerHtml(prop, value) : ''}
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
    const popupControls = modal.closest('.popup')?.querySelector('.popup-controls');

    if (popupControls) {
        const footerActions = document.createElement('div');
        footerActions.className = 'ss-editor-footer-actions';
        footerActions.innerHTML = `
            <button class="menu_button ss-reset-colors-btn">Reset to Saved</button>
            <button class="menu_button ss-save-theme-btn">💾 Save Changes</button>
        `;
        popupControls.insertBefore(footerActions, popupControls.firstChild);
    }

    const popupRoot = modal.closest('.popup');
    const positionRoot = popupRoot || document.body;

    const fontSuggest = document.createElement('div');
    fontSuggest.className = 'ss-font-suggest';
    fontSuggest.hidden = true;
    fontSuggest.style.position = popupRoot ? 'absolute' : 'fixed';
    positionRoot.appendChild(fontSuggest);

    let activeFontInput = null;
    let filteredFontOptions = [];
    let activeFontOptionIndex = -1;

    const setShadowLayerControls = (prop, layerIndex, layerState) => {
        const layerSelector = `.ss-shadow-layer[data-prop="${prop}"][data-layer="${layerIndex}"]`;
        const xInput = modal.querySelector(`${layerSelector} .ss-shadow-metric[data-metric="x"]`);
        const yInput = modal.querySelector(`${layerSelector} .ss-shadow-metric[data-metric="y"]`);
        const blurInput = modal.querySelector(`${layerSelector} .ss-shadow-metric[data-metric="blur"]`);
        const spreadInput = modal.querySelector(`${layerSelector} .ss-shadow-metric[data-metric="spread"]`);
        const insetInput = modal.querySelector(`${layerSelector} .ss-shadow-inset-input`);
        const colorPicker = modal.querySelector(`.ss-shadow-color-picker[data-prop="${prop}"][data-layer="${layerIndex}"]`);
        const alphaSlider = modal.querySelector(`.ss-shadow-alpha-slider[data-prop="${prop}"][data-layer="${layerIndex}"]`);
        const alphaLabel = modal.querySelector(`.ss-shadow-alpha-label[data-prop="${prop}"][data-layer="${layerIndex}"]`);
        const colorText = modal.querySelector(`.ss-shadow-color-text[data-prop="${prop}"][data-layer="${layerIndex}"]`);

        if (xInput) xInput.value = normalizeShadowNumber(layerState.x);
        if (yInput) yInput.value = normalizeShadowNumber(layerState.y);
        if (blurInput) blurInput.value = normalizeShadowNumber(layerState.blur);
        if (spreadInput) spreadInput.value = normalizeShadowNumber(layerState.spread);
        if (insetInput) insetInput.checked = !!layerState.inset;
        if (colorText) colorText.value = layerState.color;

        if (colorPicker && alphaSlider) {
            const { hex, alpha } = parseColorToHexAlpha(layerState.color);
            colorPicker.value = hex;
            alphaSlider.value = alpha;
            if (alphaLabel) alphaLabel.textContent = `${Math.round(alpha * 100)}%`;
        }
    };

    const readShadowLayerControls = (prop, layerIndex) => {
        const fallback = getDefaultShadowLayer(layerIndex);
        const layerSelector = `.ss-shadow-layer[data-prop="${prop}"][data-layer="${layerIndex}"]`;
        const xInput = modal.querySelector(`${layerSelector} .ss-shadow-metric[data-metric="x"]`);
        const yInput = modal.querySelector(`${layerSelector} .ss-shadow-metric[data-metric="y"]`);
        const blurInput = modal.querySelector(`${layerSelector} .ss-shadow-metric[data-metric="blur"]`);
        const spreadInput = modal.querySelector(`${layerSelector} .ss-shadow-metric[data-metric="spread"]`);
        const insetInput = modal.querySelector(`${layerSelector} .ss-shadow-inset-input`);
        const colorText = modal.querySelector(`.ss-shadow-color-text[data-prop="${prop}"][data-layer="${layerIndex}"]`);
        const colorValue = colorText?.value?.trim() || fallback.color;

        return {
            x: parseShadowNumber(xInput?.value, fallback.x),
            y: parseShadowNumber(yInput?.value, fallback.y),
            blur: parseShadowNumber(blurInput?.value, fallback.blur),
            spread: parseShadowNumber(spreadInput?.value, fallback.spread),
            color: colorValue || fallback.color,
            inset: !!insetInput?.checked,
        };
    };

    const syncShadowRawFromControls = (prop, shouldApply = true) => {
        const rawInput = modal.querySelector(`.ss-shadow-raw-text[data-prop="${prop}"]`);
        const layerA = readShadowLayerControls(prop, 0);
        const layerB = readShadowLayerControls(prop, 1);
        const serialized = serializeShadowLayers(layerA, layerB);
        if (rawInput) rawInput.value = serialized;
        if (shouldApply) {
            applyLivePreview(prop, serialized);
        }
        return serialized;
    };

    const hydrateShadowControlsFromRaw = (prop, rawValue) => {
        const [layerA, layerB] = parseShadowValue(rawValue || '');
        setShadowLayerControls(prop, 0, layerA);
        setShadowLayerControls(prop, 1, layerB);
    };

    const syncShadowPickerToText = (prop, layerIndex) => {
        const picker = modal.querySelector(`.ss-shadow-color-picker[data-prop="${prop}"][data-layer="${layerIndex}"]`);
        const slider = modal.querySelector(`.ss-shadow-alpha-slider[data-prop="${prop}"][data-layer="${layerIndex}"]`);
        const label = modal.querySelector(`.ss-shadow-alpha-label[data-prop="${prop}"][data-layer="${layerIndex}"]`);
        const textInput = modal.querySelector(`.ss-shadow-color-text[data-prop="${prop}"][data-layer="${layerIndex}"]`);
        if (!picker || !slider || !textInput) return;
        const rgba = hexAlphaToRgba(picker.value, parseFloat(slider.value));
        textInput.value = rgba;
        if (label) label.textContent = `${Math.round(parseFloat(slider.value) * 100)}%`;
        syncShadowRawFromControls(prop);
    };

    const syncPickerToText = (prop) => {
        const picker = modal.querySelector(`.ss-color-picker[data-prop="${prop}"]:not(.ss-shadow-color-picker)`);
        const slider = modal.querySelector(`.ss-alpha-slider[data-prop="${prop}"]:not(.ss-shadow-alpha-slider)`);
        const label = modal.querySelector(`.ss-alpha-label[data-prop="${prop}"]:not(.ss-shadow-alpha-label)`);
        const textInput = modal.querySelector(`.ss-color-text[data-prop="${prop}"]`);
        if (!picker || !slider || !textInput) return;
        const rgba = hexAlphaToRgba(picker.value, parseFloat(slider.value));
        textInput.value = rgba;
        if (label) label.textContent = `${Math.round(parseFloat(slider.value) * 100)}%`;
        applyLivePreview(prop, rgba);
    };

    const positionFontSuggest = () => {
        if (fontSuggest.hidden || !activeFontInput) return;
        const rect = activeFontInput.getBoundingClientRect();
        const rootRect = popupRoot ? popupRoot.getBoundingClientRect() : { left: 0, top: 0 };
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const sidePadding = 8;
        const gap = 4;
        const desiredWidth = Math.max(rect.width, 220);
        const maxWidth = Math.max(180, viewportWidth - (sidePadding * 2));
        const width = Math.min(desiredWidth, maxWidth);
        let left = rect.left;
        left = Math.max(sidePadding, Math.min(left, viewportWidth - width - sidePadding));

        fontSuggest.style.width = `${width}px`;
        const leftPx = popupRoot ? (left - rootRect.left) : left;
        fontSuggest.style.left = `${leftPx}px`;

        const dropdownHeight = fontSuggest.offsetHeight || 0;
        const spaceBelow = viewportHeight - rect.bottom - sidePadding;
        const spaceAbove = rect.top - sidePadding;
        const shouldFlipAbove = dropdownHeight > 0
            && spaceBelow < Math.min(180, dropdownHeight)
            && spaceAbove > spaceBelow;

        let top = shouldFlipAbove
            ? rect.top - dropdownHeight - gap
            : rect.bottom + gap;

        const maxTop = Math.max(sidePadding, viewportHeight - dropdownHeight - sidePadding);
        top = Math.max(sidePadding, Math.min(top, maxTop));
        const topPx = popupRoot ? (top - rootRect.top) : top;
        fontSuggest.style.top = `${topPx}px`;
    };

    const closeFontSuggest = () => {
        fontSuggest.hidden = true;
        fontSuggest.innerHTML = '';
        activeFontOptionIndex = -1;
        activeFontInput = null;
        filteredFontOptions = [];
    };

    const applyFontSuggestion = (fontName) => {
        if (!activeFontInput) return;
        const input = activeFontInput;
        const prop = input.dataset.prop;
        input.value = fontName;
        applyLivePreview(prop, fontName);
        closeFontSuggest();
        input.focus();
    };

    const renderFontSuggest = () => {
        if (!activeFontInput) return;

        const query = String(activeFontInput.value || '').trim().toLowerCase();
        filteredFontOptions = FONT_OPTIONS.filter(font => font.toLowerCase().includes(query));

        if (filteredFontOptions.length === 0) {
            fontSuggest.innerHTML = '<div class="ss-font-suggest-empty">No matching fonts</div>';
            activeFontOptionIndex = -1;
        } else {
            if (activeFontOptionIndex < 0 || activeFontOptionIndex >= filteredFontOptions.length) {
                activeFontOptionIndex = 0;
            }

            fontSuggest.innerHTML = filteredFontOptions.map((font, index) => `
                <button type="button" class="ss-font-suggest-item ${index === activeFontOptionIndex ? 'active' : ''}" data-font="${escapeHtml(font)}" data-index="${index}">
                    ${escapeHtml(font)}
                </button>
            `).join('');

            fontSuggest.querySelectorAll('.ss-font-suggest-item').forEach(item => {
                const font = item.dataset.font || '';
                item.style.fontFamily = `"${font}", sans-serif`;
            });
        }

        fontSuggest.hidden = false;
        positionFontSuggest();
    };

    const onWindowReflow = () => positionFontSuggest();
    const onOutsideClick = (event) => {
        if (fontSuggest.hidden) return;
        const target = event.target;
        if (target === activeFontInput) return;
        if (fontSuggest.contains(target)) return;
        closeFontSuggest();
    };

    window.addEventListener('resize', onWindowReflow);
    window.addEventListener('scroll', onWindowReflow, true);
    document.addEventListener('mousedown', onOutsideClick, true);

    showPromise.finally(() => {
        window.removeEventListener('resize', onWindowReflow);
        window.removeEventListener('scroll', onWindowReflow, true);
        document.removeEventListener('mousedown', onOutsideClick, true);
        fontSuggest.remove();
    });

    fontSuggest.addEventListener('mousedown', (event) => {
        const item = event.target.closest('.ss-font-suggest-item');
        if (!item) return;
        event.preventDefault();
        applyFontSuggestion(item.dataset.font || '');
    });

    modal.querySelectorAll('.ss-color-picker:not(.ss-shadow-color-picker)').forEach(picker => {
        picker.addEventListener('input', () => syncPickerToText(picker.dataset.prop));
    });

    modal.querySelectorAll('.ss-alpha-slider:not(.ss-shadow-alpha-slider)').forEach(slider => {
        slider.addEventListener('input', () => syncPickerToText(slider.dataset.prop));
    });

    modal.querySelectorAll('.ss-shadow-color-picker').forEach(picker => {
        picker.addEventListener('input', () => syncShadowPickerToText(picker.dataset.prop, Number(picker.dataset.layer)));
    });

    modal.querySelectorAll('.ss-shadow-alpha-slider').forEach(slider => {
        slider.addEventListener('input', () => syncShadowPickerToText(slider.dataset.prop, Number(slider.dataset.layer)));
    });

    modal.querySelectorAll('.ss-shadow-color-text').forEach(input => {
        input.addEventListener('input', (event) => {
            const prop = event.target.dataset.prop;
            const layerIndex = Number(event.target.dataset.layer);
            const value = event.target.value.trim();
            const picker = modal.querySelector(`.ss-shadow-color-picker[data-prop="${prop}"][data-layer="${layerIndex}"]`);
            const slider = modal.querySelector(`.ss-shadow-alpha-slider[data-prop="${prop}"][data-layer="${layerIndex}"]`);
            const label = modal.querySelector(`.ss-shadow-alpha-label[data-prop="${prop}"][data-layer="${layerIndex}"]`);

            if (picker && slider && isSimpleColor(value)) {
                const { hex, alpha } = parseColorToHexAlpha(value);
                picker.value = hex;
                slider.value = alpha;
                if (label) label.textContent = `${Math.round(alpha * 100)}%`;
            }

            syncShadowRawFromControls(prop);
        });
    });

    modal.querySelectorAll('.ss-shadow-metric, .ss-shadow-inset-input').forEach(input => {
        const eventName = input.classList.contains('ss-shadow-inset-input') ? 'change' : 'input';
        input.addEventListener(eventName, (event) => {
            const prop = event.target.dataset.prop;
            syncShadowRawFromControls(prop);
        });
    });

    modal.querySelectorAll('.ss-shadow-raw-text').forEach(input => {
        input.addEventListener('input', (event) => {
            const prop = event.target.dataset.prop;
            const value = event.target.value;
            hydrateShadowControlsFromRaw(prop, value);
            applyLivePreview(prop, value);
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

    // Live preview: text input changes -> sync back to picker + slider
    modal.querySelectorAll('.ss-color-text:not(.ss-shadow-raw-text)').forEach(input => {
        input.addEventListener('input', (e) => {
            const prop = e.target.dataset.prop;
            const value = e.target.value.trim();
            const picker = modal.querySelector(`.ss-color-picker[data-prop="${prop}"]:not(.ss-shadow-color-picker)`);
            const slider = modal.querySelector(`.ss-alpha-slider[data-prop="${prop}"]:not(.ss-shadow-alpha-slider)`);
            const label = modal.querySelector(`.ss-alpha-label[data-prop="${prop}"]:not(.ss-shadow-alpha-label)`);

            if (picker && slider && isSimpleColor(value)) {
                const { hex, alpha } = parseColorToHexAlpha(value);
                picker.value = hex;
                slider.value = alpha;
                if (label) label.textContent = `${Math.round(alpha * 100)}%`;
            }

            applyLivePreview(prop, e.target.value);
        });
    });

    modal.querySelectorAll('.ss-typo-font').forEach(input => {
        input.addEventListener('focus', () => {
            activeFontInput = input;
            activeFontOptionIndex = 0;
            renderFontSuggest();
        });

        input.addEventListener('input', (e) => {
            const prop = e.target.dataset.prop;
            const value = e.target.value.trim();
            applyLivePreview(prop, value);
            activeFontInput = e.target;
            activeFontOptionIndex = 0;
            renderFontSuggest();
        });

        input.addEventListener('keydown', (e) => {
            if (fontSuggest.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                activeFontInput = e.target;
                activeFontOptionIndex = 0;
                renderFontSuggest();
                e.preventDefault();
                return;
            }

            if (fontSuggest.hidden) return;

            if (e.key === 'ArrowDown') {
                activeFontOptionIndex = Math.min(filteredFontOptions.length - 1, activeFontOptionIndex + 1);
                renderFontSuggest();
                e.preventDefault();
            } else if (e.key === 'ArrowUp') {
                activeFontOptionIndex = Math.max(0, activeFontOptionIndex - 1);
                renderFontSuggest();
                e.preventDefault();
            } else if (e.key === 'Enter') {
                if (filteredFontOptions[activeFontOptionIndex]) {
                    applyFontSuggestion(filteredFontOptions[activeFontOptionIndex]);
                    e.preventDefault();
                }
            } else if (e.key === 'Escape') {
                closeFontSuggest();
                e.preventDefault();
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                const activeElement = document.activeElement;
                if (!fontSuggest.contains(activeElement) && activeElement !== input) {
                    closeFontSuggest();
                }
            }, 100);
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

    SHADOW_PROPS.forEach(prop => {
        const rawInput = modal.querySelector(`.ss-shadow-raw-text[data-prop="${prop}"]`);
        if (rawInput) {
            const value = rawInput.value || theme.colors[prop] || '';
            hydrateShadowControlsFromRaw(prop, value);
        }
    });

    const resetBtn = modal.closest('.popup')?.querySelector('.ss-reset-colors-btn');
    const saveBtn = modal.closest('.popup')?.querySelector('.ss-save-theme-btn');

    // Reset button
    resetBtn?.addEventListener('click', () => {
        // Reset form values (colors)
        for (const [prop, value] of Object.entries(originalColors)) {
            const textInput = modal.querySelector(`.ss-color-text[data-prop="${prop}"]`);
            const picker = modal.querySelector(`.ss-color-picker[data-prop="${prop}"]:not(.ss-shadow-color-picker)`);
            const slider = modal.querySelector(`.ss-alpha-slider[data-prop="${prop}"]:not(.ss-shadow-alpha-slider)`);
            const label = modal.querySelector(`.ss-alpha-label[data-prop="${prop}"]:not(.ss-shadow-alpha-label)`);
            if (textInput) textInput.value = value;
            if (picker && slider && isSimpleColor(value)) {
                const { hex, alpha } = parseColorToHexAlpha(value);
                picker.value = hex;
                slider.value = alpha;
                if (label) label.textContent = `${Math.round(alpha * 100)}%`;
            }

            // Reapply to extension elements only
            applyLivePreview(prop, value);
        }

        SHADOW_PROPS.forEach(prop => {
            const rawInput = modal.querySelector(`.ss-shadow-raw-text[data-prop="${prop}"]`);
            const saved = originalColors[prop] || '';
            if (rawInput) rawInput.value = saved;
            hydrateShadowControlsFromRaw(prop, saved);
            applyLivePreview(prop, saved);
        });

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
            const m = String(originalColors[prop] || '').trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
            input.value = m ? m[1] : '';
        });

        // Reset meta
        document.getElementById('ss-edit-theme-name').value = originalMeta.name;
        document.getElementById('ss-edit-theme-desc').value = originalMeta.description || '';
        document.getElementById('ss-edit-theme-emoji').value = originalMeta.preview || '🎨';
        document.getElementById('ss-edit-extra-css').value = originalMeta.extraStyles || '';

        closeFontSuggest();
        toastr.info('Reset to saved values');
    });

    // Save button
    saveBtn?.addEventListener('click', async () => {
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

        const result = await updateCustomTheme(
            themeId,
            {
                name: document.getElementById('ss-edit-theme-name')?.value?.trim() || theme.name,
                description: document.getElementById('ss-edit-theme-desc')?.value?.trim() || '',
                preview: document.getElementById('ss-edit-theme-emoji')?.value?.trim() || '🎨',
                colors: newColors,
                extraStyles: document.getElementById('ss-edit-extra-css')?.value || '',
            },
            settings,
            saveSettingsFn
        );

        if (!result.success) {
            toastr.error(result.error || 'Failed to save theme');
            return;
        }

        const updated = getThemes()[themeId];
        toastr.success(`Theme "${updated?.name || theme.name}" saved!`);
        popup.complete(POPUP_RESULT.OK);
    });

    return showPromise;
}

