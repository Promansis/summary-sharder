/**
 * Collection Manager Modal
 * UI for assigning multiple collections to characters and chats.
 *
 * Architecture:
 *  - Character tab: bind extra collections to every chat with this character.
 *  - Chat tab: bind extra collections for this specific chat, overriding character-level.
 *    The chat tab shows character-level bindings as grayed-out "inherited" rows so the
 *    user knows what they would be replacing.
 */

import { Popup, POPUP_TYPE } from '../../../../../../popup.js';
import { getThumbnailUrl } from '../../../../../../../script.js';
import { extension_settings } from '../../../../../../extensions.js';
import {
    getCharacterBinding,
    getChatBinding,
    setCharacterBinding,
    setChatBinding,
    listAllCollections,
} from '../../../core/rag/index.js';
import { saveSettings } from '../../../core/settings.js';
import { ragLog } from '../../../core/logger.js';

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
// Row renderers
// ---------------------------------------------------------------------------

/**
 * Render an editable collection row (with primary radio + remove button).
 */
function renderCollectionRow(collectionId, primaryCollection, chunkCount, radioGroup) {
    const isPrimary = collectionId === primaryCollection;
    const chunksText = typeof chunkCount === 'number' ? `${chunkCount} chunks` : '';
    return `
        <div class="ss-cm-row" data-collection-id="${escapeHtml(collectionId)}">
            <label class="ss-cm-primary-label" title="Set as primary (new vectors are written here)">
                <input type="radio"
                    name="${escapeHtml(radioGroup)}"
                    value="${escapeHtml(collectionId)}"
                    class="ss-cm-primary-radio"
                    ${isPrimary ? 'checked' : ''} />
                Primary
            </label>
            <span class="ss-cm-row-id" title="${escapeHtml(collectionId)}">${escapeHtml(truncate(collectionId))}</span>
            <span class="ss-cm-row-chunks">${escapeHtml(chunksText)}</span>
            <button class="ss-cm-row-remove menu_button" type="button" title="Remove this binding">&times;</button>
        </div>
    `;
}

/**
 * Render a read-only "inherited" collection row (grayed out, from character level).
 */
function renderInheritedRow(collectionId, chunkCount, isPrimary) {
    const chunksText = typeof chunkCount === 'number' ? `${chunkCount} chunks` : '';
    const primaryBadge = isPrimary ? '<span class="ss-cm-inherited-primary-badge">primary</span>' : '';
    return `
        <div class="ss-cm-row ss-cm-inherited-row" title="Inherited from character-level binding (read-only)">
            <span class="ss-cm-inherited-badge">inherited</span>
            <span class="ss-cm-row-id" title="${escapeHtml(collectionId)}">${escapeHtml(truncate(collectionId))}</span>
            <span class="ss-cm-row-chunks">${escapeHtml(chunksText)} ${primaryBadge}</span>
        </div>
    `;
}

function renderEmptyList(message) {
    return `<div class="ss-cm-empty">${escapeHtml(message)}</div>`;
}

// ---------------------------------------------------------------------------
// Modal HTML
// ---------------------------------------------------------------------------

