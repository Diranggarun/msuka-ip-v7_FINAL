/**
 * MSUkaIP paper revisions, round 2 — Google Apps Script (November 2026)
 *
 * Second pass after a full read of Chapters 1–3 against the built system:
 * the real software stack (Chapter 3.3), registration and approval, the
 * campus Wi-Fi client-isolation finding, the IPO modules, the hardware tables,
 * and the Section 3.4 testing text (ISO/IEC 25010, UAT, weighted mean).
 *
 * Run the same way as apply-revisions.gs: Extensions -> Apps Script, paste,
 * run previewRevisions, then applyRevisions. Undo with File -> Version history.
 */

// [section, find, replace, expectedMatches (default 1)]. Find text is literal.
// expectedMatches is 2 where the same words also appear in the Table of Contents
// or in two tables, and both should change.
const REVISIONS = [
  // ── Chapter 1 ──
  ['1.1 features', 'The system will support text messaging, image transfer, and audio communication through the local Wi-Fi network, without relying on the internet.',
    'The system supports text messaging in private and group conversations, image and document sharing, voice messages, and voice calls through the local Wi-Fi network, without relying on the internet.'],
  ['1.1 deployment', 'The system will be implemented across existing Wi-Fi access points surrounding the college.',
    'The system is designed to run on the existing Wi-Fi access points of the college, provided those access points allow connected devices to reach one another (see Section 1.4).'],
  ['1.4 Wi-Fi isolation', 'Users must connect to the college’s Wi-Fi network to access the system.',
    'Users must connect to the college’s Wi-Fi network to access the system. The access point must also allow connected devices to communicate with one another; during testing, the CICS Wi-Fi enforced client isolation, which blocks this, so the system was tested on a dedicated, isolated wireless network with no internet connection.'],
  ['1.4 authentication', 'User authentication requires valid institutional email credentials.',
    'Registration requires an institutional email address (@cics.msu.edu, @s.msumain.edu.ph, or @msumain.edu.ph), and each new account must be approved by an administrator before it can sign in. Because the system operates offline, the email address is not verified by sending a message to it; administrator approval serves as the identity check.'],
  ['1.4 remove duplicate sentence', ' New accounts must be approved by an administrator before they can sign in.', ''],
  ['1.5 administrators', 'using access logs and session data to ensure consistent and secure communication within the college.',
    'using the audit log, login activity, and usage statistics, and they can approve or reject registrations, revoke a user’s sessions immediately, and back up the database, ensuring consistent and secure communication within the college.'],

  // ── Chapter 2 ──
  ['2.1.3.3 identity', 'by utilizing Institutional Email Authentication as the primary gatekeeper for user access.',
    'by requiring an institutional email address together with administrator approval as the gatekeeper for user access.'],
  ['2.1.3.4 terms of use', 'and an audit log records the actor, IP address, and device of every security-relevant action.',
    'an audit log records the actor, IP address, and device of every security-relevant action; and users must accept the system’s Terms of Use before their first use, which is recorded with a timestamp.'],
  ['2.1.5 typo', 'whether through text, or voicemimics', 'whether through text or voice, mimics'],
  ['2.4.3 proposed workflow', 'Instead of routing data through the internet, the system directs the user to the local MSUkaIP server via a web application.',
    'Instead of routing data through the internet, the user opens the MSUkaIP web application at https://msukaip.local:3443 in a browser, which connects directly to the local MSUkaIP server.'],
  ['2.4.3 proposed workflow', 'Once authenticated using their institutional credentials, users can send messages and lightweight images that are routed directly through the local server.',
    'Once their account has been approved and they sign in with their institutional email, users can send messages, files, images, and voice messages, and start voice calls, all routed through the local server.'],

  // ── Chapter 3.1 requirements ──
  ['3.1.2 FR authentication', 'User Authentication: The system shall allow students and faculty to log in using their verified institutional Email and password.',
    'User Authentication: The system shall allow students and faculty to register with an institutional email address and to log in with their email and password once an administrator has approved the account. Administrator accounts sign in only through the separate admin portal.'],
  ['3.1.2 FR group chats', 'Users and administrators shall be able to create group chats (channels) for specific subjects and select their members upon creation.',
    'Users shall be able to create group chats for specific subjects and select their members upon creation; administrators shall be able to view and remove groups.'],
  ['3.1.2 FR chat history', 'The system shall store chat logs locally so users can view past conversations upon relogging.',
    'The system shall store encrypted chat history on the local server so users can view past conversations after signing in again.'],
  ['3.1.2 FR voice calls', 'Users shall be able to initiate peer-to-peer voice calls within the local network (WebRTC).',
    'Users shall be able to make one-to-one and group voice calls within the local network using WebRTC.'],
  ['3.1.2 NFR usability', 'on both mobile browsers (Android) and desktop browsers.', 'on both mobile browsers (Android and iOS) and desktop browsers.'],
  ['3.1.2 NFR compatibility', '(Chrome, Edge, Firefox)', '(Chrome, Edge, Firefox, and Safari)'],

  // ── Chapter 3.2 design ──
  ['3.2.1 HIPO text', 'It decomposes the main application into its core functional Messaging, VoIP, User, and Admin .',
    'It decomposes the main application into four core modules: User and Authentication, Messaging, VoIP, and Administration.'],
  ['3.2.2 auth module', 'It begins when the user enters their institutional email and password. These credentials are checked against the database to confirm their validity.',
    'It begins when the user registers with an institutional email address; the new account stays pending until an administrator approves it. At login, the user enters their email and password, which are checked against the bcrypt hash stored in the database, and repeated failed attempts are rate-limited.'],
  ['3.2.2 auth module', 'the system generates a session token (JWT) that identifies the user and grants access to the system.',
    'the system generates a session token (JWT), valid for eight hours, that identifies the user and grants access to the system. Administrators sign in through a separate portal and receive access only to the admin dashboard.'],
  ['3.2.2 VoIP module', 'audio is streamed over RTP on UDP', 'audio is streamed directly between the devices over encrypted SRTP on UDP'],
  ['3.2.2 admin module', 'such as adding or removing users, creating groups, sending broadcasts, or managing sessions.',
    'such as approving registrations, adding or removing users, removing groups, sending broadcasts, revoking sessions, and creating database backups.'],
  ['3.2.2 admin module', 'The output includes updated user records, newly created groups, broadcast messages delivered, and real-time monitoring of user activity,',
    'The output includes updated user records, delivered broadcast messages, audit log entries, survey results, and usage statistics,'],
  ['3.2.6 network', 'without using the external internet.',
    'without using the external internet. For messaging and voice calls to reach every device, the access points serving MSUkaIP must allow wireless clients to communicate with one another (client isolation disabled), which requires coordination with the CICS network administrator.'],

  // ── Chapter 3.3 software stack ──
  ['3.3.1 A Node.js', 'Backend logic for authentication, message handling, encrypted file transfer, VoIP signaling, and administration.',
    'Backend logic for authentication, message handling, encrypted file transfer, VoIP signaling, and administration, running on Node.js 22.5 or later.'],
  ['3.3.1 A front end', 'Front-end interface for real-time user interaction, served directly with no build step.',
    'Front-end interface for real-time user interaction, served directly with no build step; the evaluation survey form uses Alpine.js (self-hosted, CSP build).'],
  ['3.3.1 B Express', 'Manages REST API requests and server-side operations.',
    'Manages REST API requests and server-side operations, with Multer handling file and voice-message uploads.'],
  ['3.3.1 B WebRTC', 'Establishes direct peer-to-peer audio streams for voice calls..', 'Establishes direct peer-to-peer audio streams for voice calls.'],
  ['3.3.1 D HTTP row', 'API communication between server and client.',
    'API communication between server and client. The server also announces the name msukaip.local over multicast DNS (mDNS), so users open the system by name instead of an IP address.'],
  ['3.3.1 F security', 'Login rate limiting, JWT token versioning, audit logging',
    'bcryptjs password hashing; JSON Web Tokens with token versioning; AES-256-GCM encryption (Node.js crypto); login rate limiting; HTTPS with a locally generated certificate (selfsigned); security headers (Content-Security-Policy, X-Frame-Options); audit logging'],
  ['3.3.1 F diagrams', 'Lucidchart, Draw.io', 'Lucidchart, Draw.io, Mermaid (ERD)'],

  // ── Chapter 3.3 hardware ──
  ['3.3.2 B client CPU', 'Running the messaging client smoothly.', 'Running a modern web browser smoothly.'],
  ['3.3.2 B client network', '100 Mbps or Gigabit Ethernet', 'Wi-Fi or 100 Mbps Ethernet'],
  ['3.3.2 C Android CPU', 'Handles app performance and real-time messaging.', 'Runs a modern mobile browser for real-time messaging.'],
  ['3.3.2 C Android RAM', 'Smooth app usage and background processes.', 'Smooth browser use while other apps run.'],
  ['3.3.2 C/D storage', 'Stores app data and cached files.', 'Stores browser cache only; no app is installed.', 2],
  ['3.3.2 E cables', 'Testing Ensures high-speed and stable LAN messaging.', 'Connects the server to the college switch for a stable wired link.'],

  // ── Chapter 3.4 testing ──
  ['3.4 intro', 'Testing focuses on message delivery speed, VoIP quality, system accessibility, and user satisfaction.',
    'Five methods are used: functional and use case testing with automated Playwright scripts confirm that each feature works as specified; performance testing measures message delay and server stability with 50–100 simulated users; compatibility testing checks Chrome, Edge, Firefox, and Safari on Windows laptops, Android phones, and iPhones; and user acceptance testing gathers the judgement of CICS students and faculty through the evaluation questionnaire described in Section 3.4.3.'],
  ['3.4.1 heading', '3.4.1 respondents', '3.4.1 Respondents', 2],
  ['3.4.2 heading', '3.4.2 procedure', '3.4.2 Procedure', 2],
  ['3.4.2 evaluation row', 'Respondents complete the evaluation questionnaire, providing ratings on functionality, usability, performance, and system reliability.',
    'Respondents complete the anonymous evaluation questionnaire built into the system, rating usability, functionality, performance, and satisfaction; responses are stored directly in the system database.'],
  ['3.4.3 heading', '3.4.3 tools (questionnaire)', '3.4.3 Tools and Instruments', 2],
  ['3.4.3 basis', 'This tool ensures standardized data collection and aligns with the theories presented in Chapter 2, particularly Social Presence Theory and Channel Expansion Theory, which emphasize user perception and familiarity.',
    'The questionnaire is a researcher-made instrument adapted from ISO/IEC 25010, the international standard for software product quality: Section A corresponds to Usability, Section B to Functional Suitability, Section C to Performance Efficiency, and Section D to Satisfaction. It also reflects the Technology Acceptance Model (Section 2.1.7), since usability measures perceived ease of use while functionality and satisfaction measure perceived usefulness. It contains 22 rated statements and an open-ended Section E for comments, and is delivered by the system itself as an anonymous web form.'],
  ['3.4.3 component B', 'Quality of voice communication', 'Quality of voice calls, voice messages, group chats, and broadcasts'],
  ['3.4.3 treatment', 'This ensures quantifiable results that can be analyzed objectively.',
    'This ensures quantifiable results that can be analyzed objectively. Before data collection, the questionnaire is reviewed for content validity by the adviser and at least two IT faculty members, and pilot-tested with ten respondents outside the final sample; its reliability is measured with Cronbach’s alpha, where 0.70 or higher is acceptable. Respondent profiles are described using frequency and percentage, and ratings are analyzed using the weighted mean, WM = Σ(f × w) / N, where f is the number of respondents choosing a rating, w is the weight of that rating from 1 to 5, and N is the total number of respondents. Weighted means are interpreted as follows: 4.50–5.00 Strongly Agree, 3.50–4.49 Agree, 2.50–3.49 Neutral, 1.50–2.49 Disagree, and 1.00–1.49 Strongly Disagree.'],
];

