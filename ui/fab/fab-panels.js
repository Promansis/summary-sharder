const PANEL_ORDER = ['actions', 'config', 'advanced'];
const PANEL_TITLES = {
    actions: 'Actions',
    config: 'Overview',
    advanced: 'Advanced',
};
const PANEL_ICONS = {
    actions: 'fa-bolt',
    config: 'fa-circle-info',
    advanced: 'fa-gears',
};
const PANEL_ANGLES_DEG = {
    actions: 270,
    config: 30,
    advanced: 150,
};

const VIEWPORT_MARGIN = 8;
const FAB_TRIGGER_DIAMETER_PX = 56;
const FAB_RADIUS_PX = FAB_TRIGGER_DIAMETER_PX / 2;
const WHEEL_FLOAT_GAP_PX = 5;
// Matches the CSS concave cutout geometry for a 54x65 wheel button.
const WHEEL_INNER_OFFSET_PX = 12;
export const WHEEL_RADIUS_PX = FAB_RADIUS_PX + WHEEL_FLOAT_GAP_PX + WHEEL_INNER_OFFSET_PX;
export const WHEEL_MAX_HALF_EXTENT_PX = 32.5;
const PANEL_GAP_PX = 12;
const FAB_EXCLUSION_PADDING_PX = 14;
const WHEEL_EXCLUSION_PADDING_PX = 6;
const COLLISION_RESOLVE_ITERATIONS = 12;
const MOBILE_BREAKPOINT = '(max-width: 768px)';
const DEFAULT_WHEEL_BUTTON_WIDTH_PX = 54;
const DEFAULT_WHEEL_BUTTON_HEIGHT_PX = 65;
const FAB_PANELS_PERF_DEBUG = false;
const FAB_PANELS_PERF_SAMPLE_LIMIT = 120;
const FAB_PANELS_PERF_LOG_INTERVAL = 20;
const fabPanelsPerfSamples = new Map();

function recordFabPanelsPerfSample(metric, value) {
    if (!Number.isFinite(value)) return;

    const state = fabPanelsPerfSamples.get(metric) || { samples: [], count: 0, max: 0 };
    state.count += 1;
    state.max = Math.max(state.max, value);
    if (state.samples.length >= FAB_PANELS_PERF_SAMPLE_LIMIT) {
        state.samples.shift();
    }
    state.samples.push(value);
    fabPanelsPerfSamples.set(metric, state);

    if (!FAB_PANELS_PERF_DEBUG) return;
    if (state.count % FAB_PANELS_PERF_LOG_INTERVAL !== 0 && value < 50) return;

    const sorted = [...state.samples].sort((a, b) => a - b);
    const p50 = getPercentile(sorted, 0.5);
    const p95 = getPercentile(sorted, 0.95);
    console.debug(
        `[SummarySharder][FAB panels perf] ${metric} n=${state.samples.length} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms max=${state.max.toFixed(1)}ms`
    );
}

function getPercentile(sortedValues, fraction) {
    if (!sortedValues.length) return 0;
    const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * fraction)));
    return sortedValues[index];
}

