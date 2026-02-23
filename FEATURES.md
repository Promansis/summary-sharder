# Summary Sharder - Feature Documentation

A comprehensive SillyTavern extension for intelligent chat summarization and memory management.

---

## Table of Contents

- [Overview](#overview)
- [Sharder Mode](#sharder-mode)
  - [The 16 Shard Sections](#the-16-shard-sections)
  - [Post-Summary Review](#post-summary-review)
- [Basic Summary Mode](#basic-summary-mode)
- [Review Pipeline](#review-pipeline)
  - [Pre-Edit Events](#pre-edit-events)
  - [Summary Review](#summary-review)
- [Visibility Controls](#visibility-controls)
- [Output Options](#output-options)
  - [System Messages](#system-messages)
  - [Lorebook Integration](#lorebook-integration)
  - [Lorebook Entry Options](#lorebook-entry-options)
- [RAG Integration](#rag-integration)
  - [Vector DB Backends](#vector-db-backends)
  - [Scoring Methods](#scoring-methods)
  - [Section-Aware Chunking](#section-aware-chunking)
  - [RAG Configuration](#rag-configuration)
- [Per-Feature API Configs](#per-feature-api-configs)
- [Context Cleanup](#context-cleanup)
- [Length Control](#length-control)
- [Chat Manager](#chat-manager)
- [Floating Action Button (FAB)](#floating-action-button-fab)
- [Themes](#themes)
- [Batch Processing](#batch-processing)
- [Prompt Manager Modal](#prompt-manager-modal)
- [Configuration Reference](#configuration-reference)

---

## Overview

Summary Sharder is a SillyTavern extension that compresses roleplay chat history into structured, recoverable "Memory Shards." As conversations grow long, older messages push beyond the LLM's context window and are lost. Summary Sharder captures that history — summarizing message ranges, managing message visibility, and routing output to system messages or lorebook entries — so nothing important is forgotten.

In **Sharder mode**, summaries are generated as structured documents with 16 labeled sections (timeline, character states, relationships, key dialogue, and more), each tagged with scene codes for precise cross-referencing. An optional **RAG pipeline** vectorizes these shards and automatically injects relevant memories into future generations based on conversation context.

The extension also includes a full **Chat Management** system for browsing, exporting, and summarizing chats across any character — and a **review pipeline** that lets you curate, edit, and weight every section before saving.

---

## Sharder Mode

A unique workflow that creates detailed, structured "Memory Shards" from your roleplay conversations. Toggle this mode to switch from standard summarization to the structured shard generation workflow. Generates and validates in a single API call, producing a structured Memory Shard with 16 labeled sections and scene codes (`[S{StartMsg}:{SceneNum}]`) for cross-referencing across shards.

> **Note:** Sharder Mode and Pre-Edit Events are mutually exclusive—enabling one will disable the other.

**Usage:** Enable **Sharder Mode** in settings, select a message range, and click **"Run Sharder"** (or use the FAB).

---

### The 16 Shard Sections

The AI parses your conversation and identifies key elements organized by tagged sections:

| Section | Tag | Description |
|---------|-----|-------------|
| Key | `[KEY]` | Scene code legend (preamble) |
| Tone | `[TONE]` | Overall mood and atmosphere |
| Characters | `[CHARACTERS]` | Character introductions and notes |
| World | `[WORLD]` | World-building and setting details |
| Timeline | `[TIMELINE]` | Chronological scene progression |
| Events | `[EVENTS]` | Significant plot events |
| States | `[STATES]` | Character physical/emotional states |
| Relationships | `[RELATIONSHIPS]` | Relationship dynamics and shifts |
| Developments | `[DEVELOPMENTS]` | Plot and character development |
| NSFW | `[NSFW]` | Adult content (verbatim, conditional) |
| Dialogue | `[DIALOGUE]` | Key dialogue lines |
| Voice | `[VOICE]` | Character speech patterns and quirks |
| Anchors | `[ANCHORS]` | Memorable moments and callbacks |
| Callbacks | `[CALLBACKS]` | Setups awaiting payoff |
| Threads | `[THREADS]` | Unresolved plot threads |
| Scenes | `[SCENES]` | Scene summaries |
| Current | `[CURRENT]` | Current state snapshot (always present) |

---

### Post-Summary Review

After shard generation, a review modal appears allowing you to:

- ✅ **View** all extracted sections organized by category
- ✏️ **Edit** individual sections before saving
- ☑️ **Select/Deselect** individual items to include or exclude
- ⚖️ **Assign importance weights** (critical / major / moderate / minor / trivial)
- 🗄️ **Archive** sections you want to preserve but not actively inject
- ✂️ **Prune** entries from any section

This gives you fine-grained control over what gets preserved in the final Memory Shard.

---

## Basic Summary Mode

Select a message range and generate a prose summary using your active prompt. Output is saved as a system message or lorebook entry.

**Usage:** Open the extension settings, select a message range (start and end message numbers), and click **"Summarize"** (or use the FAB → Actions → Summarize Now).

---

## Review Pipeline

### Pre-Edit Events

An alternative workflow (mutually exclusive with Sharder Mode) that extracts and lets you review events before generating a summary.

**Workflow:**

1. AI extracts key narrative events from the selected message range
2. Review modal displays extracted events
3. Edit, add, remove, or reorder events as needed
4. Generate summary based on curated events

**Use Case:** When you want more control over what the summary focuses on without the full structured Sharder workflow.

Toggle via **"Pre-Edit Events"** checkbox.

---

### Summary Review

Review and edit summaries before they're saved (available outside of Sharder Mode).

**Review Mode Options:**

| Mode | Behavior |
|------|----------|
| `Always` | Always show review modal |
| `Never` | Auto-save without review |

**Additional Settings:**

- **Token Threshold** — Trigger review if summary exceeds token count
- **Prompt Change Detection** — Review when prompt has changed since last summary

Toggle via **"Summary Review"** checkbox in the extension panel.

---

## Visibility Controls

Manage the visibility of summarized messages in your chat history.

**Features:**

- **Hide Summarized** — Automatically hide messages after they've been summarized
- **Collapse All** — Collapse summarized message ranges instead of hiding
- **Per-Range Controls** — Independent hide/collapse toggles per message range
- **Per-Range Speaker Ignore Lists** — Exclude specific speakers from visibility changes
- **Global Toggles** — Hide All / Collapse All for bulk control
- **Visibility Modal** — Fine-tune which message ranges are hidden/shown/collapsed
- **Slash Command Sync** — Syncs with SillyTavern's `/hide` and `/unhide` slash commands via MutationObserver

Access via the **"Manage Visibility"** button in the extension panel.

---

## Output Options

### System Messages

Summaries are injected directly into the chat at the summarized position as system messages.

### Lorebook Integration

Save summaries and Memory Shards directly to your World Info/Lorebook for persistent, searchable memory.

**Benefits:**

- 🔍 Vector search compatibility for contextual injection
- 🏷️ Automatic keyword extraction for trigger-based recall
- 📚 Entries persist across chat sessions
- 🔗 Works alongside system message storage

**Setup:** Select your target lorebook from the dropdown and configure entry options.

---

### Lorebook Entry Options

Configure how summaries are saved to lorebooks via the **Lorebook Options Modal**:

| Option | Description |
|--------|-------------|
| **Entry Type** | `constant` (always active), `vectorized`, `normal`, or `disabled` |
| **Name Format** | Template for entry names using variables: `{start}`, `{end}`, `{date}`, `{character}` |
| **Keywords Enabled** | Toggle automatic keyword generation |
| **Keyword Format** | Template for generated keywords |
| **Additional Keywords** | Custom keywords to add to every entry |
| **Banned Keywords** | Keywords to exclude from generation |
| **Extract Keywords** | AI-powered keyword extraction from content |
| **Order Strategy** | Recency-based or fixed entry priority/ordering |

---

## RAG Integration

Vectorize your Memory Shards and automatically inject relevant memories during generation.

### Vector DB Backends

| Backend | Description |
|---------|-------------|
| **Vectra** | Default lightweight option |
| **LanceDB** | Columnar vector database |
| **Qdrant** | High-performance vector search |
| **Milvus** | Distributed vector database |

### Scoring Methods

| Method | Description |
|--------|-------------|
| **Keyword Boost** | Keyword-based scoring |
| **BM25** | With Porter stemming for term relevance |
| **Hybrid Fusion** | Combined scoring via RRF or weighted normalization |

### Section-Aware Chunking

In Sharder mode, chunks are typed for intelligent handling:

| Chunk Type | Behavior |
|------------|----------|
| **Superseding** | Newer entries replace older ones |
| **Cumulative** | Entries are combined/merged |
| **Rolling** | Window-based, older entries age out |

**Additional RAG Features:**

- 🎯 **Scene Expansion** — When a shard hit is retrieved, all chunks from the same scene are pulled in for full context
- 🔀 **Reranker Support** — Optional cross-encoder reranking via Similharity plugin or direct API
- 🗄️ **Warm/Cold Archive** — Warm archive stores shard vectors with hash-based deduplication; cold archive persists entries as JSON in chat metadata with FIFO trimming
- 🧹 **Smart Deduplication** — Prevents redundant injection by checking against recent chat messages
- ⚙️ **Separate RAG Configurations** — Independent settings for Standard mode and Sharder mode
- 🔍 **RAG Debug** — Inspect what was retrieved and why (FAB → Advanced → RAG Debug)

---

### RAG Configuration

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| **Backend** | Vectra / LanceDB / Qdrant / Milvus | Vectra | Vector database backend |
| **Scoring Method** | Keyword / BM25 / Hybrid | Keyword | How retrieved chunks are scored |
| **Hybrid Fusion** | RRF / Weighted | RRF | Fusion strategy for hybrid scoring |
| **Insert Count** | 1–50 | 5 | Max chunks injected per generation |
| **Query Count** | 1–10 | 2 | Number of recent messages used as query |
| **Score Threshold** | 0–1 | 0.25 | Minimum score for chunk inclusion |
| **Section-Aware Chunking** | On / Off | Off | Split shards by section type (Sharder mode) |
| **Scene Expansion** | On / Off | On | Pull full scene context from partial hits |
| **Reranker** | On / Off | Off | Cross-encoder reranking of retrieved chunks |
| **Protect Count** | 1–50 | 5 | Recent messages checked for dedup against injected chunks |

---

## Per-Feature API Configs

Different features can use different AI providers, allowing you to optimize cost and quality.

### Configurable Features

| Feature | Use Case | Default Temp | Default Max Tokens |
|---------|----------|-------------|-------------------|
| **Summary API** | Standard summarization | 0.4 | 8096 |
| **Sharder API** | Structured shard generation | 0.25 | 8096 |
| **Events API** | Pre-Edit Events extraction | 0.4 | 4096 |
| **Chat Manager API** | Cross-chat summarization | 0.3 | 4096 |

### Configuration Options

Each feature can be independently configured with:

- **API Provider** — SillyTavern's current API or external OpenAI-compatible endpoint
- **Temperature** — Creativity control
- **Top P** — Nucleus sampling parameter
- **Max Tokens** — Response length limit
- **Post-Processing Mode** — Output processing options
- **Message Format** — Request formatting
- **Queue Delay** — Rate limiting between requests

Access configuration via **"Configure APIs..."** button in the API Status drawer.

---

## Context Cleanup

Preprocess chat text before sending to the AI for cleaner, more focused summaries.

### Cleanup Options

| Option | Default | Description |
|--------|---------|-------------|
| **Strip HTML** | On | Remove `<div>`, `<span>`, and other HTML tags |
| **Strip Code Blocks** | Off | Remove fenced code blocks entirely |
| **Strip URLs** | Off | Remove http/https links |
| **Strip Emojis** | Off | Remove emoji characters |
| **Strip Bracketed Meta** | Off | Remove `[OOC]`, `(OOC)`, etc. |
| **Strip Reasoning Blocks** | On | Remove LLM thinking/reasoning blocks |
| **Strip Hidden Messages** | On | Skip messages flagged as hidden |
| **Custom Regex Patterns** | — | User-defined regex pattern replacements (multiple supported) |

### Custom Regex Format

javascript
{
  id: "unique-id",
  name: "Pattern Name",
  pattern: "regex-pattern",
  flags: "gi",
  replacement: "",
  enabled: true
}


Access via **"Context Cleanup"** button.

---

## Length Control

Target a specific summary length as a percentage of the original content.

| Setting | Range | Default |
|---------|-------|---------|
| **Enable Length Control** | On/Off | Off |
| **Target Percentage** | 1% - 30% | 10% |

When enabled, the length instruction is appended to your summary prompt to guide the AI toward the target compression ratio.

---

## Chat Manager

Manage chats across any character without switching contexts via the **Chat Manager Modal**.

**Features:**

- 📂 **Browse** all chats for any character
- 🗑️ **Delete** unwanted chats permanently
- 📤 **Export** in three formats: JSON, text with speaker names, or plain text only
- 📝 **Summarize Cross-Chat** — Generate a summary of a selected chat and inject it into the current chat, a specific other chat, or a lorebook entry
- 📍 **Configurable Injection Position** — Start, end, or custom index

Access via **"Manage Chats"** button or FAB → Advanced → Chat Mngr.

---

## Floating Action Button (FAB)

A draggable radial-menu overlay for quick access, with three panels:

| Panel | Contents |
|-------|----------|
| **Actions** | Summarize / Run Sharder / Batch Sharder / Stop, plus RAG operations (Vectorize, Purge, Browse) |
| **Overview** | At-a-glance status: current mode, auto/manual, RAG state, output target, active API |
| **Advanced** | Quick links to Themes, Prompts, Cleanup, Visibility, Chat Manager, RAG Settings, API Config, and RAG Debug |

---

## Themes

8 built-in themes plus custom theme creation:

- **Default** (inherits SillyTavern's theme)
- **Fantasy RPG**
- **Midas Touch**
- **Old Parchment**
- **Terminal 101**
- **Nebula**
- **Steampunk**
- **Cyberpunk**

Themes are controlled via 33 CSS variables covering colors, backgrounds, borders, shadows, status indicators, weight colors, and transitions. Custom themes support optional `extraStyles` for advanced CSS overrides and can be imported/exported as JSON.

---

## Batch Processing

Queue multiple message ranges for sequential sharder processing.

- Configure delay between API calls for rate limiting
- Monitor progress through the FAB
- **Abort control** — Cancel in-flight API calls at any time

---

## Prompt Manager Modal

A tabbed interface for managing all prompt templates used by the extension.

### Tabs

| Tab | Contents |
|-----|----------|
| **Summary Prompts** | Main summarization prompt templates |
| **Sharder Prompts** | Structured shard generation prompts |
| **Events Prompt** | Pre-Edit Events extraction prompt |

### Features

- 📝 **Edit** any prompt directly in the modal
- 💾 **Save** custom prompts that persist across sessions
- 🔄 **Reset to Defaults** — Restore original prompts
- 📤 **Export/Import** — Share prompt configurations

Access via **"Manage Prompts"** button.

---

## Configuration Reference

### Mode & Output

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| Mode | Auto / Manual | Auto | Auto-summarize at intervals or trigger manually |
| Auto Interval | 1–100 | 20 | Messages between auto-summaries |
| Output Mode | System / Lorebook | System | Where summaries are saved |
| Sharder Mode | On / Off | Off | Enable structured shard generation |

### Summarization

| Setting | Description |
|---------|-------------|
| Active Prompt | Select from saved summarization prompts |
| Pre-Edit Events | Extract and curate narrative events before generation |
| Summary Review | Review and edit shards section-by-section after generation |
| Length Control | Target summary length as percentage of input (1–30%) |
| Auto-Include Shards | Skip shard selection modal and include all existing shards |

### Quick Reference

| Feature | Access | Requires |
|---------|--------|----------|
| Sharder Mode | Toggle in main panel | — |
| Run Sharder | FAB or settings button | Sharder Mode ON |
| Basic Summary | FAB or settings button | — |
| Batch Sharder | FAB → Actions | Sharder Mode ON |
| Visibility | "Manage Visibility" button | — |
| Lorebook Options | "Lorebook Options" button | Output Mode = Lorebook |
| API Config | "Configure APIs..." button | — |
| Context Cleanup | "Context Cleanup" button | — |
| Prompts | "Manage Prompts" button | — |
| Chat Manager | "Manage Chats" button | — |
| RAG Settings | FAB → Advanced | — |
| RAG Debug | FAB → Advanced | RAG enabled |
| Themes | FAB → Advanced | — |