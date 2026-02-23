/**
 * Custom Character Dropdown Component
 * Provides single-select with search functionality for characters
 */

import { characters, getThumbnailUrl } from '../../../../../../script.js';
import { BaseDropdown } from '../common/dropdown-base.js';
import { escapeHtml } from '../common/ui-utils.js';

/**
 * Character Dropdown class for single-select with search
 */
export class CharacterDropdown extends BaseDropdown {
    constructor(containerId, options = {}) {
        super(containerId, {
            placeholder: 'Select character...',
            searchPlaceholder: 'Search characters...',
            containerClass: 'ss-character-dropdown-container',
            ...options
        });
        this.selectedCharacterId = this.options.initialSelection;
    }

    /**
     * Get the display text for the trigger
     */
    getDisplayText() {
        const selectedChar = this.selectedCharacterId !== null ? characters[this.selectedCharacterId] : null;
        return selectedChar ? selectedChar.name : this.options.placeholder;
    }

    /**
     * Build options list HTML
     */
    buildOptions() {
        const filteredChars = this.getFilteredCharacters();

        if (filteredChars.length === 0) {
            return '<div class="ss-dropdown-empty">No characters found</div>';
        }

        return filteredChars.map(({ index, char }) => {
            const avatarUrl = getThumbnailUrl('avatar', char.avatar);
            const isSelected = index === this.selectedCharacterId;
            return `
                <div class="ss-dropdown-option ${isSelected ? 'selected' : ''}" data-character-id="${index}">
                    <img class="ss-dropdown-option-avatar" src="${avatarUrl}" alt="" />
                    <span class="ss-dropdown-option-name">${escapeHtml(char.name)}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Get filtered characters based on search term
     */
    getFilteredCharacters() {
        const allChars = [];
        for (let i = 0; i < characters.length; i++) {
            const char = characters[i];
            if (char && char.name) {
                allChars.push({ index: i, char });
            }
        }

        if (!this.searchTerm) {
            return allChars.sort((a, b) => a.char.name.localeCompare(b.char.name));
        }

        return allChars
            .filter(({ char }) => this.matchesSearchQuery(char.name))
            .sort((a, b) => a.char.name.localeCompare(b.char.name));
    }

    /**
     * Attach event listeners to options
     */
    attachOptionListeners() {
        const optionsContainer = document.getElementById(`${this.containerId}-options`);

        optionsContainer?.addEventListener('click', (e) => {
            const option = e.target.closest('.ss-dropdown-option');
            if (!option) return;

            const characterId = parseInt(option.dataset.characterId, 10);
            this.selectCharacter(characterId);
            this.close();
        });
    }

    /**
     * Select a character
     */
    selectCharacter(characterId) {
        this.selectedCharacterId = characterId;
        this.updateTriggerText();
        this.updateOptions();
        this.options.onSelectionChange(characterId);
    }

    /**
     * Get current selection
     */
    getSelection() {
        return this.selectedCharacterId;
    }

    /**
     * Set selection programmatically
     */
    setSelection(characterId) {
        this.selectedCharacterId = characterId;
        this.updateTriggerText();
        this.updateOptions();
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedCharacterId = null;
        this.updateTriggerText();
        this.updateOptions();
    }
}
