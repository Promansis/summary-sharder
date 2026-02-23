/**
 * Message visibility management for Summary Sharder
 */

import { getChatRanges, saveChatRanges } from '../settings.js';
import { chat, saveChatConditional, refreshSwipeButtons } from '../../../../../../script.js';

// Import flag setter and timer control to prevent MutationObserver cascade
import { setApplyingVisibility, clearPendingVisibilityTimers } from './visibility-state.js';

/**
 * Parse and normalize a comma-separated list of names
 * @param {string} namesStr - Comma-separated names
 * @returns {Array<string>} Array of lowercase, trimmed names
 */
function parseIgnoreNames(namesStr) {
    if (!namesStr || typeof namesStr !== 'string') {
        return [];
    }
    return namesStr.split(',')
        .map(name => name.trim().toLowerCase())
        .filter(name => name.length > 0);
}

/**
 * Check if a message should be ignored based on sender name
 * @param {Object} message - Chat message object
 * @param {Array<string>} ignoreNames - Array of lowercase names to ignore
 * @returns {boolean} True if message should be ignored (kept visible)
 */
function shouldIgnoreMessage(message, ignoreNames) {
    if (!message || !message.name || ignoreNames.length === 0) {
        return false;
    }
    return ignoreNames.includes(message.name.toLowerCase());
}

/** Inject the fold button into the name row before .name_text (idempotent). */
function ensureFoldBtn(el) {
    if (el.querySelector('.ss-fold-btn')) return;
    const nameText = el.querySelector('.mes_block .name_text');
    const nameContainer = nameText?.parentElement;
    if (!nameContainer) return;
    const btn = document.createElement('button');
    btn.className = 'ss-fold-btn';
    btn.type = 'button';
    nameContainer.insertBefore(btn, nameText);
}

/** Remove the fold button from a .mes element (idempotent). */
function removeFoldBtn(el) {
    el.querySelector('.ss-fold-btn')?.remove();
}

/**
 * Initialize delegated click handler for collapse toggle.
 * Matches real .ss-fold-btn elements — no layout reads needed.
 */
export function initCollapseHandler() {
    const chatContainer = document.getElementById('chat');
    if (!chatContainer || chatContainer.dataset.ssCollapseInit) return;
    chatContainer.dataset.ssCollapseInit = 'true';

    chatContainer.addEventListener('click', (event) => {
        const btn = event.target.closest('.ss-fold-btn');
        if (!btn) return;

        const message = btn.closest('.mes');
        if (!message) return;

        event.stopPropagation();
        const messageText = message.querySelector('.mes_text');
        if (!messageText) return;

        if (message.classList.contains('ss-collapsed')) {
            message.classList.replace('ss-collapsed', 'ss-expanded');
            messageText.classList.remove('ss-text-hidden');
        } else {
            message.classList.replace('ss-expanded', 'ss-collapsed');
            messageText.classList.add('ss-text-hidden');
        }
    });
}

/**
 * Initialize delegated click handlers to temporarily unfold collapsed messages during edit.
 * This never changes is_system/hidden state; it only toggles collapse classes.
 */
export function initEditUnfoldHandler() {
    const chatContainer = document.getElementById('chat');
    if (!chatContainer || chatContainer.dataset.ssEditUnfoldInit) return;
    chatContainer.dataset.ssEditUnfoldInit = 'true';

    chatContainer.addEventListener('click', (event) => {
        const editBtn = event.target.closest('.mes_edit');
        if (editBtn) {
            const message = editBtn.closest('.mes');
            if (!message || !message.classList.contains('ss-collapsed')) return;

            message.classList.replace('ss-collapsed', 'ss-expanded');
            const messageText = message.querySelector('.mes_text');
            if (messageText) messageText.classList.remove('ss-text-hidden');
            message.dataset.ssEditUnfolded = 'true';
            return;
        }

        const doneOrCancelBtn = event.target.closest('.mes_edit_done, .mes_edit_cancel');
        if (!doneOrCancelBtn) return;

        const message = doneOrCancelBtn.closest('.mes');
        if (!message || message.dataset.ssEditUnfolded !== 'true') return;

        message.classList.replace('ss-expanded', 'ss-collapsed');
        const messageText = message.querySelector('.mes_text');
        if (messageText) messageText.classList.add('ss-text-hidden');
        message.removeAttribute('data-ss-edit-unfolded');
    });
}

