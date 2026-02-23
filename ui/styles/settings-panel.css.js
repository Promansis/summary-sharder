export const SETTINGS_PANEL_CSS = `
/* ==========================================================================
   SECTION 2: MAIN SETTINGS PANEL
   ========================================================================== */

#summary-sharder-settings {
    margin-top: 10px;
}

#summary-sharder-settings .inline-drawer-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    max-height: 72vh;
    padding: 10px;
}

#summary-sharder-panel {
    background: var(--ss-bg-primary);
    color: var(--ss-text-primary);
    border: 1px solid var(--ss-border);
    padding: 10px;
    border-radius: 8px;
}

#summary-sharder-panel h3,
#summary-sharder-panel h4 {
    color: var(--ss-text-primary);
    margin: 0 0 10px 0;
}

#summary-sharder-panel p {
    color: var(--ss-text-secondary);
}

#summary-sharder-panel .ss-hint {
    color: var(--ss-text-muted);
    font-family: var(--ss-font-muted, inherit);
    font-size: var(--ss-font-size-muted, 12px);
    margin: 3px 0 0 0;
}

#summary-sharder-settings label,
#summary-sharder-settings .ss-block > label,
#summary-sharder-settings .ss-sharder-controls h4,
#summary-sharder-settings .checkbox_label span {
    color: var(--ss-text-primary) !important;
}

#summary-sharder-settings .ss-hint,
#summary-sharder-settings p.ss-hint {
    color: var(--ss-text-hint) !important;
    font-family: var(--ss-font-hint, inherit);
    font-size: var(--ss-font-size-hint, inherit);
}

#summary-sharder-settings select.text_pole,
#summary-sharder-settings select.text_pole option {
    color: var(--ss-text-secondary) !important;
}

#ss-active-prompt-display {
    color: var(--ss-text-secondary) !important;
    font-style: italic;
}

#ss-length-slider-section label {
    color: var(--ss-text-primary);
}

/* ==========================================================================
   SECTION 2A: SETTINGS PANEL LAYOUT REFACTOR
   ========================================================================== */

#summary-sharder-settings .ss-settings-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    overscroll-behavior-y: auto;
    display: flex;
    flex-direction: column;
    padding: 4px 2px 8px;
    scroll-padding-top: 4px;
    scroll-padding-bottom: 8px;
}

#summary-sharder-settings .ss-bg {
    background: var(--ss-bg-primary);
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

#summary-sharder-settings .ss-bg > * {
    flex-shrink: 0;
}

#summary-sharder-settings .ss-action-bar {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

#summary-sharder-settings .ss-action-bar-primary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
}

#summary-sharder-settings .ss-action-bar-secondary {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

#summary-sharder-settings .ss-action-bar .menu_button {
    width: 100%;
}

#summary-sharder-settings .ss-action-bar-secondary .menu_button {
    flex: 1;
    min-width: 120px;
}

#summary-sharder-settings .ss-settings-accordion {
    margin-bottom: 0;
    border-radius: 4px;
    background: var(--ss-bg-secondary);
}

#summary-sharder-settings .ss-settings-accordion .ss-accordion-header {
    min-height: 32px;
    padding: 8px 10px;
}

#summary-sharder-settings .ss-settings-accordion .ss-accordion-content {
    max-height: none;
    overflow: visible;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

#summary-sharder-settings .ss-settings-accordion.expanded .ss-accordion-content {
    max-height: clamp(180px, 38vh, 360px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    overscroll-behavior-y: auto;
}

#summary-sharder-settings .ss-settings-section {
    background: var(--ss-bg-secondary);
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 4px;
}

#summary-sharder-settings .ss-control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

#summary-sharder-settings .ss-control-group .ss-block {
    margin-bottom: 0;
}

#summary-sharder-settings .ss-inline-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
}

#summary-sharder-settings .ss-inline-row > label {
    flex-shrink: 0;
    white-space: nowrap;
    margin: 0;
}

#summary-sharder-settings .ss-inline-row > .ss-segmented-toggle,
#summary-sharder-settings .ss-inline-row > .ss-tag-input,
#summary-sharder-settings .ss-inline-row > .ss-range-pair,
#summary-sharder-settings .ss-inline-row > input,
#summary-sharder-settings .ss-inline-row > .text_pole,
#summary-sharder-settings .ss-inline-row > .ss-inline-with-unit {
    flex: 1;
    min-width: 0;
}

#summary-sharder-settings .ss-inline-with-unit {
    display: flex;
    align-items: center;
    gap: 6px;
}

#summary-sharder-settings .ss-inline-with-unit .text_pole {
    width: 72px;
}

#summary-sharder-settings .ss-toggle-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 32px;
}

#summary-sharder-settings .ss-toggle-row > label {
    flex: 1;
    margin: 0;
}

#summary-sharder-settings .ss-api-status-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
}

#summary-sharder-settings .ss-lorebook-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

#summary-sharder-settings .ss-lorebook-toggles {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

#summary-sharder-settings .ss-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
}

/* Prompts List */
#ss-prompts-list {
    margin-bottom: 8px;
}

#ss-prompts-list select {
    width: 100%;
    margin-bottom: 5px;
}

#ss-prompts-list textarea {
    font-family: monospace;
    font-size: 11px;
    resize: vertical;
}

/* ==========================================================================
   SECTION 3: FORM CONTROLS
   ========================================================================== */

#summary-sharder-panel input[type="text"],
#summary-sharder-panel input[type="number"],
#summary-sharder-panel textarea,
#summary-sharder-panel select,
#summary-sharder-settings input[type="text"],
#summary-sharder-settings input[type="number"],
#summary-sharder-settings textarea,
#summary-sharder-settings select,
.ss-modal input[type="text"],
.ss-modal input[type="number"],
.ss-modal textarea,
.ss-modal select {
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    color: var(--ss-text-primary);
    border-radius: 4px;
    padding: 6px 10px;
    transition: border-color var(--ss-transition);
}

#summary-sharder-panel input:focus,
#summary-sharder-panel textarea:focus,
#summary-sharder-panel select:focus,
#summary-sharder-settings input:focus,
#summary-sharder-settings textarea:focus,
#summary-sharder-settings select:focus,
.ss-modal input:focus,
.ss-modal textarea:focus,
.ss-modal select:focus {
    border-color: var(--ss-border-focus);
    outline: none;
}

#summary-sharder-settings .checkbox_label,
#summary-sharder-panel .checkbox_label,
.ss-modal .checkbox_label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: var(--ss-text-primary);
}

#summary-sharder-settings .checkbox_label input[type="checkbox"],
#summary-sharder-panel .checkbox_label input[type="checkbox"],
.ss-modal .checkbox_label input[type="checkbox"] {
    accent-color: var(--ss-primary);
}

/* Horizontal Rules */
#summary-sharder-settings .sysHR,
#summary-sharder-panel .sysHR,
.ss-modal .sysHR {
    border: none;
    border-top: 1px solid var(--ss-border);
    margin: 15px 0;
}

/* ==========================================================================
   SECTION 4: BUTTONS
   ========================================================================== */

#summary-sharder-panel .menu_button,
.ss-modal .menu_button,
body:not(.ss-theme-default) #summary-sharder-settings .menu_button {
    background: var(--ss-bg-secondary);
    border: 1px solid var(--ss-border);
    color: var(--ss-text-primary);
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all var(--ss-transition);
}

#summary-sharder-panel .menu_button:hover,
.ss-modal .menu_button:hover,
body:not(.ss-theme-default) #summary-sharder-settings .menu_button:hover {
    border-color: var(--ss-primary);
    color: var(--ss-primary);
    background: var(--ss-highlight);
}

#summary-sharder-panel .menu_button:active,
.ss-modal .menu_button:active,
body:not(.ss-theme-default) #summary-sharder-settings .menu_button:active {
    background: var(--ss-primary-active);
    color: white;
}

#summary-sharder-panel .menu_button:disabled,
.ss-modal .menu_button:disabled,
body:not(.ss-theme-default) #summary-sharder-settings .menu_button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

@media (max-width: 680px) {
    #summary-sharder-settings .ss-action-bar-primary,
    #summary-sharder-settings .ss-buttons {
        grid-template-columns: 1fr;
    }

    #summary-sharder-settings .ss-settings-accordion.expanded .ss-accordion-content {
        max-height: none;
        overflow-y: visible;
    }
}
`;
