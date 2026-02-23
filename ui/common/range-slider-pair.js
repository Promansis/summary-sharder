/**
 * Range Slider Pair Component
 * Reusable range + number input with synchronized values.
 */

/**
 * Create a range slider pair element.
 * @param {Object} config
 * @param {string} config.id
 * @param {number|string} config.min
 * @param {number|string} config.max
 * @param {number|string} config.step
 * @param {number|string} config.value
 * @param {string} config.unit
 * @param {(value:number)=>void} config.onChange
 * @param {string} config.className
 * @returns {HTMLElement} root element with getValue/setValue/setDisabled methods
 */
export function createRangeSliderPair({
    id = '',
    min = 0,
    max = 100,
    step = 1,
    value = 0,
    unit = '',
    onChange = () => {},
    className = '',
} = {}) {
    const minValue = toNumber(min, 0);
    const maxValue = toNumber(max, 100);
    const stepValue = Math.max(0.000001, toNumber(step, 1));

    const root = document.createElement('div');
    root.className = `ss-range-pair ${className}`.trim();

    const rangeInput = document.createElement('input');
    rangeInput.type = 'range';
    rangeInput.min = String(minValue);
    rangeInput.max = String(maxValue);
    rangeInput.step = String(stepValue);
    rangeInput.className = 'ss-range-slider';
    if (id) {
        rangeInput.id = id;
    }

    const numberInput = document.createElement('input');
    numberInput.type = 'number';
    numberInput.min = String(minValue);
    numberInput.max = String(maxValue);
    numberInput.step = String(stepValue);
    numberInput.className = 'text_pole ss-range-number';
    if (id) {
        numberInput.id = `${id}-input`;
    }

    const unitLabel = document.createElement('span');
    unitLabel.className = 'ss-range-unit';
    unitLabel.textContent = String(unit || '');

    let currentValue = clamp(toNumber(value, minValue), minValue, maxValue);
    let isDisabled = false;
    let isEmitting = false;

    const updateUi = () => {
        const normalized = formatForStep(currentValue, stepValue);
        rangeInput.value = normalized;
        numberInput.value = normalized;
        rangeInput.disabled = isDisabled;
        numberInput.disabled = isDisabled;
    };

    const emitEvents = (eventType) => {
        if (isEmitting) return;
        isEmitting = true;
        try {
            const rangeEvent = new Event(eventType, { bubbles: true });
            const numberEvent = new Event(eventType, { bubbles: true });
            rangeInput.dispatchEvent(rangeEvent);
            numberInput.dispatchEvent(numberEvent);

            root.dispatchEvent(new CustomEvent(eventType, {
                bubbles: true,
                detail: { value: currentValue },
            }));
        } finally {
            isEmitting = false;
        }
    };

    const setValue = (nextValue, notify = false, eventType = 'change') => {
        const normalizedValue = clamp(toNumber(nextValue, currentValue), minValue, maxValue);
        if (normalizedValue === currentValue) {
            return false;
        }

        currentValue = normalizedValue;
        updateUi();

        if (notify) {
            onChange(currentValue);
            emitEvents(eventType);
        }

        return true;
    };

    rangeInput.addEventListener('input', () => {
        const changed = setValue(rangeInput.value, true, 'input');
        if (!changed) {
            updateUi();
        }
    });

    rangeInput.addEventListener('change', () => {
        const changed = setValue(rangeInput.value, true, 'change');
        if (!changed) {
            updateUi();
            emitEvents('change');
        }
    });

    numberInput.addEventListener('input', () => {
        const changed = setValue(numberInput.value, true, 'input');
        if (!changed) {
            updateUi();
        }
    });

    numberInput.addEventListener('change', () => {
        const changed = setValue(numberInput.value, true, 'change');
        if (!changed) {
            updateUi();
            emitEvents('change');
        }
    });

    root.appendChild(rangeInput);
    root.appendChild(numberInput);
    if (unit) {
        root.appendChild(unitLabel);
    }

    root.getValue = () => currentValue;
    root.setValue = (nextValue) => setValue(nextValue, false);
    root.setDisabled = (disabled) => {
        isDisabled = !!disabled;
        updateUi();
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

    updateUi();

    return root;
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatForStep(value, step) {
    if (!Number.isFinite(step) || step <= 0) {
        return String(value);
    }

    const decimals = getStepDecimals(step);
    return Number(value).toFixed(decimals);
}

function getStepDecimals(step) {
    const parts = String(step).split('.');
    return parts[1] ? parts[1].length : 0;
}
