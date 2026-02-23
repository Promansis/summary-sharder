/**
 * Shared mode resolution for UI displays.
 */

export function isSharderMode(settings) {
    return settings?.sharderMode === true;
}

export function getStatusMode(settings) {
    return isSharderMode(settings) ? 'sharder' : 'regular';
}

export function getStatusModeLabel(settings) {
    return isSharderMode(settings) ? 'Sharder' : 'Regular';
}

export function getPipelineLabel(settings) {
    if (!isSharderMode(settings)) {
        return 'Basic Summary';
    }

    return 'Sharder';
}

export function getActiveApiFeature(settings) {
    if (!isSharderMode(settings)) {
        return 'summary';
    }

    return 'sharder';
}

export function getActivePromptLabel(settings) {
    if (!isSharderMode(settings)) {
        return settings?.activePromptName || 'Default Prompt';
    }

    return 'Sharder';
}
