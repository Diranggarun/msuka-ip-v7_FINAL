# Chapters 1–3 — paste-ready for Google Docs

Every replacement below is **plain text with no formatting marks**, so it pastes
into Google Docs clean. Nothing to tidy up afterwards.

## How to use this

For each edit:

1. In your Google Doc press **Ctrl+F** and paste the SEARCH line.
2. Select the passage it lands on.
3. Copy the REPLACE block from here and paste over it.

Paste with **Ctrl+Shift+V** (paste without formatting) so the text takes on your
document's existing font rather than carrying anything in with it.

**Before you start:** File → Version history → Name current version → call it
"before revisions". If anything goes wrong you can restore it in two clicks.

---

## 1 — General Objectives, concurrent users

SEARCH: `capable of supporting at least 100 concurrent`

Change only the number. `at least 100` becomes `50–100`, so the line reads:

REPLACE:

To design, develop, and implement a LAN-based VoIP and Messaging System for the CICS that is capable of supporting 50–100 concurrent users without external internet dependency.

Why: your paper gives three different numbers for the same requirement. Specific Objective 3 and §3.1.2 both already say 50–100, so changing this one line makes all three agree.

---

## 2 — Specific Objective 3

SEARCH: `institutional email authentication and AES-256`

REPLACE:

To integrate the system into the CICS network with institutional email authentication, an administrator account-approval workflow, and AES-256-GCM encryption of stored messages and files, for secure access by 50–100 concurrent users.

Why: the approval workflow is built but unclaimed, and "AES-256" alone does not name the mode. GCM is what detects tampering.

---

## 3 — Scope paragraph

SEARCH: `an offline communication system accessible to all students`

Select the whole paragraph, through `without internet connectivity.`

REPLACE:

This project focuses on the design, development, and implementation of MSUkaIP, an offline communication system accessible to all students, faculty, and administrators within the College of Information and Computing Sciences. The system supports real-time text messaging in private and group conversations, lightweight image sharing, file sharing for academic documents (PDF and DOCX), push-to-talk voice messages, and localized voice calls over Wi-Fi networks without internet connectivity. Administrators can additionally send broadcast messages to all active users, review a security audit log, and monitor system usage through a dashboard. The system also includes a built-in anonymous evaluation survey used to gather respondent feedback for the study.

Why: the current version omits group conversations, voice messages, broadcast, the audit log and the survey — all built and demonstrable. It also fixes the comma splice in "lightweight image, sharing".

---

## 4 — Limitations, append

SEARCH: `will not operate outside the CICS Wi-Fi coverage range`

Click at the end of that sentence and paste this after it, in the same paragraph:

REPLACE:

Voice calls are limited to one-to-one conversations and to group chats with a defined membership. Group calls are not available in the Global Chat channel: WebRTC group calls use a full mesh topology in which every participant holds a direct connection to every other, so a call among n users requires n(n−1)/2 connections. Because Global Chat contains every approved account in the college, a mesh call there would exceed the capacity of the CICS local network. Furthermore, the encryption of messages and files at rest protects stored data against unauthorized access to the database file or its backups; it is not end-to-end encryption, as the server holds the encryption key in order to support the administrative and audit functions the institution requires.

Why: both are boundaries a panel will find on its own. Declared up front, they read as engineering judgement rather than oversight.

---

## 5 — New subsection 2.1.3.4

SEARCH: `National Government Identity and Security Standards`

Go to the end of that subsection and add a new one after it.

HEADING:

2.1.3.4 Republic Act No. 10173 (Data Privacy Act of 2012)

REPLACE:

Republic Act No. 10173, the Data Privacy Act of 2012, mandates that entities processing personal information implement reasonable organizational, physical, and technical security measures to protect personal data against unauthorized access, disclosure, and destruction (National Privacy Commission, 2012). Section 20 of the Act specifically requires safeguards such as access control, encryption, and the ability to identify and monitor security incidents. MSUkaIP operationalizes these requirements through several technical measures: user passwords are hashed with the bcrypt algorithm; chat messages and uploaded files are encrypted at rest using AES-256-GCM; uploaded files are stored outside the public web directory and served only to authenticated users; repeated failed logins are rate-limited; user sessions can be revoked immediately through token versioning; and an audit log records the actor, IP address, and device of every security-relevant action. The audit log can be filtered by action type, user, and date range, so that a specific class of event — for example, all failed login attempts against one account in a given week — can be isolated from routine activity, satisfying the Act's monitoring requirement. These measures ensure that a communication system operated by a government-funded academic institution meets its statutory obligation to protect the personal data of its students and faculty.

