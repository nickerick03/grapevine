# AGENTS.md

## Project overview
This is a React / TypeScript / Tailwind app built with Vite.

## Coding style
- Reuse existing components before creating new ones.
- Follow the existing folder structure.
- Use Tailwind classes in the same style as nearby components.
- Keep components small and readable.
- Do not introduce new dependencies without asking.
- Prefer existing API helpers and validation utilities.

## Before coding
- Inspect similar existing features first.
- Identify the files that should be reused.
- Explain the implementation plan briefly.

## Done means
- Lint passes (if a lint script is configured for the change).
- TypeScript passes (`npm run typecheck`).
- Build passes (`npm run build`).
- Tests pass if relevant and available.
- The final response lists changed files and what was tested.
