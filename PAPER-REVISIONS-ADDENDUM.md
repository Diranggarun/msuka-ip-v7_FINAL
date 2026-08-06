# MSUkaIP — Paper Revisions, Addendum

Continues `MSUkaIP_Paper_Revisions (1).docx`, which was generated **20 July 2026**
and covers items 1–7. Everything below was built *after* that date and is not yet
reflected anywhere in the paper.

Numbering continues from the original document. Paste the replacement text as-is.

---

## 8. Section 1.4 Scope and Limitations — add to **Limitations**

Two boundaries that a panel will find if you do not state them. Both read as
deliberate engineering decisions when declared, and as oversights when not.

> Voice calls are limited to one-to-one conversations and to group chats with a
> defined membership. Group calls are not available in the Global Chat channel:
> WebRTC group calls use a full mesh topology, in which every participant
> maintains a direct connection to every other participant, so a call among *n*
> users requires *n(n-1)/2* connections. Because Global Chat contains every
> approved account in the college, a mesh call in that channel would not scale
> within the bandwidth of the CICS local network.
>
> Encryption of messages and files at rest protects stored data against
> unauthorized access to the database file or its backups; it is not end-to-end
> encryption. The server holds the encryption key, which is a necessary condition
> for the administrative and audit functions required by the institution.

---

## 9. Section 2.1.3.4 (RA 10173) — extend the paragraph

The original text lists the safeguards. Section 20 of the Act also requires the
ability to *monitor* incidents, which the system now does explicitly. Append:

> The Act further requires that a personal information controller be able to
> identify and monitor security incidents. MSUkaIP satisfies this through an
> administrative audit log that can be filtered by action type, by user, and by
> date range, and searched by free text, so that a specific class of event — for
> example, all failed login attempts against a particular account within a given
> week — can be isolated from routine activity. The dashboard additionally
> presents per-user login histories showing successful and failed attempts over
> time, enabling the pattern of repeated failures that characterizes a
> credential-guessing attempt to be recognized rather than merely recorded.

---

## 10. Section 3.1.2 Functional Requirements — add five rows

> Users shall be able to change their own password, which immediately revokes all
> other active sessions for that account. | Functional | Mandatory

> Users shall be able to edit their own display name. | Functional | Desirable

> The Admin shall be able to view all group chats, inspect their membership, and
> remove a group. | Functional | Mandatory

> The Admin shall be able to filter and search the audit log by action, user, and
> date range. | Functional | Mandatory

> The Admin shall be able to create and download a backup of the system database
> from the dashboard. | Functional | Desirable

---

## 11. Section 3.1.2 — replace the non-functional **Security** row again

Item 4 of the original document already replaced this row. That version predates
the transport-security and access-control work; use this instead:

> User passwords must be hashed using bcrypt (cost factor 12); chat messages and
> uploaded files must be encrypted at rest using AES-256-GCM; uploads must be
> stored in a restricted directory served only to authenticated users; repeated
> failed logins must be rate-limited to five attempts per fifteen minutes per
> account and address; administrative and student portals must be separated so
> that neither role can authenticate on the other's page; every response must
> carry security headers restricting content sources, framing, and MIME-type
> inference; and a secure HTTPS origin must be available for the local network.
> | Security | Mandatory

---

## 12. NEW Section 3.2.x — Access Control and Session Management

Add as a subsection of the Architectural Design. This describes work that has no
counterpart in the current paper.

> **Access Control and Session Management**
>
> Authentication issues a signed JSON Web Token carrying the user's identity,
> role, and a token version number. Every request revalidates that version
> against the database, so incrementing it invalidates all outstanding tokens for
> an account instantly — used on sign-out, password change, account rejection, and
> account deletion. Tokens expire after eight hours.
>
> Authorization is enforced per conversation rather than per page. Before a
> message is read from or written to a group conversation, the server confirms
> the requesting account appears in that group's membership table; a request that
> fails this check is refused and recorded in the audit log as an access
> violation. The same rule governs entry to a group call, so a non-member cannot
> obtain the peer list or exchange signaling data for a call they were not part
> of.
>
> The student and administrative interfaces are separate origins with separate
> login endpoints, and each refuses accounts belonging to the other role.

---

## 13. Section 3.4 (Testing) — replace the methodology description

The original paper cites Postman and JMeter. Item 6 of the first document
corrected the tools table; this replaces the prose that describes the approach.

> System testing was conducted using Playwright, an automated browser-driven
> testing framework, executed against both Chromium and Firefox to verify
> behaviour is not dependent on a single rendering engine. The suite exercises the
> system through its actual interface rather than through its API alone, covering
> authentication and portal separation, real-time messaging, file and image
> upload, the administrative dashboard, the evaluation form, responsive behaviour
> at mobile and desktop widths, and a dedicated group of authorization and
> security tests. Static analysis was performed with ESLint across both server
> code and the inline scripts of the front-end pages.
>
> Security testing was adversarial rather than confirmatory: each control was
> attacked before and after its implementation, and a test was accepted only once
> it had been demonstrated to fail against the unfixed system. Two defects found
> this way are reported in Chapter 4.

---

## 14. Chapter 4 — security testing results to report

These are findings, not claims. Each was reproduced, fixed, and covered by a test
that fails without the fix. They belong in Chapter 4 as testing results.

**Finding 1 — Broken access control on group conversations.**
Before the fix, an authenticated user who was not a member of a group could read
that group's message history and post into it by supplying the group's
conversation key directly. Corrected by validating group membership on the server
before any read or write, and by recording refused attempts in the audit log.
This is an instance of OWASP A01:2021 (Broken Access Control).

**Finding 2 — Stored cross-site scripting through display names.**
Before the fix, a display name containing markup was rendered as HTML wherever
that name appeared, including inside the administrator's dashboard. Corrected by
escaping every user-supplied value at the point it enters the document. This is
an instance of OWASP A03:2021 (Injection).

**Verification of injection resistance.**
Authentication inputs were tested with the standard payload set
(`' OR '1'='1`, `' OR SLEEP(5)--`, and variants). All were rejected. The system
uses parameterized queries throughout, so the payloads are compared as literal
strings rather than interpreted as SQL.

---

## 15. Chapter 4 — evaluation instrument

Describe the instrument before the results:

> Respondent feedback was gathered through a built-in evaluation form served by
> the system itself, comprising twenty-two statements rated on a five-point Likert
> scale across four sections — system usability, functionality, performance, and
> security — followed by an optional free-text comment. Responses are anonymous
> unless a respondent chooses to give a name, and are stored directly in the
> system database, from which per-section and overall weighted means are computed.
> The free-text responses provide the qualitative dimension reported alongside the
> means in this chapter.

---

## 16. Defense-ready justifications — additions to item 7

**Why the audit log needed filtering.** Roughly seventy per cent of audit entries
are administrators viewing screens. Without the ability to exclude routine reads,
the security events the log exists to surface are buried in ordinary use — so the
filter is what makes the log an instrument rather than an archive.

**Why voice is the strongest security claim.** WebRTC mandates DTLS-SRTP; there is
no unencrypted mode. Keys are negotiated directly between the two browsers and
the media never traverses the server, which only relays signaling. A compromised
MSUkaIP server could therefore not listen to a call — a stronger property than
the text path, where the server holds the key.

**Why encryption at rest is not end-to-end.** End-to-end encryption is
incompatible with the administrative oversight the institution requires. The
implemented model protects against theft of the database file or a backup, which
is the realistic threat to a single server in a college building.
