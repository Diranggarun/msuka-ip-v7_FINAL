// Rebuild Chapters 1-3 from the PDF text layer with every revision applied and
// marked, so the changes can be read in context rather than as a diff list.
const fs = require('fs');

const SRC = 'paper.txt';
const OUT = 'C:/Users/diran/OneDrive/Desktop/msuka-ip-v7_Final/CH1-3-REVISED.md';

const lines = fs.readFileSync(SRC, 'utf8').split('\n');
// Body of Chapters 1-3: from "CHAPTER 1: INTRODUCTION" to just before REFERENCES.
let body = lines.slice(80, 1018).join('\n');

// Strip the page-number artifacts the PDF text layer leaves behind: a bare
// number alone on a line, usually surrounded by blank lines.
body = body.replace(/\n\s*\n\s*\d{1,2}\s*\n\s*\n/g, '\n\n');
body = body.replace(/\n\s{20,}\d{1,2}\s*\n/g, '\n');
// Collapse runs of blank lines
body = body.replace(/\n{4,}/g, '\n\n\n');

const CH = (s) => '\n\n> **✅ CHANGED —** ' + s + '\n';
const AD = (s) => '\n\n> **➕ ADDED —** ' + s + '\n';

// ── ordered replacements. Each `find` is verbatim from the extraction. ──────
const edits = [
  {
    label: '1.3 General Objectives — one figure, used consistently',
    find: 'capable of supporting at least 100 concurrent users without external internet dependency.',
    repl: 'capable of supporting 50\u2013100 concurrent users without external internet dependency.'
         + CH('was "at least 100". The paper used three different figures for this; all now read 50\u2013100.'),
  },
  {
    label: '1.3 Specific Objective 3',
    find: `    3. To integrate the system into the CICS network with institutional email authentication and
         AES-256 encryption for secure access by 50-100 concurrent users.`,
    repl: `    3. To integrate the system into the CICS network with institutional email authentication, an
         administrator account-approval workflow, and AES-256-GCM encryption of stored messages
         and files, for secure access by 50\u2013100 concurrent users.`
         + CH('adds the approval workflow (a built feature the objective did not claim) and names the cipher mode. "AES-256" alone does not say GCM, which is what provides tamper detection.'),
  },
  {
    label: '1.4 Scope paragraph',
    find: `         This project will focus on the design, development, and implementation of MSUkaIP, an
offline communication system accessible to all students, faculty, and administrators within the
College of Information and Computing Sciences. The system will support messages, lightweight
image, sharing, file sharing for academic documents (such as PDFs and DOCX files) and localized
calling through Wi-Fi networks without internet connectivity.`,
    repl: `         This project focuses on the design, development, and implementation of MSUkaIP, an
offline communication system accessible to all students, faculty, and administrators within the
College of Information and Computing Sciences. The system supports real-time text messaging in
private and group conversations, lightweight image sharing, file sharing for academic documents
(PDF and DOCX), push-to-talk voice messages, and localized voice calls over Wi-Fi networks
without internet connectivity. Administrators can additionally send broadcast messages to all
active users, review a security audit log, and monitor system usage through a dashboard. The
system also includes a built-in anonymous evaluation survey used to gather respondent feedback
for the study.`
         + CH('the old paragraph omitted group conversations, voice messages, broadcast, the audit log and the survey \u2014 all built and demonstrable. Also fixes the comma splice in "lightweight image, sharing".'),
  },
  {
    label: '1.4 Limitations — append',
    find: 'Consequently, the system will not operate outside the CICS Wi-Fi coverage range.',
    repl: `Consequently, the system will not operate outside the CICS Wi-Fi coverage range.

         Voice calls are limited to one-to-one conversations and to group chats with a defined
membership. Group calls are not available in the Global Chat channel: WebRTC group calls use a
full mesh topology in which every participant holds a direct connection to every other, so a call
among n users requires n(n\u22121)/2 connections. Because Global Chat contains every approved
account in the college, a mesh call there would exceed the capacity of the CICS local network.
Furthermore, the encryption of messages and files at rest protects stored data against unauthorized
access to the database file or its backups; it is not end-to-end encryption, as the server holds the
encryption key in order to support the administrative and audit functions the institution requires.`
         + AD('both are boundaries a panel will find on its own. Declared, they read as engineering judgement rather than oversights.'),
  },
  {
    label: '2.1.3.4 RA 10173 — new subsection',
    find: '2.2 Review of Related Systems',
    repl: `         2.1.3.4 Republic Act No. 10173 (Data Privacy Act of 2012)

         Republic Act No. 10173, the Data Privacy Act of 2012, mandates that entities processing
personal information implement reasonable organizational, physical, and technical security
measures to protect personal data against unauthorized access, disclosure, and destruction
(National Privacy Commission, 2012). Section 20 of the Act specifically requires safeguards such
as access control, encryption, and the ability to identify and monitor security incidents. MSUkaIP
operationalizes these requirements through several technical measures: user passwords are hashed
with the bcrypt algorithm; chat messages and uploaded files are encrypted at rest using
AES-256-GCM; uploaded files are stored outside the public web directory and served only to
authenticated users; repeated failed logins are rate-limited; user sessions can be revoked
immediately through token versioning; and an audit log records the actor, IP address, and device of
every security-relevant action. The audit log can be filtered by action type, user, and date range, so
that a specific class of event \u2014 for example, all failed login attempts against one account in a given
week \u2014 can be isolated from routine activity, satisfying the Act's monitoring requirement. These
measures ensure that a communication system operated by a government-funded academic
institution meets its statutory obligation to protect the personal data of its students and faculty.`
         + AD('new subsection after 2.1.3.3. Also add to REFERENCES: National Privacy Commission. (2012). *Republic Act No. 10173: Data Privacy Act of 2012*. Republic of the Philippines. https://www.privacy.gov.ph/data-privacy-act/')
         + '\n\n2.2 Review of Related Systems',
  },
  {
    label: '3.1.2 — the IP-address row',
    find: `The Admin shall be able to add/remove,         Functional          Mandatory
edit, or deactivate user accounts based on
IP address.`,
    repl: `The Admin shall be able to approve pending     Functional          Mandatory
registrations, and add, edit, deactivate, or
remove user accounts.`
         + CH('accounts are managed by identity, not IP address. The approval step is the first thing demonstrated in the admin dashboard.'),
  },
  {
    label: '3.1.2 — the Security row',
    find: `User passwords must be encrypted (e.g.,          Security                   Mandatory
hashed using Bcrypt) in the database, and
files must be stored in a restricted directory.`,
    repl: `User passwords must be hashed using bcrypt       Security                   Mandatory
(cost factor 12); chat messages and uploaded
files must be encrypted at rest using
AES-256-GCM; uploads must be stored in a
restricted directory served only to
authenticated users; repeated failed logins
must be rate-limited to five attempts per
fifteen minutes per account and address; the
administrative and student portals must be
separated so that neither role can
authenticate on the other's page; and a
secure HTTPS origin must be available on the
local network.`
         + CH('"encrypted (e.g., hashed)" conflates encryption with hashing \u2014 they are different operations, and passwords need hashing precisely because it is one-way. An IT panel will pick this up.'),
  },
  {
    label: '3.2.4 ERD description',
    find: `         The Entity-Relationship Diagram (ERD) defines the logical database structure of
MSUkaIP, outlining all necessary entities, attributes, and relationships to support secure LAN
messaging, group communication, file sharing, VoIP signaling, and administrative monitoring
within the CICS Local Area Network.This ERD provides a scalable and efficient foundation for the
backend of the MSUkaIP system.`,
    repl: `         The Entity-Relationship Diagram defines the logical database structure of MSUkaIP. The
schema comprises seven entities. Users stores account identity, the bcrypt password hash, role,
account status, and a token version used for session revocation. Messages stores every message
with its conversation key, type, encrypted body, and file metadata, and is linked to its sender.
Groups stores group chats and their creator, while Group Members resolves the many-to-many
relationship between users and groups and enforces uniqueness so that a user appears in a group
exactly once. Calls records voice call attempts with caller, receiver, status, and duration. Audit
Logs records security-relevant actions with the acting user, IP address, and device.

         Survey Responses stores evaluation results and is deliberately not linked to the users table:
the absence of that relationship is what makes the evaluation anonymous, since a stored response
cannot be traced back to an account.

         All relationships are enforced with foreign keys, and the database runs with foreign-key
constraints enabled, so referential integrity is maintained by the database engine rather than by
application code alone.`
         + CH('the old paragraph never said what the entities are. **Figure 3.5 must also be replaced** with docs/erd.png \u2014 the current diagram predates audit_logs and survey_responses, both central to the RA 10173 section and Chapter 4.'),
  },
];

