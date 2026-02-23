import { reloadEditor } from '../../../../../world-info.js';

/**
 * Refreshes the lorebook UI if the specified lorebook is currently open in the World Info editor.
 * This function should be called after successfully saving lorebook entries to ensure
 * the UI displays the newly added entries without requiring manual refresh.
 *
 * @param {string} lorebookName - Name of the lorebook to refresh
 */
export function refreshLorebookUI(lorebookName) {
    if (!lorebookName) {
        console.warn('[SummarySharder] Cannot refresh lorebook: name is null/undefined');
        return;
    }

    try {
        // reloadEditor only refreshes if the lorebook is currently selected
        reloadEditor(lorebookName, false);
        console.log(`[SummarySharder] Refreshed lorebook UI for: ${lorebookName}`);
    } catch (error) {
        console.error(`[SummarySharder] Failed to refresh lorebook UI for ${lorebookName}:`, error);
    }
}

/**
 * Refreshes the UI for multiple lorebooks.
 * Only refreshes the currently selected lorebook (if any) since reloadEditor checks internally.
 *
 * @param {string[]} lorebookNames - Array of lorebook names to refresh
 */
export function refreshMultipleLorebooksUI(lorebookNames) {
    if (!Array.isArray(lorebookNames) || lorebookNames.length === 0) {
        return;
    }

    // Only refresh if currently selected (reloadEditor checks this internally)
    for (const name of lorebookNames) {
        refreshLorebookUI(name);
    }
}
