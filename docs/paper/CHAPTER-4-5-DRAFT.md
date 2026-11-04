# MSUkaIP — Chapters 4 and 5

Drafted 6 August 2026 against the as-built system.

**How to use this.** Everything not marked `‹FILL›` is written and can be pasted.
`‹FILL›` marks a number that must come from your real respondents — those are the
only gaps, and they close the moment collection ends.

Section 4.1 and 4.2 are already complete: they report automated testing and
security findings, which do not depend on respondents at all. If you are short on
time, those two sections alone are a legitimate Chapter 4 opening.

Format follows the existing paper: same heading depth, same table style, same
prose voice.

---

# CHAPTER 4: RESULTS AND DISCUSSION

This chapter presents the results of the development and evaluation of MSUkaIP.
It reports the outcome of automated system testing, the findings of security
testing, and the results of the respondent evaluation conducted with students,
faculty, and network administrators of the College of Information and Computing
Sciences.

## 4.1 System Testing Results

The system was verified through an automated test suite executed against two
browser engines, Chromium and Firefox, so that results are not dependent on a
single rendering engine. Testing was performed through the system's own interface
rather than against its endpoints alone, so that each result reflects the system
as a respondent would encounter it.

**Table 4.1 — Automated test coverage by area**

| Test group | Area covered | Result |
|---|---|---|
| 1 | Authentication, portal separation, terms agreement | Pass |
| 2 | Messenger interface, navigation, conversation filters, settings | Pass |
| 3 | Real-time messaging | Pass |
| 4 | File and image upload | Pass |
| 5 | Administrative dashboard, pending queue, login monitor | Pass |
| 6 | Performance and responsive layout (320–1920 px) | Pass |
| 7–8 | Registration and authentication API | Pass |
| 9 | Authorization and security guards | Pass |
| 10 | Account lifecycle | Pass |
| 12–13 | Evaluation form rendering, validation and submission | Pass |

A total of **‹FILL: total› automated tests passed** across both browsers on
‹FILL: date of your final run›. Static analysis with ESLint reported no errors
across the server code and the inline scripts of all three front-end pages.

> Run `npx playwright test` for the final figure, and record the date. Re-run
> `node scripts/clean-test-data.js` afterwards — the api, smoke and feedback-form
> specs each submit survey responses, which would otherwise contaminate the
> evaluation data reported in Section 4.3.

One known intermittent failure is documented: radio-button selection on the
evaluation form occasionally times out under Firefox when the full suite runs in
parallel. The affected tests pass consistently when that specification is run in
isolation, indicating a timing artefact of parallel execution rather than a
system defect.

### 4.1.1 Responsive Layout Verification

The interface was verified at viewport widths of 320, 375, 414, 768, 1024, 1280,
1654, and 1920 pixels. No horizontal overflow was observed at any width. On
screens narrower than 768 pixels the interface switches to a single-pane layout
with the navigation rail relocated to a bottom tab bar, and all interactive
targets meet the 44-pixel minimum recommended for touch input.

## 4.2 Security Testing Results

Security testing was adversarial rather than confirmatory: each control was
attacked before and after implementation, and a test was accepted as valid only
once it had been demonstrated to fail against the unfixed system. Two defects
were identified and corrected during development.

### 4.2.1 Finding 1 — Broken Access Control on Group Conversations

Before correction, an authenticated user who was not a member of a group could
read that group's message history and post messages into it by supplying the
group's conversation key directly, bypassing the interface. The defect was
confirmed by signing in as a non-member account and successfully retrieving
messages from a group that account did not belong to.

The system now validates group membership on the server before any read or write
to a group conversation, and records refused attempts in the audit log as access
violations. The same rule governs entry to a group call. Re-testing with the same
attack confirmed both the read and the write are refused, while a legitimate
member is unaffected.

This corresponds to OWASP A01:2021 — Broken Access Control.

### 4.2.2 Finding 2 — Stored Cross-Site Scripting Through Display Names

Before correction, a display name containing HTML markup was rendered as markup
wherever that name appeared. Because display names appear in the administrative
dashboard, a script placed in a student's own name would execute in the
administrator's browser session. The defect was confirmed by registering an
account whose name contained an image tag with an error handler, and observing
that handler execute.

Every user-supplied value is now escaped at the point it enters the document.
Re-testing confirmed the same payload renders as inert text.

This corresponds to OWASP A03:2021 — Injection.

### 4.2.3 Injection Resistance

Authentication inputs were tested with standard SQL injection payloads,
including `' OR '1'='1`, `' OR '1'='2`, and `' OR SLEEP(5)--`. All were rejected
and no timing delay was observed. The system uses parameterized queries
throughout, so such input is compared as a literal string rather than interpreted
as SQL.

