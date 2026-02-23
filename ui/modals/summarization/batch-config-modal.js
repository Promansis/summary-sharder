/**
 * Batch Sharder configuration modal.
 */

import { Popup, POPUP_RESULT, POPUP_TYPE } from '../../../../../../popup.js';
import { parseRanges } from '../../../core/processing/utils.js';
import { splitRange } from '../../../core/processing/range-splitter.js';
import { createSegmentedToggle } from '../../common/index.js';

const DEFAULTS = {
    rangeMode: 'auto',
    autoRange: '0-100',
    chunkSize: 25,
    tokenBudget: 0,
    manualRanges: '0-25, 26-50, 51-75',
    reviewMode: 'always',
};

function parseBatchConfig(captured, messages, maxIndex) {
    const rangeMode = captured.rangeMode === 'manual' ? 'manual' : 'auto';
    const reviewMode = ['never', 'errors', 'warnings', 'always'].includes(captured.reviewMode)
        ? captured.reviewMode
        : 'always';

    let ranges = [];

    if (rangeMode === 'auto') {
        const match = String(captured.autoRange || '').trim().match(/^(\d+)\s*-\s*(\d+)$/);
        if (!match) {
            throw new Error('Invalid total range format. Use start-end (e.g., 0-500)');
        }

        const start = parseInt(match[1], 10);
        const end = parseInt(match[2], 10);
        const chunkSize = Math.max(1, parseInt(captured.chunkSize, 10) || 0);
        const tokenBudget = Math.max(0, parseInt(captured.tokenBudget, 10) || 0);

        if (start > end) {
            throw new Error('Start index must be less than or equal to end index');
        }

        if (end > maxIndex) {
            throw new Error(`End index cannot exceed ${maxIndex}`);
        }

        ranges = splitRange(messages, start, end, chunkSize, tokenBudget);
    } else {
        ranges = parseRanges(captured.manualRanges, maxIndex);
    }

    if (!ranges.length) {
        throw new Error('No valid ranges were generated');
    }

    return {
        batchConfig: {
            rangeMode,
            reviewMode,
            chunkSize: Math.max(1, parseInt(captured.chunkSize, 10) || 1),
            tokenBudget: Math.max(0, parseInt(captured.tokenBudget, 10) || 0),
        },
        ranges,
    };
}

function buildModalHtml(initial, maxIndex) {
    return `
        <div class="ss-batch-config-modal">
            <h3>Batch Sharder</h3>
            <p class="ss-text-hint">Configure range splitting and review behavior for queued sharder processing.</p>

            <div class="ss-block">
                <label>Range Mode:</label>
                <div id="ss-batch-range-mode-host">
                    <div id="ss-batch-range-mode"></div>
                </div>
            </div>

            <div class="ss-block ss-batch-auto-fields ${initial.rangeMode === 'auto' ? '' : 'ss-hidden'}">
                <label for="ss-batch-auto-range">Total Range (0 to ${maxIndex}):</label>
                <input id="ss-batch-auto-range" type="text" class="text_pole" value="${initial.autoRange}" placeholder="0-500" />

                <label for="ss-batch-chunk-size" class="ss-batch-spaced-label">Chunk Size (messages):</label>
                <input id="ss-batch-chunk-size" type="number" class="text_pole" min="1" value="${initial.chunkSize}" />

                <label for="ss-batch-token-budget" class="ss-batch-spaced-label">Token Budget (optional, 0 = off):</label>
                <input id="ss-batch-token-budget" type="number" class="text_pole" min="0" value="${initial.tokenBudget}" />
            </div>

            <div class="ss-block ss-batch-manual-fields ${initial.rangeMode === 'manual' ? '' : 'ss-hidden'}">
                <label for="ss-batch-manual-ranges">Ranges:</label>
                <textarea id="ss-batch-manual-ranges" class="text_pole" rows="3" placeholder="0-50, 51-120, 121-200">${initial.manualRanges}</textarea>
            </div>

            <div class="ss-block">
                <label for="ss-batch-review-mode">Review Mode:</label>
                <select id="ss-batch-review-mode" class="text_pole">
                    <option value="never" ${initial.reviewMode === 'never' ? 'selected' : ''}>Never</option>
                    <option value="errors" ${initial.reviewMode === 'errors' ? 'selected' : ''}>On Errors</option>
                    <option value="warnings" ${initial.reviewMode === 'warnings' ? 'selected' : ''}>On Warnings</option>
                    <option value="always" ${initial.reviewMode === 'always' ? 'selected' : ''}>Always</option>
                </select>
            </div>
        </div>
    `;
}

