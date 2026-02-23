/**
 * Modal Utilities
 * Common functions for creating and managing modals
 */

import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../../../popup.js';
import { escapeHtml } from './ui-utils.js';

const SS_OWNED_POPUP_CLASS = 'ss-owned-popup';
const SS_OWNED_POPUP_ATTR = 'data-ss-popup';

function formatPopupMessage(message) {
    return escapeHtml(String(message ?? '')).replace(/\n/g, '<br>');
}

function markPopupAsSsOwned(popup) {
    const root = popup?.dlg;
    if (!root) return;
    root.classList.add(SS_OWNED_POPUP_CLASS);
    root.setAttribute(SS_OWNED_POPUP_ATTR, '1');
}

/**
 * Decorate popup options so only SS-owned popups receive SS popup theming.
 * @param {Object} options
 * @returns {Object}
 */
export function decoratePopupOptionsForSs(options = {}) {
    const originalOnOpen = options?.onOpen;
    return {
        ...options,
        onOpen: async (popup) => {
            markPopupAsSsOwned(popup);
            if (typeof originalOnOpen === 'function') {
                await originalOnOpen(popup);
            }
        },
    };
}

/**
 * Create a standard modal with custom content
 * @param {string} content - HTML content for the modal
 * @param {string} type - Modal type (POPUP_TYPE)
 * @param {string|null} defaultValue - Default value for input modals
 * @param {Object} options - Additional options
 * @returns {Popup} The created popup instance
 */
export function createModal(content, type = POPUP_TYPE.TEXT, defaultValue = null, options = {}) {
    return new Popup(content, type, defaultValue, decoratePopupOptionsForSs(options));
}

/**
 * Show a confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Object} options - Additional button options
 * @returns {Promise<number>} POPUP_RESULT value
 */
export async function showSsConfirm(title, message, options = {}) {
    const {
        okButton = 'OK',
        cancelButton = 'Cancel',
        rows = null,
        ...popupOptions
    } = options;

    const modalHtml = `
        <div class="ss-owned-popup-content ss-popup-confirm">
            <h3>${escapeHtml(title)}</h3>
            <p>${formatPopupMessage(message)}</p>
        </div>
    `;

    const popup = new Popup(modalHtml, POPUP_TYPE.CONFIRM, null, decoratePopupOptionsForSs({
        okButton,
        cancelButton,
        rows,
        ...popupOptions,
    }));

    return await popup.show();
}

/**
 * Show an information dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Object} options - Popup options
 * @returns {Promise<number>} POPUP_RESULT value
 */
export async function showSsText(title, message, options = {}) {
    const {
        okButton = 'OK',
        ...popupOptions
    } = options;

    const modalHtml = `
        <div class="ss-owned-popup-content ss-popup-text">
            <h3>${escapeHtml(title)}</h3>
            <p>${formatPopupMessage(message)}</p>
        </div>
    `;

    const popup = new Popup(modalHtml, POPUP_TYPE.TEXT, null, decoratePopupOptionsForSs({
        okButton,
        ...popupOptions,
    }));
    return await popup.show();
}

/**
 * Show an error dialog
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @returns {Promise<number>} POPUP_RESULT value
 */
export async function showError(title, message) {
    const modalHtml = `
        <div class="ss-owned-popup-content ss-popup-error">
            <h3><i class="fa-solid fa-exclamation-triangle"></i> ${escapeHtml(title)}</h3>
            <p>${formatPopupMessage(message)}</p>
        </div>
    `;

    const popup = new Popup(modalHtml, POPUP_TYPE.TEXT, null, decoratePopupOptionsForSs({ okButton: 'OK' }));
    return await popup.show();
}

/**
 * Show an input dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} defaultValue - Default input value
 * @param {Object} options - Additional options
 * @returns {Promise<string|null>} Input value or null if cancelled
 */
export async function showSsInput(title, message, defaultValue = '', options = {}) {
    const {
        okButton = 'OK',
        cancelButton = 'Cancel',
        inputType = 'text',
        ...popupOptions
    } = options;
    void inputType;

    const modalHtml = `
        <div class="ss-owned-popup-content ss-popup-input">
            <h3>${escapeHtml(title)}</h3>
            <p>${formatPopupMessage(message)}</p>
        </div>
    `;

    const popup = new Popup(modalHtml, POPUP_TYPE.INPUT, defaultValue, decoratePopupOptionsForSs({
        okButton,
        cancelButton,
        ...popupOptions,
    }));

    const value = await popup.show();
    if (value === '') return '';
    return value ? String(value) : null;
}

/**
 * Backward-compatible aliases
 */
export const showConfirm = showSsConfirm;
export const showInput = showSsInput;
export async function showInfo(title, message, okButton = 'OK') {
    return await showSsText(title, message, { okButton });
}

/**
 * Create a modal header element
 * @param {string} title - Header title
 * @param {string} subtitle - Optional subtitle
 * @returns {string} HTML string for modal header
 */
export function createModalHeader(title, subtitle = null) {
    let html = `<div class="ss-modal-header"><h3>${escapeHtml(title)}</h3>`;
    if (subtitle) {
        html += `<p class="ss-modal-subtitle">${escapeHtml(subtitle)}</p>`;
    }
    html += `</div>`;
    return html;
}

/**
 * Create a modal section element
 * @param {string} title - Section title
 * @param {string} content - Section content HTML
 * @param {string} className - Additional CSS class
 * @returns {string} HTML string for modal section
 */
export function createModalSection(title, content, className = '') {
    return `
        <div class="ss-modal-section ${className}">
            <h4>${escapeHtml(title)}</h4>
            <div class="ss-modal-section-content">
                ${content}
            </div>
        </div>
    `;
}

/**
 * Create a modal footer with buttons
 * @param {Array<Object>} buttons - Array of button configs {label, className, id}
 * @returns {string} HTML string for modal footer
 */
export function createModalFooter(buttons) {
    const buttonHtml = buttons.map(btn => {
        const className = btn.className || 'menu_button';
        const id = btn.id ? `id="${btn.id}"` : '';
        return `<button ${id} class="${className}">${escapeHtml(btn.label)}</button>`;
    }).join('');

    return `<div class="ss-modal-footer">${buttonHtml}</div>`;
}

/**
 * Export POPUP_RESULT for convenience
 */
export { POPUP_RESULT };