export function createFabPanels({ anchorRect, panelMarkupById, mobileScalePercent = 100, onAction }) {
    const mobileScaleFactor = mobileScalePercent / 100;
    const root = document.createElement('div');
    root.className = 'ss-fab-panels ss-fab-wheel-hidden';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Summary Sharder quick actions');

    const panelElements = new Map();
    const wheelButtons = new Map();
    const wheelAnchors = new Map();

    let currentAnchorRect = anchorRect;
    let activePanelId = null;
    let mobileMatchMedia = window.matchMedia?.(MOBILE_BREAKPOINT) || null;
    let isMobileViewport = mobileMatchMedia ? mobileMatchMedia.matches : window.innerWidth <= 768;
    let lastViewportWidth = window.innerWidth;
    let lastViewportHeight = window.innerHeight;
    let pendingLayoutFrameId = null;
    let pendingLayoutFrameMode = null;
    let pendingLayoutFlags = { wheel: false, panel: false };
    const panelMeasureCache = new Map();
    const wheelButtonSizeById = new Map();
    let wheelButtonSizeDirty = true;
    let panelResizeObserver = null;
    let onMobileViewportChanged = null;

    buildWheelButtons(root, wheelButtons);
    buildPanels(root, panelMarkupById, panelElements);

    if (typeof ResizeObserver === 'function') {
        panelResizeObserver = new ResizeObserver((entries) => {
            let shouldRepositionActive = false;
            entries.forEach((entry) => {
                const panelId = entry.target?.dataset?.panelId;
                if (!panelId) return;
                panelMeasureCache.delete(panelId);
                if (panelId === activePanelId) {
                    shouldRepositionActive = true;
                }
            });
            if (shouldRepositionActive) {
                scheduleLayout({ panel: true });
            }
        });
        panelElements.forEach((panel) => {
            panelResizeObserver.observe(panel);
        });
    }

    if (mobileMatchMedia) {
        onMobileViewportChanged = (event) => {
            isMobileViewport = event.matches;
            panelMeasureCache.clear();
            invalidateWheelButtonSizeCache();
            scheduleLayout({ panel: true });
        };
        if (typeof mobileMatchMedia.addEventListener === 'function') {
            mobileMatchMedia.addEventListener('change', onMobileViewportChanged);
        } else if (typeof mobileMatchMedia.addListener === 'function') {
            mobileMatchMedia.addListener(onMobileViewportChanged);
        }
    }

    document.body.appendChild(root);
    refreshWheelButtonSizeCache();
    runLayout({ wheel: true, panel: true });

    const onClick = (event) => {
        const startedAt = performance.now();
        try {
            // Close on backdrop click (sheet mode)
            if (event.target === root && root.classList.contains('ss-fab-sheet-active')) {
                const activePanel = root.querySelector('.ss-fab-panel.is-active');
                if (activePanel) {
                    const panelId = activePanel.dataset.panelId;
                    if (panelId) {
                        togglePanel(panelId);
                    }
                }
                return;
            }

            const actionButton = event.target.closest('[data-action]');
            if (actionButton) {
                const action = actionButton.dataset.action;
                if (action) {
                    onAction?.(action, actionButton);
                }
                return;
            }

            const wheelButton = event.target.closest('[data-fab-wheel]');
            if (!wheelButton) return;

            const panelId = wheelButton.getAttribute('data-fab-wheel');
            if (!panelId) return;

            togglePanel(panelId);
        } finally {
            recordFabPanelsPerfSample('click', performance.now() - startedAt);
        }
    };

    const onKeydown = (event) => {
        // Close sheet on Escape key
        if (event.key === 'Escape' && root.classList.contains('ss-fab-sheet-active')) {
            const activePanel = root.querySelector('.ss-fab-panel.is-active');
            if (activePanel) {
                const panelId = activePanel.dataset.panelId;
                if (panelId) {
                    togglePanel(panelId);
                }
            }
            return;
        }

        const wheelButton = event.target.closest('[data-fab-wheel]');
        if (!wheelButton) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        const panelId = wheelButton.getAttribute('data-fab-wheel');
        if (!panelId) return;

        togglePanel(panelId);
    };

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeydown);

    function togglePanel(panelId) {
        if (!panelElements.has(panelId)) return;
        activePanelId = activePanelId === panelId ? null : panelId;
        syncActiveState();
        scheduleLayout({ panel: true });
    }

    function syncActiveState() {
        panelElements.forEach((panel, panelId) => {
            panel.classList.toggle('is-active', panelId === activePanelId);
        });

        wheelButtons.forEach((button, panelId) => {
            const isActive = panelId === activePanelId;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        });
    }

    function runLayout({ wheel = false, panel = false }) {
        const startedAt = performance.now();
        if (!currentAnchorRect) return;

        const center = getAnchorCenter(currentAnchorRect);
        if (wheel) {
            refreshWheelButtonSizeCache();
            positionWheelAnchors(center);
        }
        if (panel) {
            positionActivePanel(center);
        }
        recordFabPanelsPerfSample('positionEverything', performance.now() - startedAt);
    }

    function scheduleLayout({ wheel = false, panel = false } = {}) {
        pendingLayoutFlags.wheel = pendingLayoutFlags.wheel || wheel;
        pendingLayoutFlags.panel = pendingLayoutFlags.panel || panel;
        if (pendingLayoutFrameId !== null) return;

        const run = () => {
            pendingLayoutFrameId = null;
            pendingLayoutFrameMode = null;

            const flags = pendingLayoutFlags;
            pendingLayoutFlags = { wheel: false, panel: false };
            runLayout(flags);
        };

        if (typeof window.requestAnimationFrame === 'function') {
            pendingLayoutFrameMode = 'raf';
            pendingLayoutFrameId = window.requestAnimationFrame(run);
            return;
        }

        pendingLayoutFrameMode = 'timeout';
        pendingLayoutFrameId = window.setTimeout(run, 0);
    }

    function cancelScheduledLayout() {
        if (pendingLayoutFrameId === null) return;
        if (pendingLayoutFrameMode === 'raf' && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(pendingLayoutFrameId);
        } else {
            window.clearTimeout(pendingLayoutFrameId);
        }
        pendingLayoutFrameId = null;
        pendingLayoutFrameMode = null;
        pendingLayoutFlags = { wheel: false, panel: false };
    }

    function positionWheelAnchors(center) {
        const scale = isMobileViewport ? mobileScaleFactor : 1;
        const scaledWheelRadius = WHEEL_RADIUS_PX * scale;
        PANEL_ORDER.forEach((panelId) => {
            const angle = degreesToRadians(PANEL_ANGLES_DEG[panelId] ?? 0);
            const angleDeg = PANEL_ANGLES_DEG[panelId] ?? 0;
            const anchor = {
                x: center.x + Math.cos(angle) * scaledWheelRadius,
                y: center.y + Math.sin(angle) * scaledWheelRadius,
                angle,
            };

            const button = wheelButtons.get(panelId);
            if (button) {
                button.style.left = `${anchor.x}px`;
                button.style.top = `${anchor.y}px`;
                button.style.setProperty('--ss-wheel-rotation', `${angleDeg}deg`);
                button.style.setProperty('--ss-wheel-icon-rotation', `${-angleDeg}deg`);
            }

            const buttonRect = wheelButtonSizeById.get(panelId) || getScaledWheelButtonFallback();
            wheelAnchors.set(panelId, {
                ...anchor,
                rect: {
                    left: anchor.x - (buttonRect.width / 2),
                    top: anchor.y - (buttonRect.height / 2),
                    width: buttonRect.width,
                    height: buttonRect.height,
                },
            });
        });
    }

    function positionActivePanel(center) {
        const noActivePanel = !activePanelId;
        panelElements.forEach((panel, panelId) => {
            if (panelId !== activePanelId) {
                hidePanel(panel, noActivePanel);
                return;
            }

            const anchor = wheelAnchors.get(panelId);
            if (!anchor) {
                hidePanel(panel, true);
                return;
            }

            const panelSize = getPanelSize(panelId, panel);
            const placement = getPopoverPlacement({
                anchor,
                anchorRect: currentAnchorRect,
                fabCenter: center,
                wheelAnchors,
                panelSize,
                isMobileViewport,
            });

            if (shouldUseSheetMode(placement, isMobileViewport)) {
                applySheetMode(panel);
            } else {
                applyPopoverMode(panel, placement);
            }

            panel.classList.add('is-active');
        });
    }

    function applySheetMode(panel) {
        panel.classList.add('ss-fab-panel-sheet');
        panel.dataset.arrow = 'none';
        panel.style.left = '';
        panel.style.top = '';
        panel.style.setProperty('--ss-fab-arrow-offset', '0px');

        // ARIA for sheet mode
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');

        // Mark container for backdrop
        const container = panel.closest('.ss-fab-panels');
        if (container) {
            container.classList.add('ss-fab-sheet-active');
            container.setAttribute('aria-hidden', 'false');
        }
    }

    function applyPopoverMode(panel, placement) {
        panel.classList.remove('ss-fab-panel-sheet');
        panel.style.left = `${placement.x}px`;
        panel.style.top = `${placement.y}px`;
        panel.dataset.arrow = placement.arrowSide;
        panel.style.setProperty('--ss-fab-arrow-offset', `${placement.arrowOffset}px`);

        // Remove backdrop
        const container = panel.closest('.ss-fab-panels');
        if (container) {
            container.classList.remove('ss-fab-sheet-active');
        }
    }

    function getPanelSize(panelId, panel) {
        const cached = panelMeasureCache.get(panelId);
        if (cached) {
            return cached;
        }
        const measured = measurePanel(panel);
        panelMeasureCache.set(panelId, measured);
        return measured;
    }

    function syncMobileAndViewportState() {
        const nextWidth = window.innerWidth;
        const nextHeight = window.innerHeight;
        const viewportChanged = nextWidth !== lastViewportWidth || nextHeight !== lastViewportHeight;
        if (viewportChanged) {
            lastViewportWidth = nextWidth;
            lastViewportHeight = nextHeight;
            panelMeasureCache.clear();
            invalidateWheelButtonSizeCache();
        }
        const nextIsMobile = mobileMatchMedia ? mobileMatchMedia.matches : nextWidth <= 768;
        if (nextIsMobile !== isMobileViewport) {
            isMobileViewport = nextIsMobile;
            panelMeasureCache.clear();
            invalidateWheelButtonSizeCache();
        }
    }

    function invalidateWheelButtonSizeCache() {
        wheelButtonSizeDirty = true;
    }

    function getScaledWheelButtonFallback() {
        const scale = isMobileViewport ? mobileScaleFactor : 1;
        return {
            width: DEFAULT_WHEEL_BUTTON_WIDTH_PX * scale,
            height: DEFAULT_WHEEL_BUTTON_HEIGHT_PX * scale,
        };
    }

    function refreshWheelButtonSizeCache() {
        if (!wheelButtonSizeDirty) return;
        wheelButtonSizeDirty = false;
        wheelButtonSizeById.clear();

        const fallback = getScaledWheelButtonFallback();
        PANEL_ORDER.forEach((panelId) => {
            const button = wheelButtons.get(panelId);
            const rect = button?.getBoundingClientRect?.();
            if (!rect?.width || !rect?.height) {
                wheelButtonSizeById.set(panelId, { ...fallback });
                return;
            }
            wheelButtonSizeById.set(panelId, {
                width: Math.max(rect.width || 0, 30),
                height: Math.max(rect.height || 0, 30),
            });
        });
    }

    return {
        root,
        get isMobile() {
            return isMobileViewport;
        },
        getPanelElement(panelId) {
            return panelElements.get(panelId) || null;
        },
        getWheelButton(panelId) {
            return wheelButtons.get(panelId) || null;
        },
        getWheelAnchor(panelId) {
            return wheelAnchors.get(panelId) || null;
        },
        setWheelVisible(visible) {
            root.classList.toggle('ss-fab-wheel-hidden', !visible);
            root.classList.toggle('ss-fab-wheel-visible', visible);
        },
        updatePanel(panelId, panelMarkup) {
            const panel = panelElements.get(panelId);
            if (!panel) return;

            panel.innerHTML = buildPanelShell(panelMarkup);
            panelMeasureCache.delete(panelId);
            if (panelId === activePanelId) {
                scheduleLayout({ panel: true });
            }
        },
        reposition(nextAnchorRect) {
            currentAnchorRect = nextAnchorRect;
            syncMobileAndViewportState();
            scheduleLayout({ wheel: true, panel: true });
        },
        repositionSync(nextAnchorRect) {
            currentAnchorRect = nextAnchorRect;
            syncMobileAndViewportState();
            cancelScheduledLayout();
            runLayout({ wheel: true, panel: true });
        },
        containsTarget(target) {
            return root.contains(target);
        },
        collapseAll() {
            activePanelId = null;
            syncActiveState();
            runLayout({ panel: true });
        },
        getActivePanelId() {
            return activePanelId;
        },
        focusInitial() {
            const button = wheelButtons.get(PANEL_ORDER[0]);
            button?.focus();
        },
        focusNextWheel(step = 1) {
            const focusedId = document.activeElement?.getAttribute?.('data-fab-wheel');
            const baseIndex = Math.max(0, PANEL_ORDER.indexOf(focusedId || activePanelId || PANEL_ORDER[0]));
            const delta = step >= 0 ? 1 : -1;
            const nextIndex = (baseIndex + delta + PANEL_ORDER.length) % PANEL_ORDER.length;
            const nextId = PANEL_ORDER[nextIndex];
            wheelButtons.get(nextId)?.focus();
        },
        destroy() {
            cancelScheduledLayout();
            if (panelResizeObserver) {
                panelResizeObserver.disconnect();
                panelResizeObserver = null;
            }
            if (mobileMatchMedia && onMobileViewportChanged) {
                if (typeof mobileMatchMedia.removeEventListener === 'function') {
                    mobileMatchMedia.removeEventListener('change', onMobileViewportChanged);
                } else if (typeof mobileMatchMedia.removeListener === 'function') {
                    mobileMatchMedia.removeListener(onMobileViewportChanged);
                }
            }
            onMobileViewportChanged = null;
            mobileMatchMedia = null;
            panelMeasureCache.clear();
            wheelButtonSizeById.clear();
            wheelButtonSizeDirty = true;
            root.removeEventListener('click', onClick);
            root.removeEventListener('keydown', onKeydown);
            root.remove();
        },
    };
}

