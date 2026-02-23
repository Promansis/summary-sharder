/**
 * UI helper functions for API orchestration layer
 */

let operationCounter = 0;

function nextOperationId(feature) {
    operationCounter += 1;
    return `${feature}-${Date.now()}-${operationCounter}`;
}

export function dispatchUiOperationState(detail) {
    window.dispatchEvent(new CustomEvent('ss-ui-operation-state', { detail }));
}

/**
 * Emit operation-start UI state.
 * Preserves legacy events consumed by FAB.
 */
export function startUiOperation({
    feature,
    primaryButton,
    disabled = true,
    label = null,
    lockButtons = [],
    showStop = true,
}) {
    const opId = nextOperationId(feature || 'operation');
    dispatchUiOperationState({
        feature,
        phase: 'start',
        primaryButton,
        disabled,
        label,
        lockButtons,
        showStop,
        opId,
    });

    window.dispatchEvent(new CustomEvent('ss-operation-started'));
    return opId;
}

/**
 * Emit operation-progress UI state.
 */
export function updateUiOperation({
    feature,
    primaryButton,
    disabled = true,
    label = null,
    lockButtons = [],
    showStop = null,
    opId,
}) {
    dispatchUiOperationState({
        feature,
        phase: 'progress',
        primaryButton,
        disabled,
        label,
        lockButtons,
        showStop,
        opId,
    });
}

/**
 * Emit operation-end UI state.
 * Preserves legacy events consumed by FAB.
 */
export function endUiOperation({
    feature,
    primaryButton,
    disabled = false,
    label = null,
    lockButtons = [],
    showStop = false,
    opId,
}) {
    dispatchUiOperationState({
        feature,
        phase: 'end',
        primaryButton,
        disabled,
        label,
        lockButtons,
        showStop,
        opId,
    });

    window.dispatchEvent(new CustomEvent('ss-operation-ended'));
}

/**
 * Legacy aliases for operation-wide stop visibility toggles.
 */
export function showStopButton() {
    return startUiOperation({
        feature: 'operation',
        primaryButton: null,
        disabled: true,
        label: null,
        lockButtons: [],
        showStop: true,
    });
}

export function hideStopButton(opId = null) {
    endUiOperation({
        feature: 'operation',
        primaryButton: null,
        disabled: false,
        label: null,
        lockButtons: [],
        showStop: false,
        opId,
    });
}
