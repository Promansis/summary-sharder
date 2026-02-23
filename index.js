/**
 * SUMMARY SHARDER - Memory Shard Summarization Extension
 * Compresses roleplay history into recoverable memory shards.
 */
import { initializeThemes } from './ui/modals/themes-modal.js';
import {
    eventSource,
    event_types,
} from '../../../../script.js';

import {
    extension_settings,
} from '../../../extensions.js';
import { POPUP_RESULT } from '../../../popup.js';
import { showSsConfirm } from './ui/common/modal-base.js';

// Core modules
import { getDefaultSettings, saveSettings, getChatRanges, saveChatRanges, migrateSettings, getActiveRagSettings } from './core/settings.js';
import { ensureDefaultPrompt, getActivePrompt, ensureSharderPrompts } from './core/summarization/prompts.js';
import { runSummarization, stopSummarization } from './core/api/summary-api.js';
import { runSharder } from './core/api/single-pass-api.js';
import { cacheCurrentChatState, findDeletedIndex, getCachedLength } from './core/chat/chat-state.js';
import { validateAllRanges } from './core/chat/range-manager.js';
import { shiftRangesOnDelete, shiftRangesOnInsert, buildRangesFromIndices, rangesMatch } from './core/chat/range-operations.js';

// UI modules
import { renderSettingsUI, runManualSummarizeUI } from './ui/ui-manager.js';
import { injectStyles } from './ui/styles.js';
import { initTextareaResizeAssist } from './ui/textarea-resize-assist.js';
import { initFab } from './ui/fab/index.js';
import { applyHideSummarized, applyVisibilitySettings, applyCollapseToHiddenMessages, expandUnhiddenMessages, initCollapseHandler, initEditUnfoldHandler, mergeDetectedHiddenRanges } from './core/chat/visibility-manager.js';
import {
    initCollectionLifecycle,
    rearrangeChat,
    clearRagPromptInjection,
} from './core/rag/index.js';

const MODULE_NAME = 'SummarySharder';
const GENERATE_INTERCEPTOR_KEY = 'summary_sharder_rearrangeChat';
const defaultSettings = getDefaultSettings();

// Runtime settings
let settings = { ...defaultSettings };

// Track last summarized index per chat
let lastSummarizedIndex = -1;

// Track pending visibility changes (debounce rapid changes)
// Using an object reference so visibility-state.js can clear it
const visibilityTimerRef = { timer: null };

// Track observer to prevent duplicates
let visibilityObserver = null;

// Import shared visibility state to check guard flag and set timer reference
import { getApplyingVisibility, setVisibilityTimerRef } from './core/chat/visibility-state.js';

// Set the timer reference so visibility-manager can clear pending timers
setVisibilityTimerRef(visibilityTimerRef);

/**
 * Export settings and functions for other modules
 */
export function getExtensionSettings() {
    return settings;
}

export function getLastSummarizedIndex() {
    return lastSummarizedIndex;
}

export function setLastSummarizedIndex(index) {
    lastSummarizedIndex = index;
}

export { runSummarization, getActivePrompt, applyHideSummarized, applyVisibilitySettings, saveSettings };

/**
 * Setup MutationObserver to watch for SillyTavern hide/unhide changes
 * Catches all sources: /hide, /unhide commands, context menu, external tools
 */
function setupVisibilityObserver() {
    const chatContainer = document.getElementById('chat');
    if (!chatContainer) {
        // Chat not ready, retry later
        setTimeout(setupVisibilityObserver, 1000);
        return;
    }

    // Disconnect existing observer if any
    if (visibilityObserver) {
        visibilityObserver.disconnect();
    }

    visibilityObserver = new MutationObserver((mutations) => {
        // Skip if we're applying visibility ourselves - prevents cascade loop
        if (getApplyingVisibility()) {
            return;
        }

        let hasVisibilityChange = false;

        for (const mutation of mutations) {
            if (mutation.type === 'attributes' &&
                mutation.attributeName === 'is_system') {
                hasVisibilityChange = true;
                break;
            }
        }

        if (hasVisibilityChange) {
            // Debounce: wait for batch of changes to complete
            clearTimeout(visibilityTimerRef.timer);
            visibilityTimerRef.timer = setTimeout(() => {
                // Double-check flag in case visibility started during debounce
                if (!getApplyingVisibility()) {
                    onExternalVisibilityChange();
                }
            }, 300);
        }
    });

    visibilityObserver.observe(chatContainer, {
        attributes: true,
        attributeFilter: ['is_system'],
        subtree: true,
    });

    console.log(`[${MODULE_NAME}] Visibility observer attached`);
}


