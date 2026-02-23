export const COMPONENTS_CSS = `
/* ==========================================================================
   SECTION 8: SHARED UI COMPONENTS
   ========================================================================== */

.ss-segmented-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border-radius: 4px;
    overflow: hidden;
    background: var(--ss-bg-secondary);
}

.ss-segmented-toggle button {
    appearance: none;
    background: var(--ss-bg-secondary);
    background-color: var(--ss-bg-secondary);
    background-image: none;
    border: 1px solid var(--ss-border);
    color: var(--ss-text-secondary);
    padding: 6px 12px;
    margin: 0 0 0 -1px;
    min-height: 32px;
    cursor: pointer;
    transition: background var(--ss-transition), color var(--ss-transition), border-color var(--ss-transition);
    line-height: 1.2;
    font: inherit;
    text-transform: none;
    text-decoration: none;
    vertical-align: middle;
    box-shadow: none;
}

.ss-segmented-toggle button:first-child {
    margin-left: 0;
}

.ss-segmented-toggle button:hover {
    border-color: var(--ss-primary);
    color: var(--ss-primary);
    background: var(--ss-highlight);
}

.ss-segmented-toggle button.active {
    background: var(--ss-highlight);
    background-color: var(--ss-highlight);
    color: var(--ss-primary);
    font-weight: 600;
    position: relative;
    z-index: 1;
}

.ss-segmented-toggle button:disabled {
    opacity: 0.6;
    color: var(--ss-text-muted);
    cursor: not-allowed;
}

[class*="ss-"][class*="-modal"] .ss-segmented-toggle button,
.popup:has([class*="ss-"][class*="-modal"]) .ss-segmented-toggle button {
    appearance: none !important;
    padding: 6px 12px !important;
    margin: 0 0 0 -1px !important;
    min-height: 32px !important;
    background: var(--ss-bg-secondary) !important;
    background-color: var(--ss-bg-secondary) !important;
    background-image: none !important;
    color: var(--ss-text-secondary) !important;
    border: 1px solid var(--ss-border) !important;
    border-color: var(--ss-border) !important;
    font: inherit !important;
    line-height: 1.2 !important;
    text-transform: none !important;
    text-decoration: none !important;
    outline: none !important;
    box-shadow: none !important;
}

[class*="ss-"][class*="-modal"] .ss-segmented-toggle button:first-child,
.popup:has([class*="ss-"][class*="-modal"]) .ss-segmented-toggle button:first-child {
    margin-left: 0 !important;
}

[class*="ss-"][class*="-modal"] .ss-segmented-toggle button:hover:not(:disabled),
.popup:has([class*="ss-"][class*="-modal"]) .ss-segmented-toggle button:hover:not(:disabled) {
    background: var(--ss-highlight) !important;
    color: var(--ss-primary) !important;
}

[class*="ss-"][class*="-modal"] .ss-segmented-toggle button.active,
.popup:has([class*="ss-"][class*="-modal"]) .ss-segmented-toggle button.active {
    background: var(--ss-highlight) !important;
    background-color: var(--ss-highlight) !important;
    color: var(--ss-primary) !important;
    font-weight: 600 !important;
    position: relative !important;
    z-index: 1 !important;
}

.ss-segmented-toggle button:focus-visible {
    outline: 1px solid var(--ss-border-focus);
    outline-offset: -1px;
}

.ss-tag-input {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    width: 100%;
    min-height: 32px;
    box-sizing: border-box;
    padding: 4px;
    border: 1px solid var(--ss-border);
    border-radius: 4px;
    background: var(--ss-bg-input);
    cursor: text;
}

.ss-tag-input:focus-within {
    border-color: var(--ss-border-focus);
    box-shadow: 0 0 0 1px var(--ss-focus-glow);
}

.ss-tag-container {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
}

.ss-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    padding: 2px 8px;
    border-radius: 3px;
    background:
        linear-gradient(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.08)),
        var(--ss-bg-secondary);
    border: 1px solid var(--ss-border);
    color: var(--ss-text-secondary);
    font-size: 12px;
    line-height: 1.2;
    text-shadow: none;
}

.ss-tag-remove {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    background: transparent;
    background-image: none;
    box-shadow: none;
    filter: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.6;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    min-width: 14px;
    margin: 0;
    font-size: 12px;
    line-height: 1;
    padding: 0;
    font-family: inherit;
    text-shadow: none;
    text-transform: none;
    text-decoration: none;
}

.ss-tag-remove:hover {
    opacity: 1;
}

.ss-tag-input .ss-tag-input-field,
.ss-tag-input input {
    appearance: none;
    -webkit-appearance: none;
    border: none;
    outline: none;
    background: transparent;
    background-image: none;
    box-shadow: none;
    filter: none;
    color: var(--ss-text-primary);
    flex: 1;
    min-width: 60px;
    min-height: 24px;
    margin: 0;
    padding: 0 2px;
}

.ss-tag-input .ss-tag-input-field::placeholder,
.ss-tag-input input::placeholder {
    color: var(--ss-text-muted);
}

.ss-range-pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    column-gap: 8px;
    width: 100%;
}

.ss-range-slider {
    width: 100%;
    min-width: 0;
    color: var(--ss-border);
}

.ss-range-number {
    width: 6ch;
    min-width: 6ch;
    text-align: right;
}

.ss-range-unit {
    color: var(--ss-text-secondary);
    white-space: nowrap;
}

.ss-disabled-section {
    opacity: 0.5;
    pointer-events: none;
}
`;