Add to your reference list:

National Privacy Commission. (2012). Republic Act No. 10173: Data Privacy Act of 2012. Republic of the Philippines. https://www.privacy.gov.ph/data-privacy-act/

---

## 6 — Table 3.1, the IP-address row

SEARCH: `deactivate user accounts based on IP address`

REPLACE (first cell only, leave Functional / Mandatory alone):

The Admin shall be able to approve pending registrations, and add, edit, deactivate, or remove user accounts.

Why: accounts are managed by identity, not IP address. The approval step is also the first thing you demonstrate in the admin dashboard.

---

## 7 — Table 3.1, nine new rows

Click in the last row of the table, then Insert → Row below, nine times. Each line
below is one row: first cell, then Functional, then the priority given.

Users and administrators shall be able to create group chats (channels) for specific subjects and select their members upon creation.  |  Functional  |  Mandatory

Users shall be able to record and send push-to-talk voice messages within a conversation.  |  Functional  |  Desirable

Users shall be able to change their own password, which immediately revokes all other active sessions for that account.  |  Functional  |  Mandatory

Users shall be able to edit their own display name.  |  Functional  |  Desirable

The system shall record an audit log of security-relevant actions (logins, failed logins, administrative changes) including the actor, IP address, and device.  |  Functional  |  Mandatory

The Admin shall be able to filter and search the audit log by action, user, and date range.  |  Functional  |  Mandatory

The Admin shall be able to view all group chats, inspect their membership, and remove a group.  |  Functional  |  Mandatory

The Admin shall be able to create and download a backup of the system database.  |  Functional  |  Desirable

The system shall provide an anonymous Likert-scale evaluation survey for gathering respondent feedback.  |  Functional  |  Desirable

Do NOT add a broadcast row — your table already has one.

---

## 8 — Table 3.1, the Security row

SEARCH: `must be encrypted (e.g., hashed using Bcrypt)`

REPLACE (first cell only):

User passwords must be hashed using bcrypt (cost factor 12); chat messages and uploaded files must be encrypted at rest using AES-256-GCM; uploads must be stored in a restricted directory served only to authenticated users; repeated failed logins must be rate-limited to five attempts per fifteen minutes per account and address; the administrative and student portals must be separated so that neither role can authenticate on the other's page; and a secure HTTPS origin must be available on the local network.

Why: this is the highest-value edit in the whole document. "Encrypted (e.g., hashed)" conflates encryption with hashing. Encryption is reversible, hashing is not, and passwords need hashing precisely because it is one-way. In an IT programme that is a question you would rather not be asked.

---

## 9 — Section 3.2.4, ERD paragraph

SEARCH: `outlining all necessary entities, attributes, and relationships`

Select the whole paragraph, through `foundation for the backend of the MSUkaIP system.`

REPLACE:

The Entity-Relationship Diagram defines the logical database structure of MSUkaIP. The schema comprises seven entities. Users stores account identity, the bcrypt password hash, role, account status, and a token version used for session revocation. Messages stores every message with its conversation key, type, encrypted body, and file metadata, and is linked to its sender. Groups stores group chats and their creator, while Group Members resolves the many-to-many relationship between users and groups and enforces uniqueness so that a user appears in a group exactly once. Calls records voice call attempts with caller, receiver, status, and duration. Audit Logs records security-relevant actions with the acting user, IP address, and device.

Survey Responses stores evaluation results and is deliberately not linked to the users table: the absence of that relationship is what makes the evaluation anonymous, since a stored response cannot be traced back to an account.

All relationships are enforced with foreign keys, and the database runs with foreign-key constraints enabled, so referential integrity is maintained by the database engine rather than by application code alone.

ALSO: replace Figure 3.5 with docs/erd.png from your project folder. Your current diagram predates audit_logs and survey_responses, and both are central to your RA 10173 section and Chapter 4.

If you want the entity names in bold — Users, Messages, Groups, Group Members, Calls, Audit Logs, Survey Responses — apply that after pasting.

---

