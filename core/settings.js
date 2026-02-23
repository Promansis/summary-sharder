/**
 * Settings management for Summary Sharder
 */

import {
    saveSettingsDebounced,
    chat_metadata,
    saveMetadata,
} from '../../../../../script.js';

import {
    extension_settings,
} from '../../../../extensions.js';

const SETTINGS_SAVE_TRACE_DEBUG = false;
const SETTINGS_SAVE_TRACE_SLOW_MS = 8;
const SETTINGS_SAVE_TRACE_LOG_EVERY = 20;
let settingsSaveTraceCount = 0;

function getSaveSettingsCallerFromStack(stack) {
    if (!stack) return 'unknown';
    const lines = stack.split('\n');
    for (const line of lines) {
        if (!line.includes('core/settings.js') && line.includes('summary-sharder')) {
            return line.trim().replace(/^at\s+/u, '');
        }
    }
    return lines[2]?.trim().replace(/^at\s+/u, '') || 'unknown';
}

/**
 * Get default settings structure
 */
export function getDefaultSettings() {
    return {
        apiUrl: '',
        apiKey: '',
        useSillyTavernAPI: false,  // Toggle for using ST's current chat API
        selectedModel: '',          // Model to use when useSillyTavernAPI is true
        mode: 'auto',           // 'auto' or 'manual'
        autoInterval: 20,
        hideSummarized: false,      // DEPRECATED: kept for backward compatibility
        hideAllSummarized: false,   // Global toggle for hiding all ranges
        makeAllInvisible: false,    // DEPRECATED: kept for backward compatibility (renamed to collapseAll)
        collapseAll: false,         // Global toggle for collapsing all ranges
        globalIgnoreNames: '',      // Global comma-separated list of names to ignore
        summaryLengthControl: false,    // Enable/disable summary length control
        summaryLengthPercent: 10,       // Target summary length as percentage of input (1-30)
        prompts: [],            // Array of { name, content }
        activePromptName: '',
        outputMode: 'system',   // 'system' or 'lorebook'
        queueDelay: 0,          // Delay in seconds between API calls in queue mode
        // summarizedRanges moved to per-chat metadata (chat_metadata.summary_sharder.summarizedRanges)

        // Lorebook selection settings
        lorebookSelection: {
            useCharacterBook: false,      // Toggle: Use character's embedded/bound lorebook
            useChatBook: false,           // Toggle: Use chat's assigned world info
            useCustomBooks: false,        // Toggle: Enable custom selection
            customBookNames: [],          // Array of selected lorebook names
        },

        // Lorebook entry options (global for all summaries)
        lorebookEntryOptions: {
            entryType: 'constant',        // 'constant', 'vectorized', 'disabled', 'normal'
            nameFormat: 'Memory Shard {start}-{end}',  // Template with {start}, {end}, {date}, {character}
            keywordsEnabled: true,        // Fallback format-based keywords
            keywordFormat: 'summary_{start}_{end}',
            additionalKeywords: '',       // Comma-separated additional keywords
            bannedKeywords: '',           // Comma-separated keywords to exclude from all keyword generation
            extractKeywords: true,        // Enable AI keyword extraction from summary
            orderStrategy: 'recency',     // 'recency' (higher order for recent) or 'fixed'
            fixedOrderValue: 100,         // Used when orderStrategy is 'fixed'
        },

        // Pre-Edit Events
        advancedUserControl: false,       // Toggle for event-based summary workflow

        // Saved API configurations (for external API mode)
        savedApiConfigs: [],              // Array of { id, name, url, secretId, model }
        activeApiConfigId: null,          // ID of currently selected saved config, or null for manual entry

        // Events-specific API settings (when Pre-Edit Events is enabled)
        useAlternateEventsApi: false,     // Toggle for using different API for events
        eventsApiConfigId: null,          // ID of saved config to use for events (null = use main)

        // Context cleanup settings
        contextCleanup: {
            enabled: false,               // Master toggle for context cleanup
            stripHtml: true,              // Remove HTML tags like <div>, <span>, etc.
            stripCodeBlocks: false,       // Remove ```code``` blocks entirely
            stripUrls: false,             // Remove http/https URLs
            stripEmojis: false,           // Remove emoji characters
            stripBracketedMeta: false,    // Remove [OOC], (OOC), etc.
            stripReasoningBlocks: true,   // Remove <thinking> and <think> blocks
            stripHiddenMessages: true,    // Skip messages with is_hidden flag
            customRegex: '',              // DEPRECATED: kept for backward compatibility, migrated to customRegexes
            customRegexes: [],            // Array of { id, name, pattern, enabled }
        },

        // Configurable events extraction prompt (used by Pre-Edit Events)
        eventsPrompt: '',

        // Sharder Mode settings
        sharderMode: false,               // Toggle for sharder workflows
        autoIncludeShards: false,         // Auto-include all saved shards without showing selection modal
        sharderPrompts: {
            prompt: '',                   // Sharder prompt (loaded from prompts.js default)
        },

        // Summary Review settings (for advancedUserControl workflow)
        summaryReview: {
            mode: 'always',               // 'always' | 'never'
            tokenThreshold: 500,          // Show if tokens exceed this
            promptChangeDetection: true,  // Show if prompt changed since last run
        },

        // Per-feature API configuration
        apiFeatures: {
            summary: {
                useSillyTavernAPI: false,  // Toggle: ST API vs External
                apiConfigId: null,          // ID from savedApiConfigs, or null
                queueDelayMs: 0,            // Delay in milliseconds between API calls
                temperature: 0.4,           // Generation temperature (0-2)
                topP: 1,                    // Nucleus sampling threshold (0-1)
                maxTokens: 8096,            // Maximum response tokens
                postProcessing: '',         // Prompt post-processing mode (external API only)
                messageFormat: 'minimal'    // Message format: 'minimal' (system+user) or 'alternating' (adds assistant turn)
            },
            sharder: {
                useSillyTavernAPI: false,
                apiConfigId: null,
                queueDelayMs: 0,
                temperature: 0.25,
                topP: 1,
                maxTokens: 8096,
                postProcessing: '',
                messageFormat: 'minimal'
            },
            events: {
                useSillyTavernAPI: false,
                apiConfigId: null,
                queueDelayMs: 0,
                temperature: 0.4,
                topP: 1,
                maxTokens: 4096,
                postProcessing: '',
                messageFormat: 'minimal'
            },
            chatManager: {
                useSillyTavernAPI: false,
                apiConfigId: null,
                queueDelayMs: 0,
                temperature: 0.3,
                topP: 1,
                maxTokens: 4096,
                postProcessing: '',
                messageFormat: 'minimal'
            }
        },

        // Floating Action Button settings
        fab: {
            enabled: true,
            position: { x: null, y: null },
        },

        // RAG (Retrieval-Augmented Generation) settings
        rag: {
            enabled: false,
            // Backend
            backend: 'vectra',              // 'vectra' | 'lancedb' | 'qdrant' | 'milvus'
            source: 'transformers',         // Embedding source (from Similharity plugin)
            apiUrl: '',                     // Custom embedding API URL override
            model: '',                      // Embedding model (provider-specific)
            embeddingSecretId: null,        // Secret ID for embedding API key in ST secrets store
            backendConfig: {
                qdrantAddress: 'localhost:6333',
                qdrantUseCloud: false,
                qdrantApiKey: '',
                qdrantUrl: '',               // Cloud URL (used when qdrantUseCloud=true)
                milvusAddress: 'localhost:19530',
                milvusToken: '',
            },
            // Vectorization
            vectorizeShards: true,
            autoVectorizeNewSummaries: true,
            chunkingStrategy: 'per_message', // Deprecated (kept for migration compatibility)
            batchSize: 5,                    // Deprecated (kept for migration compatibility)
            sceneAwareChunking: false,
            sectionAwareChunking: false,
            useLorebooksForVectorization: false, // Scan selected lorebooks during bulk shard vectorization
            vectorizationLorebookNames: [],      // Lorebooks used when useLorebooksForVectorization is enabled
            // Retrieval
            includeLorebooksInShardSelection: false, // Allow shard/extraction discovery to scan lorebooks even when outputMode is 'system'
            insertCount: 5,
            queryCount: 2,
            protectCount: 5,
            scoreThreshold: 0.25,
            scoringMethod: 'keyword',       // 'keyword' | 'bm25' | 'hybrid'
            hybridFusionMethod: 'rrf',      // 'rrf' | 'weighted'
            hybridRrfK: 60,
            hybridAlpha: 0.4,
            hybridBeta: 0.6,
            hybridOverfetchMultiplier: 4,
            position: 0,                    // extension_prompt_types position
            depth: 2,
            template: 'Recalled memories:\n{{text}}',
            // Scene Expansion
            sceneExpansion: true,
            maxSceneExpansionChunks: 10,
            // Re-ranker
            reranker: {
                enabled: false,
                mode: 'similharity',
                apiUrl: '',
                model: '',
                secretId: null,
            },
        },

        // Standard Mode RAG settings â€” active when sharderMode is false.
        // No scene codes, no section-aware chunking; prose-only chunking; separate ss_standard_* collections.
        ragStandard: {
            enabled: false,
            // Backend
            backend: 'vectra',
            source: 'transformers',
            apiUrl: '',
            model: '',
            embeddingSecretId: null,
            backendConfig: {
                qdrantAddress: 'localhost:6333',
                qdrantUseCloud: false,
                qdrantApiKey: '',
                qdrantUrl: '',
                milvusAddress: 'localhost:19530',
                milvusToken: '',
            },
            // Vectorization
            vectorizeShards: true,
            autoVectorizeNewSummaries: true,
            proseChunkingMode: 'paragraph',     // 'full_summary' | 'paragraph'
            useLorebooksForVectorization: false,
            vectorizationLorebookNames: [],
            // Retrieval
            includeLorebooksInShardSelection: false,
            insertCount: 5,
            queryCount: 2,
            protectCount: 5,
            scoreThreshold: 0.25,
            scoringMethod: 'keyword',
            hybridFusionMethod: 'rrf',
            hybridRrfK: 60,
            hybridAlpha: 0.4,
            hybridBeta: 0.6,
            hybridOverfetchMultiplier: 4,
            position: 0,
            depth: 2,
            template: 'Recalled memories:\n{{text}}',
            // Re-ranker
            reranker: {
                enabled: false,
                mode: 'similharity',
                apiUrl: '',
                model: '',
                secretId: null,
            },
        },
    };
}

