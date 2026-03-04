/**
 * RAG Collection Browser Modal for Summary Sharder
 */

import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
import { characters, getRequestHeaders, this_chid } from '../../../../../../../script.js';
import { extension_settings } from '../../../../../../extensions.js';
import { showSsConfirm, showSsInput } from '../../common/modal-base.js';
import {
    buildChunkHash,
    deleteChunks,
    getCollectionStats,
    getActiveCollectionId,
    getCollectionAlias,
    getCollectionIdOverride,
    getShardCollectionId,
    getStandardCollectionId,
    hybridQuery,
    insertChunks,
    listAllCollections,
    listChunks,
    purgeCollection,
    queryChunks,
    setCollectionAlias,
    setCollectionIdOverride,
    getQdrantDimensionMismatchToastMessage,
    isQdrantDimensionMismatchError,
} from '../../../core/rag/index.js';
import { saveSettings } from '../../../core/settings.js';
import { ragLog } from '../../../core/logger.js';

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const EXPORT_PAGE_SIZE = 100;
const REVECTORIZE_PAGE_SIZE = 200;
const REVECTORIZE_INSERT_BATCH_SIZE = 200;
const COLLECTION_REFRESH_COOLDOWN_MS = 3000;

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
function truncate(text, max = 180) {
    const value = String(text || '').trim();
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(0, max - 1))}...`;
}

/**
 * @param {string} fileName
 * @returns {string}
 */
function getChatDisplayName(fileName) {
    return String(fileName || '').replace(/\.jsonl$/i, '').replace(/\.json$/i, '');
}

/**
 * @param {string|null|undefined} chatId
 * @returns {string}
 */
function normalizeChatId(chatId) {
    return String(chatId || '').trim().replace(/\.jsonl$/i, '').replace(/\.json$/i, '');
}

/**
 * @param {string} collectionId
 * @returns {'Sharder'|'Standard'|'External'}
 */
function getCollectionModeLabel(collectionId) {
    const id = String(collectionId || '');
    if (id.startsWith('ss_shards_')) return 'Sharder';
    if (id.startsWith('ss_standard_')) return 'Standard';
    return 'External';
}

/**
 * @param {Object} raw
 * @returns {{id: string, source: string, backend: string, chunkCount: number, modelCount: number, model: string}|null}
 */
function normalizeCollection(raw, fallbackBackend = '') {
    const id = String(raw?.id || '').trim();
    if (!id) return null;
    const backend = String(raw?.backend || fallbackBackend || '').trim().toLowerCase();
    return {
        id,
        source: String(raw?.source || '').trim(),
        backend,
        chunkCount: Number(
            raw?.chunkCount
            ?? raw?.chunk_count
            ?? raw?.chunks
            ?? raw?.chunksCount
            ?? raw?.chunks_count
            ?? raw?.numChunks
            ?? raw?.num_chunks
            ?? raw?.points
            ?? raw?.pointCount
            ?? raw?.point_count
            ?? raw?.vectors
            ?? raw?.vectorCount
            ?? raw?.vector_count
            ?? raw?.count
            ?? raw?.total
            ?? raw?.totalCount
            ?? raw?.total_count
            ?? raw?.stats?.count
            ?? raw?.stats?.total
            ?? 0
        ) || 0,
        modelCount: Number(
            raw?.modelCount
            ?? raw?.model_count
            ?? raw?.models
            ?? raw?.stats?.modelCount
            ?? raw?.stats?.model_count
            ?? 0
        ) || 0,
        model: String(raw?.model ?? raw?.modelName ?? raw?.model_name ?? '').trim(),
    };
}

/**
 * Some plugin backends may omit chunk counts from the collections list.
 * Hydrate the selected collection's count via the stats endpoint so the modal doesn't
 * misleadingly show "0 chunks" for non-empty collections.
 *
 * @param {Object} state
 * @param {Object} dom
 */
async function hydrateSelectedCollectionChunkCount(state, dom) {
    const selected = state.selectedCollection;
    const collectionId = String(selected?.id || state.collectionId || '').trim();
    if (!collectionId) return;

    if (!state.hydratedCountIds) {
        state.hydratedCountIds = new Set();
    }
    if (state.hydratedCountIds.has(collectionId)) {
        return;
    }

    const existing = Number(selected?.chunkCount ?? 0) || 0;
    if (existing > 0) return;

    try {
        const rag = getEffectiveRagSettings(state);
        const { stats } = await getCollectionStats(collectionId, rag);
        const resolved = Number(stats?.count ?? stats?.total ?? 0) || 0;
        const target = (state.allCollections || []).find(item => item?.id === collectionId) || null;
        if (target && resolved !== (Number(target.chunkCount ?? 0) || 0)) {
            target.chunkCount = resolved;
        }
        // Selection may have changed while stats were in flight.
        if (String(state.selectedCollection?.id || '') !== collectionId) return;
        state.hydratedCountIds.add(collectionId);
        updateCollectionSelector(state, dom);
        updateStatCard(state, dom);
    } catch (error) {
        // Non-fatal; keep whatever count we have from the collections list.
        ragLog.debug('Failed to hydrate collection chunk count:', error?.message || error);
    }
}

/**
 * @param {Object} state
 * @param {string} chatId
 * @returns {string}
 */
function getChatLabel(state, chatId) {
    const normalized = normalizeChatId(chatId);
    if (!normalized) return 'current chat';
    const entry = (state.availableChats || []).find(chat =>
        (chat.candidates || []).some(candidate => normalizeChatId(candidate) === normalized)
    );
    if (entry?.displayName) return entry.displayName;
    return normalized;
}

/**
 * @param {Object} state
 * @param {string} collectionId
 * @returns {{chatId: string, fileName: string, displayName: string}|null}
 */
function getCollectionChatInfo(state, collectionId) {
    const targetCollectionId = String(collectionId || '').trim();
    if (!targetCollectionId) return null;

    for (const chat of (state.availableChats || [])) {
        const candidates = Array.isArray(chat.candidates) ? chat.candidates : [];
        for (const candidate of candidates) {
            const normalizedCandidate = normalizeChatId(candidate);
            if (!normalizedCandidate) continue;

            for (const mode of [true, false]) {
                try {
                    const derivedId = getActiveCollectionId(normalizedCandidate, {
                        ...state.settingsNoAlias,
                        sharderMode: mode,
                        collectionAliases: {},
                    });
                    if (derivedId === targetCollectionId) {
                        return {
                            chatId: normalizedCandidate,
                            fileName: chat.fileName || '',
                            displayName: chat.displayName || normalizedCandidate,
                        };
                    }
                } catch {
                    // ignored: unsupported candidate
                }
            }

            if (targetCollectionId.endsWith(normalizedCandidate)) {
                return {
                    chatId: normalizedCandidate,
                    fileName: chat.fileName || '',
                    displayName: chat.displayName || normalizedCandidate,
                };
            }
        }
    }

    return null;
}

/**
 * @param {Object} state
 * @returns {Object}
 */
function getEffectiveRagSettings(state) {
    const selected = state.selectedCollection || {};
    const hasSelected = !!selected.id;
    return {
        ...(state.rag || {}),
        ...(selected.backend ? { backend: selected.backend } : {}),
        ...(selected.source ? { source: selected.source } : {}),
        // Always override model when a collection is selected, even if its model path is ''
        // (flat-indexed). This prevents state.rag.model from leaking in and pointing to a
        // wrong subdirectory for collections that were indexed without a model sub-folder.
        ...(hasSelected ? { model: selected.model || '' } : {}),
    };
}

/**
 * @param {any} error
 * @param {string} [backendHint='']
 * @returns {boolean}
 */
function showQdrantMismatchToastIfNeeded(error, backendHint = '') {
    const backend = String(backendHint || '').toLowerCase();
    const isMismatch = error?.kind === 'qdrant-dimension-mismatch'
        || (backend === 'qdrant' && isQdrantDimensionMismatchError(error));
    if (!isMismatch) {
        return false;
    }
    if (typeof toastr !== 'undefined') {
        toastr.error(getQdrantDimensionMismatchToastMessage());
    }
    return true;
}

/**
 * @param {Object} state
 * @returns {string}
 */
function renderModalHtml(state) {
    const pageSizeOptions = PAGE_SIZE_OPTIONS.map(size => `
        <option value="${size}" ${state.limit === size ? 'selected' : ''}>${size}</option>
    `).join('');

    return `
        <div class="ss-rag-modal ss-rag-browser-modal">
            <h3 class="ss-rag-title">RAG Collection Browser</h3>
            <p class="ss-hint ss-rag-inline-hint">
                Browse and manage all vector collections exposed by the backend plugin.
            </p>

            <div class="ss-rag-section">
                <h4>Collection Selector</h4>
                <div class="ss-rag-backend-filter-row">
                    <button type="button" class="ss-rag-backend-toggle active" data-backend="vectra">Vectra</button>
                    <button type="button" class="ss-rag-backend-toggle active" data-backend="lancedb">LanceDB</button>
                    <button type="button" class="ss-rag-backend-toggle active" data-backend="qdrant">Qdrant</button>
                    <button type="button" class="ss-rag-backend-toggle active" data-backend="milvus">Milvus</button>
                </div>
                <div class="ss-rag-collection-dropdown" id="ss-rag-browser-collection-dropdown">
                    <div class="ss-rag-collection-dropdown-trigger" id="ss-rag-browser-collection-trigger" tabindex="0" role="combobox" aria-expanded="false">
                        <span id="ss-rag-browser-collection-label">Loading...</span>
                        <span class="fa-solid fa-chevron-down ss-rag-collection-dropdown-arrow"></span>
                    </div>
                    <div class="ss-rag-collection-dropdown-menu ss-hidden" id="ss-rag-browser-collection-menu">
                        <div class="ss-rag-collection-dropdown-search-wrap">
                            <input id="ss-rag-browser-collection-search" class="text_pole" type="text" placeholder="Search collections..." />
                        </div>
                        <div class="ss-rag-collection-dropdown-options" id="ss-rag-browser-collection-options"></div>
                    </div>
                </div>
                <p id="ss-rag-browser-chat-hint" class="ss-hint ss-rag-inline-hint"></p>
            </div>

            <div class="ss-rag-section">
                <h4>Collection Details</h4>
                <div class="ss-rag-browser-stat-card">
                    <div class="ss-rag-stat-info-grid">
                        <div class="ss-rag-stat-row">
                            <span class="ss-rag-stat-info-label">Collection</span>
                            <span id="ss-rag-stat-collection" class="ss-rag-stat-info-value">N/A</span>
                        </div>
                        <div class="ss-rag-stat-row">
                            <span class="ss-rag-stat-info-label">Mode</span>
                            <span id="ss-rag-stat-mode" class="ss-rag-stat-info-value">N/A</span>
                        </div>
                        <div class="ss-rag-stat-row">
                            <span class="ss-rag-stat-info-label">Chunks</span>
                            <span id="ss-rag-stat-chunks" class="ss-rag-stat-info-value">0</span>
                        </div>
                        <div class="ss-rag-stat-row">
                            <span class="ss-rag-stat-info-label">Character / Chat</span>
                            <span id="ss-rag-stat-character-chat" class="ss-rag-stat-info-value">N/A</span>
                        </div>
                        <div class="ss-rag-stat-row">
                            <span class="ss-rag-stat-info-label">Embedding Source</span>
                            <span id="ss-rag-stat-source" class="ss-rag-stat-info-value">N/A</span>
                        </div>
                        <div class="ss-rag-stat-row">
                            <span class="ss-rag-stat-info-label">Vector Backend</span>
                            <span id="ss-rag-stat-backend" class="ss-rag-stat-info-value">N/A</span>
                        </div>
                    </div>
                    <div class="ss-rag-browser-action-row">
                        <button id="ss-rag-browser-browse-btn" class="menu_button" type="button">Browse</button>
                        <button id="ss-rag-browser-rename-btn" class="menu_button" type="button">Rename</button>
                        <button id="ss-rag-browser-link-btn" class="menu_button" type="button">Link/Unlink</button>
                        <button id="ss-rag-browser-export-btn" class="menu_button" type="button">Export</button>
                        <button id="ss-rag-browser-import-btn" class="menu_button" type="button">Import</button>
                        <button id="ss-rag-browser-revectorize-btn" class="menu_button" type="button">Revectorize</button>
                        <button id="ss-rag-browser-delete-btn" class="menu_button ss-rag-btn-destructive" type="button">Delete</button>
                    </div>
                </div>
            </div>

            <div class="ss-rag-section">
                <h4>Chunk Browser</h4>
                <div class="ss-rag-grid-two">
                    <div class="ss-block">
                        <label for="ss-rag-browser-chunk-search">Search</label>
                        <input id="ss-rag-browser-chunk-search" class="text_pole" type="text" placeholder="Filter chunks..." />
                    </div>
                    <div class="ss-block">
                        <label for="ss-rag-browser-page-size">Page Size</label>
                        <select id="ss-rag-browser-page-size" class="text_pole">${pageSizeOptions}</select>
                    </div>
                </div>
                <div class="ss-rag-actions-row">
                    <input id="ss-rag-browser-prev" class="menu_button" type="button" value="Previous Page" />
                    <input id="ss-rag-browser-next" class="menu_button" type="button" value="Next Page" />
                </div>
                <p id="ss-rag-browser-page-info" class="ss-hint ss-rag-inline-hint">Click "Browse Chunks" to load collection items.</p>
                <div id="ss-rag-browser-items" class="ss-rag-browser-items"></div>
            </div>

            <div class="ss-rag-section">
                <h4>Test Query</h4>
                <div class="ss-block">
                    <label for="ss-rag-browser-query-text">Query Text</label>
                    <textarea id="ss-rag-browser-query-text" class="text_pole ss-rag-template" placeholder="Type a test query..."></textarea>
                </div>
                <div class="ss-rag-actions-row">
                    <input id="ss-rag-browser-run-query" class="menu_button" type="button" value="Run Query" />
                </div>
                <div id="ss-rag-browser-query-results" class="ss-rag-browser-query-results"></div>
            </div>
        </div>
    `;
}

/**
 * @param {Object} item
 * @returns {string}
 */
function renderChunkItem(item) {
    const meta = item?.metadata || {};
    const text = String(item?.text || '');
    const hash = item?.hash ?? '';
    const isDisabled = !!meta?.disabled;
    const index = Number(item?.index ?? meta?.messageIndex ?? 0);

    return `
        <details class="ss-rag-browser-item ${isDisabled ? 'disabled' : ''}">
            <summary>
                <input type="checkbox"
                       class="ss-rag-browser-item-toggle"
                       data-hash="${escapeHtml(String(hash))}"
                       ${isDisabled ? '' : 'checked'} />
                <span class="ss-rag-browser-item-index">#${index}</span>
                <span class="ss-rag-browser-item-preview">${escapeHtml(truncate(text, 140))}</span>
                <span class="ss-rag-browser-item-actions">
                    <button type="button" class="menu_button ss-rag-browser-action" data-action="edit" data-hash="${escapeHtml(String(hash))}">Edit</button>
                    <button type="button" class="menu_button ss-rag-browser-action" data-action="delete" data-hash="${escapeHtml(String(hash))}">Delete</button>
                </span>
            </summary>
            <div class="ss-rag-browser-item-body">
                <pre class="ss-rag-browser-text">${escapeHtml(text)}</pre>
                <pre class="ss-rag-browser-meta">${escapeHtml(JSON.stringify(meta, null, 2))}</pre>
            </div>
        </details>
    `;
}

/**
 * @param {HTMLElement} container
 * @param {Array<Object>} items
 */
function renderChunkList(container, items) {
    if (!container) return;
    if (!Array.isArray(items) || items.length === 0) {
        container.innerHTML = '<p class="ss-hint ss-rag-inline-hint">No chunks found for this page.</p>';
        return;
    }
    container.innerHTML = items.map(renderChunkItem).join('');
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
function clearChunkView(state, dom) {
    state.items = [];
    state.total = 0;
    renderChunkList(dom.items, []);
    if (dom.pageInfo) {
        dom.pageInfo.textContent = 'Click "Browse Chunks" to load collection items.';
    }
    if (dom.prevBtn) dom.prevBtn.disabled = true;
    if (dom.nextBtn) dom.nextBtn.disabled = true;
}

/**
 * @param {string} text
 * @param {string} query
 * @returns {boolean}
 */
function fuzzyMatch(text, query) {
    if (!query) return true;
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    let ti = 0;
    for (let qi = 0; qi < q.length; qi++) {
        const idx = t.indexOf(q[qi], ti);
        if (idx === -1) return false;
        ti = idx + 1;
    }
    return true;
}

/**
 * Chunk filtering should be *predictable* (substring-like), not subsequence fuzzy.
 * The subsequence matcher above works well for short IDs, but for long chunk text it
 * matches almost everything and feels like "no filtering".
 *
 * @param {Object} item
 * @param {string} query
 * @returns {boolean}
 */
function chunkMatchesQuery(item, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;

    const text = String(item?.text || '');
    if (text.toLowerCase().includes(q)) return true;

    const hash = String(item?.hash ?? '');
    if (hash.toLowerCase().includes(q)) return true;

    const idx = String(item?.index ?? item?.metadata?.messageIndex ?? '');
    if (idx && idx.includes(q)) return true;

    try {
        const meta = (item?.metadata && typeof item.metadata === 'object')
            ? JSON.stringify(item.metadata).toLowerCase()
            : '';
        if (meta.includes(q)) return true;
    } catch {
        // ignored: circular/invalid metadata
    }

    return false;
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
function updateCollectionSelector(state, dom) {
    const allCollections = Array.isArray(state.allCollections) ? state.allCollections : [];
    const activeBackends = Array.isArray(state.activeBackends) ? state.activeBackends : [];
    const searchQuery = String(state.collectionSearch || '').trim();
    const collections = allCollections
        .filter(collection => {
            if (activeBackends.length > 0 && !activeBackends.includes(collection.backend)) return false;
            if (searchQuery && !fuzzyMatch(collection.id, searchQuery)) return false;
            return true;
        })
        .sort((a, b) => {
            if (b.chunkCount !== a.chunkCount) return b.chunkCount - a.chunkCount;
            return a.id.localeCompare(b.id);
        });

    if (dom.collectionLabel) {
        dom.collectionLabel.textContent = state.collectionId || 'Select a collection...';
    }

    if (!dom.collectionOptions) return;

    if (collections.length === 0) {
        dom.collectionOptions.innerHTML = '<div class="ss-rag-collection-dropdown-empty">No collections found</div>';
        return;
    }

    dom.collectionOptions.innerHTML = collections.map(collection => `
        <div class="ss-rag-collection-dropdown-item ${collection.id === state.collectionId ? 'selected' : ''}"
             data-id="${escapeHtml(collection.id)}">
            <span class="ss-rag-collection-item-id">${escapeHtml(collection.id)}</span>
            <span class="ss-rag-collection-item-meta">${Number(collection.chunkCount || 0)} chunks · ${escapeHtml(collection.backend || 'unknown')}</span>
        </div>
    `).join('');
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
function updateLinkButton(state, dom) {
    if (!dom.linkBtn) return;
    let label = 'Link/Unlink';
    let enabled = false;

    const currentChatId = normalizeChatId(state.currentChatId);
    const hasLink = !!(getCollectionAlias(state.currentChatId) || getCollectionIdOverride(state.currentChatId));

    const isOwnCollection = state.collectionId && (
        state.collectionId === state.ownShardCollectionId ||
        state.collectionId === state.ownStandardCollectionId
    );

    if (currentChatId) {
        if (hasLink) {
            label = 'Unlink';
            enabled = true;
        } else if (state.collectionId && !isOwnCollection) {
            label = 'Link';
            enabled = true;
        }
    }

    dom.linkBtn.textContent = label;
    dom.linkBtn.disabled = !enabled;
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
function updateCollectionHint(state, dom) {
    if (!dom.chatHint) return;

    if (!state.selectedCollection) {
        dom.chatHint.textContent = 'No collection selected.';
        return;
    }

    if (!state.currentChatId) {
        dom.chatHint.textContent = 'No active chat detected; browsing collection metadata only.';
        return;
    }

    const override = getCollectionIdOverride(state.currentChatId);
    if (override) {
        dom.chatHint.textContent = override === state.collectionId
            ? 'Current chat is linked to this collection.'
            : `Current chat is linked to: ${override}`;
        return;
    }

    const alias = getCollectionAlias(state.currentChatId);
    if (alias) {
        dom.chatHint.textContent = `${getChatLabel(state, state.currentChatId)} is aliased to ${getChatLabel(state, alias)}.`;
        return;
    }

    const isOwnCollection = state.collectionId && (
        state.collectionId === state.ownShardCollectionId ||
        state.collectionId === state.ownStandardCollectionId
    );

    if (isOwnCollection) {
        dom.chatHint.textContent = 'This collection belongs to the current chat.';
        return;
    }

    dom.chatHint.textContent = 'Use Link to apply this collection to the current chat.';
}

/**
 * Find all chats (across all characters) linked to a collection via override.
 * Returns objects with displayName and isCurrentChar flag for formatting.
 * @param {Object} state
 * @param {string} collectionId
 * @returns {Array<{chatId: string, displayName: string, isCurrentChar: boolean}>}
 */
function getChatsLinkedToCollection(state, collectionId) {
    if (!collectionId) return [];

    const ss = extension_settings?.summary_sharder;
    const overrides = ss?.collectionIdOverrides || {};

    // Build a lookup map from chatId -> displayName for the current character's chats
    const displayNameMap = new Map();
    for (const chat of (state.availableChats || [])) {
        const chatId = normalizeChatId(chat.chatId);
        if (chatId) displayNameMap.set(chatId, chat.displayName || chat.chatId);
    }

    const linked = [];
    for (const [chatId, overrideId] of Object.entries(overrides)) {
        if (overrideId !== collectionId) continue;
        const displayName = displayNameMap.get(chatId) || chatId;
        linked.push({ chatId, displayName, isCurrentChar: displayNameMap.has(chatId) });
    }

    return linked;
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
function updateStatCard(state, dom) {
    const selected = state.selectedCollection;
    const collectionId = selected?.id || state.collectionId || 'N/A';
    const mode = getCollectionModeLabel(collectionId);
    const chunks = Math.max(
        Number(selected?.chunkCount || 0) || 0,
        Number(state.total || 0) || 0,
    );
    const source = String(selected?.source || 'N/A');
    const backend = String(selected?.backend || state.rag?.backend || 'N/A');

    const characterName = String(characters?.[this_chid]?.name || '').trim();
    let characterChatValue = 'N/A';

    // Show all chats (across all characters) linked to this collection
    const linkedChats = getChatsLinkedToCollection(state, collectionId);
    if (linkedChats.length > 0) {
        const labels = linkedChats.map(({ displayName, isCurrentChar }) =>
            isCurrentChar ? `${characterName || '?'} / ${displayName}` : displayName
        );
        characterChatValue = labels.join(', ');
    } else {
        // Fall back to reverse-mapping for collections not explicitly linked
        const chatInfo = getCollectionChatInfo(state, collectionId);
        if (chatInfo) {
            characterChatValue = `${characterName || 'N/A'} / ${chatInfo.displayName || chatInfo.chatId}`;
        }
    }

    if (dom.statCollection) dom.statCollection.textContent = collectionId;
    if (dom.statMode) dom.statMode.textContent = mode;
    if (dom.statChunks) dom.statChunks.textContent = `${chunks}`;
    if (dom.statCharacterChat) dom.statCharacterChat.textContent = characterChatValue;
    if (dom.statSource) dom.statSource.textContent = source;
    if (dom.statBackend) dom.statBackend.textContent = backend;

    updateLinkButton(state, dom);
    updateCollectionHint(state, dom);
}

/**
 * @param {Object} state
 * @param {string} collectionId
 */
function setSelectedCollection(state, collectionId) {
    const targetId = String(collectionId || '').trim();
    const selected = (state.allCollections || []).find(collection => collection.id === targetId) || null;
    state.selectedCollection = selected;
    state.collectionId = selected?.id || targetId;
    state.offset = 0;
    state.items = [];
    state.total = 0;
}

/**
 * @param {Object} state
 * @param {Object} dom
 * @param {{preferredCollectionId?: string, force?: boolean}} [options]
 */
async function refreshCollections(state, dom, options = {}) {
    if (state.collectionRefreshInFlight) {
        return state.collectionRefreshInFlight;
    }

    const now = Date.now();
    if (!options.force && state.lastCollectionsFetchAt && (now - state.lastCollectionsFetchAt) < COLLECTION_REFRESH_COOLDOWN_MS) {
        updateCollectionSelector(state, dom);
        updateStatCard(state, dom);
        clearChunkView(state, dom);
        return null;
    }

    state.collectionRefreshInFlight = (async () => {
        const knownBackends = ['vectra', 'lancedb', 'qdrant', 'milvus'];
        const backendsToQuery = state.activeBackends.length > 0 ? state.activeBackends : knownBackends;
        const results = await Promise.allSettled(backendsToQuery.map(b => listAllCollections(b)));
        const allRaw = results.flatMap((r, idx) => {
            if (r.status !== 'fulfilled') return [];
            const requestedBackend = String(backendsToQuery[idx] || '').trim().toLowerCase();
            const items = Array.isArray(r.value) ? r.value : [];
            return items.flatMap(item => {
                const reportedBackend = String(item?.backend || '').trim().toLowerCase();
                // Defensive: if the plugin returns mixed-backend items despite the `?backend=...` query,
                // drop anything that explicitly reports a different backend so filters stay meaningful.
                if (reportedBackend && requestedBackend && reportedBackend !== requestedBackend) return [];
                return [{ ...(item || {}), backend: reportedBackend || requestedBackend }];
            });
        });
        // Keep the entry with the highest chunkCount per backend|id key so that real data
        // always wins over ghost empty indexes created by source-path mismatches.
        const bestByKey = new Map();
        for (const item of allRaw) {
            const key = `${String(item?.backend || '').toLowerCase()}|${String(item?.id || '')}`;
            const existing = bestByKey.get(key);
            const existingCount = Number(existing?.chunkCount ?? 0) || 0;
            const itemCount = Number(item?.chunkCount ?? 0) || 0;
            if (!existing || itemCount > existingCount) {
                bestByKey.set(key, item);
            }
        }
        const deduped = [...bestByKey.values()];
        state.allCollections = deduped
            .map(item => normalizeCollection(item, item?.backend))
            .filter(Boolean)
            .sort((a, b) => {
                if (b.chunkCount !== a.chunkCount) return b.chunkCount - a.chunkCount;
                return a.id.localeCompare(b.id);
            });

        const preferredCollectionId = String(
            options?.preferredCollectionId
            || state.collectionId
            || state.currentCollectionId
            || ''
        ).trim();

        const preferredExists = state.allCollections.some(collection => collection.id === preferredCollectionId);
        const selectedId = preferredExists
            ? preferredCollectionId
            : (state.allCollections[0]?.id || '');
        setSelectedCollection(state, selectedId);
        updateCollectionSelector(state, dom);
        updateStatCard(state, dom);
        clearChunkView(state, dom);
        await hydrateSelectedCollectionChunkCount(state, dom);
        state.lastCollectionsFetchAt = Date.now();
        return state.allCollections;
    })().finally(() => {
        state.collectionRefreshInFlight = null;
    });

    return state.collectionRefreshInFlight;
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
async function refreshPage(state, dom) {
    if (!state.collectionId) {
        clearChunkView(state, dom);
        return;
    }

    const rag = getEffectiveRagSettings(state);
    const { items, total, hasMore } = await listChunks(state.collectionId, rag, {
        offset: state.offset,
        limit: state.limit,
    });

    state.items = Array.isArray(items) ? items : [];
    const totalNumber = Number(total || 0) || 0;

    // Some plugin/backends may omit a stable `total` count for list endpoints.
    // Avoid clobbering a known collection count with 0 when we have visible items.
    if (totalNumber > 0) {
        state.total = totalNumber;
    } else if (!hasMore && state.offset === 0 && state.items.length > 0) {
        state.total = state.items.length;
    } else if (state.items.length === 0 && !hasMore && state.offset === 0) {
        state.total = 0;
    } else {
        // Unknown total: keep as 0 for paging math, but don't overwrite collection metadata.
        state.total = 0;
    }

    const chunkQuery = String(state.chunkSearch || '').trim();
    const itemsToRender = chunkQuery
        ? state.items.filter(item => chunkMatchesQuery(item, chunkQuery))
        : state.items;
    renderChunkList(dom.items, itemsToRender);

    const fallbackTotal = Number(state.selectedCollection?.chunkCount || 0) || 0;
    const displayTotal = state.total > 0 ? state.total : fallbackTotal;

    const start = (state.items.length === 0 && displayTotal === 0) ? 0 : state.offset + 1;
    const end = state.items.length === 0 ? 0 : (state.offset + state.items.length);
    const totalLabel = displayTotal > 0 ? String(displayTotal) : '?';
    if (dom.pageInfo) {
        dom.pageInfo.textContent = `Showing ${start}-${end} of ${totalLabel} chunks`;
    }
    if (dom.prevBtn) dom.prevBtn.disabled = state.offset <= 0;
    if (dom.nextBtn) {
        if (displayTotal > 0) {
            dom.nextBtn.disabled = end >= displayTotal;
        } else {
            dom.nextBtn.disabled = !hasMore;
        }
    }

    if (state.selectedCollection) {
        // Only update the cached collection count when Browse returned real data.
        // Never overwrite a non-zero scan count with 0 — an empty result could mean
        // the plugin looked in the wrong path (ghost index), not that the collection is empty.
        if (state.total > 0) {
            state.selectedCollection.chunkCount = state.total;
        }
    }
    updateCollectionSelector(state, dom);
    updateStatCard(state, dom);

    // If we still don't have a reliable count but we do have items, hydrate from stats.
    if ((Number(state.selectedCollection?.chunkCount ?? 0) || 0) === 0 && state.items.length > 0) {
        await hydrateSelectedCollectionChunkCount(state, dom);
    }
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
async function runQuery(state, dom) {
    const queryText = String(dom.queryInput?.value || '').trim();
    if (!queryText) {
        toastr.warning('Enter query text first');
        return;
    }
    if (!state.collectionId) {
        toastr.warning('Select a collection first');
        return;
    }

    const rag = getEffectiveRagSettings(state);
    const useHybrid = (rag.backend === 'qdrant' || rag.backend === 'milvus')
        && rag.scoringMethod === 'hybrid';
    const queryFn = useHybrid ? hybridQuery : queryChunks;
    const topK = Math.max(1, Number(rag.insertCount) || 5);
    const threshold = Math.max(0, Math.min(1, Number(rag.scoreThreshold) || 0));
    const queryRes = await queryFn(state.collectionId, queryText, topK, threshold, rag);

    const merged = Array.isArray(queryRes?.results)
        ? queryRes.results.map(item => ({ ...item, _collection: 'fragments' }))
        : [];
    merged.sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));

    if (!dom.queryResults) return;
    if (merged.length === 0) {
        dom.queryResults.innerHTML = '<p class="ss-hint ss-rag-inline-hint">No query results.</p>';
        return;
    }

    const resultsHtml = merged.map(item => {
        const sceneCode = item?.metadata?.sceneCode ? ` scene=${item.metadata.sceneCode}` : '';
        return `
            <li>
                <strong>${item._collection}</strong>
                score=${Number(item?.score || 0).toFixed(4)}${sceneCode}
                <div>${escapeHtml(truncate(item?.text || '', 180))}</div>
            </li>
        `;
    }).join('');

    dom.queryResults.innerHTML = `
        <div class="ss-rag-browser-query-panel">
            <p class="ss-hint ss-rag-inline-hint">Top ${merged.length} results</p>
            <ul class="ss-rag-browser-query-list">${resultsHtml}</ul>
        </div>
    `;
}

/**
 * @param {Object} item
 * @param {string} newText
 * @param {Object} metadataPatch
 * @returns {{text: string, hash: string|number, index: number, metadata: Object}}
 */
function buildEditedChunk(item, newText, metadataPatch = {}) {
    const normalized = String(newText || '').trim();
    const metadata = (item?.metadata && typeof item.metadata === 'object') ? { ...item.metadata } : {};
    Object.assign(metadata, metadataPatch || {});
    const index = Number.isFinite(Number(item?.index))
        ? Number(item.index)
        : Number(metadata.messageIndex ?? 0);

    // Always generate a new hash based on the updated text to ensure Vectra treats this as a new chunk
    // rather than attempting an upsert that may not update the text content properly
    const hash = buildChunkHash(`${index}|${normalized}`);

    return {
        text: normalized,
        hash,
        index,
        metadata,
    };
}

/**
 * @param {Object} state
 * @param {string|number} hash
 * @returns {Object|null}
 */
function findChunkByHash(state, hash) {
    const target = String(hash ?? '');
    if (!target) return null;
    return (state.items || []).find(item => String(item?.hash ?? '') === target) || null;
}

/**
 * @param {Object} item
 * @returns {Promise<{text: string, keywords: string[], keywordWeights: Object}|null>}
 */
function showChunkEditModal(item) {
    let resolved = false;
    return new Promise((resolve) => {
        const existingKeywords = Array.isArray(item?.metadata?.keywords)
            ? item.metadata.keywords.map(keyword => String(keyword || '').trim()).filter(Boolean)
            : [];
        const existingWeights = (item?.metadata?.keywordWeights && typeof item.metadata.keywordWeights === 'object')
            ? item.metadata.keywordWeights
            : {};
        const tags = [];
        const seen = new Set();

        for (const keyword of existingKeywords) {
            const key = keyword.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            const weight = Number(existingWeights[keyword]);
            tags.push({ keyword, weight: Number.isFinite(weight) && weight > 0 ? weight : 1 });
        }
        for (const [keyword, rawWeight] of Object.entries(existingWeights)) {
            const cleanKeyword = String(keyword || '').trim();
            if (!cleanKeyword) continue;
            const key = cleanKeyword.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            const weight = Number(rawWeight);
            tags.push({ keyword: cleanKeyword, weight: Number.isFinite(weight) && weight > 0 ? weight : 1 });
        }

        const modalHtml = `
            <div class="ss-owned-popup-content ss-rag-edit-modal">
                <h3>Edit Chunk</h3>
                <p class="ss-hint ss-rag-inline-hint">Keywords</p>
                <div id="ss-rag-edit-tag-host" class="ss-weighted-tag-container"></div>
                <input id="ss-rag-edit-tag-input" class="text_pole" type="text" placeholder="Type keyword and press Enter or comma" />
                <p class="ss-hint ss-rag-inline-hint">Chunk Text</p>
                <textarea id="ss-rag-edit-text" class="text_pole ss-rag-template" rows="10">${escapeHtml(String(item?.text || ''))}</textarea>
                <div class="ss-rag-actions-row ss-rag-actions-row-tight">
                    <button type="button" id="ss-rag-edit-save" class="menu_button">Save Changes</button>
                </div>
            </div>
        `;

        const popup = new Popup(modalHtml, POPUP_TYPE.TEXT, null, {
            okButton: 'Cancel',
            cancelButton: false,
            wide: true,
            large: true,
        });

        const renderTags = (container) => {
            if (!container) return;
            container.innerHTML = '';
            for (const tag of tags) {
                const el = document.createElement('span');
                el.className = 'ss-weighted-tag';
                el.dataset.keyword = tag.keyword;

                const label = document.createElement('span');
                label.textContent = tag.keyword;

                const weightInput = document.createElement('input');
                weightInput.type = 'number';
                weightInput.className = 'ss-weighted-tag-weight';
                weightInput.step = '0.1';
                weightInput.min = '0.1';
                weightInput.value = String(Number(tag.weight).toFixed(1));
                weightInput.dataset.keyword = tag.keyword;

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'ss-weighted-tag-remove';
                removeBtn.dataset.keyword = tag.keyword;
                removeBtn.textContent = '✕';

                el.appendChild(label);
                el.appendChild(weightInput);
                el.appendChild(removeBtn);
                container.appendChild(el);
            }
        };

        const upsertTag = (rawKeyword, weight = 1) => {
            const keyword = String(rawKeyword || '').trim();
            if (!keyword) return;
            const key = keyword.toLowerCase();
            const existing = tags.find(tag => tag.keyword.toLowerCase() === key);
            if (existing) {
                existing.keyword = keyword;
                existing.weight = Number.isFinite(Number(weight)) && Number(weight) > 0 ? Number(weight) : 1;
                return;
            }
            tags.push({
                keyword,
                weight: Number.isFinite(Number(weight)) && Number(weight) > 0 ? Number(weight) : 1,
            });
        };

        const showPromise = popup.show();

        requestAnimationFrame(() => {
            const tagHost = document.getElementById('ss-rag-edit-tag-host');
            const tagInput = document.getElementById('ss-rag-edit-tag-input');
            const textarea = document.getElementById('ss-rag-edit-text');
            const saveBtn = document.getElementById('ss-rag-edit-save');

            renderTags(tagHost);
            textarea?.focus();

            tagInput?.addEventListener('keydown', (event) => {
                if (!(event.key === 'Enter' || event.key === ',')) return;
                event.preventDefault();
                const value = String(tagInput.value || '').trim().replace(/,$/, '');
                if (!value) return;
                upsertTag(value, 1);
                tagInput.value = '';
                renderTags(tagHost);
            });

            tagHost?.addEventListener('click', (event) => {
                const target = event.target instanceof Element ? event.target.closest('.ss-weighted-tag-remove') : null;
                if (!target) return;
                event.preventDefault();
                const keyword = String(target.getAttribute('data-keyword') || '').trim().toLowerCase();
                if (!keyword) return;
                const index = tags.findIndex(tag => tag.keyword.toLowerCase() === keyword);
                if (index >= 0) {
                    tags.splice(index, 1);
                    renderTags(tagHost);
                }
            });

            tagHost?.addEventListener('change', (event) => {
                const input = event.target instanceof HTMLInputElement
                    ? event.target
                    : null;
                if (!input || !input.classList.contains('ss-weighted-tag-weight')) return;
                const keyword = String(input.getAttribute('data-keyword') || '').trim().toLowerCase();
                const tag = tags.find(entry => entry.keyword.toLowerCase() === keyword);
                if (!tag) return;
                const value = Number(input.value);
                tag.weight = Number.isFinite(value) && value > 0 ? value : 1;
                input.value = String(Number(tag.weight).toFixed(1));
            });

            saveBtn?.addEventListener('click', () => {
                if (resolved) return;
                const text = String(textarea?.value || '').trim();
                ragLog.debug('[RAG Edit] Captured text from textarea:', text);
                ragLog.debug('[RAG Edit] Original item text:', String(item?.text || ''));
                if (!text) {
                    toastr.warning('Chunk text cannot be empty');
                    return;
                }

                const keywords = tags
                    .map(tag => String(tag.keyword || '').trim())
                    .filter(Boolean);
                const keywordWeights = {};
                for (const tag of tags) {
                    const keyword = String(tag.keyword || '').trim();
                    if (!keyword) continue;
                    const weight = Number(tag.weight);
                    keywordWeights[keyword] = Number.isFinite(weight) && weight > 0 ? weight : 1;
                }

                resolved = true;
                popup.complete(POPUP_RESULT.AFFIRMATIVE);
                resolve({ text, keywords, keywordWeights });
            });
        });

        showPromise.then(() => {
            if (resolved) return;
            resolved = true;
            resolve(null);
        }).catch(() => {
            if (resolved) return;
            resolved = true;
            resolve(null);
        });
    });
}

/**
 * @returns {Promise<'json'|'csv'|null>}
 */
function showExportFormatChoice() {
    let resolved = false;
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="ss-owned-popup-content ss-rag-export-modal">
                <h3>Export Collection</h3>
                <p class="ss-hint ss-rag-inline-hint">Choose export format:</p>
                <div class="ss-rag-actions-row ss-rag-actions-row-tight">
                    <button type="button" id="ss-rag-export-json" class="menu_button">JSON</button>
                    <button type="button" id="ss-rag-export-csv" class="menu_button">CSV</button>
                </div>
            </div>
        `;

        const popup = new Popup(modalHtml, POPUP_TYPE.TEXT, null, {
            okButton: 'Cancel',
            cancelButton: false,
            wide: true,
        });
        const showPromise = popup.show();

        requestAnimationFrame(() => {
            const jsonBtn = document.getElementById('ss-rag-export-json');
            const csvBtn = document.getElementById('ss-rag-export-csv');

            jsonBtn?.addEventListener('click', () => {
                if (resolved) return;
                resolved = true;
                popup.complete(POPUP_RESULT.AFFIRMATIVE);
                resolve('json');
            });
            csvBtn?.addEventListener('click', () => {
                if (resolved) return;
                resolved = true;
                popup.complete(POPUP_RESULT.AFFIRMATIVE);
                resolve('csv');
            });
        });

        showPromise.then(() => {
            if (resolved) return;
            resolved = true;
            resolve(null);
        }).catch(() => {
            if (resolved) return;
            resolved = true;
            resolve(null);
        });
    });
}

