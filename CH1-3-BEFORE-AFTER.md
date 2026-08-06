# Chapters 1–3 — every change, before and after

Each entry quotes **your current text exactly** as it appears in
`CAPTSONE1_Final_REVISED_PAPER01.06 (2).pdf`, then gives the replacement.
Nothing outside these blocks changes.

**Three corrections to my earlier revisions file**, found by reading your actual
table rather than trusting the 20 July document:

- The *"generate join codes"* row **does not exist** in your paper. It was
  already removed. There is no row to replace — group chats need a new row
  instead.
- The admin broadcast row **already exists**. Do not add it again.
- Your Security row already mentions bcrypt and the restricted directory. It
  needs extending, not replacing wholesale.

---

# CHAPTER 1

## 1.3 Objectives — the concurrent-user figure contradicts itself

Three different numbers appear for the same requirement:

| Where | Currently says |
|---|---|
| General Objectives | "at least 100 concurrent users" |
| Specific Objective 3 | "50-100 concurrent users" |
| §3.1.2 Reliability row | "at least 50-100 concurrent user connections" |

**Fix:** use **50–100** in all three. Change only the General Objectives line:

**BEFORE**
> To design, develop, and implement a LAN-based VoIP and Messaging System for the
> CICS that is capable of supporting **at least 100 concurrent users** without
> external internet dependency.

**AFTER**
> To design, develop, and implement a LAN-based VoIP and Messaging System for the
> CICS that is capable of supporting **50–100 concurrent users** without external
> internet dependency.

## 1.3 — Specific Objective 3

**BEFORE**
> 3. To integrate the system into the CICS network with institutional email
>    authentication and AES-256 encryption for secure access by 50-100 concurrent
>    users.

**AFTER**
> 3. To integrate the system into the CICS network with institutional email
>    authentication, an administrator account-approval workflow, and AES-256-GCM
>    encryption of stored messages and files, for secure access by 50–100
>    concurrent users.

*Why:* the approval workflow is a built feature the objective does not claim, and
"AES-256" alone does not name the mode. GCM is what provides tamper detection.

## 1.4 Scope — the paragraph

**BEFORE**
> This project will focus on the design, development, and implementation of
> MSUkaIP, an offline communication system accessible to all students, faculty,
> and administrators within the College of Information and Computing Sciences.
> The system will support messages, lightweight image, sharing, file sharing for
> academic documents (such as PDFs and DOCX files) and localized calling through
> Wi-Fi networks without internet connectivity.

**AFTER**
> This project focuses on the design, development, and implementation of MSUkaIP,
> an offline communication system accessible to all students, faculty, and
> administrators within the College of Information and Computing Sciences. The
> system supports real-time text messaging in private and group conversations,
> lightweight image sharing, file sharing for academic documents (PDF and DOCX),
> push-to-talk voice messages, and localized voice calls over Wi-Fi networks
> without internet connectivity. Administrators can additionally send broadcast
> messages to all active users, review a security audit log, and monitor system
> usage through a dashboard. The system also includes a built-in anonymous
> evaluation survey used to gather respondent feedback for the study.

*Why:* omits group conversations, voice messages, broadcast, the audit log and
the survey — all built and demonstrable. Also fixes the comma splice in
"lightweight image, sharing".

## 1.4 Limitations — append to the end of the existing paragraph

Your current paragraph ends: *"…the system will not operate outside the CICS
Wi-Fi coverage range."* Add after it:

**ADD**
> Voice calls are limited to one-to-one conversations and to group chats with a
> defined membership. Group calls are not available in the Global Chat channel:
> WebRTC group calls use a full mesh topology in which every participant holds a
> direct connection to every other, so a call among *n* users requires *n(n−1)/2*
> connections. Because Global Chat contains every approved account in the college,
> a mesh call there would exceed the capacity of the CICS local network.
> Furthermore, the encryption of messages and files at rest protects stored data
> against unauthorized access to the database file or its backups; it is not
> end-to-end encryption, as the server holds the encryption key in order to
> support the administrative and audit functions the institution requires.

*Why:* both are boundaries a panel will find. Declared, they read as engineering
judgement.

---

# CHAPTER 2

## 2.1.3.4 — new subsection after 2.1.3.3

Your §2.1.3 currently has three subsections: PeGIF, NICTEF, and National
Government Identity and Security Standards. Add a fourth.