function buildModalHtml(ctx) {
    const {
        charName, charAvatar, currentChatId, isSharder,
        charBinding,  // existing character-level binding (or null)
    } = ctx;
    const modeClass = isSharder ? 'ss-rag-mode-sharder' : 'ss-rag-mode-standard';
    const modeLabel = isSharder ? 'Sharder' : 'Standard';
    const hasChar = !!charName;
    const hasChat = !!currentChatId;

    // Always render the inherited section container so updateChatInheritedDisplay()
    // can populate it dynamically — even when there are no bindings at modal open.
    const inheritedSectionHtml = hasChar
        ? `<div class="ss-cm-inherited-section">
                <div class="ss-cm-section-header">
                    <div class="ss-cm-list-label">
                        <i class="fa-solid fa-user ss-cm-section-icon"></i>
                        Character-level (inherited)
                    </div>
                    <button id="ss-cm-copy-inherited-btn" class="menu_button ss-cm-copy-btn" type="button"
                        title="Copy these into the chat-level binding so you can customise them"
                        style="display:none">
                        <i class="fa-solid fa-copy"></i> Copy to chat
                    </button>
                </div>
                <div id="ss-cm-char-inherited-list" class="ss-cm-list ss-cm-inherited-list"></div>
                <p class="ss-hint ss-rag-inline-hint ss-cm-inherited-hint">
                    Active when no chat-level collections are set.
                    Adding chat-level collections below will override these.
                </p>
           </div>`
        : '';

    return `
        <div class="ss-collection-manager-modal">
            <h3 class="ss-rag-title">
                Collection Bindings
                <span class="ss-rag-mode-badge ${modeClass}">${escapeHtml(modeLabel)}</span>
            </h3>

            <div class="ss-cm-tabs">
                <button type="button" class="ss-cm-tab active" data-cm-tab="character">
                    <i class="fa-solid fa-user"></i> Character
                </button>
                <button type="button" class="ss-cm-tab" data-cm-tab="chat">
                    <i class="fa-solid fa-comment"></i> Chat
                </button>
            </div>

            <!-- Character panel -->
            <div class="ss-cm-panel active" data-cm-panel="character">
                ${hasChar
                    ? `<div class="ss-cm-context-row">
                            ${charAvatar ? `<img class="ss-cm-context-avatar" src="${escapeHtml(charAvatar)}" alt="" />` : ''}
                            <span class="ss-cm-context-name">${escapeHtml(charName)}</span>
                        </div>`
                    : `<p class="ss-hint ss-rag-inline-hint">No character active. Open a chat to manage character bindings.</p>`
                }
                <p class="ss-hint ss-rag-inline-hint">Collections here apply to every chat with this character, unless overridden per-chat.</p>
                <div class="ss-cm-list-label">Linked Collections</div>
                <div id="ss-cm-char-list" class="ss-cm-list"></div>
                ${hasChar
                    ? `<div class="ss-cm-add-row">
                            <select id="ss-cm-char-add-select" class="text_pole ss-cm-add-select">
                                <option value="">Add a collection&hellip;</option>
                            </select>
                            <button id="ss-cm-char-add-btn" class="menu_button" type="button">Add</button>
                        </div>`
                    : ''
                }
            </div>

            <!-- Chat panel -->
            <div class="ss-cm-panel" data-cm-panel="chat">
                ${hasChat
                    ? `<div class="ss-cm-context-row">
                            <i class="fa-solid fa-comment ss-cm-chat-icon"></i>
                            <span class="ss-cm-context-name">${escapeHtml(currentChatId)}</span>
                        </div>`
                    : `<p class="ss-hint ss-rag-inline-hint">No chat active.</p>`
                }

                ${inheritedSectionHtml}

                <div class="ss-cm-section-header">
                    <div class="ss-cm-list-label">
                        <i class="fa-solid fa-comment-dots ss-cm-section-icon"></i>
                        Chat-level (overrides character)
                    </div>
                </div>
                <p class="ss-hint ss-rag-inline-hint">Chat-level bindings replace character-level bindings for this chat only.</p>
                <div id="ss-cm-chat-list" class="ss-cm-list"></div>
                ${hasChat
                    ? `<div class="ss-cm-add-row">
                            <select id="ss-cm-chat-add-select" class="text_pole ss-cm-add-select">
                                <option value="">Add a collection&hellip;</option>
                            </select>
                            <button id="ss-cm-chat-add-btn" class="menu_button" type="button">Add</button>
                        </div>`
                    : ''
                }
            </div>

            <div class="ss-cm-footer">
                <button id="ss-cm-save" class="menu_button" type="button">
                    <i class="fa-solid fa-floppy-disk"></i> Save Changes
                </button>
            </div>
        </div>
    `;
}

// ---------------------------------------------------------------------------
// Modal entry point
// ---------------------------------------------------------------------------

/**
 * Open the Collection Manager modal.
 * @param {Object} settings - Extension settings (extension_settings.summary_sharder)
 */