function buildWheelButtons(root, wheelButtons) {
    PANEL_ORDER.forEach((panelId, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `ss-fab-wheel-btn ss-fab-wheel-btn-${panelId}`;
        button.dataset.fabWheel = panelId;
        button.setAttribute('aria-label', `${PANEL_TITLES[panelId]} panel`);
        button.setAttribute('aria-expanded', 'false');
        button.style.setProperty('--ss-wheel-index', `${index}`);
        button.title = PANEL_TITLES[panelId];

        const icon = document.createElement('i');
        icon.className = `ss-fab-wheel-icon fa-solid ${PANEL_ICONS[panelId]}`;
        icon.setAttribute('aria-hidden', 'true');

        button.appendChild(icon);
        root.appendChild(button);
        wheelButtons.set(panelId, button);
    });
}

function buildPanels(root, panelMarkupById, panelElements) {
    PANEL_ORDER.forEach((panelId) => {
        const panel = document.createElement('section');
        panel.className = `ss-fab-panel ss-fab-panel-${panelId}`;
        panel.dataset.panelId = panelId;
        panel.dataset.arrow = 'left';
        panel.innerHTML = buildPanelShell(panelMarkupById[panelId]);
        root.appendChild(panel);
        panelElements.set(panelId, panel);
    });
}

