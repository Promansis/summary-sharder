/**
 * Queue orchestration for Summary Sharder
 */

import { captureRangeInsertionPoints } from '../processing/utils.js';
import { POPUP_RESULT } from '../../../../../popup.js';
import { getFeatureApiSettings } from './feature-api-config.js';
import { showSsConfirm } from '../../ui/common/modal-base.js';
import {
    createAbortController,
    clearAbortController
} from './abort-controller.js';
import { startUiOperation, updateUiOperation, endUiOperation } from './api-ui-helpers.js';
import { runSummarization } from './summary-api.js';

/**
 * Process multiple summarization ranges in a queue
 * @param {Array<{start: number, end: number}>} ranges - Array of ranges to process
 * @param {Object} settings - Extension settings
 */
export async function runSummarizationQueue(ranges, settings) {
    if (!ranges || ranges.length === 0) {
        toastr.warning('No ranges to process');
        return;
    }

    // Create abort controller for the entire queue
    createAbortController();
    const originalText = 'Summarize Now';
    const opId = startUiOperation({
        feature: 'summary',
        primaryButton: 'ss-run-summarize',
        disabled: true,
        label: null,
        lockButtons: [],
        showStop: true,
    });

    let progressToast = null;

    // Show progress toast for queue
    progressToast = toastr.info(
        `Starting batch summarization...`,
        `Processing 0/${ranges.length} ranges`,
        { timeOut: 0, extendedTimeOut: 0 }
    );

    const total = ranges.length;
    let completed = 0;
    const failed = [];

    // Capture insertion UIDs before any processing begins
    // This allows correct positioning even as earlier insertions shift indices
    const context = SillyTavern.getContext();
    const rangesWithUIDs = captureRangeInsertionPoints(ranges, context.chat);

    try {
        for (let i = 0; i < rangesWithUIDs.length; i++) {
            const range = rangesWithUIDs[i];
            const current = i + 1;

            // Update button with progress
            updateUiOperation({
                feature: 'summary',
                primaryButton: 'ss-run-summarize',
                disabled: true,
                label: `Summarizing ${current}/${total} (Messages ${range.start}-${range.end})...`,
                lockButtons: [],
                showStop: true,
                opId,
            });

            // Update progress toast
            if (progressToast) {
                toastr.clear(progressToast);
                progressToast = toastr.info(
                    `Processing messages ${range.start}-${range.end}...`,
                    `Summarizing ${current}/${total}`,
                    { timeOut: 0, extendedTimeOut: 0 }
                );
            }

            try {
                await runSummarization(range.start, range.end, settings, true, range.insertAfterUID);
                completed++;

                // Apply delay between API calls if configured (skip for last range)
                // Use per-feature queueDelayMs (in milliseconds)
                const effectiveSettings = await getFeatureApiSettings(settings, 'summary');
                const delayMs = effectiveSettings.queueDelayMs || 0;
                if (delayMs > 0 && i < rangesWithUIDs.length - 1) {
                    // Update toast to show delay
                    if (progressToast) {
                        toastr.clear(progressToast);
                        progressToast = toastr.info(
                            `Waiting ${delayMs}ms before next range...`,
                            `Completed ${current}/${total}`,
                            { timeOut: 0, extendedTimeOut: 0 }
                        );
                    }
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            } catch (error) {
                // If aborted, stop the entire queue immediately
                if (error.name === 'AbortError') {
                    console.log('[SummarySharder] Queue aborted by user');
                    toastr.info('Summarization stopped');
                    return;
                }

                console.error(`[SummarySharder] Failed to summarize range ${range.start}-${range.end}:`, error);

                failed.push({
                    range: `${range.start}-${range.end}`,
                    error: error.message
                });

                // Ask user if they want to continue
                const continueProcessing = await showSsConfirm(
                    'Summarization Failed',
                    `Range ${range.start}-${range.end} failed: ${error.message}\n\nContinue with remaining ranges?`
                );

                if (continueProcessing !== POPUP_RESULT.AFFIRMATIVE) {
                    // User chose to stop
                    break;
                }
            }
        }

        // Show final summary
        if (failed.length === 0) {
            toastr.success(`Completed ${total} range${total > 1 ? 's' : ''}`);
        } else if (completed === 0) {
            toastr.error(`All ${total} range${total > 1 ? 's' : ''} failed`);
        } else {
            const failedRanges = failed.map(f => f.range).join(', ');
            toastr.warning(`Completed ${completed}/${total}. Failed: ${failedRanges}`);
        }

    } finally {
        // Clean up abort controller
        clearAbortController();
        endUiOperation({
            feature: 'summary',
            primaryButton: 'ss-run-summarize',
            disabled: false,
            label: originalText,
            lockButtons: [],
            showStop: false,
            opId,
        });

        // Clear progress toast
        if (progressToast) {
            toastr.clear(progressToast);
        }

    }
}

