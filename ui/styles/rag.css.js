export const RAG_CSS = `
/* =====================================================================
   RAG SETTINGS MODAL
   ===================================================================== */

.ss-rag-modal {
    padding: 14px;
    max-height: 76vh;
    overflow-y: auto;
    overflow-x: visible;
}

.ss-rag-title {
    margin: 0 0 12px 0;
    color: var(--ss-text-primary);
}

.ss-rag-master-toggle {
    margin-bottom: 12px;
    padding: 8px 10px;
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-secondary);
}

.ss-rag-mode-badge {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: normal;
    vertical-align: middle;
    border: 1px solid var(--ss-border);
    background: var(--ss-bg-secondary);
    color: var(--ss-text-primary);
}

.ss-rag-mode-sharder {
    background: color-mix(in srgb, var(--ss-primary) 18%, transparent);
    color: color-mix(in srgb, var(--ss-primary) 72%, var(--ss-text-primary));
    border-color: color-mix(in srgb, var(--ss-primary) 42%, transparent);
}

.ss-rag-mode-standard {
    background: color-mix(in srgb, var(--ss-quote) 18%, transparent);
    color: color-mix(in srgb, var(--ss-quote) 72%, var(--ss-text-primary));
    border-color: color-mix(in srgb, var(--ss-quote) 42%, transparent);
}

.ss-rag-status-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px;
    margin-bottom: 10px;
}

.ss-rag-status-actions {
    margin-bottom: 12px;
}

.ss-rag-status-item {
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-secondary);
    padding: 8px;
}

.ss-rag-status-label {
    font-size: 11px;
    color: var(--ss-text-muted);
    margin-bottom: 3px;
}

.ss-rag-status-value {
    font-size: 12px;
    color: var(--ss-text-primary);
    word-break: break-word;
}

.ss-rag-warning {
    margin-bottom: 12px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--ss-warning) 55%, transparent);
    background: color-mix(in srgb, var(--ss-warning) 15%, transparent);
    color: var(--ss-text-primary);
    font-size: 12px;
}

.ss-rag-accordion {
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: visible;
    z-index: 0;
}

.ss-rag-accordion .ss-accordion-header {
    border-radius: 8px;
}

.ss-rag-accordion.expanded .ss-accordion-header {
    border-radius: 8px 8px 0 0;
}

.ss-rag-accordion .ss-accordion-content {
    max-height: none;
    overflow-y: visible;
    padding: 10px;
    z-index: 1001;
    position: relative;
}

.ss-rag-accordion[data-rag-section="backend"] .ss-accordion-content {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    align-items: start;
}

.ss-rag-accordion[data-rag-section="backend"] .ss-accordion-content > .ss-rag-subsection-title,
.ss-rag-accordion[data-rag-section="backend"] .ss-accordion-content > .ss-rag-vectorization-grid {
    grid-column: 1 / -1;
}

.ss-rag-backend-left,
.ss-rag-backend-right {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ss-rag-subsection {
    margin-top: 0px;
    padding-top: 0px;
}

.ss-rag-subsection-title {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: var(--ss-text-primary);
}

.ss-rag-vectorization-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    align-items: start;
}

.ss-rag-vectorization-grid .ss-rag-stats {
    grid-column: 1 / -1;
}

#ss-rag-reranker-config {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    align-items: start;
}

#ss-rag-qdrant-local,
#ss-rag-qdrant-cloud {
    margin-top: 1px;
}

.ss-rag-grid-two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px;
}

.ss-rag-actions-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}

.ss-rag-actions-row-tight {
    margin-top: 6px;
}

.ss-rag-actions-row .menu_button {
    flex: 1;
    min-width: 170px;
}

.ss-rag-actions-primary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
}

.ss-rag-actions-primary .menu_button {
    width: 100%;
    min-width: 0;
}

.ss-rag-actions-secondary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    opacity: 0.85;
}

.ss-rag-actions-secondary .menu_button {
    font-size: 12px;
    min-width: 150px;
}

.ss-rag-btn-destructive {
    border-color: color-mix(in srgb, var(--ss-error) 60%, var(--ss-border));
    color: color-mix(in srgb, var(--ss-error) 70%, var(--ss-text-primary));
}

#ss-rag-browser-delete-btn {
    background-color: var(--ss-stop-bg) !important;
    border-color: var(--ss-stop-bg) !important;
    color: white !important;
}

#ss-rag-browser-delete-btn:hover {
    opacity: 0.85;
}

.ss-rag-sublabel {
    display: block;
    margin: -2px 0 4px 0;
    font-size: 11px;
    color: var(--ss-text-muted);
}

.ss-rag-template {
    min-height: 100px;
    resize: vertical;
}

.ss-rag-stats {
    margin-top: 8px;
    color: var(--ss-text-secondary);
    font-size: 12px;
}

.ss-rag-inline-hint {
    margin: 4px 0 0 0;
}

.ss-rag-hybrid-weighted-hint {
    margin-top: 6px;
}

.ss-rag-weighted-scale {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: var(--ss-text-muted);
    margin-bottom: 6px;
}

.ss-rag-weighted-label strong {
    color: var(--ss-text-primary);
    font-weight: 600;
    margin-left: 4px;
}

#ss-rag-weighted-slider-wrap .ss-range-pair {
    grid-template-columns: minmax(0, 1fr);
}

#ss-rag-weighted-slider-wrap {
    grid-column: 1 / -1;
}

#ss-rag-weighted-slider-wrap .ss-range-number,
#ss-rag-weighted-slider-wrap .ss-range-unit {
    display: none;
}

.ss-rag-vectorization-lorebook-options {
    margin-top: 8px;
    position: relative;
    z-index: 1001;
}

#ss-rag-reranker-mode-host,
#ss-rag-chunking-mode-host,
#ss-rag-prose-chunking-mode-host,
#ss-rag-hybrid-fusion-host,
#ss-rag-threshold-host,
#ss-rag-scene-max-host {
    width: 100%;
}

#ss-rag-reranker-mode-host .ss-segmented-toggle,
#ss-rag-chunking-mode-host .ss-segmented-toggle,
#ss-rag-prose-chunking-mode-host .ss-segmented-toggle,
#ss-rag-hybrid-fusion-host .ss-segmented-toggle {
    width: 100%;
}

.ss-rag-modal .ss-range-pair {
    width: 100%;
}

#ss-rag-embedding-test-status {
    margin-top: 6px;
}

#ss-rag-reranker-test-status {
    margin-top: 4px;
}

.ss-rag-scene-mode-hint {
    margin-top: 8px;
}

@media (max-width: 600px) {
    .ss-rag-accordion[data-rag-section="backend"] .ss-accordion-content {
        grid-template-columns: 1fr;
    }

    #ss-rag-reranker-config {
        grid-template-columns: 1fr;
    }

    #ss-rag-clear-embedding-key {
        min-width: 140px;
        max-width: 100%;
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

/* =====================================================================
   RAG BROWSER MODAL
   ===================================================================== */

.ss-rag-browser-modal {
    max-height: 80vh;
}

.ss-rag-backend-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
}

.ss-rag-backend-toggle {
    padding: 3px 10px;
    font-size: 11px;
    border-radius: 12px;
    border: 1px solid var(--ss-border);
    background: var(--ss-bg-secondary);
    color: var(--ss-text-muted);
    cursor: pointer;
}

.ss-rag-backend-toggle.active {
    background: color-mix(in srgb, var(--ss-primary) 20%, var(--ss-bg-secondary));
    border-color: color-mix(in srgb, var(--ss-primary) 50%, var(--ss-border));
    color: var(--ss-text-primary);
}

.ss-rag-collection-dropdown {
    position: relative;
    width: 100%;
}

.ss-rag-collection-dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-secondary);
    color: var(--ss-text-primary);
    cursor: pointer;
    font-size: 13px;
    min-height: 34px;
    user-select: none;
}

.ss-rag-collection-dropdown-trigger:hover {
    border-color: var(--ss-primary);
}

.ss-rag-collection-dropdown-trigger[aria-expanded="true"] {
    border-color: var(--ss-primary);
    border-radius: 6px 6px 0 0;
}

.ss-rag-collection-dropdown-arrow {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--ss-text-muted);
}

.ss-rag-collection-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 1100;
    border: 1px solid var(--ss-primary);
    border-top: none;
    border-radius: 0 0 6px 6px;
    background: var(--ss-bg-secondary);
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
}

.ss-rag-collection-dropdown-search-wrap {
    padding: 6px;
    border-bottom: 1px solid var(--ss-border);
}

.ss-rag-collection-dropdown-search-wrap input {
    width: 100%;
}

.ss-rag-collection-dropdown-options {
    max-height: 220px;
    overflow-y: auto;
}

.ss-rag-collection-dropdown-item {
    padding: 7px 10px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-bottom: 1px solid var(--ss-border);
}

.ss-rag-collection-dropdown-item:last-child {
    border-bottom: none;
}

.ss-rag-collection-dropdown-item:hover {
    background: color-mix(in srgb, var(--ss-primary) 12%, var(--ss-bg-secondary));
}

.ss-rag-collection-dropdown-item.selected {
    background: color-mix(in srgb, var(--ss-primary) 18%, var(--ss-bg-secondary));
}

.ss-rag-collection-item-id {
    font-size: 12px;
    color: var(--ss-text-primary);
    word-break: break-all;
}

.ss-rag-collection-item-meta {
    font-size: 11px;
    color: var(--ss-text-muted);
}

.ss-rag-collection-dropdown-empty {
    padding: 12px 10px;
    text-align: center;
    font-size: 12px;
    color: var(--ss-text-muted);
}

.ss-rag-browser-chat-selector-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.ss-rag-browser-chat-selector-row select {
    flex: 1;
    min-width: 0;
}

.ss-rag-browser-chat-selector-row .menu_button {
    flex-shrink: 0;
    white-space: nowrap;
}

.ss-rag-browser-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px;
}

.ss-rag-browser-stat-card {
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-primary);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.ss-rag-stat-info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
    font-size: 12px;
}

.ss-rag-stat-row {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
}

.ss-rag-stat-info-label {
    color: var(--ss-text-muted);
}

.ss-rag-stat-info-value {
    color: var(--ss-text-primary);
    word-break: break-all;
}

.ss-rag-browser-action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
}

.ss-rag-browser-action-row .menu_button {
    flex: 1;
    min-width: 100px;
    font-size: 11px;
    padding: 4px 8px;
}

.ss-rag-browser-items,
.ss-rag-browser-scene-groups,
.ss-rag-browser-query-results {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
}

.ss-rag-browser-item,
.ss-rag-browser-scene-group {
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-primary);
    padding: 6px 8px;
}

.ss-rag-browser-item summary {
    cursor: pointer;
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    gap: 10px;
    align-items: center;
    color: var(--ss-text-primary);
}

.ss-rag-browser-item-toggle {
    cursor: pointer;
    accent-color: var(--ss-primary);
}

.ss-rag-browser-item.disabled summary {
    opacity: 0.5;
}

.ss-rag-browser-scene-group-row {
    cursor: pointer;
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 10px;
    align-items: center;
    color: var(--ss-text-primary);
}

.ss-rag-browser-item summary > *,
.ss-rag-browser-scene-group-row > * {
    min-width: 0;
}

.ss-rag-browser-item-index,
.ss-rag-browser-scene-code {
    font-weight: 700;
    color: var(--ss-primary);
}

.ss-rag-browser-item-score,
.ss-rag-browser-scene-range,
.ss-rag-browser-scene-count {
    font-size: 12px;
    color: var(--ss-text-muted);
}

.ss-rag-browser-scene-groups {
    max-height: none;
    overflow-y: visible;
}

.ss-rag-browser-scene-group-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ss-rag-browser-scene-group {
    display: block;
    width: 100%;
    text-align: left;
}

.ss-rag-browser-scene-group.selected {
    border-color: var(--ss-primary);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ss-primary) 30%, transparent);
}

.ss-rag-browser-scene-group-detail {
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: color-mix(in srgb, var(--ss-bg-primary) 75%, var(--ss-bg-secondary));
    padding: 8px;
}

.ss-rag-browser-scene-group-detail-header {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    margin-bottom: 8px;
}

.ss-rag-browser-scene-group-detail-body {
    max-height: 280px;
    overflow-y: auto;
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-primary);
    padding: 8px;
}

.ss-rag-browser-item-preview {
    color: var(--ss-text-secondary);
    overflow-wrap: anywhere;
}

.ss-rag-browser-item-actions {
    display: flex;
    gap: 6px;
    justify-self: end;
}

.ss-rag-browser-item-actions .menu_button {
    padding: 2px 8px;
    font-size: 11px;
    min-width: 0;
}

.ss-rag-browser-item-body {
    margin-top: 8px;
    display: grid;
    gap: 8px;
}

.ss-rag-browser-text,
.ss-rag-browser-meta {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
    line-height: 1.4;
    background: var(--ss-bg-secondary);
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    padding: 8px;
    max-height: 180px;
    overflow: auto;
}

.ss-rag-browser-scene-items {
    margin: 8px 0 0 0;
    padding-left: 18px;
    color: var(--ss-text-secondary);
}

.ss-rag-browser-query-panel ul {
    margin: 0;
    padding-left: 18px;
}

.ss-rag-browser-query-list li {
    margin-bottom: 8px;
}

.ss-weighted-tag-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.ss-weighted-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border: 1px solid var(--ss-border);
    border-radius: 12px;
    background: var(--ss-bg-secondary);
    font-size: 12px;
}

.ss-weighted-tag-weight {
    width: 42px;
    padding: 1px 4px;
    font-size: 11px;
    text-align: center;
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    background: var(--ss-bg-primary);
}

.ss-weighted-tag-remove {
    cursor: pointer;
    background: none;
    border: none;
    color: var(--ss-text-muted);
    font-size: 12px;
    padding: 0 2px;
}

/* =====================================================================
   COLLECTION MANAGER MODAL
   ===================================================================== */

.ss-collection-manager-modal {
    padding: 14px;
    min-width: 440px;
    max-height: 76vh;
    overflow-y: auto;
}

.ss-cm-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--ss-border);
    padding-bottom: 6px;
}

.ss-cm-tab {
    padding: 5px 14px;
    font-size: 12px;
    border-radius: 5px 5px 0 0;
    border: 1px solid transparent;
    border-bottom: none;
    background: transparent;
    color: var(--ss-text-muted);
    cursor: pointer;
}

.ss-cm-tab.active {
    background: color-mix(in srgb, var(--ss-primary) 15%, var(--ss-bg-secondary));
    border-color: var(--ss-border);
    color: var(--ss-text-primary);
}

.ss-cm-panel {
    display: none;
}

.ss-cm-panel.active {
    display: block;
}

.ss-cm-context-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.ss-cm-context-avatar {
    width: 28px;
    height: 28px;
    border-radius: 4px;
    object-fit: cover;
    flex-shrink: 0;
}

.ss-cm-chat-icon {
    color: var(--ss-primary);
    font-size: 18px;
}

.ss-cm-context-name {
    font-weight: 600;
    color: var(--ss-text-primary);
    font-size: 13px;
    word-break: break-all;
}


.ss-cm-list-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--ss-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
}

.ss-cm-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
    min-height: 32px;
}

.ss-cm-empty {
    padding: 10px;
    font-size: 12px;
    color: var(--ss-text-muted);
    border: 1px dashed var(--ss-border);
    border-radius: 6px;
    text-align: center;
}

.ss-cm-row {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-primary);
}

.ss-cm-primary-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--ss-text-muted);
    cursor: pointer;
    white-space: nowrap;
}

.ss-cm-primary-radio {
    accent-color: var(--ss-primary);
}

.ss-cm-row-id {
    font-size: 12px;
    color: var(--ss-text-primary);
    word-break: break-all;
    min-width: 0;
}

.ss-cm-row-chunks {
    font-size: 11px;
    color: var(--ss-text-muted);
    white-space: nowrap;
}

.ss-cm-row-remove {
    padding: 1px 7px !important;
    font-size: 13px !important;
    min-width: 0 !important;
    flex-shrink: 0;
    color: var(--ss-text-muted);
}

.ss-cm-add-row {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 8px;
}

.ss-cm-add-select {
    flex: 1;
    min-width: 0;
    font-size: 12px;
}

.ss-cm-add-row .menu_button {
    flex-shrink: 0;
    white-space: nowrap;
}

.ss-cm-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 10px;
    margin-bottom: 4px;
}

.ss-cm-section-header .ss-cm-list-label {
    margin: 0;
}

.ss-cm-section-icon {
    font-size: 11px;
    margin-right: 4px;
    opacity: 0.7;
}

.ss-cm-copy-btn {
    font-size: 11px !important;
    padding: 2px 8px !important;
    min-width: 0 !important;
    opacity: 0.8;
    white-space: nowrap;
}

.ss-cm-inherited-section {
    margin-bottom: 6px;
}

.ss-cm-inherited-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 4px;
    min-height: 28px;
}

.ss-cm-inherited-row {
    opacity: 0.55;
    pointer-events: none;
    grid-template-columns: auto 1fr auto;
    cursor: default;
    border-style: dashed;
}

.ss-cm-inherited-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--ss-text-muted) 18%, transparent);
    color: var(--ss-text-muted);
    border: 1px solid color-mix(in srgb, var(--ss-text-muted) 30%, transparent);
    white-space: nowrap;
    flex-shrink: 0;
}

.ss-cm-inherited-primary-badge {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--ss-primary) 12%, transparent);
    color: color-mix(in srgb, var(--ss-primary) 60%, var(--ss-text-muted));
    border: 1px solid color-mix(in srgb, var(--ss-primary) 25%, transparent);
    margin-left: 4px;
}

.ss-cm-inherited-hint {
    margin-top: 2px;
    font-size: 11px;
}

.ss-cm-footer {
    display: flex;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--ss-border);
    margin-top: 4px;
}

/* =====================================================================
   BRANCH COLLECTION PICKER MODAL
   ===================================================================== */

.ss-branch-picker-modal {
    padding: 14px;
    min-width: 400px;
    max-width: 560px;
    max-height: 76vh;
    overflow-y: auto;
}

.ss-bp-parent-hint {
    margin-bottom: 12px;
}

.ss-bp-parent-name {
    color: var(--ss-text-primary);
    font-weight: 600;
}

.ss-bp-collections-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
}

.ss-bp-collection-row {
    padding: 8px 10px;
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-primary);
}

.ss-bp-row-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    flex-wrap: wrap;
}

.ss-bp-row-id {
    font-size: 12px;
    color: var(--ss-text-primary);
    word-break: break-all;
    flex: 1;
}

.ss-bp-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    white-space: nowrap;
    border: 1px solid var(--ss-border);
    flex-shrink: 0;
}

.ss-bp-badge-own {
    background: color-mix(in srgb, var(--ss-primary) 14%, transparent);
    color: color-mix(in srgb, var(--ss-primary) 70%, var(--ss-text-primary));
    border-color: color-mix(in srgb, var(--ss-primary) 36%, transparent);
}

.ss-bp-row-actions {
    display: flex;
    gap: 16px;
    align-items: center;
}

.ss-bp-action-label {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--ss-text-secondary);
    cursor: pointer;
}

.ss-bp-action-label input[type="radio"] {
    accent-color: var(--ss-primary);
}

.ss-bp-action-hint {
    font-size: 11px;
    color: var(--ss-text-muted);
}

.ss-bp-primary-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
}

.ss-bp-primary-label {
    font-size: 12px;
    color: var(--ss-text-muted);
    white-space: nowrap;
}

.ss-bp-primary-select {
    flex: 1;
    min-width: 0;
    font-size: 12px;
}

.ss-bp-include-own-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--ss-text-secondary);
    cursor: pointer;
    margin-bottom: 12px;
}

.ss-bp-include-own-row input[type="checkbox"] {
    accent-color: var(--ss-primary);
}

.ss-bp-footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding-top: 8px;
    border-top: 1px solid var(--ss-border);
}

.ss-bp-skip-btn {
    opacity: 0.7;
}
`;
