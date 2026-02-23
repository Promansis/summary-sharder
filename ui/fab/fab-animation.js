const SHARD_CONFIG = [
    {
        id: '1',
        selector: '.ss-crystal-shard--1',
        orbitClass: 'ss-shard-orbit-1',
        orbitStartTransform: 'translate(-8px, -3px) rotate(0deg) scale(1)',
    },
    {
        id: '2',
        selector: '.ss-crystal-shard--2',
        orbitClass: 'ss-shard-orbit-2',
        orbitStartTransform: 'translate(11px, -1px) rotate(0deg) scale(1)',
    },
    {
        id: '3',
        selector: '.ss-crystal-shard--3',
        orbitClass: 'ss-shard-orbit-3',
        orbitStartTransform: 'translate(-10px, 6px) rotate(0deg) scale(1)',
    },
    {
        id: '4',
        selector: '.ss-crystal-shard--4',
        orbitClass: 'ss-shard-orbit-4',
        orbitStartTransform: 'translate(9px, 7px) rotate(0deg) scale(1)',
    },
    {
        id: '5a',
        selector: '.ss-crystal-shard--5a',
        orbitClass: 'ss-shard-orbit-5a',
        orbitStartTransform: 'translate(-3px, 12px) rotate(0deg) scale(1)',
    },
    {
        id: '5b',
        selector: '.ss-crystal-shard--5b',
        orbitClass: 'ss-shard-orbit-5b',
        orbitStartTransform: 'translate(4px, 13px) rotate(0deg) scale(1)',
    },
];

const OPEN_DURATION_MS = 620;
const CLOSE_DURATION_MS = 450;
const BREAKOUT_STAGGER_MS = 48;
const WHEEL_REVEAL_DELAY_MS = 90;

export function createFabAnimator(fabElement) {
    const activeAnimations = new Set();
    const activeTimers = new Set();

    function track(animation) {
        if (!animation) return;
        activeAnimations.add(animation);
        animation.finished
            .catch(() => null)
            .finally(() => activeAnimations.delete(animation));
    }

    function schedule(callback, delay) {
        const timer = setTimeout(() => {
            activeTimers.delete(timer);
            callback();
        }, delay);
        activeTimers.add(timer);
    }

    function getTriggerCenterRect() {
        const trigger = fabElement.querySelector('.ss-fab-trigger');
        const triggerRect = trigger?.getBoundingClientRect?.();
        if (!triggerRect) {
            return new DOMRect(0, 0, 12, 12);
        }

        const centerX = triggerRect.left + (triggerRect.width / 2);
        const centerY = triggerRect.top + (triggerRect.height / 2);
        return new DOMRect(centerX - 6, centerY - 6, 12, 12);
    }

    function getTriggerCenter() {
        const rect = getTriggerCenterRect();
        return {
            x: rect.left + (rect.width / 2),
            y: rect.top + (rect.height / 2),
        };
    }

    function getShardElement(config) {
        return fabElement.querySelector(config.selector);
    }

    function clearShardClasses(shardElement) {
        if (!shardElement) return;
        SHARD_CONFIG.forEach((config) => shardElement.classList.remove(config.orbitClass));
        shardElement.style.animationPlayState = '';
    }

    function applyCloseStartTransform(shardElement, closeStartTransform) {
        if (!shardElement) return 'translate(0px, 0px) rotate(0deg) scale(1)';
        clearShardClasses(shardElement);
        shardElement.style.transform = closeStartTransform;
        return closeStartTransform;
    }

    function clearAllShards() {
        SHARD_CONFIG.forEach((config) => {
            const shardElement = getShardElement(config);
            if (!shardElement) return;
            shardElement.classList.remove(config.orbitClass);
            shardElement.style.transform = '';
            shardElement.style.animationPlayState = '';
        });
    }

    async function animateOpen(panelsController) {
        const supportsWaapi = typeof document.body.animate === 'function';

        panelsController?.collapseAll?.();
        panelsController?.setWheelVisible?.(false);
        schedule(() => panelsController?.setWheelVisible?.(true), WHEEL_REVEAL_DELAY_MS);

        if (!supportsWaapi) {
            SHARD_CONFIG.forEach((config) => {
                const shardElement = getShardElement(config);
                if (!shardElement) return;
                clearShardClasses(shardElement);
                shardElement.style.transform = '';
                shardElement.classList.add(config.orbitClass);
            });
            return;
        }

        const animations = [];

        SHARD_CONFIG.forEach((config, index) => {
            const shardElement = getShardElement(config);
            if (!shardElement) return;

            clearShardClasses(shardElement);
            shardElement.style.transform = 'translate(0px, 0px) rotate(0deg) scale(1)';

            const animation = shardElement.animate([
                { transform: 'translate(0px, 0px) rotate(0deg) scale(1)' },
                { transform: config.orbitStartTransform },
            ], {
                duration: OPEN_DURATION_MS,
                delay: index * BREAKOUT_STAGGER_MS,
                easing: 'linear',
                fill: 'forwards',
            });

            track(animation);
            animations.push(
                animation.finished
                    .catch(() => null)
                    .finally(() => {
                        shardElement.classList.add(config.orbitClass);
                        try {
                            animation.cancel();
                        } catch {
                            // ignored
                        }
                        shardElement.style.transform = '';
                    })
            );
        });

        await Promise.all(animations);
    }

    async function animateClose(panelsController) {
        const supportsWaapi = typeof document.body.animate === 'function';

        panelsController?.collapseAll?.();
        panelsController?.setWheelVisible?.(false);

        if (!supportsWaapi) {
            clearAllShards();
            return;
        }

        const animations = [];

        [...SHARD_CONFIG].reverse().forEach((config, reverseIndex) => {
            const shardElement = getShardElement(config);
            if (!shardElement) return;

            const startTransform = applyCloseStartTransform(shardElement, config.orbitStartTransform);

            const animation = shardElement.animate([
                { transform: startTransform },
                { transform: 'translate(0px, 0px) rotate(0deg) scale(1)' },
            ], {
                duration: CLOSE_DURATION_MS,
                delay: reverseIndex * BREAKOUT_STAGGER_MS,
                easing: 'cubic-bezier(0.4, 0, 0.9, 1)',
                fill: 'forwards',
            });

            track(animation);
            animations.push(
                animation.finished
                    .catch(() => null)
                    .finally(() => {
                        try {
                            animation.cancel();
                        } catch {
                            // ignored
                        }
                        shardElement.style.transform = '';
                    })
            );
        });

        await Promise.all(animations);
    }

    function cancelAll() {
        activeTimers.forEach((timer) => clearTimeout(timer));
        activeTimers.clear();

        activeAnimations.forEach((animation) => {
            try {
                animation.cancel();
            } catch {
                // ignored
            }
        });
        activeAnimations.clear();

        clearAllShards();
    }

    function destroy() {
        cancelAll();
    }

    return {
        animateOpen,
        animateClose,
        cancelAll,
        destroy,
        getTriggerCenter,
        getTriggerCenterRect,
    };
}