**ADD**
> **2.1.3.4 Republic Act No. 10173 (Data Privacy Act of 2012)**
>
> Republic Act No. 10173, the Data Privacy Act of 2012, mandates that entities
> processing personal information implement reasonable organizational, physical,
> and technical security measures to protect personal data against unauthorized
> access, disclosure, and destruction (National Privacy Commission, 2012).
> Section 20 of the Act specifically requires safeguards such as access control,
> encryption, and the ability to identify and monitor security incidents. MSUkaIP
> operationalizes these requirements through several technical measures: user
> passwords are hashed with the bcrypt algorithm; chat messages and uploaded
> files are encrypted at rest using AES-256-GCM; uploaded files are stored
> outside the public web directory and served only to authenticated users;
> repeated failed logins are rate-limited; user sessions can be revoked
> immediately through token versioning; and an audit log records the actor, IP
> address, and device of every security-relevant action. The audit log can be
> filtered by action type, user, and date range, so that a specific class of
> event — for example, all failed login attempts against one account in a given
> week — can be isolated from routine activity, satisfying the Act's monitoring
> requirement. These measures ensure that a communication system operated by a
> government-funded academic institution meets its statutory obligation to
> protect the personal data of its students and faculty.

**Reference to add to your list:**
> National Privacy Commission. (2012). *Republic Act No. 10173: Data Privacy Act
> of 2012*. Republic of the Philippines.
> https://www.privacy.gov.ph/data-privacy-act/

---

# CHAPTER 3

## 3.1.2 Table 3.1 — one row to replace

**BEFORE**
> The Admin shall be able to add/remove, edit, or deactivate user accounts **based
> on IP address**. | Functional | Mandatory

**AFTER**
> The Admin shall be able to approve pending registrations, and add, edit,
> deactivate, or remove user accounts. | Functional | Mandatory

*Why:* accounts are managed by identity, not IP address. The approval step is the
first thing you demonstrate in the admin dashboard.

## 3.1.2 Table 3.1 — nine rows to add

Your table has no group-chat row at all, and none for the features built since.

**ADD (functional)**
> Users and administrators shall be able to create group chats (channels) for specific subjects and select their members upon creation. | Functional | Mandatory
>
> Users shall be able to record and send push-to-talk voice messages within a conversation. | Functional | Desirable
>
> Users shall be able to change their own password, which immediately revokes all other active sessions for that account. | Functional | Mandatory
>
> Users shall be able to edit their own display name. | Functional | Desirable
>
> The system shall record an audit log of security-relevant actions (logins, failed logins, administrative changes) including the actor, IP address, and device. | Functional | Mandatory
>
> The Admin shall be able to filter and search the audit log by action, user, and date range. | Functional | Mandatory
>
> The Admin shall be able to view all group chats, inspect their membership, and remove a group. | Functional | Mandatory
>
> The Admin shall be able to create and download a backup of the system database. | Functional | Desirable
>
> The system shall provide an anonymous Likert-scale evaluation survey for gathering respondent feedback. | Functional | Desirable

**Do not re-add** the broadcast row — *"The Admin shall be able to send a
'Broadcast Message'…"* is already in your table.

## 3.1.2 — the Security row

**BEFORE**
> User passwords must be encrypted (e.g., hashed using Bcrypt) in the database,
> and files must be stored in a restricted directory. | Security | Mandatory

**AFTER**
> User passwords must be hashed using bcrypt (cost factor 12); chat messages and
> uploaded files must be encrypted at rest using AES-256-GCM; uploads must be
> stored in a restricted directory served only to authenticated users; repeated
> failed logins must be rate-limited to five attempts per fifteen minutes per
> account and address; the administrative and student portals must be separated
> so that neither role can authenticate on the other's page; and a secure HTTPS
> origin must be available on the local network. | Security | Mandatory

*Why:* "encrypted (e.g., hashed)" conflates encryption with hashing — a panel in
an IT programme will pick that up. Hashing is one-way and is what passwords need.

---

## 3.2.4 Entity-Relationship Diagram

**BEFORE**
> The Entity-Relationship Diagram (ERD) defines the logical database structure of
> MSUkaIP, outlining all necessary entities, attributes, and relationships to
> support secure LAN messaging, group communication, file sharing, VoIP
> signaling, and administrative monitoring within the CICS Local Area
> Network.This ERD provides a scalable and efficient foundation for the backend
> of the MSUkaIP system.

**AFTER**
> The Entity-Relationship Diagram defines the logical database structure of
> MSUkaIP. The schema comprises seven entities. **Users** stores account
> identity, the bcrypt password hash, role, account status, and a token version
> used for session revocation. **Messages** stores every message with its
> conversation key, type, encrypted body, and file metadata, and is linked to its
> sender. **Groups** stores group chats and their creator, while **Group
> Members** resolves the many-to-many relationship between users and groups and
> enforces uniqueness so that a user appears in a group exactly once. **Calls**
> records voice call attempts with caller, receiver, status, and duration.
> **Audit Logs** records security-relevant actions with the acting user, IP
> address, and device.
>
> **Survey Responses** stores evaluation results and is deliberately not linked
> to the users table: the absence of that relationship is what makes the
> evaluation anonymous, since a stored response cannot be traced back to an
> account.
>
> All relationships are enforced with foreign keys, and the database runs with
> foreign-key constraints enabled, so referential integrity is maintained by the
> database engine rather than by application code alone.

