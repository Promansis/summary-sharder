/**
 * Branch Collection Picker Modal
 *
 * Shown when a new branch chat is opened that has no RAG bindings.
 * Offers the user a chance to inherit (link) or skip collections from the parent chat.
 *
 * Detection logic lives in index.js (onChatChanged). This module only handles UI + saving.
 */

import { Popup, POPUP_TYPE } from '../../../../../../popup.js';
import { extension_settings } from '../../../../../../extensions.js';
import {
    resolveCollectionIds,
    getShardCollectionId,
    getStandardCollectionId,
    setChatBinding,
} from '../../../core/rag/index.js';
import { saveSettings } from '../../../core/settings.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    return v.length > max ? `${v.slice(0, max - 1)}\u2026` : v;
}

function normalizeChatId(chatId) {
    return String(chatId || '').trim().replace(/\.jsonl$/i, '').replace(/\.json$/i, '').trim();
}

// ---------------------------------------------------------------------------
// HTML builders
// ---------------------------------------------------------------------------

/**
 * Render a single collection row with Link/Skip radio buttons.
 * @param {string} collectionId
 * @param {boolean} isParentOwn - True when this is the parent's auto-generated collection
 * @returns {string}
 */
function buildCollectionRow(collectionId, isParentOwn) {
    const badge = isParentOwn
        ? '<span class="ss-bp-badge ss-bp-badge-own">parent\'s own</span>'
        : '';
    return `
        <div class="ss-bp-collection-row" data-collection-id="${escapeHtml(collectionId)}">
            <div class="ss-bp-row-header">
                <span class="ss-bp-row-id" title="${escapeHtml(collectionId)}">${escapeHtml(truncate(collectionId, 56))}</span>
                ${badge}
            </div>
            <div class="ss-bp-row-actions">
                <label class="ss-bp-action-label ss-bp-action-link">
                    <input type="radio" name="ss-bp-action-${escapeHtml(collectionId)}" value="link" checked />
                    Link
                    <span class="ss-bp-action-hint">shared read access</span>
                </label>
                <label class="ss-bp-action-label">
                    <input type="radio" name="ss-bp-action-${escapeHtml(collectionId)}" value="skip" />
                    Skip
                </label>
            </div>
        </div>
    `;
}

/**
 * Build the full modal HTML.
 * @param {string} parentChatId
 * @param {string[]} collectionIds - All parent collection IDs (resolved)
 * @param {string} parentOwnId - Parent's auto-generated collection ID
 * @returns {string}
 */
