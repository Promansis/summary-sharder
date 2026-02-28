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

    const hasPointer = anchorEvent && Number.isFinite(anchorEvent.clientX) && Number.isFinite(anchorEvent.clientY);
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
        left -= containerRect.left;
        top -= containerRect.top;
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
};

const showPopover = (button, trigger, anchorEvent) => {
    const text = String(button?.dataset?.ssHintText || '').trim();
    if (!text) {
        return;
    }

    if (activePopover && activeButton === button && activeTrigger === trigger) {
        return;
    }

    removeActivePopover();

    const container = button.closest('.popup') || button.closest('.ss-modal') || document.body;
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

    const bg = resolveVar('--ss-bg-primary', 'rgba(0, 0, 0, 0.85)');
    const borderColor = resolveVar('--ss-border', 'rgba(255, 255, 255, 0.2)');
    popover.style.setProperty('background', bg, 'important');
    popover.style.setProperty('background-color', bg, 'important');
    popover.style.setProperty('border', `1px solid ${borderColor}`, 'important');
    popover.style.setProperty('opacity', '1', 'important');
    popover.style.setProperty('filter', 'none', 'important');
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
    return `<button${safeId} type="button" class="ss-info-hint-btn" data-ss-hint-text="${safeText}" aria-label="Info">
        <i class="fa-solid fa-circle-info"></i>
    </button>`;
}

/**
 * @param {HTMLElement|Document} container
 */
export function mountInfoHints(container) {
    const root = container || document;
    const allowHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

    for (const button of root.querySelectorAll('.ss-info-hint-btn')) {
        if (button.dataset.ssHintMounted === 'true') {
            continue;
        }

        button.dataset.ssHintMounted = 'true';

        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (activePopover && activeButton === button && activeTrigger === 'click') {
                removeActivePopover();
                return;
            }
            showPopover(button, 'click', event);
        });

        if (allowHover) {
            button.addEventListener('mouseenter', (event) => {
                if (activeTrigger === 'click') {
                    return;
                }
                showPopover(button, 'hover', event);
            });

            button.addEventListener('mouseleave', () => {
                if (activeButton === button && activeTrigger === 'hover') {
                    removeActivePopover();
                }
            });
        }
    }
}
