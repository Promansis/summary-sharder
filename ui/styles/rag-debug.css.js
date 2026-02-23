export const RAG_DEBUG_CSS = `
.ss-rag-debug-modal {
    max-height: 82vh;
}

.ss-rag-debug-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
}

.ss-rag-debug-tab {
    border: 1px solid var(--ss-border);
    background: var(--ss-bg-secondary);
    color: var(--ss-text-secondary);
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
}

.ss-rag-debug-tab.active {
    color: var(--ss-text-primary);
    border-color: var(--ss-primary);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ss-primary) 30%, transparent);
}

.ss-rag-debug-tab-panel {
    display: none;
}

.ss-rag-debug-tab-panel.active {
    display: block;
}

.ss-rag-debug-health-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 8px;
}

.ss-rag-debug-health-card {
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-primary);
    padding: 10px;
}

.ss-rag-debug-health-card.ok {
    border-color: color-mix(in srgb, var(--ss-success) 40%, var(--ss-border));
}

.ss-rag-debug-health-card.warn {
    border-color: color-mix(in srgb, var(--ss-warning) 45%, var(--ss-border));
}

.ss-rag-debug-health-card.error {
    border-color: color-mix(in srgb, var(--ss-error) 45%, var(--ss-border));
}

.ss-rag-debug-health-title {
    color: var(--ss-text-primary);
    font-weight: 700;
}

.ss-rag-debug-health-state {
    color: var(--ss-text-secondary);
    font-size: 12px;
    margin-top: 4px;
}

.ss-rag-debug-health-meta {
    color: var(--ss-text-muted);
    font-size: 11px;
    margin-top: 6px;
}

.ss-rag-debug-block {
    margin-top: 8px;
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-primary);
    padding: 8px;
}

.ss-rag-debug-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
}

.ss-rag-debug-item {
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-primary);
    padding: 6px 8px;
}

.ss-rag-debug-item summary {
    cursor: pointer;
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    gap: 10px;
    align-items: center;
}

.ss-rag-debug-item summary > * {
    min-width: 0;
}

.ss-rag-debug-item-snippet {
    overflow-wrap: anywhere;
}

.ss-rag-debug-item-snippet.no-score {
    grid-column: 2 / -1;
}

.ss-rag-debug-item .badge {
    color: var(--ss-primary);
    font-weight: 700;
}

.ss-rag-debug-item-body {
    margin-top: 8px;
    display: grid;
    gap: 8px;
}

.ss-rag-debug-item-body pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
    line-height: 1.4;
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-secondary);
    padding: 8px;
    max-height: 240px;
    overflow: auto;
}

.ss-rag-debug-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.ss-rag-debug-stage {
    border: 1px solid var(--ss-border);
    border-radius: 6px;
    background: var(--ss-bg-primary);
    padding: 6px 8px;
}

.ss-rag-debug-stage summary {
    cursor: pointer;
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 8px;
    align-items: center;
}

.ss-rag-debug-stage summary > * {
    min-width: 0;
}

.ss-rag-debug-stage summary > span:nth-child(2),
.ss-rag-debug-stage summary > span:nth-child(4) {
    overflow-wrap: anywhere;
}

.ss-rag-debug-stage .badge {
    background: color-mix(in srgb, var(--ss-primary) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--ss-primary) 50%, transparent);
    color: var(--ss-primary);
    border-radius: 999px;
    min-width: 20px;
    text-align: center;
    padding: 1px 6px;
}

.ss-rag-debug-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    padding: 4px 0;
    border-bottom: 1px dashed color-mix(in srgb, var(--ss-border) 80%, transparent);
}

.ss-rag-debug-row:last-child {
    border-bottom: none;
}

.ss-rag-debug-score-step {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 4px 10px;
    font-size: 12px;
}

.ss-rag-debug-bar-row {
    display: grid;
    grid-template-columns: 140px 1fr auto;
    gap: 8px;
    align-items: center;
    margin: 4px 0;
}

.ss-rag-debug-bar-row .name,
.ss-rag-debug-bar-row .count {
    font-size: 12px;
    color: var(--ss-text-secondary);
}

.ss-rag-debug-bar-row .bar {
    position: relative;
    height: 10px;
    background: color-mix(in srgb, var(--ss-bg-secondary) 85%, transparent);
    border: 1px solid var(--ss-border);
    border-radius: 999px;
    overflow: hidden;
}

.ss-rag-debug-bar-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--ss-primary) 70%, transparent);
    width: 0;
}

.ss-rag-debug-injection-preview {
    margin-top: 8px;
    white-space: pre-wrap;
    word-break: break-word;
    border: 1px solid color-mix(in srgb, var(--ss-primary) 45%, var(--ss-border));
    border-left-width: 4px;
    border-radius: 6px;
    background: var(--ss-bg-primary);
    padding: 10px;
    min-height: 80px;
    max-height: 260px;
    overflow: auto;
}

@media (max-width: 600px) {
    .ss-rag-debug-split {
        grid-template-columns: 1fr;
    }

    .ss-rag-debug-stage summary {
        grid-template-columns: auto 1fr;
    }
}
`;
