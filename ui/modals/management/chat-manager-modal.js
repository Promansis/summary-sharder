/**
 * Chat Manager Modal Component
 * Allows managing chats: delete, export, and summarize
 */

import { Popup, POPUP_TYPE, POPUP_RESULT } from '../../../../../../popup.js';
import { characters, saveChatConditional } from '../../../../../../../script.js';
import { download } from '../../../../../../utils.js';
import { getSettings, getChatRanges, saveChatRanges } from '../../../core/settings.js';
import { getActivePrompt } from '../../../core/summarization/prompts.js';
import { buildLengthInstruction } from '../../../core/summarization/length-utils.js';
import { adjustRangesForInsertion, splitRangeAtIndex } from '../../../core/processing/utils.js';
import { CharacterDropdown } from '../../dropdowns/character-dropdown.js';
import { ChatDropdown } from '../../dropdowns/chat-dropdown.js';
import { LorebookDropdown } from '../../dropdowns/lorebook-dropdown.js';
import { world_names, loadWorldInfo, saveWorldInfo, createWorldInfoEntry } from '../../../../../../world-info.js';
import { getSystemMessageByType } from '../../../../../../../scripts/system-messages.js';
import { refreshMultipleLorebooksUI } from '../../../core/processing/lorebook-refresh.js';
import { loadChatContent, deleteChat, exportChatJSON, buildRawTextExport, saveToChat, callChatManagerAPI } from '../../../core/api/chat-manager-api.js';
import { showSsConfirm } from '../../common/modal-base.js';

// Store dropdown instances for cleanup
let characterDropdown = null;
let chatDropdown = null;
let targetCharacterDropdown = null;
let targetChatDropdown = null;
let lorebookDropdown = null;

/**
 * Show export options modal
 */
async function showExportModal(characterId, chatFileName) {
    const exportHtml = `
        <div class="ss-export-modal">
            <h3>Export Format</h3>
            <div class="ss-export-options">
                <label class="ss-radio-option">
                    <input type="radio" name="ss-export-format" value="json" checked />
                    <span>JSON (full data)</span>
                </label>
                <label class="ss-radio-option">
                    <input type="radio" name="ss-export-format" value="text-names" />
                    <span>Raw Text - Name: Message</span>
                </label>
                <label class="ss-radio-option">
                    <input type="radio" name="ss-export-format" value="text-only" />
                    <span>Raw Text - Messages only</span>
                </label>
            </div>
        </div>
    `;

    let selectedFormat = null;

    const popup = new Popup(exportHtml, POPUP_TYPE.TEXT, null, {
        okButton: 'Export',
        cancelButton: 'Cancel',
        onClosing: () => {
            selectedFormat = popup.content.querySelector('input[name="ss-export-format"]:checked')?.value;
            return true;
        },
    });

    const result = await popup.show();

    if (result !== POPUP_RESULT.AFFIRMATIVE) {
        return;
    }

    const format = selectedFormat;
    if (!format) return;

    try {
        const chatName = chatFileName.replace('.jsonl', '');

        if (format === 'json') {
            const content = await exportChatJSON(characterId, chatFileName);
            download(content, `${chatName}.jsonl`, 'application/json');
            toastr.success('Chat exported as JSON');
        } else {
            // Load chat and build raw text
            const chatData = await loadChatContent(characterId, chatFileName);
            const includeNames = format === 'text-names';
            const content = buildRawTextExport(chatData, includeNames);
            download(content, `${chatName}.txt`, 'text/plain');
            toastr.success('Chat exported as text');
        }
    } catch (error) {
        console.error('[SummarySharder] Export failed:', error);
        toastr.error(`Export failed: ${error.message}`);
    }
}

/**
 * Show summarize options modal
 */
