# MSUkaIP — Claude Code Prompts Guide

> **For:** Hussie, Sahara & Sittie Hanzaliah — CICS, MSU-Main
> **Project:** LAN-based Web-app Communication System (Messaging + VoIP)
> **Use:** Open VS Code → Open Claude Code → Copy-paste each prompt **in order**.

---

## How to Use This Guide

1. **Run prompts in order** (Phase 1 → Phase 15). Each phase builds on the previous one.
2. **Open one terminal for the backend, one for the frontend.** Don't run them in the same terminal.
3. **Paste the entire prompt block** (between the `---` lines) into Claude Code. Don't paraphrase.
4. **After each prompt finishes**, run the "Verify" command at the bottom of that section before moving on.
5. **If something breaks**, jump to **Phase 15: Debugging** — copy the matching error pattern.

**Tech stack locked in (from your Chapter 3):**
- Backend: **Python 3.11 + FastAPI**
- Real-time: **Socket.IO** (python-socketio) for chat, **WebRTC** for voice
- Database: **MySQL 8** (via SQLAlchemy + PyMySQL)
- Cache: **Redis** (for online presence)
- Frontend: **React 18 + Vite + TailwindCSS**
- Auth: **JWT + Bcrypt**
- Deployment target: **Windows server inside CICS LAN**

---

## Project Folder Layout (final)

```
MSUkaIP/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── sockets/
│   │   └── utils/
│   ├── uploads/          ← restricted, 5MB cap
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── services/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── database/
│   └── schema.sql
└── README.md
```

---

# PHASE 1 — Project Bootstrap & Folder Structure

**Goal:** Create the folder skeleton, virtual environment, and starter files. No code logic yet.

```text
I'm starting a capstone project called MSUkaIP — a LAN-based web messaging and VoIP system for MSU-CICS.

Create the following folder structure in the current directory:

MSUkaIP/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/__init__.py
│   │   ├── schemas/__init__.py
│   │   ├── routers/__init__.py
│   │   ├── services/__init__.py
│   │   ├── sockets/__init__.py
│   │   └── utils/__init__.py
│   ├── uploads/.gitkeep
│   ├── requirements.txt
│   └── .env.example
├── frontend/        (leave empty for now — we'll Vite-init it later)
├── database/
│   └── schema.sql   (empty placeholder)
├── .gitignore
└── README.md

Tasks:
1. Create the structure above using mkdir/touch (or PowerShell equivalents — I'm on Windows).
2. Inside backend/, create a Python virtual environment named `venv` using `python -m venv venv`.
3. Fill `backend/requirements.txt` with: fastapi, uvicorn[standard], sqlalchemy, pymysql, cryptography, pydantic, pydantic-settings, python-multipart, python-jose[cryptography], bcrypt==4.0.1, passlib[bcrypt], python-socketio, redis, python-dotenv. Pin reasonable stable versions.
4. Fill `.gitignore` with standard Python + Node + .env + uploads/ exclusions.
5. Fill `README.md` with the project title, authors (Hussie G. Diranggarun, Sahara B. Lominog, Sittie Hanzaliah S. Radia), adviser (Prof. Mohammad Domato), and a one-paragraph project summary.
6. Fill `backend/.env.example` with placeholders for: DATABASE_URL, JWT_SECRET, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, REDIS_URL, UPLOAD_DIR, MAX_UPLOAD_MB.

Do NOT install packages yet — just create files. Print the final tree at the end.
```

**Verify:**
```powershell
cd MSUkaIP
tree /F
```

---

# PHASE 2 — Database Schema (MySQL)

**Goal:** Create the exact schema from your ERD (Chapter 3.2.4) as a runnable SQL file.

