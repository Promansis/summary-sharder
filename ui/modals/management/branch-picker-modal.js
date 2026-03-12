/**
 * Branch Collection Picker Modal
 *
 * Shown when a new branch chat opens and the parent has chat-specific collections
 * or private vectorized data worth carrying forward.
 */

import { Popup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../extensions.js';
import {
    getChatBinding,
    getCollectionStats,
    listAllCollections,
    getShardCollectionId,
    getStandardCollectionId,
    setChatBinding,
} from '../../../core/rag/index.js';
import { saveSettings } from '../../../core/settings.js';

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function truncate(text, max = 60) {
    const v = String(text || '').trim();
    return v.length > max ? `${v.slice(0, max - 1)}...` : v;
}

function normalizeChatId(chatId) {
    return String(chatId || '').trim().replace(/\.jsonl$/i, '').replace(/\.json$/i, '').trim();
}

function buildCollectionRow(option) {
    const collectionId = option?.id || '';
    const badges = Array.isArray(option?.badges) ? [...option.badges] : [];
    const chunkCount = Number.isFinite(option?.chunkCount) ? Number(option.chunkCount) : null;
    if (chunkCount === 0) {
        badges.push('<span class="ss-bp-badge ss-bp-badge-warning">0 chunks</span>');
    }

    const chunkLabel = chunkCount === null
        ? 'Chunk count unavailable'
        : `${chunkCount} chunk${chunkCount === 1 ? '' : 's'}`;
    return `
        <label class="ss-bp-collection-row">
            <input type="checkbox" class="ss-bp-link-check" data-collection-id="${escapeHtml(collectionId)}" checked />
            <div class="ss-bp-row-content">
                <div class="ss-bp-row-header">
                    <span class="ss-bp-row-id" title="${escapeHtml(collectionId)}">${escapeHtml(truncate(collectionId, 56))}</span>
                    ${badges.join('')}
                </div>
                <div class="ss-bp-row-meta">${escapeHtml(chunkLabel)}</div>
                <div class="ss-bp-action-hint">Add to branch reads.</div>
            </div>
        </label>
    `;
}

function buildModalHtml(parentChatId, options) {
    const rows = options.map(option => buildCollectionRow(option)).join('');
    return `
        <div class="ss-branch-picker-modal">
            <h3 class="ss-rag-title">
                <i class="fa-solid fa-code-branch"></i>
                Branch Collections
            </h3>

            <p class="ss-hint ss-rag-inline-hint ss-bp-parent-hint">
                Parent chat:
                <strong class="ss-bp-parent-name" title="${escapeHtml(parentChatId)}">${escapeHtml(truncate(parentChatId, 48))}</strong>.
                Character collections are inherited automatically.
            </p>

            <div class="ss-bp-migration-note ss-hint ss-rag-inline-hint">
                <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                <span>Select any parent-chat collections to add to this branch.</span>
            </div>

            <div class="ss-bp-section-title">Collections</div>
            <div id="ss-bp-selection-summary" class="ss-bp-selection-summary"></div>
            <div class="ss-bp-collections-list">
                ${rows}
            </div>

            <div class="ss-bp-primary-row">
                <label class="ss-bp-primary-label" for="ss-bp-write-target">
                    Write Target
                </label>
                <select id="ss-bp-write-target" class="text_pole ss-bp-primary-select"></select>
            </div>

            <div class="ss-bp-footer">
                <button id="ss-bp-apply" class="menu_button" type="button">
                    <i class="fa-solid fa-check"></i> Apply
                </button>
                <button id="ss-bp-skip-all" class="menu_button ss-bp-skip-btn" type="button">
                    Keep Defaults
                </button>
            </div>
        </div>
    `;
}

export async function showBranchCollectionPicker(branchChatId, parentChatId, characterAvatar, settings) {
    void characterAvatar;
    const ss = extension_settings?.summary_sharder;
    const isSharder = settings?.sharderMode === true;
    const ragSettings = isSharder ? settings?.rag : settings?.ragStandard;

    const normalizedParent = normalizeChatId(parentChatId);
    const normalizedBranch = normalizeChatId(branchChatId);
    if (!normalizedParent || !normalizedBranch) return;

    const parentChatBinding = getChatBinding(normalizedParent, ss);
    const parentOwnId = isSharder
        ? getShardCollectionId(normalizedParent)
        : getStandardCollectionId(normalizedParent);
    const currentBackend = String(ragSettings?.backend || 'vectra').toLowerCase();

    let parentOwnCount = 0;
    try {
        const { stats } = await getCollectionStats(parentOwnId, ragSettings);
        parentOwnCount = Number(stats?.count ?? stats?.total ?? 0) || 0;
    } catch {
        parentOwnCount = 0;
    }

    let allCollections = [];
    try {
        allCollections = await listAllCollections(currentBackend);
    } catch {
        allCollections = [];
    }

    const chunkCountMap = new Map(
        (Array.isArray(allCollections) ? allCollections : [])
            .filter(collection => String(collection?.backend || currentBackend).toLowerCase() === currentBackend)
            .map(collection => [String(collection.id), Number(collection.chunkCount ?? 0) || 0]),
    );

    const optionMap = new Map();
    const upsertOption = (id, badgeHtml) => {
        const key = String(id || '').trim();
        if (!key) return;

        if (!optionMap.has(key)) {
            optionMap.set(key, {
                id: key,
                badges: [],
                chunkCount: chunkCountMap.has(key) ? Number(chunkCountMap.get(key)) || 0 : null,
            });
        }

        const option = optionMap.get(key);
        if (badgeHtml && !option.badges.includes(badgeHtml)) {
            option.badges.push(badgeHtml);
        }
        if (key === parentOwnId) {
            option.chunkCount = parentOwnCount;
        }
    };

    for (const id of (parentChatBinding?.collections || [])) {
        upsertOption(id, '<span class="ss-bp-badge ss-bp-badge-chat">parent chat</span>');
    }
    if (parentChatBinding?.writeTarget && parentChatBinding.writeTarget !== parentOwnId) {
        upsertOption(parentChatBinding.writeTarget, '<span class="ss-bp-badge ss-bp-badge-chat">parent write target</span>');
    }
    if (parentOwnCount > 0) {
        upsertOption(parentOwnId, '<span class="ss-bp-badge ss-bp-badge-own">parent own</span>');
    }

    const uniqueOptions = [...optionMap.values()];

    const shouldOffer = uniqueOptions.length > 0;
    if (!shouldOffer) return;

    const popup = new Popup(buildModalHtml(normalizedParent, uniqueOptions), POPUP_TYPE.TEXT, null, {
        okButton: false,
        cancelButton: false,
        wide: false,
    });
    const showPromise = popup.show();

    requestAnimationFrame(() => {
        const root = document.querySelector('.ss-branch-picker-modal');
        if (!root) return;

        const selectionSummary = root.querySelector('#ss-bp-selection-summary');
        const writeTargetSelect = root.querySelector('#ss-bp-write-target');
        const applyBtn = root.querySelector('#ss-bp-apply');
        const skipBtn = root.querySelector('#ss-bp-skip-all');
        const optionsById = new Map(uniqueOptions.map(option => [option.id, option]));

        const getLinkedIds = () => {
            const out = [];
            for (const input of root.querySelectorAll('.ss-bp-link-check')) {
                if (input instanceof HTMLInputElement && input.checked) {
                    out.push(String(input.getAttribute('data-collection-id') || '').trim());
                }
            }
            return out.filter(Boolean);
        };

        const renderSelectionSummary = () => {
            if (!selectionSummary) return;

            const linkedIds = getLinkedIds();
            if (linkedIds.length === 0) {
                selectionSummary.innerHTML = '<div class="ss-cm-empty">No collections selected.</div>';
                return;
            }

            const zeroChunkIds = linkedIds.filter(id => optionsById.get(id)?.chunkCount === 0);
            const rows = linkedIds.map(id => {
                const option = optionsById.get(id);
                const chunkCount = Number.isFinite(option?.chunkCount) ? Number(option.chunkCount) : null;
                return `
                    <div class="ss-bp-summary-row">
                        <span class="ss-bp-summary-id" title="${escapeHtml(id)}">${escapeHtml(truncate(id, 62))}</span>
                        <span class="ss-bp-summary-meta">${escapeHtml(
                            chunkCount === null
                                ? 'Chunk count unavailable'
                                : `${chunkCount} chunk${chunkCount === 1 ? '' : 's'}`,
                        )}</span>
                    </div>
                `;
            }).join('');

            selectionSummary.innerHTML = `
                <div class="ss-bp-summary-card">
                    <div class="ss-bp-summary-title">Selected Collections</div>
                    <div class="ss-bp-summary-list">${rows}</div>
                    ${zeroChunkIds.length > 0
                        ? `
                            <div class="ss-bp-summary-warning">
                                <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                                <span>${escapeHtml(`${zeroChunkIds.length} selected collection${zeroChunkIds.length === 1 ? '' : 's'} have zero chunks.`)}</span>
                            </div>
                        `
                        : ''
                    }
                </div>
            `;
        };

        const renderWriteTargetOptions = () => {
            const linkedIds = getLinkedIds();
            writeTargetSelect.disabled = linkedIds.length === 0;
            writeTargetSelect.innerHTML = `
                <option value="">Own collection (default)</option>
                ${linkedIds.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(truncate(id, 52))}</option>`).join('')}
            `;
            const desired = String(parentChatBinding?.writeTarget || '').trim();
            if (desired && linkedIds.includes(desired)) {
                writeTargetSelect.value = desired;
            } else if (!linkedIds.includes(String(writeTargetSelect.value || '').trim())) {
                writeTargetSelect.value = '';
            }
        };

        for (const input of root.querySelectorAll('.ss-bp-link-check')) {
            input.addEventListener('change', () => {
                renderSelectionSummary();
                renderWriteTargetOptions();
            });
        }

        applyBtn?.addEventListener('click', () => {
            const linked = getLinkedIds();
            const writeTarget = String(writeTargetSelect?.value || '').trim();

            if (linked.length === 0 && !writeTarget) {
                popup.complete(null);
                return;
            }

            setChatBinding(normalizedBranch, {
                collections: linked,
                writeTarget,
            }, ss);

            if (!getChatBinding(normalizedBranch, ss)) {
                setChatBinding(normalizedBranch, null, ss);
            }

            saveSettings(settings);
            toastr.success('Branch collection settings applied');
            popup.complete(null);
        });

        skipBtn?.addEventListener('click', () => popup.complete(null));
        renderSelectionSummary();
        renderWriteTargetOptions();
    });

    await showPromise;
}