function buildModalHtml(parentChatId, collectionIds, parentOwnId) {
    const collectionRows = collectionIds
        .map(id => buildCollectionRow(id, id === parentOwnId))
        .join('');

    const primaryOptions = collectionIds
        .map(id => `<option value="${escapeHtml(id)}">${escapeHtml(truncate(id, 52))}</option>`)
        .join('');

    return `
        <div class="ss-branch-picker-modal">
            <h3 class="ss-rag-title">
                <i class="fa-solid fa-code-branch"></i>
                Collection Inheritance
            </h3>

            <p class="ss-hint ss-rag-inline-hint ss-bp-parent-hint">
                This chat branched from
                <strong class="ss-bp-parent-name" title="${escapeHtml(parentChatId)}">${escapeHtml(truncate(parentChatId, 48))}</strong>.
                Choose which parent collections to link to this branch.
                Linked collections are shared (read-only) — vectors go to the primary.
            </p>

            <div class="ss-bp-collections-list">
                ${collectionRows}
            </div>

            <div class="ss-bp-primary-row">
                <label class="ss-bp-primary-label" for="ss-bp-primary-select">
                    Write new vectors to:
                </label>
                <select id="ss-bp-primary-select" class="text_pole ss-bp-primary-select">
                    <option value="">This branch's own collection (default)</option>
                    ${primaryOptions}
                </select>
            </div>

            <label class="ss-bp-include-own-row">
                <input type="checkbox" id="ss-bp-include-own" checked />
                Also query this branch's own auto-generated collection
            </label>

            <div class="ss-bp-footer">
                <button id="ss-bp-apply" class="menu_button" type="button">
                    <i class="fa-solid fa-check"></i> Apply
                </button>
                <button id="ss-bp-skip-all" class="menu_button ss-bp-skip-btn" type="button">
                    Skip All
                </button>
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Show the Branch Collection Picker and, if the user applies, write a chat-level binding.
 *
 * Call this from index.js when a new branch is detected on CHAT_CHANGED.
 *
 * @param {string} branchChatId - The newly opened branch chat ID (normalized)
 * @param {string} parentChatId - The parent chat ID (from chat_metadata.main_chat)
 * @param {string|null} characterAvatar - Current character avatar key (e.g. "Alice.png")
 * @param {Object} settings - extension_settings.summary_sharder
 * @returns {Promise<void>}
 */
export async function showBranchCollectionPicker(branchChatId, parentChatId, characterAvatar, settings) {
    const ss = extension_settings?.summary_sharder;
    const isSharder = settings?.sharderMode === true;

    const normalizedParent = normalizeChatId(parentChatId);
    const normalizedBranch = normalizeChatId(branchChatId);

    if (!normalizedParent || !normalizedBranch) return;

    // Compute parent's own auto-generated collection ID
    let parentOwnId = '';
    try {
        parentOwnId = isSharder
            ? getShardCollectionId(normalizedParent)
            : getStandardCollectionId(normalizedParent);
    } catch { /* no parent */ }

    // Resolve all collection IDs the parent would query (bindings + own)
    const parentCollectionIds = resolveCollectionIds(normalizedParent, characterAvatar ?? '', ss, parentOwnId);

    if (parentCollectionIds.length === 0) {
        // Nothing to inherit — parent had no collections at all
        return;
    }

    const html = buildModalHtml(normalizedParent, parentCollectionIds, parentOwnId);

    const popup = new Popup(html, POPUP_TYPE.TEXT, null, {
        okButton: false,
        cancelButton: false,
        wide: false,
    });
    const showPromise = popup.show();

    requestAnimationFrame(() => {
        const root = document.querySelector('.ss-branch-picker-modal');
        if (!root) return;

        const applyBtn = root.querySelector('#ss-bp-apply');
        const skipAllBtn = root.querySelector('#ss-bp-skip-all');
        const primarySelect = root.querySelector('#ss-bp-primary-select');
        const includeOwnCheck = root.querySelector('#ss-bp-include-own');

        /** Returns IDs for all rows where the user chose "link". */
        function getLinkedIds() {
            const linked = [];
            for (const row of root.querySelectorAll('.ss-bp-collection-row')) {
                const id = row.getAttribute('data-collection-id');
                const checked = row.querySelector('input[type="radio"]:checked');
                if (id && checked?.value === 'link') linked.push(id);
            }
            return linked;
        }

        /** Rebuild the primary-select to only show currently linked collections. */
        function syncPrimarySelect() {
            const linked = getLinkedIds();
            const current = primarySelect.value;
            primarySelect.innerHTML =
                '<option value="">This branch\'s own collection (default)</option>' +
                linked
                    .map(id => `<option value="${escapeHtml(id)}">${escapeHtml(truncate(id, 52))}</option>`)
                    .join('');
            // Restore prior selection if still available
            if (linked.includes(current)) primarySelect.value = current;
        }

        for (const radio of root.querySelectorAll('.ss-bp-collection-row input[type="radio"]')) {
            radio.addEventListener('change', syncPrimarySelect);
        }

        applyBtn?.addEventListener('click', () => {
            const linked = getLinkedIds();
            if (linked.length === 0) {
                // Nothing linked — treat as skip
                popup.complete(null);
                return;
            }

            const primaryCollection = primarySelect?.value || '';
            const includeOwn = includeOwnCheck?.checked !== false;

            setChatBinding(normalizedBranch, {
                collections: linked,
                primaryCollection: primaryCollection || linked[0],
                includeOwn,
            }, ss);

            saveSettings(settings);
            toastr.success(
                `Linked ${linked.length} collection${linked.length !== 1 ? 's' : ''} to this branch`
            );
            popup.complete(null);
        });

        skipAllBtn?.addEventListener('click', () => {
            popup.complete(null);
        });
    });

    await showPromise;
}
