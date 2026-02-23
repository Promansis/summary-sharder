export const SCROLLBARS_CSS = `
/* ==========================================================================
   SECTION 29: SCROLLBARS
   ========================================================================== */

.ss-modal ::-webkit-scrollbar,
#summary-sharder-panel ::-webkit-scrollbar,
[class*="ss-"][class*="-modal"] ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.ss-modal ::-webkit-scrollbar-track,
#summary-sharder-panel ::-webkit-scrollbar-track,
[class*="ss-"][class*="-modal"] ::-webkit-scrollbar-track {
    background: var(--ss-bg-tertiary);
    border-radius: 4px;
}

.ss-modal ::-webkit-scrollbar-thumb,
#summary-sharder-panel ::-webkit-scrollbar-thumb,
[class*="ss-"][class*="-modal"] ::-webkit-scrollbar-thumb {
    background: var(--ss-border);
    border-radius: 4px;
}

.ss-modal ::-webkit-scrollbar-thumb:hover,
#summary-sharder-panel ::-webkit-scrollbar-thumb:hover,
[class*="ss-"][class*="-modal"] ::-webkit-scrollbar-thumb:hover {
    background: var(--ss-primary);
}
`;
