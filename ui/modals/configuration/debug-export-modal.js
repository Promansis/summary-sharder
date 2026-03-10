import { Popup, POPUP_TYPE } from '../../../../../../popup.js';
import { getActiveRagSettings, getChatRanges } from '../../../core/settings.js';
import { getConfigById } from '../../../core/api/legacy-api-config.js';
import { getActivePrompt } from '../../../core/summarization/prompts.js';
import { getCurrentTheme, getThemes } from '../themes/theme-core.js';
import { decoratePopupOptionsForSs } from '../../common/modal-base.js';
import { escapeHtml } from '../../common/ui-utils.js';
import { log } from '../../../core/logger.js';

const SECRET_ID_RE = /(?:^|[.\]])(?:secretId|embeddingSecretId)(?:$|[.\[])/i;
const SECRET_VALUE_RE = /(?:^|[.\]])(?:apiKey|qdrantApiKey|milvusToken|token|password)(?:$|[.\[])/i;
const SENSITIVE_QUERY_PARAM_RE = /(?:api[-_]?key|token|secret|password|auth)/i;

function sanitizeUrl(value) {
    const input = String(value || '').trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
        return input;
    }

    try {
        const url = new URL(input);
        if (url.username) {
            url.username = '[REDACTED]';
        }
        if (url.password) {
            url.password = '[REDACTED]';
        }
        for (const key of [...url.searchParams.keys()]) {
            if (SENSITIVE_QUERY_PARAM_RE.test(key)) {
                url.searchParams.set(key, '[REDACTED]');
            }
        }
        return url.toString();
    } catch {
        return input;
    }
}

function sanitizeValue(path, value) {
    if (SECRET_ID_RE.test(path)) {
        return value ? '[STORED_SECURELY]' : '(none)';
    }

    if (SECRET_VALUE_RE.test(path)) {
        return value ? '[REDACTED]' : '(empty)';
    }

    if (typeof value === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim())) {
        return sanitizeUrl(value);
    }

    return value;
}

function flattenRows(value, path = '', rows = []) {
    if (value === null || value === undefined) {
        rows.push({ path: path || '(root)', value: '(none)' });
        return rows;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            rows.push({ path, value: '[]' });
            return rows;
        }

        value.forEach((item, index) => {
            flattenRows(item, `${path}[${index}]`, rows);
        });
        return rows;
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value);
        if (entries.length === 0) {
            rows.push({ path, value: '{}' });
            return rows;
        }

        for (const [key, nestedValue] of entries) {
            const nextPath = path ? `${path}.${key}` : key;
            flattenRows(nestedValue, nextPath, rows);
        }
        return rows;
    }

    const safeValue = sanitizeValue(path, value);
    let rendered = safeValue;

    if (typeof safeValue === 'string') {
        rendered = safeValue.length > 0 ? safeValue.replace(/\r?\n/g, '\\n') : '(empty)';
    } else if (typeof safeValue === 'boolean' || typeof safeValue === 'number') {
        rendered = String(safeValue);
    } else {
        rendered = JSON.stringify(safeValue);
    }

    rows.push({ path, value: rendered });
    return rows;
}