export async function openCollectionManagerModal(settings) {
    const ctx = SillyTavern.getContext();
    const charIdx = ctx?.characterId;
    const char = (charIdx !== undefined && charIdx !== null) ? ctx?.characters?.[charIdx] : null;
    const charName = char?.name ?? null;
    const charAvatar = char?.avatar ? getThumbnailUrl('avatar', char.avatar) : null;
    const charAvatarKey = char?.avatar ?? null;
    const currentChatId = normalizeChatId(ctx?.chatId ?? '');
    const isSharder = settings?.sharderMode === true;

    // Load existing bindings into editable drafts
    const ss = extension_settings?.summary_sharder;
    const existingCharBinding = charAvatarKey ? getCharacterBinding(charAvatarKey, ss) : null;
    const existingChatBinding = currentChatId ? getChatBinding(currentChatId, ss) : null;

    const charDraft = {
        collections: existingCharBinding ? [...existingCharBinding.collections] : [],
        primaryCollection: existingCharBinding?.primaryCollection ?? '',
    };
    const chatDraft = {
        collections: existingChatBinding ? [...existingChatBinding.collections] : [],
        primaryCollection: existingChatBinding?.primaryCollection ?? '',
    };

    // Fetch all available collections from the backend
    let allCollections = [];
    const rag = isSharder ? settings?.rag : settings?.ragStandard;
    const currentBackend = String(rag?.backend || 'vectra').toLowerCase();

    try {
        const fetched = await listAllCollections(currentBackend);
        // Filter to only collections from current backend (in case plugin returns cross-backend results)
        allCollections = Array.isArray(fetched)
            ? fetched.filter(c => String(c.backend || 'vectra').toLowerCase() === currentBackend)
            : [];
    } catch (error) {
        ragLog.warn('Collection manager: failed to list collections:', error?.message);
    }

    const chunkCountMap = new Map(allCollections.map(c => [String(c.id), c.chunkCount ?? 0]));

    // Build and show modal
    const popup = new Popup(
        buildModalHtml({
            charName,
            charAvatar,
            currentChatId,
            isSharder,
            charBinding: existingCharBinding,
        }),
        POPUP_TYPE.TEXT,
        null,
        { okButton: 'Close', cancelButton: false, wide: true },
    );
    const showPromise = popup.show();

    requestAnimationFrame(() => {
        const root = document.querySelector('.ss-collection-manager-modal');
        if (!root) return;

        // ── Tab switching ────────────────────────────────────────────────────
        function switchTab(tabId) {
            for (const t of root.querySelectorAll('.ss-cm-tab')) {
                t.classList.toggle('active', t.getAttribute('data-cm-tab') === tabId);
            }
            for (const p of root.querySelectorAll('.ss-cm-panel')) {
                p.classList.toggle('active', p.getAttribute('data-cm-panel') === tabId);
            }
        }
        for (const tab of root.querySelectorAll('.ss-cm-tab')) {
            tab.addEventListener('click', () => switchTab(tab.getAttribute('data-cm-tab')));
        }

        // ── Helper: Update inherited display in Chat tab when char draft changes ──
        const updateChatInheritedDisplay = () => {
            const inheritedList = root.querySelector('#ss-cm-char-inherited-list');
            const copyBtn = root.querySelector('#ss-cm-copy-inherited-btn');
            if (!inheritedList) return;

            if (charDraft.collections.length === 0) {
                inheritedList.innerHTML = '<div class="ss-cm-empty">No character-level collections. Add some in the Character tab.</div>';
                if (copyBtn) copyBtn.style.display = 'none';
            } else {
                inheritedList.innerHTML = charDraft.collections
                    .map(id => renderInheritedRow(id, chunkCountMap.get(id), id === charDraft.primaryCollection))
                    .join('');
                if (copyBtn) copyBtn.style.display = '';
            }
        };

        // ── Character panel ──────────────────────────────────────────────────
        const charList = root.querySelector('#ss-cm-char-list');
        const charAddSelect = root.querySelector('#ss-cm-char-add-select');
        const charAddBtn = root.querySelector('#ss-cm-char-add-btn');

        function renderCharList() {
            if (!charList) return;
            if (charDraft.collections.length === 0) {
                charList.innerHTML = renderEmptyList('No collections linked to this character. Add one below.');
                return;
            }
            charList.innerHTML = charDraft.collections
                .map(id => renderCollectionRow(id, charDraft.primaryCollection, chunkCountMap.get(id), 'ss-cm-char-primary'))
                .join('');

            for (const btn of charList.querySelectorAll('.ss-cm-row-remove')) {
                btn.addEventListener('click', () => {
                    const id = btn.closest('.ss-cm-row')?.getAttribute('data-collection-id');
                    if (!id) return;
                    charDraft.collections = charDraft.collections.filter(c => c !== id);
                    if (charDraft.primaryCollection === id) {
                        charDraft.primaryCollection = charDraft.collections[0] ?? '';
                    }
                    renderCharList();
                    renderCharAddSelect();
                    updateChatInheritedDisplay();  // Update Chat tab in real-time
                });
            }
            for (const radio of charList.querySelectorAll('.ss-cm-primary-radio')) {
                radio.addEventListener('change', () => {
                    if (radio.checked) {
                        charDraft.primaryCollection = radio.value;
                        updateChatInheritedDisplay();
                    }
                });
            }
        }

        function renderCharAddSelect() {
            if (!charAddSelect) return;
            const bound = new Set(charDraft.collections);
            const options = allCollections.filter(c => !bound.has(c.id));
            charAddSelect.innerHTML = '<option value="">Add a collection\u2026</option>'
                + options.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(truncate(c.id, 52))} (${c.chunkCount ?? 0})</option>`).join('');
        }

        charAddBtn?.addEventListener('click', () => {
            const id = charAddSelect?.value;
            if (!id || charDraft.collections.includes(id)) return;
            charDraft.collections.push(id);
            if (!charDraft.primaryCollection) charDraft.primaryCollection = id;
            if (charAddSelect) charAddSelect.value = '';
            renderCharList();
            renderCharAddSelect();
            updateChatInheritedDisplay();  // Update Chat tab in real-time
        });

        // ── Chat panel ───────────────────────────────────────────────────────
        const chatList = root.querySelector('#ss-cm-chat-list');
        const chatAddSelect = root.querySelector('#ss-cm-chat-add-select');
        const chatAddBtn = root.querySelector('#ss-cm-chat-add-btn');
        const copyInheritedBtn = root.querySelector('#ss-cm-copy-inherited-btn');

        function renderChatList() {
            if (!chatList) return;
            if (chatDraft.collections.length === 0) {
                chatList.innerHTML = renderEmptyList('No chat-level collections. Add one below, or keep empty to use character-level bindings.');
                return;
            }
            chatList.innerHTML = chatDraft.collections
                .map(id => renderCollectionRow(id, chatDraft.primaryCollection, chunkCountMap.get(id), 'ss-cm-chat-primary'))
                .join('');

            for (const btn of chatList.querySelectorAll('.ss-cm-row-remove')) {
                btn.addEventListener('click', () => {
                    const id = btn.closest('.ss-cm-row')?.getAttribute('data-collection-id');
                    if (!id) return;
                    chatDraft.collections = chatDraft.collections.filter(c => c !== id);
                    if (chatDraft.primaryCollection === id) {
                        chatDraft.primaryCollection = chatDraft.collections[0] ?? '';
                    }
                    renderChatList();
                    renderChatAddSelect();
                });
            }
            for (const radio of chatList.querySelectorAll('.ss-cm-primary-radio')) {
                radio.addEventListener('change', () => {
                    if (radio.checked) chatDraft.primaryCollection = radio.value;
                });
            }
        }

        function renderChatAddSelect() {
            if (!chatAddSelect) return;
            const bound = new Set(chatDraft.collections);
            const options = allCollections.filter(c => !bound.has(c.id));
            chatAddSelect.innerHTML = '<option value="">Add a collection\u2026</option>'
                + options.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(truncate(c.id, 52))} (${c.chunkCount ?? 0})</option>`).join('');
        }

        chatAddBtn?.addEventListener('click', () => {
            const id = chatAddSelect?.value;
            if (!id || chatDraft.collections.includes(id)) return;
            chatDraft.collections.push(id);
            if (!chatDraft.primaryCollection) chatDraft.primaryCollection = id;
            if (chatAddSelect) chatAddSelect.value = '';
            renderChatList();
            renderChatAddSelect();
        });

        // "Copy inherited to chat" — pre-fills chat draft with character-level collections
        copyInheritedBtn?.addEventListener('click', () => {
            if (!existingCharBinding || existingCharBinding.collections.length === 0) return;
            let added = 0;
            for (const id of existingCharBinding.collections) {
                if (!chatDraft.collections.includes(id)) {
                    chatDraft.collections.push(id);
                    added++;
                }
            }
            if (!chatDraft.primaryCollection) {
                chatDraft.primaryCollection = existingCharBinding.primaryCollection || chatDraft.collections[0] || '';
            }
            if (added > 0) {
                toastr.info(`Copied ${added} collection${added !== 1 ? 's' : ''} from character level — click Save to apply`);
            }
            renderChatList();
            renderChatAddSelect();
        });

        // ── Save ──────────────────────────────────────────────────────────────
        const saveBtn = root.querySelector('#ss-cm-save');
        saveBtn?.addEventListener('click', () => {
            const liveSettings = extension_settings?.summary_sharder;

            if (charAvatarKey) {
                if (charDraft.collections.length > 0) {
                    setCharacterBinding(charAvatarKey, {
                        collections: charDraft.collections,
                        primaryCollection: charDraft.primaryCollection || charDraft.collections[0],
                    }, liveSettings);
                } else {
                    setCharacterBinding(charAvatarKey, null, liveSettings);
                }
            }

            if (currentChatId) {
                if (chatDraft.collections.length > 0) {
                    setChatBinding(currentChatId, {
                        collections: chatDraft.collections,
                        primaryCollection: chatDraft.primaryCollection || chatDraft.collections[0],
                        includeOwn: true,
                    }, liveSettings);
                } else {
                    setChatBinding(currentChatId, null, liveSettings);
                }
            }

            saveSettings(settings);
            toastr.success('Collection bindings saved');
        });

        // Initial render
        renderCharList();
        renderCharAddSelect();
        renderChatList();
        renderChatAddSelect();
        updateChatInheritedDisplay();
    });

    await showPromise;
}
