export const RAG_CSS = `
/* =====================================================================
   RAG SETTINGS MODAL
   ===================================================================== */

.ss-rag-modal {
    padding: 14px;
    max-height: 76vh;
    overflow-y: auto;
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
}

.ss-rag-accordion[data-rag-section="backend"] .ss-accordion-content,
.ss-rag-accordion[data-rag-section="vectorization"] .ss-accordion-content {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    align-items: start;
}

.ss-rag-accordion[data-rag-section="backend"] .ss-accordion-content > .ss-rag-actions-row,
.ss-rag-accordion[data-rag-section="vectorization"] .ss-accordion-content > .ss-rag-actions-row,
.ss-rag-accordion[data-rag-section="vectorization"] .ss-accordion-content > .ss-rag-stats {
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

.ss-rag-vectorization-lorebook-options {
    margin-top: 8px;
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
`;
