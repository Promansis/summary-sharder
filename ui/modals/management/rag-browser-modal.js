/**
 * RAG Collection Browser Modal for Summary Sharder
 */

import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
import { showSsConfirm } from '../../common/modal-base.js';
import {
    buildChunkHash,
    deleteChunks,
    getActiveCollectionId,
    getCollectionStats,
    hybridQuery,
    insertChunks,
    listChunks,
    purgeCollection,
    queryChunks,
} from '../../../core/rag/index.js';

const LOG_PREFIX = '[SummarySharder:RAG]';
const GROUP_SCAN_LIMIT = 1000;
const PAGE_SIZE_OPTIONS = [20, 50, 100];

/**
 * @param {Object} stats
 * @returns {number}
 */
function getCount(stats) {
    return Number(stats?.count ?? stats?.total ?? 0) || 0;
}

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
 * @param {Object} state
 * @returns {string}
 */
function renderModalHtml(state) {
    const pageSizeOptions = PAGE_SIZE_OPTIONS.map(size => `
        <option value="${size}" ${state.limit === size ? 'selected' : ''}>${size}</option>
    `).join('');

    const modeLabel = state.isSharder ? 'Sharder' : 'Standard';
    const modeClass = state.isSharder ? 'sharder' : 'standard';
    const collectionLabel = state.isSharder ? 'Shard Collection' : 'Standard Collection';
    const purgeLabel = state.isSharder ? 'Purge Shards' : 'Purge Collection';
    const hintExtra = state.isSharder ? ', and review scene-linked chunks' : '';

    const sceneCodesCard = state.isSharder ? `
                    <div class="ss-rag-browser-stat-card">
                        <div class="ss-rag-status-label">Unique Scene Codes</div>
                        <div class="ss-rag-status-value" id="ss-rag-browser-scene-count">Loading...</div>
                        <div class="ss-rag-inline-hint" id="ss-rag-browser-scene-hint"></div>
                        <input id="ss-rag-browser-refresh" class="menu_button" type="button" value="Refresh" />
                    </div>` : `
                    <div class="ss-rag-browser-stat-card">
                        <input id="ss-rag-browser-refresh" class="menu_button" type="button" value="Refresh" />
                    </div>`;

    const sceneGroupingSection = state.isSharder ? `
            <div class="ss-rag-section">
                <h4>Scene Grouping</h4>
                <p id="ss-rag-browser-scene-group-meta" class="ss-hint ss-rag-inline-hint">Scanning scene codes...</p>
                <div id="ss-rag-browser-scene-groups" class="ss-rag-browser-scene-groups"></div>
            </div>` : '';

    return `
        <div class="ss-rag-modal ss-rag-browser-modal">
            <h3 class="ss-rag-title">RAG Collection Browser <span class="ss-rag-mode-badge ss-rag-mode-${modeClass}">${modeLabel} Mode</span></h3>
            <p class="ss-hint ss-rag-inline-hint">
                Inspect vectors, run test queries${hintExtra} for this chat.
            </p>

            <div class="ss-rag-section">
                <h4>Collections</h4>
                <div class="ss-rag-browser-stats-grid">
                    <div class="ss-rag-browser-stat-card">
                        <div class="ss-rag-status-label">${collectionLabel}</div>
                        <div class="ss-rag-status-value" id="ss-rag-browser-shard-count">Loading...</div>
                        <div class="ss-rag-inline-hint">${escapeHtml(state.collectionId)}</div>
                        <input id="ss-rag-browser-purge-shards" class="menu_button" type="button" value="${purgeLabel}" />
                    </div>
                    ${sceneCodesCard}
                </div>
            </div>

            <div class="ss-rag-section">
                <h4>Chunk Browser</h4>
                <div class="ss-rag-grid-two">
                    <div class="ss-block">
                        <label for="ss-rag-browser-page-size">Page Size</label>
                        <select id="ss-rag-browser-page-size" class="text_pole">${pageSizeOptions}</select>
                    </div>
                </div>
                <div class="ss-rag-actions-row">
                    <input id="ss-rag-browser-prev" class="menu_button" type="button" value="Previous Page" />
                    <input id="ss-rag-browser-next" class="menu_button" type="button" value="Next Page" />
                </div>
                <p id="ss-rag-browser-page-info" class="ss-hint ss-rag-inline-hint">Loading...</p>
                <div id="ss-rag-browser-items" class="ss-rag-browser-items"></div>
            </div>

            ${sceneGroupingSection}

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
 * @param {string} collectionId
 * @param {Object} rag
 * @returns {Promise<{groups: Array<Object>, scanned: number, truncated: boolean}>}
 */
async function scanSceneGroups(collectionId, rag) {
    const byScene = new Map();
    let offset = 0;
    const limit = 100;
    let scanned = 0;
    let hasMore = true;
    let truncated = false;

    while (hasMore) {
        const { items, hasMore: more } = await listChunks(collectionId, rag, { offset, limit });
        const safeItems = Array.isArray(items) ? items : [];

        for (const item of safeItems) {
            scanned += 1;
            const sceneCode = String(item?.metadata?.sceneCode || '').trim();
            if (!sceneCode) continue;
            if (!byScene.has(sceneCode)) {
                byScene.set(sceneCode, []);
            }
            const bucket = byScene.get(sceneCode);
            if (bucket.length < 6) {
                bucket.push(item);
            }
        }

        if (scanned >= GROUP_SCAN_LIMIT) {
            truncated = true;
            break;
        }

        hasMore = !!more;
        offset += safeItems.length;
        if (safeItems.length === 0) break;
    }

    const groups = [...byScene.entries()]
        .map(([sceneCode, items]) => {
            const indices = items
                .map(item => Number(item?.metadata?.messageIndex ?? item?.index))
                .filter(Number.isFinite)
                .sort((a, b) => a - b);
            return {
                sceneCode,
                items,
                minIndex: indices.length ? indices[0] : null,
                maxIndex: indices.length ? indices[indices.length - 1] : null,
            };
        })
        .sort((a, b) => a.sceneCode.localeCompare(b.sceneCode));

    return { groups, scanned, truncated };
}

/**
 * @param {Object} item
 * @returns {string}
 */
function renderChunkItem(item) {
    const score = Number(item?.score);
    const scoreText = Number.isFinite(score) ? score.toFixed(4) : 'n/a';
    const meta = item?.metadata || {};
    const text = String(item?.text || '');
    const hash = item?.hash ?? '';

    return `
        <details class="ss-rag-browser-item">
            <summary>
                <span class="ss-rag-browser-item-index">#${Number(item?.index ?? 0)}</span>
                <span class="ss-rag-browser-item-score">score=${scoreText}</span>
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
 * @param {HTMLElement} container
 * @param {Array<Object>} groups
 */
function renderSceneGroups(container, groups, selectedSceneCode = '') {
    if (!container) return;
    if (!Array.isArray(groups) || groups.length === 0) {
        container.innerHTML = '<p class="ss-hint ss-rag-inline-hint">No scene codes detected.</p>';
        return;
    }

    container.innerHTML = groups.map(group => {
        const range = group.minIndex === null
            ? 'n/a'
            : `${group.minIndex}-${group.maxIndex}`;
        const isSelected = String(group.sceneCode) === String(selectedSceneCode);
        const detailHtml = isSelected ? renderSceneGroupDetail(group) : '';

        return `
            <div class="ss-rag-browser-scene-group-wrap">
                <button
                    type="button"
                    class="ss-rag-browser-scene-group ${isSelected ? 'selected' : ''}"
                    data-scene-code="${escapeHtml(group.sceneCode)}"
                >
                    <span class="ss-rag-browser-scene-group-row">
                        <span class="ss-rag-browser-scene-code">${escapeHtml(group.sceneCode)}</span>
                        <span class="ss-rag-browser-scene-range">range=${range}</span>
                        <span class="ss-rag-browser-scene-count">sampled=${group.items.length}</span>
                    </span>
                </button>
                ${detailHtml}
            </div>
        `;
    }).join('');
}

/**
 * @param {Object} group
 * @returns {string}
 */
function renderSceneGroupDetail(group) {
    const items = Array.isArray(group.items) ? group.items : [];
    const range = group.minIndex === null
        ? 'n/a'
        : `${group.minIndex}-${group.maxIndex}`;
    const body = items.length > 0
        ? items.map(renderChunkItem).join('')
        : '<p class="ss-hint ss-rag-inline-hint">No sample chunks available for this scene.</p>';

    return `
        <div class="ss-rag-browser-scene-group-detail">
            <div class="ss-rag-browser-scene-group-detail-header">
                <strong>${escapeHtml(group.sceneCode)}</strong>
                <span class="ss-rag-browser-scene-range">range=${range}</span>
                <span class="ss-rag-browser-scene-count">sampled=${items.length}</span>
            </div>
            <div class="ss-rag-browser-scene-group-detail-body">
                ${body}
            </div>
        </div>
    `;
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
async function refreshStats(state, dom) {
    const collectionStats = await getCollectionStats(state.collectionId, state.rag);
    const chunkCount = getCount(collectionStats?.stats || collectionStats);

    if (dom.shardCount) dom.shardCount.textContent = `${chunkCount} chunks`;

    if (state.isSharder) {
        const shardScenes = await scanSceneGroups(state.collectionId, state.rag);
        const uniqueCodes = new Set(shardScenes.groups.map(g => g.sceneCode));
        if (dom.sceneCount) dom.sceneCount.textContent = `${uniqueCodes.size} scene codes`;
        if (dom.sceneHint) {
            dom.sceneHint.textContent = shardScenes.truncated
                ? `Approximate (scanned up to ${GROUP_SCAN_LIMIT} chunks per collection)`
                : 'Exact count';
        }
    }
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
async function refreshPage(state, dom) {
    const { items, total } = await listChunks(state.collectionId, state.rag, {
        offset: state.offset,
        limit: state.limit,
    });
    state.total = Number(total || 0);
    state.items = Array.isArray(items) ? items : [];

    renderChunkList(dom.items, state.items);

    const start = state.total === 0 ? 0 : state.offset + 1;
    const end = Math.min(state.offset + state.limit, state.total);
    if (dom.pageInfo) {
        dom.pageInfo.textContent = `Showing ${start}-${end} of ${state.total} (fragments)`;
    }
    if (dom.prevBtn) dom.prevBtn.disabled = state.offset <= 0;
    if (dom.nextBtn) dom.nextBtn.disabled = state.offset + state.limit >= state.total;
}

/**
 * @param {Object} state
 * @param {Object} dom
 */
async function refreshSceneView(state, dom) {
    const { groups, scanned, truncated } = await scanSceneGroups(state.collectionId, state.rag);
    state.sceneGroups = groups;
    const selected = groups.find(g => String(g.sceneCode) === String(state.selectedSceneCode)) || null;
    if (!selected) {
        state.selectedSceneCode = '';
    }

    renderSceneGroups(dom.sceneGroups, groups, state.selectedSceneCode);
    if (dom.sceneMeta) {
        dom.sceneMeta.textContent = truncated
            ? `Grouped ${groups.length} scene codes from ${scanned} scanned chunks (truncated).`
            : `Grouped ${groups.length} scene codes from ${scanned} chunks.`;
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

    const useHybrid = (state.rag.backend === 'qdrant' || state.rag.backend === 'milvus')
        && state.rag.scoringMethod === 'hybrid';
    const queryFn = useHybrid ? hybridQuery : queryChunks;
    const topK = Math.max(1, Number(state.rag.insertCount) || 5);
    const threshold = Math.max(0, Math.min(1, Number(state.rag.scoreThreshold) || 0));

    const queryRes = await queryFn(state.collectionId, queryText, topK, threshold, state.rag);

    const merged = Array.isArray(queryRes?.results)
        ? queryRes.results.map(item => ({ ...item, _collection: 'fragments' }))
        : [];
    merged.sort((a, b) => (Number(b?.score) || 0) - (Number(a?.score) || 0));

    let expansions = [];

    if (state.isSharder) {
        const maxSceneExpansion = Math.max(1, Number(state.rag.maxSceneExpansionChunks) || 10);
        const sceneTargets = [];
        const seenTargets = new Set();
        for (const item of merged) {
            const sceneCode = String(item?.metadata?.sceneCode || '').trim();
            if (!sceneCode) continue;
            const collection = 'fragments';
            const key = `${collection}\u0000${sceneCode}`;
            if (seenTargets.has(key)) continue;
            seenTargets.add(key);
            sceneTargets.push({ collection, sceneCode });
        }

        for (const target of sceneTargets) {
            const collection = target.collection;
            const sceneCode = target.sceneCode;
            try {
                const { items } = await listChunks(state.collectionId, state.rag, {
                    limit: maxSceneExpansion,
                    metadataFilter: { sceneCode },
                });
                expansions.push({
                    collection,
                    sceneCode,
                    count: Array.isArray(items) ? items.length : 0,
                });
            } catch (error) {
                console.warn(`${LOG_PREFIX} Scene expansion preview failed for ${sceneCode}:`, error?.message || error);
            }
        }
    }

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

    const sceneExpansionHtml = state.isSharder ? `
        <p class="ss-hint ss-rag-inline-hint">Scene expansion preview</p>
        ${expansions.length === 0
            ? '<p class="ss-hint ss-rag-inline-hint">No scene expansion candidates.</p>'
            : `<ul>${expansions.map(row => `
            <li>${escapeHtml(row.collection)}:${escapeHtml(row.sceneCode)} -> ${row.count} chunks</li>
        `).join('')}</ul>`}
    ` : '';

    dom.queryResults.innerHTML = `
        <div class="ss-rag-browser-query-panel">
            <p class="ss-hint ss-rag-inline-hint">Top ${merged.length} results</p>
            <ul class="ss-rag-browser-query-list">${resultsHtml}</ul>
            ${sceneExpansionHtml}
        </div>
    `;
}

/**
 * @param {string} initialText
 * @returns {Promise<string|null>}
 */
function showEditChunkModal(initialText) {
    let resolved = false;
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="ss-owned-popup-content ss-rag-edit-modal">
                <h3>Edit Chunk</h3>
                <p class="ss-hint ss-rag-inline-hint">Update the chunk text. This will overwrite the existing vector entry.</p>
                <textarea id="ss-rag-edit-text" class="text_pole ss-rag-template" rows="10">${escapeHtml(initialText)}</textarea>
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

        const showPromise = popup.show();

        requestAnimationFrame(() => {
            const textarea = document.getElementById('ss-rag-edit-text');
            const saveBtn = document.getElementById('ss-rag-edit-save');
            if (textarea) {
                textarea.focus();
                textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
            saveBtn?.addEventListener('click', () => {
                if (resolved) return;
                resolved = true;
                const value = String(textarea?.value ?? '');
                popup.complete(POPUP_RESULT.AFFIRMATIVE);
                resolve(value);
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
 * @param {Object} item
 * @param {string} newText
 * @returns {{text: string, hash: string|number, index: number, metadata: Object}}
 */
function buildEditedChunk(item, newText) {
    const normalized = String(newText || '').trim();
    const metadata = (item?.metadata && typeof item.metadata === 'object') ? { ...item.metadata } : {};
    const index = Number.isFinite(Number(item?.index))
        ? Number(item.index)
        : Number(metadata.messageIndex ?? 0);
    const hash = item?.hash ?? buildChunkHash(`${index}|${normalized}`);

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

    const fromPage = (state.items || []).find(item => String(item?.hash ?? '') === target);
    if (fromPage) return fromPage;

    const groups = Array.isArray(state.sceneGroups) ? state.sceneGroups : [];
    for (const group of groups) {
        const items = Array.isArray(group?.items) ? group.items : [];
        const found = items.find(item => String(item?.hash ?? '') === target);
        if (found) return found;
    }

    return null;
}

/**
 * Open RAG collection browser modal.
 * @param {Object} settings
 */
export async function openRagBrowserModal(settings) {
    const isSharder = settings?.sharderMode === true;
    const ragBlockKey = isSharder ? 'rag' : 'ragStandard';

    let collectionId;
    try {
        collectionId = getActiveCollectionId(null, settings);
    } catch (error) {
        toastr.error(`Cannot open RAG browser: ${error?.message || error}`);
        return;
    }

    const state = {
        rag: { ...(settings?.[ragBlockKey] || {}) },
        isSharder,
        collectionId,
        selectedSceneCode: '',
        sceneGroups: [],
        offset: 0,
        limit: 20,
        total: 0,
        items: [],
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
            shardCount: document.getElementById('ss-rag-browser-shard-count'),
            sceneCount: document.getElementById('ss-rag-browser-scene-count'),
            sceneHint: document.getElementById('ss-rag-browser-scene-hint'),
            pageInfo: document.getElementById('ss-rag-browser-page-info'),
            sceneMeta: document.getElementById('ss-rag-browser-scene-group-meta'),
            items: document.getElementById('ss-rag-browser-items'),
            sceneGroups: document.getElementById('ss-rag-browser-scene-groups'),
            prevBtn: document.getElementById('ss-rag-browser-prev'),
            nextBtn: document.getElementById('ss-rag-browser-next'),
            pageSizeSelect: document.getElementById('ss-rag-browser-page-size'),
            queryInput: document.getElementById('ss-rag-browser-query-text'),
            queryResults: document.getElementById('ss-rag-browser-query-results'),
            runQueryBtn: document.getElementById('ss-rag-browser-run-query'),
            refreshBtn: document.getElementById('ss-rag-browser-refresh'),
            purgeShardsBtn: document.getElementById('ss-rag-browser-purge-shards'),
        };

        const refreshEverything = async () => {
            try {
                await refreshStats(state, dom);
                await refreshPage(state, dom);
                if (state.isSharder) {
                    await refreshSceneView(state, dom);
                }
            } catch (error) {
                console.warn(`${LOG_PREFIX} Browser refresh failed:`, error?.message || error);
                toastr.error(`RAG browser refresh failed: ${error?.message || error}`);
            }
        };

        const modalRoot = document.querySelector('.ss-rag-browser-modal');
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
                toastr.error('Chunk not found in current view');
                return;
            }

            if (action === 'delete') {
                const preview = truncate(String(item?.text || ''), 120);
                const confirm = await showSsConfirm(
                    'Delete Chunk',
                    `Delete this chunk?\n${preview}`
                );
                if (confirm !== POPUP_RESULT.AFFIRMATIVE) return;

                await deleteChunks(state.collectionId, [hash], state.rag);
                toastr.success('Chunk deleted');
                await refreshEverything();
                return;
            }

            if (action === 'edit') {
                const updatedText = await showEditChunkModal(String(item?.text || ''));
                if (updatedText === null) return;

                const normalized = String(updatedText || '').trim();
                if (!normalized) {
                    toastr.warning('Chunk text cannot be empty');
                    return;
                }

                if (normalized === String(item?.text || '').trim()) {
                    toastr.info('No changes detected');
                    return;
                }

                const updatedChunk = buildEditedChunk(item, normalized);

                await deleteChunks(state.collectionId, [hash], state.rag);
                await insertChunks(state.collectionId, [updatedChunk], state.rag);

                toastr.success('Chunk updated');
                await refreshEverything();
            }
        });

        dom.sceneGroups?.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target.closest('[data-scene-code]') : null;
            if (!target) return;

            const sceneCode = String(target.getAttribute('data-scene-code') || '').trim();
            if (!sceneCode) return;

            state.selectedSceneCode = state.selectedSceneCode === sceneCode ? '' : sceneCode;
            renderSceneGroups(dom.sceneGroups, state.sceneGroups || [], state.selectedSceneCode);
        });

        dom.pageSizeSelect?.addEventListener('change', async () => {
            state.limit = Number(dom.pageSizeSelect.value) || 20;
            state.offset = 0;
            await refreshPage(state, dom);
        });

        dom.prevBtn?.addEventListener('click', async () => {
            state.offset = Math.max(0, state.offset - state.limit);
            await refreshPage(state, dom);
        });

        dom.nextBtn?.addEventListener('click', async () => {
            state.offset += state.limit;
            await refreshPage(state, dom);
        });

        dom.runQueryBtn?.addEventListener('click', async () => {
            dom.runQueryBtn.disabled = true;
            try {
                await runQuery(state, dom);
            } catch (error) {
                console.warn(`${LOG_PREFIX} Test query failed:`, error?.message || error);
                toastr.error(`Test query failed: ${error?.message || error}`);
            } finally {
                dom.runQueryBtn.disabled = false;
            }
        });

        dom.refreshBtn?.addEventListener('click', async () => {
            await refreshEverything();
        });

        dom.purgeShardsBtn?.addEventListener('click', async () => {
            const confirmTitle = 'Purge Collection';
            const confirmBody = state.isSharder
                ? 'Delete all shard vectors for this chat? This cannot be undone.'
                : 'Delete all standard summary vectors for this chat? This cannot be undone.';
            const confirm = await showSsConfirm(confirmTitle, confirmBody);
            if (confirm !== POPUP_RESULT.AFFIRMATIVE) return;
            await purgeCollection(state.collectionId, state.rag);
            toastr.success('Collection purged');
            await refreshEverything();
        });

        await refreshEverything();
    });

    await showPromise;
}