/**
 * Called when SillyTavern's /hide or /unhide changes message visibility
 * Synchronizes Summary Sharder ranges with actual message state
 */
async function onExternalVisibilityChange() {
    const context = SillyTavern.getContext();
    if (!context?.chat) return;

    console.log(`[${MODULE_NAME}] onExternalVisibilityChange triggered`);

    // Double-check guard flag (should not be true if we get here)
    if (getApplyingVisibility()) {
        console.log(`[${MODULE_NAME}] Guard flag still set, skipping external visibility change`);
        return;
    }

    console.log(`[${MODULE_NAME}] Detected external visibility change, syncing ranges...`);

    // Detect current hidden state from chat data
    const actuallyHidden = new Set();
    for (let i = 0; i < context.chat.length; i++) {
        if (context.chat[i]?.is_system === true) {
            actuallyHidden.add(i);
        }
    }

    // Build ranges from detected hidden messages
    const detectedRanges = buildRangesFromIndices(actuallyHidden);

    // Get current Summary Sharder ranges
    const currentRanges = getChatRanges();

    // Check if ranges match
    if (rangesMatch(currentRanges, detectedRanges)) {
        console.log(`[${MODULE_NAME}] Ranges already in sync`);
        return;
    }

    // Update to match actual visibility
    saveChatRanges(detectedRanges);
    console.log(`[${MODULE_NAME}] Ranges synchronized: ${detectedRanges.length} range(s)`);

    // Apply collapse styling to newly hidden messages (if enabled)
    applyCollapseToHiddenMessages(settings);

    // Expand any messages that were unhidden
    expandUnhiddenMessages();

    // Don't recompute visibility - SillyTavern already did it
}

/**
 * Handle new message events for auto-summarization
 */
function onNewMessage() {
    // Update cache after new message
    cacheCurrentChatState();

    const context = SillyTavern.getContext();
    if (!context || !context.chat || context.chat.length === 0) return;

    if (settings.mode === 'auto') {
        const currentIndex = context.chat.length - 1;
        const messagesSinceLastSummary = currentIndex - lastSummarizedIndex;

        if (messagesSinceLastSummary >= settings.autoInterval) {
            const startIdx = Math.max(0, lastSummarizedIndex + 1);
            console.log(`[${MODULE_NAME}] Auto-triggering summarization: messages ${startIdx} to ${currentIndex}`);
            runSummarization(startIdx, currentIndex, settings);
        }
    }

}

/**
 * Handle message edited events.
 * @param {Object|number|string} eventData - Event payload (shape depends on ST emitter)
 */
async function onMessageEdited(eventData) {
    void eventData;
    return;
}

/**
 * Handle message deletion events
 * Adjusts visibility ranges to account for shifted message indices
 * @param {number} newChatLength - The chat length after deletion
 */
async function onMessageDeleted(newChatLength) {
    const cachedLength = getCachedLength();

    // If cache is stale or no deletion occurred, just validate
    if (cachedLength === 0 || newChatLength >= cachedLength) {
        validateAllRanges();
        cacheCurrentChatState();
        return;
    }

    const context = SillyTavern.getContext();
    if (!context?.chat) return;

    // Find which message was deleted
    const deletedIndex = findDeletedIndex(context.chat);

    if (deletedIndex >= 0) {
        console.log(`[${MODULE_NAME}] Message deleted at index ${deletedIndex}`);

        // Use new range-operations module (handles visibility internally)
        const rangesModified = await shiftRangesOnDelete(deletedIndex, deletedIndex);

        if (rangesModified) {
            console.log(`[${MODULE_NAME}] Ranges adjusted after deletion`);
        }

        // Update lastSummarizedIndex if needed
        if (lastSummarizedIndex >= deletedIndex) {
            lastSummarizedIndex = Math.max(-1, lastSummarizedIndex - 1);
        }
    } else {
        // Could not determine deleted index, validate ranges
        validateAllRanges();
    }

    // Update cache for next deletion
    cacheCurrentChatState();
}

/**
 * Handle message insertion events
 * Adjusts visibility ranges to account for shifted message indices
 * @param {number} insertedIndex - The index where a message was inserted
 */
async function onMessageInserted(insertedIndex) {
    console.log(`[${MODULE_NAME}] Message inserted at index ${insertedIndex}`);

    // Use new range-operations module (handles visibility internally)
    const rangesModified = await shiftRangesOnInsert(insertedIndex, 1);

    if (rangesModified) {
        console.log(`[${MODULE_NAME}] Ranges adjusted after insertion`);
    }

    // Update lastSummarizedIndex if needed
    if (lastSummarizedIndex >= insertedIndex) {
        lastSummarizedIndex++;
    }

    // Update cache
    cacheCurrentChatState();
}