### 4.2.4 Summary of Implemented Controls

**Table 4.2 — Security controls verified**

| Control | Implementation | Verified by |
|---|---|---|
| Password storage | bcrypt, cost factor 12 | Registration and login tests |
| Data at rest | AES-256-GCM, fail-closed | Message and file round-trip |
| Voice media | DTLS-SRTP, peer-to-peer | WebRTC requirement; LAN call test |
| Transport | TLS on port 3443 (self-signed) | Endpoint responds over HTTPS |
| Brute force | 5 failures / 15 min per account and address | Rate-limit test |
| Session revocation | JWT token versioning | Password-change test |
| Access control | Per-conversation membership check | Group IDOR test |
| Injection | Parameterized queries; output escaping | XSS and SQL payload tests |
| Path traversal | Filename pattern and resolved-path check | Backup download test |
| Privilege separation | Separate portals; admin-only routes | Authorization group |

## 4.3 Respondent Evaluation Results

### 4.3.1 Respondent Profile

A total of **‹FILL: N›** respondents from the College of Information and Computing
Sciences participated in the evaluation.

**Table 4.3 — Respondents by group**

| Respondent group | Frequency | Percentage |
|---|---|---|
| Student (3rd Year IT/CS) | ‹FILL› | ‹FILL› |
| Student (4th Year IT/CS) | ‹FILL› | ‹FILL› |
| Faculty Member | ‹FILL› | ‹FILL› |
| CICS Network Administrator | ‹FILL› | ‹FILL› |
| **Total** | **‹FILL›** | **100%** |

**Table 4.4 — Respondents by device used**

| Device | Frequency | Percentage |
|---|---|---|
| Desktop/Laptop (Windows) | ‹FILL› | ‹FILL› |
| Android Smartphone | ‹FILL› | ‹FILL› |
| iOS (iPhone/iPad) | ‹FILL› | ‹FILL› |
| Tablet | ‹FILL› | ‹FILL› |
| **Total** | **‹FILL›** | **100%** |

> Both tables come straight from the CSV export (Admin → Feedback → Export CSV):
> the `type` and `device` columns.

### 4.3.2 Interpretation Scale

Weighted means were interpreted using the following scale.

**Table 4.5 — Likert interpretation**

| Range | Interpretation |
|---|---|
| 4.50 – 5.00 | Strongly Agree |
| 3.50 – 4.49 | Agree |
| 2.50 – 3.49 | Neutral |
| 1.50 – 2.49 | Disagree |
| 1.00 – 1.49 | Strongly Disagree |

### 4.3.3 Results by Section

**Table 4.6 — Weighted means by evaluation section**

| Section | Area | Weighted Mean | Interpretation |
|---|---|---|---|
| A | System Usability | ‹FILL› | ‹FILL› |
| B | Functionality | ‹FILL› | ‹FILL› |
| C | Performance | ‹FILL› | ‹FILL› |
| D | Security | ‹FILL› | ‹FILL› |
| | **Overall** | **‹FILL›** | **‹FILL›** |

> The dashboard computes all five figures. Admin → Feedback shows the overall
> weighted mean and the four section means; the CSV carries the same values per
> respondent as `mean_a` through `mean_d` and `overall`.

Discussion paragraph to write once the figures exist — one short paragraph per
section, stating the mean, its interpretation, and what it indicates about that
aspect of the system. Where a section scores lower than the others, say so and
offer a reason; a uniformly high set of means with no discussion reads as
uncritical.

### 4.3.4 Qualitative Findings

Of the ‹FILL: N› respondents, **‹FILL: n›** provided an open comment.

> The dashboard reports this directly — the summary block shows "N left a
> comment" beneath the overall mean, and the results table marks each response
> that carries one.

Group the comments into themes and report each with a representative quotation.
Typical themes for a system of this kind:

- Ease of use and interface clarity
- Reliability of message delivery on the LAN
- Voice call quality
- File size limit (5 MB) as a constraint
- Requests for features outside the current scope

Report unfavourable comments as well as favourable ones. An evaluation reporting
only praise invites the question of what was omitted.

## 4.4 Discussion

Draft once Section 4.3 is complete. It should connect three things:

1. **Results against objectives.** Take each specific objective from Section 1.3
   and state the evidence that satisfies it — automated tests, security findings,
   the LAN field test, and the corresponding evaluation section.
2. **Results against the literature.** Section 2.1 discusses Social Presence
   Theory and Channel Expansion Theory. Relate the usability and functionality
   findings back to them.
3. **Results against comparable systems.** Section 2.3's matrix compares MSUkaIP
   with Briar, Zello, Cisco Jabber and similar. State where the evaluation places
   MSUkaIP relative to them for this specific institutional context.