/**
 * @param {string} content
 * @param {string} filename
 * @param {string} mime
 */
function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * @param {any} value
 * @returns {string}
 */
function toCsvValue(value) {
    const text = String(value ?? '');
    if (!/[",\n]/.test(text)) return text;
    return `"${text.replace(/"/g, '""')}"`;
}

/**
 * @param {Array<Object>} chunks
 * @returns {string}
 */
function chunksToCsv(chunks) {
    const columns = [
        'hash',
        'index',
        'text',
        'score',
        'keywords',
        'importance',
        'sceneCode',
        'speaker',
        'characterName',
        'timestamp',
        'disabled',
    ];

    const rows = [columns.join(',')];
    for (const chunk of (chunks || [])) {
        const metadata = (chunk?.metadata && typeof chunk.metadata === 'object') ? chunk.metadata : {};
        const keywords = Array.isArray(metadata.keywords) ? metadata.keywords.join('|') : '';
        const row = [
            chunk?.hash ?? '',
            chunk?.index ?? '',
            chunk?.text ?? '',
            chunk?.score ?? '',
            keywords,
            metadata?.importance ?? '',
            metadata?.sceneCode ?? '',
            metadata?.speaker ?? '',
            metadata?.characterName ?? '',
            metadata?.timestamp ?? '',
            metadata?.disabled === true ? 'true' : 'false',
        ].map(toCsvValue).join(',');
        rows.push(row);
    }
    return rows.join('\n');
}

/**
 * @param {Object} state
 */
async function handleExport(state) {
    if (!state.collectionId) {
        toastr.warning('Select a collection first');
        return;
    }
    const format = await showExportFormatChoice();
    if (!format) return;

    const rag = getEffectiveRagSettings(state);
    const allChunks = [];
    let offset = 0;

    while (true) {
        const { items, hasMore } = await listChunks(state.collectionId, rag, {
            offset,
            limit: EXPORT_PAGE_SIZE,
        });
        const safeItems = Array.isArray(items) ? items : [];
        allChunks.push(...safeItems);
        if (!hasMore || safeItems.length === 0) break;
        offset += safeItems.length;
    }

    const safeName = String(state.collectionId || 'collection').replace(/[<>:"/\\|?*]/g, '_');
    if (format === 'json') {
        downloadFile(
            JSON.stringify(allChunks, null, 2),
            `${safeName}.json`,
            'application/json',
        );
    } else {
        downloadFile(
            chunksToCsv(allChunks),
            `${safeName}.csv`,
            'text/csv',
        );
    }
    toastr.success(`Exported ${allChunks.length} chunks as ${format.toUpperCase()}`);
}

/**
 * @returns {Promise<File|null>}
 */
function pickImportFile() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv';
        let resolved = false;
        const finish = (file) => {
            if (resolved) return;
            resolved = true;
            resolve(file ?? null);
        };
        input.addEventListener('change', () => finish(input.files?.[0] ?? null));
        input.addEventListener('cancel', () => finish(null));
        input.click();
    });
}

/**
 * Parse a RFC-4180 CSV string into an array of row arrays.
 * Handles quoted fields with embedded commas, newlines, and escaped quotes.
 * @param {string} csvText
 * @returns {string[][]}
 */
function parseCsvRows(csvText) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const text = String(csvText || '');

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                field += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(field);
            field = '';
        } else if (ch === '\r') {
            if (text[i + 1] === '\n') i++;
            row.push(field);
            field = '';
            rows.push(row);
            row = [];
        } else if (ch === '\n') {
            row.push(field);
            field = '';
            rows.push(row);
            row = [];
        } else {
            field += ch;
        }
    }

    row.push(field);
    if (row.some(f => f !== '')) rows.push(row);

    return rows;
}

