# Implementation Plan - Project Isolation & Rebranding

## Context
The goal is to sever the `indii-music-founder` project from its legacy agency roots (wiil-tech / The Walking Agency) and ensure a pristine, decoupled codebase ready for a fresh Google Cloud / Firebase deployment.

## Blockers
- None.

## Tasks

- [x] **Repository Rebranding:** GitHub remote set to `wiil-tech/indii-music-founder`.
- [ ] **Codebase Audit:** Run regex/search for hardcoded legacy keys (`AIza`, `sk-`, `ghp_`, DPID, SFTP hosts, `indiios-v-1-1`, etc.).
- [x] **Environment Security:** Sanitized `.env.example`.
- [ ] **Firebase Prep:** Strip `indiios-v-1-1` references from `firebase.json` and `.firebaserc`.
- [ ] **Final Audit Trail:** Generate a security clearance report in `.agent/artifacts`.

## Goal
A completely decoupled project, independent from all previous organizational infrastructure, with zero leaked legacy credentials.
