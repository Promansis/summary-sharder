const TEXTAREA_SELECTOR = [
    '#summary-sharder-settings textarea',
    '#summary-sharder-panel textarea',
    '.ss-modal textarea',
    '[class*="ss-"][class*="-modal"] textarea',
    '.popup:has([class*="ss-"][class*="-modal"]) textarea',
    '.popup.ss-owned-popup textarea',
    '.ss-fab textarea',
    '.ss-fab-panels textarea',
    '.ss-fab-generating textarea',
].join(', ');

const MOBILE_QUERY = '(max-width: 768px)';
const DESKTOP_HIT_SIZE = 22;
const MOBILE_HIT_SIZE = 44;
const DEFAULT_HIT_SCALE = 2.2;
const DEFAULT_MOBILE_HIT_SCALE = 3.15;
const WATCHDOG_TIMEOUT_MS = 8000;

let listenersAttached = false;
let activeResize = null;
let scrollLockState = null;

function isResizableTextarea(target) {
    if (!(target instanceof HTMLTextAreaElement)) return false;
    if (!target.matches(TEXTAREA_SELECTOR)) return false;
    if (target.disabled || target.readOnly) return false;
    if (target.dataset.ssNoResizeAssist === '1') return false;
    return true;
}

function isPrimaryPointer(event) {
    if (event.isPrimary === false) return false;
    if (event.pointerType === 'mouse' && event.button !== 0) return false;
    return true;
}

function getHitSize(textarea) {
    const computed = window.getComputedStyle(textarea);
    const cornerSize = parseFloat(computed.getPropertyValue('--ss-resize-corner-size') || '');
    const configuredScale = parseFloat(computed.getPropertyValue('--ss-resize-corner-hit-scale') || '');
    const fallbackScale = window.matchMedia(MOBILE_QUERY).matches ? DEFAULT_MOBILE_HIT_SCALE : DEFAULT_HIT_SCALE;
    const hitScale = Number.isFinite(configuredScale) && configuredScale > 0
        ? configuredScale
        : fallbackScale;
    if (Number.isFinite(cornerSize) && cornerSize > 0) {
        return Math.max(Math.round(cornerSize), Math.round(cornerSize * hitScale));
    }
    return window.matchMedia(MOBILE_QUERY).matches ? MOBILE_HIT_SIZE : DESKTOP_HIT_SIZE;
}

