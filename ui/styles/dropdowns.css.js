export const DROPDOWNS_CSS = `
/* ==========================================================================
   SECTION 7: DROPDOWN COMPONENTS
   ========================================================================== */

.ss-character-dropdown-container,
.ss-chat-dropdown-container,
.ss-lorebook-dropdown-container,
[class*="ss-"][class*="-dropdown-container"] {
    position: relative;
    width: 100%;
}

.ss-dropdown-trigger {
    background: var(--ss-bg-input) !important;
    color: var(--ss-text-primary) !important;
    border: 1px solid var(--ss-border) !important;
    border-radius: 4px !important;
    padding: 8px 12px !important;
    cursor: pointer;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    min-height: 38px;
    width: 100%;
    box-sizing: border-box;
}

.ss-dropdown-trigger:hover:not(.disabled) {
    border-color: var(--ss-border-focus) !important;
}

.ss-dropdown-trigger.disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--ss-bg-tertiary) !important;
}

.ss-dropdown-selected-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}

.ss-dropdown-menu {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
`;