/**
 * Handle chat change - reset tracking
 */
function onChatChanged() {
    const context = SillyTavern.getContext();
    const chatId = context?.chatId;
    console.log(`[${MODULE_NAME}] Chat changed to: ${chatId}`);

    lastSummarizedIndex = -1;

    // Recalculate from THIS chat's stored ranges
    let chatRanges = getChatRanges();
    if (chatRanges.length > 0) {
        const maxEnd = Math.max(...chatRanges.map(r => r.end));
        lastSummarizedIndex = maxEnd;
    }

    // Auto-detect hidden ranges on chat load
    setTimeout(async () => {
        // Re-attach observer for new chat DOM
        setupVisibilityObserver();

        mergeDetectedHiddenRanges();

        // Reapply visibility for THIS chat's ranges (must await to ensure completion before caching)
        await applyVisibilitySettings(settings);

        // Cache chat state for deletion tracking (after visibility is fully applied)
        cacheCurrentChatState();
    }, 500);
}

/**
 * Initialize the extension
 */
jQuery(async () => {
    console.log(`[${MODULE_NAME}] Initializing...`);

    // Load saved settings from extension_settings
    if (!extension_settings.summary_sharder) {
        extension_settings.summary_sharder = { ...defaultSettings };
    }

    // Merge saved settings with defaults
    settings = {
        ...defaultSettings,
        ...extension_settings.summary_sharder,
    };

    // Run migration for any old settings formats
    migrateSettings(settings);
    saveSettings(settings);

    // Ensure default prompt exists
    ensureDefaultPrompt(settings);

    // Ensure sharder prompts exist
    ensureSharderPrompts(settings);

    // Initialize themes
    initializeThemes(settings);

    // Inject CSS (includes theme modal CSS)
    injectStyles();
    initTextareaResizeAssist();

    // Initialize delegated collapse click handler
    initCollapseHandler();
    initEditUnfoldHandler();

    // Render settings UI
    renderSettingsUI(settings, {
        onManualSummarize: () => runManualSummarizeUI(settings)
    });

    // Initialize floating action button
    initFab(settings, {
        onSinglePass: (start, end, selectedShards = []) => runSharder(start, end, settings, selectedShards),
        onBatchSharder: async (ranges, batchConfig) => {
            const { runSharderQueue } = await import('./core/api/single-pass-queue-api.js');
            await runSharderQueue(ranges, settings, batchConfig);
        },
        onStop: () => stopSummarization(),
        onSummarize: () => runManualSummarizeUI(settings),
        onVectorize: async () => {
            if (!getActiveRagSettings(settings)?.enabled) {
                toastr.warning('RAG is disabled. Enable it in RAG settings first.');
                return;
            }

            try {
                const { vectorizeAllShardsByMode, vectorizeAllStandardSummaries } = await import('./core/rag/index.js');

                if (settings?.sharderMode === true) {
                    const result = await vectorizeAllShardsByMode(settings);
                    if (result.mode === 'section') {
                        const fallbackInfo = (result.sectionFallbackToStandard || 0) > 0
                            ? `, fallback=${result.sectionFallbackToStandard}`
                            : '';
                        toastr.success(`Section-aware vectorization: +${result.inserted}, -${result.deleted}, shards=${result.total}${fallbackInfo}`);
                    } else {
                        toastr.success(`Vectorized shards: +${result.inserted} (total discovered: ${result.total})`);
                    }
                } else {
                    const result = await vectorizeAllStandardSummaries(settings);
                    toastr.success(`Vectorized standard summaries: +${result.inserted} (total discovered: ${result.total})`);
                }
            } catch (error) {
                toastr.error(`Vectorization failed: ${error?.message || error}`);
            }
        },
        onBrowseVectors: async () => {
            if (!getActiveRagSettings(settings)?.enabled) {
                toastr.warning('RAG is disabled. Enable it in RAG settings first.');
                return;
            }

            try {
                const { openRagBrowserModal } = await import('./ui/modals/management/rag-browser-modal.js');
                await openRagBrowserModal(settings);
            } catch (error) {
                toastr.error(`Could not open vector browser: ${error?.message || error}`);
            }
        },
        onPurgeVectors: async () => {
            if (!getActiveRagSettings(settings)?.enabled) {
                toastr.warning('RAG is disabled. Enable it in RAG settings first.');
                return;
            }

            const confirm = await showSsConfirm(
                'Purge All Vectors',
                'Delete all shard and chat vectors for this chat? This cannot be undone.'
            );
            if (confirm !== POPUP_RESULT.AFFIRMATIVE) return;

            try {
                const { purgeAllCollections } = await import('./core/rag/index.js');
                const chatId = SillyTavern.getContext()?.chatId;
                if (!chatId) {
                    toastr.warning('No active chat found.');
                    return;
                }

                await purgeAllCollections(chatId, settings.rag);
                toastr.success('Vectors purged for current chat');
            } catch (error) {
                toastr.error(`Vector purge failed: ${error?.message || error}`);
            }
        },
        onOpenThemes: async () => {
            try {
                const { openThemesModal } = await import('./ui/modals/themes-modal.js');
                await openThemesModal(settings, saveSettings);
            } catch (error) {
                toastr.error(`Could not open themes: ${error?.message || error}`);
            }
        },
        onOpenPrompts: async () => {
            try {
                const { openPromptsModal } = await import('./ui/modals/configuration/prompts-modal.js');
                await openPromptsModal(settings);
            } catch (error) {
                toastr.error(`Could not open prompts: ${error?.message || error}`);
            }
        },
        onOpenApiConfig: async () => {
            try {
                const { openApiConfigModal } = await import('./ui/modals/configuration/api-config-modal.js');
                await openApiConfigModal(settings);
            } catch (error) {
                toastr.error(`Could not open API config: ${error?.message || error}`);
            }
        },
        onOpenRagSettings: async () => {
            try {
                const { openRagSettingsModal } = await import('./ui/modals/configuration/rag-settings-modal.js');
                await openRagSettingsModal(settings);
            } catch (error) {
                toastr.error(`Could not open RAG settings: ${error?.message || error}`);
            }
        },
        onOpenChatManager: async () => {
            try {
                const { openChatManagerModal } = await import('./ui/modals/management/chat-manager-modal.js');
                await openChatManagerModal(settings);
            } catch (error) {
                toastr.error(`Could not open chat manager: ${error?.message || error}`);
            }
        },
        onOpenVisibility: async () => {
            try {
                const { openVisibilityModal } = await import('./ui/modals/management/visibility-modal.js');
                await openVisibilityModal(settings);
            } catch (error) {
                toastr.error(`Could not open visibility manager: ${error?.message || error}`);
            }
        },
        onOpenCleanContext: async () => {
            try {
                const { openCleanContextModal } = await import('./ui/modals/configuration/clean-context-modal.js');
                await openCleanContextModal(settings);
            } catch (error) {
                toastr.error(`Could not open context cleanup: ${error?.message || error}`);
            }
        },
        onOpenRagDebug: async () => {
            try {
                if (!getActiveRagSettings(settings)?.enabled) {
                    toastr.warning('RAG is disabled. Enable it in RAG settings first.');
                    return;
                }
                const { openRagDebugModal } = await import('./ui/modals/management/rag-debug-modal.js');
                await openRagDebugModal(getActiveRagSettings(settings));
            } catch (error) {
                toastr.error(`Could not open RAG debug: ${error?.message || error}`);
            }
        },
        getLastSummarizedIndex: () => lastSummarizedIndex,
    });

    // Setup visibility observer to detect /hide /unhide commands
    setupVisibilityObserver();

    // Apply visibility on load (use async to properly await)
    setTimeout(async () => {
        await applyVisibilitySettings(settings);
    }, 1000);

    // Register event handlers
    eventSource.on(event_types.MESSAGE_SENT, onNewMessage);
    eventSource.on(event_types.MESSAGE_RECEIVED, onNewMessage);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_DELETED, onMessageDeleted);
    eventSource.on(event_types.MESSAGE_INSERTED, onMessageInserted);
    if (event_types.MESSAGE_EDITED) {
        eventSource.on(event_types.MESSAGE_EDITED, onMessageEdited);
    }

    // Initialize RAG collection lifecycle (cleanup on chat delete)
    initCollectionLifecycle();

    // Register retrieval interceptor for generation pipeline.
    globalThis[GENERATE_INTERCEPTOR_KEY] = rearrangeChat;
    if (typeof globalThis[GENERATE_INTERCEPTOR_KEY] !== 'function') {
        console.warn(
            `[${MODULE_NAME}] Failed to register generation interceptor "${GENERATE_INTERCEPTOR_KEY}". ` +
            `RAG retrieval will not run on send. Ensure manifest.generate_interceptor matches this key.`
        );
    }

    // Ensure stale RAG prompt text is cleared when RAG is disabled.
    const activeRag = getActiveRagSettings(settings);
    if (!activeRag?.enabled) {
        clearRagPromptInjection();
    }

    console.log(`[${MODULE_NAME}] Initialized successfully`);
});

