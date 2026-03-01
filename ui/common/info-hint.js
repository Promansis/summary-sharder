/**
 * Info Hint Component
 * Small icon button that reveals a contextual popover.
 */

const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] || char);

let activePopover = null;
let activeButton = null;
let activeTrigger = null;
let activeClickHandler = null;
let activeScrollHandler = null;
let activeResizeHandler = null;

const resolveHintContainer = (button) => {
    const popup = button?.closest?.('.popup') || null;
    const modalRoot = button?.closest?.('.ss-modal') || button?.closest?.('[class*="ss-"][class*="-modal"]') || null;

    // Prefer popups when we're inside an actual modal/popup surface (keeps the hint above modal overlays).
    if (popup && modalRoot) {
        return popup;
    }

    // Some SillyTavern pages may have non-modal `.popup` ancestors (layout/containers). If we mount
    // inside those, the popover can be clipped or end up behind other UI. Treat only high z-index,
    // positioned `.popup` nodes as "modal" containers; otherwise mount to body.
    if (popup) {
        const style = window.getComputedStyle(popup);
        const positionOk = style.position === 'fixed' || style.position === 'absolute';
        const z = parseInt(style.zIndex || '', 10);
        const zOk = Number.isFinite(z) && z >= 100;
        if (positionOk && zOk) {
            return popup;
        }
    }

    return document.body;
};

const removeActivePopover = () => {
    if (activePopover) {
        activePopover.remove();
        activePopover = null;
    }
    if (activeClickHandler) {
        document.removeEventListener('click', activeClickHandler);
        activeClickHandler = null;
    }
    if (activeScrollHandler) {
        document.removeEventListener('scroll', activeScrollHandler, true);
        activeScrollHandler = null;
    }
    if (activeResizeHandler) {
        window.removeEventListener('resize', activeResizeHandler);
        activeResizeHandler = null;
    }
    activeButton = null;
    activeTrigger = null;
};

const positionPopover = (popover, button, anchorEvent, container) => {
    const rect = button.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    const offset = 6;
    const margin = 8;
    const useFixed = container === document.body;
    const containerRect = useFixed
        ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
        : container.getBoundingClientRect();

    const hasPointer = anchorEvent
        && Number.isFinite(anchorEvent.clientX)
        && Number.isFinite(anchorEvent.clientY)
        // Some synthetic click events (notably on touch) report 0,0.
        && (anchorEvent.clientX !== 0 || anchorEvent.clientY !== 0);
    let top = hasPointer ? anchorEvent.clientY + offset : rect.bottom + offset;
    let left = hasPointer ? anchorEvent.clientX : rect.left;

    if (top + popRect.height + margin > containerRect.top + containerRect.height) {
        top = (hasPointer ? anchorEvent.clientY : rect.top) - popRect.height - offset;
    }

    const minLeft = containerRect.left + margin;
    const maxLeft = containerRect.left + containerRect.width - popRect.width - margin;
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));

    const minTop = containerRect.top + margin;
    const maxTop = containerRect.top + containerRect.height - popRect.height - margin;
    top = Math.min(Math.max(top, minTop), Math.max(minTop, maxTop));

    if (!useFixed) {
        // When anchoring to a scrollable container, absolute positioning is relative to the
        // container's *scrolling content box*, so we must include its current scroll offset.
        left = left - containerRect.left + (container.scrollLeft || 0);
        top = top - containerRect.top + (container.scrollTop || 0);
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
};

