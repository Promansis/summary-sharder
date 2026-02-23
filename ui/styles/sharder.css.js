export const SHARDER_CSS = `

/* ==========================================================================
   SECTION 16: CONSOLIDATION MODAL
   ========================================================================== */

.ss-consolidation-modal {
    padding: 15px;
}

.ss-consolidation-header h3 {
    margin-top: 0;
    margin-bottom: 5px;
    color: var(--ss-text-primary);
}

.ss-consolidation-header p {
    color: var(--ss-text-secondary);
    font-size: 13px;
    margin: 0 0 10px 0;
}

#ss-consolidation-count {
    font-weight: bold;
    color: var(--ss-quote);
    margin-bottom: 15px;
}

.ss-consolidation-controls {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
    flex-wrap: wrap;
}

.ss-consolidation-lorebook-section {
    margin-bottom: 15px;
    padding: 10px;
    background: var(--ss-bg-secondary);
    border-radius: 5px;
    border: 1px solid var(--ss-border);
}

.ss-consolidation-lorebook-section .checkbox_label {
    margin-bottom: 5px;
}

/* Extraction List */
.ss-extraction-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    padding: 10px;
    background: var(--ss-bg-secondary);
}

.ss-extraction-item {
    padding: 12px;
    margin-bottom: 10px;
    background: var(--ss-bg-tertiary);
    border-radius: 4px;
    border-left: 3px solid var(--ss-text-muted);
    cursor: pointer;
    transition: border-color 0.2s ease, background 0.2s ease;
}

.ss-extraction-item:last-child {
    margin-bottom: 0;
}

.ss-extraction-item:hover {
    background: var(--ss-bg-secondary);
}

.ss-extraction-item.selected {
    border-left-color: var(--ss-success);
}

.ss-extraction-item-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.ss-extraction-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
    flex-shrink: 0;
}

.ss-extraction-source {
    font-size: 11px;
    padding: 2px 6px;
    background: var(--ss-quote);
    border-radius: 3px;
    color: var(--ss-text-primary);
}

.ss-extraction-type-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.ss-extraction-type-badge.extraction {
    background: var(--ss-info);
    color: white;
}

.ss-extraction-type-badge.consolidated {
    background: var(--ss-consolidation);
    color: white;
}

.ss-extraction-item.is-consolidation {
    border-left-color: var(--ss-consolidation);
}

.ss-extraction-item.is-consolidation.selected {
    border-left-color: var(--ss-rescue-bg-hover);
}

.ss-extraction-identifier {
    font-weight: bold;
    color: var(--ss-text-primary);
    flex: 1;
}

.ss-extraction-preview {
    font-size: 12px;
    color: var(--ss-text-secondary);
    line-height: 1.4;
    padding-left: 28px;
}

.ss-group-toggle-icon {
    font-size: 12px;
    transition: transform 0.2s;
    min-width: 16px;
}

.ss-group-toggle-icon.collapsed {
    transform: rotate(-90deg);
}

.ss-group-checkbox {
    margin: 0;
    cursor: pointer;
}

.ss-group-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.ss-group-consolidation-name {
    font-weight: bold;
    color: var(--ss-consolidation);
    font-size: 13px;
}

.ss-group-item-count {
    font-size: 11px;
    opacity: 0.7;
}

.ss-group-status-badge {
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 500;
}

.ss-group-status-badge.exists {
    background: #27ae60;
    color: white;
}

.ss-group-status-badge.missing {
    background: var(--ss-error);
    color: white;
}

.ss-extraction-item.grouped {
    margin-left: 15px;
    border-left: 3px solid var(--ss-consolidation);
    background: rgba(156, 39, 176, 0.03);
}

.ss-group-member-badge {
    display: inline-block;
    background: rgba(156, 39, 176, 0.2);
    color: var(--ss-consolidation);
    font-size: 9px;
    padding: 2px 5px;
    border-radius: 2px;
    margin-left: 5px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.ss-group-ungroup-btn {
    margin-left: auto;
    padding: 2px 8px;
    font-size: 10px;
    background: rgba(156, 39, 176, 0.1);
    color: var(--ss-consolidation);
    border: 1px solid rgba(156, 39, 176, 0.3);
    border-radius: 3px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: background 0.2s, border-color 0.2s;
}

.ss-group-ungroup-btn:hover {
    background: rgba(156, 39, 176, 0.2);
    border-color: rgba(156, 39, 176, 0.5);
}

`;