---

# CHAPTER 5: SUMMARY, CONCLUSIONS AND RECOMMENDATIONS

## 5.1 Summary of Findings

This study designed, developed, and evaluated MSUkaIP, a LAN-based messaging and
voice communication system for the College of Information and Computing Sciences,
operating without internet connectivity.

The system was implemented as a Node.js and Express application using Socket.IO
for real-time messaging and presence, WebRTC for peer-to-peer voice, and SQLite as
an embedded database requiring no separate server process. The interface is
delivered as three self-contained web pages with no build step, so deployment on
the college server is a matter of copying files.

Functionally, the system provides real-time text messaging in private and group
conversations, image and document sharing with encryption at rest, push-to-talk
voice messages, one-to-one voice calls over the local network, administrative
account approval and management, broadcast announcements, a searchable security
audit log, and an anonymous evaluation survey.

Automated testing confirmed ‹FILL: total› tests passing across two browser
engines. Security testing identified and corrected two defects — a broken access
control on group conversations and a stored cross-site scripting vector through
display names — and verified resistance to SQL injection, brute-force
authentication, and path traversal.

Respondent evaluation with ‹FILL: N› participants produced an overall weighted
mean of ‹FILL›, interpreted as ‹FILL›.

## 5.2 Conclusions

Presented against each specific objective.

**1. Technical requirements analysis.** The study confirmed that VoIP over a local
area network can be delivered without STUN or TURN infrastructure when all
participants share a subnet, as they do within the CICS building. WebRTC peers
connect using host candidates alone, keeping the entire media path inside the
college network. This finding simplified the architecture relative to the original
design.

**2. Secure web application for messaging and voice.** The objective was met. The
system delivers real-time messaging and one-to-one voice calls operating
exclusively over the LAN. Voice media is encrypted by DTLS-SRTP, which WebRTC
mandates, and does not traverse the server; the server relays signalling only.

**3. Integration with institutional authentication and encryption.** The objective
was met. Registration is restricted to institutional email domains, accounts
require administrator approval before first use, messages and uploaded files are
encrypted at rest with AES-256-GCM, and the system sustained ‹FILL› concurrent
users during testing.

**4. Evaluation through a five-point Likert survey.** The objective was met, with
‹FILL: N› respondents drawn from the three intended groups. The overall weighted
mean of ‹FILL› indicates ‹FILL›.

**Overall conclusion.** MSUkaIP demonstrates that a college can operate a
self-contained communication system on its own network, retaining service during
internet outages and keeping message content within institutional control. The
security work carried out during development — particularly the correction of an
access-control defect that would have exposed private group conversations —
indicates that such systems require deliberate adversarial testing rather than
functional testing alone.

## 5.3 Recommendations

**For the College.**

1. Deploy MSUkaIP on a dedicated machine within the CICS network rather than a
   staff workstation, so availability does not depend on one person's laptop.
2. Assign a member of staff to the administrator role for account approval and
   periodic review of the audit log.
3. Schedule regular database backups. The system provides a one-click backup from
   the administrative dashboard.

**For future development.**

4. **Video calling.** The WebRTC foundation supports video; the current
   implementation carries audio only.
5. **Group calls at scale.** Group calls currently use a mesh topology, which
   limits practical group size. A Selective Forwarding Unit would allow larger
   groups at the cost of routing media through the server.
6. **Off-campus access.** Adding STUN and TURN servers, with the appropriate
   privacy assessment, would extend the system beyond the CICS wireless coverage.
7. **Mobile application.** A native client would permit background notifications,
   which a browser-based system cannot reliably deliver.
8. **End-to-end encryption.** Messages are presently encrypted at rest with a
   server-held key. End-to-end encryption would remove the server from the trust
   boundary, at the cost of the administrative oversight the institution
   currently requires — a trade-off warranting its own study.

## 5.4 Limitations of the Study

1. **Coverage.** The system operates only within CICS wireless coverage. Users
   outside the building cannot connect.
2. **Sample size.** The evaluation involved ‹FILL: N› respondents from one
   college. Results describe this population and are not generalisable to other
   institutions.
3. **Evaluation period.** Respondents used the system over a short period, so the
   study does not measure sustained adoption or behaviour over a full semester.
4. **Group call scale.** Group calls were not tested at the upper bound of group
   size, as mesh topology makes large group calls impractical by design.
5. **Encryption model.** Encryption at rest protects against access to the
   database file or its backups. It is not end-to-end, and the study did not
   assess resistance to an attacker holding server-level access.
6. **Single deployment.** The system was evaluated on one network. Behaviour on a
   differently configured LAN was not assessed.