```text
I have an ERD from my capstone. Generate `database/schema.sql` for MySQL 8 that creates the database `msukaip_db` and ALL these tables with correct PKs, FKs, indexes, and ENUM types.

Tables (use these exact names and columns):

1. users
   - user_id INT PK AUTO_INCREMENT
   - name VARCHAR(150) NOT NULL
   - institutional_email VARCHAR(150) UNIQUE NOT NULL  -- "IE" in ERD
   - password_hash VARCHAR(255) NOT NULL
   - role ENUM('student','faculty','admin') NOT NULL DEFAULT 'student'
   - status ENUM('online','offline','away') DEFAULT 'offline'
   - created_at DATETIME DEFAULT CURRENT_TIMESTAMP

2. sessions
   - session_id INT PK AUTO_INCREMENT
   - user_id INT FK → users.user_id ON DELETE CASCADE
   - token VARCHAR(512) NOT NULL
   - login_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
   - logout_timestamp DATETIME NULL
   - INDEX(user_id), INDEX(token(255))

3. conversations
   - conversation_id INT PK AUTO_INCREMENT
   - type ENUM('direct','group') NOT NULL
   - title VARCHAR(150) NULL  -- null for direct chats
   - created_at DATETIME DEFAULT CURRENT_TIMESTAMP

4. conversation_members
   - convmember_id INT PK AUTO_INCREMENT
   - conversation_id INT FK → conversations.conversation_id ON DELETE CASCADE
   - user_id INT FK → users.user_id ON DELETE CASCADE
   - UNIQUE(conversation_id, user_id)

5. groups
   - group_id INT PK AUTO_INCREMENT
   - created_by INT FK → users.user_id
   - name VARCHAR(150) NOT NULL
   - created_at DATETIME DEFAULT CURRENT_TIMESTAMP

6. group_members
   - gmember_id INT PK AUTO_INCREMENT
   - group_id INT FK → groups.group_id ON DELETE CASCADE
   - user_id INT FK → users.user_id ON DELETE CASCADE
   - creation_date DATETIME DEFAULT CURRENT_TIMESTAMP
   - UNIQUE(group_id, user_id)

7. messages
   - message_id INT PK AUTO_INCREMENT
   - sender_id INT FK → users.user_id
   - receiver_id INT NULL  -- nullable for group messages
   - conversation_id INT FK → conversations.conversation_id ON DELETE CASCADE
   - content TEXT NULL
   - file_path VARCHAR(500) NULL
   - file_type VARCHAR(50) NULL
   - read_status ENUM('sent','delivered','read') DEFAULT 'sent'
   - sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
   - INDEX(conversation_id, sent_at)

8. calls
   - call_id INT PK AUTO_INCREMENT
   - caller_id INT FK → users.user_id
   - receiver_id INT FK → users.user_id
   - status ENUM('ringing','answered','rejected','missed','ended') NOT NULL
   - start_time DATETIME NULL
   - end_time DATETIME NULL
   - duration INT DEFAULT 0  -- seconds
   - quality_score TINYINT DEFAULT 0  -- 0-5

9. notifications
   - notification_id INT PK AUTO_INCREMENT
   - user_id INT FK → users.user_id ON DELETE CASCADE
   - message_id INT NULL FK → messages.message_id
   - call_id INT NULL FK → calls.call_id
   - type ENUM('message','call','broadcast','system') NOT NULL
   - is_read BOOLEAN DEFAULT FALSE
   - created_at DATETIME DEFAULT CURRENT_TIMESTAMP

10. audit_logs
    - auditlog_id INT PK AUTO_INCREMENT
    - admin_id INT FK → users.user_id
    - action VARCHAR(100) NOT NULL
    - details TEXT NULL
    - logged_at DATETIME DEFAULT CURRENT_TIMESTAMP

After creating tables, INSERT one default admin row:
- name = 'CICS Admin'
- institutional_email = 'admin@msumain.edu.ph'
- password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyQJzKqJZ4kPQ.' (this is bcrypt for 'admin123' — we'll change it later)
- role = 'admin'

Make the SQL idempotent — start with `CREATE DATABASE IF NOT EXISTS msukaip_db;` and `USE msukaip_db;`. Use `DROP TABLE IF EXISTS` ONLY in a clearly commented "DEV RESET" block at the top, commented out by default.

Save the file and print it.
```

**Verify (MySQL Workbench or CLI):**
```sql
mysql -u root -p < database/schema.sql
SHOW TABLES FROM msukaip_db;
```

---

# PHASE 3 — Backend Config, Database Connection & Models

**Goal:** Wire FastAPI to MySQL via SQLAlchemy. Create model classes matching the schema.

```text
Inside backend/, with the venv activated, do the following:

1. Create `backend/.env` (copy from .env.example) with these values:
   DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/msukaip_db
   JWT_SECRET=change_this_to_a_long_random_string
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=480
   REDIS_URL=redis://localhost:6379/0
   UPLOAD_DIR=./uploads
   MAX_UPLOAD_MB=5

2. Build `app/config.py` using pydantic-settings to load .env into a `Settings` class.

3. Build `app/database.py` with:
   - SQLAlchemy engine using settings.DATABASE_URL
   - SessionLocal sessionmaker
   - Base = declarative_base()
   - get_db() dependency generator for FastAPI

4. Create `app/models/user.py`, `session.py`, `conversation.py`, `group.py`, `message.py`, `call.py`, `notification.py`, `audit.py` — one SQLAlchemy model per table from PHASE 2. Use the EXACT same column names and types. Import all of them in `app/models/__init__.py` so Alembic/Base.metadata sees them.

5. Build a minimal `app/main.py` that:
   - Creates a FastAPI app titled "MSUkaIP API"
   - Adds CORS middleware allowing http://localhost:5173 and the LAN range (use ["*"] for now in dev)
   - Has a GET /health endpoint returning {"status":"ok","service":"msukaip"}
   - On startup, prints "✅ MSUkaIP backend started"

6. Pip-install all packages from requirements.txt.

7. Run the server with: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` and confirm /health works.

Important: the models must NOT auto-create tables (we already have schema.sql). Just declare them.
```

**Verify:**
```powershell
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"msukaip"}
```

---

# PHASE 4 — Authentication (JWT + Bcrypt + Institutional Email)

**Goal:** Login, register, `get_current_user` dependency, role-based guards.

```text
Implement authentication for MSUkaIP. All users must log in with their institutional email (@msumain.edu.ph). Use JWT for sessions.

Create these files:

1. `app/utils/security.py`
   - hash_password(plain) → bcrypt hash
   - verify_password(plain, hashed) → bool
   - create_access_token(data: dict) → JWT signed with settings.JWT_SECRET
   - decode_token(token) → payload or raise