function buildPanelShell(innerMarkup) {
    return `<div class="ss-fab-panel-body">${innerMarkup}</div>`;
}

function getAnchorCenter(anchorRect) {
    return {
        x: anchorRect.left + (anchorRect.width / 2),
        y: anchorRect.top + (anchorRect.height / 2),
    };
}

function getPopoverPlacement({ anchor, fabCenter, anchorRect, wheelAnchors, panelSize, isMobileViewport }) {
    const size = panelSize;
    const direction = normalizeDirection({
        x: anchor.x - fabCenter.x,
        y: anchor.y - fabCenter.y,
    });
    const preferredArrowSide = getArrowSide(direction);
    const sideOrder = getPlacementSideOrder(preferredArrowSide);
    const centerBias = isMobileViewport ? 0.16 : 0;
    const baseGap = (anchor.rect?.width || 30) / 2 + PANEL_GAP_PX;
    const mobileExtraGap = isMobileViewport ? 24 : 0;
    const radialGap = baseGap + mobileExtraGap;
    const exclusions = getPanelExclusions(fabCenter, anchorRect, wheelAnchors);

    // Mobile: bias side order based on FAB vertical position
    let mobileSideOrder = sideOrder;
    if (isMobileViewport) {
        const fabVerticalPosition = fabCenter.y / window.innerHeight;

        // FAB in bottom half (> 0.5) → prefer top placement
        if (fabVerticalPosition > 0.5) {
            mobileSideOrder = reorderSidesForMobile(sideOrder, 'top');
        }
        // FAB in top half (< 0.5) → prefer bottom placement
        else if (fabVerticalPosition < 0.5) {
            mobileSideOrder = reorderSidesForMobile(sideOrder, 'bottom');
        }
    }
    const finalSideOrder = isMobileViewport ? mobileSideOrder : sideOrder;

    let bestPlacement = null;

    for (const arrowSide of finalSideOrder) {
        const basePlacement = getPlacementForSide(arrowSide, anchor, size, radialGap);
        let x = basePlacement.x;
        let y = basePlacement.y;

        if (centerBias > 0) {
            const centerTargetX = (window.innerWidth / 2) - (size.width / 2);
            const centerTargetY = (window.innerHeight / 2) - (size.height / 2);
            x = (x * (1 - centerBias)) + (centerTargetX * centerBias);
            y = (y * (1 - centerBias)) + (centerTargetY * centerBias);
        }

        x = clamp(x, VIEWPORT_MARGIN, window.innerWidth - size.width - VIEWPORT_MARGIN);
        y = clamp(y, VIEWPORT_MARGIN, window.innerHeight - size.height - VIEWPORT_MARGIN);

        const resolved = resolveCollision({
            x,
            y,
            width: size.width,
            height: size.height,
            exclusions,
            fabCenter,
        });

        const candidate = {
            x: resolved.x,
            y: resolved.y,
            arrowSide,
            collides: resolved.collides,
            penalty: resolved.penalty,
            arrowOffset: arrowSide === 'left' || arrowSide === 'right'
                ? clamp(anchor.y - resolved.y, 14, size.height - 14)
                : clamp(anchor.x - resolved.x, 14, size.width - 14),
        };

        if (!candidate.collides) {
            return candidate;
        }

        if (!bestPlacement || candidate.penalty < bestPlacement.penalty) {
            bestPlacement = candidate;
        }
    }

    return bestPlacement || {
        x: VIEWPORT_MARGIN,
        y: VIEWPORT_MARGIN,
        arrowSide: preferredArrowSide,
        arrowOffset: 20,
        collides: true,
        penalty: Number.MAX_SAFE_INTEGER,
    };
}

