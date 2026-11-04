---
name: paper-sync
description: Keep the MSUkaIP capstone paper (Google Doc "ITE191_Revise_Paper") consistent with the built system. Use when the user asks to revise, check, update, or write parts of the paper, align it with the system, draft Chapter 4 or 5, fix references, or "put my paper in Google Docs". Reads the paper from Google Drive, checks every claim against the code, and writes the result as a NEW Google Doc of find/replace revisions or drafted sections.
---

# paper-sync — MSUkaIP paper ↔ system

The paper lives in Google Docs. The system lives in this repo. This skill keeps them telling the same story, so nothing in the paper is something the panel can disprove by opening the app.

## The paper

| What | Value |
|---|---|
| Main paper | `ITE191_Revise_Paper` — Drive file ID `1Cjm3Whl7c9DyQumtI6KxlLXeD5ratyOEH9HdH5Q3ycM` |
| Authors | Hussien G. Diranggarun, Sahara B. Lominog, Sittie Hanzaliah S. Radia |
| Adviser / co-adviser | Prof. Mohammad P. Domato / Prof. Joseph C. Sieras, MSIT |
| Template | BSIT capstone guidelines: Ch1 Introduction, Ch2 RRL/RRS + Technical Background, Ch3 Methodology, Ch4 Results and Discussion, Ch5 Summary, Conclusion and Recommendation. APA references. |
| Earlier revision docs | `docs/paper/` in this repo (PAPER-REVISIONS-FINAL.md, CH1-3-BEFORE-AFTER.md, CHAPTER-4-5-DRAFT.md, FINISH-PLAN.md) |

If the user gives a different Google Docs link, the file ID is the part between `/d/` and `/edit`.

## What the Drive connector can and cannot do

- **Can:** search files, read a Doc/Word/PDF (with comments), create a NEW Google Doc from HTML.
- **Cannot:** edit text inside an existing Doc, share, or change permissions.
- So the output is always a **new** Doc. Never claim you edited the paper itself.
- Never trash, move, rename, or re-share the user's files.

## Modes

Pick the mode from the request. Default to **audit** when unclear.

### 1. audit — "check / revise / align my paper"
1. Read the paper: `read_file_content` with `includeComments: true`. Large results are saved to a file — extract `fileContent` and `commentThreads` with node into the scratchpad (see `scripts/extract.js`).
2. Read the facts sources (below) for every claim you are about to judge. Do not rely on memory of the codebase.
3. For each discrepancy, write one revision item: section, **Find** (copied verbatim from the paper), **Replace with**, **Why** (one sentence).
4. Run `scripts/verify-finds.js` on your Find strings. Every Find must occur in the paper text exactly once; fix or shorten any that do not.
5. List open reviewer comments (`status: OPEN`) and answer each one with a concrete fix.
6. Create the Doc (see Output) and return its link plus the top 5–7 problems.

### 2. draft — "write Chapter 4 / Chapter 5 / section X"
1. Follow the template headings for that chapter.
2. Use only real numbers: survey results come from the admin CSV export or the `survey_responses` table; test results from an actual Playwright run. If the data does not exist yet, write `‹FILL: what goes here and where to get it›` — never invent figures.
3. Create the Doc as a ready-to-paste section.

### 3. diff — "I changed the system, what in the paper is now wrong?"
1. `git log` / `git diff` for the range the user names (or since the date of the last revisions Doc).
2. Map each change to paper sections (feature → 1.4 Scope, 3.1.2 requirements, 3.2.x diagrams; security → 2.1.3.4, 3.1.2; schema → 3.2.4 ERD).
3. Produce revision items as in audit.

## Facts sources — check these, not memory