const showPopover = (button, trigger, anchorEvent) => {
    // Prefer dataset (fast path), but fall back to `title` in case a sanitizer strips custom data attributes
    // in some SillyTavern surfaces (notably extension settings panels).
    const text = String(
        button?.dataset?.ssHintText
            || button?.getAttribute?.('data-ss-hint-text')
            || button?.getAttribute?.('title')
            || ''
    ).trim();
    if (!text) {
        return;
    }

    if (activePopover && activeButton === button && activeTrigger === trigger) {
        return;
    }

    removeActivePopover();

    const container = resolveHintContainer(button);
    if (container !== document.body) {
        const computed = window.getComputedStyle(container);
        if (computed.position === 'static') {
            container.style.position = 'relative';
        }
    }

    const popover = document.createElement('div');
    popover.className = 'ss-info-hint-popover';
    popover.textContent = text;
    popover.setAttribute('role', 'tooltip');
    popover.style.position = container === document.body ? 'fixed' : 'absolute';
    const computed = window.getComputedStyle(button);
    const cssVars = [
        '--ss-bg-primary',
        '--ss-bg-secondary',
        '--ss-border',
        '--ss-text-primary',
        '--ss-shadow',
    ];
    for (const cssVar of cssVars) {
        const value = computed.getPropertyValue(cssVar);
        if (value) {
            popover.style.setProperty(cssVar, value.trim());
        }
    }

    const resolveVar = (name, fallback) => {
        const value = computed.getPropertyValue(name).trim();
        return value || fallback;
    };

    const hintWidth = resolveVar('--ss-info-hint-width', '320px');
    const hintMaxWidth = resolveVar('--ss-info-hint-max-width', 'calc(100vw - 32px)');
    const bg = resolveVar('--ss-bg-primary', 'rgba(0, 0, 0, 0.85)');
    const borderColor = resolveVar('--ss-border', 'rgba(255, 255, 255, 0.2)');
    popover.style.setProperty('background', bg, 'important');
    popover.style.setProperty('background-color', bg, 'important');
    popover.style.setProperty('border', `1px solid ${borderColor}`, 'important');
    popover.style.setProperty('opacity', '1', 'important');
    popover.style.setProperty('filter', 'none', 'important');
    popover.style.setProperty('display', 'inline-block', 'important');
    popover.style.setProperty('width', hintWidth, 'important');
    popover.style.setProperty('max-width', hintMaxWidth, 'important');
    popover.style.setProperty('box-sizing', 'border-box', 'important');
    popover.style.setProperty('white-space', 'normal', 'important');
    popover.style.setProperty('overflow-wrap', 'anywhere', 'important');
    popover.style.setProperty('word-break', 'break-word', 'important');
    container.appendChild(popover);

    requestAnimationFrame(() => positionPopover(popover, button, anchorEvent, container));

    activePopover = popover;
    activeButton = button;
    activeTrigger = trigger;

    activeClickHandler = (event) => {
        if (popover.contains(event.target) || button.contains(event.target)) {
            return;
        }
        removeActivePopover();
    };
    activeScrollHandler = () => removeActivePopover();
    activeResizeHandler = () => removeActivePopover();

    document.addEventListener('click', activeClickHandler);
    document.addEventListener('scroll', activeScrollHandler, true);
    window.addEventListener('resize', activeResizeHandler);
};

/**
 * @param {string} id
 * @param {string} text
 * @returns {string}
 */
export function infoHintHtml(id, text) {
    const safeText = escapeHtml(text);
    const safeId = id ? ` id="${escapeHtml(id)}"` : '';
    // Include `title` as a robustness fallback if `data-ss-hint-text` gets stripped.
    return `<button${safeId} type="button" class="ss-info-hint-btn" data-ss-hint-text="${safeText}" title="${safeText}" aria-label="Info">
        <i class="fa-solid fa-circle-info"></i>
    </button>`;
}

/**
 * @param {HTMLElement|Document} container
 */
export function mountInfoHints(container) {
    const root = container || document;
    const allowHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

    // Use event delegation so hints continue to work even if SillyTavern re-renders/replaces
    // sections of the settings UI after initial mount.
    if (!mountInfoHints._mountedRoots) {
        mountInfoHints._mountedRoots = new WeakSet();
    }
    if (mountInfoHints._mountedRoots.has(root)) {
        return;
    }
    mountInfoHints._mountedRoots.add(root);

    root.addEventListener('click', (event) => {
        const button = event.target?.closest?.('.ss-info-hint-btn');
        if (!button) return;
        if (root !== document && !root.contains(button)) return;

        event.preventDefault();
        event.stopPropagation();

        if (activePopover && activeButton === button && activeTrigger === 'click') {
            removeActivePopover();
            return;
        }
        showPopover(button, 'click', event);
    }, true);

    if (allowHover) {
        root.addEventListener('mouseover', (event) => {
            const button = event.target?.closest?.('.ss-info-hint-btn');
            if (!button) return;
            if (root !== document && !root.contains(button)) return;
            if (button.contains(event.relatedTarget)) return;
            if (activeTrigger === 'click') return;
            showPopover(button, 'hover', event);
        }, true);

        root.addEventListener('mouseout', (event) => {
            const button = event.target?.closest?.('.ss-info-hint-btn');
            if (!button) return;
            if (root !== document && !root.contains(button)) return;
            if (button.contains(event.relatedTarget)) return;
            if (activeButton === button && activeTrigger === 'hover') {
                removeActivePopover();
            }
        }, true);
    }
}
