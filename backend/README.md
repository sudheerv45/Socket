# Backend

## Setup
1. Copy `.env.example` to `.env` and set values.
2. `npm i`
3. `npm run dev`

## API (selected)
- POST /api/auth/register { name, email, password }
- POST /api/auth/login { email, password }
- GET  /api/auth/me
- GET  /api/users
- POST /api/conversations/dm { userId }
- POST /api/conversations/group { name, memberIds: [] }
- GET  /api/conversations
- GET  /api/messages/:conversationId

## Socket events
- auth via `io("/", { auth: { token }})`
- `conversation:join` / `conversation:leave`
- `typing` { conversationId, typing }
- `message:send` { conversationId, body }
- `message:new` -> broadcast
- Calls: `call:offer`, `call:answer`, `call:ice`, `call:end`