// The PDF text layer preserves the original line wrapping and indentation, and
// guessing it exactly is fragile. Match on the words instead, treating any run
// of whitespace as equivalent.
const RX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const flexible = (t) => new RegExp(
  t.trim().split(/\s+/).map(w => w.replace(RX_SPECIAL, '\\$&')).join('\\s+'));

let applied = 0, missed = [];
for (const e of edits) {
  const re = flexible(e.find);
  if (re.test(body)) { body = body.replace(re, () => e.repl); applied++; }
  else missed.push(e.label);
}

const header = `# MSUkaIP — Chapters 1, 2 and 3 (revised)

Reconstructed from \`CAPTSONE1_Final_REVISED_PAPER01.06 (2).pdf\` with every
revision applied in place. Changed and added passages are marked:

> **✅ CHANGED —** why it changed
> **➕ ADDED —** why it was added

**Read this to see the changes in context.** Do not paste it wholesale into your
document: it comes from the PDF's text layer, so tables have lost their column
formatting and page furniture has been stripped. Paste the marked passages into
your Word file, where your formatting is intact.

Sections 3.2.5, 3.3.1, 3.4 and 3.4.3 also change, but they are tables and
structured lists that survive extraction poorly \u2014 those are in
\`CH1-3-BEFORE-AFTER.md\`, which quotes them cleanly.

---

`;

fs.writeFileSync(OUT, header + body.trim() + '\n');
console.log('edits applied:', applied, 'of', edits.length);
if (missed.length) console.log('NOT FOUND:\n  - ' + missed.join('\n  - '));
console.log('wrote', OUT, '(' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
