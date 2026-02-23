export const API_STATUS_CSS = `
/* ==========================================================================
   SECTION 27: API STATUS DISPLAY
   ========================================================================== */

.ss-api-feature-status {
    padding: 8px 12px;
    background: var(--ss-bg-tertiary);
    border-radius: 4px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
}

.ss-api-feature-status strong {
    color: var(--ss-text-primary);
}

.ss-api-feature-status span {
    color: var(--ss-primary);
}

/* ==========================================================================
   SECTION 28: INLINE DRAWER
   ========================================================================== */

.ss-inline-drawer {
    border: 1px solid var(--ss-border);
    border-radius: 8px;
    margin: 10px 0;
    overflow: hidden;
}

.ss-inline-drawer-toggle {
    background: var(--ss-bg-secondary);
    padding: 10px 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background var(--ss-transition);
}

.ss-inline-drawer-toggle:hover {
    background: var(--ss-highlight);
}

.ss-inline-drawer-toggle b {
    color: var(--ss-text-primary);
}

.ss-inline-drawer-content {
    background: var(--ss-bg-tertiary);
    padding: 15px;
    border-top: 1px solid var(--ss-border);
}
`;