async function showSummarizeModal(sourceCharacterId, sourceChatFileName) {
    const settings = getSettings();

    // Load source chat to get message count
    let chatData;
    try {
        chatData = await loadChatContent(sourceCharacterId, sourceChatFileName);
    } catch (error) {
        toastr.error(`Failed to load chat: ${error.message}`);
        return;
    }

    // Filter out metadata
    const messages = chatData.filter(m => m && m.mes !== undefined);
    const maxIndex = messages.length - 1;

    if (maxIndex < 0) {
        toastr.warning('Chat has no messages to summarize');
        return;
    }

    const summarizeHtml = `
        <div class="ss-summarize-modal">
            <h3>Summarize Chat</h3>

            <div class="ss-summarize-section">
                <label>Message Range (0-${maxIndex}):</label>
                <div class="ss-range-inputs">
                    <input type="number" id="ss-sum-start" class="text_pole" value="0" min="0" max="${maxIndex}" />
                    <span>to</span>
                    <input type="number" id="ss-sum-end" class="text_pole" value="${maxIndex}" min="0" max="${maxIndex}" />
                </div>
            </div>

            <div class="ss-summarize-section">
                <label>Output Destination:</label>
                <div class="ss-destination-options">
                    <label class="ss-radio-option">
                        <input type="radio" name="ss-dest" value="current" checked />
                        <span>Inject into current chat</span>
                    </label>
                    <label class="ss-radio-option">
                        <input type="radio" name="ss-dest" value="lorebook" />
                        <span>Save to lorebook</span>
                    </label>
                    <label class="ss-radio-option">
                        <input type="radio" name="ss-dest" value="specific" />
                        <span>Inject into specific chat</span>
                    </label>
                </div>
            </div>

            <div id="ss-cm-lorebook-section" class="ss-summarize-section ss-hidden">
                <label>Select Lorebook:</label>
                <div id="ss-sum-lorebook-container"></div>
            </div>

            <div id="ss-specific-chat-section" class="ss-summarize-section ss-hidden">
                <label>Target Character:</label>
                <div id="ss-sum-target-char-container"></div>
                <label class="ss-cm-target-chat-label">Target Chat:</label>
                <div id="ss-sum-target-chat-container"></div>
            </div>

            <div id="ss-injection-position-section" class="ss-summarize-section">
                <label>Injection Position:</label>
                <div class="ss-position-options">
                    <label class="ss-radio-option">
                        <input type="radio" name="ss-position" value="beginning" />
                        <span>At beginning of chat</span>
                    </label>
                    <label class="ss-radio-option">
                        <input type="radio" name="ss-position" value="end" checked />
                        <span>At end of chat</span>
                    </label>
                    <label class="ss-radio-option">
                        <input type="radio" name="ss-position" value="custom" />
                        <span>At custom position</span>
                    </label>
                </div>
                <div id="ss-custom-position-input" class="ss-custom-position-wrapper ss-hidden">
                    <input type="number" id="ss-custom-position" class="text_pole" min="0" placeholder="Message index (0-based)" />
                </div>
            </div>
        </div>
    `;

    // Captured values - populated in onClosing before DOM is destroyed
    let capturedStartIndex = 0;
    let capturedEndIndex = maxIndex;
    let capturedDestination = 'current';
    let capturedLorebooks = [];
    let capturedTargetCharId = null;
    let capturedTargetChatFile = null;
    let capturedInjectionPosition = 'end';
    let capturedCustomPosition = null;

    const popup = new Popup(summarizeHtml, POPUP_TYPE.TEXT, null, {
        okButton: 'Summarize',
        cancelButton: 'Cancel',
        wide: true,
        onClosing: () => {
            // Capture all values BEFORE popup DOM is destroyed
            capturedStartIndex = parseInt(document.getElementById('ss-sum-start')?.value || '0', 10);
            capturedEndIndex = parseInt(document.getElementById('ss-sum-end')?.value || String(maxIndex), 10);
            capturedDestination = document.querySelector('input[name="ss-dest"]:checked')?.value || 'current';
            capturedLorebooks = lorebookDropdown?.getSelection() || [];
            capturedTargetCharId = targetCharacterDropdown?.getSelection();
            capturedTargetChatFile = targetChatDropdown?.getSelection();
            capturedInjectionPosition = document.querySelector('input[name="ss-position"]:checked')?.value || 'end';
            const customPosValue = document.getElementById('ss-custom-position')?.value;
            capturedCustomPosition = customPosValue ? parseInt(customPosValue, 10) : null;

            // Cleanup dropdowns
            if (lorebookDropdown) {
                lorebookDropdown.destroy();
                lorebookDropdown = null;
            }
            if (targetCharacterDropdown) {
                targetCharacterDropdown.destroy();
                targetCharacterDropdown = null;
            }
            if (targetChatDropdown) {
                targetChatDropdown.destroy();
                targetChatDropdown = null;
            }
            return true; // Allow popup to close
        },
    });

    const showPromise = popup.show();

    // Setup event listeners after popup renders
    // Use requestAnimationFrame instead of setTimeout to avoid blocking main thread
    requestAnimationFrame(() => {
        // Destination radio listeners
        const destRadios = document.querySelectorAll('input[name="ss-dest"]');
        const lorebookSection = document.getElementById('ss-cm-lorebook-section');
        const specificSection = document.getElementById('ss-specific-chat-section');
        const positionSection = document.getElementById('ss-injection-position-section');
        const applyDestinationVisibility = (value) => {
            lorebookSection?.classList.toggle('ss-hidden', value !== 'lorebook');
            specificSection?.classList.toggle('ss-hidden', value !== 'specific');
            positionSection?.classList.toggle('ss-hidden', value !== 'current' && value !== 'specific');
        };

        destRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                applyDestinationVisibility(e.target.value);
            });
        });

        // Position radio listeners - show/hide custom position input
        const positionRadios = document.querySelectorAll('input[name="ss-position"]');
        const customPositionInput = document.getElementById('ss-custom-position-input');

        positionRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                customPositionInput?.classList.toggle('ss-hidden', e.target.value !== 'custom');
            });
        });
        applyDestinationVisibility(document.querySelector('input[name="ss-dest"]:checked')?.value || 'current');

        // Initialize lorebook dropdown
        lorebookDropdown = new LorebookDropdown('ss-sum-lorebook-container', {
            placeholder: 'Select lorebook...',
            initialSelection: [],
            onSelectionChange: () => {}
        });
        lorebookDropdown.render();

        // Initialize target character dropdown
        targetCharacterDropdown = new CharacterDropdown('ss-sum-target-char-container', {
            placeholder: 'Select character...',
            onSelectionChange: async (charId) => {
                if (targetChatDropdown) {
                    await targetChatDropdown.loadChatsForCharacter(charId);
                }
            }
        });
        targetCharacterDropdown.render();

        // Initialize target chat dropdown
        targetChatDropdown = new ChatDropdown('ss-sum-target-chat-container', {
            placeholder: 'Select chat...',
            onSelectionChange: () => {}
        });
        targetChatDropdown.render();
    });

    const result = await showPromise;

    if (result !== POPUP_RESULT.AFFIRMATIVE) {
        return;
    }

    // Use the captured values (populated in onClosing callback)
    const startIndex = capturedStartIndex;
    const endIndex = capturedEndIndex;
    const destination = capturedDestination;
    const selectedLorebooks = capturedLorebooks;
    const targetCharId = capturedTargetCharId;
    const targetChatFile = capturedTargetChatFile;
    const injectionPosition = capturedInjectionPosition;
    const customPosition = capturedCustomPosition;

    // Validate range
    if (isNaN(startIndex) || isNaN(endIndex) || startIndex < 0 || endIndex > maxIndex || startIndex > endIndex) {
        toastr.error('Invalid message range');
        return;
    }

    // Validate custom position if selected
    if (injectionPosition === 'custom' && (customPosition === null || isNaN(customPosition) || customPosition < 0)) {
        toastr.error('Please enter a valid custom position (0 or greater)');
        return;
    }

    // Run summarization with captured values
    await runSummarizationFromModal(
        sourceCharacterId,
        sourceChatFileName,
        messages,
        startIndex,
        endIndex,
        destination,
        settings,
        selectedLorebooks,
        targetCharId,
        targetChatFile,
        injectionPosition,
        customPosition
    );
}

