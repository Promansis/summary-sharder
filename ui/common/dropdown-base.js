/**
 * Base Dropdown Component
 * Provides common dropdown functionality for all dropdown types
 */

import { escapeHtml } from './ui-utils.js';

/**
 * Base class for dropdown components with search
 */
export class BaseDropdown {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            onSelectionChange: () => {},
            placeholder: 'Select...',
            searchPlaceholder: 'Search...',
            containerClass: 'ss-dropdown-container',
            initialSelection: null,
            ...options
        };
        this.isOpen = false;
        this.searchTerm = '';
        this.boundHandleOutsideClick = this.handleOutsideClick.bind(this);
        this.boundCloseOnOtherOpen = this.closeOnOtherOpen.bind(this);
    }

    /**
     * Render the dropdown component
     * Should be called after construction to initialize the dropdown
     */
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.warn('[SummarySharder] Dropdown container not found:', this.containerId);
            return;
        }

        container.innerHTML = this.buildHTML();
        this.attachEventListeners();
    }

    /**
     * Build the complete HTML structure
     * Override getDisplayText() and buildOptions() in subclasses
     */
    buildHTML() {
        const displayText = this.getDisplayText();

        return `
            <div class="${this.options.containerClass}">
                <div class="ss-dropdown-trigger" id="${this.containerId}-trigger">
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
     * Override in subclass
     */
    getDisplayText() {
        return this.options.placeholder;
    }

    /**
     * Build options list HTML
     * Override in subclass
     */
    buildOptions() {
        return '<div class="ss-dropdown-empty">No options available</div>';
    }

    /**
     * Attach all event listeners
     */
    attachEventListeners() {
        // Trigger click - toggle dropdown
        const trigger = document.getElementById(`${this.containerId}-trigger`);
        trigger?.addEventListener('click', (e) => {
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

        // Option interactions - subclass should implement
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
     * Override in subclass to handle option selection
     */
    attachOptionListeners() {
        // Subclass should implement
    }

    /**
     * Handle clicks outside the dropdown
     */
    handleOutsideClick(e) {
        const container = document.getElementById(this.containerId);
        if (container && !container.contains(e.target)) {
            this.close();
        }
    }

    /**
     * Close this dropdown when another dropdown opens
     */
    closeOnOtherOpen(e) {
        if (e.detail.containerId !== this.containerId) {
            this.close();
        }
    }

    /**
     * Toggle dropdown open/closed
     */
    toggle() {
        this.isOpen = !this.isOpen;
        const menu = document.getElementById(`${this.containerId}-menu`);
        menu?.classList.toggle('open', this.isOpen);

        // Notify other dropdowns to close when this one opens
        if (this.isOpen) {
            this.open();
        }
    }

    /**
     * Open the dropdown
     */
    open() {
        this.isOpen = true;
        const menu = document.getElementById(`${this.containerId}-menu`);
        menu?.classList.add('open');

        // Notify other dropdowns to close
        document.dispatchEvent(new CustomEvent('ss-dropdown-opening', {
            detail: { containerId: this.containerId }
        }));

        // Focus search input
        const search = document.getElementById(`${this.containerId}-search`);
        search?.focus();
    }

    /**
     * Close the dropdown
     */
    close() {
        this.isOpen = false;
        const menu = document.getElementById(`${this.containerId}-menu`);
        menu?.classList.remove('open');
    }

    /**
     * Update the trigger text
     * Can be called after selection changes
     */
    updateTriggerText() {
        const trigger = document.getElementById(`${this.containerId}-trigger`);
        const textSpan = trigger?.querySelector('.ss-dropdown-selected-text');
        if (textSpan) {
            textSpan.textContent = this.getDisplayText();
        }
    }

    /**
     * Update the options display
     */
    updateOptions() {
        const optionsContainer = document.getElementById(`${this.containerId}-options`);
        if (optionsContainer) {
            optionsContainer.innerHTML = this.buildOptions();
        }
    }

    /**
     * Normalize a search query into lowercased non-empty terms.
     * @param {string} query
     * @returns {string[]}
     */
    getSearchTerms(query = this.searchTerm) {
        return String(query ?? '')
            .toLowerCase()
            .trim()
            .split(/\s+/)
            .filter(Boolean);
    }

    /**
     * Multi-term match: all query terms must appear in option text.
     * @param {string} text
     * @param {string} query
     * @returns {boolean}
     */
    matchesSearchQuery(text, query = this.searchTerm) {
        const terms = this.getSearchTerms(query);
        if (terms.length === 0) {
            return true;
        }

        const normalizedText = String(text ?? '').toLowerCase();
        return terms.every((term) => normalizedText.includes(term));
    }

    /**
     * Cleanup when component is destroyed
     */
    destroy() {
        document.removeEventListener('click', this.boundHandleOutsideClick);
        document.removeEventListener('ss-dropdown-opening', this.boundCloseOnOtherOpen);
    }
}