| Paper claim about | Read |
|---|---|
| Stack, conventions, security invariants | `CLAUDE.md` |
| Features, limits, auth, rate limits, upload sizes, file types, group-call rule | `msuka-ip-v7/backend/server.js` (grep `multer`, `fileSize`, `ALLOWED`, `bcrypt.hash`, `loginFailures`, `room:join`) |
| Database tables and relationships | `docs/project/ERD.md`, `docs/erd.png`, `setupDatabase()` in server.js |
| Survey items, sections, scale, interpretation ranges | `msuka-ip-v7/frontend/feedback.html` (`SECTIONS`, `interpret`) and `admin.html` |
| UI names (e.g. "CICS Chat", nav tabs) | `msuka-ip-v7/frontend/index.html` |
| Tests that exist | `msuka-ip-v7/tests/*.spec.js` |
| Status and decisions | `docs/project/PROGRESS.md`, `docs/project/DECISIONS.md` |
| Deployment (HTTPS 3443, msukaip.local, hotspot) | `docs/guides/DEPLOYMENT.md` |

## Standing decisions (do not re-litigate)

- Concurrent users: **50–100** everywhere.
- Evaluation: questionnaire **adapted from ISO/IEC 25010** (A Usability, B Functional Suitability, C Performance Efficiency, D Satisfaction) + Section E comments, 22 rated items, 5-point Likert, weighted mean, interpretation 4.50–5.00 SA · 3.50–4.49 A · 2.50–3.49 N · 1.50–2.49 D · 1.00–1.49 SD (matches the system). Validation by experts + Cronbach's alpha ≥ 0.70 (JASP). Analysis in Excel.
- Testing methods: functional, use case, performance (50–100 simulated users), compatibility, user acceptance testing. Not SUS/UEQ/CSUQ/USE.
- Encryption is **at rest**, not end-to-end — never let the paper say end-to-end.
- The system does not prioritize packets (no QoS marking) and uses no STUN/TURN.
- MSUkaIP is a **web app** — no mobile app, no client install.

## Writing rules

- The students must defend every sentence orally: plain academic English, no inflated claims, nothing the code does not do.
- Find text: copy verbatim from the extracted paper text, short but unique (one sentence or a distinctive phrase). Strip markdown markers (`**`, `\[`) the extraction adds.
- Prefer the smallest change that makes the claim true.
- Unverifiable claims (e.g. a related system's origin) → mark **[CHECK]** and say what to verify; do not assert.
- References in APA 7; every in-text citation needs a list entry and vice versa; sort alphabetically.
- Do not paste the paper's full text back into chat.

## Output

Create the Doc with `create_file`, `contentMimeType: "text/html"`, `textContent` = a full `<html><body>…</body></html>` document. Drive converts it to a Google Doc with real headings and tables. Structure:

1. `<h1>` title, one line saying which paper and date, a **How to use** paragraph (Ctrl+H find/replace; [MANUAL] = fix by hand).
2. **Summary** table — most important first.
3. One `<h2>` per chapter; each item an `<h3>` with **Find / Replace with / Why**.
4. Figures to update (from reviewer comments).
5. References to add / remove.
6. Before-printing checklist.

Title new Docs `MSUkaIP Paper — <what> (<Mon YYYY>)`. Afterwards call `get_file_metadata` to confirm the content converted (fileSize > 1), then give the user the `viewUrl`.

## Applying revisions in place — Apps Script

The connector cannot edit the paper, but a Google Apps Script bound to the paper can, running as the student. Use `docs/paper/apply-revisions.gs` as the template:

1. Replace the `REVISIONS` array (`[section, find, replace]`) and `ROWS_TO_DELETE` with the new round's items. Keep the helper functions unchanged — they escape regex/replacement characters, skip any find that does not match exactly once, and log every item.
2. Verify the finds: evaluate the file with `new Function(src + ';return {REVISIONS, ROWS_TO_DELETE}')`, write the find strings to JSON, and run `scripts/verify-finds.js`. All must pass.
3. Upload a copy to Drive with `create_file`, `contentMimeType: "text/plain"`, `disableConversionToGoogleType: true` (conversion to a Doc would turn straight quotes curly and break the code).
4. Tell the student: Extensions → Apps Script → paste → Save → run `previewRevisions` → run `applyRevisions`; undo with File → Version history.

Only literal text changes go in the script. Whole-section rewrites (e.g. a new 3.4), figure swaps, and deleting template text stay [MANUAL] in the revisions Doc.