/**
 * Parse a CSV string (as produced by chunksToCsv) into chunk objects.
 * @param {string} csvText
 * @returns {Array<{hash: any, text: string, index: number, metadata: Object}>}
 */
function csvToChunks(csvText) {
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) return [];

    const header = rows[0].map(h => String(h || '').trim().toLowerCase());
    const col = (row, name) => {
        const idx = header.indexOf(name);
        return idx >= 0 ? String(row[idx] ?? '') : '';
    };

    const chunks = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const text = col(row, 'text');
        if (!text) continue;

        const hashRaw = col(row, 'hash');
        const indexRaw = col(row, 'index');
        const index = Number.isFinite(Number(indexRaw)) ? Number(indexRaw) : 0;
        const hash = hashRaw || buildChunkHash(`${index}|${text}`);

        const keywordsRaw = col(row, 'keywords');
        const keywords = keywordsRaw ? keywordsRaw.split('|').map(k => k.trim()).filter(Boolean) : [];

        const metadata = {};
        if (keywords.length > 0) metadata.keywords = keywords;
        const importance = col(row, 'importance');
        if (importance !== '') metadata.importance = isNaN(Number(importance)) ? importance : Number(importance);
        const sceneCode = col(row, 'scenecode');
        if (sceneCode) metadata.sceneCode = sceneCode;
        const speaker = col(row, 'speaker');
        if (speaker) metadata.speaker = speaker;
        const characterName = col(row, 'charactername');
        if (characterName) metadata.characterName = characterName;
        const timestamp = col(row, 'timestamp');
        if (timestamp) metadata.timestamp = timestamp;
        if (col(row, 'disabled') === 'true') metadata.disabled = true;

        chunks.push({ hash, text, index, metadata });
    }
    return chunks;
}

