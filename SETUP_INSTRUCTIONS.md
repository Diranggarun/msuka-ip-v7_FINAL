# MSUkaIP Docs Bundle — Setup Instructions

This bundle contains everything you need to add Claude Code documentation to your existing project. **Nothing in this bundle touches your source code.**

## What's inside

```
msukaip-docs-bundle/
├── CLAUDE.md                    ← copy to your project root
└── claude-docs/                 ← copy to your project root
    ├── README.md
    ├── PROMPTS.md               ← the full 15-phase build spec
    ├── PROGRESS.md
    ├── AUDIT.md                 ← placeholder until you run the audit prompt
    ├── ERD.md
    ├── DECISIONS.md
    └── DEBUGGING.md
```

## Installation — 3 steps

### Step 1 — Back up your project (30 seconds, non-negotiable)

In your project root:

```powershell
git add -A
git commit -m "Snapshot before adding Claude Code docs"
git tag pre-claude-docs
```

If your project isn't using Git yet:

```powershell
git init
git add -A
git commit -m "Initial commit of existing code"
git tag pre-claude-docs
```

### Step 2 — Copy the bundle into your project

**Option A — Manual copy (safest):**

1. Unzip this bundle.
2. Open your project folder in File Explorer.
3. Drag `CLAUDE.md` into the project root.
4. Drag the whole `claude-docs/` folder into the project root.

Done. Your project root should now look like:

```
your-project/
├── CLAUDE.md                ← new
├── claude-docs/             ← new
├── backend/                 ← your existing code, untouched
├── frontend/                ← your existing code, untouched
└── ... (everything else, untouched)
```

**Option B — PowerShell (if you prefer command line):**

```powershell
# From your project root
Copy-Item -Path "path\to\msukaip-docs-bundle\CLAUDE.md" -Destination "."
Copy-Item -Path "path\to\msukaip-docs-bundle\claude-docs" -Destination "." -Recurse
```

### Step 3 — Run the audit (when ready)

Open Claude Code in your project. Paste this prompt:

```text
Read CLAUDE.md and claude-docs/PROMPTS.md first.

Then scan the existing codebase and write a complete audit to
claude-docs/AUDIT.md (replacing the placeholder content). Include:

- Folder structure (tree, 3 levels deep)
- Detected tech stack (read package.json, requirements.txt, pyproject.toml,
  or any other manifest file present)
- For each of the 15 phases in claude-docs/PROMPTS.md:
   * What's present in the code that matches that phase
   * What's missing
   * What appears partial or broken
   * Any deviations from the planned stack (FastAPI + React + MySQL +
     Socket.IO + WebRTC)
- Files that look like placeholders, stubs, or work-in-progress
- Any obvious quality issues (TODOs, hardcoded credentials, unused files)

Then update claude-docs/PROGRESS.md based on the audit:
- ✅ Done — phase fully implemented and appears functional
- 🚧 Partial — some files exist but the phase is incomplete
- ⏳ Not started — nothing matching this phase exists
Be conservative — when in doubt, mark Partial, not Done.

Do NOT modify any source code. Only write to AUDIT.md and PROGRESS.md.

When finished, print a 5-bullet summary of what you found.
```

That's it. You're set up.

## Daily workflow after setup

From here on, your Claude Code prompts can be tiny because the rules and context live in `CLAUDE.md`. Examples:

- "Do a gap analysis for Phase 6 against my existing code."
- "Continue from the next unfinished phase in PROGRESS.md."
- "Fix this error" (paste error) — Claude Code will check DEBUGGING.md first.
- "I just decided to use Redis for rate limiting. Add it to DECISIONS.md."

## Safety guarantees

- **Nothing in this bundle executes.** It's all Markdown documentation.
- **Nothing in this bundle is imported by your application.** Your build, tests, and deploy don't depend on it.
- **You can delete it anytime.** `Remove-Item CLAUDE.md; Remove-Item -Recurse claude-docs` restores your project to its original state.
- **Git tag `pre-claude-docs`** is your hard rollback if anything ever goes wrong: `git reset --hard pre-claude-docs`.

## What if `CLAUDE.md` already exists in my project?

Don't overwrite. Rename the existing one to `CLAUDE.local.md` first, then drop in the new one. Open both, merge any project-specific rules you had into the new file, then delete the `.local.md`.

## Need to update the docs later?

All files in `claude-docs/` are meant to be edited as the project evolves:

- After every phase → update `PROGRESS.md`
- After every non-trivial decision → add to `DECISIONS.md`
- After every new error solved → add to `DEBUGGING.md`
- After a schema change → update `ERD.md`
- If requirements shift → update `PROMPTS.md`

You can ask Claude Code to update them for you:
> "I just finished Phase 4 — update PROGRESS.md."
> "Add a decision to DECISIONS.md: we switched from MySQL to MariaDB because [reason]."

## Questions or issues

Refer back to the original capstone document. If any file in this bundle conflicts with what's in the paper, the paper wins — these docs are derived from it.