// replaceText() takes a regular expression; escape the find text so it is matched literally.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// replaceText() uses Java replacement rules, where "$" and "\" are special;
// put a backslash in front of each so they stay literal.
function escapeReplacement(text) {
  return text.replace(/[\\$]/g, '\\$&');
}

function countMatches(body, find) {
  let count = 0;
  let match = body.findText(escapeRegex(find));
  while (match) {
    count++;
    match = body.findText(escapeRegex(find), match);
  }
  return count;
}

// Dry run: reports what would change, edits nothing.
function previewRevisions() {
  const body = DocumentApp.getActiveDocument().getBody();
  let ok = 0;
  REVISIONS.forEach(([section, find, , expected = 1]) => {
    const n = countMatches(body, find);
    if (n === expected) ok++;
    Logger.log((n === expected ? 'OK        ' : 'FOUND ' + n + ' (want ' + expected + ') ') + section);
  });
  Logger.log(ok + ' of ' + REVISIONS.length + ' revisions ready.');
}

// Applies every revision whose match count is as expected; skips and reports the rest.
function applyRevisions() {
  const body = DocumentApp.getActiveDocument().getBody();
  let applied = 0;
  REVISIONS.forEach(([section, find, replace, expected = 1]) => {
    const n = countMatches(body, find);
    if (n !== expected) {
      Logger.log('SKIPPED (' + n + ' matches, want ' + expected + ') ' + section);
      return;
    }
    body.replaceText(escapeRegex(find), escapeReplacement(replace));
    applied++;
    Logger.log('APPLIED   ' + section);
  });
  Logger.log(applied + ' of ' + REVISIONS.length + ' revisions applied.');
}
