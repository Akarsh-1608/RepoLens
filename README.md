# RepoLens — AI-Powered Codebase Intelligence Platform

RepoLens is a production-minded web application that analyzes real GitHub repositories, indexes actual source code, and enables vector-based semantic code retrieval and AI-powered repository Q&A with deep line-level source citations.

---

## Technical Highlights

- **Pure JavaScript & Modern Architecture:** ES modules throughout, Node.js + Express backend, React 19 + Vite frontend with Tailwind CSS.
- **pgvector & Hybrid Retrieval:** Combines cosine distance vector similarity via pgvector with PostgreSQL full-text search (`ts_rank`) for hybrid retrieval with repository-level isolation.
- **Intelligent Code Chunking:** Function and class boundary detection across JS, TS, Python, Go, and Java with sliding window overlaps, deterministic SHA-256 content hashing, and line number tracking.
- **Resilient Background Processing:** Asynchronous indexing powered by Redis and BullMQ with exponential backoff and retry policies, plus an automatic in-process fallback for local environments without Redis.
- **Security & Reliability Safeguards:**
  - Strict GitHub URL validation and SSRF defenses (rejects local, cloud metadata, or malicious hostnames).
  - Noise filtering: drops dependency folders (`node_modules`, `vendor`), binaries, lockfiles, and minified bundles.
  - Bounded concurrency and rate limiting when calling GitHub and AI APIs.
  - Context isolation: untrusted repository files and READMEs cannot execute code or override system instructions.
  - Grounded answers: the AI explicitly reports insufficient evidence rather than hallucinating details.

---

## Architecture

```
repolens/
├── client/                     # React 19 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/         # FileTree, CodeViewer, SearchPanel, ChatPanel, Navbar
│   │   │   └── ui/             # Design system components (Card, Button, Spinner, etc.)
│   │   ├── pages/              # LandingPage, RepositoryPage
│   │   └── services/           # Axios API client
│   └── vite.config.js
├── server/                     # Node.js + Express Backend
│   ├── src/
│   │   ├── db/                 # PostgreSQL pool and automatic schema migrations
│   │   ├── jobs/               # BullMQ worker & in-process fallback queue
│   │   ├── middleware/         # Error handling, rate limiting, logging
│   │   ├── repositories/       # Data access layer for repositories, files, chunks, chats
│   │   ├── routes/             # REST API routers (/repositories, /files, /search, /ask, /jobs)
│   │   ├── services/           # GitHub ingestion, chunking, embeddings, retrieval, LLM
│   │   ├── validators/         # Zod schemas for input validation
│   │   ├── app.js              # Express app definition
│   │   └── server.js           # Server lifecycle and graceful shutdown
│   └── tests/                  # Vitest & Supertest automated test suite
├── database/
│   └── migrations/             # Standalone SQL schema migrations with pgvector
├── ARCH_MAP.md                 # Technical architecture map & state tracking
├── package.json                # Workspace root with orchestrated scripts
└── README.md
```

---

## Prerequisites

- **Node.js:** v18.0.0 or later (v20+ recommended)
- **PostgreSQL:** v15+ with `pgvector` extension enabled
- **Redis:** (Optional) required for BullMQ production mode; automatic fallback is provided when unset.

---

## Quickstart

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/repolens.git
cd repolens
npm install
```

### 2. Configure Environment

Copy `.env.example` in `server/` (or root):

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your settings:

```ini
# PostgreSQL with pgvector
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/repolens

# Redis (Set USE_QUEUE_FALLBACK=true if you don't run local Redis)
REDIS_URL=redis://localhost:6379
USE_QUEUE_FALLBACK=true

# GitHub Token (Optional: increases unauthenticated rate limit from 60 to 5,000 req/hr)
GITHUB_TOKEN=

# AI Provider (OpenAI or any OpenAI-compatible API)
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=https://api.openai.com/v1

EMBEDDING_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
EMBEDDING_BASE_URL=https://api.openai.com/v1

PORT=3001
CLIENT_URL=http://localhost:5173
```

### 3. Database Initialization

Ensure PostgreSQL is running and initialize the database:

```bash
# In psql:
CREATE DATABASE repolens;
\c repolens
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

Migrations will automatically apply when the backend starts, or you can run:

```bash
npm run setup:db
```

### 4. Run the Application

Start both backend and frontend concurrently:

```bash
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3001](http://localhost:3001)
- **Health Check:** [http://localhost:3001/health](http://localhost:3001/health)

---

## REST API Reference

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/repositories` | Submit a public GitHub repository for indexing | `202 Accepted` |
| `GET` | `/api/repositories` | List indexed repositories with pagination | `200 OK` |
| `GET` | `/api/repositories/:id` | Fetch repository details and latest job status | `200 OK` |
| `GET` | `/api/repositories/:id/files` | Get paginated file tree | `200 OK` |
| `GET` | `/api/repositories/:id/files/:path(*)` | Get specific source file content | `200 OK` |
| `POST` | `/api/repositories/:id/search` | Execute vector, keyword, or hybrid code search | `200 OK` |
| `POST` | `/api/repositories/:id/ask` | Ask natural language question with cited sources | `200 OK` |
| `POST` | `/api/repositories/:id/reindex` | Trigger reindexing on latest commit | `202 Accepted` |
| `GET` | `/api/jobs/:id` | Poll background indexing job progress | `200 OK` |
| `GET` | `/health` | Liveness probe | `200 OK` |
| `GET` | `/ready` | Readiness probe (verifies database connectivity) | `200 / 503` |

---

## Testing

Run the full automated test suite (all unit and integration tests):

```bash
npm test
```

### Test Coverage Highlights

- **`github.test.js`**: Validates URL structure, SSRF defenses, noise filtering, and file size constraints.
- **`chunking.test.js`**: Verifies function boundary detection, content hashing, line preservation, and text splitting termination.
- **`api.test.js`**: Tests request schema validation, duplicate submission handling, and HTTP error responses.
- **`retrieval.test.js`**: Ensures repository vector search isolation, hybrid score deduplication, and GitHub line-referenced citation URLs.
- **`llm.test.js`**: Validates grounded context formatting, timeout resiliency, and rate limit error handling.

---

## License

MIT
