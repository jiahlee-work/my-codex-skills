---
name: env-setup
description: Create fixed environment file templates. Use when Codex needs to add missing .env.example, missing .env.local, and missing .gitignore env ignore patterns for Next.js or React/TypeScript projects without reading existing secret values.
---

# Env Setup

## Required User Choice

Before writing files, ask for project type unless the request already answers it:

- `Next.js`
- `React/TypeScript`

## Workflow

1. Check only whether `.env.example` and `.env.local` exist. Do not read their
   contents.
2. Write fixed env templates only for missing files:
   - Next.js: use `assets/env.example.next` and `assets/env.local.next`
   - React/TypeScript: use `assets/env.example.react` and
     `assets/env.local.react`
3. Create these files when missing:
   - `.env.example`
   - `.env.local`
4. If `.env.example` or `.env.local` already exists, leave it unchanged. Do not
   ask to overwrite it unless the user explicitly requested replacement.
5. Read `.gitignore` only to check whether the required env ignore patterns are
   present. Do not inspect other files for env values.
6. Ensure `.gitignore` contains:
   - `.env`
   - `.env.local`
   - `.env.*.local`
7. If `.gitignore` does not exist, create it with those patterns.
8. Do not add real API keys, tokens, passwords, URLs for private services, or
   user-specific values.

## Completion

Report files written, files skipped because they already existed, and whether
`.gitignore` was created or updated.
