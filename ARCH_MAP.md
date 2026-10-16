# RepoLens Architecture & State Map

## Overview
RepoLens is an AI-powered codebase intelligence platform built with React + Vite frontend, Express backend, PostgreSQL with pgvector, and BullMQ/Redis (with automatic in-process fallback).

## Components
- **Client (`/client`)**: React 19, Tailwind CSS, React Router DOM, React Markdown, Prism Syntax Highlighter, Lucide icons.
  - `LandingPage`: URL input with real-time validation, example repository triggers, platform capability showcase.
  - `RepositoryPage`: Real-time indexing progress, file tree explorer, code viewer with syntax highlighting and line targeting, hybrid code search, and contextual AI chat.
  - `FileTree`: Hierarchical folder/file tree with language detection dots and search filter.
  - `CodeViewer`: High-performance code view with copy button, line numbers, and direct GitHub deep-links.
  - `SearchPanel`: Vector & keyword search with similarity scores and code snippets.
  - `ChatPanel`: Multi-turn conversational interface with file and line citations.
- **Server (`/server`)**:
  - `github.service.js`: Repository validation, SSRF protection, recursive tree fetching, noise filtering (binaries, lockfiles, node_modules), bounded concurrency file fetching.
  - `chunking.service.js`: Semantic function/class boundary splitting with overlap, text-split fallback, SHA-256 content hashing.
  - `embedding.service.js`: Provider-agnostic embedding interface (OpenAI, Ollama, etc.) with batching and dimension validation.
  - `retrieval.service.js`: Hybrid retrieval fusing cosine vector similarity with PostgreSQL full-text search (`ts_rank`), isolated by repository ID.
  - `llm.service.js`: Grounded generation with strict prompt boundaries against prompt injection from repository contents and automatic fallback on insufficient evidence.
  - `jobs/queue.js`: BullMQ Redis worker with exponential backoff and seamless in-process development fallback.
  - `db/migrations.js` & `db/pool.js`: Schema migrations, connection pooling, and pgvector IVFFlat indexing.
- **Tests (`/server/tests`)**:
  - `github.test.js`: URL parsing, SSRF defenses, noise filtering.
  - `chunking.test.js`: Line preservation, function boundaries, hashing, text splitting.
  - `api.test.js`: REST endpoints, rate limiting, validation, error handling.
  - `retrieval.test.js`: Vector & keyword hybrid search, repository isolation, citation formatting.
  - `llm.test.js`: Grounding, prompt building, timeout & rate-limit handling.

## Technical Changelog
- Fixed infinite loop in `textSplitChunks` by adding termination checks on boundary conditions and forward progress enforcement.
- Installed missing frontend dependencies, added SVG `GithubIcon`, verified Vite client build, and expanded unit test coverage to 42 passing tests across 5 suites.
- Added standalone SQL migration scripts in `database/migrations/`, root `.env.example`, and a comprehensive production `README.md`.
- Initialized isolated Git repository on `main` branch and recorded initial root commit (`cab62fc`) with all verified project assets.
- Configured remote tracking repository at `https://github.com/Akarsh-1608/RepoLens.git` under `origin`. Pushed the local `main` branch to upstream origin and established default branch tracking.