/**
 * @param {string} fileName
 * @param {string} content
 * @returns {Array<{hash: any, text: string, index: number, metadata: Object}>}
 */
function parseImportFile(fileName, content) {
    const ext = String(fileName || '').split('.').pop().toLowerCase();
    if (ext === 'csv') {
        return csvToChunks(content);
    }
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
        throw new Error('JSON import must be an array of chunks');
    }
    return parsed
        .filter(item => item && typeof item === 'object' && String(item.text || '').trim())
        .map(item => ({
            hash: item.hash,
            text: String(item.text || '').trim(),
            index: Number.isFinite(Number(item.index)) ? Number(item.index) : 0,
            metadata: (item.metadata && typeof item.metadata === 'object') ? { ...item.metadata } : {},
        }));
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
async function handleImport(state, dom) {
    if (!state.collectionId) {
        toastr.warning('Select a collection first');
        return;
    }

    const file = await pickImportFile();
    if (!file) return;

    let chunks;
    try {
        const content = await file.text();
        chunks = parseImportFile(file.name, content);
    } catch (error) {
        toastr.error(`Failed to parse file: ${error?.message || error}`);
        return;
    }

    if (chunks.length === 0) {
        toastr.warning('No valid chunks found in file');
        return;
    }

    const confirmed = await showSsConfirm(
        'Import Chunks',
        `Import ${chunks.length} chunk(s) into "${state.collectionId}"?\nExisting chunks with the same hash will be overwritten.`,
    );
    if (confirmed !== POPUP_RESULT.AFFIRMATIVE) return;

    const rag = getEffectiveRagSettings(state);
    toastr.info(`Importing ${chunks.length} chunk(s)...`);

    let inserted = 0;
    for (let i = 0; i < chunks.length; i += REVECTORIZE_INSERT_BATCH_SIZE) {
        const batch = chunks.slice(i, i + REVECTORIZE_INSERT_BATCH_SIZE);
        const result = await insertChunks(state.collectionId, batch, rag);
        inserted += Number(result?.inserted ?? batch.length) || 0;
    }

    toastr.success(`Imported ${inserted} chunk(s) into ${state.collectionId}`);
    await refreshCollections(state, dom, { preferredCollectionId: state.collectionId, force: true });
    await refreshPage(state, dom);
}