2. `app/schemas/auth.py` (Pydantic v2)
   - RegisterRequest: name, institutional_email, password, role (default 'student')
   - LoginRequest: institutional_email, password
   - TokenResponse: access_token, token_type='bearer', user (UserOut)
   - UserOut: user_id, name, institutional_email, role, status

3. `app/services/auth_service.py`
   - register_user(db, payload): validate email ends with '@msumain.edu.ph', check duplicate, hash password, insert into users, return UserOut
   - login_user(db, payload): fetch user by email, verify_password, create JWT, INSERT a row in `sessions` table with the token, update users.status='online', return TokenResponse
   - logout_user(db, user_id, token): set logout_timestamp on the session row, set users.status='offline'

4. `app/routers/auth.py`
   - POST /api/auth/register
   - POST /api/auth/login
   - POST /api/auth/logout (requires auth)
   - GET /api/auth/me (returns current user)

5. `app/utils/deps.py`
   - get_current_user(token: str = Depends(OAuth2PasswordBearer(tokenUrl='/api/auth/login')), db = Depends(get_db)) → User model
   - require_admin(user = Depends(get_current_user)): raise 403 if user.role != 'admin'

6. Wire the auth router into main.py with prefix='/api/auth'.

Test it:
- Register: POST /api/auth/register with {"name":"Test Student","institutional_email":"test@msumain.edu.ph","password":"test1234"}
- Login with the same credentials
- Hit /api/auth/me with the Bearer token

Print example curl commands at the end.
```

**Verify:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Hamdex","institutional_email":"hamdex@msumain.edu.ph","password":"test1234"}'
```

---

# PHASE 5 — User & Conversation Management (CRUD)

**Goal:** Endpoints to list users, search users, create conversations, list user's conversations.

```text
Build the user-facing CRUD that the chat UI needs.

Routers:

1. `app/routers/users.py`
   - GET /api/users — list all users (excluding self), with pagination ?page=1&size=20
   - GET /api/users/search?q=... — search by name or institutional_email (LIKE)
   - GET /api/users/{user_id} — fetch one user
   - PATCH /api/users/me — update own name (and later avatar)
   All require authentication.

2. `app/routers/conversations.py`
   - POST /api/conversations/direct — body: {target_user_id}. If a direct conversation between current user and target already exists, return that. Otherwise create a new one with type='direct' and add both as conversation_members.
   - POST /api/conversations/group — body: {title, member_ids: []}. Creates a row in `groups`, a parallel row in `conversations` (type='group'), and adds members.
   - GET /api/conversations — list all conversations the current user is a member of, with: last_message_preview, last_message_time, unread_count.
   - GET /api/conversations/{id}/messages?before=&limit=50 — paginated messages, newest first; only members can read.

3. `app/schemas/conversation.py` and `message.py` — matching Pydantic models.

4. `app/services/conversation_service.py` — keep the SQL logic out of routers.

Add these routers to main.py.

After writing, generate a tiny Python script `backend/seed_dev.py` that creates 4 fake users (Hussie, Sahara, Sittie, Admin) with password 'test1234' so we can test chats locally. Don't run it automatically — print instructions.
```

**Verify:**
```bash
python backend/seed_dev.py
curl http://localhost:8000/api/users -H "Authorization: Bearer YOUR_TOKEN"
```

---

# PHASE 6 — Real-Time Messaging (Socket.IO)

**Goal:** WebSocket-based real-time chat. Persist every message, broadcast to room members, update read status.

```text
Add real-time messaging using python-socketio mounted on the same FastAPI app.

1. `app/sockets/server.py`
   - sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
   - Wrap the FastAPI app with `socketio.ASGIApp(sio, app)` and export as `socket_app`. Update main.py / uvicorn entrypoint accordingly.

2. Authentication for sockets:
   - On 'connect' event, read auth token from `auth` dict (`{token: '...'}` passed by client). Decode JWT, fetch user. If invalid, disconnect.
   - Save mapping {sid: user_id} in a Python dict AND in Redis as `online:{user_id}=sid` with TTL 1h.
   - Update users.status='online' in DB on connect, 'offline' on disconnect.

3. Events to implement:
   - `join_conversation` ({conversation_id}) — verify membership, sio.enter_room
   - `send_message` ({conversation_id, content, file_path?, file_type?})
        → INSERT into messages
        → emit 'new_message' to room with full message payload (sender info too)
        → INSERT notification rows for offline members
   - `mark_read` ({message_id}) — update read_status to 'read', emit 'message_read' to room
   - `typing` ({conversation_id, is_typing}) — broadcast 'typing' to room (don't persist)

4. `app/services/message_service.py` — pure DB logic, called by socket handlers.

5. Helper: `app/sockets/presence.py` — get_online_users(), is_online(user_id) using Redis.

6. Make sure messages older than 24h that are still 'sent' (i.e. recipient never connected) get marked 'delivered' on next connect — implement an `on_connect` flush.

7. Keep REST endpoints for fetching history (PHASE 5) but make sending always go through the socket, not REST — note this clearly in code comments.

Print a small JS snippet showing how a frontend client should connect with token auth.
```