function isInResizeCorner(event, textarea) {
    const rect = textarea.getBoundingClientRect();
    const x = Number(event.clientX);
    const y = Number(event.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false;

    const hitSize = getHitSize(textarea);
    return x >= rect.right - hitSize && y >= rect.bottom - hitSize;
}

function getMinHeight(textarea) {
    const computed = window.getComputedStyle(textarea);
    const parsed = parseFloat(computed.minHeight || '');
    return Number.isFinite(parsed) ? parsed : 44;
}

function armResizeWatchdog() {
    if (!activeResize) return;
    if (activeResize.watchdogTimer) {
        window.clearTimeout(activeResize.watchdogTimer);
    }
    activeResize.watchdogTimer = window.setTimeout(() => {
        forceEndResize('watchdog-timeout');
    }, WATCHDOG_TIMEOUT_MS);
}

function clearResizeWatchdog(state) {
    if (!state || !state.watchdogTimer) return;
    window.clearTimeout(state.watchdogTimer);
    state.watchdogTimer = null;
}

function forceEndResize(reason = 'forced-end') {
    if (!activeResize) return;
    endResize({ type: reason, pointerId: activeResize.pointerId }, { force: true });
}

function beginResize(event, textarea, source = 'pointer') {
    const previousTouchAction = textarea.style.touchAction;
    const previousOverscrollBehavior = textarea.style.overscrollBehavior;
    const previousOverflowY = textarea.style.overflowY;
    const cleanupFns = [];

    activeResize = {
        source,
        pointerId: event.pointerId,
        textarea,
        startY: event.clientY,
        startHeight: textarea.getBoundingClientRect().height,
        minHeight: getMinHeight(textarea),
        cleanupFns,
        restoreStyles: () => {
            textarea.style.touchAction = previousTouchAction;
            textarea.style.overscrollBehavior = previousOverscrollBehavior;
            textarea.style.overflowY = previousOverflowY;
        },
        watchdogTimer: null,
        touchIdentifier: Number.isFinite(event.touchIdentifier) ? event.touchIdentifier : null,
    };

    textarea.dataset.ssManualResized = '1';
    textarea.classList.add('ss-resize-active');
    textarea.style.touchAction = 'none';
    textarea.style.overscrollBehavior = 'none';
    textarea.style.overflowY = 'hidden';
    lockPageScroll();
    armResizeWatchdog();

    if (typeof textarea.setPointerCapture === 'function') {
        try {
            textarea.setPointerCapture(event.pointerId);
        } catch {
            // Ignore capture errors and continue with document-level handlers.
        }
    }

    const onLostPointerCapture = (lostEvent) => {
        if (!activeResize || activeResize.textarea !== textarea) return;
        const lostId = Number.isFinite(lostEvent.pointerId) ? lostEvent.pointerId : null;
        if (lostId === null || lostId === activeResize.pointerId) {
            forceEndResize('lostpointercapture');
        }
    };
    textarea.addEventListener('lostpointercapture', onLostPointerCapture);
    cleanupFns.push(() => textarea.removeEventListener('lostpointercapture', onLostPointerCapture));

    const onWindowBlur = () => {
        forceEndResize('window-blur');
    };
    window.addEventListener('blur', onWindowBlur, true);
    cleanupFns.push(() => window.removeEventListener('blur', onWindowBlur, true));

    const onVisibilityChange = () => {
        if (document.visibilityState !== 'visible') {
            forceEndResize('visibilitychange');
        }
    };
    document.addEventListener('visibilitychange', onVisibilityChange, true);
    cleanupFns.push(() => document.removeEventListener('visibilitychange', onVisibilityChange, true));
}

function updateResize(event) {
    if (!activeResize) return;
    if (event.isPrimary === false) return;
    if (Number.isFinite(activeResize.pointerId) && event.pointerId !== activeResize.pointerId) return;

    const deltaY = event.clientY - activeResize.startY;
    const nextHeight = Math.max(activeResize.minHeight, Math.round(activeResize.startHeight + deltaY));
    activeResize.textarea.style.height = `${nextHeight}px`;
    armResizeWatchdog();
    event.stopPropagation();
    event.preventDefault();
}

function endResize(event, options = {}) {
    if (!activeResize) return;
    const state = activeResize;
    const eventPointerId = Number.isFinite(event?.pointerId) ? event.pointerId : null;
    const eventType = String(event?.type || '');
    const pointerMatches = (
        eventPointerId === null ||
        !Number.isFinite(state.pointerId) ||
        state.pointerId === eventPointerId
    );
    const isCancelLikeEvent = eventType === 'pointercancel' || eventType === 'lostpointercapture';
    if (!options.force && !pointerMatches && !isCancelLikeEvent) return;

    state.textarea.classList.remove('ss-resize-active');
    if (typeof state.textarea.releasePointerCapture === 'function' && Number.isFinite(state.pointerId)) {
        try {
            if (!state.textarea.hasPointerCapture || state.textarea.hasPointerCapture(state.pointerId)) {
                state.textarea.releasePointerCapture(state.pointerId);
            }
        } catch {
            // No-op: capture may already be released.
        }
    }
    if (typeof state.restoreStyles === 'function') {
        state.restoreStyles();
    }
    clearResizeWatchdog(state);
    if (Array.isArray(state.cleanupFns)) {
        for (const cleanup of state.cleanupFns) {
            try {
                cleanup();
            } catch {
                // No-op cleanup guard.
            }
        }
    }
    activeResize = null;
    unlockPageScroll();
}

function onPointerDown(event) {
    if (event.pointerType === 'touch') return;
    if (!isPrimaryPointer(event)) return;
    const target = event.target;
    const textarea = target instanceof HTMLTextAreaElement ? target : target?.closest?.('textarea');
    if (!isResizableTextarea(textarea)) return;
    if (!isInResizeCorner(event, textarea)) return;

    beginResize(event, textarea);
    event.stopPropagation();
    event.preventDefault();
}

function getTouchByIdentifier(touches, identifier) {
    if (!touches || touches.length === 0) return null;
    if (identifier === null || !Number.isFinite(identifier)) return touches[0];
    for (let i = 0; i < touches.length; i++) {
        const touch = touches[i];
        if (touch.identifier === identifier) return touch;
    }
    return null;
}

function onTouchStart(event) {
    if (activeResize) return;
    const target = event.target;
    const textarea = target instanceof HTMLTextAreaElement ? target : target?.closest?.('textarea');
    if (!isResizableTextarea(textarea)) return;

    const touch = getTouchByIdentifier(event.touches, null);
    if (!touch) return;

    const touchEvent = {
        pointerId: null,
        touchIdentifier: touch.identifier,
        clientX: touch.clientX,
        clientY: touch.clientY,
    };
    if (!isInResizeCorner(touchEvent, textarea)) return;

    beginResize(touchEvent, textarea, 'touch');
    event.stopPropagation();
    event.preventDefault();
}

function onTouchMove(event) {
    if (!activeResize || activeResize.source !== 'touch') return;
    const touch = getTouchByIdentifier(event.touches, activeResize.touchIdentifier);
    if (!touch) return;

    updateResize({
        pointerId: null,
        clientY: touch.clientY,
        isPrimary: true,
        stopPropagation: () => event.stopPropagation(),
        preventDefault: () => event.preventDefault(),
    });
}

function onTouchEnd(event) {
    if (!activeResize || activeResize.source !== 'touch') return;
    const touchStillActive = getTouchByIdentifier(event.touches, activeResize.touchIdentifier);
    if (touchStillActive) return;
    endResize({ type: 'touchend', pointerId: null }, { force: true });
    event.stopPropagation();
}

function onTouchCancel(event) {
    if (!activeResize || activeResize.source !== 'touch') return;
    endResize({ type: 'touchcancel', pointerId: null }, { force: true });
    event.stopPropagation();
}

function lockPageScroll() {
    if (scrollLockState) return;
    if (typeof document === 'undefined') return;

    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    if (!htmlEl || !bodyEl) return;

    const hadHtmlClass = htmlEl.classList.contains('ss-resize-lock');
    const hadBodyClass = bodyEl.classList.contains('ss-resize-lock');

    if (!hadHtmlClass) htmlEl.classList.add('ss-resize-lock');
    if (!hadBodyClass) bodyEl.classList.add('ss-resize-lock');

    scrollLockState = {
        removeHtmlClass: !hadHtmlClass,
        removeBodyClass: !hadBodyClass,
    };
}

function unlockPageScroll() {
    if (!scrollLockState) return;
    if (typeof document === 'undefined') return;

    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    if (htmlEl && scrollLockState.removeHtmlClass) {
        htmlEl.classList.remove('ss-resize-lock');
    }
    if (bodyEl && scrollLockState.removeBodyClass) {
        bodyEl.classList.remove('ss-resize-lock');
    }
    scrollLockState = null;
}

export function initTextareaResizeAssist() {
    if (listenersAttached || typeof document === 'undefined' || !window.PointerEvent) return;

    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: false });
    document.addEventListener('pointermove', updateResize, { capture: true, passive: false });
    document.addEventListener('pointerup', endResize, true);
    document.addEventListener('pointercancel', endResize, true);
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });
    document.addEventListener('touchcancel', onTouchCancel, { capture: true, passive: false });
    window.addEventListener('pagehide', () => forceEndResize('pagehide'), true);
    listenersAttached = true;
}