function escapeMarkdownCell(value) {
    return String(value ?? '')
        .replace(/\|/g, '\\|')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildMarkdownTable(title, value) {
    const rows = flattenRows(value);
    const lines = [
        `## ${title}`,
        '',
        '| Setting | Value |',
        '| --- | --- |',
    ];

    for (const row of rows) {
        lines.push(`| ${escapeMarkdownCell(row.path)} | ${escapeMarkdownCell(row.value)} |`);
    }

    return lines.join('\n');
}

function buildApiConfigSnapshot(settings) {
    const features = ['summary', 'sharder', 'casing'];
    const profiles = SillyTavern.getContext()?.extensionSettings?.connectionManager?.profiles || [];
    const snapshot = {};

    for (const feature of features) {
        const featureConfig = settings?.apiFeatures?.[feature];

        if (featureConfig?.useSillyTavernAPI === true) {
            snapshot[feature] = {
                mode: 'SillyTavern Current',
            };
            continue;
        }

        if (featureConfig?.connectionProfileId) {
            const profile = profiles.find(p => p?.id === featureConfig.connectionProfileId);
            snapshot[feature] = {
                mode: 'Connection Profile',
                profileId: featureConfig.connectionProfileId,
                profileName: profile?.name || 'Unknown Profile',
            };
            continue;
        }

        if (featureConfig?.apiConfigId) {
            const config = getConfigById(settings, featureConfig.apiConfigId);
            snapshot[feature] = {
                mode: 'Saved API Configuration',
                configId: featureConfig.apiConfigId,
                name: config?.name || 'Unknown Configuration',
                url: config?.url || '',
                model: config?.model || '',
                secretId: config?.secretId || null,
            };
            continue;
        }

        snapshot[feature] = {
            mode: 'Not Configured',
        };
    }

    return snapshot;
}

function summarizePromptState(value) {
    return String(value || '').trim().length > 0 ? 'configured' : 'missing';
}

function summarizeTemplateState(value) {
    const text = String(value || '').trim();
    if (!text) return 'missing';
    if (text === 'Recalled memories:\n{{text}}') return 'default';
    return 'custom';
}

function buildSelectedRagSnapshot(settings) {
    const block = settings?.sharderMode === true ? 'rag' : 'ragStandard';
    const rag = getActiveRagSettings(settings) || {};
    const backend = String(rag.backend || 'vectra').toLowerCase();
    const injectionMode = rag.injectionMode || 'extension_prompt';
    const scoringMethod = rag.scoringMethod || 'keyword';
    const source = rag.source || 'transformers';
    const rerankerEnabled = !!rag.reranker?.enabled;
    const rerankerProvider = rag.reranker?.provider || 'similharity';

    const snapshot = {
        block,
        enabled: !!rag.enabled,
        backend,
        source,
        apiUrl: rag.apiUrl || '',
        model: rag.model || '',
        embeddingSecretId: rag.embeddingSecretId || null,
        autoVectorizeNewSummaries: rag.autoVectorizeNewSummaries !== false,
        useLorebooksForVectorization: !!rag.useLorebooksForVectorization,
        vectorizationLorebookNames: Array.isArray(rag.vectorizationLorebookNames) ? rag.vectorizationLorebookNames : [],
        includeLorebooksInShardSelection: !!rag.includeLorebooksInShardSelection,
        insertCount: rag.insertCount ?? 5,
        queryCount: rag.queryCount ?? 2,
        protectCount: rag.protectCount ?? 5,
        maxItemsPerCompactedSection: rag.maxItemsPerCompactedSection ?? 5,
        scoreThreshold: rag.scoreThreshold ?? 0.25,
        scoringMethod,
        injectionMode,
        templateState: summarizeTemplateState(rag.template),
        rerankerEnabled,
    };

    if (injectionMode === 'extension_prompt') {
        snapshot.position = Number(rag.position) || 0;
        snapshot.depth = Number(rag.depth) || 0;
    } else {
        snapshot.injectionVariableName = rag.injectionVariableName || 'ss_rag_memory';
    }

    if (scoringMethod === 'hybrid') {
        snapshot.hybridFusionMethod = rag.hybridFusionMethod || 'rrf';
        snapshot.hybridOverfetchMultiplier = rag.hybridOverfetchMultiplier ?? 4;
        if (snapshot.hybridFusionMethod === 'weighted') {
            snapshot.hybridAlpha = rag.hybridAlpha ?? 0.4;
            snapshot.hybridBeta = rag.hybridBeta ?? 0.6;
        } else {
            snapshot.hybridRrfK = rag.hybridRrfK ?? 60;
        }
    }

    if (backend === 'qdrant') {
        const useCloud = rag.backendConfig?.qdrantUseCloud === true;
        snapshot.qdrantUseCloud = useCloud;
        snapshot.qdrantAddress = useCloud
            ? (rag.backendConfig?.qdrantUrl || '')
            : (rag.backendConfig?.qdrantAddress || 'localhost:6333');
        snapshot.qdrantApiKey = rag.backendConfig?.qdrantApiKey || '';
    } else if (backend === 'milvus') {
        snapshot.milvusAddress = rag.backendConfig?.milvusAddress || 'localhost:19530';
        snapshot.milvusToken = rag.backendConfig?.milvusToken || '';
    }

    if (block === 'rag') {
        snapshot.sceneAwareChunking = !!rag.sceneAwareChunking;
        snapshot.sectionAwareChunking = !!rag.sectionAwareChunking;
        snapshot.sceneExpansion = rag.sceneExpansion !== false;
        if (snapshot.sceneExpansion) {
            snapshot.maxSceneExpansionChunks = rag.maxSceneExpansionChunks ?? 10;
        }
        snapshot.recentSummaryCount = rag.recentSummaryCount ?? 1;
        snapshot.maxChunksPerShard = rag.maxChunksPerShard ?? 2;
    } else {
        snapshot.proseChunkingMode = rag.proseChunkingMode || 'paragraph';
    }

    if (rerankerEnabled) {
        const selectedProviderConfig = rag.reranker?.providerConfigs?.[rerankerProvider] || {};
        snapshot.rerankerProvider = rerankerProvider;
        snapshot.rerankerApiUrl = rag.reranker?.apiUrl || selectedProviderConfig.apiUrl || '';
        snapshot.rerankerModel = rag.reranker?.model || selectedProviderConfig.model || '';
        snapshot.rerankerSecretId = rag.reranker?.secretId || selectedProviderConfig.secretId || null;
    }

    return snapshot;
}

function buildExportState(settings) {
    const activeChatId = SillyTavern.getContext()?.chatId || '(none)';
    const activeThemeId = settings?.theme || getCurrentTheme() || 'default';
    const activeTheme = getThemes()?.[activeThemeId] || null;
    const activeRagKey = settings?.sharderMode === true ? 'rag' : 'ragStandard';

    const {
        prompts,
        customThemes,
        rag,
        ragStandard,
        savedApiConfigs,
        ...baseSettings
    } = settings || {};
    void savedApiConfigs;

    return {
        summary: {
            generatedAt: new Date().toISOString(),
            debugLogging: settings?.debugLogging === true,
            activeChatId,
            activeThemeId,
            activePromptName: settings?.activePromptName || '(none)',
            activeRagKey,
            secrets: 'redacted',
        },
        settings: baseSettings,
        apiConfigInUse: buildApiConfigSnapshot(settings),
        promptsInUse: {
            summaryPromptName: settings?.activePromptName || '(none)',
            summaryPromptState: summarizePromptState(getActivePrompt(settings)),
            sharderPromptName: 'Sharder Prompt',
            sharderPromptState: summarizePromptState(settings?.sharderPrompts?.prompt),
            draftingPromptName: 'Drafting Prompt',
            draftingPromptState: summarizePromptState(settings?.casingPrompt),
        },
        activeTheme: activeTheme ? {
            id: activeThemeId,
            name: activeTheme.name || activeThemeId,
            description: activeTheme.description || '',
            preview: activeTheme.preview || '',
            builtin: !!activeTheme.builtin,
            colors: activeTheme.colors || {},
            extraStyles: activeTheme.extraStyles || '',
        } : {
            id: activeThemeId,
            missing: true,
        },
        activeRagSettings: buildSelectedRagSnapshot(settings),
        activeChatMetadata: {
            chatId: activeChatId,
            summarizedRanges: getChatRanges(),
        },
    };
}

function buildExportMarkdown(settings) {
    const exportState = buildExportState(settings);

    return [
        '# Summary Sharder Debug Settings',
        '',
        buildMarkdownTable('Summary', exportState.summary),
        '',
        buildMarkdownTable('Settings', exportState.settings),
        '',
        buildMarkdownTable('API Config In Use', exportState.apiConfigInUse),
        '',
        buildMarkdownTable('Prompts In Use', exportState.promptsInUse),
        '',
        buildMarkdownTable('Active Theme', exportState.activeTheme),
        '',
        buildMarkdownTable('Active RAG Settings', exportState.activeRagSettings),
        '',
        buildMarkdownTable('Active Chat Metadata', exportState.activeChatMetadata),
    ].join('\n');
}

function downloadMarkdown(markdown) {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `summary-sharder-debug-settings-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function copyMarkdown(markdown, textarea) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(markdown);
        } else {
            textarea?.focus();
            textarea?.select();
            document.execCommand('copy');
        }
        toastr.success('Debug settings copied');
    } catch (error) {
        log.warn('Failed to copy debug settings:', error?.message || error);
        toastr.error('Could not copy debug settings');
    }
}

export async function openDebugExportModal(settings) {
    const markdown = buildExportMarkdown(settings);
    const modalHtml = `
        <div class="ss-debug-export-modal">
            <h3>Debug Settings Export</h3>
            <p class="ss-text-hint">Share this for bug reports. API keys, tokens, passwords, and secure secret IDs are redacted.</p>
            <div class="ss-debug-export-actions">
                <button id="ss-debug-export-copy" class="menu_button" type="button">Copy Markdown</button>
                <button id="ss-debug-export-download" class="menu_button" type="button">Download .md</button>
            </div>
            <textarea id="ss-debug-export-output" class="text_pole ss-debug-export-textarea" readonly spellcheck="false">${escapeHtml(markdown)}</textarea>
        </div>
    `;

    const popup = new Popup(
        modalHtml,
        POPUP_TYPE.TEXT,
        null,
        decoratePopupOptionsForSs({
            okButton: 'Close',
            cancelButton: false,
            wide: true,
            large: true,
            onOpen: async (activePopup) => {
                activePopup?.dlg?.classList.add('ss-debug-export-popup');
            },
        }),
    );

    const showPromise = popup.show();

    requestAnimationFrame(() => {
        const root = popup?.dlg;
        const textarea = root?.querySelector('#ss-debug-export-output');
        root?.querySelector('#ss-debug-export-copy')?.addEventListener('click', () => {
            copyMarkdown(markdown, textarea);
        });
        root?.querySelector('#ss-debug-export-download')?.addEventListener('click', () => {
            downloadMarkdown(markdown);
            toastr.success('Debug settings downloaded');
        });
    });

    await showPromise;
}
