export const VARIABLES_CSS = `
/* ==========================================================================
   SECTION 1: CSS VARIABLES & THEMING
   ========================================================================== */

#summary-sharder-settings,
#summary-sharder-panel,
.ss-modal,
[class*="ss-"][class*="-modal"],
.popup:has([class*="ss-"][class*="-modal"]),
.popup.ss-owned-popup,
.ss-fab,
.ss-fab-panels,
.ss-fab-generating {
    /* Primary colors */
    --ss-primary: var(--SmartThemeQuoteColor, rgba(198, 198, 198, 1));
    --ss-primary-hover: var(--SmartThemeQuoteColor, rgba(128, 128, 128, 1));
    --ss-primary-active: var(--SmartThemeQuoteColor, rgba(198, 198, 198, 1));

    /* Background colors */
    --ss-bg-primary: var(--SmartThemeBlurTintColor, rgba(0, 0, 0, 0.45));
    --ss-bg-secondary: rgba(0, 0, 0, 0.2);
    --ss-bg-tertiary: rgba(0, 0, 0, 0.3);
    --ss-bg-input: rgba(0, 0, 0, 0.3);

    /* Text colors */
    --ss-text-primary: var(--SmartThemeBodyColor, #ffffff);
    --ss-text-secondary: color-mix(in srgb, var(--ss-text-primary) 72%, transparent);
    --ss-text-muted: color-mix(in srgb, var(--ss-text-primary) 52%, transparent);
    --ss-text-hint: color-mix(in srgb, var(--ss-text-primary) 45%, transparent);
    --ss-quote: var(--SmartThemeQuoteColor, #b4a7d6);

    /* Border colors */
    --ss-border: color-mix(in srgb, var(--ss-text-primary) 16%, transparent);
    --ss-border-focus: var(--ss-primary);

    /* Status colors */
    --ss-success: #4caf50;
    --ss-warning: #ff9800;
    --ss-error: #f44336;
    --ss-info: #2196f3;

    /* Shadows */
    --ss-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    --ss-shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.4);

    /* Effects */
    --ss-highlight: color-mix(in srgb, var(--ss-primary) 22%, transparent);
    --ss-overlay-bg: rgba(0, 0, 0, 0.6);
    --ss-focus-glow: color-mix(in srgb, var(--ss-primary) 28%, transparent);
    --ss-nsfw-accent: #ff6b9d;
    --ss-consolidation: #9b59b6;

    /* Motion */
    --ss-transition: 0.2s ease;

    /* Action buttons */
    --ss-rescue-bg: #9b59b6;
    --ss-rescue-bg-hover: #8e44ad;
    --ss-stop-bg: #e74c3c;
    --ss-stop-hover: #c0392b;

    /* Weight colors */
    --ss-weight-critical: #ff4444;
    --ss-weight-major: #ff8c00;
    --ss-weight-moderate: #ffd700;
    --ss-weight-minor: #90ee90;
    --ss-weight-trivial: #d3d3d3;

    /* Font aliases used across modules */
    --ss-font-secondary: var(--ss-font-primary, var(--mainFontFamily, inherit));
    --ss-font-size-secondary: var(--ss-font-size-primary, var(--mainFontSize, inherit));
    --ss-font-muted: var(--ss-font-primary, var(--mainFontFamily, inherit));
    --ss-font-size-muted: 0.9em;
    --ss-font-hint: var(--ss-font-primary, var(--mainFontFamily, inherit));
    --ss-font-size-hint: 0.85em;
}

/* Font normalization for SS surfaces */
#summary-sharder-settings,
#summary-sharder-panel,
.ss-modal,
[class*="ss-"][class*="-modal"],
.popup:has([class*="ss-"][class*="-modal"]),
.popup.ss-owned-popup,
.ss-fab,
.ss-fab-panels {
    font-family: var(--ss-font-primary, var(--mainFontFamily, var(--mainFont, inherit)));
    font-size: var(--ss-font-size-primary, var(--mainFontSize, inherit));
}

#summary-sharder-settings :is(button, input, select, textarea),
#summary-sharder-panel :is(button, input, select, textarea),
.ss-modal :is(button, input, select, textarea),
[class*="ss-"][class*="-modal"] :is(button, input, select, textarea),
.popup:has([class*="ss-"][class*="-modal"]) :is(button, input, select, textarea),
.popup.ss-owned-popup :is(button, input, select, textarea),
.ss-fab-panels :is(button, input, select, textarea) {
    font-family: inherit;
    font-size: inherit;
}

/* ==========================================================================
   SECTION 2: THIRD-PARTY THEME DEFENSE
   Scoped overrides with !important to protect SS form elements from
   aggressive global selectors (e.g. Moonlit Echoes Theme's unscoped
   input[type="range"] / input[type="checkbox"] rules).
   ========================================================================== */

/* Range sliders */
#summary-sharder-settings input[type="range"],
#summary-sharder-panel input[type="range"],
.ss-modal input[type="range"],
[class*="ss-"][class*="-modal"] input[type="range"],
.popup:has([class*="ss-"][class*="-modal"]) input[type="range"],
.ss-fab input[type="range"],
.ss-fab-panels input[type="range"],
.ss-fab-generating input[type="range"] {
    background: var(--ss-border) !important;
    box-shadow: none !important;
    filter: none !important;
    outline: none !important;
}

#summary-sharder-settings .ss-range-pair,
#summary-sharder-panel .ss-range-pair,
.ss-modal .ss-range-pair,
[class*="ss-"][class*="-modal"] .ss-range-pair,
.popup:has([class*="ss-"][class*="-modal"]) .ss-range-pair,
.ss-fab .ss-range-pair,
.ss-fab-panels .ss-range-pair,
.ss-fab-generating .ss-range-pair {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto auto !important;
    column-gap: 8px !important;
    align-items: center !important;
}

#summary-sharder-settings .ss-range-number,
#summary-sharder-panel .ss-range-number,
.ss-modal .ss-range-number,
[class*="ss-"][class*="-modal"] .ss-range-number,
.popup:has([class*="ss-"][class*="-modal"]) .ss-range-number,
.ss-fab .ss-range-number,
.ss-fab-panels .ss-range-number,
.ss-fab-generating .ss-range-number {
    width: 6ch !important;
    min-width: 6ch !important;
    text-align: right !important;
}

#summary-sharder-settings .ss-range-unit,
#summary-sharder-panel .ss-range-unit,
.ss-modal .ss-range-unit,
[class*="ss-"][class*="-modal"] .ss-range-unit,
.popup:has([class*="ss-"][class*="-modal"]) .ss-range-unit,
.ss-fab .ss-range-unit,
.ss-fab-panels .ss-range-unit,
.ss-fab-generating .ss-range-unit {
    white-space: nowrap !important;
}

/* Range slider thumbs */
#summary-sharder-settings input[type="range"]::-webkit-slider-thumb,
#summary-sharder-panel input[type="range"]::-webkit-slider-thumb,
.ss-modal input[type="range"]::-webkit-slider-thumb,
[class*="ss-"][class*="-modal"] input[type="range"]::-webkit-slider-thumb,
.popup:has([class*="ss-"][class*="-modal"]) input[type="range"]::-webkit-slider-thumb,
.ss-fab input[type="range"]::-webkit-slider-thumb,
.ss-fab-panels input[type="range"]::-webkit-slider-thumb,
.ss-fab-generating input[type="range"]::-webkit-slider-thumb {
    background: var(--ss-primary) !important;
    border: 2px solid var(--ss-bg-primary) !important;
    box-shadow: none !important;
}

/* Checkboxes */
#summary-sharder-settings input[type="checkbox"],
#summary-sharder-panel input[type="checkbox"],
.ss-modal input[type="checkbox"],
[class*="ss-"][class*="-modal"] input[type="checkbox"],
.popup:has([class*="ss-"][class*="-modal"]) input[type="checkbox"],
.ss-fab input[type="checkbox"],
.ss-fab-panels input[type="checkbox"],
.ss-fab-generating input[type="checkbox"] {
    accent-color: var(--ss-primary) !important;
}

/* Checkbox labels: custom skin to avoid host-theme checkbox/tick overrides */
#summary-sharder-settings .checkbox_label input[type="checkbox"],
#summary-sharder-panel .checkbox_label input[type="checkbox"],
.ss-modal .checkbox_label input[type="checkbox"],
[class*="ss-"][class*="-modal"] .checkbox_label input[type="checkbox"],
.popup:has([class*="ss-"][class*="-modal"]) .checkbox_label input[type="checkbox"],
.ss-fab .checkbox_label input[type="checkbox"],
.ss-fab-panels .checkbox_label input[type="checkbox"],
.ss-fab-generating .checkbox_label input[type="checkbox"] {
    appearance: none !important;
    -webkit-appearance: none !important;
    width: 16px !important;
    height: 16px !important;
    min-width: 16px !important;
    margin: 0 !important;
    border-radius: 3px !important;
    border: 1px solid var(--ss-border) !important;
    background: var(--ss-bg-tertiary) !important;
    box-shadow: none !important;
    filter: none !important;
    display: inline-grid !important;
    place-content: center !important;
    cursor: pointer !important;
    position: relative !important;
}

#summary-sharder-settings .checkbox_label input[type="checkbox"]::before,
#summary-sharder-panel .checkbox_label input[type="checkbox"]::before,
.ss-modal .checkbox_label input[type="checkbox"]::before,
[class*="ss-"][class*="-modal"] .checkbox_label input[type="checkbox"]::before,
.popup:has([class*="ss-"][class*="-modal"]) .checkbox_label input[type="checkbox"]::before,
.ss-fab .checkbox_label input[type="checkbox"]::before,
.ss-fab-panels .checkbox_label input[type="checkbox"]::before,
.ss-fab-generating .checkbox_label input[type="checkbox"]::before {
    content: '' !important;
    width: 9px !important;
    height: 9px !important;
    transform: scale(0) !important;
    transition: transform var(--ss-transition) !important;
    clip-path: polygon(14% 44%, 0 59%, 43% 100%, 100% 22%, 84% 8%, 43% 69%) !important;
    background: var(--ss-bg-primary) !important;
}

#summary-sharder-settings .checkbox_label input[type="checkbox"]:checked,
#summary-sharder-panel .checkbox_label input[type="checkbox"]:checked,
.ss-modal .checkbox_label input[type="checkbox"]:checked,
[class*="ss-"][class*="-modal"] .checkbox_label input[type="checkbox"]:checked,
.popup:has([class*="ss-"][class*="-modal"]) .checkbox_label input[type="checkbox"]:checked,
.ss-fab .checkbox_label input[type="checkbox"]:checked,
.ss-fab-panels .checkbox_label input[type="checkbox"]:checked,
.ss-fab-generating .checkbox_label input[type="checkbox"]:checked {
    background: var(--ss-primary) !important;
    border-color: var(--ss-primary) !important;
}

#summary-sharder-settings .checkbox_label input[type="checkbox"]:checked::before,
#summary-sharder-panel .checkbox_label input[type="checkbox"]:checked::before,
.ss-modal .checkbox_label input[type="checkbox"]:checked::before,
[class*="ss-"][class*="-modal"] .checkbox_label input[type="checkbox"]:checked::before,
.popup:has([class*="ss-"][class*="-modal"]) .checkbox_label input[type="checkbox"]:checked::before,
.ss-fab .checkbox_label input[type="checkbox"]:checked::before,
.ss-fab-panels .checkbox_label input[type="checkbox"]:checked::before,
.ss-fab-generating .checkbox_label input[type="checkbox"]:checked::before {
    transform: scale(1) !important;
}

#summary-sharder-settings .checkbox_label input[type="checkbox"]:focus-visible,
#summary-sharder-panel .checkbox_label input[type="checkbox"]:focus-visible,
.ss-modal .checkbox_label input[type="checkbox"]:focus-visible,
[class*="ss-"][class*="-modal"] .checkbox_label input[type="checkbox"]:focus-visible,
.popup:has([class*="ss-"][class*="-modal"]) .checkbox_label input[type="checkbox"]:focus-visible,
.ss-fab .checkbox_label input[type="checkbox"]:focus-visible,
.ss-fab-panels .checkbox_label input[type="checkbox"]:focus-visible,
.ss-fab-generating .checkbox_label input[type="checkbox"]:focus-visible {
    outline: 1px solid var(--ss-border-focus) !important;
    outline-offset: 2px !important;
}

#summary-sharder-settings .checkbox_label input[type="checkbox"]:disabled,
#summary-sharder-panel .checkbox_label input[type="checkbox"]:disabled,
.ss-modal .checkbox_label input[type="checkbox"]:disabled,
[class*="ss-"][class*="-modal"] .checkbox_label input[type="checkbox"]:disabled,
.popup:has([class*="ss-"][class*="-modal"]) .checkbox_label input[type="checkbox"]:disabled,
.ss-fab .checkbox_label input[type="checkbox"]:disabled,
.ss-fab-panels .checkbox_label input[type="checkbox"]:disabled,
.ss-fab-generating .checkbox_label input[type="checkbox"]:disabled {
    opacity: 0.6 !important;
    cursor: not-allowed !important;
}

/* Tag controls */
#summary-sharder-settings .ss-tag-input,
#summary-sharder-panel .ss-tag-input,
.ss-modal .ss-tag-input,
[class*="ss-"][class*="-modal"] .ss-tag-input,
.popup:has([class*="ss-"][class*="-modal"]) .ss-tag-input,
.ss-fab .ss-tag-input,
.ss-fab-panels .ss-tag-input,
.ss-fab-generating .ss-tag-input {
    background: var(--ss-bg-input) !important;
    border: 1px solid var(--ss-border) !important;
    box-shadow: none !important;
    filter: none !important;
}

#summary-sharder-settings .ss-tag-remove,
#summary-sharder-panel .ss-tag-remove,
.ss-modal .ss-tag-remove,
[class*="ss-"][class*="-modal"] .ss-tag-remove,
.popup:has([class*="ss-"][class*="-modal"]) .ss-tag-remove,
.ss-fab .ss-tag-remove,
.ss-fab-panels .ss-tag-remove,
.ss-fab-generating .ss-tag-remove {
    appearance: none !important;
    -webkit-appearance: none !important;
    border: none !important;
    background: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
    filter: none !important;
    color: inherit !important;
    text-shadow: none !important;
    font-family: inherit !important;
    text-transform: none !important;
    text-decoration: none !important;
    padding: 0 !important;
    margin: 0 !important;
    line-height: 1 !important;
}

#summary-sharder-settings .ss-tag,
#summary-sharder-panel .ss-tag,
.ss-modal .ss-tag,
[class*="ss-"][class*="-modal"] .ss-tag,
.popup:has([class*="ss-"][class*="-modal"]) .ss-tag,
.ss-fab .ss-tag,
.ss-fab-panels .ss-tag,
.ss-fab-generating .ss-tag {
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
    padding: 2px 8px !important;
    border-radius: 3px !important;
    background:
        linear-gradient(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.08)),
        var(--ss-bg-secondary) !important;
    border: 1px solid var(--ss-border) !important;
}

#summary-sharder-settings .ss-tag-input-field,
#summary-sharder-settings .ss-tag-input input,
#summary-sharder-panel .ss-tag-input-field,
#summary-sharder-panel .ss-tag-input input,
.ss-modal .ss-tag-input-field,
.ss-modal .ss-tag-input input,
[class*="ss-"][class*="-modal"] .ss-tag-input-field,
[class*="ss-"][class*="-modal"] .ss-tag-input input,
.popup:has([class*="ss-"][class*="-modal"]) .ss-tag-input-field,
.popup:has([class*="ss-"][class*="-modal"]) .ss-tag-input input,
.ss-fab .ss-tag-input-field,
.ss-fab .ss-tag-input input,
.ss-fab-panels .ss-tag-input-field,
.ss-fab-panels .ss-tag-input input,
.ss-fab-generating .ss-tag-input-field,
.ss-fab-generating .ss-tag-input input {
    appearance: none !important;
    -webkit-appearance: none !important;
    background: transparent !important;
    background-image: none !important;
    border: none !important;
    box-shadow: none !important;
    filter: none !important;
}

/* Links */
#summary-sharder-settings a,
#summary-sharder-panel a,
.ss-modal a,
[class*="ss-"][class*="-modal"] a,
.popup:has([class*="ss-"][class*="-modal"]) a,
.ss-fab a,
.ss-fab-panels a,
.ss-fab-generating a {
    color: var(--ss-primary) !important;
}

#summary-sharder-settings a:hover,
#summary-sharder-panel a:hover,
.ss-modal a:hover,
[class*="ss-"][class*="-modal"] a:hover,
.popup:has([class*="ss-"][class*="-modal"]) a:hover,
.ss-fab a:hover,
.ss-fab-panels a:hover,
.ss-fab-generating a:hover {
    color: var(--ss-primary-hover) !important;
}

/* Text selection */
#summary-sharder-settings ::selection,
#summary-sharder-panel ::selection,
.ss-modal ::selection,
[class*="ss-"][class*="-modal"] ::selection,
.popup:has([class*="ss-"][class*="-modal"]) ::selection,
.ss-fab ::selection,
.ss-fab-panels ::selection,
.ss-fab-generating ::selection {
    background-color: var(--ss-highlight) !important;
}

/* Headings */
#summary-sharder-settings :is(h1, h3),
#summary-sharder-panel :is(h1, h3),
.ss-modal :is(h1, h3),
[class*="ss-"][class*="-modal"] :is(h1, h3),
.popup:has([class*="ss-"][class*="-modal"]) :is(h1, h3),
.ss-fab :is(h1, h3),
.ss-fab-panels :is(h1, h3),
.ss-fab-generating :is(h1, h3) {
    color: var(--ss-text-primary) !important;
    border-color: var(--ss-border) !important;
}

/* Textarea caret */
#summary-sharder-settings textarea,
#summary-sharder-panel textarea,
.ss-modal textarea,
[class*="ss-"][class*="-modal"] textarea,
.popup:has([class*="ss-"][class*="-modal"]) textarea,
.ss-fab textarea,
.ss-fab-panels textarea,
.ss-fab-generating textarea {
    caret-color: var(--ss-primary) !important;
}

.ss-hidden {
    display: none !important;
}
`;
