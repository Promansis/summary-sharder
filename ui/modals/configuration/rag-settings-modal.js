/**
 * RAG Settings Modal Component for Summary Sharder
 */

import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
import { saveSettings, getDefaultSettings } from '../../../core/settings.js';
import { openRagBrowserModal } from '../management/rag-browser-modal.js';
import { openRagDebugModal } from '../management/rag-debug-modal.js';
import { LorebookDropdown } from '../../dropdowns/lorebook-dropdown.js';
import { createSegmentedToggle, createRangeSliderPair } from '../../common/index.js';
import { showSsConfirm } from '../../common/modal-base.js';
import {
    checkPluginAvailability,
    checkBackendHealth,
    initBackend,
    getCollectionStats,
    getShardCollectionId,
    getStandardCollectionId,
    checkEmbeddingAvailability,
    hasRagEmbeddingApiKey,
    storeRagEmbeddingApiKey,
    clearRagEmbeddingApiKey,
    hasRagRerankerApiKey,
    storeRagRerankerApiKey,
    clearRagRerankerApiKey,
    checkRerankerHealth,
    testEmbeddingConnection,
    testRerankerConnection,
    resolveShardChunkingMode,
    vectorizeAllShardsByMode,
    vectorizeAllStandardSummaries,
    purgeCollection,
} from '../../../core/rag/index.js';

const LOG_PREFIX = '[SummarySharder:RAG]';

/**
 * @param {number|string} v
 * @param {number} fallback
 * @returns {number}
 */
