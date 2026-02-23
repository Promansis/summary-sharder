/**
 * Custom Chat Dropdown Component
 * Provides single-select with search functionality for character chats
 */

import { characters, getRequestHeaders } from '../../../../../../script.js';
import { BaseDropdown } from '../common/dropdown-base.js';
import { escapeHtml } from '../common/ui-utils.js';

/**
 * Chat Dropdown class for single-select with search
 */
export class ChatDropdown extends BaseDropdown {
    constructor(containerId, options = {}) {
        super(containerId, {
            placeholder: 'Select chat...',
            searchPlaceholder: 'Search chats...',
            containerClass: 'ss-chat-dropdown-container',
            ...options
        });
        this.selectedChatFile = this.options.initialSelection;
        this.characterId = null;
        this.chats = [];
        this.isLoading = false;
    }

    /**
     * Build the complete HTML structure (override to add disabled state)
     */
    buildHTML() {
        const isDisabled = this.characterId === null;
        const displayText = this.getDisplayText();

        return `
            <div class="${this.options.containerClass} ${isDisabled ? 'disabled' : ''}">
                <div class="ss-dropdown-trigger ${isDisabled ? 'disabled' : ''}" id="${this.containerId}-trigger">
                    <span class="ss-dropdown-selected-text">${escapeHtml(displayText)}</span>
                    <span class="fa-solid fa-chevron-down"></span>
                </div>
                <div class="ss-dropdown-menu" id="${this.containerId}-menu">
                    <div class="ss-dropdown-search">
                        <input type="text" placeholder="${this.options.searchPlaceholder}"
                               id="${this.containerId}-search" />
                    </div>
                    <div class="ss-dropdown-options" id="${this.containerId}-options">
                        ${this.buildOptions()}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get the display text for the trigger
     */
    getDisplayText() {
        const selectedChat = this.selectedChatFile ?
            this.chats.find(c => c.file_name === this.selectedChatFile) : null;
        return selectedChat ?
            selectedChat.file_name.replace('.jsonl', '') :
            this.options.placeholder;
    }

    /**
     * Build options list HTML
     */
    buildOptions() {
        if (this.isLoading) {
            return '<div class="ss-dropdown-empty">Loading chats...</div>';
        }

        if (this.characterId === null) {
            return '<div class="ss-dropdown-empty">Select a character first</div>';
        }

        const filteredChats = this.getFilteredChats();

        if (filteredChats.length === 0) {
            return '<div class="ss-dropdown-empty">No chats found</div>';
        }

        return filteredChats.map(chat => {
            const isSelected = chat.file_name === this.selectedChatFile;
            const chatName = chat.file_name.replace('.jsonl', '');
            const messageCount = chat.chat_items || 0;
            const fileSize = chat.file_size || '';

            return `
                <div class="ss-dropdown-option ${isSelected ? 'selected' : ''}" data-chat-file="${escapeHtml(chat.file_name)}">
                    <div class="ss-chat-option-info">
                        <span class="ss-chat-option-name">${escapeHtml(chatName)}</span>
                        <span class="ss-chat-option-details">${messageCount} messages • ${fileSize}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Get filtered chats based on search term
     */
    getFilteredChats() {
        if (!this.searchTerm) {
            return [...this.chats];
        }

        return this.chats.filter((chat) => this.matchesSearchQuery(chat.file_name));
    }

    /**
     * Override attachEventListeners to handle disabled state
     */
    attachEventListeners() {
        // Trigger click - toggle dropdown
        const trigger = document.getElementById(`${this.containerId}-trigger`);
        trigger?.addEventListener('click', (e) => {
            if (trigger.classList.contains('disabled')) return;
            e.stopPropagation();
            this.toggle();
        });

        // Search input
        const search = document.getElementById(`${this.containerId}-search`);
        search?.addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.updateOptions();
        });

        // Prevent search from closing dropdown
        search?.addEventListener('click', (e) => e.stopPropagation());

        // Option interactions
        this.attachOptionListeners();

        // Close on outside click
        document.removeEventListener('click', this.boundHandleOutsideClick);
        document.addEventListener('click', this.boundHandleOutsideClick);

        // Close when another dropdown opens
        document.removeEventListener('ss-dropdown-opening', this.boundCloseOnOtherOpen);
        document.addEventListener('ss-dropdown-opening', this.boundCloseOnOtherOpen);
    }

    /**
     * Attach event listeners to options
     */
    attachOptionListeners() {
        const optionsContainer = document.getElementById(`${this.containerId}-options`);

        optionsContainer?.addEventListener('click', (e) => {
            const option = e.target.closest('.ss-dropdown-option');
            if (!option) return;

            const chatFile = option.dataset.chatFile;
            this.selectChat(chatFile);
            this.close();
        });
    }

    /**
     * Override toggle to check character selection
     */
    toggle() {
        if (this.characterId === null) return;
        super.toggle();
    }

    /**
     * Load chats for a specific character
     */
    async loadChatsForCharacter(characterId) {
        this.characterId = characterId;
        this.selectedChatFile = null;
        this.chats = [];
        this.isLoading = true;
        this.render();

        if (characterId === null) {
            this.isLoading = false;
            this.render();
            return;
        }

        const character = characters[characterId];
        if (!character) {
            console.warn('[SummarySharder] Character not found:', characterId);
            this.isLoading = false;
            this.render();
            return;
        }

        try {
            const response = await fetch('/api/characters/chats', {
                method: 'POST',
                body: JSON.stringify({ avatar_url: character.avatar }),
                headers: getRequestHeaders(),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch chats');
            }

            const data = await response.json();
            if (typeof data === 'object' && data.error === true) {
                throw new Error('Error fetching chats');
            }

            this.chats = Object.values(data);
            // Sort by file name descending (most recent first typically)
            this.chats.sort((a, b) => b.file_name.localeCompare(a.file_name));
        } catch (error) {
            console.error('[SummarySharder] Error loading chats:', error);
            this.chats = [];
        }

        this.isLoading = false;
        this.render();
    }

    /**
     * Select a chat
     */
    selectChat(chatFile) {
        this.selectedChatFile = chatFile;
        this.updateTriggerText();
        this.updateOptions();
        this.options.onSelectionChange(chatFile);
    }

    /**
     * Get current selection
     */
    getSelection() {
        return this.selectedChatFile;
    }

    /**
     * Get selected chat metadata
     */
    getSelectedChatMetadata() {
        if (!this.selectedChatFile) return null;
        return this.chats.find(c => c.file_name === this.selectedChatFile) || null;
    }

    /**
     * Set selection programmatically
     */
    setSelection(chatFile) {
        this.selectedChatFile = chatFile;
        this.updateTriggerText();
        this.updateOptions();
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedChatFile = null;
        this.updateTriggerText();
        this.updateOptions();
    }

    /**
     * Get current character ID
     */
    getCharacterId() {
        return this.characterId;
    }

    /**
     * Get all loaded chats
     */
    getChats() {
        return [...this.chats];
    }
}
