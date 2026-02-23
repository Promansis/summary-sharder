// Re-export shim - preserves existing import paths
export {
    getThemes,
    THEMES,
    initializeThemes,
    applyTheme,
    getCurrentTheme,
    validateTheme,
    exportTheme,
    exportAllCustomThemes,
    importTheme,
    deleteTheme,
    duplicateTheme
} from './themes/theme-core.js';

export { openThemesModal, THEMES_MODAL_CSS } from './themes/themes-modal.js';