/**
 * Apply visibility settings to all summarized message ranges
 * Handles both global toggles, individual range states, and name filtering.
 * Uses a 2-phase approach (compute desired state, then apply) to avoid layout thrashing.
 */
export async function applyVisibilitySettings(settings) {
    clearPendingVisibilityTimers();
    setApplyingVisibility(true);

    try {
        const ranges = getChatRanges();
        const messageElements = document.querySelectorAll('#chat .mes');
        if (!messageElements.length) return;

        // Build element map using EXISTING mesid attributes (set by SillyTavern)
        // DO NOT re-index mesids - SillyTavern may use lazy loading so not all messages are in DOM
        const elementMap = new Map();
        messageElements.forEach(el => {
            const mesid = el.getAttribute('mesid');
            if (mesid !== null) elementMap.set(parseInt(mesid, 10), el);
        });

        const globalIgnoreNames = settings.globalIgnoreNames || '';
        const globalNames = parseIgnoreNames(globalIgnoreNames);
        const shouldCollapse = settings.collapseAll || settings.makeAllInvisible;

        // --- PHASE 1: Compute desired state (no DOM access) ---
        const desiredState = new Map(); // mesid -> { isSystem: bool, collapsed: bool }
        for (let i = 0; i < chat.length; i++) {
            desiredState.set(i, { isSystem: false, collapsed: false });
        }

        // Track which messages are in ignoreCollapse ranges
        const ignoreCollapseSet = new Set();

        for (const range of ranges) {
            if (range.start < 0 || range.end < range.start || range.start >= chat.length) {
                console.warn(`[SummarySharder] Skipping invalid range ${range.start}-${range.end} (chat length: ${chat.length})`);
                continue;
            }

            const effectiveHidden = range.hidden !== undefined ? range.hidden : settings.hideAllSummarized;
            const rangeNames = parseIgnoreNames(range.ignoreNames || '');
            const allIgnoreNames = [...new Set([...globalNames, ...rangeNames])];
            const rangeIgnoreCollapse = range.ignoreCollapse || false;

            for (let i = range.start; i <= range.end && i < chat.length; i++) {
                const message = chat[i];
                if (!message) continue;
                const state = desiredState.get(i);

                if (effectiveHidden) {
                    state.isSystem = !shouldIgnoreMessage(message, allIgnoreNames);
                } else {
                    state.isSystem = false;
                }

                if (rangeIgnoreCollapse) {
                    ignoreCollapseSet.add(i);
                    state.collapsed = false;
                }
            }
        }

        // Apply collapse for hidden messages not in ignoreCollapse ranges
        if (shouldCollapse) {
            for (const [i, state] of desiredState) {
                if (state.isSystem && !ignoreCollapseSet.has(i)) {
                    state.collapsed = true;
                }
            }
        }

        // --- PHASE 2: Apply all changes in a single DOM pass ---
        // Update chat data model
        for (const [i, state] of desiredState) {
            if (chat[i]) chat[i].is_system = state.isSystem;
        }

        // Update DOM elements
        for (const [mesid, el] of elementMap) {
            const state = desiredState.get(mesid);
            if (!state) continue;

            // Reset classes
            el.classList.remove('ss-hidden', 'ss-summarized');

            // Set is_system attribute
            el.setAttribute('is_system', String(state.isSystem));

            // Handle collapse state
            const messageText = el.querySelector('.mes_text');

            if (state.collapsed) {
                el.classList.add('ss-collapsed');
                if (messageText) messageText.classList.add('ss-text-hidden');
                ensureFoldBtn(el);
            } else {
                el.classList.remove('ss-collapsed', 'ss-expanded');
                if (messageText) messageText.classList.remove('ss-text-hidden');
                removeFoldBtn(el);
            }
        }

        refreshSwipeButtons();
        await saveChatConditional();
    } finally {
        setApplyingVisibility(false);
    }
}

/**
 * Apply collapse styling to all currently hidden messages
 * Used after external visibility changes (e.g., /hide command) to sync collapse state
 * @param {Object} settings - Extension settings
 */
