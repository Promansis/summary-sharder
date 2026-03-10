import { extension_settings } from '../../../../extensions.js';

const PREFIX = '[SummarySharder]';

export function isDebugEnabled() {
    try {
        const settingsValue = extension_settings?.summary_sharder?.debugLogging;
        if (typeof settingsValue === 'boolean') {
            return settingsValue;
        }
        return localStorage.getItem('ss_debug') === 'true';
    } catch {
        return false;
    }
}

function makeLogger(tag) {
    const prefix = tag ? `[SummarySharder:${tag}]` : PREFIX;
    return {
        log: (...args) => console.log(prefix, ...args),
        warn: (...args) => console.warn(prefix, ...args),
        error: (...args) => console.error(prefix, ...args),
        debug: (...args) => {
            if (isDebugEnabled()) console.debug(prefix, ...args);
        },
    };
}

export const log = makeLogger();
export const ragLog = makeLogger('RAG');
export const archiveLog = makeLogger('RAG:Archive');
