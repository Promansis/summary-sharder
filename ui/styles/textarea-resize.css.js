export const TEXTAREA_RESIZE_CSS = `
/* ======================================================================
   TEXTAREA RESIZE CONSISTENCY
   Ensure all SS textareas expose a visible bottom-right resize affordance.
   ====================================================================== */

#summary-sharder-settings textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
#summary-sharder-panel textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
.ss-modal textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
[class*="ss-"][class*="-modal"] textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
.popup:has([class*="ss-"][class*="-modal"]) textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
.popup.ss-owned-popup textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
.ss-fab textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
.ss-fab-panels textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
.ss-fab-generating textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]) {
    --ss-resize-corner-size: 10px;
    --ss-resize-corner-hit-scale: 2.2;
    --ss-resize-corner-inset: 3px;
    --ss-resize-corner-gap: 4px;
    resize: vertical !important;
    overflow: auto;
    min-height: 44px;
    padding-right: 12px;
    padding-bottom: 12px;
    background-repeat: no-repeat !important;
    background-size:
        var(--ss-resize-corner-size) var(--ss-resize-corner-size),
        var(--ss-resize-corner-size) var(--ss-resize-corner-size),
        var(--ss-resize-corner-size) var(--ss-resize-corner-size) !important;
    background-position:
        calc(100% - var(--ss-resize-corner-inset)) calc(100% - var(--ss-resize-corner-inset)),
        calc(100% - (var(--ss-resize-corner-inset) + var(--ss-resize-corner-gap))) calc(100% - var(--ss-resize-corner-inset)),
        calc(100% - var(--ss-resize-corner-inset)) calc(100% - (var(--ss-resize-corner-inset) + var(--ss-resize-corner-gap))) !important;
    background-image:
        linear-gradient(
            135deg,
            transparent 44%,
            currentColor 44%,
            currentColor 56%,
            transparent 56%
        ),
        linear-gradient(
            135deg,
            transparent 44%,
            currentColor 44%,
            currentColor 56%,
            transparent 56%
        ),
        linear-gradient(
            135deg,
            transparent 44%,
            currentColor 44%,
            currentColor 56%,
            transparent 56%
        ) !important;
}

textarea.ss-resize-active {
    cursor: ns-resize !important;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none !important;
    overscroll-behavior: none !important;
    overflow-y: hidden !important;
}

html.ss-resize-lock,
body.ss-resize-lock {
    overscroll-behavior: none !important;
}

body.ss-resize-lock {
    overflow: hidden !important;
}

@media (max-width: 768px) {
    #summary-sharder-settings textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
    #summary-sharder-panel textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
    .ss-modal textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
    [class*="ss-"][class*="-modal"] textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
    .popup:has([class*="ss-"][class*="-modal"]) textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
    .popup.ss-owned-popup textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
    .ss-fab textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
    .ss-fab-panels textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]),
    .ss-fab-generating textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"]) {
        --ss-resize-corner-size: 14px;
        --ss-resize-corner-hit-scale: 3.15;
        --ss-resize-corner-inset: 4px;
        --ss-resize-corner-gap: 5px;
        padding-right: 16px;
        padding-bottom: 16px;
    }

    #summary-sharder-settings textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"])::-webkit-resizer,
    #summary-sharder-panel textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"])::-webkit-resizer,
    .ss-modal textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"])::-webkit-resizer,
    [class*="ss-"][class*="-modal"] textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"])::-webkit-resizer,
    .popup:has([class*="ss-"][class*="-modal"]) textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"])::-webkit-resizer,
    .popup.ss-owned-popup textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"])::-webkit-resizer,
    .ss-fab textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"])::-webkit-resizer,
    .ss-fab-panels textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"])::-webkit-resizer,
    .ss-fab-generating textarea:not([readonly]):not([disabled]):not([data-ss-no-resize-assist="1"])::-webkit-resizer {
        background:
            linear-gradient(135deg, transparent 40%, currentColor 40%, currentColor 60%, transparent 60%);
        background-size: var(--ss-resize-corner-size) var(--ss-resize-corner-size);
    }
}
`;
