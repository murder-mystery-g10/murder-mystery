# frontend

React + TypeScript + Vite (React Router, Zustand, React Flow, socket.io-client).

```bash
npm install
npm run dev          # http://localhost:5173, proxies /api and /socket.io to the backend
npm run lint
npm run format:check
npm test
npm run build
```

The backend address for the dev proxy defaults to `http://localhost:8000`; override it with `BACKEND_URL`.
UI text shown to players is in Romanian; code and comments are in English.