/**
 * @param {string} sourceCollectionId
 * @param {string} targetCollectionId
 * @param {Object} ragSettings
 * @param {(progress: {copied: number, total: number}) => void} [onProgress]
 * @returns {Promise<{copied: number, total: number}>}
 */
async function copyCollectionChunks(sourceCollectionId, targetCollectionId, ragSettings, onProgress) {
    let offset = 0;
    let copied = 0;
    let total = 0;

    while (true) {
        const { items, total: totalCount, hasMore } = await listChunks(sourceCollectionId, ragSettings, {
            offset,
            limit: EXPORT_PAGE_SIZE,
            includeVectors: true,
        });

        total = Number(totalCount || 0);
        const safeItems = Array.isArray(items) ? items : [];
        const batch = safeItems
            .map(item => ({
                hash: item?.hash,
                text: String(item?.text || ''),
                index: Number(item?.index ?? item?.metadata?.messageIndex ?? 0),
                metadata: (item?.metadata && typeof item.metadata === 'object') ? { ...item.metadata } : {},
                ...(Array.isArray(item?.vector) ? { vector: item.vector } : {}),
            }))
            .filter(item => item.text.length > 0);

        if (batch.length > 0) {
            await insertChunks(targetCollectionId, batch, ragSettings);
            copied += batch.length;
            if (typeof onProgress === 'function') {
                onProgress({ copied, total });
            }
        }

        if (!hasMore || safeItems.length === 0) break;
        offset += safeItems.length;
    }

    return { copied, total };
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
async function handleRenameCollection(state, dom) {
    if (!state.collectionId) {
        toastr.warning('Select a collection first');
        return;
    }

    const nextName = await showSsInput(
        'Rename Collection',
        'Enter new collection ID:',
        state.collectionId,
    );
    if (nextName === null) return;

    const newCollectionId = String(nextName || '').trim();
    if (!newCollectionId) {
        toastr.warning('Collection ID cannot be empty');
        return;
    }
    if (newCollectionId === state.collectionId) {
        toastr.info('Collection name unchanged');
        return;
    }

    const exists = (state.allCollections || []).some(collection => collection.id === newCollectionId);
    if (exists) {
        const overwriteConfirm = await showSsConfirm(
            'Collection Exists',
            'Target collection already exists. Copy chunks into it and delete the source collection?',
        );
        if (overwriteConfirm !== POPUP_RESULT.AFFIRMATIVE) return;
    }

    const rag = getEffectiveRagSettings(state);
    toastr.info('Renaming collection (copy + delete)...');
    const progress = await copyCollectionChunks(
        state.collectionId,
        newCollectionId,
        rag,
    );
    await purgeCollection(state.collectionId, rag);
    toastr.success(`Collection renamed (${progress.copied} chunks moved)`);
    await refreshCollections(state, dom, { preferredCollectionId: newCollectionId, force: true });
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
async function handleDeleteCollection(state, dom) {
    if (!state.collectionId) {
        toastr.warning('Select a collection first');
        return;
    }

    const confirmed = await showSsConfirm(
        'Delete Collection',
        `Delete collection "${state.collectionId}"? This cannot be undone.`,
    );
    if (confirmed !== POPUP_RESULT.AFFIRMATIVE) return;

    const rag = getEffectiveRagSettings(state);
    await purgeCollection(state.collectionId, rag);
    toastr.success('Collection deleted');
    await refreshCollections(state, dom, { preferredCollectionId: state.currentCollectionId || '', force: true });
}

/**
 * @param {Object} state
 */
async function collectCollectionForRevectorize(collectionId, ragSettings) {
    const allChunks = [];
    let offset = 0;

    while (true) {
        const { items, hasMore } = await listChunks(collectionId, ragSettings, {
            offset,
            limit: REVECTORIZE_PAGE_SIZE,
            includeVectors: false,
        });

        const safeItems = Array.isArray(items) ? items : [];
        allChunks.push(...safeItems);

        if (!hasMore || safeItems.length === 0) {
            break;
        }
        offset += safeItems.length;
    }

    return allChunks
        .map((item, idx) => {
            const text = String(item?.text || '').trim();
            if (!text) return null;

            const metadata = (item?.metadata && typeof item.metadata === 'object')
                ? { ...item.metadata }
                : {};

            let index = Number(item?.index);
            if (!Number.isFinite(index)) {
                index = Number(metadata?.messageIndex);
            }
            if (!Number.isFinite(index)) {
                index = idx;
            }

            const existingHash = item?.hash;
            const hash = (existingHash !== undefined && existingHash !== null && String(existingHash).trim() !== '')
                ? existingHash
                : buildChunkHash(`${index}|${text}`);

            return {
                hash,
                text,
                index,
                metadata,
            };
        })
        .filter(Boolean);
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
async function handleRevectorizeCollection(state, dom) {
    if (!state.collectionId || !state.selectedCollection) {
        toastr.warning('Select a collection first');
        return;
    }

    const selectedBackend = String(state.selectedCollection.backend || '').trim().toLowerCase();
    const draftBackend = String(state.rag?.backend || 'vectra').trim().toLowerCase();
    if (selectedBackend && draftBackend && selectedBackend !== draftBackend) {
        toastr.warning(`Backend mismatch: selected collection uses ${selectedBackend}, but RAG settings use ${draftBackend}. Set the same backend in RAG settings first.`);
        return;
    }

    const confirmed = await showSsConfirm(
        'Revectorize Collection',
        `Revectorize "${state.collectionId}" using current RAG settings?\nThis will delete and rebuild vectors for this collection and may take time.`,
    );
    if (confirmed !== POPUP_RESULT.AFFIRMATIVE) {
        return;
    }

    const ragSettings = {
        ...(state.rag || {}),
        backend: selectedBackend || draftBackend || 'vectra',
    };

    const chunks = await collectCollectionForRevectorize(state.collectionId, ragSettings);
    toastr.info(`Revectorizing ${chunks.length} chunk(s)...`);

    await purgeCollection(state.collectionId, ragSettings);

    let inserted = 0;
    for (let i = 0; i < chunks.length; i += REVECTORIZE_INSERT_BATCH_SIZE) {
        const batch = chunks.slice(i, i + REVECTORIZE_INSERT_BATCH_SIZE);
        if (batch.length === 0) continue;

        const result = await insertChunks(state.collectionId, batch, ragSettings);
        inserted += Number(result?.inserted ?? batch.length) || 0;
    }

    toastr.success(`Revectorized collection (${inserted}/${chunks.length} chunks)`);
    await refreshCollections(state, dom, { preferredCollectionId: state.collectionId, force: true });
    await refreshPage(state, dom);
}

/**
 * @param {Object} state
 * @param {Object} settings
 * @param {Object} dom
 */
async function handleLinkToggle(state, settings, dom) {
    if (!state.currentChatId) {
        toastr.warning('No active chat detected');
        return;
    }

    const currentAlias = getCollectionAlias(state.currentChatId);
    const currentOverride = getCollectionIdOverride(state.currentChatId);

    if (currentAlias || currentOverride) {
        if (currentAlias) setCollectionAlias(state.currentChatId, null);
        if (currentOverride) setCollectionIdOverride(state.currentChatId, null);
        saveSettings(settings);
        toastr.success('Collection link removed');
    } else {
        if (!state.collectionId) {
            toastr.warning('Select a collection first');
            return;
        }
        setCollectionIdOverride(state.currentChatId, state.collectionId);
        saveSettings(settings);
        toastr.success('Collection linked to current chat');
    }

    updateStatCard(state, dom);
}

/**
 * @param {Object} state
 * @param {Object} item
 * @param {string|number} hash
 * @param {Object} dom
 */
async function handleChunkEdit(state, item, hash, dom) {
    const result = await showChunkEditModal(item);
    if (!result) return;

    const text = String(result.text || '').trim();
    ragLog.debug('[RAG Edit] Result from modal:', result);
    ragLog.debug('[RAG Edit] Text to save:', text);
    if (!text) {
        toastr.warning('Chunk text cannot be empty');
        return;
    }

    const currentText = String(item?.text || '').trim();
    const currentKeywords = Array.isArray(item?.metadata?.keywords)
        ? item.metadata.keywords.map(keyword => String(keyword || '').trim()).filter(Boolean)
        : [];
    const currentWeights = (item?.metadata?.keywordWeights && typeof item.metadata.keywordWeights === 'object')
        ? item.metadata.keywordWeights
        : {};
    const nextKeywords = Array.isArray(result.keywords) ? result.keywords : [];
    const nextWeights = (result.keywordWeights && typeof result.keywordWeights === 'object')
        ? result.keywordWeights
        : {};

    const sameText = text === currentText;
    const sameKeywords = JSON.stringify(currentKeywords) === JSON.stringify(nextKeywords);
    const sameWeights = JSON.stringify(currentWeights) === JSON.stringify(nextWeights);
    if (sameText && sameKeywords && sameWeights) {
        toastr.info('No changes detected');
        return;
    }

    const updatedChunk = buildEditedChunk(item, text, {
        keywords: nextKeywords,
        keywordWeights: nextWeights,
    });
    ragLog.debug('[RAG Edit] Updated chunk to insert:', updatedChunk);
    ragLog.debug('[RAG Edit] Deleting old hash:', hash);
    const rag = getEffectiveRagSettings(state);
    await deleteChunks(state.collectionId, [hash], rag);
    await insertChunks(state.collectionId, [updatedChunk], rag);
    toastr.success('Chunk updated');
    await refreshPage(state, dom);
}

/**
 * @param {Object} state
 * @param {Object} item
 * @param {string|number} hash
 * @param {boolean} enabled
 * @param {Object} dom
 */
async function handleChunkToggle(state, item, hash, enabled, dom) {
    const updatedChunk = buildEditedChunk(item, String(item?.text || ''), {
        disabled: !enabled,
    });
    const rag = getEffectiveRagSettings(state);
    await deleteChunks(state.collectionId, [hash], rag);
    await insertChunks(state.collectionId, [updatedChunk], rag);
    toastr.success(`Chunk ${enabled ? 'enabled' : 'disabled'}`);
    await refreshPage(state, dom);
}

/**
 * @returns {Promise<Array<{chatId: string, fileName: string, displayName: string, candidates: string[]}>>}
 */
async function loadCharacterChatsForMapping() {
    const character = characters?.[this_chid];
    if (!character) return [];

    const response = await fetch('/api/characters/chats', {
        method: 'POST',
        body: JSON.stringify({ avatar_url: character.avatar }),
        headers: getRequestHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch chats');
    }
    const data = await response.json();
    if (typeof data === 'object' && data?.error === true) {
        throw new Error('Error fetching chats');
    }

    const chats = Object.values(data || {});
    return chats.map(chat => {
        const fileName = String(chat?.file_name || '').trim();
        const displayName = getChatDisplayName(fileName || String(chat?.chat_id || chat?.id || ''));
        const candidatesSet = new Set(
            [
                chat?.chat_id,
                chat?.chatId,
                chat?.id,
                chat?.file_name,
                displayName,
            ]
                .map(value => String(value || '').trim())
                .filter(Boolean)
        );
        const candidates = [...candidatesSet]
            .flatMap(value => [value, normalizeChatId(value)])
            .map(value => String(value || '').trim())
            .filter(Boolean);
        const uniqueCandidates = [...new Set(candidates)];
        return {
            chatId: normalizeChatId(chat?.chat_id || displayName),
            fileName,
            displayName,
            candidates: uniqueCandidates,
        };
    }).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * Open RAG collection browser modal.
 * @param {Object} settings
 */
export async function openRagBrowserModal(settings) {
    const isSharder = settings?.sharderMode === true;
    const ragBlockKey = isSharder ? 'rag' : 'ragStandard';
    const currentChatId = SillyTavern.getContext()?.chatId ?? null;
    const settingsNoAlias = { ...settings, collectionAliases: {}, collectionIdOverrides: {} };

    let currentCollectionId = '';
    try {
        currentCollectionId = getActiveCollectionId(currentChatId, settingsNoAlias);
    } catch (error) {
        ragLog.warn('Failed to resolve current chat collection:', error?.message || error);
    }

    let ownShardCollectionId = '';
    let ownStandardCollectionId = '';
    try {
        if (currentChatId) {
            ownShardCollectionId = getShardCollectionId(currentChatId);
            ownStandardCollectionId = getStandardCollectionId(currentChatId);
        }
    } catch {
        // no active chat
    }

    const state = {
        rag: { ...(settings?.[ragBlockKey] || {}) },
        isSharder,
        collectionId: currentCollectionId,
        currentChatId,
        currentCollectionId,
        ownShardCollectionId,
        ownStandardCollectionId,
        viewingChatId: null,
        selectedSceneCode: '',
        sceneGroups: [],
        offset: 0,
        limit: 20,
        total: 0,
        items: [],
        allCollections: [],
        selectedCollection: null,
        availableChats: [],
        settingsNoAlias,
        activeBackends: Array.isArray(settings?.ragBrowserActiveBackends) && settings.ragBrowserActiveBackends.length > 0
            ? Array.from(new Set(settings.ragBrowserActiveBackends.map(item => String(item || '').toLowerCase()).filter(Boolean)))
            : ['vectra', 'lancedb', 'qdrant', 'milvus'],
        collectionSearch: '',
        chunkSearch: '',
        lastCollectionsFetchAt: 0,
        collectionRefreshInFlight: null,
    };

    const popup = new Popup(
        renderModalHtml(state),
        POPUP_TYPE.TEXT,
        null,
        {
            okButton: 'Close',
            cancelButton: false,
            wide: true,
            large: true,
        },
    );
    const showPromise = popup.show();

    requestAnimationFrame(async () => {
        const dom = {
            collectionTrigger: document.getElementById('ss-rag-browser-collection-trigger'),
            collectionLabel: document.getElementById('ss-rag-browser-collection-label'),
            collectionMenu: document.getElementById('ss-rag-browser-collection-menu'),
            collectionSearch: document.getElementById('ss-rag-browser-collection-search'),
            collectionOptions: document.getElementById('ss-rag-browser-collection-options'),
            chatHint: document.getElementById('ss-rag-browser-chat-hint'),
            statCollection: document.getElementById('ss-rag-stat-collection'),
            statMode: document.getElementById('ss-rag-stat-mode'),
            statChunks: document.getElementById('ss-rag-stat-chunks'),
            statCharacterChat: document.getElementById('ss-rag-stat-character-chat'),
            statSource: document.getElementById('ss-rag-stat-source'),
            statBackend: document.getElementById('ss-rag-stat-backend'),
            browseBtn: document.getElementById('ss-rag-browser-browse-btn'),
            renameBtn: document.getElementById('ss-rag-browser-rename-btn'),
            linkBtn: document.getElementById('ss-rag-browser-link-btn'),
            exportBtn: document.getElementById('ss-rag-browser-export-btn'),
            importBtn: document.getElementById('ss-rag-browser-import-btn'),
            revectorizeBtn: document.getElementById('ss-rag-browser-revectorize-btn'),
            deleteBtn: document.getElementById('ss-rag-browser-delete-btn'),
            pageInfo: document.getElementById('ss-rag-browser-page-info'),
            items: document.getElementById('ss-rag-browser-items'),
            prevBtn: document.getElementById('ss-rag-browser-prev'),
            nextBtn: document.getElementById('ss-rag-browser-next'),
            pageSizeSelect: document.getElementById('ss-rag-browser-page-size'),
            chunkSearch: document.getElementById('ss-rag-browser-chunk-search'),
            queryInput: document.getElementById('ss-rag-browser-query-text'),
            queryResults: document.getElementById('ss-rag-browser-query-results'),
            runQueryBtn: document.getElementById('ss-rag-browser-run-query'),
        };

        const modalRoot = document.querySelector('.ss-rag-browser-modal');

        // Apply saved backend toggle states
        modalRoot?.querySelectorAll('.ss-rag-backend-toggle').forEach(btn => {
            const backend = String(btn.getAttribute('data-backend') || '').toLowerCase();
            if (state.activeBackends.includes(backend)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const chooseCollection = async (collectionId) => {
            setSelectedCollection(state, collectionId);
            updateCollectionSelector(state, dom);
            updateStatCard(state, dom);
            clearChunkView(state, dom);
            await hydrateSelectedCollectionChunkCount(state, dom);
        };

        modalRoot?.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (target.closest('.ss-rag-browser-item-toggle')) {
                event.stopPropagation();
            }
            if (target.closest('.ss-rag-browser-item-actions')) {
                event.preventDefault();
                event.stopPropagation();
            }
        });

        modalRoot?.addEventListener('change', async (event) => {
            const toggle = event.target instanceof HTMLInputElement
                ? event.target.closest('.ss-rag-browser-item-toggle')
                : null;
            if (!toggle) return;

            const hash = toggle.getAttribute('data-hash');
            if (!hash) return;
            const item = findChunkByHash(state, hash);
            if (!item) {
                toastr.error('Chunk not found in current page');
                return;
            }

            try {
                await handleChunkToggle(state, item, hash, toggle.checked, dom);
            } catch (error) {
                ragLog.warn('Toggle chunk failed:', error?.message || error);
                if (!showQdrantMismatchToastIfNeeded(error, String(getEffectiveRagSettings(state)?.backend || ''))) {
                    toastr.error(`Toggle failed: ${error?.message || error}`);
                }
                toggle.checked = !toggle.checked;
            }
        });

        modalRoot?.addEventListener('click', async (event) => {
            const button = event.target instanceof Element
                ? event.target.closest('.ss-rag-browser-action')
                : null;
            if (!button) return;

            event.preventDefault();
            event.stopPropagation();

            const action = String(button.getAttribute('data-action') || '').trim();
            const hash = button.getAttribute('data-hash');
            if (!hash) {
                toastr.error('Chunk hash missing');
                return;
            }

            const item = findChunkByHash(state, hash);
            if (!item) {
                toastr.error('Chunk not found in current page');
                return;
            }

            try {
                if (action === 'delete') {
                    const preview = truncate(String(item?.text || ''), 120);
                    const confirm = await showSsConfirm(
                        'Delete Chunk',
                        `Delete this chunk?\n${preview}`,
                    );
                    if (confirm !== POPUP_RESULT.AFFIRMATIVE) return;
                    const rag = getEffectiveRagSettings(state);
                    await deleteChunks(state.collectionId, [hash], rag);
                    toastr.success('Chunk deleted');
                    await refreshPage(state, dom);
                    return;
                }

                if (action === 'edit') {
                    await handleChunkEdit(state, item, hash, dom);
                }
            } catch (error) {
                ragLog.warn('Chunk action failed:', error?.message || error);
                if (!showQdrantMismatchToastIfNeeded(error, String(getEffectiveRagSettings(state)?.backend || ''))) {
                    toastr.error(`Chunk action failed: ${error?.message || error}`);
                }
            }
        });

        const openCollectionMenu = () => {
            dom.collectionMenu?.classList.remove('ss-hidden');
            dom.collectionTrigger?.setAttribute('aria-expanded', 'true');
            dom.collectionSearch?.focus();
        };

        const closeCollectionMenu = () => {
            dom.collectionMenu?.classList.add('ss-hidden');
            dom.collectionTrigger?.setAttribute('aria-expanded', 'false');
        };

        dom.collectionTrigger?.addEventListener('click', () => {
            const isOpen = !dom.collectionMenu?.classList.contains('ss-hidden');
            if (isOpen) {
                closeCollectionMenu();
            } else {
                openCollectionMenu();
            }
        });

        dom.collectionTrigger?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCollectionMenu();
            }
            if (event.key === 'Escape') closeCollectionMenu();
        });

        dom.collectionSearch?.addEventListener('input', () => {
            state.collectionSearch = String(dom.collectionSearch.value || '').trim();
            updateCollectionSelector(state, dom);
        });

        dom.collectionOptions?.addEventListener('click', async (event) => {
            const item = event.target instanceof Element
                ? event.target.closest('.ss-rag-collection-dropdown-item')
                : null;
            if (!item) return;
            const selectedId = String(item.getAttribute('data-id') || '').trim();
            if (!selectedId) return;
            closeCollectionMenu();
            await chooseCollection(selectedId);
        });

        document.addEventListener('click', (event) => {
            const dropdown = document.getElementById('ss-rag-browser-collection-dropdown');
            if (dropdown && !dropdown.contains(event.target)) {
                closeCollectionMenu();
            }
        });

        dom.browseBtn?.addEventListener('click', async () => {
            try {
                await refreshPage(state, dom);
            } catch (error) {
                ragLog.warn('Browse chunks failed:', error?.message || error);
                toastr.error(`Browse failed: ${error?.message || error}`);
            }
        });

        dom.pageSizeSelect?.addEventListener('change', async () => {
            state.limit = Number(dom.pageSizeSelect.value) || 20;
            state.offset = 0;
            try {
                await refreshPage(state, dom);
            } catch (error) {
                ragLog.warn('Page size change refresh failed:', error?.message || error);
                toastr.error(`Refresh failed: ${error?.message || error}`);
            }
        });

        dom.chunkSearch?.addEventListener('input', () => {
            state.chunkSearch = String(dom.chunkSearch.value || '').trim();
            const filtered = state.chunkSearch
                ? (state.items || []).filter(item => chunkMatchesQuery(item, state.chunkSearch))
                : state.items || [];
            renderChunkList(dom.items, filtered);
        });

        modalRoot?.addEventListener('click', async (event) => {
            const toggle = event.target instanceof Element
                ? event.target.closest('.ss-rag-backend-toggle')
                : null;
            if (!toggle) return;

            const backend = String(toggle.getAttribute('data-backend') || '').toLowerCase();
            if (!backend) return;

            const idx = state.activeBackends.indexOf(backend);
            if (idx >= 0) {
                state.activeBackends.splice(idx, 1);
                toggle.classList.remove('active');
            } else {
                state.activeBackends.push(backend);
                toggle.classList.add('active');
            }

            settings.ragBrowserActiveBackends = Array.from(new Set(state.activeBackends));
            saveSettings(settings);
            try {
                await refreshCollections(state, dom, { preferredCollectionId: state.collectionId, force: true });
            } catch (error) {
                ragLog.warn('Backend filter refresh failed:', error?.message || error);
                updateCollectionSelector(state, dom);
            }
        });

        dom.prevBtn?.addEventListener('click', async () => {
            state.offset = Math.max(0, state.offset - state.limit);
            await refreshPage(state, dom);
        });

        dom.nextBtn?.addEventListener('click', async () => {
            state.offset += state.limit;
            await refreshPage(state, dom);
        });

        dom.renameBtn?.addEventListener('click', async () => {
            try {
                await handleRenameCollection(state, dom);
            } catch (error) {
                ragLog.warn('Rename collection failed:', error?.message || error);
                toastr.error(`Rename failed: ${error?.message || error}`);
            }
        });

        dom.linkBtn?.addEventListener('click', async () => {
            try {
                await handleLinkToggle(state, settings, dom);
            } catch (error) {
                ragLog.warn('Link/unlink failed:', error?.message || error);
                toastr.error(`Link action failed: ${error?.message || error}`);
            }
        });

        dom.exportBtn?.addEventListener('click', async () => {
            try {
                await handleExport(state);
            } catch (error) {
                ragLog.warn('Export failed:', error?.message || error);
                toastr.error(`Export failed: ${error?.message || error}`);
            }
        });

        dom.importBtn?.addEventListener('click', async () => {
            try {
                await handleImport(state, dom);
            } catch (error) {
                ragLog.warn('Import failed:', error?.message || error);
                if (!showQdrantMismatchToastIfNeeded(error, String(getEffectiveRagSettings(state)?.backend || ''))) {
                    toastr.error(`Import failed: ${error?.message || error}`);
                }
            }
        });

        dom.revectorizeBtn?.addEventListener('click', async () => {
            try {
                await handleRevectorizeCollection(state, dom);
            } catch (error) {
                ragLog.warn('Revectorize collection failed:', error?.message || error);
                if (!showQdrantMismatchToastIfNeeded(error, String(state.rag?.backend || ''))) {
                    toastr.error(`Revectorize failed: ${error?.message || error}`);
                }
            }
        });

        dom.deleteBtn?.addEventListener('click', async () => {
            try {
                await handleDeleteCollection(state, dom);
            } catch (error) {
                ragLog.warn('Delete collection failed:', error?.message || error);
                toastr.error(`Delete failed: ${error?.message || error}`);
            }
        });

        dom.runQueryBtn?.addEventListener('click', async () => {
            dom.runQueryBtn.disabled = true;
            try {
                await runQuery(state, dom);
            } catch (error) {
                ragLog.warn('Test query failed:', error?.message || error);
                toastr.error(`Test query failed: ${error?.message || error}`);
            } finally {
                dom.runQueryBtn.disabled = false;
            }
        });

        if (dom.collectionLabel) {
            dom.collectionLabel.textContent = 'Loading...';
        }
        if (dom.collectionOptions) {
            dom.collectionOptions.innerHTML = '<div class="ss-rag-collection-dropdown-empty">Loading collections...</div>';
        }
        if (dom.chatHint) {
            dom.chatHint.textContent = 'Loading collection metadata...';
        }
        clearChunkView(state, dom);

        try {
            state.availableChats = await loadCharacterChatsForMapping();
        } catch (error) {
            ragLog.warn('Failed to load chats for reverse mapping:', error?.message || error);
            state.availableChats = [];
        }

        try {
            await refreshCollections(state, dom, {
                preferredCollectionId: state.currentCollectionId || state.collectionId,
                force: true,
            });
        } catch (error) {
            ragLog.warn('Failed to load collections:', error?.message || error);
            toastr.error(`Failed to load collections: ${error?.message || error}`);
            if (dom.collectionLabel) {
                dom.collectionLabel.textContent = 'Failed to load';
            }
            if (dom.collectionOptions) {
                dom.collectionOptions.innerHTML = '<div class="ss-rag-collection-dropdown-empty">Failed to load collections</div>';
            }
            if (dom.chatHint) {
                dom.chatHint.textContent = 'Collection list unavailable.';
            }
        }
    });

    await showPromise;
}