function shouldUseSheetMode(placement, isMobileViewport) {
    if (!isMobileViewport) return false;
    if (!placement) return false;

    // Use sheet mode if collision is unresolved
    return placement.collides === true;
}

function hidePanel(panel, clearSheetBackdrop = false) {
    panel.classList.remove('is-active');
    panel.classList.remove('ss-fab-panel-sheet');
    panel.removeAttribute('aria-modal');
    panel.style.left = '-9999px';
    panel.style.top = '-9999px';

    if (clearSheetBackdrop) {
        const container = panel.closest('.ss-fab-panels');
        if (container) {
            container.classList.remove('ss-fab-sheet-active');
        }
    }
}

function measurePanel(panel) {
    const startedAt = performance.now();
    const wasActive = panel.classList.contains('is-active');
    const wasSheet = panel.classList.contains('ss-fab-panel-sheet');
    const previousLeft = panel.style.left;
    const previousTop = panel.style.top;
    const previousVisibility = panel.style.visibility;

    if (wasSheet) {
        panel.classList.remove('ss-fab-panel-sheet');
    }
    if (!wasActive) {
        panel.classList.add('is-active');
    }

    panel.style.left = '-9999px';
    panel.style.top = '-9999px';
    panel.style.visibility = 'hidden';

    const rect = panel.getBoundingClientRect();
    const width = Math.max(210, rect.width || panel.scrollWidth || 230);
    const height = Math.max(120, rect.height || panel.scrollHeight || 150);

    panel.style.left = previousLeft;
    panel.style.top = previousTop;
    panel.style.visibility = previousVisibility;

    if (!wasActive) {
        panel.classList.remove('is-active');
    }
    if (wasSheet) {
        panel.classList.add('ss-fab-panel-sheet');
    }

    recordFabPanelsPerfSample('measurePanel', performance.now() - startedAt);
    return { width, height };
}

