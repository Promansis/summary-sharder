/**
 * RAG Debug/Testing Modal for Summary Sharder
 */

import { Popup, POPUP_TYPE } from '../../../../../../popup.js';
import {
    checkBackendHealth,
    checkPluginAvailability,
    getCollectionStats,
    getShardCollectionId,
    hybridQuery,
    listChunks,
    queryChunks,
    rerankDocuments,
    testEmbeddingConnection,
} from '../../../core/rag/index.js';
import {
    cosineSimilarity,
    getEmbeddingVector,
    runBm25Breakdown,
    runDebugPipeline,
    runScoringBreakdown,
} from '../../../core/rag/debug-pipeline.js';

const INSPECTOR_PAGE_SIZE = 50;

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function truncate(text, max = 220) {
    const value = String(text || '').trim();
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(0, max - 1))}...`;
}

function getBehavior(item) {
    return String(item?.metadata?.chunkBehavior || '').trim().toLowerCase() || 'legacy';
}

function getScene(item) {
    return String(item?.metadata?.sceneCode || '').trim() || '(none)';
}

function scoreLabel(value) {
    if (value >= 0.9) return 'Very high similarity';
    if (value >= 0.75) return 'High similarity';
    if (value >= 0.55) return 'Moderate similarity';
    if (value >= 0.35) return 'Low similarity';
    return 'Very low similarity';
}

function renderTabState(state) {
    for (const panel of document.querySelectorAll('[data-tab-panel]')) {
        panel.classList.toggle('active', panel.getAttribute('data-tab-panel') === state.activeTab);
    }
    for (const btn of document.querySelectorAll('[data-tab]')) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === state.activeTab);
    }
}

function renderHealthCard(title, status, detail, latencyMs) {
    const stateClass = status === 'ok' ? 'ok' : (status === 'warn' ? 'warn' : 'error');
    return `<div class="ss-rag-debug-health-card ${stateClass}"><div class="ss-rag-debug-health-title">${escapeHtml(title)}</div><div class="ss-rag-debug-health-state">${escapeHtml(detail || '')}</div><div class="ss-rag-debug-health-meta">Latency: ${Number(latencyMs || 0).toFixed(1)} ms</div></div>`;
}

function renderBarRows(map) {
    const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return '<p class="ss-hint ss-rag-inline-hint">No data.</p>';
    const cap = Math.max(1, ...entries.map(e => e[1]), 1);
    return entries.map(([name, count]) => {
        const width = Math.max(2, Math.round((count / cap) * 100));
        return `<div class="ss-rag-debug-bar-row"><span class="name">${escapeHtml(name)}</span><span class="bar"><span class="ss-rag-debug-bar-fill" data-width="${width}"></span></span><span class="count">${count}</span></div>`;
    }).join('');
}

function applyBarWidths(container) {
    if (!container) {
        return;
    }

    for (const fill of container.querySelectorAll('.ss-rag-debug-bar-fill[data-width]')) {
        const width = Number(fill.getAttribute('data-width'));
        const clamped = Number.isFinite(width) ? Math.max(0, Math.min(100, width)) : 0;
        fill.style.width = `${clamped}%`;
    }
}

function renderInspectorItems(items) {
    if (!Array.isArray(items) || items.length === 0) return '<p class="ss-hint ss-rag-inline-hint">No chunks match current filters.</p>';
    return items.map(item => {
        const score = Number(item?.score);
        const hasScore = Number.isFinite(score);
        const scoreSpan = hasScore ? `<span class="ss-rag-debug-item-score">score=${score.toFixed(4)}</span>` : '';
        const snippetClass = hasScore ? 'ss-rag-debug-item-snippet' : 'ss-rag-debug-item-snippet no-score';
        return `<details class="ss-rag-debug-item"><summary><span class="badge">${escapeHtml(getBehavior(item))}</span>${scoreSpan}<span class="${snippetClass}">${escapeHtml(truncate(item?.text || '', 140))}</span></summary><div class="ss-rag-debug-item-body"><div><strong>scene:</strong> ${escapeHtml(getScene(item))}</div><div><strong>importance:</strong> ${escapeHtml(String(item?.metadata?.importance ?? 'n/a'))}</div><pre>${escapeHtml(String(item?.text || ''))}</pre><pre>${escapeHtml(JSON.stringify(item?.metadata || {}, null, 2))}</pre></div></details>`;
    }).join('');
}

function renderRawQueryResults(items) {
    if (!Array.isArray(items) || items.length === 0) return '<p class="ss-hint ss-rag-inline-hint">No raw vector results.</p>';
    return `<h4>Raw Vector Results</h4>${items.map(item => `<div class="ss-rag-debug-row"><div>score=${Number(item?.score || 0).toFixed(4)}</div><div>${escapeHtml(truncate(item?.text || '', 180))}</div></div>`).join('')}`;
}

function renderScoredQueryResults(items, breakdown, bm25Terms) {
    if (!Array.isArray(items) || items.length === 0) return '<p class="ss-hint ss-rag-inline-hint">No scored results.</p>';
    const bmByHash = new Map((bm25Terms || []).map(row => [String(row?.hash || ''), row]));
    const breakdownByHash = new Map((breakdown || []).map(row => [String(row?.hash || ''), row]));
    return `<h4>Scored / Ranked</h4>${items.map(item => {
        const entry = breakdownByHash.get(String(item?.hash || ''));
        const bm = bmByHash.get(String(item?.hash || ''));
        const s = entry?.steps;
        const termsText = (bm?.terms || []).filter(t => t.tf > 0).map(t => `${t.term}(tf=${t.tf}, idf=${t.idf.toFixed(2)})`).join(', ') || 'none';
        return `<details class="ss-rag-debug-item"><summary><span>${Number(item?.score || 0).toFixed(4)}</span><span>${escapeHtml(truncate(item?.text || '', 170))}</span></summary><div class="ss-rag-debug-score-step"><div>Base vector:</div><div>${Number(s?.base || 0).toFixed(4)}</div><div>+ Keyword boost:</div><div>${Number(s?.keyword?.before || 0).toFixed(4)} -> ${Number(s?.keyword?.after || 0).toFixed(4)}</div><div>+ BM25:</div><div>${Number(s?.bm25?.after || 0).toFixed(4)}</div><div> Terms:</div><div>${escapeHtml(termsText)}</div><div>+ Importance:</div><div>imp=${s?.importance?.importance ?? 'n/a'}, boost=${Number(s?.importance?.boost || 0).toFixed(4)}</div></div></details>`;
    }).join('')}`;
}

function renderPipelineStages(stages) {
    if (!Array.isArray(stages) || stages.length === 0) return '<p class="ss-hint ss-rag-inline-hint">Run a pipeline trace to see stage output.</p>';
    return stages.map((stage, idx) => {
        const dropped = Array.isArray(stage?.metadata?.droppedReasons) ? stage.metadata.droppedReasons.length : 0;
        const sample = (stage?.results || []).slice(0, 8);
        return `<details class="ss-rag-debug-stage" ${idx < 2 ? 'open' : ''}><summary><span class="badge">${idx + 1}</span><span>${escapeHtml(stage.stageName || 'stage')}</span><span>${Number(stage.durationMs || 0).toFixed(2)} ms</span><span>Input: ${stage.inputCount} -> Output: ${stage.outputCount}${dropped > 0 ? ` | Removed: ${dropped}` : ''}</span></summary><div class="ss-rag-debug-item-body"><pre>${escapeHtml(JSON.stringify(stage.metadata || {}, null, 2))}</pre>${sample.map(item => `<div class="ss-rag-debug-row"><div>score=${Number(item?.score || 0).toFixed(4)}</div><div>${escapeHtml(truncate(item?.text || '', 220))}</div></div>`).join('')}</div></details>`;
    }).join('');
}

function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function renderModalHtml(state) {
    const tab = state.activeTab;
    const tabBtn = (id, label) => `<button type="button" class="ss-rag-debug-tab ${tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`;
    return `
        <div class="ss-rag-modal ss-rag-debug-modal">
            <h3 class="ss-rag-title">RAG Debug & Testing</h3>
            <p class="ss-hint ss-rag-inline-hint">Diagnostics only. No prompt injection is performed from this modal.</p>
            <div class="ss-rag-debug-tabs">
                ${tabBtn('health', 'Health')}
                ${tabBtn('embedding', 'Embedding')}
                ${tabBtn('inspector', 'Inspector')}
                ${tabBtn('query', 'Query')}
                ${tabBtn('pipeline', 'Pipeline')}
                ${tabBtn('reranker', 'Re-ranker')}
            </div>
            <div class="ss-rag-debug-tab-panel ${tab === 'health' ? 'active' : ''}" data-tab-panel="health">
                <div class="ss-rag-actions-row"><input id="ss-rag-debug-refresh-health" class="menu_button" type="button" value="Refresh All" /></div>
                <div id="ss-rag-debug-health-grid" class="ss-rag-debug-health-grid"></div>
            </div>
            <div class="ss-rag-debug-tab-panel ${tab === 'embedding' ? 'active' : ''}" data-tab-panel="embedding">
                <div class="ss-rag-grid-two"><div class="ss-block"><label for="ss-rag-debug-embed-a">Text A</label><textarea id="ss-rag-debug-embed-a" class="text_pole ss-rag-template"></textarea></div><div class="ss-block"><label for="ss-rag-debug-embed-b">Text B</label><textarea id="ss-rag-debug-embed-b" class="text_pole ss-rag-template"></textarea></div></div>
                <div class="ss-rag-actions-row"><input id="ss-rag-debug-embed-generate" class="menu_button" type="button" value="Generate Embedding" /><input id="ss-rag-debug-embed-compare" class="menu_button" type="button" value="Compare Similarity" /></div>
                <div id="ss-rag-debug-embed-result" class="ss-rag-debug-block"></div>
            </div>
            <div class="ss-rag-debug-tab-panel ${tab === 'inspector' ? 'active' : ''}" data-tab-panel="inspector">
                <div class="ss-rag-grid-two"><div class="ss-block"><label for="ss-rag-debug-inspector-behavior">Behavior</label><select id="ss-rag-debug-inspector-behavior" class="text_pole"><option value="all">All</option><option value="superseding">Superseding</option><option value="cumulative">Cumulative</option><option value="rolling">Rolling</option><option value="legacy">Legacy</option></select></div><div class="ss-block"><label for="ss-rag-debug-inspector-scene">Scene Code</label><input id="ss-rag-debug-inspector-scene" class="text_pole" type="text" /></div></div>
                <div class="ss-rag-actions-row"><input id="ss-rag-debug-inspector-refresh" class="menu_button" type="button" value="Refresh Inspector" /><input id="ss-rag-debug-inspector-prev" class="menu_button" type="button" value="Previous Page" /><input id="ss-rag-debug-inspector-next" class="menu_button" type="button" value="Next Page" /></div>
                <p id="ss-rag-debug-inspector-page" class="ss-hint ss-rag-inline-hint"></p>
                <div id="ss-rag-debug-inspector-distribution" class="ss-rag-debug-block"></div>
                <div id="ss-rag-debug-inspector-items" class="ss-rag-debug-list"></div>
            </div>
            <div class="ss-rag-debug-tab-panel ${tab === 'query' ? 'active' : ''}" data-tab-panel="query">
                <div class="ss-rag-grid-two"><div class="ss-block"><label for="ss-rag-debug-query-text">Query Text</label><textarea id="ss-rag-debug-query-text" class="text_pole ss-rag-template"></textarea></div><div class="ss-rag-grid-two"><div class="ss-block"><label for="ss-rag-debug-query-topk">Top K</label><input id="ss-rag-debug-query-topk" class="text_pole" type="number" min="1" value="${Math.max(1, Number(state.rag.insertCount) || 5)}" /></div><div class="ss-block"><label for="ss-rag-debug-query-threshold">Threshold</label><input id="ss-rag-debug-query-threshold" class="text_pole" type="number" min="0" max="1" step="0.01" value="${Number(state.rag.scoreThreshold ?? 0.25)}" /></div></div></div>
                <div class="ss-rag-actions-row"><input id="ss-rag-debug-query-run" class="menu_button" type="button" value="Run Query" /></div>
                <div class="ss-rag-debug-split"><div id="ss-rag-debug-query-raw" class="ss-rag-debug-block"></div><div id="ss-rag-debug-query-scored" class="ss-rag-debug-block"></div></div>
            </div>
            <div class="ss-rag-debug-tab-panel ${tab === 'pipeline' ? 'active' : ''}" data-tab-panel="pipeline">
                <div class="ss-rag-grid-two"><div class="ss-block"><label class="checkbox_label"><input id="ss-rag-debug-ov-scene" type="checkbox" ${state.rag.sceneExpansion !== false ? 'checked' : ''} /><span>Scene Expansion</span></label></div><div class="ss-block"><label for="ss-rag-debug-ov-scoring">Scoring Method</label><select id="ss-rag-debug-ov-scoring" class="text_pole"><option value="keyword" ${state.rag.scoringMethod === 'keyword' ? 'selected' : ''}>Keyword</option><option value="bm25" ${state.rag.scoringMethod === 'bm25' ? 'selected' : ''}>BM25</option><option value="hybrid" ${state.rag.scoringMethod === 'hybrid' ? 'selected' : ''}>Hybrid</option></select></div></div>
                <div class="ss-rag-actions-row"><input id="ss-rag-debug-pipeline-run" class="menu_button" type="button" value="Run Pipeline Trace" /><input id="ss-rag-debug-pipeline-export" class="menu_button" type="button" value="Export JSON" /></div>
                <p id="ss-rag-debug-pipeline-meta" class="ss-hint ss-rag-inline-hint"></p>
                <div id="ss-rag-debug-pipeline-stages" class="ss-rag-debug-list"></div>
                <pre id="ss-rag-debug-pipeline-injection" class="ss-rag-debug-injection-preview"></pre>
            </div>
            <div class="ss-rag-debug-tab-panel ${tab === 'reranker' ? 'active' : ''}" data-tab-panel="reranker">
                <div class="ss-rag-grid-two"><div class="ss-block"><label for="ss-rag-debug-reranker-query">Query</label><textarea id="ss-rag-debug-reranker-query" class="text_pole ss-rag-template"></textarea></div><div class="ss-block"><label for="ss-rag-debug-reranker-docs">Documents (one per line)</label><textarea id="ss-rag-debug-reranker-docs" class="text_pole ss-rag-template"></textarea></div></div>
                <div class="ss-rag-actions-row"><input id="ss-rag-debug-reranker-run" class="menu_button" type="button" value="Test Re-ranker" /></div>
                <div id="ss-rag-debug-reranker-result" class="ss-rag-debug-block"></div>
            </div>
        </div>
    `;
}