/**
 * Run summarization from the modal
 * @param {number} sourceCharId - Source character ID
 * @param {string} sourceChatFile - Source chat filename
 * @param {Array} messages - Array of chat messages
 * @param {number} startIndex - Start index of range to summarize
 * @param {number} endIndex - End index of range to summarize
 * @param {string} destination - Output destination ('current', 'lorebook', 'specific')
 * @param {Object} settings - Extension settings
 * @param {Array} selectedLorebooks - Selected lorebook names (for lorebook destination)
 * @param {number|null} targetCharId - Target character ID (for specific destination)
 * @param {string|null} targetChatFile - Target chat filename (for specific destination)
 * @param {string} injectionPosition - Position to inject ('beginning', 'end', 'custom')
 * @param {number|null} customPosition - Custom position index (when injectionPosition is 'custom')
 */
async function runSummarizationFromModal(sourceCharId, sourceChatFile, messages, startIndex, endIndex, destination, settings, selectedLorebooks, targetCharId, targetChatFile, injectionPosition = 'end', customPosition = null) {
    // Build chat text
    const lines = [];
    for (let i = startIndex; i <= endIndex; i++) {
        const msg = messages[i];
        if (!msg) continue;
        const name = msg.name || (msg.is_user ? 'User' : 'Character');
        const text = msg.mes || '';
        lines.push(`[${name}]: ${text}`);
    }
    const chatText = lines.join('\n\n');

    if (!chatText.trim()) {
        toastr.warning('Selected message range is empty');
        return;
    }

    const summaryPrompt = getActivePrompt(settings);
    if (!summaryPrompt) {
        toastr.error('No summary prompt selected');
        return;
    }

    const systemPrompt = summaryPrompt;
    let userPrompt = `CHAT CONTENT TO PROCESS (Messages ${startIndex} to ${endIndex}):\n\n${chatText}`;

    // Add length control instruction if enabled
    if (settings.summaryLengthControl) {
        userPrompt += buildLengthInstruction(chatText, settings.summaryLengthPercent || 10);
    }

    const progressToast = toastr.info(
        `Processing messages ${startIndex} to ${endIndex}...`,
        'Generating Summary',
        { timeOut: 0, extendedTimeOut: 0 }
    );

    try {
        const summaryResult = await callChatManagerAPI(settings, systemPrompt, userPrompt);

        toastr.clear(progressToast);

        // Route output based on destination
        let outputResult = { didInjectToContext: false };
        if (destination === 'current') {
            outputResult = await injectIntoCurrentChat(summaryResult, startIndex, endIndex, injectionPosition, customPosition);
        } else if (destination === 'lorebook') {
            outputResult = await saveToLorebookFromModal(summaryResult, startIndex, endIndex, settings, selectedLorebooks);
        } else if (destination === 'specific') {
            outputResult = await injectIntoSpecificChat(summaryResult, startIndex, endIndex, targetCharId, targetChatFile, injectionPosition, customPosition);
        }

        if (!outputResult?.didInjectToContext) {
            return;
        }

        toastr.success('Summarization complete!');
    } catch (error) {
        toastr.clear(progressToast);
        console.error('[SummarySharder] Summarization failed:', error);
        toastr.error(`Summarization failed: ${error.message}`);
    }
}