function getArrowSide(direction) {
    const absX = Math.abs(direction.x);
    const absY = Math.abs(direction.y);

    if (absX >= absY) {
        return direction.x >= 0 ? 'left' : 'right';
    }

    return direction.y >= 0 ? 'top' : 'bottom';
}

function getFabExclusion(center, anchorRect) {
    const radius = (Math.max(anchorRect.width, anchorRect.height) / 2) + FAB_EXCLUSION_PADDING_PX;
    return {
        cx: center.x,
        cy: center.y,
        radius,
    };
}

function getPanelExclusions(fabCenter, anchorRect, wheelAnchors) {
    const wheelRects = [];

    wheelAnchors.forEach((anchor) => {
        if (!anchor?.rect) return;

        wheelRects.push({
            x: anchor.rect.left - WHEEL_EXCLUSION_PADDING_PX,
            y: anchor.rect.top - WHEEL_EXCLUSION_PADDING_PX,
            width: anchor.rect.width + (WHEEL_EXCLUSION_PADDING_PX * 2),
            height: anchor.rect.height + (WHEEL_EXCLUSION_PADDING_PX * 2),
        });
    });

    return {
        fabCircle: getFabExclusion(fabCenter, anchorRect),
        wheelRects,
    };
}

function getPlacementSideOrder(preferredSide) {
    const fallbackBySide = {
        left: ['left', 'right', 'top', 'bottom'],
        right: ['right', 'left', 'top', 'bottom'],
        top: ['top', 'bottom', 'right', 'left'],
        bottom: ['bottom', 'top', 'right', 'left'],
    };
    return fallbackBySide[preferredSide] || ['left', 'right', 'top', 'bottom'];
}

