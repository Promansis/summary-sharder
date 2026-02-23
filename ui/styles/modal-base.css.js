export const MODAL_BASE_CSS = `
/* Primary Action Buttons */
.ss-primary-btn {
    background: var(--ss-primary) !important;
    border-color: var(--ss-primary) !important;
    color: white !important;
}

.ss-primary-btn:hover {
    background: var(--ss-primary-hover) !important;
    border-color: var(--ss-primary-hover) !important;
}

/* Main UI Buttons
   Default theme: inherit SillyTavern's native '.menu_button' styling.
   Non-default themes: apply Summary Sharder themed button colors.
*/
body:not(.ss-theme-default) #ss-run-summarize,
body:not(.ss-theme-default) #ss-stop-summarize,
body:not(.ss-theme-default) #ss-visibility-button,
body:not(.ss-theme-default) #ss-manage-chats-btn,
body:not(.ss-theme-default) #ss-open-themes-btn,
body:not(.ss-theme-default) #ss-open-rag-btn,
body:not(.ss-theme-default) #ss-open-prompts-btn,
body:not(.ss-theme-default) #ss-open-api-config-modal,
body:not(.ss-theme-default) #ss-open-cleanup-btn,
body:not(.ss-theme-default) #ss-lorebook-options-btn,
body:not(.ss-theme-default) [id^="ss-"][class*="menu_button"] {
    background: var(--ss-bg-secondary) !important;
    color: var(--ss-text-primary) !important;
    border: 1px solid var(--ss-border) !important;
}

body:not(.ss-theme-default) #ss-run-summarize:hover:not(:disabled),
body:not(.ss-theme-default) #ss-stop-summarize:hover:not(:disabled),
body:not(.ss-theme-default) #ss-visibility-button:hover:not(:disabled),
body:not(.ss-theme-default) #ss-manage-chats-btn:hover:not(:disabled),
body:not(.ss-theme-default) #ss-open-themes-btn:hover:not(:disabled),
body:not(.ss-theme-default) #ss-open-rag-btn:hover:not(:disabled),
body:not(.ss-theme-default) #ss-open-prompts-btn:hover:not(:disabled),
body:not(.ss-theme-default) #ss-open-api-config-modal:hover:not(:disabled),
body:not(.ss-theme-default) #ss-open-cleanup-btn:hover:not(:disabled),
body:not(.ss-theme-default) #ss-lorebook-options-btn:hover:not(:disabled),
body:not(.ss-theme-default) [id^="ss-"][class*="menu_button"]:hover:not(:disabled) {
    background: var(--ss-highlight) !important;
    border-color: var(--ss-primary) !important;
    color: var(--ss-primary) !important;
}

/* Stop Button */
body:not(.ss-theme-default) #ss-stop-summarize {
    background-color: var(--ss-stop-bg) !important;
    border-color: var(--ss-stop-bg) !important;
    color: white !important;
}

body:not(.ss-theme-default) #ss-stop-summarize:hover {
    background-color: var(--ss-stop-hover) !important;
}

/* Rescue Button */
.ss-rescue-btn {
    font-size: 11px !important;
    padding: 4px 10px !important;
    background: var(--ss-rescue-bg) !important;
    color: white !important;
    border: none !important;
    border-radius: 4px !important;
}

.ss-rescue-btn:hover {
    background: var(--ss-rescue-bg-hover) !important;
}

.ss-rescue-btn.rescued {
    background: var(--ss-success) !important;
}

.ss-rescue-btn.rescued:hover {
    background: #27ae60 !important;
}

/* ==========================================================================
   SECTION 5: MODAL BASE STYLES
   ========================================================================== */

.ss-modal {
    background: var(--ss-bg-primary);
    color: var(--ss-text-primary);
    border: 1px solid var(--ss-border);
    border-radius: 12px;
    box-shadow: var(--ss-shadow-lg);
    padding: 20px;
}

.ss-modal h3 {
    color: var(--ss-text-primary);
    margin: 0 0 15px 0;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--ss-border);
}

.ss-modal h4 {
    color: var(--ss-text-primary);
    margin: 15px 0 10px 0;
}

.ss-modal p {
    line-height: 1.5;
}

.ss-modal hr {
    border: none;
    border-top: 1px solid var(--ss-border);
    margin: 15px 0;
}

/* Universal Modal Theming - Target popup wrapper */
.popup:has([class*="ss-"][class*="-modal"]) {
    --customThemeColor: var(--ss-primary) !important;
    --customThemeColor1: var(--ss-primary) !important;
    --customThemeColor2: var(--ss-primary-hover) !important;
    background: var(--ss-bg-primary) !important;
    border: 1px solid var(--ss-border) !important;
    border-radius: 12px !important;
    box-shadow: var(--ss-shadow-lg) !important;
}

body:not(.ss-theme-default) .popup.ss-owned-popup {
    --customThemeColor: var(--ss-primary) !important;
    --customThemeColor1: var(--ss-primary) !important;
    --customThemeColor2: var(--ss-primary-hover) !important;
    background: var(--ss-bg-primary) !important;
    border: 1px solid var(--ss-border) !important;
    border-radius: 12px !important;
    box-shadow: var(--ss-shadow-lg) !important;
}

.popup-overlay:has(+ .popup [class*="ss-"][class*="-modal"]),
.popup-bg:has(~ .popup [class*="ss-"][class*="-modal"]) {
    background: var(--ss-overlay-bg) !important;
}

body:not(.ss-theme-default) .popup-overlay:has(+ .popup.ss-owned-popup),
body:not(.ss-theme-default) .popup-bg:has(~ .popup.ss-owned-popup) {
    background: var(--ss-overlay-bg) !important;
}

body:not(.ss-theme-default) .popup.ss-owned-popup .ss-owned-popup-content {
    background: transparent;
    color: var(--ss-text-primary);
}

body:not(.ss-theme-default) .popup.ss-owned-popup .ss-owned-popup-content h3 {
    color: var(--ss-text-primary) !important;
    margin: 0 0 15px 0;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--ss-border) !important;
}

body:not(.ss-theme-default) .popup.ss-owned-popup .ss-owned-popup-content p {
    line-height: 1.5;
}

body:not(.ss-theme-default) .popup.ss-owned-popup .popup-input.text_pole,
body:not(.ss-theme-default) .popup.ss-owned-popup textarea.popup-input.text_pole {
    background: var(--ss-bg-input) !important;
    color: var(--ss-text-primary) !important;
    border: 1px solid var(--ss-border) !important;
}

body:not(.ss-theme-default) .popup.ss-owned-popup .popup-input.text_pole:focus,
body:not(.ss-theme-default) .popup.ss-owned-popup textarea.popup-input.text_pole:focus {
    border-color: var(--ss-border-focus) !important;
}

[class*="ss-"][class*="-modal"] {
    background: var(--ss-bg-primary);
    color: var(--ss-text-primary);
}

[class*="ss-"][class*="-modal"] h3,
[class*="ss-"][class*="-modal"] h4 {
    color: var(--ss-text-primary);
}

.ss-text-hint {
    color: var(--ss-text-hint) !important;
    font-family: var(--ss-font-hint, inherit);
    font-size: var(--ss-font-size-hint, inherit);
}

/* Modal Form Controls */
[class*="ss-"][class*="-modal"] input.text_pole,
[class*="ss-"][class*="-modal"] textarea.text_pole,
[class*="ss-"][class*="-modal"] select.text_pole {
    background: var(--ss-bg-input) !important;
    color: var(--ss-text-primary) !important;
    border: 1px solid var(--ss-border) !important;
}

[class*="ss-"][class*="-modal"] input.text_pole:focus,
[class*="ss-"][class*="-modal"] textarea.text_pole:focus {
    border-color: var(--ss-border-focus) !important;
}

[class*="ss-"][class*="-modal"] .menu_button {
    background: var(--ss-bg-secondary);
    color: var(--ss-text-primary);
    border: 1px solid var(--ss-border);
}

[class*="ss-"][class*="-modal"] .menu_button:hover:not(:disabled) {
    background: var(--ss-highlight);
    border-color: var(--ss-primary);
}

[class*="ss-"][class*="-modal"] .menu_button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

[class*="ss-"][class*="-modal"] img:not(.ss-dropdown-trigger img) {
    max-width: 100%;
    max-height: 120px;
    object-fit: contain;
}

/* Popup Buttons */
body:not(.ss-theme-default) .popup.ss-owned-popup .popup-button-ok,
body:not(.ss-theme-default) .popup.ss-owned-popup .popup-button-cancel,
body:not(.ss-theme-default) .popup.ss-owned-popup .popup-controls .menu_button,
.popup:has([class*="ss-"][class*="-modal"]) .popup-button-ok,
.popup:has([class*="ss-"][class*="-modal"]) .popup-button-cancel,
.popup:has([class*="ss-"][class*="-modal"]) .popup-controls .menu_button {
    background: var(--ss-bg-secondary) !important;
    color: var(--ss-text-primary) !important;
    border: 1px solid var(--ss-border) !important;
}

body:not(.ss-theme-default) .popup.ss-owned-popup .popup-button-ok,
.popup:has([class*="ss-"][class*="-modal"]) .popup-button-ok {
    background: var(--ss-primary) !important;
    border-color: var(--ss-primary) !important;
}

body:not(.ss-theme-default) .popup.ss-owned-popup .popup-button-ok:hover,
body:not(.ss-theme-default) .popup.ss-owned-popup .popup-button-ok:focus-visible,
.popup:has([class*="ss-"][class*="-modal"]) .popup-button-ok:hover,
.popup:has([class*="ss-"][class*="-modal"]) .popup-button-ok:focus-visible {
    background: var(--ss-primary-hover) !important;
    border-color: var(--ss-primary-hover) !important;
    color: var(--ss-text-primary) !important;
    filter: none !important;
}

body:not(.ss-theme-default) .popup.ss-owned-popup .popup-controls .menu_button:hover,
.popup:has([class*="ss-"][class*="-modal"]) .popup-controls .menu_button:hover {
    background: var(--ss-highlight) !important;
    border-color: var(--ss-primary) !important;
    color: var(--ss-text-primary) !important;
}

body:not(.ss-theme-default) .popup.ss-owned-popup .popup-content .popup-header,
body:not(.ss-theme-default) .popup.ss-owned-popup .popup-content h3,
.popup:has([class*="ss-"][class*="-modal"]) .popup-content .popup-header,
.popup:has([class*="ss-"][class*="-modal"]) .popup-content h3 {
    color: var(--ss-text-primary) !important;
    border-color: var(--ss-border) !important;
}

/* Popup Controls with Left Buttons */
.popup:has(.ss-prompts-modal) .popup-controls {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    width: 100% !important;
    gap: 10px;
}

.ss-popup-left-buttons {
    display: flex;
    gap: 5px;
    margin-right: auto;
}

.ss-popup-left-buttons .menu_button {
    background: var(--ss-bg-secondary);
    color: var(--ss-text-primary);
    border: 1px solid var(--ss-border);
}

.ss-popup-left-buttons .menu_button:hover {
    background: var(--ss-highlight);
    border-color: var(--ss-primary);
}

/* ==========================================================================
   SECTION 6: SECTIONS, PANELS & BLOCKS
   ========================================================================== */

.ss-section,
.ss-panel,
.ss-block {
    background: var(--ss-bg-secondary);
    border: 1px solid var(--ss-border);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 10px;
}

.ss-section-header {
    color: var(--ss-text-primary);
    font-weight: 600;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
}
`;
