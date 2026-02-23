export const FAB_PANELS_CSS = `
/* ======================================================================
   FAB PANELS - Crystal wheel + popovers
   ====================================================================== */

:root {
    --ss-fab-panel-padding: 14px;
    --ss-fab-section-gap: 10px;
    --ss-fab-item-gap: 5px;
    --ss-fab-button-gap: 6px;
    --ss-fab-button-height: 32px;
}

@media (max-width: 768px) {
    :root {
        --ss-fab-panel-padding: 18px;
        --ss-fab-button-height: 42px;
    }
}

.ss-fab-panels {
    position: fixed;
    inset: 0;
    z-index: 9998;
    pointer-events: none;
    --ss-fab-wheel-width: 54px;
    --ss-fab-wheel-height: 65px;
    --ss-fab-radius: 28px;
    --ss-fab-arc-offset: 5px;
    /* Concave path radius is calculated from an offset FAB circle (FAB radius + 5px). */
    --ss-fab-cut-radius-base: calc(var(--ss-fab-radius) + var(--ss-fab-arc-offset));
    /* Keep the same concave depth while changing radius by shifting circle center left. */
    --ss-fab-cut-center-x-base: calc(15px - var(--ss-fab-cut-radius-base));
    --ss-fab-cut-radius: var(--ss-fab-cut-radius-base);
    --ss-fab-cut-center-x: var(--ss-fab-cut-center-x-base);
    --ss-fab-wheel-corner-radius: 12px;
    --ss-fab-wheel-border-width: 1px;
    --ss-fab-wheel-icon-offset-x: 6px;
}

.ss-fab-wheel-btn {
    position: fixed;
    width: var(--ss-fab-wheel-width);
    height: var(--ss-fab-wheel-height);
    border: none;
    background: transparent;
    display: grid;
    place-items: center;
    padding: 0;
    transform: translate(-50%, -50%) rotate(var(--ss-wheel-rotation, 0deg)) scale(0);
    opacity: 0;
    pointer-events: none;
    cursor: pointer;
    transition: transform 0.3s cubic-bezier(0.2, 0.88, 0.25, 1), opacity 0.2s ease;
    transition-delay: calc(var(--ss-wheel-index, 0) * 60ms);
    isolation: isolate;
}

.ss-fab-wheel-btn::before,
.ss-fab-wheel-btn::after {
    content: '';
    position: absolute;
    border-radius: var(--ss-fab-wheel-corner-radius);
    pointer-events: none;
    -webkit-mask:
        linear-gradient(#000 0 0),
        radial-gradient(circle var(--ss-fab-cut-radius) at var(--ss-fab-cut-center-x) 50%, transparent 98%, #000 102%);
    -webkit-mask-composite: source-in;
    mask:
        linear-gradient(#000 0 0),
        radial-gradient(circle var(--ss-fab-cut-radius) at var(--ss-fab-cut-center-x) 50%, transparent 98%, #000 102%);
    mask-composite: intersect;
}

.ss-fab-wheel-btn::before {
    inset: 0;
    background: color-mix(in srgb, var(--ss-primary) 70%, black);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.34);
    transition: box-shadow 0.15s ease, background 0.15s ease;
}

.ss-fab-wheel-btn::after {
    inset: var(--ss-fab-wheel-border-width);
    background: color-mix(in srgb, var(--ss-bg-primary) 92%, transparent);
    --ss-fab-cut-radius: calc(var(--ss-fab-cut-radius-base) - var(--ss-fab-wheel-border-width));
    --ss-fab-cut-center-x: calc(var(--ss-fab-cut-center-x-base) + var(--ss-fab-wheel-border-width));
    transition: background 0.15s ease;
}

.ss-fab-wheel-icon {
    font-size: 16px;
    color: var(--ss-text-primary);
    z-index: 1;
    line-height: 1;
    pointer-events: none;
    transform: translateX(var(--ss-fab-wheel-icon-offset-x)) rotate(var(--ss-wheel-icon-rotation, 0deg));
    transform-origin: center;
}

.ss-fab-panels.ss-fab-wheel-visible .ss-fab-wheel-btn {
    transform: translate(-50%, -50%) rotate(var(--ss-wheel-rotation, 0deg)) scale(1);
    opacity: 1;
    pointer-events: auto;
}

.ss-fab-panels.ss-fab-wheel-hidden .ss-fab-wheel-btn {
    transform: translate(-50%, -50%) rotate(var(--ss-wheel-rotation, 0deg)) scale(0);
    opacity: 0;
    pointer-events: none;
    transition-duration: 0.2s;
    transition-delay: 0ms;
}

.ss-fab-wheel-btn:hover::before,
.ss-fab-wheel-btn:focus-visible::before {
    background: color-mix(in srgb, var(--ss-primary) 82%, white 8%);
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.4);
}

.ss-fab-wheel-btn:hover::after,
.ss-fab-wheel-btn:focus-visible::after {
    background: color-mix(in srgb, var(--ss-bg-secondary) 88%, transparent);
}

.ss-fab-wheel-btn.is-active::before {
    background: color-mix(in srgb, var(--ss-primary) 90%, white 8%);
    box-shadow: 0 7px 16px rgba(0, 0, 0, 0.45);
}

.ss-fab-wheel-btn.is-active::after {
    background: color-mix(in srgb, var(--ss-primary) 18%, var(--ss-bg-primary));
}

.ss-fab-wheel-btn:focus-visible {
    outline: none;
}

.ss-fab-panel {
    position: fixed;
    min-width: 208px;
    max-width: min(272px, calc(100vw - 16px));
    background: color-mix(in srgb, var(--ss-bg-primary) 95%, transparent);
    backdrop-filter: blur(8px);
    border: 1px solid var(--ss-border);
    border-radius: 12px;
    box-shadow: var(--ss-shadow-lg, 0 10px 28px rgba(0, 0, 0, 0.35));
    color: var(--ss-text-primary);
    overflow: visible;
    opacity: 0;
    pointer-events: none;
    transform: scale(0.96);
    transition: opacity 0.15s ease, transform 0.15s ease;
}

.ss-fab-panel::before {
    content: '';
    position: absolute;
    width: 10px;
    height: 10px;
    background: inherit;
    border-left: 1px solid var(--ss-border);
    border-top: 1px solid var(--ss-border);
    transform: rotate(45deg);
}

.ss-fab-panel[data-arrow='left']::before {
    left: -6px;
    top: calc(var(--ss-fab-arrow-offset, 24px) - 5px);
}

.ss-fab-panel[data-arrow='right']::before {
    right: -6px;
    top: calc(var(--ss-fab-arrow-offset, 24px) - 5px);
    transform: rotate(225deg);
}

.ss-fab-panel[data-arrow='top']::before {
    top: -6px;
    left: calc(var(--ss-fab-arrow-offset, 24px) - 5px);
    transform: rotate(45deg);
}

.ss-fab-panel[data-arrow='bottom']::before {
    bottom: -6px;
    left: calc(var(--ss-fab-arrow-offset, 24px) - 5px);
    transform: rotate(225deg);
}

.ss-fab-panel.is-active {
    opacity: 1;
    pointer-events: auto;
    transform: scale(1);
}

.ss-fab-panel-body {
    border-radius: 12px;
    overflow: hidden;
}

.ss-fab-panel-content {
    padding: var(--ss-fab-panel-padding);
    display: flex;
    flex-direction: column;
    gap: var(--ss-fab-section-gap);
}

.ss-fab-section {
    display: flex;
    flex-direction: column;
    gap: var(--ss-fab-item-gap);
}

.ss-fab-section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--ss-text-secondary);
    margin-bottom: 2px;
}

.ss-fab-section-items {
    display: flex;
    flex-direction: column;
    gap: var(--ss-fab-item-gap);
}

.ss-fab-section-items-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ss-fab-item-gap);
}

.ss-fab-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 7px;
    background: color-mix(in srgb, var(--ss-bg-secondary) 50%, transparent);
    border-radius: 4px;
    font-size: 12px;
}

.ss-fab-info-label {
    color: var(--ss-text-secondary);
    font-weight: 500;
}

.ss-fab-info-value {
    color: var(--ss-text-primary);
    font-weight: 600;
}

.ss-fab-info-value-small {
    font-size: 12px;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ss-fab-action {
    height: var(--ss-fab-button-height);
    display: flex;
    align-items: center;
    gap: var(--ss-fab-button-gap);
    padding: 0 9px;
    width: 100%;
    border-radius: 6px;
    background: var(--ss-bg-secondary);
    border: 1px solid var(--ss-border);
    color: var(--ss-text-primary);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    text-align: left;
    font-size: 11px;
}

.ss-fab-action:hover {
    background: color-mix(in srgb, var(--ss-primary) 12%, var(--ss-bg-secondary));
    border-color: var(--ss-primary);
}

.ss-fab-action i {
    font-size: 13px;
    color: var(--ss-primary);
    flex-shrink: 0;
}

.ss-fab-action span {
    font-weight: 500;
}

.ss-fab-section-items-grid .ss-fab-action {
    min-width: 0;
    padding: 0 8px;
}

.ss-fab-section-items-grid .ss-fab-action span {
    white-space: nowrap;
}

.ss-fab-action-busy {
    opacity: 0.65;
    pointer-events: none;
}

.ss-fab-action-stop {
    color: var(--ss-error);
    border-color: color-mix(in srgb, var(--ss-error) 45%, transparent);
    animation: ss-stop-pulse 1.1s ease-in-out infinite;
}

.ss-fab-action-stop i {
    color: var(--ss-error);
}

@keyframes ss-stop-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.35); }
    50% { box-shadow: 0 0 0 6px rgba(244, 67, 54, 0); }
}

.ss-fab-muted {
    color: var(--ss-text-secondary);
    font-size: 12px;
}

@media (max-width: 768px) {
    .ss-fab-panels {
        --ss-fab-wheel-width: 58px;
        --ss-fab-wheel-height: 70px;
    }

    .ss-fab-wheel-icon {
        font-size: 18px;
        transform: translateX(7px) rotate(var(--ss-wheel-icon-rotation, 0deg));
    }

    .ss-fab-panel {
        max-width: calc(100vw - 16px);
        left: 8px !important;
        right: 8px !important;
        width: auto;
    }

    .ss-fab-section-items-grid {
        grid-template-columns: 1fr;
    }

    .ss-fab-action {
        touch-action: manipulation;
    }
}

@media (max-width: 414px) {
    .ss-fab-panel {
        left: 8px !important;
        right: 8px !important;
        width: auto;
        max-width: none;
    }
}
`;
