# 001: Adding CLAUDE.md — Project Guidance for AI Coding Assistants

## What was done

Created a `CLAUDE.md` file at the repo root. This file tells Claude Code (and future AI coding sessions) how the project works — what commands to run, how the code is structured, and what design rules to follow.

## Why this matters

When you use an AI coding tool like Claude Code, it doesn't automatically know your project. Every time you start a new session, it has to figure out your codebase from scratch. `CLAUDE.md` solves this — it's a cheat sheet that gets loaded into Claude Code's context automatically, so it can be productive immediately.

Think of it like onboarding docs for a new teammate, except the teammate is an AI.

## Concepts to know

**Repository root**: The top-level folder of your project (where `.git/` lives). Files here like `CLAUDE.md`, `README.md`, and `.gitignore` are project-wide configuration and documentation.

**Git commit + push workflow**: When you make changes locally, they only exist on your machine. The workflow is:
1. `git add <file>` — stage the file (mark it for inclusion in the next snapshot)
2. `git commit -m "message"` — save a snapshot of staged changes with a description
3. `git push` — upload your commits to the remote repository (GitHub)

Until you push, your collaborators (and other devices) can't see your changes.

**Environment variables** (`.env.local`): Secret values like API keys that your app needs to run but should never be committed to Git. The `.env.example` file shows what variables are needed without the actual secret values — it's a template.

## Files changed

- **Created**: `CLAUDE.md` — project guidance file covering commands, architecture, API routes, design principles, and known tech debt
