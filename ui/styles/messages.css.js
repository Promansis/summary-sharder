export const MESSAGES_CSS = `
/* Use input/primary background so default theme doesn't end up fully transparent */
    background: var(--ss-bg-input) !important;
    border: 1px solid var(--ss-border) !important;
    border-radius: 4px !important;
    box-shadow: var(--ss-shadow-lg) !important;
    max-height: 300px;
    overflow: hidden;
    z-index: 1000;
    flex-direction: column;
}

.ss-dropdown-menu.open {
    display: flex;
}

.ss-dropdown-search {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 8px !important;
    border-bottom: 1px solid var(--ss-border) !important;
    background: var(--ss-bg-input) !important;
    flex-shrink: 0;
}

.ss-dropdown-search input[type="text"],
.ss-dropdown-menu .ss-dropdown-search input,
#summary-sharder-settings input[id$="-search"],
#summary-sharder-panel input[id$="-search"],
.ss-modal input[id$="-search"],
[class*="ss-"][class*="-modal"] input[id$="-search"],
[class*="ss-"][class*="-dropdown-container"] input[id$="-search"] {
    width: 100% !important;
    height: 36px !important;
    max-height: none !important;
    min-height: 36px !important;
    padding: 8px 12px !important;
    margin: 0 !important;
    background: var(--ss-bg-input) !important;
    color: var(--ss-text-primary) !important;
    border: 1px solid var(--ss-border) !important;
    border-radius: 4px !important;
    box-sizing: border-box !important;
    font-size: 14px !important;
    line-height: 1.4 !important;
    outline: none !important;
}

.ss-dropdown-search input[type="text"]:focus,
[class*="ss-"][class*="-dropdown-container"] input[id$="-search"]:focus {
    border-color: var(--ss-border-focus) !important;
    box-shadow: 0 0 0 2px var(--ss-focus-glow) !important;
}

.ss-dropdown-search input::placeholder,
[class*="ss-"][class*="-dropdown-container"] input[id$="-search"]::placeholder {
    color: var(--ss-text-muted) !important;
    opacity: 0.7;
}

.ss-dropdown-options {
    overflow-y: auto;
    max-height: 250px;
    flex: 1;
}

.ss-dropdown-option {
    padding: 8px 12px !important;
    cursor: pointer;
    color: var(--ss-text-primary) !important;
    border-bottom: 1px solid var(--ss-border);
    display: flex !important;
    align-items: center !important;
    gap: 10px !important;
    background: transparent;
    transition: background 0.15s ease;
}

.ss-dropdown-option:last-child {
    border-bottom: none;
}

.ss-dropdown-option:hover {
    background: var(--ss-highlight) !important;
}

.ss-dropdown-option.selected {
    background: var(--ss-primary) !important;
    color: white !important;
}

.ss-dropdown-option-avatar,
.ss-dropdown-option img {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
    min-height: 32px !important;
    max-width: 32px !important;
    max-height: 32px !important;
    border-radius: 50% !important;
    object-fit: cover !important;
    flex-shrink: 0 !important;
}

.ss-dropdown-option-name,
.ss-dropdown-option .ss-option-name {
    color: inherit;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    margin-right: 10px;
}

.ss-dropdown-option .ss-option-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
    flex-shrink: 0;
}

.ss-dropdown-empty {
    padding: 12px !important;
    color: var(--ss-text-muted) !important;
    text-align: center;
    font-style: italic;
}

.ss-character-dropdown-container.disabled .ss-dropdown-trigger,
.ss-chat-dropdown-container.disabled .ss-dropdown-trigger {
    opacity: 0.6;
    cursor: not-allowed;
    background: var(--ss-bg-tertiary) !important;
}

/* Selected Tags (Multi-select) */
.ss-selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
    min-height: 30px;
    align-items: center;
}

.ss-selected-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    background: var(--ss-primary);
    border-radius: 3px;
    font-size: 12px;
    color: white;
}

.ss-selected-tag .ss-tag-remove {
    cursor: pointer;
    font-size: 14px;
    opacity: 0.7;
    line-height: 1;
}

.ss-selected-tag .ss-tag-remove:hover {
    opacity: 1;
}

/* Chat/Character Option Info */
.ss-chat-option-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.ss-chat-option-name {
    color: var(--ss-text-primary);
    font-weight: 500;
}

.ss-chat-option-details {
    color: var(--ss-text-muted);
    font-family: var(--ss-font-muted, inherit);
    font-size: var(--ss-font-size-muted, 0.85em);
}

.ss-char-option-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.ss-char-option-info img {
    width: 32px !important;
    height: 32px !important;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.ss-char-option-name {
    color: var(--ss-text-primary);
}

/* ==========================================================================
   SECTION 8: MESSAGE STYLING
   ========================================================================== */

.mes.ss-summarized {
    opacity: 0.4;
    border-left: 3px solid var(--ss-warning);
    transition: opacity 0.3s ease;
}

.mes.ss-summarized:hover {
    opacity: 0.8;
}

.mes.ss-hidden {
    display: none !important;
}

.ss-text-hidden {
    display: none !important;
}

.mes.ss-collapsed .mes_text {
    display: none;
}

/* ==========================================================================
   SECTION 23: WEIGHT INDICATORS
   ========================================================================== */

.ss-weight-critical,
.ss-weight-5 {
    color: var(--ss-weight-critical) !important;
}

.ss-weight-major,
.ss-weight-4 {
    color: var(--ss-weight-major) !important;
}

.ss-weight-moderate,
.ss-weight-3 {
    color: var(--ss-weight-moderate) !important;
}

.ss-weight-minor,
.ss-weight-2 {
    color: var(--ss-weight-minor) !important;
}

.ss-weight-trivial,
.ss-weight-1 {
    color: var(--ss-weight-trivial) !important;
}

.ss-weight-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
}

.ss-weight-badge.critical {
    background: rgba(255, 68, 68, 0.2);
    border: 1px solid var(--ss-weight-critical);
}

.ss-weight-badge.major {
    background: rgba(255, 140, 0, 0.2);
    border: 1px solid var(--ss-weight-major);
}

.ss-weight-badge.moderate {
    background: rgba(255, 215, 0, 0.2);
    border: 1px solid var(--ss-weight-moderate);
}

.ss-weight-badge.minor {
    background: rgba(144, 238, 144, 0.2);
    border: 1px solid var(--ss-weight-minor);
}

.ss-weight-badge.trivial {
    background: rgba(211, 211, 211, 0.2);
    border: 1px solid var(--ss-weight-trivial);
}

/* ==========================================================================
   SECTION 24: NSFW CONTENT
   ========================================================================== */

.ss-nsfw-badge,
.ss-nsfw-indicator {
    background: var(--ss-nsfw-accent);
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
}

.ss-nsfw-section {
    border-left: 3px solid var(--ss-nsfw-accent);
    background: rgba(255, 107, 157, 0.1);
}

.ss-nsfw-warning {
    color: var(--ss-nsfw-accent);
    font-weight: 600;
}

/* ==========================================================================
   SECTION 25: QUOTES & DIALOGUE
   ========================================================================== */

.ss-quote,
.ss-dialogue {
    color: var(--ss-quote);
    font-style: italic;
    border-left: 2px solid var(--ss-quote);
    padding-left: 10px;
    margin: 5px 0;
}

.ss-speaker {
    color: var(--ss-text-primary);
    font-weight: 600;
    font-style: normal;
}

/* ==========================================================================
   SECTION 26: STATS DISPLAY
   ========================================================================== */

.ss-stats {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
}

.ss-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
}
`;
