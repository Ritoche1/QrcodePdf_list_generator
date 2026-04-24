# GitHub Actions CI — Design Spec
_Date: 2026-04-24_

## Overview

A single GitHub Actions workflow that runs quality checks on every PR targeting `main` or `dev`. Three parallel jobs cover the frontend, backend, and Docker builds. Supporting linter config files are created alongside the workflow. Every CI command is verified locally before committing.

---

## Trigger

```yaml
on:
  pull_request:
    branches: [main, dev]
```

Runs on PR open, synchronize, and reopen. No push triggers.

---

## Workflow File

**Path:** `.github/workflows/ci.yml`

Three parallel jobs — all must pass for a PR to be mergeable (enforced via GitHub branch protection rules, configured manually after the workflow is live).

---

## Job 1: `frontend-ci`

**Runner:** `ubuntu-latest`  
**Node version:** 20  
**Cache:** `~/.npm` keyed on `package-lock.json`

Steps:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version: 20` and `cache: npm`, `cache-dependency-path: frontend/package-lock.json`
3. `npm ci` in `frontend/`
4. `npx tsc --noEmit` — type errors fail the job
5. `npm run lint` — ESLint errors fail the job
6. `npm run build` — broken production bundle fails the job

**Prerequisite config:** `frontend/eslint.config.js` must exist and pass locally before the workflow is committed.

---

## Job 2: `backend-ci`

**Runner:** `ubuntu-latest`  
**Python version:** 3.12  
**Cache:** pip, keyed on `requirements.txt`

Steps:
1. `actions/checkout@v4`
2. `actions/setup-python@v5` with `python-version: 3.12`
3. `pip install -r backend/requirements.txt`
4. `pip install ruff pytest pytest-asyncio httpx` (dev/test deps)
5. `ruff check backend/` — lint errors fail the job
6. `ruff format --check backend/` — unformatted code fails the job
7. `pytest backend/tests/ -v --tb=short` — test failures fail the job

**Prerequisite config:** `backend/ruff.toml` must exist and `ruff check` + `ruff format --check` must pass locally before the workflow is committed.

---

## Job 3: `docker-build`

**Runner:** `ubuntu-latest`  
**Tool:** Docker Buildx via `docker/setup-buildx-action@v3`

Steps:
1. `actions/checkout@v4`
2. `docker/setup-buildx-action@v3`
3. Build frontend: `docker build ./frontend` (no push, no tag required)
4. Build backend: `docker build ./backend` (no push, no tag required)

Verifies Dockerfiles stay buildable. No registry credentials needed.

---

## Supporting Config Files

### `frontend/eslint.config.js`
ESLint v9 flat config. Covers:
- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `eslint-plugin-react-hooks` recommended rules
- `eslint-plugin-react-refresh` (Vite HMR safety)
- Ignores `dist/`

Required ESLint packages (already present in Vite-scaffolded projects):
- `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`

### `backend/ruff.toml`
```toml
target-version = "py312"
line-length = 100

[lint]
select = ["E", "W", "F", "I"]
ignore = ["E501"]

[format]
quote-style = "double"
indent-style = "space"
```

`E/W` = pycodestyle, `F` = pyflakes, `I` = isort. `E501` (line too long) ignored since line-length enforces it via formatter.

---

## Local Verification Protocol

Before committing any file, every CI command is run locally and must pass:

**Frontend:**
```bash
cd frontend
npm ci
npx tsc --noEmit
npm run lint
npm run build
```

**Backend:**
```bash
pip install ruff pytest pytest-asyncio httpx
ruff check backend/
ruff format --check backend/
pytest backend/tests/ -v --tb=short
```

**Docker:**
```bash
docker build ./frontend
docker build ./backend
```

Any failure is fixed before committing. The workflow file is committed last, after all supporting configs are verified.

---

## Commit Order

1. `frontend/eslint.config.js` — after local lint passes
2. `backend/ruff.toml` — after local ruff passes
3. `backend/` source fixes — if ruff finds existing violations
4. `frontend/` source fixes — if ESLint finds existing violations
5. `.github/workflows/ci.yml` — last, after all checks pass locally

---

## Out of Scope

- CD / deployment on merge
- Coverage reporting or badge
- Dependabot / security scanning
- Docker image push to registry
- Release tagging
