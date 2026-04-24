# GitHub Actions CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single GitHub Actions workflow that runs frontend lint/type-check/build, backend lint/format/tests, and Docker builds on every PR targeting `main` or `dev`.

**Architecture:** Three parallel jobs in one workflow file. Two supporting config files are created first (ESLint, Ruff), all CI commands are verified locally before the workflow is committed.

**Tech Stack:** GitHub Actions, ESLint v9 (flat config), typescript-eslint, Ruff, pytest, Docker Buildx

---

## File Map

| File | Change |
|------|--------|
| `frontend/eslint.config.js` | Create — ESLint v9 flat config |
| `frontend/package.json` | Modify — add ESLint devDependencies |
| `backend/ruff.toml` | Create — Ruff lint/format config |
| `.github/workflows/ci.yml` | Create — CI workflow (last, after all checks pass) |

---

## Task 1: Install ESLint packages and create eslint.config.js

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/eslint.config.js`

The frontend `package.json` has a `lint` script (`eslint .`) but no ESLint packages. Install them first.

- [ ] **Step 1: Install ESLint and plugins**

  Run from `frontend/`:

  ```bash
  cd frontend
  npm install -D eslint @eslint/js globals typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
  ```

  Expected: packages added to `devDependencies`, `package-lock.json` updated.

- [ ] **Step 2: Create `frontend/eslint.config.js`**

  Create the file with this exact content:

  ```js
  import js from '@eslint/js'
  import globals from 'globals'
  import reactHooks from 'eslint-plugin-react-hooks'
  import reactRefresh from 'eslint-plugin-react-refresh'
  import tseslint from 'typescript-eslint'

  export default tseslint.config(
    { ignores: ['dist'] },
    {
      extends: [js.configs.recommended, ...tseslint.configs.recommended],
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        ecmaVersion: 2020,
        globals: globals.browser,
      },
      plugins: {
        'react-hooks': reactHooks,
        'react-refresh': reactRefresh,
      },
      rules: {
        ...reactHooks.configs.recommended.rules,
        'react-refresh/only-export-components': [
          'warn',
          { allowConstantExport: true },
        ],
      },
    },
  )
  ```

- [ ] **Step 3: Run lint locally and fix any errors**

  Run from `frontend/`:

  ```bash
  npm run lint
  ```

  Expected: exits 0 with no errors (warnings about `react-refresh/only-export-components` are fine — they are warnings, not errors, and will not fail CI).

  If there are errors, fix the flagged files before continuing. Common issues:
  - `@typescript-eslint/no-explicit-any` → replace `any` with proper type or `unknown`
  - `@typescript-eslint/no-unused-vars` → remove or prefix with `_`

- [ ] **Step 4: Run type-check locally**

  ```bash
  npx tsc --noEmit
  ```

  Expected: exits 0 (already passing from earlier work).

- [ ] **Step 5: Run build locally**

  ```bash
  npm run build
  ```

  Expected: exits 0, `dist/` is created.

- [ ] **Step 6: Commit**

  ```bash
  cd ..
  git add frontend/eslint.config.js frontend/package.json frontend/package-lock.json
  git commit -m "chore: add ESLint config and install ESLint packages"
  ```

---

## Task 2: Create Ruff config and fix backend violations

**Files:**
- Create: `backend/ruff.toml`

- [ ] **Step 1: Install Ruff**

  ```bash
  pip install ruff
  ```

- [ ] **Step 2: Create `backend/ruff.toml`**

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

  `E/W` = pycodestyle errors/warnings, `F` = pyflakes (unused imports, undefined names), `I` = isort (import ordering). `E501` (line too long) is ignored — the formatter enforces line length on format, not as a lint error.

- [ ] **Step 3: Run ruff check and auto-fix safe violations**

  Run from repo root:

  ```bash
  ruff check backend/ --fix
  ```

  Expected: Ruff fixes safe violations (import ordering, whitespace). Reports remaining issues (if any) that need manual review.

- [ ] **Step 4: Run ruff format**

  ```bash
  ruff format backend/
  ```

  Expected: formats all `.py` files in-place. Check the diff to make sure nothing unexpected changed.

- [ ] **Step 5: Verify no remaining violations**

  ```bash
  ruff check backend/
  ruff format --check backend/
  ```

  Both must exit 0. If `ruff check` still reports issues, fix them manually. Common residual issues:
  - `F401` unused import → remove the import
  - `F811` redefinition of unused name → remove the duplicate

- [ ] **Step 6: Commit**

  ```bash
  git add backend/ruff.toml
  git add backend/  # include any source files fixed by ruff
  git commit -m "chore: add Ruff config and fix backend lint/format violations"
  ```

---

## Task 3: Verify backend tests pass

**Files:** None (read-only verification step)

- [ ] **Step 1: Install test dependencies**

  ```bash
  pip install pytest pytest-asyncio httpx
  ```

  Note: `httpx` is required by the tests (`from httpx import ASGITransport, AsyncClient`). It is not in `requirements.txt` — it is a dev-only dependency.

- [ ] **Step 2: Run tests**

  Run from repo root:

  ```bash
  pytest backend/tests/ -v --tb=short
  ```

  Expected: all tests pass. If tests fail, investigate and fix before proceeding — the CI job will run exactly this command.

  If there are import errors, ensure you are running from the repo root (not from `backend/`) so that `from app.xxx import` resolves correctly.

- [ ] **Step 3: Commit any fixes**

  If any backend source files were changed to fix failing tests:

  ```bash
  git add backend/
  git commit -m "fix: resolve failing backend tests"
  ```

  If tests all pass with no source changes, skip this commit.

---

## Task 4: Create the CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

This is the last step — committed only after all local checks pass.

- [ ] **Step 1: Create the workflow directory**

  ```bash
  mkdir -p .github/workflows
  ```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

  ```yaml
  name: CI

  on:
    pull_request:
      branches: [main, dev]

  jobs:
    frontend-ci:
      name: Frontend — lint, type-check, build
      runs-on: ubuntu-latest
      defaults:
        run:
          working-directory: frontend

      steps:
        - uses: actions/checkout@v4

        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: npm
            cache-dependency-path: frontend/package-lock.json

        - name: Install dependencies
          run: npm ci

        - name: Type-check
          run: npx tsc --noEmit

        - name: Lint
          run: npm run lint

        - name: Build
          run: npm run build

    backend-ci:
      name: Backend — lint, format, tests
      runs-on: ubuntu-latest

      steps:
        - uses: actions/checkout@v4

        - uses: actions/setup-python@v5
          with:
            python-version: "3.12"
            cache: pip
            cache-dependency-path: backend/requirements.txt

        - name: Install dependencies
          run: pip install -r backend/requirements.txt

        - name: Install dev dependencies
          run: pip install ruff pytest pytest-asyncio httpx

        - name: Lint
          run: ruff check backend/

        - name: Format check
          run: ruff format --check backend/

        - name: Tests
          run: pytest backend/tests/ -v --tb=short

    docker-build:
      name: Docker — build images
      runs-on: ubuntu-latest

      steps:
        - uses: actions/checkout@v4

        - uses: docker/setup-buildx-action@v3

        - name: Build frontend image
          run: docker build ./frontend

        - name: Build backend image
          run: docker build ./backend
  ```

- [ ] **Step 3: Run the complete local dry-run**

  Run every command the CI will execute, in order, from the repo root:

  ```bash
  # frontend-ci job
  cd frontend
  npm ci
  npx tsc --noEmit
  npm run lint
  npm run build
  cd ..

  # backend-ci job
  pip install -r backend/requirements.txt
  pip install ruff pytest pytest-asyncio httpx
  ruff check backend/
  ruff format --check backend/
  pytest backend/tests/ -v --tb=short

  # docker-build job
  docker build ./frontend
  docker build ./backend
  ```

  All commands must exit 0. Fix any failures before the next step.

- [ ] **Step 4: Commit**

  ```bash
  git add .github/workflows/ci.yml
  git commit -m "ci: add GitHub Actions CI workflow (lint, type-check, build, tests, docker)"
  ```

---

## Self-Review

- **ESLint packages task:** `globals` explicitly installed alongside `eslint` ✓
- **Ruff `--fix` before `--check`:** auto-fixes safe violations first, then verifies clean ✓
- **`httpx` not in requirements.txt:** noted and installed as dev dep in both local verification and CI job ✓
- **Docker build verified:** user confirmed both images build cleanly with `docker compose up --build` ✓
- **Workflow committed last:** commit order enforces local-first verification ✓
- **No placeholders:** all commands exact, all file contents complete ✓
