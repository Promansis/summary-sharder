/**
 * Segmented Toggle Component
 * Reusable button-group selector for fixed option sets.
 */

/** Force a CSS property with !important to beat SillyTavern popup button overrides */
const forceStyle = (el, prop, val) => el.style.setProperty(prop, val, 'important');

/**
 * Create a segmented toggle element.
 * @param {Object} config
 * @param {Array<{value: string, label: string}>} config.options
 * @param {string} config.value
 * @param {Function} config.onChange
 * @param {string} config.className
 * @param {boolean} config.disabled
 * @returns {HTMLElement} root element with setValue/getValue methods
 */
export function createSegmentedToggle({
    options = [],
    value = '',
    onChange = () => {},
    className = '',
    disabled = false,
} = {}) {
    const root = document.createElement('div');
    root.className = `ss-segmented-toggle ${className}`.trim();
    root.setAttribute('role', 'group');

    if (options.length > 0) {
        root.style.gridTemplateColumns = `repeat(${options.length}, minmax(0, 1fr))`;
    }

    let currentValue = String(value ?? '');
    let isDisabled = !!disabled;

    const buttonsByValue = new Map();

    const updateUI = () => {
        root.dataset.value = currentValue;
        root.classList.toggle('ss-disabled-section', isDisabled);
        buttonsByValue.forEach((button, optionValue) => {
            const isActive = optionValue === currentValue;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            button.disabled = isDisabled;

            // State-dependent inline styles (must use !important to beat ST themes)
            forceStyle(button, 'background', isActive ? 'var(--ss-highlight)' : 'var(--ss-bg-secondary)');
            forceStyle(button, 'background-color', isActive ? 'var(--ss-highlight)' : 'var(--ss-bg-secondary)');
            forceStyle(button, 'color', isActive ? 'var(--ss-primary)' : 'var(--ss-text-secondary)');
            forceStyle(button, 'font-weight', isActive ? '600' : 'normal');
            forceStyle(button, 'z-index', isActive ? '1' : '0');
        });
    };

    const emitChange = () => {
        root.dispatchEvent(new Event('change', { bubbles: true }));
        root.dispatchEvent(new CustomEvent('ss-segmented-change', {
            bubbles: true,
            detail: { value: currentValue },
        }));
    };

    const setValue = (nextValue, shouldNotify = false) => {
        const normalized = String(nextValue ?? '');
        if (!buttonsByValue.has(normalized) || normalized === currentValue) {
            return false;
        }
        currentValue = normalized;
        updateUI();
        if (shouldNotify) {
            onChange(currentValue);
            emitChange();
        }
        return true;
    };

    options.forEach((option, index) => {
        const optionValue = String(option.value ?? '');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = String(option.label ?? optionValue);
        button.dataset.value = optionValue;
        button.setAttribute('aria-pressed', 'false');

        // Force critical styles inline — ST popup themes use ID-based
        // selectors with !important on <button>, which beats any class-based CSS.
        forceStyle(button, 'appearance', 'none');
        forceStyle(button, '-webkit-appearance', 'none');
        forceStyle(button, 'background-image', 'none');
        forceStyle(button, 'box-shadow', 'none');
        forceStyle(button, 'text-transform', 'none');
        forceStyle(button, 'text-decoration', 'none');
        forceStyle(button, 'margin', '0');
        forceStyle(button, 'padding', '6px 12px');
        forceStyle(button, 'min-height', '32px');
        forceStyle(button, 'font-family', 'inherit');
        forceStyle(button, 'font-size', 'inherit');
        forceStyle(button, 'line-height', '1.2');
        forceStyle(button, 'cursor', 'pointer');
        forceStyle(button, 'outline', 'none');
        forceStyle(button, 'border', '1px solid var(--ss-border)');
        forceStyle(button, 'transition', 'background 0.2s ease, color 0.2s ease');
        if (index > 0) {
            forceStyle(button, 'margin-left', '-1px');
        }

        button.addEventListener('click', () => {
            if (isDisabled) {
                return;
            }
            setValue(optionValue, true);
        });

        // Hover effects via JS since inline !important overrides CSS :hover
        button.addEventListener('mouseenter', () => {
            if (!isDisabled && optionValue !== currentValue) {
                forceStyle(button, 'background', 'var(--ss-highlight)');
                forceStyle(button, 'color', 'var(--ss-primary)');
            }
            forceStyle(button, 'z-index', '1');
        });
        button.addEventListener('mouseleave', () => {
            if (!isDisabled) {
                const isActive = optionValue === currentValue;
                forceStyle(button, 'background', isActive ? 'var(--ss-highlight)' : 'var(--ss-bg-secondary)');
                forceStyle(button, 'color', isActive ? 'var(--ss-primary)' : 'var(--ss-text-secondary)');
                forceStyle(button, 'z-index', isActive ? '1' : '0');
            }
        });

        buttonsByValue.set(optionValue, button);
        root.appendChild(button);
    });

    if (!buttonsByValue.has(currentValue) && options.length > 0) {
        currentValue = String(options[0].value ?? '');
    }
    updateUI();

    root.setValue = (nextValue) => setValue(nextValue, false);
    root.getValue = () => currentValue;
    root.setDisabled = (nextDisabled) => {
        isDisabled = !!nextDisabled;
        updateUI();
    };

    Object.defineProperty(root, 'value', {
        configurable: true,
        enumerable: true,
        get() {
            return currentValue;
        },
        set(nextValue) {
            setValue(nextValue, false);
        },
    });

    return root;
}
