# Least Count — Software Project Documentation

A full-stack, real-time online multiplayer card game web application built with **React**, **TypeScript**, **Vite**, **Express**, and **Socket.IO**.

The application features an authoritative server-side rules engine (`GameEngine`) managing turn-based state machines, room creation and join mechanisms, session re-connection recovery, single-player vs. System Bot mode, custom visual themes, and cumulative scoreboards.

---

## Technical Stack

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS (Design Tokens, Glassmorphism, Responsive felt layouts)
- **Backend Server**: Node.js, Express, Socket.IO 4.8, TSX (Node.js TypeScript Executor)
- **Game Engine Core**: TypeScript state machine (`GameEngine`) managing hands, setup stages, draw/discard piles, drop validation, and scoring algorithms
- **Testing**: Vitest test runner

---

## Project Structure

```text
leastCount/
├── backend/
│   ├── src/
│   │   ├── game/
│   │   │   ├── engine.ts       # Core GameEngine state machine & scoring logic
│   │   │   └── engine.test.ts  # Vitest backend rules verification suite
│   │   └── types/
│   │       └── game.ts         # Shared data interfaces & protocol schemas
│   ├── server.ts               # Express & Socket.IO realtime server (Port 3001)
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Card, Table felt, ScoreModal, GameOverModal
│   │   ├── game/               # Re-exported engine & systemBot logic
│   │   ├── pages/              # HomePage, FriendsPage, LobbyPage, SettingsPage, RulesPage
│   │   ├── styles/             # Modular CSS theme variables & styling
│   │   ├── main.tsx            # Main App container & Socket.IO client handlers
│   │   └── index.css
│   └── package.json
│
├── package.json                # Monorepo root scripts & dev dependencies
└── README.md
```

---

## Installation & Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 1. Clone & Install Dependencies

Clone the repository and install dependencies across the workspace:

```bash
git clone https://github.com/user/least-count.git
cd leastCount
npm install
npm install --prefix frontend
```

---

## Running Locally

To run the application locally, start both the backend Socket.IO server and the Vite frontend dev server.

### Option A: Run via Root Scripts (Recommended)

In separate terminal windows:

**Terminal 1 — Backend Server (Port 3001)**:
```bash
npm run server
```

**Terminal 2 — Frontend Client (Vite Dev Server)**:
```bash
npm run dev
```

### Option B: Run Directly from Subdirectories

**Backend Server**:
```bash
cd backend
npm start
```

**Frontend Dev Server**:
```bash
cd frontend
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## Environment Variables

The frontend client connects to the backend Socket.IO server via environment variables.

| Variable Name | Description | Default Value |
|---|---|---|
| `VITE_SOCKET_URL` | Socket.IO server endpoint URL | `http://localhost:3001` |

Create a `.env` file in `frontend/` if connecting to a remote server endpoint:

```env
VITE_SOCKET_URL=http://localhost:3001
```

---

## Realtime Multiplayer Architecture

```text
Browser Client A (React / Socket.IO Client)
      │
      ├── (room:create / room:join / room:ready / room:start)
      │
      ▼
Express + Socket.IO Server (Port 3001) ──► In-Memory Room Store (Map<string, Room>)
      │                                             │
      ▼                                             ▼
Sanitized Viewer State Broadcast ◄────────── GameEngine State Machine
      │
      ▼
Browser Client B (React / Socket.IO Client)
```

1. **State Sanitization**: The server broadcasts sanitized client views (`ClientGameState`) to players, masking opponent hand cards while keeping draw counts and public deck states transparent.
2. **Authoritative Validation**: All actions (`drop`, `acquire`, `least-count`, setup sequence steps) are executed and validated on the server's `GameEngine`.
3. **Session Recovery**: Session storage caches `lc_player_id` and `lc_room_code`, permitting 60-second grace-period browser refresh reconnection without forfeiting game state.

---

## Verification & Testing

Run automated unit test suites for the game engine:

```bash
# Run backend engine tests
npm test

# Run frontend engine tests
cd frontend && npx vitest run
```

Run TypeScript compilation checks across the codebase:

```bash
# Check frontend TypeScript compilation
npm run build
```

---

## Production Build

To produce a production bundle for deployment:

```bash
npm run build
```

The optimized static frontend assets will be emitted to `frontend/dist`.