## 10 — Section 3.2.5, items C, D and E

SEARCH: `PostgreSQL / MySQL Database`

Neither PostgreSQL, MySQL nor Redis is in your system. Replace all three items.

HEADING C:

C. VoIP Signaling (WebRTC)

REPLACE C:

This component sets up and manages voice calls. The server handles only call signaling — exchanging session descriptions and connection candidates between participants through Socket.IO — while the audio itself flows directly between devices as a peer-to-peer WebRTC stream. WebRTC mandates DTLS-SRTP for media, so call audio is encrypted between the two browsers and never traverses the server. Because all participants are on the same local area network and are directly reachable, the system operates with an empty ICE server list: no STUN or TURN servers are required, which keeps the entire call path inside the CICS LAN. Browsers require a secure origin to grant microphone access, so the server also exposes an HTTPS endpoint (port 3443) with a locally generated TLS certificate for LAN clients.

HEADING D:

D. SQLite Database

REPLACE D:

The system uses SQLite, an embedded relational database engine accessed through Node.js's built-in node:sqlite module. All persistent data — user accounts, group chats, messages, call records, audit logs, and survey responses — is stored in a single database file on the local server. SQLite runs in Write-Ahead Logging (WAL) mode, which allows concurrent readers alongside a writer and is well suited to the system's scale of 50–100 concurrent users on a single LAN server. Because SQLite requires no separate database server process, installation, or credentials, it simplifies deployment on the college server and makes backup a matter of copying one file.

HEADING E:

E. In-Memory Presence and Session State

REPLACE E:

Fast-changing data such as online status, active sessions, and login rate-limit counters are held directly in the Node.js server's memory and synchronized to clients through Socket.IO events. Because MSUkaIP runs as a single server on the local network, this in-process approach provides instant presence updates without the operational overhead of an external cache such as Redis.

NEW HEADING F:

F. Access Control and Session Management

ADD F:

Authentication issues a signed JSON Web Token carrying the user's identity, role, and a token version number. Every request revalidates that version against the database, so incrementing it invalidates all outstanding tokens for an account instantly — used on sign-out, password change, account rejection, and account deletion. Tokens expire after eight hours.

Authorization is enforced per conversation rather than per page. Before a message is read from or written to a group conversation, the server confirms the requesting account appears in that group's membership table; a request failing this check is refused and recorded in the audit log as an access violation. The same rule governs entry to a group call. The student and administrative interfaces are separate pages with separate login endpoints, and each refuses accounts belonging to the other role.

---

## 11 — Section 3.2.6, append two paragraphs

Your two existing paragraphs on the LinkCode topology are accurate and stay. Add
these after them:

REPLACE:

Within this topology the server exposes two endpoints. Port 3000 serves the application over HTTP for general access, while port 3443 serves the same application over HTTPS using a TLS certificate generated on first start. The secure endpoint exists because browsers grant microphone access only to a secure origin, so voice features require it; it also encrypts message and file traffic in transit across the LAN.

Voice traffic does not follow the same path as messaging traffic. Messages and files travel from client to server and back, whereas call audio establishes a direct peer-to-peer path between the two participating devices after signaling completes. Because both devices sit within the same LAN segment, this media path stays inside the college network and does not pass through the MSUkaIP server at all, reducing server load and keeping call latency low.

CHECK FIGURE 3.7. If it draws voice traffic passing through the server, that is now wrong. Redraw it so call audio goes device-to-device with only the signaling arrows touching the server — it is a point in your favour, so it is worth the ten minutes.

---

## 12 — Section 3.3.1, Table A (Languages)

SEARCH: `Backend logic for authentication, message handling`

Delete the Python row and the FastAPI row. Two rows remain:

JavaScript (Node.js)  |  Backend logic for authentication, message handling, encrypted file transfer, VoIP signaling, and administration.

HTML, CSS, and JavaScript  |  Front-end interface for real-time user interaction, served directly with no build step.

Why: there is no Python anywhere in the system.

---

## 13 — Section 3.3.1, Table B (Frameworks)

SEARCH: `Vue.js / React`

Replace all three rows with:

Express.js (Node.js)  |  Manages REST API requests and server-side operations.

Socket.IO  |  Provides real-time messaging, presence, and VoIP signaling between clients over the LAN.