function reorderSidesForMobile(originalOrder, preferredSide) {
    const filtered = originalOrder.filter(side => side !== preferredSide);
    return [preferredSide, ...filtered];
}

function getPlacementForSide(arrowSide, anchor, size, radialGap) {
    if (arrowSide === 'left') {
        return {
            x: anchor.x + radialGap,
            y: anchor.y - (size.height / 2),
        };
    }

    if (arrowSide === 'right') {
        return {
            x: anchor.x - radialGap - size.width,
            y: anchor.y - (size.height / 2),
        };
    }

    if (arrowSide === 'top') {
        return {
            x: anchor.x - (size.width / 2),
            y: anchor.y + radialGap,
        };
    }

    return {
        x: anchor.x - (size.width / 2),
        y: anchor.y - radialGap - size.height,
    };
}

function resolveCollision({ x, y, width, height, exclusions, fabCenter }) {
    const startedAt = performance.now();
    let nextX = x;
    let nextY = y;
    let iterations = 0;

    const initialRect = { x: nextX, y: nextY, width, height };
    if (!hasCollision(initialRect, exclusions)) {
        recordFabPanelsPerfSample('resolveCollision', performance.now() - startedAt);
        recordFabPanelsPerfSample('resolveCollision.iterations', 0);
        return {
            x: nextX,
            y: nextY,
            collides: false,
            penalty: 0,
        };
    }

    for (let i = 0; i < COLLISION_RESOLVE_ITERATIONS; i += 1) {
        iterations = i + 1;
        const panelRect = { x: nextX, y: nextY, width, height };
        const collision = getStrongestCollision(panelRect, exclusions);
        if (!collision) {
            recordFabPanelsPerfSample('resolveCollision', performance.now() - startedAt);
            recordFabPanelsPerfSample('resolveCollision.iterations', iterations);
            return {
                x: nextX,
                y: nextY,
                collides: false,
                penalty: 0,
            };
        }

        const center = getRectCenter(panelRect);
        const push = normalizeDirection({
            x: center.x - collision.center.x,
            y: center.y - collision.center.y,
        });
        const fallbackPush = normalizeDirection({
            x: center.x - fabCenter.x,
            y: center.y - fabCenter.y,
        });
        const direction = (Math.abs(push.x) + Math.abs(push.y) > 0.0001) ? push : fallbackPush;
        const distance = Math.max(4, collision.overlap + 2);

        nextX = clamp(nextX + (direction.x * distance), VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
        nextY = clamp(nextY + (direction.y * distance), VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);
    }

    const unresolvedRect = { x: nextX, y: nextY, width, height };
    const result = {
        x: nextX,
        y: nextY,
        collides: hasCollision(unresolvedRect, exclusions),
        penalty: getCollisionPenalty(unresolvedRect, exclusions),
    };
    recordFabPanelsPerfSample('resolveCollision', performance.now() - startedAt);
    recordFabPanelsPerfSample('resolveCollision.iterations', iterations);
    return result;
}

function hasCollision(panelRect, exclusions) {
    if (rectIntersectsCircle(panelRect, exclusions.fabCircle)) {
        return true;
    }
    return exclusions.wheelRects.some((rect) => rectIntersectsRect(panelRect, rect));
}

function getCollisionPenalty(panelRect, exclusions) {
    let penalty = 0;

    const circleOverlap = getCircleOverlap(panelRect, exclusions.fabCircle);
    penalty += circleOverlap * 1000;

    exclusions.wheelRects.forEach((rect) => {
        penalty += getRectOverlapArea(panelRect, rect);
    });

    return penalty;
}

function getStrongestCollision(panelRect, exclusions) {
    let strongest = null;

    const circleOverlap = getCircleOverlap(panelRect, exclusions.fabCircle);
    if (circleOverlap > 0) {
        strongest = {
            overlap: circleOverlap,
            center: { x: exclusions.fabCircle.cx, y: exclusions.fabCircle.cy },
        };
    }

    exclusions.wheelRects.forEach((rect) => {
        const overlapMetric = getRectCollisionMetric(panelRect, rect);
        if (overlapMetric <= 0) return;

        const candidate = {
            overlap: overlapMetric,
            center: getRectCenter(rect),
        };
        if (!strongest || candidate.overlap > strongest.overlap) {
            strongest = candidate;
        }
    });

    return strongest;
}

function getRectCollisionMetric(a, b) {
    if (!rectIntersectsRect(a, b)) return 0;

    const ax = getRectCenter(a).x;
    const ay = getRectCenter(a).y;
    const bx = getRectCenter(b).x;
    const by = getRectCenter(b).y;

    const overlapX = ((a.width / 2) + (b.width / 2)) - Math.abs(ax - bx);
    const overlapY = ((a.height / 2) + (b.height / 2)) - Math.abs(ay - by);
    return Math.max(0, Math.min(overlapX, overlapY));
}

function getCircleOverlap(rect, circle) {
    const nearest = getNearestPointOnRect(circle.cx, circle.cy, rect);
    const nearestDistance = Math.hypot(nearest.x - circle.cx, nearest.y - circle.cy);
    return Math.max(0, circle.radius - nearestDistance);
}

function getRectCenter(rect) {
    return {
        x: rect.x + (rect.width / 2),
        y: rect.y + (rect.height / 2),
    };
}

function rectIntersectsRect(a, b) {
    return !(
        (a.x + a.width) <= b.x ||
        a.x >= (b.x + b.width) ||
        (a.y + a.height) <= b.y ||
        a.y >= (b.y + b.height)
    );
}

function getRectOverlapArea(a, b) {
    const overlapWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const overlapHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return overlapWidth * overlapHeight;
}

function rectIntersectsCircle(item, circle) {
    const nearest = getNearestPointOnRect(circle.cx, circle.cy, item);
    const dx = nearest.x - circle.cx;
    const dy = nearest.y - circle.cy;
    return (dx * dx) + (dy * dy) < (circle.radius * circle.radius);
}

function getNearestPointOnRect(x, y, rect) {
    return {
        x: clamp(x, rect.x, rect.x + rect.width),
        y: clamp(y, rect.y, rect.y + rect.height),
    };
}

function normalizeDirection(direction) {
    const x = Number.isFinite(direction?.x) ? direction.x : 1;
    const y = Number.isFinite(direction?.y) ? direction.y : 0;
    const magnitude = Math.hypot(x, y) || 1;
    return { x: x / magnitude, y: y / magnitude };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