/**
 * Inject summary into current chat
 * @param {string} summary - The summary text to inject
 * @param {number} startIndex - Start index of summarized range (for labeling)
 * @param {number} endIndex - End index of summarized range (for labeling)
 * @param {string} injectionPosition - Where to inject ('beginning', 'end', 'custom')
 * @param {number|null} customPosition - Custom position index (when injectionPosition is 'custom')
 */
async function injectIntoCurrentChat(summary, startIndex, endIndex, injectionPosition = 'end', customPosition = null) {
    const formattedContent = `[MEMORY SHARD: Messages ${startIndex}-${endIndex}]\n\n${summary}`;
    const context = SillyTavern.getContext();

    if (!context || !context.chat) {
        toastr.warning('Could not access current chat');
        console.log('=== SUMMARY OUTPUT ===\n', formattedContent);
        return {
            didInjectToContext: false,
            outputUID: null,
            insertionIndex: null,
        };
    }

    const systemMessage = getSystemMessageByType('generic', formattedContent);
    if (!systemMessage) {
        toastr.warning('Could not create system message');
        return {
            didInjectToContext: false,
            outputUID: null,
            insertionIndex: null,
        };
    }

    // Determine insertion index based on position option
    let insertionIndex;
    const chatLength = context.chat.length;

    switch (injectionPosition) {
        case 'beginning':
            insertionIndex = 0;
            break;
        case 'custom':
            // Clamp custom position to valid range
            insertionIndex = Math.max(0, Math.min(customPosition || 0, chatLength));
            break;
        case 'end':
        default:
            insertionIndex = chatLength; // Append at end
            break;
    }

    // Insert into chat array at the determined position
    if (insertionIndex >= chatLength) {
        // Append at end
        context.chat.push(systemMessage);
        context.addOneMessage(systemMessage);
    } else {
        // Insert at specific position
        context.chat.splice(insertionIndex, 0, systemMessage);

        // Pre-increment mesids BEFORE addOneMessage so that when MESSAGE_INSERTED fires
        // and triggers applyVisibilitySettings, the mesid→index mapping is already correct.
        // Use >= (not >) because the new element doesn't exist yet — all elements at or after
        // insertionIndex need to shift up by 1 to make room.
        const messageElements = document.querySelectorAll('#chat .mes');
        messageElements.forEach((el) => {
            const currentMesid = parseInt(el.getAttribute('mesid'), 10);
            if (!isNaN(currentMesid) && currentMesid >= insertionIndex) {
                el.setAttribute('mesid', currentMesid + 1);
            }
        });

        // Add to DOM — MESSAGE_INSERTED event will now see correct mesids
        context.addOneMessage(systemMessage, {
            insertAfter: insertionIndex - 1,
            scroll: false
        });
    }

    // Save chat first; update ranges only after insertion persistence succeeds.
    await saveChatConditional();

    // Adjust hidden ranges to account for the insertion and ensure summary is not hidden
    let ranges = getChatRanges();
    if (ranges.length > 0) {
        // First, shift all ranges that are at or after the insertion point
        ranges = adjustRangesForInsertion(ranges, insertionIndex);
        // Then, split any range that now contains the insertion index to exclude the summary
        ranges = splitRangeAtIndex(ranges, insertionIndex);
        // Save the updated ranges
        saveChatRanges(ranges);
    }

    console.log(`[SummarySharder] Inserted summary into current chat at position ${insertionIndex}`);
    return {
        didInjectToContext: true,
        outputUID: systemMessage.send_date || null,
        insertionIndex,
    };
}

