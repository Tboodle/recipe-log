# Recipe Log — Design Document
_2026-02-17_

## Overview

A self-hosted recipe manager with a bold, simple UI targeting both grandparent-friendly usability and modern aesthetics. Handles recipe import via URL scraping, image OCR, and manual entry. Includes cook mode and shopping list generation in v1. Built to run in Docker.

---

## Goals

- Store and organize household recipes
- Import recipes from URLs, photos, or manual entry
- Cook mode: fullscreen, step-by-step, phone-on-counter friendly
- Generate shopping lists from recipes
- Multi-user household accounts with Google SSO
- Single `docker-compose up` deployment

## Out of Scope (v1)

- Meal planning calendar
- Nutrition detail (field stored as JSONB, not surfaced in UI)
- Recipe scaling
- Full multi-tenant (data model supports it, UX does not)

---

## Architecture

```
Browser → nginx :80
              ├── /api/*  → FastAPI :8000
              └── /*      → Vite static build
```

### Containers

| Service | Image | Role |
|---|---|---|
| `nginx` | nginx:alpine | Reverse proxy + static file server |
| `api` | custom Python | FastAPI application |
| `db` | postgres:16 | Primary data store |

### Local Development

Run `vite dev` and `uvicorn` directly against a local Postgres instance. Docker is production-only.

---

## Frontend

**Stack:** React + Vite, Tailwind CSS, shadcn/ui

### Typography
DM Sans or Plus Jakarta Sans — modern, slightly playful, highly legible.

### Color Palette
```
Neutral base:   zinc-50 / zinc-900
Primary:        amber-400   (yellow — CTAs, highlights)
Success/fresh:  green-500   (tags, checkmarks, saved state)
Danger/spicy:   red-500     (delete, allergens, heat level)
Surface:        white cards on zinc-100 background
```

### Page Map

```
/                    → Dashboard (recent recipes, quick-add)
/recipes             → Recipe list (search, filter by tag/cuisine/diet)
/recipes/new         → Add recipe (tabbed: URL / Image / Manual)
/recipes/:id         → Recipe detail
/recipes/:id/cook    → Cook mode (fullscreen, step-by-step)
/shopping            → Shopping lists index
/shopping/:id        → Shopping list detail (checklist)
/settings            → Household settings, user management
```

### Key UX Decisions

- Recipe import is a single tabbed modal (URL / Photo / Manual) — no page navigations
- Shopping list: checkboxes on ingredient list → "Add checked to list" button
- Search always visible in recipe list header, not behind a filter icon
- Tags rendered as colored chips for at-a-glance scanning
- Cook mode: fullscreen, one step visible, extra-large text, swipe/tap to advance
- Primary actions are always a single obvious button per screen

---

## Backend

**Stack:** Python 3.12, FastAPI, SQLAlchemy (async), Alembic, Authlib, python-jose

### Directory Structure

```
backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── recipes.py
│   │   ├── shopping.py
│   │   ├── auth.py
│   │   └── users.py
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response schemas
│   ├── services/
│   │   ├── parser/
│   │   │   ├── base.py      # Abstract interface
│   │   │   ├── local.py     # recipe-scrapers + BeautifulSoup
│   │   │   └── ai.py        # OpenAI/Anthropic implementation
│   │   ├── ocr/
│   │   │   ├── base.py      # Abstract interface
│   │   │   ├── local.py     # Tesseract
│   │   │   └── ai.py        # Vision API implementation
│   │   └── shopping.py      # List generation logic
│   ├── core/
│   │   ├── config.py        # Settings from env vars
│   │   ├── security.py      # JWT + password hashing
│   │   └── database.py      # SQLAlchemy engine + session
│   └── migrations/          # Alembic
```

### Parser / OCR Abstraction

`parser/base.py` and `ocr/base.py` each define an abstract base class. `local.py` and `ai.py` are concrete implementations. Active backend is selected via `PARSER_BACKEND=local|ai` env var. Switching to full AI is a config change, no code changes required.

### Auth

- Username/password with bcrypt hashing
- Google OAuth2 via Authlib
- JWT issued by FastAPI, validated on every request via dependency injection
- No third-party auth service — fully self-contained

---

## Data Model

### Schema.org Alignment

The `recipes` table maps directly to [schema.org/Recipe](https://schema.org/Recipe).

### Tables

**households**
```
id, name, created_at
```

**users**
```
id, household_id, email, name, google_id, hashed_password,
role (admin|member), created_at
```

**recipes**
```
id, household_id, title, description, image_url, source_url,
servings, prep_time, cook_time, total_time,
cuisine, category, cooking_method,
suitable_for_diet (text[]),
author, nutrition (JSONB),
created_at, updated_at
```

**ingredients** _(maps to schema.org `recipeIngredient`)_
```
id, recipe_id, name, quantity, unit, notes, order
```

**steps** _(maps to schema.org `HowToStep`)_
```
id, recipe_id, title (nullable), description, order, timer_seconds
```

**tags**
```
id, household_id, name, color
```

**recipe_tags** _(join table)_
```
recipe_id, tag_id
```

**shopping_lists**
```
id, household_id, name, created_at
```

**shopping_items**
```
id, list_id, recipe_id (nullable), ingredient_name, quantity, unit, checked
```

### Multi-Tenancy

`household_id` on `recipes`, `shopping_lists`, and `tags` is the tenancy boundary. Expanding to full multi-tenant in the future requires no schema changes — only access control policy updates.

---

## Deployment

### Environment Variables

```
POSTGRES_URL=postgresql+asyncpg://user:pass@db:5432/recipedb
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
PARSER_BACKEND=local        # or "ai"
OPENAI_API_KEY=             # optional, only needed if PARSER_BACKEND=ai
```

### Deploy

```bash
git clone <repo>
cp .env.example .env        # fill in values
docker-compose up -d
```

### Data Backup

Postgres data is volume-mounted. Backup via `pg_dump`, documented in README with a simple cron example.

### CI/CD

GitHub Actions builds and pushes a multi-arch image (amd64 + arm64) to GitHub Container Registry on git tags. Server update: `docker-compose pull && docker-compose up -d`.

---

## Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Frontend framework | React + Vite | SPA, no SSR needed, fast builds |
| UI components | shadcn/ui + Tailwind | Accessible base, full design control |
| Backend language | Python + FastAPI | Best ecosystem for OCR/scraping |
| Auth | Authlib + python-jose | Self-contained, Google SSO, no extra container |
| Database | Postgres 16 | Multi-tenant ready, no migration needed later |
| ORM | SQLAlchemy async + Alembic | Mature, supports Postgres fully |
| Parser/OCR | Hybrid (local default, AI optional) | Cost-free default, AI swap is config-only |
| Deployment | docker-compose + nginx | Simple, single-command, standard pattern |