/**
 * @param {Array} messages
 * @param {number} maxIndex
 * @param {Object} initialOverrides
 * @returns {Promise<{confirmed:boolean, batchConfig?:Object, ranges?:Array<{start:number,end:number}>}>}
 */
export async function openBatchConfigModal(messages, maxIndex, initialOverrides = {}) {
    const initial = {
        ...DEFAULTS,
        ...initialOverrides,
        autoRange: initialOverrides.autoRange || `0-${Math.min(100, maxIndex)}`,
    };

    let captured = {
        rangeMode: initial.rangeMode,
        autoRange: initial.autoRange,
        chunkSize: initial.chunkSize,
        tokenBudget: initial.tokenBudget,
        manualRanges: initial.manualRanges,
        reviewMode: initial.reviewMode,
    };

    const popup = new Popup(
        buildModalHtml(initial, maxIndex),
        POPUP_TYPE.TEXT,
        null,
        {
            okButton: 'Run Batch',
            cancelButton: 'Cancel',
            wide: true,
            onClosing: () => {
                const rangeModeControl = document.getElementById('ss-batch-range-mode');
                captured = {
                    rangeMode: rangeModeControl?.getValue?.()
                        || rangeModeControl?.dataset?.value
                        || 'auto',
                    autoRange: document.getElementById('ss-batch-auto-range')?.value || '',
                    chunkSize: document.getElementById('ss-batch-chunk-size')?.value || '25',
                    tokenBudget: document.getElementById('ss-batch-token-budget')?.value || '0',
                    manualRanges: document.getElementById('ss-batch-manual-ranges')?.value || '',
                    reviewMode: document.getElementById('ss-batch-review-mode')?.value || 'always',
                };
                return true;
            },
        }
    );

    const showPromise = popup.show();

    requestAnimationFrame(() => {
        const autoFields = document.querySelector('.ss-batch-auto-fields');
        const manualFields = document.querySelector('.ss-batch-manual-fields');
        const rangeModeHost = document.getElementById('ss-batch-range-mode-host');

        const applyRangeMode = (mode) => {
            captured.rangeMode = mode === 'manual' ? 'manual' : 'auto';
            autoFields?.classList.toggle('ss-hidden', captured.rangeMode !== 'auto');
            manualFields?.classList.toggle('ss-hidden', captured.rangeMode !== 'manual');
        };

        if (rangeModeHost) {
            const segmentedToggle = createSegmentedToggle({
                options: [
                    { value: 'auto', label: 'Auto-split' },
                    { value: 'manual', label: 'Manual ranges' }
                ],
                value: captured.rangeMode,
                onChange: (value) => applyRangeMode(value)
            });
            segmentedToggle.id = 'ss-batch-range-mode';
            rangeModeHost.replaceChildren(segmentedToggle);
        }

        applyRangeMode(captured.rangeMode);
    });

    const result = await showPromise;

    if (result !== POPUP_RESULT.AFFIRMATIVE) {
        return { confirmed: false };
    }

    try {
        const parsed = parseBatchConfig(captured, messages, maxIndex);
        return {
            confirmed: true,
            batchConfig: parsed.batchConfig,
            ranges: parsed.ranges,
        };
    } catch (error) {
        toastr.error(error.message);
        return await openBatchConfigModal(messages, maxIndex, captured);
    }
}