/**
 * Save summary to lorebook from modal
 */
async function saveToLorebookFromModal(summary, startIndex, endIndex, settings, selectedLorebooks) {
    // Use the captured lorebook selection passed as parameter
    const selectedBooks = [...selectedLorebooks];

    if (selectedBooks.length === 0) {
        // Fallback to first available lorebook
        if (world_names.length > 0) {
            selectedBooks.push(world_names[0]);
        } else {
            toastr.error('No lorebook selected or available');
            return { didInjectToContext: false, successCount: 0 };
        }
    }

    const options = settings.lorebookEntryOptions || {};
    const context = SillyTavern.getContext();
    const charName = context?.name2 || 'Character';
    const date = new Date().toISOString().split('T')[0];

    const entryName = (options.nameFormat || 'Memory Shard {start}-{end}')
        .replace(/{start}/g, startIndex)
        .replace(/{end}/g, endIndex)
        .replace(/{date}/g, date)
        .replace(/{character}/g, charName);

    const keywords = [];
    if (options.keywordsEnabled !== false) {
        const keywordFormat = options.keywordFormat || 'summary_{start}_{end}';
        keywords.push(keywordFormat.replace(/{start}/g, startIndex).replace(/{end}/g, endIndex));
    }
    keywords.push('memory_shard');
    if (options.additionalKeywords) {
        keywords.push(...options.additionalKeywords.split(',').map(k => k.trim()).filter(k => k));
    }

    let entryConfig;
    switch (options.entryType) {
        case 'constant': entryConfig = { constant: true, disable: false, vectorized: false }; break;
        case 'vectorized': entryConfig = { constant: false, disable: false, vectorized: true }; break;
        case 'disabled': entryConfig = { constant: false, disable: true, vectorized: false }; break;
        default: entryConfig = { constant: false, disable: false, vectorized: false };
    }

    let savedCount = 0;
    const successfulSaves = [];  // Track which books saved successfully

    for (const bookName of selectedBooks) {
        try {
            const data = await loadWorldInfo(bookName);
            if (!data || !data.entries) continue;

            const newEntry = createWorldInfoEntry(bookName, data);
            if (!newEntry) continue;

            newEntry.key = keywords;
            newEntry.content = summary;
            newEntry.comment = entryName;
            newEntry.constant = entryConfig.constant;
            newEntry.disable = entryConfig.disable;
            newEntry.vectorized = entryConfig.vectorized;
            newEntry.selective = !entryConfig.constant;

            await saveWorldInfo(bookName, data, true);
            savedCount++;
            successfulSaves.push(bookName);  // Track successful saves
        } catch (error) {
            console.error(`[SummarySharder] Failed to save to ${bookName}:`, error);
        }
    }

    if (savedCount > 0) {
        toastr.success(`Summary saved to ${savedCount} lorebook(s)`);

        // Refresh UI only for successfully saved lorebooks
        refreshMultipleLorebooksUI(successfulSaves);
        return { didInjectToContext: true, successCount: savedCount };
    } else {
        toastr.error('Failed to save to any lorebook');
        return { didInjectToContext: false, successCount: 0 };
    }
}

