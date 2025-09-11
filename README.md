# WhatsApp Clone – Fullstack (Socket.IO + Mongoose + WebRTC)

## Monorepo Layout
- `backend/` Express + Mongoose + Socket.IO API and signaling
- `frontend/` React + Vite client (socket.io-client + WebRTC)

## Run Locally
### Backend
```bash
cd backend
cp .env.example .env
npm i
npm run dev
```
### Frontend
```bash
cd ../frontend
npm i
npm run dev
```
Open two browser windows, login as different users, open a DM and try audio/video calls.