**Also replace Figure 3.5** with `docs/erd.png`. Your current diagram predates
two tables — `audit_logs` and `survey_responses` did not exist when it was drawn,
and both are central to your RA 10173 section and Chapter 4.

*(Note the missing space after "Local Area Network." in your current text.)*

## 3.2.5 Architectural Design — items C, D, E

**BEFORE — D**
> D. PostgreSQL / MySQL Database

**BEFORE — E**
> E. Redis Cache
> Redis temporarily stores fast-changing data such as who is online, active
> sessions, and…

Neither PostgreSQL, MySQL nor Redis is in the system. Replacements:

**AFTER — C. VoIP Signaling (WebRTC)**
> This component sets up and manages voice calls. The server handles only call
> signaling — exchanging session descriptions and connection candidates between
> participants through Socket.IO — while the audio itself flows directly between
> devices as a peer-to-peer WebRTC stream. WebRTC mandates DTLS-SRTP for media,
> so call audio is encrypted between the two browsers and never traverses the
> server. Because all participants are on the same local area network and are
> directly reachable, the system operates with an empty ICE server list: no STUN
> or TURN servers are required, which keeps the entire call path inside the CICS
> LAN. Browsers require a secure origin to grant microphone access, so the server
> also exposes an HTTPS endpoint (port 3443) with a locally generated
> self-signed TLS certificate for LAN clients.

**AFTER — D. SQLite Database**
> The system uses SQLite, an embedded relational database engine accessed through
> Node.js's built-in `node:sqlite` module. All persistent data — user accounts,
> group chats, messages, call records, audit logs, and survey responses — is
> stored in a single database file on the local server. SQLite runs in
> Write-Ahead Logging (WAL) mode, which allows concurrent readers alongside a
> writer and is well suited to the system's scale of 50–100 concurrent users on a
> single LAN server. Because SQLite requires no separate database server process,
> installation, or credentials, it simplifies deployment on the college server
> and makes backup a matter of copying one file.

**AFTER — E. In-Memory Presence and Session State**
> Fast-changing data such as online status, active sessions, and login rate-limit
> counters are held directly in the Node.js server's memory and synchronized to
> clients through Socket.IO events. Because MSUkaIP runs as a single server on
> the local network, this in-process approach provides instant presence updates
> without the operational overhead of an external cache such as Redis.

**ADD — F. Access Control and Session Management**
> Authentication issues a signed JSON Web Token carrying the user's identity,
> role, and a token version number. Every request revalidates that version
> against the database, so incrementing it invalidates all outstanding tokens for
> an account instantly — used on sign-out, password change, account rejection,
> and account deletion. Tokens expire after eight hours.
>
> Authorization is enforced per conversation rather than per page. Before a
> message is read from or written to a group conversation, the server confirms
> the requesting account appears in that group's membership table; a request
> failing this check is refused and recorded in the audit log as an access
> violation. The same rule governs entry to a group call. The student and
> administrative interfaces are separate pages with separate login endpoints, and
> each refuses accounts belonging to the other role.

## 3.2.6 Network Architecture Design — append

Your two existing paragraphs on the LinkCode topology are accurate and stay. Add:

**ADD**
> Within this topology the server exposes two endpoints. Port 3000 serves the
> application over HTTP for general access, while port 3443 serves the same
> application over HTTPS using a self-signed TLS certificate generated on first
> start. The secure endpoint exists because browsers grant microphone access only
> to a secure origin, so voice features require it; it also encrypts message and
> file traffic in transit across the LAN.
>
> Voice traffic does not follow the same path as messaging traffic. Messages and
> files travel from client to server and back, whereas call audio establishes a
> direct peer-to-peer path between the two participating devices after signaling
> completes. Because both devices sit within the same LAN segment, this media
> path stays inside the college network and does not pass through the MSUkaIP
> server at all, reducing server load and keeping call latency low.

**Check Figure 3.7.** If it shows voice traffic routed through the server, that
is now wrong — and it is a point in your favour, so worth correcting.

---

## 3.3.1 Software Specification — Table A

**BEFORE**
> | Language | Purpose |
> | Python | Backend logic for authentication, message handling, file transfer, and channel management. |
> | HTML, CSS, and JavaScript | Front-end interface for real-time user interaction |
> | Node.js, Python (FastAPI) | Manages API requests and server-side operations. |

**AFTER**
> | Language | Purpose |
> | JavaScript (Node.js) | Backend logic for authentication, message handling, encrypted file transfer, VoIP signaling, and administration. |
> | HTML, CSS, and JavaScript | Front-end interface for real-time user interaction, served directly with no build step. |

