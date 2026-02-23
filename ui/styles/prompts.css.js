export const PROMPTS_CSS = `
/* Token Display */
.ss-token-display {
    text-align: right;
    padding: 8px 12px;
    background: var(--ss-bg-secondary);
    border-radius: 4px;
    flex-shrink: 0;
}

.ss-token-count {
    font-size: 18px;
    font-weight: bold;
    color: var(--ss-primary);
}

.ss-token-label {
    font-size: 11px;
    color: var(--ss-text-muted);
    display: block;
}

/* Coverage Summary */
.ss-coverage-summary {
    display: flex;
    gap: 15px;
    margin-bottom: 15px;
    padding: 10px;
    background: var(--ss-bg-secondary);
    border-radius: 4px;
    flex-wrap: wrap;
}

.ss-coverage-stat {
    font-size: 13px;
    color: var(--ss-text-primary);
}

/* Split Panel Layout */
.ss-summary-review-content {
    display: flex;
    gap: 15px;
    margin-bottom: 15px;
    min-height: 300px;
}

.ss-events-panel,
.ss-summary-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    overflow: hidden;
}

.ss-summary-review-modal .ss-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--ss-bg-secondary);
    border-bottom: 1px solid var(--ss-border);
}

.ss-summary-review-modal .ss-panel-header h4 {
    margin: 0;
    font-size: 14px;
    color: var(--ss-text-primary);
}

.ss-event-count {
    font-size: 12px;
    color: var(--ss-text-secondary);
}

/* Events Reference List */
.ss-events-list-readonly {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    background: var(--ss-bg-tertiary);
}

.ss-event-reference-item {
    display: flex;
    gap: 10px;
    padding: 10px;
    margin-bottom: 8px;
    background: var(--ss-bg-secondary);
    border-radius: 4px;
    border-left: 3px solid var(--ss-text-muted);
}

.ss-event-reference-item:last-child {
    margin-bottom: 0;
}

.ss-event-reference-item.ss-coverage-covered {
    border-left-color: var(--ss-success);
}

.ss-event-reference-item.ss-coverage-partial {
    border-left-color: var(--ss-warning);
}

.ss-event-reference-item.ss-coverage-missing {
    border-left-color: var(--ss-error);
}

.ss-event-coverage-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 50px;
}

.ss-coverage-emoji {
    font-size: 20px;
}

.ss-coverage-percent {
    font-size: 11px;
    color: var(--ss-text-secondary);
}

.ss-event-content {
    flex: 1;
    min-width: 0;
}

.ss-event-content .ss-event-summary {
    font-weight: 500;
    color: var(--ss-text-primary);
    margin-bottom: 4px;
}

.ss-event-content .ss-event-description {
    font-size: 12px;
    color: var(--ss-text-secondary);
    line-height: 1.4;
    word-break: break-word;
    min-height: auto;
    padding: 0;
    border: none;
    background: transparent;
    resize: none;
}

/* Summary Panel */
.ss-summary-preview,
.ss-summary-editor {
    flex: 1;
    padding: 10px;
    background: var(--ss-bg-tertiary);
    overflow-y: auto;
}

.ss-summary-preview pre {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: inherit;
    font-size: 13px;
    color: var(--ss-text-primary);
}

.ss-summary-editor {
    width: 100%;
    min-height: 100px;
    font-size: 13px;
    border: none;
    overflow: auto;
    box-sizing: border-box;
    color: var(--ss-text-primary);
}

/* Simplified Mode (Summary Only) */
.ss-summary-review-content-simple {
    margin-bottom: 15px;
    min-height: 300px;
    display: flex;
}

.ss-summary-panel-full {
    flex: 1;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    overflow: hidden;
}

/* Regenerate Section */
.ss-regenerate-section {
    padding: 15px;
    background: var(--ss-bg-secondary);
    border-radius: 4px;
    margin-bottom: 15px;
}

.ss-regenerate-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.ss-regenerate-header h4 {
    margin: 0;
    font-size: 14px;
    color: var(--ss-text-primary);
}

.ss-regenerate-hint {
    font-size: 12px;
    color: var(--ss-text-muted);
}

.ss-regenerate-controls {
    display: flex;
    gap: 10px;
}

.ss-regenerate-controls input[type="text"] {
    flex: 1;
}

/* Archive Section */
.ss-archive-section {
    padding: 15px;
    border-top: 1px solid var(--ss-border);
}

.ss-archive-section h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: var(--ss-text-primary);
}

.ss-archive-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ss-archive-option {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ss-text-primary);
    cursor: pointer;
}

.ss-archive-option.ss-disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.ss-coming-soon {
    font-size: 11px;
    color: var(--ss-primary);
    margin-left: 5px;
}

/* ==========================================================================
   SECTION 19: PROMPTS MODAL TABS
   ========================================================================== */

.ss-prompts-modal {
    padding: 20px;
    min-width: 550px;
    max-width: 100%;
    box-sizing: border-box;
}

.ss-tab-header {
    display: flex;
    gap: 5px;
    margin-bottom: 15px;
    border-bottom: 2px solid var(--ss-border);
    padding-bottom: 10px;
}

.ss-tab-button {
    background: var(--ss-bg-secondary);
    border: 1px solid var(--ss-border);
    border-radius: 6px 6px 0 0;
    padding: 10px 16px;
    cursor: pointer;
    color: var(--ss-text-secondary);
    font-weight: 500;
    transition: all var(--ss-transition);
    position: relative;
}

.ss-tab-button:hover {
    background: var(--ss-highlight);
    color: var(--ss-text-primary);
    border-color: var(--ss-primary);
}

.ss-tab-button.active {
    background: var(--ss-primary);
    color: white;
    border-color: var(--ss-primary);
}

.ss-tab-content {
    min-height: 350px;
}

/* Tab Panel Visibility */
.ss-prompts-modal .ss-tab-panel {
    display: none !important;
}

.ss-prompts-modal .ss-tab-panel.active {
    display: block !important;
}

.ss-api-config-modal .ss-tab-panel {
    display: none !important;
}

.ss-api-config-modal .ss-tab-panel.active {
    display: block !important;
}

/* Tab Content Styling */
.ss-prompts-tab-content,
.ss-sharder-prompts-tab,
.ss-events-prompt-tab {
    padding: 10px 0;
}

.ss-prompts-block {
    margin-bottom: 15px;
}

.ss-prompts-inline-row {
    display: flex;
    align-items: center;
    gap: 5px;
}

.ss-prompts-select {
    flex: 1;
    min-width: 0;
}

.ss-prompts-editor {
    width: 100%;
    height: 250px;
    font-family: monospace;
    font-size: 11px;
    resize: vertical;
}

.ss-prompts-buttons-row {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
}

.ss-prompts-hint {
    font-size: 11px;
    color: var(--ss-text-hint);
    margin-top: 5px;
}

.ss-popup-left-buttons {
    display: flex;
    gap: 5px;
    margin-right: auto;
}

.popup .popup-controls.ss-popup-controls {
    display: flex;
    justify-content: space-between;
    width: 100%;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.ss-prompts-tab-content .ss-block,
.ss-sharder-prompts-tab .ss-block,
.ss-events-prompt-tab .ss-block {
    background: var(--ss-bg-secondary);
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    padding: 12px;
}

.ss-prompts-tab-content label,
.ss-sharder-prompts-tab label,
.ss-events-prompt-tab label {
    display: block;
    margin-bottom: 6px;
    font-weight: 500;
    color: var(--ss-text-primary);
}

.ss-prompts-tab-content textarea,
.ss-sharder-prompts-tab textarea,
.ss-events-prompt-tab textarea {
    background: var(--ss-bg-input) !important;
    color: var(--ss-text-primary) !important;
    border: 1px solid var(--ss-border) !important;
}

.ss-prompts-tab-content textarea:focus,
.ss-sharder-prompts-tab textarea:focus,
.ss-events-prompt-tab textarea:focus {
    border-color: var(--ss-border-focus) !important;
}

/* ==========================================================================
   SECTION 20: CLEAN CONTEXT MODAL
   ========================================================================== */

.ss-clean-context-modal {
    padding: 15px;
    min-width: 450px;
    max-width: 100%;
    box-sizing: border-box;
}

.ss-clean-context-title {
    margin: 0 0 15px 0;
}

.ss-cleanup-toggles {
    margin-bottom: 20px;
}

.ss-cleanup-toggles .ss-block {
    margin-bottom: 5px;
}

.ss-clean-context-hint {
    font-size: 11px;
    color: var(--ss-text-hint);
    margin: 3px 0 8px 25px;
}

.ss-clean-context-custom-section {
    margin-top: 15px;
}

.ss-clean-context-custom-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.ss-clean-context-custom-title {
    margin: 0;
}

.ss-clean-context-regex-list-scroll {
    max-height: 200px;
    overflow-y: auto;
}

.ss-clean-context-regex-empty {
    text-align: center;
    color: var(--ss-text-hint);
    padding: 20px;
}

.ss-clean-context-edit-block {
    margin-bottom: 15px;
}

.ss-clean-context-pattern-input {
    font-family: monospace;
}

.ss-clean-context-edit-hint {
    font-size: 11px;
    color: var(--ss-text-hint);
    margin-top: 5px;
}

/* ==========================================================================
   SECTION 20A: API CONFIG MODAL
   ========================================================================== */

.ss-api-feature-description {
    margin-bottom: 15px;
    color: var(--ss-text-muted);
}

.ss-api-autosave-hint {
    margin: -8px 0 12px 0;
}

.ss-api-mode-selector {
    margin-bottom: 20px;
}

.ss-api-radio-label {
    display: block;
    margin-bottom: 10px;
}

.ss-api-radio-hint {
    margin: 5px 0 0 25px;
    color: var(--ss-text-muted);
    font-size: 0.9em;
}

.ss-external-api-selection {
    margin-left: 25px;
}

.ss-api-select {
    width: 100%;
    max-width: 400px;
}

.ss-api-manage-apis-btn {
    margin-top: 10px;
}

.ss-api-config-divider {
    margin: 20px 0;
}

.ss-api-generation-settings-hint {
    margin-bottom: 15px;
    color: var(--ss-text-muted);
    font-size: 0.9em;
}

.ss-api-setting-row {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
}

.ss-api-setting-col {
    flex: 1;
    min-width: 140px;
}

.ss-api-secondary-setting-row {
    margin-top: 15px;
}

.ss-api-option-column {
    max-width: 300px;
}

.ss-api-message-format-column {
    margin-top: 10px;
}

.ss-api-option-hint {
    margin-top: 5px;
    color: var(--ss-text-muted);
    font-size: 0.85em;
}

/* ==========================================================================
   SECTION 20B: SAVED APIS MODAL
   ========================================================================== */

.ss-saved-api-intro {
    margin-bottom: 20px;
    color: var(--ss-text-muted);
}

.ss-saved-api-selector-section {
    margin-bottom: 20px;
}

.ss-saved-api-selector-label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}

.ss-saved-api-selector {
    width: 100%;
}

.ss-saved-api-actions {
    display: flex;
    gap: 5px;
    margin-top: 10px;
}

.ss-saved-api-divider {
    margin: 20px 0;
}

.ss-saved-api-field {
    margin-bottom: 15px;
}

.ss-saved-api-field-label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
}

.ss-saved-api-input {
    width: 100%;
}

.ss-saved-api-help {
    color: var(--ss-text-muted);
}

.ss-saved-api-model-row {
    display: flex;
    gap: 5px;
    align-items: center;
}

.ss-saved-api-model-select {
    flex: 1;
}

.ss-saved-api-footer-actions {
    display: flex;
    gap: 5px;
    justify-content: flex-end;
    margin-top: 20px;
}

.ss-saved-api-save-btn {
    font-weight: bold;
}

/* ==========================================================================
   SECTION 21: REGEX LIST
   ========================================================================== */

.ss-regex-list {
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    background: var(--ss-bg-secondary);
}

.ss-regex-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    margin: 8px;
    background: var(--ss-bg-tertiary);
    border-radius: 4px;
    border-left: 3px solid var(--ss-quote);
}

.ss-regex-item:last-child {
    margin-bottom: 8px;
}

.ss-regex-left {
    display: flex;
    align-items: center;
}

.ss-regex-toggle {
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.ss-regex-center {
    flex: 1;
    min-width: 0;
}

.ss-regex-name {
    font-weight: 500;
    color: var(--ss-text-primary);
    margin-bottom: 4px;
}

.ss-regex-pattern {
    font-family: monospace;
    font-size: 12px;
    color: var(--ss-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ss-regex-right {
    display: flex;
    gap: 5px;
    flex-shrink: 0;
}

.ss-regex-edit,
.ss-regex-delete {
    padding: 5px 10px;
    font-size: 12px;
}

.ss-regex-empty {
    color: var(--ss-text-primary);
}

/* ==========================================================================
   SECTION 22: PLACEHOLDER MODAL
   ========================================================================== */

.ss-placeholder-modal {
    padding: 30px;
    text-align: center;
    min-width: 300px;
}

.ss-placeholder-modal h3 {
    margin: 0 0 10px 0;
    color: var(--ss-text-primary);
}

.ss-placeholder-modal p {
    color: var(--ss-text-secondary);
    margin: 0;
}
`;
