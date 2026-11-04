/**
 * MSUkaIP paper revisions — Google Apps Script (November 2026)
 *
 * Applies the find/replace items from "MSUkaIP Paper — Revisions to Apply"
 * directly inside ITE191_Revise_Paper. Images, tables and formatting are kept:
 * only the matching text changes.
 *
 * HOW TO RUN
 *   1. Open the paper in Google Docs.
 *   2. Extensions -> Apps Script. Delete the sample code, paste this file, Save.
 *   3. Choose "previewRevisions" in the function menu and click Run.
 *      (First time: Review permissions -> choose your account -> Allow.)
 *      View -> Logs (or Execution log) shows which items were found.
 *   4. Choose "applyRevisions" and click Run.
 *   5. To undo everything: File -> Version history -> restore the version
 *      from before you ran it.
 */

// [section, find, replace]. Find text is literal (not a pattern).
const REVISIONS = [
  ['Title page', 'COLLEGE OF INFORMATION AND COMPUTING STUDIES',
    'COLLEGE OF INFORMATION AND COMPUTING SCIENCES'],

  ['1.3 General Objective', 'capable of supporting at least 100 concurrent users',
    'capable of supporting 50–100 concurrent users'],

  ['1.3 Specific Objective 4',
    'To evaluate system performance and usability through a 5-point Likert Scale survey with 30 respondents to measure functionality and reliability.',
    'To evaluate the system through functional, performance, and compatibility testing, and through user acceptance testing in which 20–30 CICS respondents rate its usability, functionality, performance, and satisfaction on a 5-point Likert scale questionnaire adapted from ISO/IEC 25010.'],

  ['1.4 Limitation', 'Consequently, the system will not operate outside the CICS Wi-Fi coverage range.',
    'Consequently, the system will not operate outside the CICS Wi-Fi coverage range. New accounts must be approved by an administrator before they can sign in. Voice messages are limited to 10 MB per recording. Voice calls are available in one-to-one conversations and in group chats with a defined membership, but not in the college-wide CICS Chat channel: group calls use a full-mesh connection in which every participant connects to every other participant, which would exceed the capacity of the local network for a channel containing every account in the college. Finally, messages and files are encrypted at rest to protect the stored database and its backups; this is not end-to-end encryption, because the server holds the encryption key in order to support the administrative and audit functions the college requires.'],

  ['2.1.4 QoS',
    'By applying QoS principles, the system can prioritize voice packets over standard text or file transfers within the CICS Local Area Network.',
    'MSUkaIP applies QoS principles in two ways: it keeps all traffic inside the CICS Local Area Network, where latency and packet loss are far lower than on the congested internet link, and it carries voice through WebRTC, whose built-in jitter buffering and congestion control adapt the audio stream to network conditions. Packet-level prioritization of voice traffic is a function of the network equipment and is outside the scope of this project.'],

  ['2.1.6 heading', '2.1.6 Shannon-Waver Communication Method',
    '2.1.6 Shannon–Weaver Model of Communication'],

  ['2.1.7 TAM citation', 'Davis, F. D. (2017).', 'Davis, F. D. (1989).'],
  ['2.1.7 TAM citation', 'Venkatesh, V., & Davis, F. D. (2015).', 'Venkatesh, V., & Davis, F. D. (2000).'],

  ['2.2.2 heading', '12.2.2 Briar Messenger', '2.2.2 Briar Messenger'],
  ['2.2.4 heading', 'LAN Chat Messegner', 'LAN Chat Messenger'],

  ['3.1.2 FR table', 'Mandatory``', 'Mandatory'],
  ['3.1.2 FR table',
    'The Admin shall be able to send a "Broadcast Message" that notification to all active users.',
    'The Admin shall be able to send a broadcast message that notifies all active users.'],

  ['3.1.2 NFR latency', 'latency of less than 1 second or more within', 'latency of less than 1 second within'],
  ['3.1.2 NFR reliability',
    'The local server should support at least all clints in the college concurrent user connections without crashing.',
    'The local server should support 50–100 concurrent user connections without crashing.'],
  ['3.1.2 NFR security', 'and repeated failed logins must be rate-limited.',
    'and repeated failed logins must be rate-limited to five attempts per fifteen minutes per account and address.'],

  ['3.2.2 Messaging Module', 'validating the message, saving copy to the database for record-keeping',
    'validating the message, encrypting it with AES-256-GCM, saving the encrypted copy to the database for record-keeping'],

  ['3.2.4 ERD',
    'The Entity–Relationship Diagram (ERD) defines the logical database structure of MSUkaIP, outlining all necessary entities, attributes, and relationships to support secure LAN messaging, group communication, file sharing, VoIP signaling, and administrative monitoring within the CICS Local Area Network.',
    'The Entity–Relationship Diagram (ERD) defines the logical database structure of MSUkaIP. '],
  ['3.2.4 ERD', 'This ERD provides a scalable and efficient foundation for the backend of the MSUkaIP system.',
    'The schema comprises seven entities. Users stores account identity, the bcrypt password hash, role, account status, and a token version used for session revocation. Messages stores every message with its conversation key, type, encrypted body, and file metadata, and is linked to its sender. Groups stores group chats and their creator, while Group Members resolves the many-to-many relationship between users and groups and ensures that a user appears in a group only once. Calls records voice call attempts with caller, receiver, status, and duration. Audit Logs records security-relevant actions with the acting user, IP address, and device. Survey Responses stores evaluation results and is deliberately not linked to the users table: the absence of that relationship is what makes the evaluation anonymous, since a stored response cannot be traced back to an account. All relationships are enforced with foreign keys, so referential integrity is maintained by the database engine rather than by application code alone.'],

  ['3.2.5 A WebSocket',
    'The web version of Messenger communicates via standard HTTPS and uses WebSockets for instant notifications and constant communication between the server and the web client.',
    'The MSUkaIP web client communicates with the local server over HTTPS and keeps a WebSocket connection open for instant message delivery, presence updates, and call signaling, so the server can push data to the client without waiting for a request.'],
  ['3.2.5 F Transport', 'TCP ensures reliable, ordered, and secure delivery of data like messages and file transfers.',
    'TCP ensures reliable and ordered delivery of data such as messages and file transfers; security is added on top of TCP by TLS (HTTPS).'],

  ['3.3.1 D UDP row', 'Optional for VoIP or fast lightweight broadcasting.',
    'Carries the WebRTC voice-call audio stream between devices.'],
  ['3.3.1 E OS', 'Deployment environment for backend server, DB, and services.',
    'Deployment environment (Windows 10 or 11) for the backend server, running Node.js version 22.5 or later. Clients need only a web browser.'],
  ['3.3.1 F Version control', 'GitHub / GitLab', 'Git and GitHub'],

  ['3.3.2 B Client storage', 'Installation of client app and temporary files.',
    'Browser cache only; no installation is required.'],
  ['3.3.2 D iOS', 'Ensures smooth performance for the iOS client app.', 'Runs the web application in Safari.'],
];