**Verify:**
Use a quick test client (we'll build the real one in Phase 11):
```bash
pip install python-socketio[asyncio_client]
# Then run the snippet Claude printed
```

---

# PHASE 7 — File & Image Sharing (5MB cap, restricted dir)

**Goal:** Upload PDFs, DOCX, images. Enforce the 5MB limit from your scope. Store outside web root.

```text
Implement the file-sharing module per the capstone scope (PDF, DOCX, images, max 5MB).

1. `app/routers/files.py`
   - POST /api/files/upload (multipart/form-data, field name 'file')
   - Allowed mime types: image/png, image/jpeg, image/webp, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
   - Reject if Content-Length > settings.MAX_UPLOAD_MB * 1024 * 1024 BEFORE reading the body.
   - Generate a UUID4 filename, keep original extension, save under settings.UPLOAD_DIR.
   - Return {file_id, file_path, file_type, original_name, size_bytes}.

2. GET /api/files/{file_id} — stream the file with FastAPI's FileResponse. Verify the requesting user is a member of any conversation that references this file (security check). Set Content-Disposition: inline for images, attachment for PDF/DOCX.

3. Update `app/sockets/server.py` `send_message` handler so it accepts file_path + file_type and stores them on the messages row.

4. Add a 'files' table? NO — we already have `file_path` and `file_type` columns on `messages`. Just track via UUID-named filename.

5. Make sure the uploads/ folder is NOT served as static files. Only via the authenticated /api/files/{id} endpoint.

6. Add a simple cleanup helper `app/services/file_service.py:cleanup_orphans()` — deletes files in uploads/ that aren't referenced in any message row. Don't schedule it yet, just expose the function.

After writing, give me a curl example of uploading a PDF and then sending it through the socket.
```

**Verify:**
```bash
curl -X POST http://localhost:8000/api/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf"
```

---

# PHASE 8 — VoIP Calls (WebRTC Signaling)

**Goal:** Backend acts as a signaling server only. Audio flows peer-to-peer via WebRTC. Log call records.

```text
Implement WebRTC signaling for voice calls. The backend never carries audio — only relays SDP offers/answers and ICE candidates.

1. Add socket events in `app/sockets/server.py`:
   - `call_invite` ({to_user_id})
        → INSERT into calls (status='ringing', start_time=NULL)
        → emit 'incoming_call' to recipient's sid with {call_id, from_user, from_name}
        → return {call_id} to caller
   - `call_signal` ({call_id, to_user_id, signal})
        → relay 'signal' event to target with payload {call_id, signal}.
        → 'signal' is an opaque blob — could be SDP offer, SDP answer, or ICE candidate.
   - `call_accept` ({call_id})
        → UPDATE calls SET status='answered', start_time=NOW()
        → emit 'call_accepted' to caller
   - `call_reject` ({call_id})
        → UPDATE calls SET status='rejected', end_time=NOW()
        → emit 'call_rejected' to caller
   - `call_end` ({call_id, quality_score?})
        → UPDATE calls SET status='ended', end_time=NOW(), duration=TIMESTAMPDIFF(SECOND,start_time,NOW()), quality_score=...
        → emit 'call_ended' to both parties
   - On disconnect, automatically end any 'ringing' or 'answered' calls involving that user (status='ended' or 'missed').

2. `app/routers/calls.py`
   - GET /api/calls/history — call log for current user (incoming + outgoing), paginated, newest first
   - GET /api/calls/{call_id} — single call detail (members only)

3. `app/schemas/call.py` matching Pydantic models.

4. STUN config: since we're LAN-only, no TURN server is needed. Have the frontend use just `{iceServers: [{urls:'stun:stun.l.google.com:19302'}]}` for now, but make it configurable via `/api/config/ice-servers` endpoint that reads from .env (ICE_SERVERS as JSON). This way if we deploy fully offline later, we can point to an internal coturn.

5. Add /api/config/ice-servers public endpoint.

Print a sequence diagram in ASCII showing: Caller → Server → Receiver flow for offer/answer/ICE.
```

**Verify (manual):** Will fully test in Phase 13 with the React UI.

---

# PHASE 9 — Admin Module (User Management, Broadcasts, Audit)

**Goal:** Admin-only endpoints from your IPO diagram + audit trail per the National ICT security standards you cited.

```text
Build admin features. All endpoints require `require_admin` dependency.

1. `app/routers/admin.py`
   - GET /api/admin/users — paginated list with filters ?role=&status=
   - POST /api/admin/users — admin creates a user (no email verification step)
   - PATCH /api/admin/users/{id} — edit name, role
   - PATCH /api/admin/users/{id}/deactivate — set status='offline' AND add a 'deactivated' flag (add a `is_active BOOLEAN DEFAULT TRUE` column to users — write the ALTER TABLE in a new migration file `database/migration_002.sql`)
   - DELETE /api/admin/users/{id} — soft-delete only (set is_active=FALSE)
   - POST /api/admin/broadcast — body: {title, content}. Inserts a notification row of type='broadcast' for every active user, AND emits a 'broadcast' socket event to all online users.
   - GET /api/admin/audit-logs — paginated, filterable by ?admin_id=&action=
   - GET /api/admin/stats — dashboard numbers: total_users, online_now, messages_today, calls_today, avg_call_duration

2. Audit logging:
   - Create a small helper `app/utils/audit.py:log_action(db, admin_id, action, details)`.
   - Call it from EVERY admin endpoint that mutates state. Action strings: 'CREATE_USER', 'EDIT_USER', 'DEACTIVATE_USER', 'DELETE_USER', 'BROADCAST_SENT'.

3. Update your existing login/register to log: 'LOGIN', 'LOGOUT', 'REGISTER' — but only when the actor is an admin (or always — your choice; default to logging admin actions only to keep volume low).

4. Add `app/utils/deps.py:require_admin` if not already there.

Print sample requests and responses for each new endpoint.
```

**Verify:**
```bash
curl http://localhost:8000/api/admin/stats -H "Authorization: Bearer ADMIN_TOKEN"
```

---

# PHASE 10 — Frontend Bootstrap (Vite + React + Tailwind + Routing)

**Goal:** Initialize the React app. Wire routing, auth context, and the API/socket service layer.

```text
From the project root, create the frontend with Vite + React + TailwindCSS.

1. cd frontend && npm create vite@latest . -- --template react
2. Install: npm i react-router-dom axios socket.io-client zustand react-hot-toast lucide-react
3. Install Tailwind: npm i -D tailwindcss@3 postcss autoprefixer && npx tailwindcss init -p
4. Configure tailwind.config.js with content: ["./index.html","./src/**/*.{js,jsx}"]
5. Replace src/index.css with the tailwind directives (@tailwind base/components/utilities) and a basic dark-mode-aware reset.

6. Folder structure under src/:
   - pages/        Login.jsx, Register.jsx, Dashboard.jsx, AdminPanel.jsx, NotFound.jsx
   - components/   (empty for now — will add per phase)
   - hooks/        useAuth.js, useSocket.js
   - context/      AuthContext.jsx
   - services/     api.js (axios instance with base URL + JWT interceptor), socket.js (singleton socket.io client)
   - store/        chatStore.js (zustand: conversations, activeConversationId, messages map)
   - App.jsx       (router setup with protected routes)
   - main.jsx

7. services/api.js:
   - baseURL from import.meta.env.VITE_API_URL (default http://localhost:8000)
   - request interceptor adds 'Authorization: Bearer <token>' from localStorage
   - response interceptor: on 401 → clear token + redirect to /login

8. services/socket.js:
   - export connectSocket(token) and getSocket()
   - connect with auth: { token } and autoConnect: false
   - reconnection: true, reconnectionAttempts: 10

9. context/AuthContext.jsx — provides {user, login, logout, register, loading}. Persists token in localStorage. On mount, calls /api/auth/me to revalidate.

10. App.jsx — routes:
    - / → redirect to /chat if logged in else /login
    - /login, /register → public
    - /chat → protected (Dashboard)
    - /admin → protected + admin only (AdminPanel)
    - * → NotFound

11. Create .env in frontend/ with VITE_API_URL=http://localhost:8000

Run `npm run dev` and confirm the app loads at http://localhost:5173 with placeholder pages.
```

**Verify:** Browser opens, no console errors, `/login` shows the placeholder.

---

# PHASE 11 — Frontend Auth Pages (Login + Register)

**Goal:** Polished login and register screens that hit `/api/auth/*` and store the token.

```text
Build /login and /register pages with TailwindCSS. Match an academic, professional aesthetic — MSU green/maroon accent (#006837 primary, #8B0000 accent) on a clean white background.

For both pages:
- Centered card on a subtle gradient background
- App name "MSUkaIP" in bold at the top with subtitle "CICS LAN Communication System"
- Form with: email (institutional only — show inline hint "@msumain.edu.ph required"), password, plus name+role(student/faculty) on Register
- react-hot-toast for success/error notifications
- Loading state on the submit button (spinner from lucide-react)
- Client-side validation: email must end with '@msumain.edu.ph', password min 8 chars
- Link between Login and Register at the bottom

Behavior:
- On successful login, save token to localStorage, set user in AuthContext, connect the socket via services/socket.js, navigate to /chat (or /admin if role==='admin').
- On successful register, auto-login and redirect.
- Show field-level errors from the backend's 422/400 responses.

Also add a tiny `<HealthCheck />` component (top-right corner of login) that pings /health and shows a green dot if backend is reachable, red dot otherwise — this helps users on LAN diagnose connectivity.

Test the full register → login flow with one of the seeded users.
```

**Verify:** Log in as `hussie@msumain.edu.ph` (after running seed_dev.py with that email).

---

# PHASE 12 — Chat Dashboard (Conversation List + Message View + Real-time)

**Goal:** The main chat interface — sidebar of conversations, message panel, real-time updates.

```text
Build the main chat dashboard at /chat. This is the most important UI in the app.

Layout (3-column on desktop, stacked on mobile):
- Left sidebar (320px): user search bar at top, then list of conversations sorted by last_message_time desc. Each row shows avatar (initials), name/group title, preview of last message, time, unread count badge.
- Middle (flex-1): active conversation view
   - Header: name + online/offline dot + Voice Call button (phone icon) + Info button
   - Messages area: scrollable, infinite-load older when scrolled to top
   - Each message: bubble aligned right (own) / left (others), sender name on group messages, timestamp on hover, read receipt icon (✓ sent, ✓✓ delivered, ✓✓ blue read)
   - File messages: render image inline (max 300px), PDF/DOCX as a card with icon + filename + download button
   - Composer at bottom: textarea (auto-grow), file attach button, send button. Enter sends, Shift+Enter newline. Show typing indicator from other party.
- Right panel (collapsible, 280px): conversation info — for groups: members list, "Add member" button (creator only); for direct: user profile.

Components to create:
- components/chat/ConversationList.jsx
- components/chat/ConversationItem.jsx
- components/chat/MessageView.jsx
- components/chat/MessageBubble.jsx
- components/chat/MessageComposer.jsx
- components/chat/UserSearchModal.jsx
- components/chat/NewGroupModal.jsx
- components/chat/InfoPanel.jsx

State management (zustand store/chatStore.js):
- conversations: []
- messagesByConv: { [convId]: Message[] }
- activeConvId: number | null
- typingUsers: { [convId]: userId[] }
- Actions: loadConversations, openConversation(id), sendMessage(content, file?), markRead(messageId), addMessage(msg) — called by socket listener

Socket integration (hooks/useSocket.js):
- On mount of Dashboard, useEffect to register listeners: 'new_message', 'message_read', 'typing', 'user_status_changed', 'broadcast'
- Emit 'join_conversation' when activeConvId changes
- Cleanup on unmount

File upload flow:
1. User picks file → POST /api/files/upload → get file_path/file_type
2. Then emit socket 'send_message' with content='' + file_path + file_type
3. Show optimistic upload progress

Polishing:
- react-hot-toast for new message notifications when conversation isn't active
- Browser Notification API ask for permission on first load and fire on incoming when tab is hidden
- Empty state when no conversation selected: friendly illustration + "Pick a conversation or start a new one"

Build it and walk me through testing with two browser windows logged in as different seeded users.
```

**Verify:** Two browsers, two users, send message → instant appearance.

---

# PHASE 13 — VoIP Call UI (WebRTC)

**Goal:** Voice calls between any two users using WebRTC + the signaling channel from Phase 8.

```text
Add a voice-call feature using native browser WebRTC + the signaling events from Phase 8.

1. components/call/CallProvider.jsx — wraps the app, manages call state machine:
   States: idle | outgoing-ringing | incoming-ringing | in-call | ended
   Holds: peerConnection, localStream, remoteStream, currentCall {id, withUser, startedAt}

2. components/call/IncomingCallModal.jsx — fullscreen-ish modal with caller name, Accept (green) and Reject (red) buttons. Plays a soft ringtone (use a public-domain ringtone wav placed in /public).

3. components/call/CallScreen.jsx — minimal call UI:
   - Other user's name + avatar large
   - Call duration timer
   - Mute (toggle local audio track), Speaker toggle (where supported), End Call (red button)
   - Audio quality indicator (small bar based on getStats() jitter/packet-loss every 2s)

4. WebRTC flow (CallProvider.jsx):

   Outgoing call (user clicks phone icon in chat header):
   a. socket.emit('call_invite', {to_user_id}) → receive {call_id}
   b. State → outgoing-ringing
   c. getUserMedia({audio:true})
   d. new RTCPeerConnection({iceServers: from /api/config/ice-servers})
   e. addTrack(localStream)
   f. createOffer → setLocalDescription → socket.emit('call_signal', {call_id, to_user_id, signal:offer})
   g. onicecandidate → socket.emit('call_signal', {..., signal:{candidate}})
   h. ontrack → set remoteStream → play in <audio> element
   i. On 'call_accepted' → wait for answer signal → setRemoteDescription
   j. On 'call_rejected' or 'call_ended' → cleanup

   Incoming call (receive 'incoming_call' event):
   a. State → incoming-ringing, show modal
   b. On Accept: getUserMedia, create RTCPeerConnection, on incoming offer signal: setRemoteDescription, createAnswer, setLocalDescription, emit signal back, then 'call_accept'
   c. On Reject: emit 'call_reject', cleanup

   Common cleanup: stop all tracks, close peer connection, set state=ended, after 2s → idle.

5. Hook the phone-icon button in chat header (Phase 12) to call CallProvider.startCall(userId).

6. Add a '/calls' page showing call history from /api/calls/history. Each row: caller/receiver name, status (with color: missed=red, answered=green), duration, date.

7. Important: Test on two devices on the SAME LAN. Browser must run on https OR localhost for getUserMedia to work — for LAN testing, you'll need to either (a) use localhost for both, (b) self-sign a cert, or (c) start Chrome with --unsafely-treat-insecure-origin-as-secure=http://192.168.x.x. Add a section to README.md explaining option (c) since it's simplest for the capstone demo.

Walk me through a 2-device test plan at the end.
```

**Verify:** Two devices on same Wi-Fi, voice call connects with audio both ways.

---

# PHASE 14 — Admin Dashboard (Analytics + User Management + Audit Logs)

**Goal:** A separate /admin route only admins can access — covers your "Admin Module" in the IPO diagram.

```text
Build the admin dashboard at /admin with three tabs: Overview, Users, Audit Logs.

Layout: sidebar with tabs + main area. Use the same Tailwind theme.

TAB 1: OVERVIEW
- Top stat cards (4): Total Users, Online Now, Messages Today, Calls Today (avg duration as subtitle)
- Chart 1: Messages per hour, last 24h (recharts LineChart) — backend may need a new endpoint /api/admin/stats/messages-hourly
- Chart 2: User roles breakdown (recharts PieChart: students/faculty/admin)
- Recent Broadcasts list (last 5)
- "Send Broadcast" button → opens modal with title + content; on submit POST /api/admin/broadcast

TAB 2: USERS
- Search bar + role filter
- Table: Name, Email, Role, Status, Created, Actions (Edit, Deactivate/Activate, Delete)
- "Add User" button → modal form (name, email, role, password)
- Edit modal — same form
- Confirmation dialog before deactivate/delete

TAB 3: AUDIT LOGS
- Filter by admin (dropdown) and action (dropdown of distinct actions)
- Table: Timestamp, Admin, Action, Details (JSON pretty-printed in expandable row)
- CSV export button — generate client-side from current filtered rows

Frontend files:
- pages/AdminPanel.jsx (with tab routing via local state or nested routes /admin/users etc.)
- components/admin/StatsCards.jsx
- components/admin/MessagesChart.jsx
- components/admin/RolesPieChart.jsx
- components/admin/UsersTable.jsx
- components/admin/UserFormModal.jsx
- components/admin/AuditLogsTable.jsx
- components/admin/BroadcastModal.jsx

Backend additions if needed:
- GET /api/admin/stats/messages-hourly — returns 24 buckets [{hour: 0..23, count: int}]
- GET /api/admin/stats/roles — {students, faculty, admin}
- POST /api/admin/users/{id}/activate — re-enable a deactivated user

Make charts responsive with `<ResponsiveContainer>`. Empty states for tables when filtered to 0 rows. Use react-hot-toast for action confirmations.
```

**Verify:** Log in as admin → /admin shows stats. Send broadcast → all online users receive it.

---

# PHASE 15 — Reports, Deployment & Debugging

**Goal:** Generate the testing report (your Chapter 3.4 evaluation), deploy on the CICS LAN server, and a debugging cheat sheet.

## 15.1 — Testing Report Generator

```text
Build a small testing-report module to support the capstone evaluation in Chapter 3.4 (5-point Likert survey, 20–30 respondents).

Backend:
- New table `survey_responses` (write migration_003.sql):
  - response_id PK
  - respondent_role ENUM('student','faculty','admin')
  - usability_score, functionality_score, performance_score, satisfaction_score (TINYINT 1-5 each)
  - comments TEXT NULL
  - submitted_at DATETIME DEFAULT NOW
- POST /api/survey — public endpoint (no auth, since respondents may be guests for the demo). Rate-limit by IP (1 per minute, simple in-memory dict).
- GET /api/admin/survey/results — admin only. Returns:
   {n_responses, by_role: {...}, averages: {usability, functionality, performance, satisfaction}, distribution: {1:n, 2:n, 3:n, 4:n, 5:n} per category}
- GET /api/admin/survey/export.csv — admin only. Streams CSV.

Frontend:
- Public route /survey — clean single-page form with the 4 Likert questions from your Chapter 3.4.3 (System Usability, Functionality, Performance, User Satisfaction) plus a comments box. After submit, show a thank-you screen.
- Inside /admin a new tab "Survey Results" — bar charts of averages + distribution + downloadable CSV.

Print the QR-code-friendly URL the team will print on the testing-day handouts.
```

## 15.2 — LAN Deployment (Windows Server)

```text
Generate deployment artifacts for running MSUkaIP on a Windows machine inside the CICS LAN, accessible to all Wi-Fi clients in the building.

Create:
1. `deploy/run_backend.bat` — activates venv, exports .env, runs uvicorn with `--host 0.0.0.0 --port 8000 --workers 2`
2. `deploy/run_frontend_build.bat` — runs `npm run build` then serves dist/ via `npx serve -s dist -l 5173 -L`
3. `deploy/install_service.ps1` — wraps both as Windows scheduled tasks that start on boot (use `schtasks /create`)
4. `deploy/firewall.ps1` — opens TCP 8000 and 5173 with `New-NetFirewallRule`
5. README section "Deployment on CICS LAN":
   - Step-by-step: install Python 3.11, MySQL 8, Node 20, Redis (Memurai for Windows)
   - How to find the server's LAN IP (`ipconfig`) and how clients access via `http://<server-ip>:5173`
   - How to update the frontend .env's VITE_API_URL to the server's LAN IP before building
   - How to back up the database (`mysqldump`)
   - How to run the seed script for production: replace dev passwords, add real CICS faculty
6. Create `deploy/nginx.conf.example` for an optional production setup using nginx as a reverse proxy with SSL (self-signed for LAN). Note: optional, since plain HTTP works for LAN with the `--unsafely-treat-insecure-origin-as-secure` flag.

Print the final checklist a team member can run through on demo day.
```

## 15.3 — Debugging Cheat Sheet

```text
Create `docs/DEBUGGING.md` with the most likely errors and exact fixes. Include:

1. **`venv\Scripts\activate : The module 'venv' could not be loaded`** (PowerShell)
   Fix: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, then re-run.

2. **`(2003, "Can't connect to MySQL server")`**
   Fix: Start MySQL service (`net start MySQL80`), check DATABASE_URL host/port.

3. **`bcrypt._bcrypt.error`** on login
   Fix: pin `bcrypt==4.0.1`, reinstall passlib.

4. **Socket disconnects immediately after connect**
   Cause: invalid token. Open DevTools → Network → WS → Frames; check the auth payload.

5. **CORS error in browser console**
   Fix: ensure backend CORS allows the frontend's origin; for LAN, add the LAN IP explicitly OR set allow_origins=['*'] for the demo only.

6. **`getUserMedia is not a function` / "Permission denied"**
   Fix: Browser blocks mic on insecure origins. Use localhost OR Chrome flag `--unsafely-treat-insecure-origin-as-secure=http://192.168.x.x`.

7. **WebRTC connects but no audio**
   Cause: usually ICE failure. Check `pc.iceConnectionState`. On pure LAN with no STUN reachable (truly offline), use `iceTransportPolicy:'all'` and ensure both clients are on the same subnet — host candidates only will work.

8. **Messages not appearing in real-time**
   Checklist: socket connected? joined room? backend emitting to right room name? Add `console.log` on the socket event listener; add `print` on the server emit.

9. **File upload fails with 413**
   Cause: nginx or uvicorn body limit. Fix in uvicorn: `--limit-request-line 0` is not it — set `client_max_body_size 10M;` in nginx; for plain uvicorn it's not needed below 16MB.

10. **`AttributeError: 'NoneType' object has no attribute ...` after token expires**
    Fix: backend should return 401, frontend axios interceptor should redirect to /login. Verify the interceptor runs.

For each entry: write the symptom, the root cause, the exact command/fix, and (optional) a code snippet.
```

**Verify:** All three pieces (survey, deployment, debugging docs) committed to repo.

---

# Appendix A — Daily Workflow with Claude Code

A typical session in VS Code:

1. Open the project folder in VS Code.
2. Open the integrated terminal: `Ctrl+~`. Make sure you're in `MSUkaIP/`.
3. Open a second terminal tab — one for backend, one for frontend.
4. **Backend tab:** `cd backend; .\venv\Scripts\activate; uvicorn app.main:app --reload --port 8000`
5. **Frontend tab:** `cd frontend; npm run dev`
6. Open Claude Code panel (Cmd/Ctrl+Esc or the side panel).
7. Paste the next phase's prompt. Let Claude Code make changes.
8. **Read the diff before accepting** — beginner-friendly mode means you should understand each change. If something looks wrong, ask: "Explain why you changed X."
9. After accepting, **run the Verify command** at the end of that phase.
10. Commit to Git: `git add -A && git commit -m "Phase N: <summary>"`. Do this after every phase — your safety net.

---

# Appendix B — Mapping Prompts → Capstone Document

| Capstone Section | Phase(s) |
|---|---|
| 1.3 Specific Objective 1 (TCP/UDP/VoIP analysis) | Built into Phase 8 documentation |
| 1.3 Specific Objective 2 (web app, real-time, LAN, WebRTC) | Phase 4, 6, 8 |
| 1.3 Specific Objective 3 (institutional auth, AES-256, 50-100 users) | Phase 4, 9, 15.2 |
| 1.3 Specific Objective 4 (Likert survey, 30 respondents) | Phase 15.1 |
| 3.2.1 HIPO — Messaging | Phase 6 |
| 3.2.1 HIPO — VoIP | Phase 8 + 13 |
| 3.2.1 HIPO — User & Auth | Phase 4 |
| 3.2.1 HIPO — Admin | Phase 9 + 14 |
| 3.2.4 ERD (10 tables) | Phase 2 + 3 |
| 3.2.5 Architectural Design (Socket.IO, WebRTC, TCP/UDP, Redis) | Phase 6, 7, 8 |
| 3.3.1 Software Specs | Phases 3, 10 |
| 3.3.2 Hardware Specs | Phase 15.2 |
| 3.4 Testing Procedure | Phase 15.1 |

---

# Appendix C — One-Shot "Do It All" Mega Prompt (NOT recommended)

> Most capstone teams that try this end up with code they can't defend in oral defense. Stick to the 15 phases above. But if you want a single prompt to bootstrap a quick demo skeleton, here it is — use at your own risk:

```text
Build the complete MSUkaIP system per the attached capstone PDF. Tech stack: Python FastAPI + Socket.IO + MySQL + Redis backend; React + Vite + TailwindCSS + WebRTC frontend. Implement: JWT auth (institutional email @msumain.edu.ph), real-time chat (Socket.IO with rooms), file upload (5MB cap, PDF/DOCX/images), WebRTC voice calls with signaling, admin dashboard with broadcasts and audit logs, Likert survey form. Use the exact 10-table ERD: users, sessions, conversations, conversation_members, groups, group_members, messages, calls, notifications, audit_logs. Include deployment scripts for Windows LAN server. Make it production-ready and beginner-friendly with comments throughout.
```

---

**Last note for the team:** Each phase prompt is intentionally specific — Claude Code performs best with explicit file paths, exact column names, and concrete acceptance criteria. Resist the urge to make prompts shorter; the detail is what keeps it production-ready.

Good luck with your December 2025 → May 2026 timeline. The Gantt chart in your Chapter 3.1.3 lines up well with this 15-phase split: roughly 1 phase per sprint week.

— Generated for: Hussie G. Diranggarun, Sahara B. Lominog, Sittie Hanzaliah S. Radia
