export const FAB_CSS = `
/* ======================================================================
   FLOATING ACTION BUTTON (FAB) - Crystal Trigger
   ====================================================================== */
.ss-fab {
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 9999;
}

.ss-fab-trigger {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--ss-primary) 68%, black);
    background: color-mix(in srgb, var(--ss-bg-primary) 94%, transparent);
    color: var(--ss-text-primary);
    font-size: 20px;
    cursor: grab;
    box-shadow: var(--ss-shadow-lg, 0 4px 12px rgba(0, 0, 0, 0.3));
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--ss-transition, 0.16s ease), transform 0.16s ease, border-color 0.16s ease;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    position: relative;
    overflow: visible;
}

.ss-fab:not(.ss-fab-generating) .ss-fab-trigger::before,
.ss-fab:not(.ss-fab-generating) .ss-fab-trigger::after {
    content: none;
}

.ss-fab.ss-fab-open .ss-fab-trigger {
    border-color: color-mix(in srgb, var(--ss-primary) 84%, white 6%);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.42);
}

.ss-fab-trigger:hover {
    background: color-mix(in srgb, var(--ss-bg-secondary) 88%, transparent);
    transform: scale(1.06);
}

.ss-fab-trigger:active,
.ss-fab-dragging .ss-fab-trigger {
    cursor: grabbing;
    transform: scale(0.95);
}

.ss-crystal-icon {
    width: 28px;
    height: 28px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}

.ss-crystal-icon svg {
    width: 100%;
    height: 100%;
    overflow: visible;
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--ss-primary) 50%, transparent));
    animation: ss-crystal-idle-glow 2.8s ease-in-out infinite;
}

.ss-crystal-shard {
    fill: var(--ss-text-primary);
    stroke: var(--ss-bg-secondary);
    stroke-width: 0.3;
    transform-origin: center;
    transform-box: fill-box;
    will-change: transform, opacity;
}

.ss-crystal-shard--1 { opacity: 1; }
.ss-crystal-shard--2 { opacity: 0.92; }
.ss-crystal-shard--3 { opacity: 0.78; }
.ss-crystal-shard--4 { opacity: 0.86; }
.ss-crystal-shard--5a { opacity: 0.74; }
.ss-crystal-shard--5b { opacity: 0.8; }

@keyframes ss-crystal-idle-glow {
    0%, 100% { filter: drop-shadow(0 0 3px color-mix(in srgb, var(--ss-primary) 44%, transparent)); }
    50% { filter: drop-shadow(0 0 10px color-mix(in srgb, var(--ss-primary) 68%, transparent)); }
}

/* ======================================================================
   SHARD ORBITS (open state)
   ====================================================================== */
.ss-fab.ss-fab-open .ss-crystal-shard.ss-shard-orbit-1 { animation: ss-shard-orbit-1 2.2s linear infinite; }
.ss-fab.ss-fab-open .ss-crystal-shard.ss-shard-orbit-2 { animation: ss-shard-orbit-2 2.9s linear infinite reverse; }
.ss-fab.ss-fab-open .ss-crystal-shard.ss-shard-orbit-3 { animation: ss-shard-orbit-3 3.4s linear infinite; }
.ss-fab.ss-fab-open .ss-crystal-shard.ss-shard-orbit-4 { animation: ss-shard-orbit-4 2.6s linear infinite reverse; }
.ss-fab.ss-fab-open .ss-crystal-shard.ss-shard-orbit-5a { animation: ss-shard-orbit-5a 3.8s linear infinite; }
.ss-fab.ss-fab-open .ss-crystal-shard.ss-shard-orbit-5b { animation: ss-shard-orbit-5b 2.4s linear infinite reverse; }

@keyframes ss-shard-orbit-1 {
    0% { transform: translate(-8px, -3px) rotate(0deg); }
    25% { transform: translate(-3px, -11px) rotate(80deg); }
    50% { transform: translate(8px, -2px) rotate(170deg); }
    75% { transform: translate(2px, 9px) rotate(260deg); }
    100% { transform: translate(-8px, -3px) rotate(360deg); }
}

@keyframes ss-shard-orbit-2 {
    0% { transform: translate(11px, -1px) rotate(0deg); }
    25% { transform: translate(6px, -12px) rotate(-95deg); }
    50% { transform: translate(-8px, -3px) rotate(-185deg); }
    75% { transform: translate(-3px, 9px) rotate(-275deg); }
    100% { transform: translate(11px, -1px) rotate(-360deg); }
}

@keyframes ss-shard-orbit-3 {
    0% { transform: translate(-10px, 6px) rotate(0deg); }
    25% { transform: translate(-15px, -2px) rotate(90deg); }
    50% { transform: translate(3px, -7px) rotate(180deg); }
    75% { transform: translate(13px, 4px) rotate(270deg); }
    100% { transform: translate(-10px, 6px) rotate(360deg); }
}

@keyframes ss-shard-orbit-4 {
    0% { transform: translate(9px, 7px) rotate(0deg); }
    25% { transform: translate(14px, -2px) rotate(-95deg); }
    50% { transform: translate(-2px, -10px) rotate(-190deg); }
    75% { transform: translate(-13px, 3px) rotate(-280deg); }
    100% { transform: translate(9px, 7px) rotate(-360deg); }
}

@keyframes ss-shard-orbit-5a {
    0% { transform: translate(-3px, 12px) rotate(0deg); }
    25% { transform: translate(-12px, 8px) rotate(86deg); }
    50% { transform: translate(-10px, -6px) rotate(170deg); }
    75% { transform: translate(8px, -8px) rotate(258deg); }
    100% { transform: translate(-3px, 12px) rotate(360deg); }
}

@keyframes ss-shard-orbit-5b {
    0% { transform: translate(4px, 13px) rotate(0deg); }
    25% { transform: translate(13px, 7px) rotate(-88deg); }
    50% { transform: translate(10px, -7px) rotate(-172deg); }
    75% { transform: translate(-9px, -9px) rotate(-265deg); }
    100% { transform: translate(4px, 13px) rotate(-360deg); }
}

/* ======================================================================
   GENERATING STATE
   ====================================================================== */
.ss-fab-generating .ss-crystal-icon svg {
    animation: ss-crystal-generating-glow 2s ease-in-out infinite;
}

@keyframes ss-crystal-generating-glow {
    0%, 100% { filter: drop-shadow(0 0 4px color-mix(in srgb, var(--ss-primary) 48%, transparent)); }
    25% { filter: drop-shadow(0 0 14px color-mix(in srgb, var(--ss-primary) 70%, transparent)); }
    50% { filter: drop-shadow(0 0 7px color-mix(in srgb, var(--ss-primary) 52%, transparent)); }
    75% { filter: drop-shadow(0 0 14px color-mix(in srgb, var(--ss-primary) 70%, transparent)); }
}

.ss-fab-generating .ss-crystal-shard--1 {
    animation: ss-shard-1 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.ss-fab-generating .ss-crystal-shard--2 {
    animation: ss-shard-2 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.05s;
}

.ss-fab-generating .ss-crystal-shard--3 {
    animation: ss-shard-3 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.1s;
}

.ss-fab-generating .ss-crystal-shard--4 {
    animation: ss-shard-4 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.15s;
}

.ss-fab-generating .ss-crystal-shard--5a {
    animation: ss-shard-5a 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.08s;
}

.ss-fab-generating .ss-crystal-shard--5b {
    animation: ss-shard-5b 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite 0.11s;
}

@keyframes ss-shard-1 {
    0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
    15% { transform: translate(-8px, -10px) rotate(-15deg); opacity: 0.9; }
    30% { transform: translate(-12px, -6px) rotate(-40deg); opacity: 0.8; }
    50% { transform: translate(-6px, 8px) rotate(-180deg); opacity: 0.7; }
    70% { transform: translate(4px, 10px) rotate(-300deg); opacity: 0.8; }
    85% { transform: translate(2px, 3px) rotate(-345deg); opacity: 0.9; }
    100% { transform: translate(0, 0) rotate(-360deg); opacity: 1; }
}

@keyframes ss-shard-2 {
    0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
    15% { transform: translate(9px, -9px) rotate(20deg); opacity: 0.9; }
    30% { transform: translate(13px, -3px) rotate(50deg); opacity: 0.8; }
    50% { transform: translate(5px, 10px) rotate(180deg); opacity: 0.7; }
    70% { transform: translate(-5px, 8px) rotate(310deg); opacity: 0.8; }
    85% { transform: translate(-1px, 2px) rotate(350deg); opacity: 0.9; }
    100% { transform: translate(0, 0) rotate(360deg); opacity: 1; }
}

@keyframes ss-shard-3 {
    0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
    15% { transform: translate(-11px, 2px) rotate(-25deg); opacity: 0.9; }
    30% { transform: translate(-9px, 9px) rotate(-60deg); opacity: 0.75; }
    50% { transform: translate(6px, 12px) rotate(-200deg); opacity: 0.7; }
    70% { transform: translate(10px, -2px) rotate(-320deg); opacity: 0.8; }
    85% { transform: translate(3px, -1px) rotate(-350deg); opacity: 0.9; }
    100% { transform: translate(0, 0) rotate(-360deg); opacity: 1; }
}

@keyframes ss-shard-4 {
    0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
    15% { transform: translate(10px, 4px) rotate(18deg); opacity: 0.9; }
    30% { transform: translate(11px, 10px) rotate(55deg); opacity: 0.75; }
    50% { transform: translate(-4px, 13px) rotate(190deg); opacity: 0.7; }
    70% { transform: translate(-9px, -3px) rotate(315deg); opacity: 0.8; }
    85% { transform: translate(-2px, -1px) rotate(352deg); opacity: 0.9; }
    100% { transform: translate(0, 0) rotate(360deg); opacity: 1; }
}

@keyframes ss-shard-5a {
    0% { transform: translate(0, 0) rotate(0deg); opacity: 0.7; }
    15% { transform: translate(-3px, 12px) rotate(-8deg); opacity: 0.8; }
    30% { transform: translate(-10px, 12px) rotate(-40deg); opacity: 0.72; }
    50% { transform: translate(-13px, 1px) rotate(-170deg); opacity: 0.65; }
    70% { transform: translate(1px, -8px) rotate(-292deg); opacity: 0.74; }
    85% { transform: translate(1px, -2px) rotate(-348deg); opacity: 0.78; }
    100% { transform: translate(0, 0) rotate(-360deg); opacity: 0.7; }
}

@keyframes ss-shard-5b {
    0% { transform: translate(0, 0) rotate(0deg); opacity: 0.78; }
    15% { transform: translate(3px, 11px) rotate(10deg); opacity: 0.86; }
    30% { transform: translate(9px, 13px) rotate(42deg); opacity: 0.8; }
    50% { transform: translate(12px, 2px) rotate(176deg); opacity: 0.7; }
    70% { transform: translate(-2px, -8px) rotate(298deg); opacity: 0.8; }
    85% { transform: translate(-1px, -2px) rotate(350deg); opacity: 0.84; }
    100% { transform: translate(0, 0) rotate(360deg); opacity: 0.78; }
}

.ss-fab-generating .ss-fab-trigger::before,
.ss-fab-generating .ss-fab-trigger::after {
    content: '';
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--ss-primary) 80%, white);
    pointer-events: none;
}

.ss-fab-generating .ss-fab-trigger::before {
    animation: ss-sparkle-orbit-a 2.4s linear infinite;
}

.ss-fab-generating .ss-fab-trigger::after {
    animation: ss-sparkle-orbit-b 2.4s linear infinite 1.2s;
}

@keyframes ss-sparkle-orbit-a {
    0% { transform: translate(0, -20px) scale(0); opacity: 0; }
    10% { transform: translate(12px, -16px) scale(1); opacity: 1; }
    40% { transform: translate(18px, 8px) scale(0.7); opacity: 0.6; }
    70% { transform: translate(-14px, 14px) scale(0.4); opacity: 0.3; }
    100% { transform: translate(-18px, -10px) scale(0); opacity: 0; }
}

@keyframes ss-sparkle-orbit-b {
    0% { transform: translate(0, 18px) scale(0); opacity: 0; }
    10% { transform: translate(-14px, 12px) scale(1); opacity: 1; }
    40% { transform: translate(-16px, -10px) scale(0.7); opacity: 0.6; }
    70% { transform: translate(12px, -16px) scale(0.4); opacity: 0.3; }
    100% { transform: translate(16px, 12px) scale(0); opacity: 0; }
}

@media (max-width: 768px) {
    .ss-fab-trigger {
        width: 56px;
        height: 56px;
        font-size: 22px;
    }
}
`;