/**
 * Inject summary into specific chat
 * @param {string} summary - The summary text to inject
 * @param {number} startIndex - Start index of summarized range (for labeling)
 * @param {number} endIndex - End index of summarized range (for labeling)
 * @param {number} targetCharId - Target character ID
 * @param {string} targetChatFile - Target chat filename
 * @param {string} injectionPosition - Where to inject ('beginning', 'end', 'custom')
 * @param {number|null} customPosition - Custom position index (when injectionPosition is 'custom')
 */
async function injectIntoSpecificChat(summary, startIndex, endIndex, targetCharId, targetChatFile, injectionPosition = 'end', customPosition = null) {
    if (targetCharId === null || targetCharId === undefined || !targetChatFile) {
        toastr.error('Please select a target character and chat');
        return {
            didInjectToContext: false,
            outputUID: null,
            insertionIndex: null,
        };
    }

    let chatData;
    let systemMessage;
    let insertionIndex;

    try {
        // Load the target chat
        chatData = await loadChatContent(targetCharId, targetChatFile);

        // Create system message
        const formattedContent = `[MEMORY SHARD: Messages ${startIndex}-${endIndex}]\n\n${summary}`;
        systemMessage = getSystemMessageByType('generic', formattedContent);

        if (!systemMessage) {
            toastr.error('Could not create system message');
            return {
                didInjectToContext: false,
                outputUID: null,
                insertionIndex: null,
            };
        }

        // Determine insertion index based on position option
        const chatLength = chatData.length;

        switch (injectionPosition) {
            case 'beginning':
                insertionIndex = 0;
                break;
            case 'custom':
                // Clamp custom position to valid range
                insertionIndex = Math.max(0, Math.min(customPosition || 0, chatLength));
                break;
            case 'end':
            default:
                insertionIndex = chatLength; // Append at end
                break;
        }

        // Insert at the determined position
        if (insertionIndex >= chatLength) {
            chatData.push(systemMessage);
        } else {
            chatData.splice(insertionIndex, 0, systemMessage);
        }

        // Save message insertion first; apply metadata range changes only after insertion save succeeds.
        await saveToChat(targetCharId, targetChatFile, chatData);
    } catch (error) {
        console.error('[SummarySharder] Failed to inject into chat:', error);
        toastr.error(`Failed to inject: ${error.message}`);
        return {
            didInjectToContext: false,
            outputUID: null,
            insertionIndex: null,
        };
    }

    try {
        // Handle range adjustment for the target chat's metadata
        // The chat metadata is stored in the first message (index 0) of the chat file
        const metadataMsg = chatData.find(msg => msg.user_name !== undefined && msg.character_name !== undefined);
        if (metadataMsg && metadataMsg.summary_sharder && metadataMsg.summary_sharder.summarizedRanges) {
            let ranges = metadataMsg.summary_sharder.summarizedRanges;
            if (ranges.length > 0) {
                // Shift ranges for the insertion
                ranges = adjustRangesForInsertion(ranges, insertionIndex);
                // Split any range that contains the insertion index
                ranges = splitRangeAtIndex(ranges, insertionIndex);
                // Update and persist metadata after confirmed insertion
                metadataMsg.summary_sharder.summarizedRanges = ranges;
                await saveToChat(targetCharId, targetChatFile, chatData);
            }
        }
    } catch (error) {
        console.warn('[SummarySharder] Summary inserted but target metadata update failed:', error);
    }

    toastr.success(`Summary injected into ${targetChatFile.replace('.jsonl', '')} at position ${insertionIndex}`);
    return {
        didInjectToContext: true,
        outputUID: systemMessage?.send_date || null,
        insertionIndex,
    };
}