*Why:* there is no Python in the system.

## 3.3.1 — Table B

**BEFORE**
> | Node.js (Express.js) / Python (FastAPI, Django) | Manages API requests and server-side operations. |
> | Socket.IO / WebSocket | Provides real-time communication between clients over LAN. |
> | Vue.js / React | Enables a responsive, user-friendly interface. |

**AFTER**
> | Express.js (Node.js) | Manages REST API requests and server-side operations. |
> | Socket.IO | Provides real-time messaging, presence, and VoIP signaling between clients over the LAN. |
> | WebRTC (browser API) | Establishes direct peer-to-peer audio streams for voice calls. |

*Why:* no Django, no Vue, no React. The front end is vanilla JavaScript with no
build step — which is a deployment advantage worth stating, not hiding.

## 3.3.1 — Table C

**BEFORE**
> | MySQL / MariaDB | Stores persistent system data aligned with the ERD (users, messages, channels, logs). |

**AFTER**
> | SQLite (via Node.js built-in `node:sqlite`, WAL mode) | Stores persistent system data aligned with the ERD (users, groups, messages, calls, audit logs, survey responses) in a single local database file. |

## 3.3.1 — Table D, add one row

**ADD**
> | HTTPS (TLS, self-signed certificate) | Secure endpoint on port 3443 providing the secure origin browsers require for microphone access on LAN clients. |

## 3.3.1 — Table F (Other Tools)

**BEFORE** — includes
> | Testing Tools | Postman, JMeter | Measuring and tracking the variation in… |

**AFTER**
> | Version Control | Git / GitHub | Code tracking and collaboration. |
> | Automated Testing | Playwright | End-to-end browser test suites covering authentication, messaging, security, and the feedback form. |
> | Static Analysis | ESLint | Code quality checks on server and inline front-end scripts. |
> | Security Measures | Login rate limiting, JWT token versioning, audit logging | Account protection, immediate session revocation, and security monitoring. |
> | UML Tools | Lucidchart, Draw.io | Diagram creation. |
> | Network Design | Cisco Packet Tracer | Designing the network architecture. |

---

## 3.4 Testing — append to the opening paragraph

Your paragraph ends: *"…message delivery speed, VoIP quality, system
accessibility, and user satisfaction."* Add after it:

**ADD**
> In addition to respondent evaluation, the system was verified through automated
> testing. System testing was conducted using Playwright, an automated
> browser-driven testing framework, executed against both Chromium and Firefox to
> verify that behaviour does not depend on a single rendering engine. The suite
> exercises the system through its interface rather than its API alone, covering
> authentication and portal separation, real-time messaging, file and image
> upload, the administrative dashboard, the evaluation form, responsive behaviour
> at mobile and desktop widths, and a dedicated group of authorization and
> security tests. Static analysis was performed with ESLint across both server
> code and the inline scripts of the front-end pages.
>
> Security testing was adversarial rather than confirmatory: each control was
> attacked before and after implementation, and a test was accepted only once it
> had been demonstrated to fail against the unfixed system.

## 3.4.3 — retitle and add a paragraph

**BEFORE**
> 3.4.3 tools (questionnaire)

**AFTER**
> 3.4.3 Tools and Instruments

Then add before the existing questionnaire description:

**ADD**
> Two instruments were used. The evaluation questionnaire described below gathers
> respondent perception, and the automated test suite described in Section 3.4
> verifies functional correctness and security independently of respondent
> opinion. The questionnaire is delivered by the system itself as an anonymous
> web form, and responses are written directly to the system database.

*Why:* the current title implies the questionnaire is your only instrument, which
undersells roughly 220 automated tests and the security work.

## 3.4.3 — add a fifth questionnaire component

Your components list A–D. The form now also collects an open comment.

**ADD**
> **E. Additional Comments**
>
> An optional free-text field inviting respondents to describe what worked well,
> what did not, and what they would change. This provides the qualitative data
> reported alongside the weighted means in Chapter 4.

---

# Checklist

- [ ] 1.3 General Objectives — 100 → 50–100
- [ ] 1.3 Specific Objective 3 — replace
- [ ] 1.4 Scope — replace paragraph
- [ ] 1.4 Limitations — append
- [ ] 2.1.3.4 — new subsection + reference
- [ ] 3.1.2 — replace the IP-address row
- [ ] 3.1.2 — add nine rows
- [ ] 3.1.2 — replace the Security row
- [ ] 3.2.4 — replace paragraph **and Figure 3.5**
- [ ] 3.2.5 — replace C, D, E; add F
- [ ] 3.2.6 — append two paragraphs; **check Figure 3.7**
- [ ] 3.3.1 — Tables A, B, C, F; add a row to D
- [ ] 3.4 — append to opening paragraph
- [ ] 3.4.3 — retitle, add paragraph, add component E
