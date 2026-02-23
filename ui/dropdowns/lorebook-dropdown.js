/**
 * Custom Lorebook Dropdown Component
 * Provides multi-select with search and single-select behavior
 */

import { world_names } from '../../../../../world-info.js';
import { BaseDropdown } from '../common/dropdown-base.js';
import { escapeHtml } from '../common/ui-utils.js';

/**
 * Lorebook Dropdown class for custom multi-select with search
 */
export class LorebookDropdown extends BaseDropdown {
    constructor(containerId, options = {}) {
        super(containerId, {
            placeholder: 'Select lorebooks...',
            searchPlaceholder: 'Search lorebooks...',
            containerClass: 'ss-lorebook-dropdown-container',
            ...options
        });
        this.selectedBooks = new Set(this.options.initialSelection || []);
    }

    /**
     * Build the complete HTML structure (override for custom tag structure)
     */
    buildHTML() {
        return `
            <div class="${this.options.containerClass}">
                <div class="ss-selected-tags" id="${this.containerId}-tags">
                    ${this.buildSelectedTags()}
                </div>
                <div class="ss-dropdown-trigger" id="${this.containerId}-trigger">
                    <span>${this.options.placeholder}</span>
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
     * Build selected tags HTML
     */
    buildSelectedTags() {
        if (this.selectedBooks.size === 0) {
            return '<span style="color: var(--SmartThemeBodyColor); opacity: 0.6; font-size: 12px;">No lorebooks selected</span>';
        }

        return Array.from(this.selectedBooks).map(name => `
            <span class="ss-selected-tag" data-book="${escapeHtml(name)}">
                ${escapeHtml(name)}
                <span class="ss-tag-remove" data-book="${escapeHtml(name)}">&times;</span>
            </span>
        `).join('');
    }

    /**
     * Build options list HTML
     */
    buildOptions() {
        const books = this.getFilteredBooks();

        if (books.length === 0) {
            return '<div style="padding: 15px; text-align: center; color: var(--SmartThemeBodyColor); opacity: 0.6;">No lorebooks found</div>';
        }

        return books.map(name => `
            <div class="ss-dropdown-option" data-book="${escapeHtml(name)}">
                <span class="ss-option-name">${escapeHtml(name)}</span>
                <input type="checkbox" class="ss-option-checkbox"
                       data-book="${escapeHtml(name)}"
                       ${this.selectedBooks.has(name) ? 'checked' : ''} />
            </div>
        `).join('');
    }

    /**
     * Get filtered books based on search term
     */
    getFilteredBooks() {
        const allBooks = world_names || [];
        if (!this.searchTerm) return [...allBooks].sort();

        return allBooks.filter((name) => this.matchesSearchQuery(name)).sort();
    }

    /**
     * Override attachEventListeners to add tag listeners
     */
    attachEventListeners() {
        // Call parent to attach basic listeners
        super.attachEventListeners();

        // Add tag remove button listeners
        this.attachTagListeners();
    }

    /**
     * Attach event listeners to options (multi-select behavior)
     */
    attachOptionListeners() {
        const optionsContainer = document.getElementById(`${this.containerId}-options`);

        optionsContainer?.addEventListener('click', (e) => {
            const option = e.target.closest('.ss-dropdown-option');
            if (!option) return;

            const bookName = option.dataset.book;
            const checkbox = option.querySelector('.ss-option-checkbox');

            // If clicking on the checkbox itself
            if (e.target.classList.contains('ss-option-checkbox')) {
                e.stopPropagation();
                this.toggleSelection(bookName, checkbox.checked);
                // Keep dropdown open for multi-select
            } else {
                // Clicking anywhere else on the option = single select
                this.clearSelections();
                this.toggleSelection(bookName, true);
                this.close();
            }
        });
    }

    /**
     * Attach event listeners to tags
     */
    attachTagListeners() {
        const tagsContainer = document.getElementById(`${this.containerId}-tags`);

        tagsContainer?.addEventListener('click', (e) => {
            if (e.target.classList.contains('ss-tag-remove')) {
                e.stopPropagation();
                const bookName = e.target.dataset.book;
                this.toggleSelection(bookName, false);
            }
        });
    }

    /**
     * Toggle selection of a book
     */
    toggleSelection(bookName, selected) {
        if (selected) {
            this.selectedBooks.add(bookName);
        } else {
            this.selectedBooks.delete(bookName);
        }
        this.updateTags();
        this.updateOptions();
        this.options.onSelectionChange(this.getSelection());
    }

    /**
     * Clear all selections
     */
    clearSelections() {
        this.selectedBooks.clear();
    }

    /**
     * Update the tags display
     */
    updateTags() {
        const tagsContainer = document.getElementById(`${this.containerId}-tags`);
        if (tagsContainer) {
            tagsContainer.innerHTML = this.buildSelectedTags();
            this.attachTagListeners();
        }
    }

    /**
     * Get current selection as array
     */
    getSelection() {
        return Array.from(this.selectedBooks);
    }

    /**
     * Set selection programmatically
     */
    setSelection(bookNames) {
        this.selectedBooks = new Set(bookNames);
        this.updateTags();
        this.updateOptions();
    }

    /**
     * Clear selection (override parent)
     */
    clearSelection() {
        this.clearSelections();
        this.updateTags();
        this.updateOptions();
    }
}