/**
 * Open the chat manager modal
 */
export async function openChatManagerModal(settings) {
    // Build modal HTML
    const modalHtml = `
        <div class="ss-chat-manager-modal">
            <div class="ss-chat-manager-selectors">
                <div class="ss-selector-row">
                    <label>Character:</label>
                    <div id="ss-cm-character-container"></div>
                </div>
                <div class="ss-selector-row">
                    <label>Chat:</label>
                    <div id="ss-cm-chat-container"></div>
                </div>
            </div>

            <div class="ss-chat-manager-actions">
                <h4>Actions</h4>
                <div class="ss-action-buttons">
                    <input type="button" id="ss-cm-delete-btn" class="menu_button" value="Delete Chat" disabled />
                    <input type="button" id="ss-cm-export-btn" class="menu_button" value="Extract Chat" disabled />
                    <input type="button" id="ss-cm-summarize-btn" class="menu_button" value="Summarize Chat" disabled />
                </div>
            </div>
        </div>
    `;

    const popup = new Popup(modalHtml, POPUP_TYPE.TEXT, null, {
        okButton: null,
        cancelButton: 'Close',
        wide: true,
        large: true,
    });

    const showPromise = popup.show();

    // Track current selection
    let selectedCharId = null;
    let selectedChatFile = null;

    // Function to update action button states
    const updateActionButtons = () => {
        const hasSelection = selectedCharId !== null && selectedChatFile !== null;
        document.getElementById('ss-cm-delete-btn').disabled = !hasSelection;
        document.getElementById('ss-cm-export-btn').disabled = !hasSelection;
        document.getElementById('ss-cm-summarize-btn').disabled = !hasSelection;
    };

    // Setup dropdowns after popup renders
    // Use requestAnimationFrame instead of setTimeout to avoid blocking main thread
    requestAnimationFrame(() => {
        // Initialize character dropdown
        characterDropdown = new CharacterDropdown('ss-cm-character-container', {
            placeholder: 'Select character...',
            onSelectionChange: async (charId) => {
                selectedCharId = charId;
                selectedChatFile = null;
                updateActionButtons();
                if (chatDropdown) {
                    await chatDropdown.loadChatsForCharacter(charId);
                }
            }
        });
        characterDropdown.render();

        // Initialize chat dropdown
        chatDropdown = new ChatDropdown('ss-cm-chat-container', {
            placeholder: 'Select chat...',
            onSelectionChange: (chatFile) => {
                selectedChatFile = chatFile;
                updateActionButtons();
            }
        });
        chatDropdown.render();

        // Delete button handler
        document.getElementById('ss-cm-delete-btn')?.addEventListener('click', async () => {
            if (selectedCharId === null || !selectedChatFile) return;

            const chatName = selectedChatFile.replace('.jsonl', '');
            const confirm = await showSsConfirm(
                'Delete Chat',
                `Are you sure you want to delete "${chatName}"? This cannot be undone.`
            );

            if (confirm === POPUP_RESULT.AFFIRMATIVE) {
                try {
                    await deleteChat(selectedCharId, selectedChatFile);
                    toastr.success('Chat deleted');
                    selectedChatFile = null;
                    updateActionButtons();
                    // Refresh chat list
                    if (chatDropdown) {
                        await chatDropdown.loadChatsForCharacter(selectedCharId);
                    }
                } catch (error) {
                    console.error('[SummarySharder] Delete failed:', error);
                    toastr.error(`Delete failed: ${error.message}`);
                }
            }
        });

        // Export button handler
        document.getElementById('ss-cm-export-btn')?.addEventListener('click', async () => {
            if (selectedCharId === null || !selectedChatFile) return;
            await showExportModal(selectedCharId, selectedChatFile);
        });

        // Summarize button handler
        document.getElementById('ss-cm-summarize-btn')?.addEventListener('click', async () => {
            if (selectedCharId === null || !selectedChatFile) return;
            await showSummarizeModal(selectedCharId, selectedChatFile);
        });
    });

    await showPromise;

    // Cleanup
    if (characterDropdown) {
        characterDropdown.destroy();
        characterDropdown = null;
    }
    if (chatDropdown) {
        chatDropdown.destroy();
        chatDropdown = null;
    }
}