// Table rows to delete entirely: the row whose text contains this phrase.
const ROWS_TO_DELETE = [
  ['3.1.2 duplicate security row', 'User passwords must be encrypted (e.g., hashed using Bcrypt)'],
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

function findRow(body, phrase) {
  const match = body.findText(escapeRegex(phrase));
  if (!match) return null;
  let el = match.getElement();
  while (el && el.getType() !== DocumentApp.ElementType.TABLE_ROW) el = el.getParent();
  return el;
}

// Dry run: reports what would change, edits nothing.
function previewRevisions() {
  const body = DocumentApp.getActiveDocument().getBody();
  let ok = 0;
  REVISIONS.forEach(([section, find]) => {
    const n = countMatches(body, find);
    if (n === 1) ok++;
    Logger.log((n === 1 ? 'OK        ' : n === 0 ? 'NOT FOUND ' : 'FOUND ' + n + 'x  ') + section);
  });
  ROWS_TO_DELETE.forEach(([section, phrase]) => {
    Logger.log((findRow(body, phrase) ? 'OK        ' : 'NOT FOUND ') + section + ' (delete row)');
  });
  Logger.log(ok + ' of ' + REVISIONS.length + ' text revisions ready.');
}

// Applies every revision that matches exactly once; skips and reports the rest.
function applyRevisions() {
  const body = DocumentApp.getActiveDocument().getBody();
  let applied = 0;
  REVISIONS.forEach(([section, find, replace]) => {
    const n = countMatches(body, find);
    if (n !== 1) {
      Logger.log('SKIPPED (' + n + ' matches) ' + section);
      return;
    }
    body.replaceText(escapeRegex(find), escapeReplacement(replace));
    applied++;
    Logger.log('APPLIED   ' + section);
  });
  ROWS_TO_DELETE.forEach(([section, phrase]) => {
    const row = findRow(body, phrase);
    if (row) { row.removeFromParent(); Logger.log('DELETED   ' + section); }
    else Logger.log('SKIPPED (not found) ' + section);
  });
  Logger.log(applied + ' of ' + REVISIONS.length + ' text revisions applied.');
}
