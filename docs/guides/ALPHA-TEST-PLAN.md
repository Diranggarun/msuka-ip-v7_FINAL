# MSUkaIP — Alpha Test Plan

Alpha testing = the developers test the whole system themselves, on a
controlled offline LAN, before real users (beta / survey respondents) use it.
Record what actually happened — leave a row blank rather than guessing.

## Setup

| Item | Value (fill in) |
| --- | --- |
| Date | |
| Testers | |
| Network | Laptop Mobile hotspot / phone hotspot (mobile data OFF) / LinkCode VLAN |
| Server | Laptop model, Windows version, Node version (`node -v`) |
| Server URL | `https://<server-ip>:3443` |
| Devices | e.g. Phone A (model, Android/iOS, browser), Phone B, Laptop B |

Before starting: internet OFF on the network, server started in production
mode, at least 2 test accounts (1 student, 1 faculty) and 1 admin account.
Use test accounts only — delete them after with `scripts/clean-test-data.js`.

Result column: **P** = pass, **F** = fail (write what happened in Notes).

## A. Access and connection

| ID | Test | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| A1 | Open `https://<server-ip>:3443` on a phone | Landing page loads after the certificate warning | | |
| A2 | Open `http://<server-ip>:3000` | Redirects to the HTTPS address | | |
| A3 | Use the system with internet OFF | Everything below still works | | |
| A4 | Open the sign-in page at phone width and laptop width | Layout fits, no sideways scrolling | | |

## B. Accounts and security

| ID | Test | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| B1 | Register with a non-institutional email (e.g. gmail) | Rejected | | |
| B2 | Register with an institutional email, password < 8 chars | Rejected | | |
| B3 | Register correctly | Account waits for admin approval | | |
| B4 | Admin approves the account; user signs in | Terms agreement shows once, then chat opens | | |
| B5 | Wrong password 5 times | 6th attempt blocked for 15 minutes | | |
| B6 | Student account on `/admin.html` | Refused | | |
| B7 | Admin account on the chat sign-in | Sent to the admin portal only | | |
| B8 | Change password in Settings, sign in again | New password works, old one does not | | |
| B9 | Log out, press Back | Chat not shown without signing in | | |

## C. Messaging

| ID | Test | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| C1 | Send a message in General chat | Appears on the other device within ~1 s | | |
| C2 | Typing indicator | Other device shows "typing…" | | |
| C3 | Reply to a message | Reply shows the quoted message | | |
| C4 | React to a message | Reaction shows on both devices | | |
| C5 | Seen receipt | Sender sees it was seen after the other opens the chat | | |
| C6 | Delete own message | Removed on both devices | | |
| C7 | Create a group, add members | Members see the group and its messages | | |
| C8 | Scroll up in a long chat | Older messages load | | |
| C9 | Turn Wi-Fi off on one phone, send, turn it back on | Message is sent after reconnecting, not lost | | |
| C10 | Message with `<script>alert(1)</script>` | Shown as plain text, nothing runs | | |

## D. Files and voice messages

| ID | Test | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| D1 | Send an image (JPG/PNG) | Preview shows on both devices | | |
| D2 | Send a PDF and a DOCX | Download works on the other device | | |
| D3 | Send a file over 5 MB | Rejected with a message | | |
| D4 | Send a disallowed type (e.g. .exe) | Rejected | | |
| D5 | Record and send a voice message | Plays on the other device | | |
| D6 | Open a file link while signed out | Refused | | |

## E. Voice calls

| ID | Test | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| E1 | Call an online user (CICS Chat → Call) | Other phone rings | | |
| E2 | Accept the call | Both hear each other clearly | | |
| E3 | Reject a call | Caller is told it was declined | | |
| E4 | Call someone already in a call | Caller is told the user is busy | | |
| E5 | Call quality reading during the call | Record RTT, jitter, packet loss shown | | RTT ___ ms, jitter ___ ms, loss ___ % |
| E6 | Hang up from either side | Call ends on both | | |
| E7 | Group call with 3 devices | All three hear each other | | |
| E8 | 5-minute call | No drop | | |

## F. Admin portal

| ID | Test | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| F1 | Dashboard stats | Counts match reality | | |
| F2 | Pending queue: approve / reject | Works, user is notified on sign-in | | |
| F3 | Deactivate a user | That user cannot sign in | | |
| F4 | Revoke a user's sessions | That user is signed out | | |
| F5 | Login monitor | Shows the sign-ins just made | | |
| F6 | Audit log | Shows approvals, deactivation, failed logins | | |
| F7 | Broadcast an announcement | All online users receive it | | |
| F8 | Create a backup and download it | File downloads | | |
| F9 | Survey results + CSV export | Opens and downloads | | |

## G. Data protection (server laptop)

| ID | Test | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| G1 | Open `msukaip.db` with a SQLite viewer, look at `messages` | Text is unreadable (encrypted) | | |
| G2 | Open a file in `uploads/` directly | Unreadable (encrypted) | | |

## H. Load (optional, needs many devices)

| ID | Test | Expected | Result | Notes |
| --- | --- | --- | --- | --- |
| H1 | 10+ devices signed in, all sending | No dropped messages, server stays up | | Devices: ___ |

## Summary

| Area | Passed / total |
| --- | --- |
| A Access | / 4 |
| B Accounts | / 9 |
| C Messaging | / 10 |
| D Files | / 6 |
| E Calls | / 8 |
| F Admin | / 9 |
| G Data protection | / 2 |
| H Load | / 1 |

Failures found and how they were fixed:

1.

Send the filled tables back to be written up as the alpha testing results in
Chapter 4.
