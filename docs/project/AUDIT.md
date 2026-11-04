# Codebase Audit

> This file is filled in by running the audit prompt (see "How to run the audit" in CLAUDE.md or in the setup instructions).
> Until the audit is run, this file is a placeholder.

## Status

**Audit not yet run.**

To populate this file, paste this prompt into Claude Code:

```text
Read CLAUDE.md and claude-docs/PROMPTS.md first.

Then scan the existing codebase and write a complete audit to
claude-docs/AUDIT.md (replacing the placeholder content). Include:

- Folder structure (tree, 3 levels deep)
- Detected tech stack (read package.json, requirements.txt, pyproject.toml,
  pom.xml, or any other manifest file present)
- For each of the 15 phases in claude-docs/PROMPTS.md:
   * What's present in the code that matches that phase
   * What's missing
   * What appears partial or broken
   * Any deviations from the planned stack (FastAPI + React + MySQL +
     Socket.IO + WebRTC)
- Files that look like placeholders, stubs, or work-in-progress
- Any obvious quality issues (TODOs, hardcoded credentials, unused files)
- Database state: list tables that exist if you can detect them from
  schema.sql, migrations, or ORM models

Then update claude-docs/PROGRESS.md based on the audit:
- ✅ Done — phase fully implemented and appears functional
- 🚧 Partial — some files exist but the phase is incomplete
- ⏳ Not started — nothing matching this phase exists
Be conservative — when in doubt, mark Partial, not Done.

Do NOT modify any source code. Only write to AUDIT.md and PROGRESS.md.

When finished, print a 5-bullet summary of what you found.
```

## After the audit

The sections below will be filled in by Claude Code:

### Detected folder structure

_(to be filled)_

### Detected tech stack

_(to be filled)_

### Phase-by-phase analysis

_(to be filled)_

### Quality issues found

_(to be filled)_

### Recommendations

_(to be filled)_
