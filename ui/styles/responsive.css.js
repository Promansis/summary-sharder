export const RESPONSIVE_CSS = `
/* ==========================================================================
   SECTION 30: MOBILE RESPONSIVE STYLES
   ========================================================================== */

@media (max-width: 768px) {
    /* Remove min-width constraints that cause overflow on mobile */
    .ss-prompts-modal {
        min-width: unset !important;
        width: 100%;
        padding: 10px;
    }

    .ss-chat-manager-modal {
        min-width: unset !important;
        width: 100%;
        padding: 10px;
    }

    .ss-clean-context-modal {
        min-width: unset !important;
        width: 100%;
    }

    /* Tab buttons: allow wrapping and fill available space */
    .ss-tab-header {
        flex-wrap: wrap;
    }

    .ss-tab-button {
        padding: 8px 10px;
        font-size: 13px;
        flex: 1 1 auto;
        text-align: center;
    }

    /* Ensure textareas stay readable on mobile */
    .ss-prompts-tab-content textarea,
    .ss-sharder-prompts-tab textarea,
    .ss-events-prompt-tab textarea {
        font-size: 12px !important;
    }

    /* Stack chat manager action buttons vertically */
    .ss-action-buttons {
        flex-direction: column;
    }

    .ss-action-buttons .menu_button {
        min-width: unset;
    }

    /* Popup footer controls: allow wrapping on narrow screens */
    .popup:has(.ss-prompts-modal) .popup-controls {
        flex-wrap: wrap;
        gap: 5px;
    }

    .ss-popup-left-buttons {
        flex-wrap: wrap;
    }

    /* RAG Settings Modal */
    .ss-rag-modal {
        padding: 10px;
    }

    .ss-rag-status-bar {
        grid-template-columns: 1fr;
    }

    .ss-rag-grid-two {
        grid-template-columns: 1fr;
    }

    .ss-rag-accordion[data-rag-section="backend"] .ss-accordion-content,
    .ss-rag-accordion[data-rag-section="vectorization"] .ss-accordion-content {
        grid-template-columns: 1fr;
    }

    #ss-rag-reranker-config,
    #ss-rag-qdrant-config {
        grid-template-columns: 1fr;
    }

    .ss-rag-actions-row {
        flex-direction: column;
    }

    .ss-rag-actions-row .menu_button {
        min-width: unset;
        width: 100%;
    }

    .ss-rag-section {
        padding: 8px;
    }

    .ss-rag-template {
        min-height: 80px;
        font-size: 12px;
    }
}
`;