/**
 * Get current settings (reference to extension_settings)
 */
export function getSettings() {
    return extension_settings.summary_sharder || getDefaultSettings();
}

/**
 * Get the active RAG settings block depending on mode.
 * Returns settings.rag when sharderMode is true, settings.ragStandard otherwise.
 * @param {Object} settings
 * @returns {Object|undefined}
 */
export function getActiveRagSettings(settings) {
    return (settings?.sharderMode === true) ? settings?.rag : settings?.ragStandard;
}

/**
 * Save settings to extension_settings and persist
 */
export function saveSettings(settings) {
    const startedAt = SETTINGS_SAVE_TRACE_DEBUG ? performance.now() : 0;
    const traceStack = SETTINGS_SAVE_TRACE_DEBUG ? new Error().stack : '';
    Object.assign(extension_settings.summary_sharder, settings);
    saveSettingsDebounced();

    if (!SETTINGS_SAVE_TRACE_DEBUG) return;

    const duration = performance.now() - startedAt;
    settingsSaveTraceCount += 1;
    if (duration < SETTINGS_SAVE_TRACE_SLOW_MS && settingsSaveTraceCount % SETTINGS_SAVE_TRACE_LOG_EVERY !== 0) {
        return;
    }

    const caller = getSaveSettingsCallerFromStack(traceStack);
    console.debug(
        `[SummarySharder][settings.save] dt=${duration.toFixed(2)}ms count=${settingsSaveTraceCount} caller=${caller}`
    );
}