export function applyCollapseToHiddenMessages(settings) {
    if (!settings.collapseAll && !settings.makeAllInvisible) {
        return;
    }

    const messageElements = document.querySelectorAll('#chat .mes');
    if (!messageElements.length) return;

    const ignoreNames = parseIgnoreNames(settings.globalIgnoreNames || '');

    for (const el of messageElements) {
        const mesid = el.getAttribute('mesid');
        if (mesid === null) continue;

        const index = parseInt(mesid, 10);
        const message = chat[index];
        if (!message || message.is_system !== true) continue;
        if (shouldIgnoreMessage(message, ignoreNames)) continue;

        el.classList.add('ss-collapsed');
        const messageText = el.querySelector('.mes_text');
        if (messageText) messageText.classList.add('ss-text-hidden');
        ensureFoldBtn(el);
    }
}

/**
 * Expand all messages that are no longer hidden
 * Used after external visibility changes (e.g., /unhide command) to remove collapse styling
 */
export function expandUnhiddenMessages() {
    const messageElements = document.querySelectorAll('#chat .mes');
    if (!messageElements.length) return;

    for (const el of messageElements) {
        const mesid = el.getAttribute('mesid');
        if (mesid === null) continue;

        const index = parseInt(mesid, 10);
        const message = chat[index];

        // If message is not hidden but has collapse/expand styling or fold button, clean it up
        if (message && message.is_system !== true &&
            (el.classList.contains('ss-collapsed') || el.classList.contains('ss-expanded') || el.querySelector('.ss-fold-btn'))) {
            el.classList.remove('ss-collapsed', 'ss-expanded');
            const messageText = el.querySelector('.mes_text');
            if (messageText) messageText.classList.remove('ss-text-hidden');
            removeFoldBtn(el);
        }
    }
}

/**
 * Legacy function for backward compatibility
 * Maps old hideSummarized setting to new hideAllSummarized
 */
export async function applyHideSummarized(settings) {
    if (settings.hideSummarized !== undefined && settings.hideAllSummarized === undefined) {
        settings.hideAllSummarized = settings.hideSummarized;
    }

    return applyVisibilitySettings(settings);
}

/**
 * Detect hidden ranges from current chat messages
 * Scans for consecutive messages where is_system === true
 * @returns {Array} Array of range objects representing hidden message ranges
 */
export function detectHiddenRanges() {
    if (!chat || chat.length === 0) {
        return [];
    }

    const ranges = [];
    let rangeStart = null;

    for (let i = 0; i < chat.length; i++) {
        const message = chat[i];
        if (!message) continue;

        if (message.is_system) {
            // Start new range or continue existing
            if (rangeStart === null) {
                rangeStart = i;
            }
        } else {
            // End of hidden range
            if (rangeStart !== null) {
                ranges.push({
                    start: rangeStart,
                    end: i - 1,
                    hidden: true,
                    ignoreCollapse: false,
                    ignoreNames: ''
                });
                rangeStart = null;
            }
        }
    }

    // Handle range that extends to end of chat
    if (rangeStart !== null) {
        ranges.push({
            start: rangeStart,
            end: chat.length - 1,
            hidden: true,
            ignoreCollapse: false,
            ignoreNames: ''
        });
    }

    return ranges;
}

/**
 * Detect and merge hidden ranges from external sources (e.g., /hide command)
 * @returns {boolean} True if new ranges were added
 */
export function mergeDetectedHiddenRanges() {
    const detected = detectHiddenRanges();
    if (detected.length === 0) {
        return false;
    }

    let chatRanges = getChatRanges();
    let addedCount = 0;

    for (const newRange of detected) {
        const isDuplicate = chatRanges.some(existing =>
            existing.start === newRange.start && existing.end === newRange.end
        );
        if (!isDuplicate) {
            chatRanges.push(newRange);
            addedCount++;
        }
    }

    if (addedCount > 0) {
        chatRanges.sort((a, b) => a.start - b.start);
        saveChatRanges(chatRanges);
        console.log(`[SummarySharder] Auto-detected ${addedCount} hidden range(s) from external source`);
        return true;
    }

    return false;
}
