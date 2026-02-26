/**
 * RAG History Modal — Shows the last RAG injection details.
 */

import { Popup, POPUP_TYPE } from '../../../../../../popup.js';
import { getLastInjectionData } from '../../../core/rag/retrieval.js';

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function truncate(text, max = 140) {
    const value = String(text || '').trim();
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(0, max - 1))}...`;
}

function formatTimestamp(ts) {
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return 'Unknown';
    }
}

function describeInjectionTarget(data) {
    if (data.injectionMode === 'variable') {
        return `Chat variable: <code>{{getvar::${escapeHtml(data.variableName || 'ss_rag_memory')}}}</code>`;
    }
    const posLabels = { 0: 'Before Main Prompt', 1: 'After Main Prompt', 2: 'In-chat' };
    const posLabel = posLabels[data.position] ?? `Position ${data.position}`;
    return `Extension prompt — ${escapeHtml(posLabel)}, depth ${data.depth}`;
}

function renderEntries(entries) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return '<p class="ss-hint ss-rag-inline-hint">No entries were injected.</p>';
    }
    return entries.map((item, idx) => {
        const score = Number(item?.score);
        const hasScore = Number.isFinite(score);
        const scoreSpan = hasScore ? `<span class="ss-rag-debug-item-score">score=${score.toFixed(4)}</span>` : '';
        const snippetClass = hasScore ? 'ss-rag-debug-item-snippet' : 'ss-rag-debug-item-snippet no-score';
        const behavior = String(item?.metadata?.chunkBehavior || '').trim().toLowerCase() || 'legacy';
        const scene = String(item?.metadata?.sceneCode || '').trim() || '(none)';
        return `<details class="ss-rag-debug-item">
            <summary>
                <span class="badge">${idx + 1}</span>
                ${scoreSpan}
                <span class="${snippetClass}">${escapeHtml(truncate(item?.text || '', 140))}</span>
            </summary>
            <div class="ss-rag-debug-item-body">
                <div><strong>behavior:</strong> ${escapeHtml(behavior)}</div>
                <div><strong>scene:</strong> ${escapeHtml(scene)}</div>
                <div><strong>importance:</strong> ${escapeHtml(String(item?.metadata?.importance ?? 'n/a'))}</div>
                <pre>${escapeHtml(String(item?.text || ''))}</pre>
                <pre>${escapeHtml(JSON.stringify(item?.metadata || {}, null, 2))}</pre>
            </div>
        </details>`;
    }).join('');
}

function renderModalHtml(data) {
    if (!data) {
        return `<div class="ss-rag-debug-modal">
            <h3>RAG History</h3>
            <p class="ss-hint ss-rag-inline-hint">No RAG injection has been performed yet this session.</p>
        </div>`;
    }

    return `<div class="ss-rag-debug-modal">
        <h3>RAG History — Last Injection</h3>

        <div class="ss-rag-debug-info-grid">
            <div><strong>Time:</strong> ${escapeHtml(formatTimestamp(data.timestamp))}</div>
            <div><strong>Mode:</strong> ${escapeHtml(data.mode)}</div>
            <div><strong>Backend:</strong> ${escapeHtml(data.backend)}</div>
            <div><strong>Scoring:</strong> ${escapeHtml(data.scoringMethod)}</div>
            <div><strong>Reranker:</strong> ${data.rerankerApplied ? escapeHtml(data.rerankerMode) : 'not applied'}</div>
            <div><strong>Entries:</strong> ${data.entries?.length || 0}</div>
        </div>

        <div class="ss-rag-debug-info-grid" style="margin-top:6px;">
            <div><strong>Injected to:</strong> ${describeInjectionTarget(data)}</div>
        </div>

        <h4 style="margin-top:12px;">Retrieved Entries</h4>
        ${renderEntries(data.entries)}

        <h4 style="margin-top:12px;">Injection Preview</h4>
        <pre class="ss-rag-debug-injection-preview">${escapeHtml(data.injectionText || '(empty)')}</pre>
    </div>`;
}

export async function openRagHistoryModal() {
    const data = getLastInjectionData();

    const popup = new Popup(
        renderModalHtml(data),
        POPUP_TYPE.TEXT,
        null,
        { okButton: 'Close', cancelButton: false, wide: true, large: true },
    );

    await popup.show();
}