/**
 * Get summarized ranges for the current chat
 * Ensures backward compatibility by adding hidden/collapsed/ignoreNames fields to old ranges
 * Validates chatId to ensure ranges belong to the current chat (not stale data from another chat)
 */
export function getChatRanges() {
    const context = SillyTavern.getContext();
    const currentChatId = context?.chatId;

    if (!chat_metadata.summary_sharder) {
        chat_metadata.summary_sharder = {};
    }

    const storedChatId = chat_metadata.summary_sharder.chatId;

    // Validate chatId - if mismatch, this is stale data from a different chat
    if (storedChatId && currentChatId && storedChatId !== currentChatId) {
        console.warn(`[SummarySharder] Chat ID mismatch: stored=${storedChatId}, current=${currentChatId}. Clearing stale ranges.`);
        chat_metadata.summary_sharder = { chatId: currentChatId, summarizedRanges: [] };
        return [];
    }

    const ranges = chat_metadata.summary_sharder.summarizedRanges || [];

    // Add default fields to ranges that don't have them (backward compatibility)
    return ranges.map(range => ({
        start: range.start,
        end: range.end,
        hidden: range.hidden !== undefined ? range.hidden : false,
        ignoreCollapse: range.ignoreCollapse !== undefined ? range.ignoreCollapse : false,
        ignoreNames: range.ignoreNames !== undefined ? range.ignoreNames : ''
    }));
}

