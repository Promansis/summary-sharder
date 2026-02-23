export const CHAT_MANAGER_CSS = `
/* ==========================================================================
   SECTION 11: CHAT MANAGER MODAL
   ========================================================================== */

.ss-chat-manager-modal {
    padding: 15px;
    min-width: 400px;
    max-width: 100%;
    box-sizing: border-box;
}

.ss-chat-manager-selectors {
    margin-bottom: 20px;
}

.ss-selector-row {
    margin-bottom: 15px;
}

.ss-selector-row > label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
    color: var(--ss-text-primary);
}

.ss-cm-target-chat-label {
    margin-top: 10px;
}

.ss-chat-manager-actions {
    border-top: 1px solid var(--ss-border);
    padding-top: 15px;
}

.ss-chat-manager-actions h4 {
    margin: 0 0 10px 0;
    color: var(--ss-text-primary);
}

.ss-action-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.ss-action-buttons .menu_button {
    flex: 1;
    min-width: 100px;
}

.ss-action-buttons .menu_button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
`;