WebRTC (browser API)  |  Establishes direct peer-to-peer audio streams for voice calls.

Why: no Django, no Vue, no React. Your front end is vanilla JavaScript with no build step, which is a deployment advantage worth stating rather than hiding.

---

## 14 — Section 3.3.1, Table C (Database)

SEARCH: `MySQL / MariaDB`

REPLACE:

SQLite (via Node.js built-in node:sqlite, WAL mode)  |  Stores persistent system data aligned with the ERD (users, groups, messages, calls, audit logs, survey responses) in a single local database file.

---

## 15 — Section 3.3.1, Table D, one new row

Add one row:

HTTPS (TLS certificate)  |  Secure endpoint on port 3443 providing the secure origin browsers require for microphone access on LAN clients.

---

## 16 — Section 3.3.1, Table F (Other Tools)

SEARCH: `Postman, JMeter`

Replace the whole table body with:

Version Control  |  Git / GitHub  |  Code tracking and collaboration.

Automated Testing  |  Playwright  |  End-to-end browser test suites covering authentication, messaging, security, and the feedback form.

Static Analysis  |  ESLint  |  Code quality checks on server and inline front-end scripts.

Security Measures  |  Login rate limiting, JWT token versioning, audit logging  |  Account protection, immediate session revocation, and security monitoring.

UML Tools  |  Lucidchart, Draw.io  |  Diagram creation.

Network Design  |  Cisco Packet Tracer  |  Designing the network architecture.

---

## 17 — Section 3.4, append to the opening paragraph

SEARCH: `VoIP quality, system accessibility, and user satisfaction`

Add after that sentence:

REPLACE:

In addition to respondent evaluation, the system was verified through automated testing. System testing was conducted using Playwright, an automated browser-driven testing framework, executed against both Chromium and Firefox to verify that behaviour does not depend on a single rendering engine. The suite exercises the system through its interface rather than its API alone, covering authentication and portal separation, real-time messaging, file and image upload, the administrative dashboard, the evaluation form, responsive behaviour at mobile and desktop widths, and a dedicated group of authorization and security tests. Static analysis was performed with ESLint across both server code and the inline scripts of the front-end pages.

Security testing was adversarial rather than confirmatory: each control was attacked before and after implementation, and a test was accepted only once it had been demonstrated to fail against the unfixed system.

---

## 18 — Section 3.4.3, retitle

SEARCH: `3.4.3 tools (questionnaire)`

REPLACE the heading with:

3.4.3 Tools and Instruments

Then add this before the existing questionnaire description:

Two instruments were used. The evaluation questionnaire described below gathers respondent perception, and the automated test suite described in Section 3.4 verifies functional correctness and security independently of respondent opinion. The questionnaire is delivered by the system itself as an anonymous web form, and responses are written directly to the system database.

Why: the current title implies the questionnaire is your only instrument, which undersells the automated suite and the security work entirely.

---

## 19 — Section 3.4.3, fifth questionnaire component

Your components list A–D. The form now also collects an open comment.

HEADING:

E. Additional Comments

REPLACE:

An optional free-text field inviting respondents to describe what worked well, what did not, and what they would change. This provides the qualitative data reported alongside the weighted means in Chapter 4.

---

# Checklist

- [ ] 1 — General Objectives, 100 → 50–100
- [ ] 2 — Specific Objective 3
- [ ] 3 — Scope paragraph
- [ ] 4 — Limitations, append
- [ ] 5 — New 2.1.3.4 + reference
- [ ] 6 — Table 3.1, IP-address row
- [ ] 7 — Table 3.1, nine rows
- [ ] 8 — Table 3.1, Security row
- [ ] 9 — 3.2.4 paragraph + Figure 3.5
- [ ] 10 — 3.2.5 items C, D, E, F
- [ ] 11 — 3.2.6 append + check Figure 3.7
- [ ] 12 — Table A
- [ ] 13 — Table B
- [ ] 14 — Table C
- [ ] 15 — Table D row
- [ ] 16 — Table F
- [ ] 17 — 3.4 append
- [ ] 18 — 3.4.3 retitle + paragraph
- [ ] 19 — 3.4.3 component E

Edits 1, 2, 6, 8, 12, 13 and 14 are one-line swaps and take about ten minutes
between them. If you are short of time, do 8 first — it is the one most likely
to be challenged in defence.