/**
 * Save summarized ranges for the current chat
 * Stores chatId alongside ranges to ensure per-chat isolation
 */
export function saveChatRanges(ranges) {
    const context = SillyTavern.getContext();
    const currentChatId = context?.chatId;

    // DEBUG: Log what ranges we're saving
    console.log(`[SummarySharder] saveChatRanges called with ${ranges.length} ranges:`,
        JSON.stringify(ranges.map(r => ({ start: r.start, end: r.end, hidden: r.hidden }))));

    if (!chat_metadata.summary_sharder) {
        chat_metadata.summary_sharder = {};
    }

    // Always store chatId for validation on load
    chat_metadata.summary_sharder.chatId = currentChatId;
    chat_metadata.summary_sharder.summarizedRanges = ranges;
    saveMetadata();
}

/**
 * Migrate old settings to new structure
 * Called when settings are loaded to ensure backward compatibility
 */
export function migrateSettings(settings) {
    let migrated = false;

    // Migrate customRegex string to customRegexes array
    if (settings.contextCleanup) {
        // Ensure customRegexes array exists
        if (!Array.isArray(settings.contextCleanup.customRegexes)) {
            settings.contextCleanup.customRegexes = [];
            migrated = true;
        }

        // Migrate old customRegex string if it exists and customRegexes is empty
        if (settings.contextCleanup.customRegex &&
            settings.contextCleanup.customRegex.trim() &&
            settings.contextCleanup.customRegexes.length === 0) {

            settings.contextCleanup.customRegexes.push({
                id: `regex-${Date.now()}`,
                name: 'Migrated Custom Regex',
                pattern: settings.contextCleanup.customRegex,
                enabled: true
            });

            console.log('[SummarySharder] Migrated legacy customRegex to customRegexes array');
            migrated = true;
        }

        // Add new cleanup options for existing users (default to enabled)
        if (settings.contextCleanup.stripReasoningBlocks === undefined) {
            settings.contextCleanup.stripReasoningBlocks = true;
            migrated = true;
        }
        if (settings.contextCleanup.stripHiddenMessages === undefined) {
            settings.contextCleanup.stripHiddenMessages = true;
            migrated = true;
        }
    }

    // Ensure eventsPrompt field exists
    if (settings.eventsPrompt === undefined) {
        settings.eventsPrompt = '';
        migrated = true;
    }

    // Migrate to new apiFeatures structure
    if (!settings.apiFeatures) {
        console.log('[SummarySharder] Migrating to new apiFeatures structure');

        settings.apiFeatures = {
            summary: {
                useSillyTavernAPI: settings.useSillyTavernAPI ?? false,
                apiConfigId: settings.activeApiConfigId || null
            },
            events: {
                // Events uses alternate API if configured, otherwise inherits main
                useSillyTavernAPI: settings.useAlternateEventsApi
                    ? false
                    : (settings.useSillyTavernAPI ?? false),
                apiConfigId: (settings.useAlternateEventsApi && settings.eventsApiConfigId)
                    ? settings.eventsApiConfigId
                    : (settings.activeApiConfigId || null)
            },
            sharder: {
                useSillyTavernAPI: settings.useSillyTavernAPI ?? false,
                apiConfigId: settings.activeApiConfigId || null
            }
        };

        console.log('[SummarySharder] Migration complete - API settings preserved');
        migrated = true;
    }

    // Add chatManager to apiFeatures if missing (for existing installations)
    if (settings.apiFeatures && !settings.apiFeatures.chatManager) {
        settings.apiFeatures.chatManager = {
            useSillyTavernAPI: settings.apiFeatures.summary?.useSillyTavernAPI ?? false,
            apiConfigId: settings.apiFeatures.summary?.apiConfigId || null
        };
        console.log('[SummarySharder] Added chatManager to apiFeatures (inheriting from summary settings)');
        migrated = true;
    }

    // Migrate legacy singlePass feature key to sharder
    if (settings.apiFeatures?.singlePass && !settings.apiFeatures.sharder) {
        settings.apiFeatures.sharder = settings.apiFeatures.singlePass;
        delete settings.apiFeatures.singlePass;
        console.log('[SummarySharder] Migrated apiFeatures.singlePass to apiFeatures.sharder');
        migrated = true;
    }

    // Ensure sharder feature exists in apiFeatures for existing installations
    if (settings.apiFeatures && !settings.apiFeatures.sharder) {
        settings.apiFeatures.sharder = {
            useSillyTavernAPI: settings.apiFeatures.summary?.useSillyTavernAPI ?? false,
            apiConfigId: settings.apiFeatures.summary?.apiConfigId || null
        };
        console.log('[SummarySharder] Added sharder to apiFeatures (inheriting from summary settings)');
        migrated = true;
    }

    // Migrate queueDelay and add generation params to existing apiFeatures
    if (settings.apiFeatures) {
        const delayMs = Math.round((settings.queueDelay || 0) * 1000);
        const defaults = {
            summary: { temperature: 0.4, topP: 1, maxTokens: 8096 },
            events: { temperature: 0.4, topP: 1, maxTokens: 4096 },
            chatManager: { temperature: 0.3, topP: 1, maxTokens: 4096 },
            sharder: { temperature: 0.25, topP: 1, maxTokens: 8096 }
        };

        let needsMigration = false;
        for (const feature of ['summary', 'events', 'chatManager', 'sharder']) {
            if (settings.apiFeatures[feature]) {
                const cfg = settings.apiFeatures[feature];
                const def = defaults[feature];
                if (cfg.queueDelayMs === undefined) { cfg.queueDelayMs = delayMs; needsMigration = true; }
                if (cfg.temperature === undefined) { cfg.temperature = def.temperature; needsMigration = true; }
                if (cfg.topP === undefined) { cfg.topP = def.topP; needsMigration = true; }
                if (cfg.maxTokens === undefined) { cfg.maxTokens = def.maxTokens; needsMigration = true; }
                if (cfg.postProcessing === undefined) { cfg.postProcessing = ''; needsMigration = true; }
                if (cfg.messageFormat === undefined) { cfg.messageFormat = 'minimal'; needsMigration = true; }
            }
        }

        if (needsMigration) {
            console.log('[SummarySharder] Migrated generation parameters to apiFeatures');
            migrated = true;
        }
    }
    // Remove deprecated two-pass prompt/settings keys
    if (settings.sharderPrompts) {
        if (!settings.sharderPrompts.prompt && settings.sharderPrompts.singlePassPrompt) {
            settings.sharderPrompts.prompt = settings.sharderPrompts.singlePassPrompt;
            migrated = true;
        }
        if (Object.prototype.hasOwnProperty.call(settings.sharderPrompts, 'singlePassPrompt')) {
            delete settings.sharderPrompts.singlePassPrompt;
            migrated = true;
        }
        if (Object.prototype.hasOwnProperty.call(settings.sharderPrompts, 'firstPassPrompt')) {
            delete settings.sharderPrompts.firstPassPrompt;
            migrated = true;
        }
        if (Object.prototype.hasOwnProperty.call(settings.sharderPrompts, 'secondPassBridge')) {
            delete settings.sharderPrompts.secondPassBridge;
            migrated = true;
        }
        if (Object.prototype.hasOwnProperty.call(settings.sharderPrompts, 'extractionPrompt')) {
            delete settings.sharderPrompts.extractionPrompt;
            migrated = true;
        }
        if (Object.prototype.hasOwnProperty.call(settings.sharderPrompts, 'consolidationPrompt')) {
            delete settings.sharderPrompts.consolidationPrompt;
            migrated = true;
        }
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'sharderPipelineMode')) {
        delete settings.sharderPipelineMode;
        migrated = true;
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'consolidationReview')) {
        delete settings.consolidationReview;
        migrated = true;
    }
    // Add RAG settings block for existing installations
    if (settings.rag === undefined) {
        settings.rag = getDefaultSettings().rag;
        console.log('[SummarySharder] Added RAG settings block');
        migrated = true;
    }

    // Add ragStandard settings block for existing installations
    if (settings.ragStandard === undefined) {
        settings.ragStandard = getDefaultSettings().ragStandard;
        console.log('[SummarySharder] Added ragStandard settings block');
        migrated = true;
    }

    // Ensure ragStandard nested defaults exist for existing installations
    if (settings.ragStandard) {
        const ragStdDefaults = getDefaultSettings().ragStandard;
        if (settings.ragStandard.retrievalEnabled === true && settings.ragStandard.enabled !== true) {
            settings.ragStandard.enabled = true;
            migrated = true;
        }

        for (const [key, value] of Object.entries(ragStdDefaults)) {
            if (settings.ragStandard[key] === undefined) {
                settings.ragStandard[key] = value;
                migrated = true;
            }
        }

        if (!settings.ragStandard.backendConfig || typeof settings.ragStandard.backendConfig !== 'object') {
            settings.ragStandard.backendConfig = { ...ragStdDefaults.backendConfig };
            migrated = true;
        } else {
            for (const [key, value] of Object.entries(ragStdDefaults.backendConfig)) {
                if (settings.ragStandard.backendConfig[key] === undefined) {
                    settings.ragStandard.backendConfig[key] = value;
                    migrated = true;
                }
            }
        }

        if (settings.ragStandard.backendConfig && typeof settings.ragStandard.backendConfig === 'object') {
            const stdBackend = settings.ragStandard.backendConfig;
            const host = String(stdBackend.qdrantHost || 'localhost').trim() || 'localhost';
            const parsedPort = Number.parseInt(String(stdBackend.qdrantPort ?? ''), 10);
            const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 6333;

            if (!String(stdBackend.qdrantAddress || '').trim()) {
                stdBackend.qdrantAddress = `${host}:${port}`;
                migrated = true;
            }
            if (stdBackend.qdrantUseCloud === undefined) {
                stdBackend.qdrantUseCloud = String(stdBackend.qdrantUrl || '').trim().length > 0;
                migrated = true;
            }
            if (Object.prototype.hasOwnProperty.call(stdBackend, 'qdrantHost')) {
                delete stdBackend.qdrantHost;
                migrated = true;
            }
            if (Object.prototype.hasOwnProperty.call(stdBackend, 'qdrantPort')) {
                delete stdBackend.qdrantPort;
                migrated = true;
            }
        }

        if (!settings.ragStandard.reranker || typeof settings.ragStandard.reranker !== 'object') {
            settings.ragStandard.reranker = { ...ragStdDefaults.reranker };
            migrated = true;
        } else {
            for (const [key, value] of Object.entries(ragStdDefaults.reranker)) {
                if (settings.ragStandard.reranker[key] === undefined) {
                    settings.ragStandard.reranker[key] = value;
                    migrated = true;
                }
            }
        }

        // Validate proseChunkingMode
        const validProseChunkingModes = new Set(['full_summary', 'paragraph']);
        if (!validProseChunkingModes.has(settings.ragStandard.proseChunkingMode)) {
            settings.ragStandard.proseChunkingMode = 'paragraph';
            migrated = true;
        }

        // Remove sharder-specific keys if accidentally present in ragStandard
        const sharderOnlyKeys = ['sectionAwareChunking', 'sceneAwareChunking', 'sceneExpansion', 'maxSceneExpansionChunks', 'chunkingStrategy', 'batchSize'];
        for (const key of sharderOnlyKeys) {
            if (Object.prototype.hasOwnProperty.call(settings.ragStandard, key)) {
                delete settings.ragStandard[key];
                migrated = true;
            }
        }
        if (Object.prototype.hasOwnProperty.call(settings.ragStandard, 'retrievalEnabled')) {
            delete settings.ragStandard.retrievalEnabled;
            migrated = true;
        }
    }

    // Migrate legacy sharder auto include key
    if (settings.autoIncludeShards === undefined && settings.singlePassAutoIncludeShards !== undefined) {
        settings.autoIncludeShards = settings.singlePassAutoIncludeShards === true;
        migrated = true;
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'singlePassAutoIncludeShards')) {
        delete settings.singlePassAutoIncludeShards;
        migrated = true;
    }

    // Ensure shard auto-include toggle exists for existing installations
    if (settings.autoIncludeShards === undefined) {
        settings.autoIncludeShards = false;
        migrated = true;
    }

    // Ensure RAG nested defaults exist for existing installations
    if (settings.rag) {
        const ragDefaults = getDefaultSettings().rag;
        if (settings.rag.retrievalEnabled === true && settings.rag.enabled !== true) {
            settings.rag.enabled = true;
            migrated = true;
        }

        for (const [key, value] of Object.entries(ragDefaults)) {
            if (settings.rag[key] === undefined) {
                settings.rag[key] = value;
                migrated = true;
            }
        }

        if (!settings.rag.backendConfig || typeof settings.rag.backendConfig !== 'object') {
            settings.rag.backendConfig = { ...ragDefaults.backendConfig };
            migrated = true;
        } else {
            for (const [key, value] of Object.entries(ragDefaults.backendConfig)) {
                if (settings.rag.backendConfig[key] === undefined) {
                    settings.rag.backendConfig[key] = value;
                    migrated = true;
                }
            }
        }

        if (settings.rag.backendConfig && typeof settings.rag.backendConfig === 'object') {
            const backend = settings.rag.backendConfig;
            const host = String(backend.qdrantHost || 'localhost').trim() || 'localhost';
            const parsedPort = Number.parseInt(String(backend.qdrantPort ?? ''), 10);
            const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 6333;

            if (!String(backend.qdrantAddress || '').trim()) {
                backend.qdrantAddress = `${host}:${port}`;
                migrated = true;
            }
            if (backend.qdrantUseCloud === undefined) {
                backend.qdrantUseCloud = String(backend.qdrantUrl || '').trim().length > 0;
                migrated = true;
            }
            if (Object.prototype.hasOwnProperty.call(backend, 'qdrantHost')) {
                delete backend.qdrantHost;
                migrated = true;
            }
            if (Object.prototype.hasOwnProperty.call(backend, 'qdrantPort')) {
                delete backend.qdrantPort;
                migrated = true;
            }
        }

        if (!settings.rag.reranker || typeof settings.rag.reranker !== 'object') {
            settings.rag.reranker = { ...ragDefaults.reranker };
            migrated = true;
        } else {
            for (const [key, value] of Object.entries(ragDefaults.reranker)) {
                if (settings.rag.reranker[key] === undefined) {
                    settings.rag.reranker[key] = value;
                    migrated = true;
                }
            }
        }

        const validRerankerModes = new Set(['similharity', 'direct']);
        if (!validRerankerModes.has(String(settings.rag.reranker.mode || '').trim().toLowerCase())) {
            settings.rag.reranker.mode = 'similharity';
            migrated = true;
        }

        const validChunkingStrategies = new Set(['per_message', 'conversation_turns', 'message_batch', 'scene_aware']);
        if (!validChunkingStrategies.has(settings.rag.chunkingStrategy)) {
            settings.rag.chunkingStrategy = 'per_message';
            migrated = true;
        }

        const validScoringMethods = new Set(['keyword', 'bm25', 'hybrid']);
        if (!validScoringMethods.has(settings.rag.scoringMethod)) {
            settings.rag.scoringMethod = 'keyword';
            migrated = true;
        }

        const validHybridFusionMethods = new Set(['rrf', 'weighted']);
        if (!validHybridFusionMethods.has(settings.rag.hybridFusionMethod)) {
            settings.rag.hybridFusionMethod = 'rrf';
            migrated = true;
        }

        if (!Number.isFinite(settings.rag.hybridRrfK) || settings.rag.hybridRrfK < 1) {
            settings.rag.hybridRrfK = 60;
            migrated = true;
        }

        if (!Number.isFinite(settings.rag.hybridAlpha) || settings.rag.hybridAlpha < 0) {
            settings.rag.hybridAlpha = 0.4;
            migrated = true;
        }

        if (!Number.isFinite(settings.rag.hybridBeta) || settings.rag.hybridBeta < 0) {
            settings.rag.hybridBeta = 0.6;
            migrated = true;
        }

        if (!Number.isFinite(settings.rag.hybridOverfetchMultiplier) || settings.rag.hybridOverfetchMultiplier < 1) {
            settings.rag.hybridOverfetchMultiplier = 4;
            migrated = true;
        }

        // Scene-aware shard chunking has been retired in favor of standard + section modes.
        if (settings.rag.sceneAwareChunking !== false) {
            settings.rag.sceneAwareChunking = false;
            migrated = true;
        }

        const removedRagKeys = [
            'vectorizeChat',
            'chatVectorMigrationHandled',
            'temporalDecay',
            'decayMode',
            'decayFunction',
            'decayHalfLife',
            'decayFloor',
            'dualVector',
            'dualVectorRadius',
            'retrievalEnabled',
        ];
        for (const key of removedRagKeys) {
            if (Object.prototype.hasOwnProperty.call(settings.rag, key)) {
                delete settings.rag[key];
                migrated = true;
            }
        }

        const normalizedVectorizationLorebookNames = [
            ...new Set(
                (Array.isArray(settings.rag.vectorizationLorebookNames)
                    ? settings.rag.vectorizationLorebookNames
                    : [])
                    .map(name => String(name || '').trim())
                    .filter(Boolean)
            )
        ];
        const previousVectorizationLorebookNames = Array.isArray(settings.rag.vectorizationLorebookNames)
            ? settings.rag.vectorizationLorebookNames
            : null;
        const lorebookNamesChanged = !previousVectorizationLorebookNames
            || previousVectorizationLorebookNames.length !== normalizedVectorizationLorebookNames.length
            || previousVectorizationLorebookNames.some((name, idx) => name !== normalizedVectorizationLorebookNames[idx]);
        if (lorebookNamesChanged) {
            settings.rag.vectorizationLorebookNames = normalizedVectorizationLorebookNames;
            migrated = true;
        }

        const normalizedUseLorebooksForVectorization = settings.rag.useLorebooksForVectorization === true;
        if (settings.rag.useLorebooksForVectorization !== normalizedUseLorebooksForVectorization) {
            settings.rag.useLorebooksForVectorization = normalizedUseLorebooksForVectorization;
            migrated = true;
        }
    }

    if (migrated) {
        saveSettings(settings);
    }

    return settings;
}


