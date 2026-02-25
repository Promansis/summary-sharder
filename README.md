# Summary Sharder

**Compress long roleplay chats into recoverable Memory Shards for SillyTavern.**

![SillyTavern Extension](https://img.shields.io/badge/SillyTavern-Extension-8865e0)
![Version](https://img.shields.io/badge/version-0.9-blue)

## Table of Contents
- [Key Features](#key-features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Config Overview](#configuration-overview)
- [Troubleshooting](#Troubleshootig)
- [Credits](#credits)

---

## What Is It?

Summary Sharder is a SillyTavern extension that captures chat history before it falls out of context. It summarizes message ranges into structured "Memory Shards" with 16 labeled sections, manages message visibility, and routes output to system messages or lorebook entries — so nothing important is forgotten. The Memory Sharding concept is based off the Memory Shard prompt by [TheLonelyDevil](https://github.com/TheLonelyDevil9/) .

An optional **RAG pipeline** vectorizes shards and automatically injects relevant memories into future generations. Shoutout to [Coneja-Chibi](https://github.com/Coneja-Chibi) for the Similharity plugin that made this part possible.

---

## Key Features

- **Basic Summary** — Prose summaries of selected message ranges
- **Sharder Mode** — Structured 16-section Memory Shards with scene codes for cross-referencing
- **Review Pipeline** — Curate events before generation, edit/weight/prune sections after
- **RAG Integration** — Vectorize shards (Vectra, LanceDB, Qdrant, Milvus) with BM25/hybrid scoring and scene expansion
- **Chat Manager** — Browse, export, delete, and cross-chat summarize from any character
- **Visibility Controls** — Hide or collapse summarized ranges with per-range speaker ignore lists
- **Lorebook Output** — Save to World Info with auto-keywords, naming templates, and entry type control
- **Per-Feature APIs** — Different endpoints/settings for summary, sharder, events, and chat manager
- **Context Cleanup** — Strip HTML, code blocks, URLs, emojis, reasoning blocks, and custom regex
- **Batch Processing** — Queue multiple ranges for sequential sharder processing
- **Themes** — 8 built-in themes plus custom theme creation/import/export
- **FAB** — Draggable floating action button with quick access to all features

> 📖 **[Full Feature Documentation →](FEATURES.md)**

---

## Installation

### Via SillyTavern Extension Installer (Recommended)

1. Open SillyTavern
2. Go to **Extensions** (stacked boxes icon) → **Install Extension**
3. Paste: `https://github.com/Promansis/summary-sharder`
4. Click **Install** and restart SillyTavern

### Manual

Clone into `data/<user-data>/extensions/third-party/summary-sharder` and restart SillyTavern.

---

## Quick Start

1. Open the **Extensions** panel and enable **Summary Sharder**
2. The FAB (floating action button) appears — drag it where you like

### Basic Summary
- Open a chat and enter a message range → click **Summarize**
- Review/edit if enabled → saved as system message or lorebook entry

### Sharder Mode
- Enable **Sharder Mode** in settings
- Select a range → click **Run Sharder**
- Review the 16-section shard → edit, weight, prune → save

### RAG
1. **Install Prerequisite Plugin** [Similharity](https://github.com/Coneja-Chibi/VectHare/tree/Similharity-Plugin)
2. Choose backend/embedding server/reranker ([Bananabread by Prolix](https://github.com/prolix-oc/BananaBread/tree/main/bananabread) is a great local embedding option.)
- Enable RAG in settings → choose a vector DB backend
- Vectorize existing shards → new shards auto-vectorize
- Relevant memories inject automatically during generation

---

## Configuration Overview

| Category | Key Settings |
|----------|-------------|
| **Mode** | Auto/Manual, auto-interval (1–100 messages) |
| **Output** | System messages or Lorebook entries |
| **Sharder** | 16-section structured shards with scene codes |
| **Review** | Pre-edit events, post-summary review with weights |
| **RAG** | Backend, scoring method, insert count, score threshold |
| **APIs** | Independent endpoint/temp/tokens per feature |
| **Cleanup** | HTML, code, URLs, emojis, reasoning blocks, custom regex |
| **Visibility** | Per-range hide/collapse, speaker ignore lists |
| **Themes** | 8 built-in + custom (33 CSS variables) |

> 📖 **[Full configuration reference →](FEATURES.md#configuration-reference)**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not appearing | Verify path is `data/<user-data>/extensions/third-party/summary-sharder/` and restart |
| RAG not injecting | Ensure your Backend and Embedding servers are configured according to their docs. |
| Visibility delay on load | ~1 second delay is expected while the DOM initializes |
| API errors | Each feature may use a different endpoint — check per-feature API config |

---


## 🙌 Credits 
 - [TheLonelyDevil](https://github.com/TheLonelyDevil9/) - For listening to my rambling and stopping (trying to) my scope drift and distractions
 - [Coneja-Chibi](https://github.com/Coneja-Chibi) - Similharity and VectHare creator - Started my RAG journey with Vecthare, Similharity is a lifesaver.

## Author
- [Promansis](https://github.com/Promansis/summary-sharder)


## License

[MIT](LICENSE)