export async function openRagDebugModal(ragDraft) {
    let shardCollectionId;
    try {
        shardCollectionId = getShardCollectionId();
    } catch (error) {
        toastr.error(`Cannot open RAG debug modal: ${error?.message || error}`);
        return;
    }

    const state = {
        rag: { ...ragDraft },
        activeTab: 'health',
        shardCollectionId,
        inspector: { behaviorFilter: 'all', sceneFilter: '', offset: 0, total: 0 },
        pipeline: { stages: [], injectionText: '', totalDuration: 0, lastResult: null },
        runIds: { health: 0, embedding: 0, inspector: 0, query: 0, pipeline: 0, reranker: 0 },
    };

    const popup = new Popup(
        renderModalHtml(state),
        POPUP_TYPE.TEXT,
        null,
        { okButton: 'Close', cancelButton: false, wide: true, large: true },
    );
    const showPromise = popup.show();

    requestAnimationFrame(async () => {
        const dom = {
            healthGrid: document.getElementById('ss-rag-debug-health-grid'),
            refreshHealth: document.getElementById('ss-rag-debug-refresh-health'),
            embedA: document.getElementById('ss-rag-debug-embed-a'),
            embedB: document.getElementById('ss-rag-debug-embed-b'),
            embedGenerate: document.getElementById('ss-rag-debug-embed-generate'),
            embedCompare: document.getElementById('ss-rag-debug-embed-compare'),
            embedResult: document.getElementById('ss-rag-debug-embed-result'),
            inspectorBehavior: document.getElementById('ss-rag-debug-inspector-behavior'),
            inspectorScene: document.getElementById('ss-rag-debug-inspector-scene'),
            inspectorRefresh: document.getElementById('ss-rag-debug-inspector-refresh'),
            inspectorPrev: document.getElementById('ss-rag-debug-inspector-prev'),
            inspectorNext: document.getElementById('ss-rag-debug-inspector-next'),
            inspectorPage: document.getElementById('ss-rag-debug-inspector-page'),
            inspectorDistribution: document.getElementById('ss-rag-debug-inspector-distribution'),
            inspectorItems: document.getElementById('ss-rag-debug-inspector-items'),
            queryText: document.getElementById('ss-rag-debug-query-text'),
            queryTopK: document.getElementById('ss-rag-debug-query-topk'),
            queryThreshold: document.getElementById('ss-rag-debug-query-threshold'),
            queryRun: document.getElementById('ss-rag-debug-query-run'),
            queryRaw: document.getElementById('ss-rag-debug-query-raw'),
            queryScored: document.getElementById('ss-rag-debug-query-scored'),
            ovScene: document.getElementById('ss-rag-debug-ov-scene'),
            ovScoring: document.getElementById('ss-rag-debug-ov-scoring'),
            pipelineRun: document.getElementById('ss-rag-debug-pipeline-run'),
            pipelineExport: document.getElementById('ss-rag-debug-pipeline-export'),
            pipelineMeta: document.getElementById('ss-rag-debug-pipeline-meta'),
            pipelineStages: document.getElementById('ss-rag-debug-pipeline-stages'),
            pipelineInjection: document.getElementById('ss-rag-debug-pipeline-injection'),
            rerankerQuery: document.getElementById('ss-rag-debug-reranker-query'),
            rerankerDocs: document.getElementById('ss-rag-debug-reranker-docs'),
            rerankerRun: document.getElementById('ss-rag-debug-reranker-run'),
            rerankerResult: document.getElementById('ss-rag-debug-reranker-result'),
        };

        for (const btn of document.querySelectorAll('[data-tab]')) {
            btn.addEventListener('click', () => {
                state.activeTab = btn.getAttribute('data-tab') || 'health';
                renderTabState(state);
            });
        }

        const refreshHealth = async () => {
            const runId = ++state.runIds.health;
            dom.healthGrid.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Running checks...</p>';
            const t1 = performance.now();
            const plugin = await checkPluginAvailability();
            if (runId !== state.runIds.health) return;
            const t2 = performance.now();
            const backend = await checkBackendHealth(state.rag.backend || 'vectra');
            if (runId !== state.runIds.health) return;
            const t3 = performance.now();

            let embedOk = false;
            let embedDims = 0;
            let embedError = '';
            try {
                const embedding = await testEmbeddingConnection(state.rag, 'Summary Sharder debug test');
                embedOk = !!embedding?.success;
                embedDims = Number(embedding?.dimensions) || 0;
            } catch (error) {
                embedError = error?.message || String(error);
            }
            if (runId !== state.runIds.health) return;
            const t4 = performance.now();

            const shardStats = await getCollectionStats(state.shardCollectionId, state.rag);
            if (runId !== state.runIds.health) return;

            const rerankerEnabled = !!state.rag?.reranker?.enabled;
            const rerankerConfigured = rerankerEnabled && !!String(state.rag?.reranker?.apiUrl || '').trim();
            const shardCount = Number(shardStats?.stats?.count ?? shardStats?.stats?.total ?? 0) || 0;

            dom.healthGrid.innerHTML = [
                renderHealthCard('Plugin', plugin.available ? 'ok' : 'error', plugin.available ? `Online (${plugin.version || 'unknown'})` : 'Unavailable', t2 - t1),
                renderHealthCard('Backend', backend.healthy ? 'ok' : 'error', backend.healthy ? 'Healthy' : (backend.message || 'Unhealthy'), t3 - t2),
                renderHealthCard('Embedding', embedOk ? 'ok' : 'error', embedOk ? `Connected (${embedDims} dims)` : (embedError || 'Failed'), t4 - t3),
                renderHealthCard('Re-ranker', rerankerConfigured ? 'ok' : 'warn', rerankerEnabled ? (rerankerConfigured ? `Configured (${state.rag.reranker.apiUrl})` : 'Enabled but missing API URL') : 'Not configured', 0),
                renderHealthCard('Shard Collection', 'ok', `${shardCount} chunks`, performance.now() - t4),
            ].join('');
        };

        const refreshInspector = async (resetOffset = false) => {
            if (resetOffset) state.inspector.offset = 0;
            const runId = ++state.runIds.inspector;
            dom.inspectorItems.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Loading chunks...</p>';
            const response = await listChunks(state.shardCollectionId, state.rag, { offset: state.inspector.offset, limit: INSPECTOR_PAGE_SIZE });
            if (runId !== state.runIds.inspector) return;

            let items = Array.isArray(response?.items) ? response.items : [];
            if (state.inspector.behaviorFilter !== 'all') items = items.filter(item => getBehavior(item) === state.inspector.behaviorFilter);
            if (state.inspector.sceneFilter) items = items.filter(item => String(item?.metadata?.sceneCode || '') === state.inspector.sceneFilter);

            state.inspector.total = Number(response?.total || 0);
            dom.inspectorItems.innerHTML = renderInspectorItems(items);

            const behaviorMap = new Map();
            const sceneMap = new Map();
            for (const item of items) {
                behaviorMap.set(getBehavior(item), (behaviorMap.get(getBehavior(item)) || 0) + 1);
                sceneMap.set(getScene(item), (sceneMap.get(getScene(item)) || 0) + 1);
            }
            dom.inspectorDistribution.innerHTML = `<h4>Behavior Distribution</h4>${renderBarRows(behaviorMap)}<h4>Scene Distribution</h4>${renderBarRows(sceneMap)}`;
            applyBarWidths(dom.inspectorDistribution);

            const start = state.inspector.total === 0 ? 0 : state.inspector.offset + 1;
            const end = Math.min(state.inspector.offset + INSPECTOR_PAGE_SIZE, state.inspector.total);
            dom.inspectorPage.textContent = `Showing ${start}-${end} of ${state.inspector.total} (fragments)`;
        };

        dom.refreshHealth?.addEventListener('click', refreshHealth);

        dom.embedGenerate?.addEventListener('click', async () => {
            const text = String(dom.embedA?.value || '').trim();
            if (!text) return void toastr.warning('Enter Text A first');
            const runId = ++state.runIds.embedding;
            dom.embedResult.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Generating embedding...</p>';
            const t0 = performance.now();
            try {
                const vec = await getEmbeddingVector(state.rag, text);
                if (runId !== state.runIds.embedding) return;
                const dims = vec.length;
                const head = vec.slice(0, 10).map(n => Number(n).toFixed(5)).join(', ');
                const tail = vec.slice(Math.max(0, dims - 10)).map(n => Number(n).toFixed(5)).join(', ');
                dom.embedResult.innerHTML = `<div><strong>Dimensions:</strong> ${dims}</div><div><strong>Generation time:</strong> ${(performance.now() - t0).toFixed(1)} ms</div><div><strong>First 10:</strong> <code>${escapeHtml(head)}</code></div><div><strong>Last 10:</strong> <code>${escapeHtml(tail)}</code></div>`;
            } catch (error) {
                dom.embedResult.innerHTML = `<p class="ss-hint ss-rag-inline-hint">Embedding failed: ${escapeHtml(error?.message || error)}</p>`;
            }
        });

        dom.embedCompare?.addEventListener('click', async () => {
            const a = String(dom.embedA?.value || '').trim();
            const b = String(dom.embedB?.value || '').trim();
            if (!a || !b) return void toastr.warning('Enter both Text A and Text B');
            const runId = ++state.runIds.embedding;
            dom.embedResult.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Comparing embeddings...</p>';
            const t0 = performance.now();
            try {
                const [vecA, vecB] = await Promise.all([getEmbeddingVector(state.rag, a), getEmbeddingVector(state.rag, b)]);
                if (runId !== state.runIds.embedding) return;
                const sim = cosineSimilarity(vecA, vecB);
                dom.embedResult.innerHTML = `<div><strong>Vector A:</strong> ${vecA.length} dims</div><div><strong>Vector B:</strong> ${vecB.length} dims</div><div><strong>Cosine similarity:</strong> ${sim.toFixed(4)} (${scoreLabel(sim)})</div><div><strong>Total time:</strong> ${(performance.now() - t0).toFixed(1)} ms</div>`;
            } catch (error) {
                dom.embedResult.innerHTML = `<p class="ss-hint ss-rag-inline-hint">Comparison failed: ${escapeHtml(error?.message || error)}</p>`;
            }
        });

        dom.inspectorBehavior?.addEventListener('change', async () => {
            state.inspector.behaviorFilter = dom.inspectorBehavior.value || 'all';
            await refreshInspector(true);
        });
        dom.inspectorScene?.addEventListener('change', async () => {
            state.inspector.sceneFilter = dom.inspectorScene.value || '';
            await refreshInspector(true);
        });
        dom.inspectorRefresh?.addEventListener('click', async () => {
            state.inspector.sceneFilter = dom.inspectorScene.value || '';
            await refreshInspector(true);
        });
        dom.inspectorPrev?.addEventListener('click', async () => {
            state.inspector.offset = Math.max(0, state.inspector.offset - INSPECTOR_PAGE_SIZE);
            await refreshInspector(false);
        });
        dom.inspectorNext?.addEventListener('click', async () => {
            state.inspector.offset += INSPECTOR_PAGE_SIZE;
            await refreshInspector(false);
        });

        dom.queryRun?.addEventListener('click', async () => {
            const queryText = String(dom.queryText?.value || '').trim();
            if (!queryText) return void toastr.warning('Enter query text first');
            const runId = ++state.runIds.query;
            dom.queryRaw.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Querying...</p>';
            dom.queryScored.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Scoring...</p>';

            const topK = Math.max(1, Number(dom.queryTopK?.value) || Math.max(1, Number(state.rag.insertCount) || 5));
            const threshold = Math.max(0, Math.min(1, Number(dom.queryThreshold?.value) || Number(state.rag.scoreThreshold ?? 0.25)));
            const wantsHybrid = state.rag.scoringMethod === 'hybrid';
            const useNativeHybrid = wantsHybrid && (state.rag.backend === 'qdrant' || state.rag.backend === 'milvus');
            const queryFn = useNativeHybrid ? hybridQuery : queryChunks;

            const res = await queryFn(state.shardCollectionId, queryText, topK, threshold, state.rag);
            if (runId !== state.runIds.query) return;

            const rawResults = Array.isArray(res?.results) ? res.results : [];
            const breakdown = runScoringBreakdown(rawResults, queryText, state.rag);
            const scored = [...breakdown]
                .sort((a, b) => Number(b?.finalScore || 0) - Number(a?.finalScore || 0))
                .map(item => ({ hash: item.hash, text: item.text, score: item.finalScore }));
            const bm25 = runBm25Breakdown(rawResults, queryText);

            dom.queryRaw.innerHTML = renderRawQueryResults(rawResults);
            dom.queryScored.innerHTML = renderScoredQueryResults(scored, breakdown, bm25);
        });

        dom.pipelineRun?.addEventListener('click', async () => {
            const runId = ++state.runIds.pipeline;
            dom.pipelineStages.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Running pipeline trace...</p>';
            dom.pipelineInjection.textContent = '';
            const result = await runDebugPipeline({
                scoringMethod: dom.ovScoring?.value || state.rag.scoringMethod,
                sceneExpansion: !!dom.ovScene?.checked,
            });
            if (runId !== state.runIds.pipeline) return;

            state.pipeline.stages = result.stages || [];
            state.pipeline.injectionText = result.injectionText || '';
            state.pipeline.totalDuration = Number(result.totalDurationMs) || 0;
            state.pipeline.lastResult = result;

            dom.pipelineMeta.textContent = `Total: ${state.pipeline.totalDuration.toFixed(2)} ms | Stages: ${state.pipeline.stages.length}`;
            dom.pipelineStages.innerHTML = renderPipelineStages(state.pipeline.stages);
            dom.pipelineInjection.textContent = state.pipeline.injectionText || '(empty injection text)';
        });

        dom.pipelineExport?.addEventListener('click', () => {
            if (!state.pipeline.lastResult) return void toastr.warning('Run pipeline trace first');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            downloadJson(`rag-debug-trace-${stamp}.json`, state.pipeline.lastResult);
        });

        dom.rerankerRun?.addEventListener('click', async () => {
            const reranker = state.rag?.reranker || {};
            const url = String(reranker.apiUrl || '').trim();
            if (!reranker.enabled || !url) {
                dom.rerankerResult.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Re-ranker is not configured.</p>';
                return;
            }
            const query = String(dom.rerankerQuery?.value || '').trim();
            const docs = String(dom.rerankerDocs?.value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            if (!query || docs.length === 0) return void toastr.warning('Enter query and at least one document');

            const runId = ++state.runIds.reranker;
            dom.rerankerResult.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Testing re-ranker...</p>';

            const t0 = performance.now();
            const result = await rerankDocuments(query, docs, state.rag, { topK: docs.length });
            if (runId !== state.runIds.reranker) return;
            if (!result.success) {
                dom.rerankerResult.innerHTML = `<p class="ss-hint ss-rag-inline-hint">Re-ranker failed: ${escapeHtml(result.error || 'request failed')}</p>`;
                return;
            }

            const ranked = Array.isArray(result.ranked) ? result.ranked : [];
            dom.rerankerResult.innerHTML = `<div><strong>Latency:</strong> ${(performance.now() - t0).toFixed(1)} ms</div><div><strong>Mode:</strong> ${escapeHtml(result.mode || 'similharity')}</div><div class="ss-rag-debug-list">${ranked.map((row, idx) => `<div class="ss-rag-debug-row"><div>#${idx + 1} score=${Number(row?.score ?? 0).toFixed(4)}</div><div>${escapeHtml(truncate(row?.document || '', 260))}</div></div>`).join('')}</div>`;
        });

        await refreshHealth();
        await refreshInspector(true);
        if (state.rag?.reranker?.enabled !== true || !String(state.rag?.reranker?.apiUrl || '').trim()) {
            dom.rerankerResult.innerHTML = '<p class="ss-hint ss-rag-inline-hint">Re-ranker not configured.</p>';
        }
    });

    await showPromise;
}
