# Contributing to QRCodePDF

Thanks for your interest in contributing! This document explains how to get started.

## Development Setup

### Prerequisites

- **Python 3.12+** (backend)
- **Node.js 20+** (frontend)
- **Docker & Docker Compose** (optional, for full-stack)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create data directory
mkdir -p /tmp/qrcodepdf-data

# Start the server with hot-reload
DATA_DIR=/tmp/qrcodepdf-data uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies `/api` requests to the backend.

### Full Stack (Docker)

```bash
docker compose up --build
```

Access the app at `http://localhost`.

---

## Code Style

### Backend (Python)
- Follow PEP 8
- Use type hints everywhere
- Use `async def` for all route handlers and database operations
- Keep services in `app/services/`, route logic minimal
- Pydantic v2 schemas in `app/schemas/`

### Frontend (TypeScript)
- Strict TypeScript — no `any` types
- Functional components with hooks
- Use TanStack Query for all API calls (no raw `useEffect` + `fetch`)
- Tailwind CSS for styling — no inline styles, no CSS modules
- Components go in `src/components/`, pages in `src/pages/`

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Wi-Fi QR type support
fix: correct PDF margin calculation
docs: update API reference
refactor: extract QR validation logic
test: add import service tests
chore: update dependencies
```

---

## Pull Request Process

1. **Fork & branch**: create a feature branch from `main`
2. **Write code**: follow the code style above
3. **Test**: make sure the app works end-to-end
4. **Commit**: use conventional commit messages
5. **PR**: open a pull request with a clear description of what changed and why
6. **Review**: address any feedback

---

## Adding a New QR Content Type

1. Add the type to `ContentType` enum in `backend/app/schemas/entry.py`
2. Add validation logic in `backend/app/services/qr_service.py` → `_encode_content()`
3. Add the form fields in `frontend/src/components/qr/QrContentForm.tsx`
4. Add the type option in `frontend/src/components/qr/QrTypeSelector.tsx`
5. Update the `QrContentData` union type in `frontend/src/types/entry.ts`

---

## Adding a New Export Format

1. Create or extend a service in `backend/app/services/`
2. Add the route in `backend/app/api/routes/`
3. Add the API call in `frontend/src/lib/api.ts`
4. Add the UI trigger in the relevant page/component

---

## Reporting Bugs

Open a [GitHub Issue](https://github.com/Ritoche1/QrcodePdf_list_generator/issues) with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/OS info
- Screenshots if applicable

---

## Feature Requests

Check the existing [issues](https://github.com/Ritoche1/QrcodePdf_list_generator/issues) first — your idea might already be there. If not, open a new issue with the `enhancement` label.

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
