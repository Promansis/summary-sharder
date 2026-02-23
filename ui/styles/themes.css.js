export const THEMES_CSS = `
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
    padding: 0;
    overflow: hidden;
    display: flex;
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
    width: 100%;
    display: flex;
    flex-direction: column;
    min-height: 100%;
    font-family: var(--ss-card-font-primary, inherit);
    font-size: var(--ss-card-size-primary, 1em);
    color: var(--ss-card-text-primary, inherit);
}

/* Keep preview cards isolated from active body theme / extraStyles */
.ss-themes-modal.ss-modal .ss-theme-preview,
.ss-themes-modal.ss-modal .ss-theme-preview * {
    text-shadow: none;
}

.ss-theme-preview-header {
    padding: 6px 10px;
    font-family: var(--ss-card-font-secondary, var(--ss-card-font-primary, inherit));
    font-size: var(--ss-card-size-secondary, 0.85em);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    overflow: hidden;
}

.ss-theme-preview-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
    flex: 1;
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
    flex-shrink: 0;
    white-space: nowrap;
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
    margin-top: 8px;
    margin-bottom: 10px;
}

.ss-theme-info h4 {
    margin: 0 0 4px 0;
    font-family: var(--ss-card-font-primary, inherit);
    font-size: var(--ss-card-size-primary, 1em);
    border: none;
    padding: 0;
    color: var(--ss-card-text-primary, inherit);
}

.ss-theme-info p {
    margin: 0;
    font-family: var(--ss-card-font-muted, var(--ss-card-font-secondary, inherit));
    font-size: var(--ss-card-size-muted, 0.8em);
    color: var(--ss-card-text-muted, var(--ss-text-muted));
}

/* Actions row */
.ss-theme-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
    margin-top: auto;
}

.ss-theme-actions .menu_button {
    padding: 5px 10px;
    font-family: var(--ss-card-font-secondary, var(--ss-card-font-primary, inherit));
    font-size: var(--ss-card-size-secondary, 0.85em);
    min-height: auto;
    line-height: 1.2;
    width: auto;
}

.ss-themes-modal.ss-modal .ss-theme-preview .menu_button {
    background: var(--ss-bg-secondary) !important;
    color: var(--ss-text-primary) !important;
    border: 1px solid var(--ss-border) !important;
    border-radius: 4px !important;
    box-shadow: none !important;
    text-transform: none !important;
    transition: all var(--ss-transition, 0.2s ease) !important;
}

.ss-themes-modal.ss-modal .ss-theme-preview .menu_button:hover:not(:disabled) {
    background: var(--ss-highlight) !important;
    border-color: var(--ss-primary) !important;
    color: var(--ss-primary) !important;
}

.ss-themes-modal.ss-modal .ss-theme-preview .menu_button:active {
    background: var(--ss-primary-active, var(--ss-primary)) !important;
    color: var(--ss-bg-primary) !important;
}

.ss-theme-actions .ss-apply-theme-btn {
    flex: 1 1 auto;
}

.ss-theme-actions .ss-export-theme-btn,
.ss-theme-actions .ss-duplicate-theme-btn,
.ss-theme-actions .ss-delete-theme-btn,
.ss-theme-actions .ss-edit-theme-btn {
    flex: 0 0 auto;
    min-width: 2.1em;
    padding-left: 8px;
    padding-right: 8px;
}

.ss-theme-active-badge {
    background: var(--ss-success);
    color: white;
    padding: 5px 12px;
    border-radius: 4px;
    font-family: var(--ss-card-font-secondary, var(--ss-card-font-primary, inherit));
    font-size: var(--ss-card-size-secondary, 0.85em);
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
.ss-color-editor-modal .ss-bg-primary-controls {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
}

.ss-color-editor-modal .ss-bg-primary-controls select {
    padding: 5px 8px;
    font-size: 0.85em;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
    width: 100%;
    min-width: 0;
}

.ss-color-editor-modal .ss-bg-primary-custom {
    display: flex;
    align-items: center;
    gap: 6px;
}

    /* Color Editor Modal */
.ss-color-editor-modal {
    box-sizing: border-box;
    width: min(900px, calc(100vw - 32px));
    padding: 20px;
    min-width: 550px;
    max-height: 80vh;
    overflow-y: auto;
}

.ss-color-editor-modal .ss-editor-header {
    margin-bottom: 15px;
}

.ss-color-editor-modal .ss-editor-header h3 {
    margin: 0 0 5px 0;
}

.ss-color-editor-modal .ss-editor-header p {
    margin: 0;
    font-size: 0.9em;
    color: var(--ss-text-muted);
}

.ss-color-editor-modal .ss-editor-meta {
    background: var(--ss-bg-secondary);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 15px;
}

.ss-color-editor-modal .ss-meta-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.ss-color-editor-modal .ss-meta-row:last-child {
    margin-bottom: 0;
}

.ss-color-editor-modal .ss-meta-row label {
    width: 120px;
    font-weight: 500;
    flex-shrink: 0;
}

.ss-color-editor-modal .ss-meta-row input {
    flex: 1;
    padding: 6px 10px;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
}

.ss-color-editor-modal .ss-color-groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
    margin-bottom: 15px;
}

.ss-color-editor-modal .ss-color-group {
    background: var(--ss-bg-secondary);
    border-radius: 6px;
    padding: 12px;
}

.ss-color-editor-modal .ss-color-group h4 {
    margin: 0 0 10px 0;
    font-size: 0.95em;
    color: var(--ss-text-primary);
    border-bottom: 1px solid var(--ss-border);
    padding-bottom: 6px;
}

.ss-color-editor-modal .ss-color-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    margin-bottom: 8px;
    gap: 8px;
}

.ss-color-editor-modal .ss-color-row:last-child {
    margin-bottom: 0;
}

.ss-color-editor-modal .ss-color-row > label {
    font-size: 0.85em;
    color: var(--ss-text-secondary);
    flex: 1;
    min-width: 80px;
}

.ss-color-editor-modal .ss-color-desc {
    grid-column: 1 / -1;
    font-size: 11px;
    color: var(--ss-text-muted);
    margin: -2px 0 4px;
    line-height: 1.3;
}

.ss-color-editor-modal .ss-color-inputs {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.ss-color-editor-modal .ss-color-row.ss-shadow-row {
    grid-template-columns: 1fr;
    align-items: stretch;
}

.ss-color-editor-modal .ss-shadow-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ss-color-editor-modal .ss-shadow-layer {
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    padding: 8px;
    background: var(--ss-bg-tertiary);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ss-color-editor-modal .ss-shadow-layer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.ss-color-editor-modal .ss-shadow-layer-title {
    font-size: 0.82em;
    font-weight: 600;
    color: var(--ss-text-primary);
}

.ss-color-editor-modal .ss-shadow-inset-toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8em;
    color: var(--ss-text-secondary);
    user-select: none;
}

.ss-color-editor-modal .ss-shadow-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
}

.ss-color-editor-modal .ss-shadow-metric-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.ss-color-editor-modal .ss-shadow-metric-field > span {
    font-size: 0.75em;
    color: var(--ss-text-muted);
    min-width: 0;
}

.ss-color-editor-modal .ss-shadow-metric {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 4px 6px;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
    font-size: 0.82em;
}

.ss-color-editor-modal .ss-shadow-metric:focus {
    border-color: var(--ss-border-focus);
    outline: none;
}

.ss-color-editor-modal .ss-shadow-color-inputs {
    flex-wrap: wrap;
}

.ss-color-editor-modal .ss-shadow-color-text {
    width: 170px;
    min-width: 0;
    padding: 5px 8px;
    font-family: monospace;
    font-size: 0.82em;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
}

.ss-color-editor-modal .ss-shadow-color-text:focus {
    border-color: var(--ss-border-focus);
    outline: none;
}

.ss-color-editor-modal .ss-shadow-raw-row {
    margin-top: 2px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
}

.ss-color-editor-modal .ss-shadow-raw-row .ss-color-inputs {
    width: 100%;
}

.ss-color-editor-modal .ss-shadow-raw-row .ss-color-text {
    width: 100%;
}

.ss-font-suggest {
    position: fixed;
    z-index: 10050;
    max-height: 250px;
    overflow-y: auto;
    background: var(--ss-bg-secondary);
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    box-shadow: var(--ss-shadow-lg);
    padding: 4px;
}

.ss-font-suggest[hidden] {
    display: none;
}

.ss-font-suggest-item {
    display: block;
    width: 100%;
    text-align: left;
    border: 1px solid transparent;
    background: transparent;
    color: var(--ss-text-primary);
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
    line-height: 1.2;
    text-transform: none;
}

.ss-font-suggest-item:hover,
.ss-font-suggest-item.active {
    background: var(--ss-highlight);
    border-color: var(--ss-primary);
    color: var(--ss-primary);
}

.ss-font-suggest-empty {
    padding: 6px 8px;
    color: var(--ss-text-muted);
    font-size: 0.82em;
}

.ss-color-editor-modal .ss-text-row-group {
    padding: 4px 0 10px;
    border-bottom: 1px solid var(--ss-border);
    margin-bottom: 10px;
}

.ss-color-editor-modal .ss-text-row-group:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
}

.ss-color-editor-modal .ss-text-group-title {
    font-size: 0.85em;
    font-weight: 600;
    color: var(--ss-text-primary);
    margin: 0 0 6px 0;
}

.ss-color-editor-modal .ss-typo-font,
.ss-color-editor-modal .ss-typo-size {
    width: 100%;
    padding: 5px 8px;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
}

.ss-color-editor-modal .ss-typo-font:focus,
.ss-color-editor-modal .ss-typo-size:focus {
    border-color: var(--ss-border-focus);
    outline: none;
}

.ss-color-editor-modal .ss-color-picker {
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    cursor: pointer;
    background: transparent;
}

.ss-color-editor-modal .ss-color-picker::-webkit-color-swatch-wrapper {
    padding: 2px;
}

.ss-color-editor-modal .ss-color-picker::-webkit-color-swatch {
    border-radius: 2px;
    border: none;
}

.ss-color-editor-modal .ss-alpha-slider {
    width: 60px;
    height: 6px;
    cursor: pointer;
    accent-color: var(--ss-primary);
}

.ss-color-editor-modal .ss-alpha-label {
    font-size: 0.75em;
    font-family: monospace;
    color: var(--ss-text-muted);
    min-width: 30px;
    text-align: right;
}

.ss-color-editor-modal .ss-color-text {
    width: 140px;
    min-width: 0;
    padding: 5px 8px;
    font-family: monospace;
    font-size: 0.85em;
    background: var(--ss-bg-input);
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    color: var(--ss-text-primary);
}

.ss-color-editor-modal .ss-color-text:focus {
    border-color: var(--ss-border-focus);
    outline: none;
}

.ss-color-editor-modal .ss-editor-extra {
    background: var(--ss-bg-secondary);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 15px;
}

.ss-color-editor-modal .ss-editor-extra h4 {
    margin: 0 0 8px 0;
    font-size: 0.95em;
}

.ss-color-editor-modal .ss-editor-extra textarea {
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

.ss-editor-footer-actions {
    display: flex;
    gap: 10px;
    margin-right: auto;
}

.ss-editor-footer-actions .ss-save-theme-btn {
    background: var(--ss-primary);
    color: white;
    border-color: var(--ss-primary);
}

.ss-editor-footer-actions .ss-save-theme-btn:hover {
    background: var(--ss-primary-hover);
}

/* Mobile adjustments */
@media (max-width: 768px) {
    .popup:has(.ss-color-editor-modal).wide_dialogue_popup {
        box-sizing: border-box;
        min-width: 0 !important;
        width: calc(100dvw - 12px) !important;
        max-width: calc(100dvw - 12px) !important;
    }

    .popup:has(.ss-color-editor-modal) .popup-content {
        padding: 0 4px;
    }

    .popup:has(.ss-color-editor-modal) .popup-controls {
        width: 100%;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
    }

    .ss-color-editor-modal {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        max-height: calc(100vh - 24px);
        padding: 15px;
    }

    .ss-color-editor-modal .ss-color-groups {
        grid-template-columns: 1fr;
    }

    .ss-color-editor-modal .ss-color-row {
        grid-template-columns: 1fr;
        align-items: flex-start;
    }

    .ss-color-editor-modal .ss-color-inputs {
        width: 100%;
        flex-wrap: wrap;
    }

    .ss-color-editor-modal .ss-color-text {
        flex: 1 1 120px;
        width: 100%;
    }

    .ss-color-editor-modal .ss-shadow-metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ss-color-editor-modal .ss-shadow-color-text {
        flex: 1 1 140px;
        width: 100%;
    }

    .ss-font-suggest {
        max-width: calc(100vw - 16px);
        max-height: 40vh;
    }

    .ss-font-suggest-item {
        padding: 8px 10px;
    }

    .ss-color-editor-modal .ss-bg-primary-custom {
        width: 100%;
        flex-wrap: wrap;
    }

    .ss-color-editor-modal .ss-typo-font,
    .ss-color-editor-modal .ss-typo-size {
        width: 100%;
    }

    .ss-editor-footer-actions {
        flex-direction: column;
    }

    .ss-editor-footer-actions .menu_button {
        width: 100%;
    }

    .ss-color-editor-modal .ss-meta-row {
        flex-direction: column;
        align-items: flex-start;
    }

    .ss-color-editor-modal .ss-meta-row label {
        width: auto;
    }

    .ss-color-editor-modal .ss-meta-row input {
        width: 100%;
    }
}
`;
