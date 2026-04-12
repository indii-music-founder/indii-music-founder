# ============================================================
#  indiiOS — Developer Task Runner
#  Usage: make <target>
# ============================================================

.PHONY: help prime dev dev-web build ship doctor clean test test-e2e lint fix typecheck seed reset-env deploy

# ── Meta ──────────────────────────────────────────────────

help: ## Show all available targets
	@echo ""
	@echo "  indiiOS Task Runner"
	@echo "  ─────────────────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ── Setup / Bootstrap ────────────────────────────────────

prime: ## Full setup → install, doctor check, start dev server
	npm install
	bash scripts/doctor.sh
	@echo ""
	@echo "  ✓ Environment primed. Run 'make dev' or 'make dev-web' to start."
	@echo ""

reset-env: ## Reset .env from .env.example with guided prompts
	bash scripts/setup-env.sh

# ── Development ──────────────────────────────────────────

dev: ## Start full Electron dev environment (:4242)
	npm run dev

dev-web: ## Start Vite renderer only — no Electron (:4243)
	npm run dev:web

# ── Quality ──────────────────────────────────────────────

lint: ## ESLint all packages
	npm run lint

fix: ## ESLint auto-fix all packages
	npm run lint:fix

typecheck: ## TypeScript type check (all packages)
	npm run typecheck

doctor: ## Run unified environment health check
	bash scripts/doctor.sh

test: ## Run Vitest unit tests (watch mode)
	npm test

test-ci: ## Run Vitest once (CI mode, no watch)
	npm test -- --run

test-e2e: ## Run Playwright E2E tests (Chromium)
	npm run test:e2e

test-e2e-all: ## Run Playwright E2E tests (all browsers)
	npm run test:e2e:all

# ── Build & Deploy ───────────────────────────────────────

build: ## Production build (Vite + electron-vite, fast)
	npm run build

build-ci: ## CI build: typecheck + lint + build (gated)
	npm run build:ci

ship: ## Full ship pipeline: lint → typecheck → test → build → deploy
	npm run lint
	npm run typecheck
	npm test -- --run
	npm run build
	firebase deploy --only hosting:app
	@echo ""
	@echo "  🚀 Shipped to production."
	@echo ""

deploy: ## Build and deploy studio to Firebase Hosting
	npm run deploy

deploy-functions: ## Build and deploy Cloud Functions
	npm run deploy:functions

deploy-all: ## Build everything and deploy all targets
	npm run deploy:all

# ── Desktop ──────────────────────────────────────────────

desktop: ## Build desktop app for current platform
	npm run electron:build

desktop-dev: ## Run Electron in dev mode (alias for dev)
	npm run desktop:dev

# ── Database & Seed ──────────────────────────────────────

seed: ## Seed a test user with full profile data
	npx tsx scripts/seed-test-user.ts

seed-all: ## Seed everything: users, earnings, licensing, touring
	npx tsx scripts/seed-test-user.ts
	npx tsx scripts/seed-earnings.ts
	npx tsx scripts/seed-licensing.ts
	npx tsx scripts/seed-touring.ts
	@echo "  ✓ All seed data loaded."

# ── Cleanup ──────────────────────────────────────────────

clean: ## Remove build artifacts and caches
	rm -rf dist packages/*/dist packages/renderer/.vite .turbo
	@echo "  ✓ Build artifacts cleaned."

nuke: ## Nuclear clean: rm node_modules + dist + reinstall
	rm -rf node_modules packages/*/node_modules dist packages/*/dist .turbo
	npm install
	@echo "  ✓ Full reset complete."

# ── Changelog ────────────────────────────────────────────

changelog: ## Generate CHANGELOG.md from git history
	npm run changelog

# ── Default ──────────────────────────────────────────────

.DEFAULT_GOAL := help