function toInt(v, fallback) {
    const parsed = parseInt(String(v), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {number|string} v
 * @param {number} fallback
 * @returns {number}
 */
function toFloat(v, fallback) {
    const parsed = parseFloat(String(v));
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {string} key
 * @param {string} title
 * @param {string} icon
 * @param {string} content
 * @param {boolean} [defaultOpen=false]
 * @returns {string}
 */
function buildRagAccordion(key, title, icon, content, defaultOpen = false) {
    const openDisplay = (key === 'backend' || key === 'vectorization') ? 'grid' : 'block';
    const expanded = defaultOpen ? ' expanded' : '';
    const hiddenClass = defaultOpen ? '' : ' ss-hidden';
    const ariaExpanded = defaultOpen ? 'true' : 'false';

    return `
        <div class="ss-review-accordion ss-rag-accordion${expanded}" data-rag-section="${key}">
            <div class="ss-accordion-header" role="button" tabindex="0" aria-expanded="${ariaExpanded}">
                <span class="ss-accordion-toggle">
                    <i class="fa-solid fa-chevron-right"></i>
                </span>
                <span class="ss-accordion-title">
                    <i class="fa-solid ${icon}"></i> ${title}
                </span>
            </div>
            <div class="ss-accordion-content${hiddenClass}" data-expanded-display="${openDisplay}">
                ${content}
            </div>
        </div>
    `;
}

/**
 * @param {Object} rag
 * @param {boolean} isSharder
 * @returns {string}
 */
function renderModalHtml(rag, isSharder) {
    const backend = rag.backend || 'vectra';
    const isQdrant = backend === 'qdrant';
    const isMilvus = backend === 'milvus';
    const qdrantUseCloud = rag.backendConfig?.qdrantUseCloud === true;
    const modeBadgeClass = isSharder ? 'ss-rag-mode-sharder' : 'ss-rag-mode-standard';
    const modeLabel = isSharder ? 'Sharder Mode' : 'Standard Mode';

    return `
        <div class="ss-rag-modal">
            <h3 class="ss-rag-title">RAG Settings - <span class="ss-rag-mode-badge ${modeBadgeClass}">${modeLabel}</span></h3>
            <div class="ss-rag-master-toggle">
                <label class="checkbox_label">
                    <input id="ss-rag-enabled" class="ss-rag-control" type="checkbox" ${rag.enabled ? 'checked' : ''} />
                    <span>Enable RAG</span>
                </label>
            </div>

            <div id="ss-rag-body" class="${rag.enabled ? '' : 'ss-hidden'}">
                <div class="ss-rag-status-bar">
                    <div class="ss-rag-status-item" id="ss-rag-status-reranker">
                        <div class="ss-rag-status-label">Re-Ranker</div>
                        <div class="ss-rag-status-value" id="ss-rag-reranker-status">Checking...</div>
                    </div>
                    <div class="ss-rag-status-item" id="ss-rag-status-embedding">
                        <div class="ss-rag-status-label">Embedding Source</div>
                        <div class="ss-rag-status-value" id="ss-rag-embedding-status">Checking...</div>
                    </div>
                    <div class="ss-rag-status-item" id="ss-rag-status-backend">
                        <div class="ss-rag-status-label">Backend</div>
                        <div class="ss-rag-status-value" id="ss-rag-backend-health">Checking...</div>
                    </div>
                </div>
                <div class="ss-rag-status-actions">
                    <div class="ss-rag-actions-row">
                        <input id="ss-rag-init-backend" class="menu_button ss-rag-control" type="button" value="Initialize Backend" />
                        <input id="ss-rag-refresh-health" class="menu_button" type="button" value="Refresh Health" />
                        <input id="ss-rag-test-embedding" class="menu_button ss-rag-control" type="button" value="Test Embedding Source" />
                        <input id="ss-rag-test-reranker" class="menu_button ss-rag-control" type="button" value="Test Re-ranker" />
                    </div>
                    <div class="ss-rag-actions-row">
                        <input id="ss-rag-vectorize-all" class="menu_button ss-rag-control" type="button" value="Vectorize All Shards Now" />
                        <input id="ss-rag-purge-all" class="menu_button ss-rag-control" type="button" value="Purge All Vectors" />
                        <input id="ss-rag-open-browser" class="menu_button ss-rag-control" type="button" value="Browse Collections" />
                        <input id="ss-rag-open-debug" class="menu_button ss-rag-control" type="button" value="Debug RAG" />
                    </div>
                    <p id="ss-rag-embedding-test-status" class="ss-rag-inline-hint ss-text-hint">Embedding source test: not run</p>
                    <p id="ss-rag-reranker-test-status" class="ss-rag-inline-hint ss-text-hint">Re-ranker test: not run</p>
                </div>
                <div id="ss-rag-warning" class="ss-rag-warning ss-hidden"></div>

                ${buildRagAccordion('backend', 'Backend', 'fa-server', `
                    <div class="ss-rag-backend-left">
                        <div class="ss-block">
                            <label for="ss-rag-backend">Backend Source</label>
                            <select id="ss-rag-backend" class="text_pole ss-rag-control">
                                <option value="vectra" ${backend === 'vectra' ? 'selected' : ''}>Vectra (default, local)</option>
                                <option value="lancedb" ${backend === 'lancedb' ? 'selected' : ''}>LanceDB (local)</option>
                                <option value="qdrant" ${backend === 'qdrant' ? 'selected' : ''}>Qdrant</option>
                                <option value="milvus" ${backend === 'milvus' ? 'selected' : ''}>Milvus</option>
                            </select>
                        </div>
                        <div id="ss-rag-qdrant-config" class="${isQdrant ? '' : 'ss-hidden'}">                            
                            <div id="ss-rag-qdrant-local" class="${qdrantUseCloud ? 'ss-hidden' : ''}">
                                <div class="ss-block">
                                    <label for="ss-rag-qdrant-address">API Address</label>
                                    <input id="ss-rag-qdrant-address" class="text_pole ss-rag-control" type="text" value="${rag.backendConfig?.qdrantAddress || 'localhost:6333'}" placeholder="localhost:6333">
                                </div>
                                <div class="ss-block">
                                    <label for="ss-rag-qdrant-local-key">Qdrant Key (optional)</label>
                                    <input id="ss-rag-qdrant-local-key" class="text_pole ss-rag-control" type="password" value="${rag.backendConfig?.qdrantApiKey || ''}">
                                </div>                                                                                             
                            </div>
                            <div id="ss-rag-qdrant-cloud" class="${qdrantUseCloud ? '' : 'ss-hidden'}">
                                <div class="ss-block">
                                    <label for="ss-rag-qdrant-url">Cloud URL</label>
                                    <input id="ss-rag-qdrant-url" class="text_pole ss-rag-control" type="text" value="${rag.backendConfig?.qdrantUrl || ''}" placeholder="https://cluster-id.region.aws.cloud.qdrant.io" />
                                </div>
                                <div class="ss-block">
                                    <label for="ss-rag-qdrant-cloud-key">Qdrant Cloud Key</label>
                                    <input id="ss-rag-qdrant-cloud-key" class="text_pole ss-rag-control" type="password" value="${rag.backendConfig?.qdrantApiKey || ''}" />
                                </div>
                            </div>
                            <label class="checkbox_label">
                                <input id="ss-rag-qdrant-use-cloud" class="ss-rag-control" type="checkbox" ${qdrantUseCloud ? 'checked' : ''} />
                                <span>Use Qdrant Cloud</span>
                            </label>                            
                        </div>

                        <div id="ss-rag-milvus-config" class="${isMilvus ? '' : 'ss-hidden'}">
                            <h5 class="ss-rag-subsection-title">Milvus Connection</h5>
                            <div class="ss-block">
                                <label for="ss-rag-milvus-address">Milvus Address</label>
                                <input id="ss-rag-milvus-address" class="text_pole ss-rag-control" type="text" value="${rag.backendConfig?.milvusAddress || 'localhost:19530'}" />
                            </div>
                            <div class="ss-block">
                                <label for="ss-rag-milvus-token">Milvus Token (optional)</label>
                                <input id="ss-rag-milvus-token" class="text_pole ss-rag-control" type="password" value="${rag.backendConfig?.milvusToken || ''}" />
                            </div>
                        </div>
                    </div>
                    <div class="ss-rag-backend-right">
                        <div class="ss-block">
                            <label for="ss-rag-source">Embedding Source</label>
                            <select id="ss-rag-source" class="text_pole ss-rag-control">
                                <option value="transformers" ${(rag.source || 'transformers') === 'transformers' ? 'selected' : ''}>transformers</option>
                                <option value="openai" ${rag.source === 'openai' ? 'selected' : ''}>openai</option>
                                <option value="ollama" ${rag.source === 'ollama' ? 'selected' : ''}>ollama</option>
                                <option value="llamacpp" ${rag.source === 'llamacpp' ? 'selected' : ''}>llamacpp</option>
                                <option value="vllm" ${rag.source === 'vllm' ? 'selected' : ''}>vllm</option>
                                <option value="koboldcpp" ${rag.source === 'koboldcpp' ? 'selected' : ''}>koboldcpp</option>
                                <option value="bananabread" ${rag.source === 'bananabread' ? 'selected' : ''}>bananabread</option>
                                <option value="extras" ${rag.source === 'extras' ? 'selected' : ''}>extras</option>
                            </select>
                        </div>
                        <div class="ss-block">
                            <label for="ss-rag-embedding-mode">Embedding Transport</label>
                            <div id="ss-rag-embedding-mode-host"></div>
                        </div>
                        <div class="ss-block">
                            <label id="ss-rag-api-url-label" for="ss-rag-api-url">Embedding API URL (optional override)</label>
                            <input id="ss-rag-api-url" class="text_pole ss-rag-control" type="text" value="${rag.apiUrl || ''}" placeholder="Leave blank to use default; e.g. http://localhost:11434" />
                            <p id="ss-rag-api-url-hint" class="ss-rag-inline-hint ss-text-hint">Overrides the default URL for this source. Useful for OpenAI-compatible proxies or custom endpoints.</p>
                        </div>
                        <div class="ss-block">
                            <label for="ss-rag-model">Embedding Model (optional)</label>
                            <input id="ss-rag-model" class="text_pole ss-rag-control" type="text" value="${rag.model || ''}" placeholder="text-embedding-3-large" />
                            <p class="ss-rag-inline-hint ss-text-hint">These values are sent to Similharity for embedding requests and should match your vectors extension provider setup.</p>
                        </div>
                        <div class="ss-block">
                            <label for="ss-rag-embedding-key">Embedding API Key (secure storage)</label>
                            <input id="ss-rag-embedding-key" class="text_pole" type="password" value="" placeholder="Enter new key to update; leave blank to keep current" />
                            <div class="ss-rag-actions-row ss-rag-actions-row-tight">
                                <input id="ss-rag-clear-embedding-key" class="menu_button" type="button" value="Clear Key" />
                            </div>
                            <p id="ss-rag-embedding-key-status" class="ss-rag-inline-hint ss-text-hint">Checking secure key status...</p>
                        </div>
                    </div>

                `)}

                ${buildRagAccordion('vectorization', 'Vectorization', 'fa-cubes', `
                    <div class="ss-block">
                        <label class="checkbox_label">
                            <input id="ss-rag-vectorize-shards" class="ss-rag-control" type="checkbox" ${rag.vectorizeShards ? 'checked' : ''} />
                            <span>Vectorize Memory Shards</span>
                        </label>
                    </div>
                    <div class="ss-block">
                        <label class="checkbox_label">
                            <input id="ss-rag-auto-vectorize-new" class="ss-rag-control" type="checkbox" ${rag.autoVectorizeNewSummaries ? 'checked' : ''} />
                            <span>Auto-Vector New Summaries</span>
                        </label>
                    </div>
                    <div class="ss-block">
                        <p class="ss-rag-inline-hint ss-text-hint">Only extension-generated summaries/shards are indexed.</p>
                    </div>
                    ${isSharder ? `
                    <div class="ss-block">
                        <label for="ss-rag-chunking-mode">Shard Chunking Mode</label>
                        <div id="ss-rag-chunking-mode-host"></div>
                        <p class="ss-rag-inline-hint ss-text-hint">Section-aware mode splits shards into superseding, cumulative, and rolling chunks with replacement/merge pruning behavior.</p>
                    </div>
                    ` : `
                    <div class="ss-block">
                        <label for="ss-rag-prose-chunking-mode">Prose Chunking Mode</label>
                        <div id="ss-rag-prose-chunking-mode-host"></div>
                        <p class="ss-rag-inline-hint ss-text-hint">Paragraph splits on double newlines. Full Summary indexes the whole summary as one chunk.</p>
                    </div>
                    `}
                    <div class="ss-block">
                        <label class="checkbox_label">
                            <input id="ss-rag-use-lorebooks-vectorization" class="ss-rag-control" type="checkbox" ${rag.useLorebooksForVectorization ? 'checked' : ''} />
                            <span>Use Lorebook</span>
                        </label>
                        <div id="ss-rag-vectorization-lorebook-options" class="ss-rag-vectorization-lorebook-options ${rag.useLorebooksForVectorization ? '' : 'ss-hidden'}">
                            <div id="ss-rag-vectorization-lorebook-dropdown"></div>
                        </div>
                        <p class="ss-rag-inline-hint ss-text-hint">Selected lorebooks are scanned for shard-style entries when bulk vectorizing.</p>
                    </div>

                    <div class="ss-rag-stats" id="ss-rag-stats">Loading collection stats...</div>
                `)}

                ${buildRagAccordion('retrieval', 'Retrieval', 'fa-magnifying-glass', `
                    <div class="ss-rag-grid-two">
                        <div class="ss-block">
                            <label class="checkbox_label">
                                <input id="ss-rag-include-lorebook-shards" class="ss-rag-control" type="checkbox" ${rag.includeLorebooksInShardSelection ? 'checked' : ''} />
                                <span>Include Lorebook Shards When Output Is System</span>
                            </label>
                            <p class="ss-rag-inline-hint ss-text-hint">Overrides shard discovery gating so sharder shard pickers also scan selected lorebooks while output mode is set to system.</p>
                        </div>
                    </div>

                    <div class="ss-rag-subsection">
                        <div class="ss-block">
                            <label class="checkbox_label">
                                <input id="ss-rag-reranker-enabled" class="ss-rag-control" type="checkbox" ${rag.reranker?.enabled ? 'checked' : ''} />
                                <span>Enable Re-ranker (Optional)</span>
                            </label>
                        </div>
                        <div id="ss-rag-reranker-config" class="${rag.reranker?.enabled ? '' : 'ss-hidden'}">
                            <div class="ss-block">
                                <label for="ss-rag-reranker-mode">Re-ranker Transport</label>
                                <div id="ss-rag-reranker-mode-host"></div>
                            </div>
                            <div class="ss-block">
                                <label id="ss-rag-reranker-url-label" for="ss-rag-reranker-url">Re-ranker API URL</label>
                                <input id="ss-rag-reranker-url" class="text_pole ss-rag-control" type="text" value="${rag.reranker?.apiUrl || ''}" placeholder="http://localhost:8080/rerank" />
                                <p id="ss-rag-reranker-url-hint" class="ss-rag-inline-hint ss-text-hint">Upstream reranker URL passed to Similharity.</p>
                            </div>
                            <div class="ss-block">
                                <label for="ss-rag-reranker-model">Re-ranker Model (optional)</label>
                                <input id="ss-rag-reranker-model" class="text_pole ss-rag-control" type="text" value="${rag.reranker?.model || ''}" placeholder="bge-reranker-v2-m3" />
                            </div>
                            <div class="ss-block">
                                <label for="ss-rag-reranker-key">Re-ranker API Key (secure storage)</label>
                                <input id="ss-rag-reranker-key" class="text_pole" type="password" value="" placeholder="Enter new key to update; leave blank to keep current" />
                                <div class="ss-rag-actions-row ss-rag-actions-row-tight">
                                    <input id="ss-rag-clear-reranker-key" class="menu_button" type="button" value="Clear Key" />
                                </div>
                                <p id="ss-rag-reranker-key-status" class="ss-rag-inline-hint ss-text-hint">Checking secure key status...</p>
                            </div>
                        </div>
                    </div>
                    <div class="ss-rag-grid-two">
                        <div class="ss-block">
                            <label for="ss-rag-insert-count">Insert Count</label>
                            <input id="ss-rag-insert-count" class="text_pole ss-rag-control" type="number" min="1" value="${rag.insertCount ?? 5}" />
                        </div>
                        <div class="ss-block">
                            <label for="ss-rag-query-count">Query Count</label>
                            <input id="ss-rag-query-count" class="text_pole ss-rag-control" type="number" min="1" value="${rag.queryCount ?? 2}" />
                        </div>
                        <div class="ss-block">
                            <label for="ss-rag-protect-count">Protect Count</label>
                            <input id="ss-rag-protect-count" class="text_pole ss-rag-control" type="number" min="0" value="${rag.protectCount ?? 5}" />
                        </div>
                        <div class="ss-block">
                            <label for="ss-rag-threshold">Score Threshold</label>
                            <div id="ss-rag-threshold-host"></div>
                        </div>
                    </div>

                    <div class="ss-rag-grid-two">
                        <div class="ss-block">
                            <label for="ss-rag-scoring">Scoring Method</label>
                            <select id="ss-rag-scoring" class="text_pole ss-rag-control">
                                <option value="keyword" ${rag.scoringMethod === 'keyword' ? 'selected' : ''}>Keyword</option>
                                <option value="bm25" ${rag.scoringMethod === 'bm25' ? 'selected' : ''}>BM25</option>
                                <option value="hybrid" ${rag.scoringMethod === 'hybrid' ? 'selected' : ''}>Hybrid</option>
                            </select>
                            <p class="ss-rag-inline-hint ss-text-hint" id="ss-rag-hybrid-hint"></p>
                        </div>
                        <div class="ss-block">
                            <label for="ss-rag-injection-mode">Injection Mode</label>
                            <select id="ss-rag-injection-mode" class="text_pole ss-rag-control">
                                <option value="extension_prompt" ${(rag.injectionMode ?? 'extension_prompt') === 'extension_prompt' ? 'selected' : ''}>Extension Prompt (Position / Depth)</option>
                                <option value="variable" ${rag.injectionMode === 'variable' ? 'selected' : ''}>Variable ({{getvar::...}})</option>
                            </select>
                        </div>
                    </div>

                    <div id="ss-rag-ext-prompt-controls" class="${(rag.injectionMode ?? 'extension_prompt') !== 'extension_prompt' ? 'ss-hidden' : ''}">
                        <div class="ss-rag-grid-two">
                            <div class="ss-block">
                                <label for="ss-rag-position">Injection Position</label>
                                <select id="ss-rag-position" class="text_pole ss-rag-control">
                                    <option value="0" ${(rag.position ?? 0) === 0 ? 'selected' : ''}>Position 0</option>
                                    <option value="1" ${(rag.position ?? 0) === 1 ? 'selected' : ''}>Position 1</option>
                                    <option value="2" ${(rag.position ?? 0) === 2 ? 'selected' : ''}>Position 2</option>
                                </select>
                            </div>
                            <div class="ss-block">
                                <label for="ss-rag-depth">Injection Depth</label>
                                <input id="ss-rag-depth" class="text_pole ss-rag-control" type="number" min="0" value="${rag.depth ?? 2}" />
                            </div>
                        </div>
                    </div>

                    <div id="ss-rag-var-controls" class="${rag.injectionMode === 'variable' ? '' : 'ss-hidden'}">
                        <div class="ss-block">
                            <label for="ss-rag-var-name">Variable Name</label>
                            <input id="ss-rag-var-name" class="text_pole ss-rag-control" type="text" value="${rag.injectionVariableName || 'ss_rag_memory'}" />
                            <p class="ss-text-hint">Place <code>{{getvar::${rag.injectionVariableName || 'ss_rag_memory'}}}</code> anywhere in your character card, system prompt, or author's note to inject memories there.</p>
                        </div>
                    </div>

                    <div id="ss-rag-hybrid-controls" class="${rag.scoringMethod === 'hybrid' ? '' : 'ss-hidden'}">
                        <div class="ss-rag-grid-two">
                            <div class="ss-block">
                                <label for="ss-rag-hybrid-fusion">Hybrid Fusion Method</label>
                                <div id="ss-rag-hybrid-fusion-host"></div>
                            </div>
                            <div class="ss-block">
                                <label for="ss-rag-hybrid-overfetch">Hybrid Overfetch Multiplier</label>
                                <input id="ss-rag-hybrid-overfetch" class="text_pole ss-rag-control" type="number" min="1" max="12" value="${rag.hybridOverfetchMultiplier ?? 4}" />
                            </div>
                        </div>
                        <div class="ss-rag-grid-two">
                            <div class="ss-block ${rag.hybridFusionMethod !== 'weighted' ? '' : 'ss-hidden'}" id="ss-rag-rrf-k-wrap">
                                <label for="ss-rag-hybrid-rrf-k">RRF k</label>
                                <input id="ss-rag-hybrid-rrf-k" class="text_pole ss-rag-control" type="number" min="1" max="500" value="${rag.hybridRrfK ?? 60}" />
                            </div>
                            <div class="ss-block ${rag.hybridFusionMethod === 'weighted' ? '' : 'ss-hidden'}" id="ss-rag-weighted-alpha-wrap">
                                <label for="ss-rag-hybrid-alpha">Weighted Alpha (Vector)</label>
                                <input id="ss-rag-hybrid-alpha" class="text_pole ss-rag-control" type="number" min="0" max="1" step="0.05" value="${rag.hybridAlpha ?? 0.4}" />
                            </div>
                            <div class="ss-block ${rag.hybridFusionMethod === 'weighted' ? '' : 'ss-hidden'}" id="ss-rag-weighted-beta-wrap">
                                <label for="ss-rag-hybrid-beta">Weighted Beta (BM25)</label>
                                <input id="ss-rag-hybrid-beta" class="text_pole ss-rag-control" type="number" min="0" max="1" step="0.05" value="${rag.hybridBeta ?? 0.6}" />
                            </div>
                        </div>
                    </div>

                    <div class="ss-block">
                        <label for="ss-rag-template">Injection Template ({{text}} required)</label>
                        <textarea id="ss-rag-template" class="text_pole ss-rag-control ss-rag-template">${rag.template || 'Recalled memories:\n{{text}}'}</textarea>
                    </div>

                    ${isSharder ? `
                    <div class="ss-block">
                        <label class="checkbox_label">
                            <input id="ss-rag-scene-expand" class="ss-rag-control" type="checkbox" ${rag.sceneExpansion !== false ? 'checked' : ''} />
                            <span>Scene Expansion</span>
                        </label>
                    </div>
                    <div class="ss-block ${rag.sceneExpansion !== false ? '' : 'ss-hidden'}" id="ss-rag-scene-max-wrap">
                        <label for="ss-rag-scene-max">Max Scene Expansion Chunks</label>
                        <div id="ss-rag-scene-max-host"></div>
                    </div>
                    ` : `
                    <p class="ss-rag-inline-hint ss-text-hint ss-rag-scene-mode-hint">Scene Expansion is available in Sharder Mode.</p>
                    `}

                `)}
            </div>
        </div>
    `;
}

/**
 * @param {Object} rag
 * @param {string} collectionId
 */
async function updateStats(rag, collectionId) {
    const statsEl = document.getElementById('ss-rag-stats');
    if (!statsEl) return;

    try {
        const stats = await getCollectionStats(collectionId, rag);
        const count = stats?.stats?.count ?? stats?.stats?.total ?? stats?.count ?? stats?.total ?? 0;
        statsEl.textContent = `Collection Stats: fragments=${count}`;
    } catch (error) {
        statsEl.textContent = `Collection stats unavailable: ${error?.message || error}`;
    }
}

function setControlState(disabled) {
    for (const el of document.querySelectorAll('.ss-rag-control')) {
        if (typeof el.setDisabled === 'function') {
            el.setDisabled(!!disabled);
            continue;
        }

        if ('disabled' in el) {
            el.disabled = !!disabled;
        }
    }
}

function setupRagAccordionHandlers() {
    const toggleAccordion = (header) => {
        const accordion = header.closest('.ss-review-accordion');
        if (!accordion) return;

        const content = accordion.querySelector('.ss-accordion-content');
        if (!content) return;

        const isExpanded = accordion.classList.toggle('expanded');
        content.classList.toggle('ss-hidden', !isExpanded);
        header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    };

    for (const header of document.querySelectorAll('.ss-rag-accordion .ss-accordion-header')) {
        if (!header.hasAttribute('role')) {
            header.setAttribute('role', 'button');
        }
        if (!header.hasAttribute('tabindex')) {
            header.setAttribute('tabindex', '0');
        }

        header.addEventListener('click', (e) => {
            if (e.target?.closest?.('button, input, select, textarea, a, label')) return;
            toggleAccordion(header);
        });

        header.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
            e.preventDefault();
            toggleAccordion(header);
        });
    }
}

function updateBackendConditionalUi() {
    const backend = document.getElementById('ss-rag-backend')?.value || 'vectra';

    const qdrant = document.getElementById('ss-rag-qdrant-config');
    const milvus = document.getElementById('ss-rag-milvus-config');

    qdrant?.classList.toggle('ss-hidden', backend !== 'qdrant');
    milvus?.classList.toggle('ss-hidden', backend !== 'milvus');
    updateQdrantCloudUi();

    const hybridHint = document.getElementById('ss-rag-hybrid-hint');

    if (hybridHint) {
        hybridHint.textContent = (backend === 'qdrant' || backend === 'milvus')
            ? 'Hybrid uses native fusion on this backend.'
            : 'Hybrid uses client-side BM25 + fusion fallback on this backend.';
    }
}

function updateMasterToggleUi() {
    const enabled = !!document.getElementById('ss-rag-enabled')?.checked;
    const body = document.getElementById('ss-rag-body');
    body?.classList.toggle('ss-hidden', !enabled);
}

function updateQdrantCloudUi() {
    const useCloud = !!document.getElementById('ss-rag-qdrant-use-cloud')?.checked;
    const local = document.getElementById('ss-rag-qdrant-local');
    const cloud = document.getElementById('ss-rag-qdrant-cloud');
    local?.classList.toggle('ss-hidden', useCloud);
    cloud?.classList.toggle('ss-hidden', !useCloud);
}

function updateChunkingUi() {
    // Placeholder for future mode-specific controls.
}

function updateHybridUi() {
    const scoringMethod = document.getElementById('ss-rag-scoring')?.value || 'keyword';
    const fusionMethod = document.getElementById('ss-rag-hybrid-fusion')?.value || 'rrf';

    const hybridWrap = document.getElementById('ss-rag-hybrid-controls');
    const rrfWrap = document.getElementById('ss-rag-rrf-k-wrap');
    const alphaWrap = document.getElementById('ss-rag-weighted-alpha-wrap');
    const betaWrap = document.getElementById('ss-rag-weighted-beta-wrap');

    hybridWrap?.classList.toggle('ss-hidden', scoringMethod !== 'hybrid');
    rrfWrap?.classList.toggle('ss-hidden', !(scoringMethod === 'hybrid' && fusionMethod !== 'weighted'));
    alphaWrap?.classList.toggle('ss-hidden', !(scoringMethod === 'hybrid' && fusionMethod === 'weighted'));
    betaWrap?.classList.toggle('ss-hidden', !(scoringMethod === 'hybrid' && fusionMethod === 'weighted'));
}

function updateInjectionModeUi() {
    const mode = document.getElementById('ss-rag-injection-mode')?.value || 'extension_prompt';
    document.getElementById('ss-rag-ext-prompt-controls')?.classList.toggle('ss-hidden', mode !== 'extension_prompt');
    document.getElementById('ss-rag-var-controls')?.classList.toggle('ss-hidden', mode !== 'variable');
}

function updateExpansionUi() {
    const sceneExpandEl = document.getElementById('ss-rag-scene-expand');
    if (!sceneExpandEl) return; // not present in standard mode
    const sceneEnabled = !!sceneExpandEl.checked;
    const sceneWrap = document.getElementById('ss-rag-scene-max-wrap');
    sceneWrap?.classList.toggle('ss-hidden', !sceneEnabled);
}

function updateEmbeddingModeUi() {
    const mode = document.getElementById('ss-rag-embedding-mode')?.value || 'similharity';
    const urlLabel = document.getElementById('ss-rag-api-url-label');
    const urlHint = document.getElementById('ss-rag-api-url-hint');
    const urlInput = document.getElementById('ss-rag-api-url');
    if (urlLabel) {
        urlLabel.textContent = mode === 'direct'
            ? 'Embedding Endpoint URL (required)'
            : 'Embedding API URL (optional override)';
    }
    if (urlInput) {
        urlInput.placeholder = mode === 'direct'
            ? 'https://api.example.com/v1 — /embeddings is appended automatically'
            : 'Leave blank to use default; e.g. http://localhost:11434';
    }
    if (urlHint) {
        urlHint.textContent = mode === 'direct'
            ? 'Direct mode calls this URL from the browser. Provide your base URL (e.g. https://api.example.com/v1) — /embeddings is appended automatically.'
            : 'Overrides the default URL for this source. Useful for OpenAI-compatible proxies or custom endpoints.';
    }
}

function updateRerankerUi() {
    const enabled = !!document.getElementById('ss-rag-reranker-enabled')?.checked;
    const mode = document.getElementById('ss-rag-reranker-mode')?.value || 'similharity';
    const wrap = document.getElementById('ss-rag-reranker-config');
    const urlLabel = document.getElementById('ss-rag-reranker-url-label');
    const urlHint = document.getElementById('ss-rag-reranker-url-hint');
    wrap?.classList.toggle('ss-hidden', !enabled);
    if (urlLabel) {
        urlLabel.textContent = mode === 'direct' ? 'Re-ranker Endpoint URL (required)' : 'Re-ranker API URL';
    }
    const urlInput = document.getElementById('ss-rag-reranker-url');
    if (urlInput) {
        urlInput.placeholder = mode === 'direct'
            ? 'https://api.example.com/v1 — /rerank is appended automatically'
            : 'http://localhost:8080/rerank';
    }
    if (urlHint) {
        urlHint.textContent = mode === 'direct'
            ? 'Direct mode calls this URL from the browser. Provide your base URL (e.g. https://api.example.com/v1) — /rerank is appended automatically.'
            : 'Upstream reranker URL passed to Similharity.';
    }
}

/**
 * @param {Object} base
 * @param {boolean} isSharder
 * @returns {Object}
 */
function readRagDraft(base, isSharder) {
    const draft = {
        ...base,
        vectorizationLorebookNames: Array.isArray(base.vectorizationLorebookNames)
            ? [...base.vectorizationLorebookNames]
            : [],
        backendConfig: {
            ...(base.backendConfig || {}),
        },
    };

    draft.enabled = !!document.getElementById('ss-rag-enabled')?.checked;
    draft.backend = document.getElementById('ss-rag-backend')?.value || 'vectra';
    draft.source = document.getElementById('ss-rag-source')?.value?.trim() || 'transformers';
    draft.embeddingMode = document.getElementById('ss-rag-embedding-mode')?.value || 'similharity';
    draft.apiUrl = document.getElementById('ss-rag-api-url')?.value?.trim() || '';
    draft.model = document.getElementById('ss-rag-model')?.value?.trim() || '';

    draft.backendConfig.qdrantAddress = document.getElementById('ss-rag-qdrant-address')?.value?.trim() || 'localhost:6333';
    draft.backendConfig.qdrantUseCloud = !!document.getElementById('ss-rag-qdrant-use-cloud')?.checked;
    const qdrantLocalKey = document.getElementById('ss-rag-qdrant-local-key')?.value || '';
    const qdrantCloudKey = document.getElementById('ss-rag-qdrant-cloud-key')?.value || '';
    draft.backendConfig.qdrantApiKey = draft.backendConfig.qdrantUseCloud ? qdrantCloudKey : qdrantLocalKey;
    draft.backendConfig.qdrantUrl = document.getElementById('ss-rag-qdrant-url')?.value?.trim() || '';
    draft.backendConfig.milvusAddress = document.getElementById('ss-rag-milvus-address')?.value?.trim() || 'localhost:19530';
    draft.backendConfig.milvusToken = document.getElementById('ss-rag-milvus-token')?.value || '';

    draft.reranker = {
        enabled: !!document.getElementById('ss-rag-reranker-enabled')?.checked,
        mode: document.getElementById('ss-rag-reranker-mode')?.value || 'similharity',
        apiUrl: document.getElementById('ss-rag-reranker-url')?.value?.trim() || '',
        model: document.getElementById('ss-rag-reranker-model')?.value?.trim() || '',
        secretId: base.reranker?.secretId || null,
    };

    draft.vectorizeShards = !!document.getElementById('ss-rag-vectorize-shards')?.checked;
    draft.autoVectorizeNewSummaries = !!document.getElementById('ss-rag-auto-vectorize-new')?.checked;
    draft.useLorebooksForVectorization = !!document.getElementById('ss-rag-use-lorebooks-vectorization')?.checked;
    draft.includeLorebooksInShardSelection = !!document.getElementById('ss-rag-include-lorebook-shards')?.checked;

    if (isSharder) {
        draft.chunkingStrategy = 'per_message';
        draft.batchSize = 5;
        const chunkingMode = document.getElementById('ss-rag-chunking-mode')?.value === 'section'
            ? 'section'
            : 'standard';
        draft.chunkingMode = chunkingMode;
        draft.sceneAwareChunking = false;
        draft.sectionAwareChunking = chunkingMode === 'section';
        draft.sceneExpansion = !!document.getElementById('ss-rag-scene-expand')?.checked;
        draft.maxSceneExpansionChunks = Math.max(1, Math.min(25, toInt(document.getElementById('ss-rag-scene-max')?.value, 10)));
    } else {
        draft.proseChunkingMode = document.getElementById('ss-rag-prose-chunking-mode')?.value === 'full_summary'
            ? 'full_summary'
            : 'paragraph';
    }

    draft.scoringMethod = document.getElementById('ss-rag-scoring')?.value || 'keyword';
    draft.hybridFusionMethod = document.getElementById('ss-rag-hybrid-fusion')?.value || 'rrf';
    draft.hybridRrfK = Math.max(1, Math.min(500, toInt(document.getElementById('ss-rag-hybrid-rrf-k')?.value, 60)));
    draft.hybridAlpha = Math.min(1, Math.max(0, toFloat(document.getElementById('ss-rag-hybrid-alpha')?.value, 0.4)));
    draft.hybridBeta = Math.min(1, Math.max(0, toFloat(document.getElementById('ss-rag-hybrid-beta')?.value, 0.6)));
    draft.hybridOverfetchMultiplier = Math.max(1, Math.min(12, toInt(document.getElementById('ss-rag-hybrid-overfetch')?.value, 4)));
    draft.insertCount = Math.max(1, toInt(document.getElementById('ss-rag-insert-count')?.value, 5));
    draft.queryCount = Math.max(1, toInt(document.getElementById('ss-rag-query-count')?.value, 2));
    draft.protectCount = Math.max(0, toInt(document.getElementById('ss-rag-protect-count')?.value, 5));
    draft.scoreThreshold = Math.min(1, Math.max(0, toFloat(document.getElementById('ss-rag-threshold')?.value, 0.25)));
    draft.position = toInt(document.getElementById('ss-rag-position')?.value, 0);
    draft.depth = Math.max(0, toInt(document.getElementById('ss-rag-depth')?.value, 2));
    draft.template = document.getElementById('ss-rag-template')?.value || 'Recalled memories:\n{{text}}';
    draft.injectionMode = document.getElementById('ss-rag-injection-mode')?.value || 'extension_prompt';
    draft.injectionVariableName = document.getElementById('ss-rag-var-name')?.value?.trim() || 'ss_rag_memory';

    return draft;
}

/**
 * @param {Object} settings
 * @param {Object} saved
 * @param {string} ragBlockKey - 'rag' or 'ragStandard'
 */
function applyRagSettings(settings, saved, ragBlockKey) {
    const target = settings[ragBlockKey] || {};
    settings[ragBlockKey] = {
        ...target,
        ...saved,
        backendConfig: {
            ...(target.backendConfig || {}),
            ...(saved.backendConfig || {}),
        },
        reranker: {
            ...(target.reranker || {}),
            ...(saved.reranker || {}),
        },
        vectorizationLorebookNames: Array.isArray(saved.vectorizationLorebookNames)
            ? [...saved.vectorizationLorebookNames]
            : (Array.isArray(target.vectorizationLorebookNames) ? [...target.vectorizationLorebookNames] : []),
    };
    // Ensure sceneAwareChunking stays false
    if (ragBlockKey === 'rag') {
        settings[ragBlockKey].sceneAwareChunking = false;
    }
}

/**
 * @param {Object} ragDraft
 */
async function runStatusChecks(ragDraft) {
    const rerankerEl = document.getElementById('ss-rag-reranker-status');
    const embedEl = document.getElementById('ss-rag-embedding-status');
    const backendEl = document.getElementById('ss-rag-backend-health');
    const warningEl = document.getElementById('ss-rag-warning');
    const summarize = (value, max = 90) => {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (!text) return '';
        return text.length > max ? `${text.slice(0, max - 3)}...` : text;
    };

    try {
        const [plugin, embedding, backendHealth, embeddingHealth, rerankerHealth] = await Promise.all([
            checkPluginAvailability(),
            Promise.resolve(checkEmbeddingAvailability()),
            checkBackendHealth(ragDraft.backend || 'vectra'),
            testEmbeddingConnection(ragDraft, 'Summary Sharder settings health check')
                .then(result => ({
                    success: !!result?.success,
                    dimensions: Number(result?.dimensions) || 0,
                    error: '',
                }))
                .catch(error => ({
                    success: false,
                    dimensions: 0,
                    error: error?.message || String(error),
                })),
            checkRerankerHealth(ragDraft),
        ]);
        const ragSource = String(ragDraft?.source || '').trim();
        const ragModel = String(ragDraft?.model || '').trim();
        const ragApiUrl = String(ragDraft?.apiUrl || '').trim();
        const globalSource = String(embedding?.source || '').trim();
        const hasRagSource = !!ragSource;
        const sourceMismatch = hasRagSource && globalSource && ragSource !== globalSource;
        const backendName = String(ragDraft?.backend || 'vectra').trim() || 'vectra';

        if (rerankerEl) {
            rerankerEl.textContent = rerankerHealth.statusText;
        }

        if (embedEl) {
            const healthText = embeddingHealth.success ? 'Healthy' : 'Unhealthy';
            const sourceText = hasRagSource ? ragSource : 'not set';
            const modelText = ragModel || 'default';
            const apiText = ragApiUrl || 'default';
            const dimsText = embeddingHealth.success ? ` (${embeddingHealth.dimensions}d)` : '';
            const errorText = !embeddingHealth.success && embeddingHealth.error
                ? `: ${summarize(embeddingHealth.error)}`
                : '';
            embedEl.textContent = `${sourceText} - ${healthText}${dimsText}${errorText}; model ${modelText}; api ${apiText}`;
        }

        if (backendEl) {
            backendEl.textContent = backendHealth.healthy
                ? `${backendName} - Healthy`
                : `${backendName} - Unhealthy${backendHealth.message ? `: ${summarize(backendHealth.message)}` : ''}`;
        }

        const warnings = [];
        if (!plugin.available) {
            warnings.push('Similharity plugin is unavailable. Enable server plugins and install Similharity.');
        }
        if (!hasRagSource && !embedding.available) {
            warnings.push('Embedding source is not configured. Set it in SillyTavern Extensions > Vectors.');
        }
        if (!hasRagSource) {
            warnings.push('RAG embedding source is empty. Set "Embedding API/Source" in this modal.');
        }
        if (sourceMismatch) {
            warnings.push(`RAG source (${ragSource}) differs from ST vectors source (${globalSource}). Tests and vector operations use the RAG source.`);
        }

        if (warningEl) {
            if (warnings.length > 0) {
                warningEl.classList.remove('ss-hidden');
                warningEl.textContent = warnings.join(' ');
            } else {
                warningEl.classList.add('ss-hidden');
                warningEl.textContent = '';
            }
        }

        setControlState(!plugin.available);
    } catch (error) {
        console.warn(`${LOG_PREFIX} Status check failed:`, error?.message || error);
        if (warningEl) {
            warningEl.classList.remove('ss-hidden');
            warningEl.textContent = `Status check failed: ${error?.message || error}`;
        }
    }
}
/**
 * Open the RAG settings modal.
 * @param {Object} settings
 */
export async function openRagSettingsModal(settings) {
    const isSharder = settings?.sharderMode === true;
    const ragBlockKey = isSharder ? 'rag' : 'ragStandard';
    const defaults = getDefaultSettings();

    // Ensure the target block exists
    if (!settings[ragBlockKey]) {
        settings[ragBlockKey] = { ...(defaults[ragBlockKey] || defaults.rag) };
    }

    const src = settings[ragBlockKey];

    // Build the working draft from the active block
    const rag = {
        enabled: src.enabled ?? false,
        backend: src.backend || 'vectra',
        source: src.source || 'transformers',
        embeddingMode: src.embeddingMode || 'similharity',
        apiUrl: src.apiUrl || '',
        model: src.model || '',
        embeddingSecretId: src.embeddingSecretId || null,
        backendConfig: {
            qdrantAddress: src.backendConfig?.qdrantAddress
                || `${src.backendConfig?.qdrantHost || 'localhost'}:${src.backendConfig?.qdrantPort ?? 6333}`,
            qdrantUseCloud: src.backendConfig?.qdrantUseCloud === true
                || String(src.backendConfig?.qdrantUrl || '').trim().length > 0,
            qdrantApiKey: src.backendConfig?.qdrantApiKey || '',
            qdrantUrl: src.backendConfig?.qdrantUrl || '',
            milvusAddress: src.backendConfig?.milvusAddress || 'localhost:19530',
            milvusToken: src.backendConfig?.milvusToken || '',
        },
        vectorizeShards: src.vectorizeShards !== false,
        autoVectorizeNewSummaries: src.autoVectorizeNewSummaries !== false,
        useLorebooksForVectorization: src.useLorebooksForVectorization === true,
        vectorizationLorebookNames: Array.isArray(src.vectorizationLorebookNames)
            ? [...src.vectorizationLorebookNames]
            : [],
        includeLorebooksInShardSelection: src.includeLorebooksInShardSelection === true,
        insertCount: src.insertCount ?? 5,
        queryCount: src.queryCount ?? 2,
        protectCount: src.protectCount ?? 5,
        scoreThreshold: src.scoreThreshold ?? 0.25,
        scoringMethod: src.scoringMethod || 'keyword',
        hybridFusionMethod: src.hybridFusionMethod || 'rrf',
        hybridRrfK: src.hybridRrfK ?? 60,
        hybridAlpha: src.hybridAlpha ?? 0.4,
        hybridBeta: src.hybridBeta ?? 0.6,
        hybridOverfetchMultiplier: src.hybridOverfetchMultiplier ?? 4,
        position: src.position ?? 0,
        depth: src.depth ?? 2,
        template: src.template || 'Recalled memories:\n{{text}}',
        injectionMode: src.injectionMode || 'extension_prompt',
        injectionVariableName: src.injectionVariableName || 'ss_rag_memory',
        reranker: {
            enabled: src.reranker?.enabled ?? false,
            mode: src.reranker?.mode || 'similharity',
            apiUrl: src.reranker?.apiUrl || '',
            model: src.reranker?.model || '',
            secretId: src.reranker?.secretId || null,
        },
        // Sharder-only fields
        ...(isSharder ? {
            chunkingStrategy: (() => {
                const c = src.chunkingStrategy;
                return (c === 'conversation_turns' || c === 'message_batch' || c === 'per_message') ? c : 'per_message';
            })(),
            batchSize: src.batchSize ?? 5,
            chunkingMode: resolveShardChunkingMode(src),
            sceneAwareChunking: src.sceneAwareChunking === true,
            sectionAwareChunking: src.sectionAwareChunking === true,
            sceneExpansion: src.sceneExpansion !== false,
            maxSceneExpansionChunks: src.maxSceneExpansionChunks ?? 10,
        } : {
            // Standard-only fields
            proseChunkingMode: src.proseChunkingMode || 'paragraph',
        }),
    };

    const buildSecretSettingsView = () => ({ ...settings, rag: settings[ragBlockKey] });

    let collectionId = null;
    try {
        collectionId = isSharder ? getShardCollectionId() : getStandardCollectionId();
    } catch {
        // No chat open — collection-specific features will be disabled
    }

    const popup = new Popup(
        renderModalHtml(rag, isSharder),
        POPUP_TYPE.TEXT,
        null,
        {
            okButton: 'Save',
            cancelButton: 'Cancel',
            wide: true,
            large: false,
        },
    );

    const showPromise = popup.show();
    let liveDraft = {
        ...rag,
        vectorizationLorebookNames: [...(rag.vectorizationLorebookNames || [])],
        backendConfig: { ...(rag.backendConfig || {}) },
    };
    let pendingEmbeddingKey = '';
    let pendingRerankerKey = '';

    requestAnimationFrame(async () => {
        let vectorizationLorebookDropdown = null;

        const syncDraftFromDom = () => {
            liveDraft = readRagDraft(liveDraft, isSharder);
        };

        const updateVectorizationLorebookUi = () => {
            const enabled = !!document.getElementById('ss-rag-use-lorebooks-vectorization')?.checked;
            const optionsDiv = document.getElementById('ss-rag-vectorization-lorebook-options');
            optionsDiv?.classList.toggle('ss-hidden', !enabled);

            if (!enabled) {
                return;
            }

            if (!vectorizationLorebookDropdown) {
                vectorizationLorebookDropdown = new LorebookDropdown('ss-rag-vectorization-lorebook-dropdown', {
                    initialSelection: Array.isArray(liveDraft.vectorizationLorebookNames)
                        ? [...liveDraft.vectorizationLorebookNames]
                        : [],
                    onSelectionChange: (selection) => {
                        liveDraft.vectorizationLorebookNames = Array.isArray(selection) ? [...selection] : [];
                    },
                });
            }

            vectorizationLorebookDropdown.render();
            vectorizationLorebookDropdown.setSelection(
                Array.isArray(liveDraft.vectorizationLorebookNames)
                    ? [...liveDraft.vectorizationLorebookNames]
                    : [],
            );
        };

        const mountSegmentedToggle = (hostId, controlId, options, value) => {
            const host = document.getElementById(hostId);
            if (!host) {
                return;
            }

            const segmented = createSegmentedToggle({
                options,
                value,
                className: 'ss-rag-control',
            });
            segmented.id = controlId;
            host.replaceChildren(segmented);
        };

        const mountRangePair = (hostId, controlId, min, max, step, value) => {
            const host = document.getElementById(hostId);
            if (!host) {
                return;
            }

            const pair = createRangeSliderPair({
                id: controlId,
                min,
                max,
                step,
                value,
                className: 'ss-rag-control',
            });
            host.replaceChildren(pair);
        };

        mountRangePair('ss-rag-threshold-host', 'ss-rag-threshold', 0, 1, 0.01, rag.scoreThreshold ?? 0.25);
        mountRangePair('ss-rag-scene-max-host', 'ss-rag-scene-max', 1, 25, 1, rag.maxSceneExpansionChunks ?? 10);

        mountSegmentedToggle(
            'ss-rag-embedding-mode-host',
            'ss-rag-embedding-mode',
            [
                { value: 'similharity', label: 'Similharity Proxy' },
                { value: 'direct', label: 'Direct Endpoint' },
            ],
            rag.embeddingMode || 'similharity',
        );

        mountSegmentedToggle(
            'ss-rag-reranker-mode-host',
            'ss-rag-reranker-mode',
            [
                { value: 'similharity', label: 'Similharity Proxy' },
                { value: 'direct', label: 'Direct Endpoint' },
            ],
            rag.reranker?.mode || 'similharity',
        );

        mountSegmentedToggle(
            'ss-rag-chunking-mode-host',
            'ss-rag-chunking-mode',
            [
                { value: 'standard', label: 'Standard' },
                { value: 'section', label: 'Section-Aware' },
            ],
            rag.chunkingMode || 'standard',
        );

        mountSegmentedToggle(
            'ss-rag-prose-chunking-mode-host',
            'ss-rag-prose-chunking-mode',
            [
                { value: 'paragraph', label: 'Paragraph' },
                { value: 'full_summary', label: 'Full Summary' },
            ],
            rag.proseChunkingMode || 'paragraph',
        );

        mountSegmentedToggle(
            'ss-rag-hybrid-fusion-host',
            'ss-rag-hybrid-fusion',
            [
                { value: 'rrf', label: 'RRF' },
                { value: 'weighted', label: 'Weighted' },
            ],
            rag.hybridFusionMethod || 'rrf',
        );

        for (const control of document.querySelectorAll('.ss-rag-control')) {
            control.addEventListener('input', syncDraftFromDom);
            control.addEventListener('change', syncDraftFromDom);
        }

        const embeddingKeyInput = document.getElementById('ss-rag-embedding-key');
        embeddingKeyInput?.addEventListener('input', () => {
            pendingEmbeddingKey = embeddingKeyInput.value || '';
        });

        const rerankerKeyInput = document.getElementById('ss-rag-reranker-key');
        rerankerKeyInput?.addEventListener('input', () => {
            pendingRerankerKey = rerankerKeyInput.value || '';
        });

        updateBackendConditionalUi();
        updateMasterToggleUi();
        updateQdrantCloudUi();
        updateChunkingUi();
        updateHybridUi();
        updateExpansionUi();
        updateEmbeddingModeUi();
        updateRerankerUi();
        updateVectorizationLorebookUi();
        setupRagAccordionHandlers();

        const embeddingKeyStatusEl = document.getElementById('ss-rag-embedding-key-status');
        const refreshEmbeddingKeyStatus = async () => {
            const hasKey = await hasRagEmbeddingApiKey(buildSecretSettingsView());
            if (embeddingKeyStatusEl) {
                embeddingKeyStatusEl.textContent = hasKey
                    ? 'A secure embedding key is stored.'
                    : 'No secure embedding key stored.';
            }
        };
        await refreshEmbeddingKeyStatus();

        const rerankerKeyStatusEl = document.getElementById('ss-rag-reranker-key-status');
        const refreshRerankerKeyStatus = async () => {
            const hasKey = await hasRagRerankerApiKey(buildSecretSettingsView());
            if (rerankerKeyStatusEl) {
                rerankerKeyStatusEl.textContent = hasKey
                    ? 'A secure re-ranker key is stored.'
                    : 'No secure re-ranker key stored.';
            }
        };
        await refreshRerankerKeyStatus();

        const initialDraft = readRagDraft(liveDraft, isSharder);
        await runStatusChecks(initialDraft);
        if (collectionId) {
            await updateStats(initialDraft, collectionId);
        } else {
            const statsEl = document.getElementById('ss-rag-stats');
            if (statsEl) statsEl.textContent = 'Collection stats: no chat open';
        }

        document.getElementById('ss-rag-backend')?.addEventListener('change', async () => {
            updateBackendConditionalUi();
            const draft = readRagDraft(liveDraft, isSharder);
            await runStatusChecks(draft);
            if (collectionId) await updateStats(draft, collectionId);
        });
        document.getElementById('ss-rag-enabled')?.addEventListener('change', () => {
            updateMasterToggleUi();
        });
        document.getElementById('ss-rag-qdrant-use-cloud')?.addEventListener('change', () => {
            updateQdrantCloudUi();
        });

        for (const id of [
            'ss-rag-source',
            'ss-rag-model',
            'ss-rag-api-url',
            'ss-rag-embedding-mode',
            'ss-rag-reranker-enabled',
            'ss-rag-reranker-mode',
            'ss-rag-reranker-url',
            'ss-rag-reranker-model',
        ]) {
            document.getElementById(id)?.addEventListener('change', async () => {
                const draft = readRagDraft(liveDraft, isSharder);
                await runStatusChecks(draft);
            });
        }

        document.getElementById('ss-rag-scoring')?.addEventListener('change', () => {
            updateHybridUi();
        });
        document.getElementById('ss-rag-hybrid-fusion')?.addEventListener('change', () => {
            updateHybridUi();
        });
        document.getElementById('ss-rag-injection-mode')?.addEventListener('change', () => {
            updateInjectionModeUi();
        });

        // Scene expansion toggle only exists in Sharder Mode
        if (isSharder) {
            document.getElementById('ss-rag-scene-expand')?.addEventListener('change', () => {
                updateExpansionUi();
            });
        }

        document.getElementById('ss-rag-embedding-mode')?.addEventListener('change', () => {
            updateEmbeddingModeUi();
        });
        document.getElementById('ss-rag-reranker-enabled')?.addEventListener('change', () => {
            updateRerankerUi();
        });
        document.getElementById('ss-rag-reranker-mode')?.addEventListener('change', () => {
            updateRerankerUi();
        });
        document.getElementById('ss-rag-use-lorebooks-vectorization')?.addEventListener('change', () => {
            updateVectorizationLorebookUi();
        });

        document.getElementById('ss-rag-clear-reranker-key')?.addEventListener('click', async () => {
            const confirm = await showSsConfirm(
                'Clear Re-ranker API Key',
                'Remove the stored re-ranker API key from secure storage?',
            );
            if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
                return;
            }

            const deleted = await clearRagRerankerApiKey(buildSecretSettingsView());
            pendingRerankerKey = '';
            if (rerankerKeyInput) {
                rerankerKeyInput.value = '';
            }
            saveSettings(settings);
            await refreshRerankerKeyStatus();
            if (deleted) {
                toastr.success('Stored re-ranker API key cleared');
            } else {
                toastr.warning('Could not confirm key deletion. Check server logs/settings.');
            }
        });

        document.getElementById('ss-rag-refresh-health')?.addEventListener('click', async () => {
            const draft = readRagDraft(liveDraft, isSharder);
            await runStatusChecks(draft);
        });

        document.getElementById('ss-rag-test-embedding')?.addEventListener('click', async () => {
            const btn = document.getElementById('ss-rag-test-embedding');
            const statusEl = document.getElementById('ss-rag-embedding-test-status');
            if (btn) btn.disabled = true;
            if (statusEl) {
                statusEl.textContent = 'Embedding source test: running...';
            }

            try {
                const draft = readRagDraft(liveDraft, isSharder);
                const testApiKey = String(pendingEmbeddingKey || '').trim();
                const result = await testEmbeddingConnection(
                    draft,
                    'Connection test',
                    { apiKeyOverride: testApiKey },
                );
                if (result.success) {
                    const msg = `Embedding source test passed (dimensions: ${result.dimensions}).`;
                    if (statusEl) statusEl.textContent = msg;
                    toastr.success(msg);
                } else {
                    const msg = 'Embedding source test failed (no embedding vector returned).';
                    if (statusEl) statusEl.textContent = msg;
                    toastr.error(msg);
                }
            } catch (error) {
                const msg = `Embedding source test failed: ${error?.message || error}`;
                if (statusEl) statusEl.textContent = msg;
                toastr.error(msg);
            } finally {
                if (btn) btn.disabled = false;
            }
        });

        document.getElementById('ss-rag-test-reranker')?.addEventListener('click', async () => {
            const btn = document.getElementById('ss-rag-test-reranker');
            const statusEl = document.getElementById('ss-rag-reranker-test-status');
            if (btn) btn.disabled = true;
            if (statusEl) {
                statusEl.textContent = 'Re-ranker test: running...';
            }

            try {
                const draft = readRagDraft(liveDraft, isSharder);
                const testApiKey = String(pendingRerankerKey || '').trim();
                const result = await testRerankerConnection(
                    draft,
                    { apiKeyOverride: testApiKey },
                );
                const modeText = String(result.mode || 'similharity');
                const targetText = String(result.target || '').trim() || '(default)';
                const detail = `${result.message} mode=${modeText}; target=${targetText}`;
                if (statusEl) {
                    statusEl.textContent = `Re-ranker test: ${detail}`;
                }
                if (result.success) {
                    toastr.success(detail);
                } else {
                    toastr.error(detail);
                }
            } catch (error) {
                const msg = `Re-ranker test failed: ${error?.message || error}`;
                if (statusEl) {
                    statusEl.textContent = msg;
                }
                toastr.error(msg);
            } finally {
                if (btn) btn.disabled = false;
            }
        });

        document.getElementById('ss-rag-clear-embedding-key')?.addEventListener('click', async () => {
            const confirm = await showSsConfirm(
                'Clear Embedding API Key',
                'Remove the stored embedding API key from secure storage?'
            );
            if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
                return;
            }

            const deleted = await clearRagEmbeddingApiKey(buildSecretSettingsView());
            pendingEmbeddingKey = '';
            if (embeddingKeyInput) {
                embeddingKeyInput.value = '';
            }
            saveSettings(settings);
            await refreshEmbeddingKeyStatus();
            if (deleted) {
                toastr.success('Stored embedding API key cleared');
            } else {
                toastr.warning('Could not confirm key deletion. Check server logs/settings.');
            }
        });

        document.getElementById('ss-rag-init-backend')?.addEventListener('click', async () => {
            const draft = readRagDraft(liveDraft, isSharder);
            const backend = draft.backend;
            const useQdrantCloud = draft.backendConfig.qdrantUseCloud === true;
            const qdrantAddress = String(draft.backendConfig.qdrantAddress || '').trim();
            let qdrantHost = 'localhost';
            let qdrantPort = 6333;
            if (qdrantAddress) {
                const match = qdrantAddress.match(/^(.*):(\d+)$/);
                if (match) {
                    qdrantHost = String(match[1] || 'localhost').trim() || 'localhost';
                    qdrantPort = Math.max(1, toInt(match[2], 6333));
                } else {
                    qdrantHost = qdrantAddress;
                }
            }
            const cfg = {
                host: qdrantHost,
                port: qdrantPort,
                apiKey: draft.backendConfig.qdrantApiKey,
                url: useQdrantCloud ? draft.backendConfig.qdrantUrl : '',
                address: draft.backendConfig.milvusAddress,
                token: draft.backendConfig.milvusToken,
            };

            try {
                const result = await initBackend(backend, cfg);
                if (result.success) {
                    toastr.success(`${backend} initialized`);
                } else {
                    toastr.warning(result.message || `${backend} initialization returned no success status`);
                }
            } catch (error) {
                toastr.error(`Backend initialization failed: ${error?.message || error}`);
            }

            await runStatusChecks(draft);
        });

        document.getElementById('ss-rag-vectorize-all')?.addEventListener('click', async () => {
            if (!collectionId) {
                toastr.warning('Open a chat first to vectorize');
                return;
            }
            const draft = readRagDraft(liveDraft, isSharder);

            try {
                let result;
                if (isSharder) {
                    const temporarySettings = { ...settings, rag: draft };
                    result = await vectorizeAllShardsByMode(temporarySettings);
                    if (result.mode === 'section') {
                        const fallbackInfo = (result.sectionFallbackToStandard || 0) > 0
                            ? `, fallback=${result.sectionFallbackToStandard}`
                            : '';
                        toastr.success(`Section-aware vectorization: +${result.inserted}, -${result.deleted}, shards=${result.total}${fallbackInfo}`);
                    } else {
                        toastr.success(`Vectorized shards: +${result.inserted} (total discovered: ${result.total})`);
                    }
                } else {
                    const temporarySettings = { ...settings, ragStandard: draft };
                    result = await vectorizeAllStandardSummaries(temporarySettings);
                    toastr.success(`Vectorized standard summaries: +${result.inserted} (total discovered: ${result.total})`);
                }
            } catch (error) {
                toastr.error(`Vectorization failed: ${error?.message || error}`);
            }

            await updateStats(draft, collectionId);
        });

        document.getElementById('ss-rag-purge-all')?.addEventListener('click', async () => {
            if (!collectionId) {
                toastr.warning('Open a chat first to purge vectors');
                return;
            }
            const confirm = await showSsConfirm(
                'Purge All Vectors',
                'Delete all Summary Sharder vectors for this chat? This cannot be undone.'
            );

            if (confirm !== POPUP_RESULT.AFFIRMATIVE) {
                return;
            }

            const draft = readRagDraft(liveDraft, isSharder);

            try {
                await purgeCollection(collectionId, draft);
                toastr.success('All vectors purged for this chat');
            } catch (error) {
                toastr.error(`Purge failed: ${error?.message || error}`);
            }

            await updateStats(draft, collectionId);
        });

        document.getElementById('ss-rag-open-browser')?.addEventListener('click', async () => {
            const browserSettings = {
                ...settings,
                rag: { ...(settings.rag || {}) },
                ragStandard: { ...(settings.ragStandard || {}) },
            };
            applyRagSettings(browserSettings, readRagDraft(liveDraft, isSharder), ragBlockKey);
            await openRagBrowserModal(browserSettings);
            if (collectionId) await updateStats(readRagDraft(liveDraft, isSharder), collectionId);
        });

        document.getElementById('ss-rag-open-debug')?.addEventListener('click', async () => {
            const draft = readRagDraft(liveDraft, isSharder);
            await openRagDebugModal(draft);
            if (collectionId) await updateStats(readRagDraft(liveDraft, isSharder), collectionId);
        });
    });

    const result = await showPromise;
    if (result !== POPUP_RESULT.AFFIRMATIVE) {
        return;
    }

    const saved = liveDraft;
    applyRagSettings(settings, saved, ragBlockKey);
    const secretSettings = buildSecretSettingsView();

    const newEmbeddingKey = String(pendingEmbeddingKey || '').trim();
    if (newEmbeddingKey) {
        const stored = await storeRagEmbeddingApiKey(secretSettings, newEmbeddingKey);
        if (!stored) {
            toastr.error('Failed to store embedding API key securely');
            return;
        }
    }

    const newRerankerKey = String(pendingRerankerKey || '').trim();
    if (newRerankerKey) {
        const stored = await storeRagRerankerApiKey(secretSettings, newRerankerKey);
        if (!stored) {
            toastr.error('Failed to store re-ranker API key securely');
            return;
        }
    }

    saveSettings(settings);
    toastr.success(`RAG settings saved (${isSharder ? 'Sharder Mode' : 'Standard Mode'})`);
}

