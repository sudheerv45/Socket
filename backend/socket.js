// backend/socket.js
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');

// Track user's sockets
const userSockets = new Map(); // userId -> Set<socketId>
// Track group-call participants per conversation (userIds)
const callParticipants = new Map(); // conversationId -> Set<userId>
// Track which calls a socket is in for cleanup
const socketCalls = new Map(); // socketId -> Set<conversationId>

function getUserSockets(userId) {
  return Array.from(userSockets.get(userId) || []);
}

function addUserSocket(userId, socketId) {
  const set = userSockets.get(userId) || new Set();
  set.add(socketId);
  userSockets.set(userId, set);
  console.log(`[socket] addUserSocket ${userId} -> ${socketId} (count=${set.size})`);
}
function removeUserSocket(userId, socketId) {
  const set = userSockets.get(userId);
  if (!set) return;
  set.delete(socketId);
  console.log(`[socket] removeUserSocket ${userId} -> ${socketId} (remaining=${set.size})`);
  if (!set.size) userSockets.delete(userId);
}
function ensureSet(map, key) {
  let s = map.get(key);
  if (!s) { s = new Set(); map.set(key, s); }
  return s;
}
function emitToUser(io, userId, event, payload) {
  const sockets = userSockets.get(userId);
  if (!sockets) {
    console.warn(`[socket] emitToUser: no sockets for user ${userId} (event=${event})`);
    return;
  }
  for (const sid of sockets) {
    io.to(sid).emit(event, payload);
  }
  console.log(`[socket] emitToUser: event=${event} -> user=${userId} sockets=${sockets.size}`);
}

module.exports = function attachSocket(io) {
  // Authenticate sockets with JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.user.id); // ensure string
      next();
    } catch (e) {
      console.error('[socket] auth error', e && e.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`[socket] connection: socketId=${socket.id} userId=${userId}`);
    addUserSocket(userId, socket.id);

    try { await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() }); } catch (e) {}
    io.emit('presence:update', { userId, online: true, lastSeen: new Date() });

    // --- Chat rooms (DM/Group) ---
    socket.on('conversation:join', async (conversationId) => {
      const isMember = await Conversation.exists({ _id: conversationId, members: userId });
      if (!isMember) {
        console.warn(`[socket] conversation:join denied ${userId} -> ${conversationId}`);
        return;
      }
      socket.join(`convo:${conversationId}`);
      console.log(`[socket] ${userId} joined convo:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`convo:${conversationId}`);
      console.log(`[socket] ${userId} left convo:${conversationId}`);
    });

    // Typing
    socket.on('typing', ({ conversationId, typing }) => {
      socket.to(`convo:${conversationId}`).emit('typing', { conversationId, userId, typing });
    });

    // Messages
    socket.on('message:send', async ({ conversationId, body, type = 'text' }) => {
      try {
        const isMember = await Conversation.exists({ _id: conversationId, members: userId });
        if (!isMember) return;
        const msg = await Message.create({ conversation: conversationId, sender: userId, body, type });
        await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
        const full = await msg.populate('sender', 'name avatar');
        io.to(`convo:${conversationId}`).emit('message:new', full);
      } catch (e) {
        console.error('message:send error', e);
      }
    });

    // ==================================================
    // ========== Group Calls (mesh + signaling) ========
    // ==================================================

    // Group call start: notify all group members (incoming), then emit caller 'ringing'
    socket.on('group:call:start', async ({ conversationId, media }) => {
      try {
        const convo = await Conversation.findById(conversationId).populate('members', 'name').lean();
        if (!convo || !convo.isGroup) {
          console.warn('[socket] group:call:start invalid conversation', conversationId);
          return;
        }
        const caller = await User.findById(userId).select('name');
        console.log(`[socket] group:call:start convo=${conversationId} by=${userId} (${caller?.name}) media=${media}`);

        // notify all members except the caller
        for (const member of convo.members) {
          const mid = String(member._id);
          if (mid === userId) continue;
          emitToUser(io, mid, 'group:call:incoming', {
            conversationId,
            groupName: convo.name || 'Group',
            from: userId,
            fromName: caller?.name || 'Unknown',
            media,
          });
        }

        // Tell caller "ringing" so UI can show outgoing ringing and maybe participants list
        io.to(socket.id).emit('group:call:ringing', {
          conversationId,
          media,
          // optionally give the caller the members list (including names) to display
          participants: convo.members.map(m => ({ _id: String(m._id), name: m.name })),
        });
      } catch (err) {
        console.error('[socket] group:call:start error', err);
      }
    });

    // When a client accepts and joins the group call
    // Protocol:
    // - Server returns existing participant IDs (so the joiner can create offers to them)
    // - Then server adds the joiner and broadcasts group:call:joined to other participants
    socket.on('group:call:join', ({ conversationId, media }) => {
      try {
        console.log(`[socket] group:call:join convo=${conversationId} user=${userId} media=${media}`);

        const participantsSet = callParticipants.get(conversationId) || new Set();
        // existing participants BEFORE adding this user
        const existing = Array.from(participantsSet);

        // send existing participants to joiner (so joiner can create offers to them)
        io.to(socket.id).emit('group:call:participants', {
          conversationId,
          participants: existing, // array of userId strings
        });

        // then add this user to participants and join room
        participantsSet.add(userId);
        callParticipants.set(conversationId, participantsSet);

        const myCalls = ensureSet(socketCalls, socket.id);
        myCalls.add(conversationId);

        socket.join(`groupcall:${conversationId}`);

        // notify others in groupcall room that a new user joined
        socket.to(`groupcall:${conversationId}`).emit('group:call:joined', {
          conversationId,
          userId,
          media,
        });

        console.log(`[socket] group:call:join processed, participants now=${Array.from(participantsSet).length}`);
      } catch (err) {
        console.error('[socket] group:call:join error', err);
      }
    });

    // Reject (someone declines group call)
    socket.on('group:call:reject', ({ conversationId }) => {
      console.log(`[socket] group:call:reject convo=${conversationId} user=${userId}`);
      // notify the caller/room if desired - we'll emit to room so caller sees rejections
      socket.to(`groupcall:${conversationId}`).emit('group:call:rejected', {
        conversationId,
        userId,
      });
    });

    // Leave
    socket.on('group:call:leave', ({ conversationId }) => {
      console.log(`[socket] group:call:leave convo=${conversationId} user=${userId}`);
      const participants = callParticipants.get(conversationId);
      if (participants) {
        participants.delete(userId);
        if (!participants.size) callParticipants.delete(conversationId);
      }
      const myCalls = socketCalls.get(socket.id);
      if (myCalls) {
        myCalls.delete(conversationId);
        if (!myCalls.size) socketCalls.delete(socket.id);
      }
      socket.leave(`groupcall:${conversationId}`);
      socket.to(`groupcall:${conversationId}`).emit('group:call:left', { conversationId, userId });
    });

    // End call (initiator ends) - notify all and clear participants
    socket.on('group:call:end', ({ conversationId }) => {
      console.log(`[socket] group:call:end convo=${conversationId} by user=${userId}`);
      io.to(`groupcall:${conversationId}`).emit('group:call:end', { conversationId, from: userId });
      const room = io.sockets.adapter.rooms.get(`groupcall:${conversationId}`);
      if (room) {
        room.forEach((sid) => {
          const s = io.sockets.sockets.get(sid);
          if (s) s.leave(`groupcall:${conversationId}`);
        });
      }
      callParticipants.delete(conversationId);
    });

    // ---------- Group signaling relays ----------
    // Accept both older event names and new unified names:
    socket.on('group:call:offer', ({ conversationId, to, sdp }) => {
      console.log(`[socket] group:call:offer from ${userId} -> ${to} in ${conversationId}`);
      const sockets = userSockets.get(String(to));
      if (!sockets) return;
      for (const sid of sockets) io.to(sid).emit('group:call:offer', { from: userId, conversationId, sdp });
    });

    socket.on('group:call:answer', ({ conversationId, to, sdp }) => {
      console.log(`[socket] group:call:answer from ${userId} -> ${to} in ${conversationId}`);
      const sockets = userSockets.get(String(to));
      if (!sockets) return;
      for (const sid of sockets) io.to(sid).emit('group:call:answer', { from: userId, conversationId, sdp });
    });

    socket.on('group:call:candidate', ({ conversationId, to, candidate }) => {
      // candidate is an RTCIceCandidate-like object
      console.log(`[socket] group:call:candidate from ${userId} -> ${to} in ${conversationId}`);
      const sockets = userSockets.get(String(to));
      if (!sockets) return;
      for (const sid of sockets) io.to(sid).emit('group:call:candidate', { from: userId, conversationId, candidate });
    });

    // Also support a "signal" and "ice-candidate" unified event names (if frontend uses them)
    socket.on('group:call:signal', ({ conversationId, to, description }) => {
      console.log(`[socket] group:call:signal from ${userId} -> ${to} in ${conversationId} type=${description?.type}`);
      const sockets = userSockets.get(String(to));
      if (!sockets) return;
      for (const sid of sockets) io.to(sid).emit('group:call:signal', { from: userId, conversationId, description });
    });

    socket.on('group:call:ice-candidate', ({ conversationId, to, candidate }) => {
      console.log(`[socket] group:call:ice-candidate from ${userId} -> ${to} in ${conversationId}`);
      const sockets = userSockets.get(String(to));
      if (!sockets) return;
      for (const sid of sockets) io.to(sid).emit('group:call:ice-candidate', { from: userId, conversationId, candidate });
    });

    // ==================================================
    // ========== One-to-One Calls ======================
    // ==================================================
    socket.on('call:ringing', async ({ to, media }) => {
      console.log(`[socket] call:ringing from ${userId} -> ${to} media=${media}`);
      try {
        const caller = await User.findById(userId).select('name');
        emitToUser(io, to, 'call:incoming', { from: userId, fromName: caller?.name || 'Unknown', media });
      } catch (e) {
        emitToUser(io, to, 'call:incoming', { from: userId, media });
      }
    });

    socket.on('call:accept', ({ to }) => {
      console.log(`[socket] call:accept from ${userId} -> ${to}`);
      emitToUser(io, to, 'call:accepted', { from: userId });
    });

    socket.on('call:reject', ({ to }) => {
      console.log(`[socket] call:reject from ${userId} -> ${to}`);
      emitToUser(io, to, 'call:rejected', { from: userId });
    });

    socket.on('call:offer:1to1', ({ to, sdp, media }) => {
      console.log(`[socket] offer:1to1 from ${userId} -> ${to}`);
      emitToUser(io, to, 'call:offer:1to1', { from: userId, sdp, media });
    });

    socket.on('call:answer:1to1', ({ to, sdp }) => {
      console.log(`[socket] answer:1to1 from ${userId} -> ${to}`);
      emitToUser(io, to, 'call:answer:1to1', { from: userId, sdp });
    });

    socket.on('call:ice:1to1', ({ to, candidate }) => {
      console.log(`[socket] ice:1to1 from ${userId} -> ${to}`);
      emitToUser(io, to, 'call:ice:1to1', { from: userId, candidate });
    });

    socket.on('call:end:1to1', ({ to }) => {
      console.log(`[socket] end:1to1 from ${userId} -> ${to}`);
      emitToUser(io, to, 'call:end:1to1', { from: userId });
    });

    // ==================================================
    // ========== Disconnect cleanup ====================
    // ==================================================
    socket.on('disconnect', async () => {
      console.log(`[socket] disconnect ${socket.id} user=${userId}`);
      removeUserSocket(userId, socket.id);

      const myCalls = socketCalls.get(socket.id);
      if (myCalls) {
        for (const conversationId of myCalls) {
          const participants = callParticipants.get(conversationId);
          if (participants) {
            participants.delete(userId);
            if (!participants.size) callParticipants.delete(conversationId);
          }
          socket.to(`convo:${conversationId}`).emit('call:participant:left', { conversationId, userId });
          socket.to(`groupcall:${conversationId}`).emit('group:call:left', { conversationId, userId });
        }
        socketCalls.delete(socket.id);
      }

      if (!userSockets.has(userId)) {
        try { await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() }); } catch (e) {}
        io.emit('presence:update', { userId, online: false, lastSeen: new Date() });
      }
    });

  }); // io.on('connection')
};


// // const jwt = require('jsonwebtoken');
// // const User = require('./models/User');
// // const Message = require('./models/Message');
// // const Conversation = require('./models/Conversation');

// // // Track user's sockets
// // const userSockets = new Map(); // userId -> Set<socketId>
// // // Track group-call participants per conversation
// // const callParticipants = new Map(); // conversationId -> Set<userId>
// // // Track which calls a socket is in for cleanup
// // const socketCalls = new Map(); // socketId -> Set<conversationId>

// // function addUserSocket(userId, socketId) {
// //   const set = userSockets.get(userId) || new Set();
// //   set.add(socketId);
// //   userSockets.set(userId, set);
// // }
// // function removeUserSocket(userId, socketId) {
// //   const set = userSockets.get(userId);
// //   if (!set) return;
// //   set.delete(socketId);
// //   if (!set.size) userSockets.delete(userId);
// // }
// // function ensureSet(map, key) {
// //   let s = map.get(key);
// //   if (!s) { s = new Set(); map.set(key, s); }
// //   return s;
// // }
// // function emitToUser(io, userId, event, payload) {
// //   const sockets = userSockets.get(userId);
// //   if (!sockets) return;
// //   for (const sid of sockets) {
// //     io.to(sid).emit(event, payload);
// //   }
// // }

// // module.exports = function attachSocket(io) {
// //   // Authenticate sockets with JWT
// //   io.use((socket, next) => {
// //     const token = socket.handshake.auth?.token || socket.handshake.query?.token;
// //     if (!token) return next(new Error('No token'));
// //     try {
// //       const decoded = jwt.verify(token, process.env.JWT_SECRET);
// //       socket.userId = decoded.user.id;
// //       next();
// //     } catch (e) {
// //       next(new Error('Invalid token'));
// //     }
// //   });

// //   io.on('connection', async (socket) => {
// //     const userId = socket.userId;
// //     addUserSocket(userId, socket.id);

// //     await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
// //     io.emit('presence:update', { userId, online: true, lastSeen: new Date() });

// //     // --- Chat rooms (DM/Group) ---
// //     socket.on('conversation:join', async (conversationId) => {
// //       const isMember = await Conversation.exists({ _id: conversationId, members: userId });
// //       if (!isMember) return;
// //       socket.join(`convo:${conversationId}`);
// //     });

// //     socket.on('conversation:leave', (conversationId) => {
// //       socket.leave(`convo:${conversationId}`);
// //     });

// //     // --- Typing indicators ---
// //     socket.on('typing', ({ conversationId, typing }) => {
// //       socket.to(`convo:${conversationId}`).emit('typing', { conversationId, userId, typing });
// //     });

// //     // --- Messaging ---
// //     socket.on('message:send', async ({ conversationId, body, type = 'text' }) => {
// //       try {
// //         const isMember = await Conversation.exists({ _id: conversationId, members: userId });
// //         if (!isMember) return;
// //         const msg = await Message.create({ conversation: conversationId, sender: userId, body, type });
// //         await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
// //         const full = await msg.populate('sender', 'name avatar');
// //         io.to(`convo:${conversationId}`).emit('message:new', full);
// //       } catch (e) {
// //         console.error('message:send error', e);
// //       }
// //     });

// //     // --- Group Calls (mesh signaling) ---
// //     socket.on('call:join', async ({ conversationId, media }) => {
// //       const isMember = await Conversation.exists({ _id: conversationId, members: userId });
// //       if (!isMember) return;
// //       const participants = ensureSet(callParticipants, conversationId);
// //       participants.add(userId);

// //       const myCalls = ensureSet(socketCalls, socket.id);
// //       myCalls.add(conversationId);

// //       io.to(socket.id).emit('call:participants', { conversationId, participants: Array.from(participants) });
// //       socket.to(`convo:${conversationId}`).emit('call:participant:joined', { conversationId, userId, media });
// //     });

// //     socket.on('call:leave', ({ conversationId }) => {
// //       const participants = callParticipants.get(conversationId);
// //       if (participants) {
// //         participants.delete(userId);
// //         if (!participants.size) callParticipants.delete(conversationId);
// //       }
// //       const myCalls = socketCalls.get(socket.id);
// //       if (myCalls) {
// //         myCalls.delete(conversationId);
// //         if (!myCalls.size) socketCalls.delete(socket.id);
// //       }
// //       socket.to(`convo:${conversationId}`).emit('call:participant:left', { conversationId, userId });
// //     });

// //     // Addressed signaling (inside group call)
// //     socket.on('call:offer', ({ conversationId, to, sdp, media }) => {
// //       emitToUser(io, to, 'call:offer', { conversationId, from: userId, sdp, media });
// //     });
// //     socket.on('call:answer', ({ conversationId, to, sdp }) => {
// //       emitToUser(io, to, 'call:answer', { conversationId, from: userId, sdp });
// //     });
// //     socket.on('call:ice', ({ conversationId, to, candidate }) => {
// //       emitToUser(io, to, 'call:ice', { conversationId, from: userId, candidate });
// //     });

// //     // Admin controls (demo-level)
// //     socket.on('call:mute:hard', ({ conversationId, to, hardMuted }) => {
// //       emitToUser(io, to, 'call:hardMuted', { conversationId, hardMuted });
// //       socket.to(`convo:${conversationId}`).emit('call:hardMute:notice', { conversationId, target: to, by: userId, hardMuted });
// //     });

// //     // --- One-to-One Calls ---
// //     socket.on("call:ringing", ({ to, media }) => {
// //       emitToUser(io, to, "call:incoming", { from: userId, media });
// //     });

// //     socket.on("call:accept", ({ to }) => {
// //       emitToUser(io, to, "call:accepted", { from: userId });
// //     });

// //     socket.on("call:reject", ({ to }) => {
// //       emitToUser(io, to, "call:rejected", { from: userId });
// //     });

// //     socket.on("call:offer:1to1", ({ to, sdp, media }) => {
// //       emitToUser(io, to, "call:offer:1to1", { from: userId, sdp, media });
// //     });

// //     socket.on("call:answer:1to1", ({ to, sdp }) => {
// //       emitToUser(io, to, "call:answer:1to1", { from: userId, sdp });
// //     });

// //     socket.on("call:ice:1to1", ({ to, candidate }) => {
// //       emitToUser(io, to, "call:ice:1to1", { from: userId, candidate });
// //     });

// //     socket.on("call:end:1to1", ({ to }) => {
// //       emitToUser(io, to, "call:end:1to1", { from: userId });
// //     });

// //     // --- Disconnect cleanup ---
// //     socket.on('disconnect', async () => {
// //       removeUserSocket(userId, socket.id);

// //       const myCalls = socketCalls.get(socket.id);
// //       if (myCalls) {
// //         for (const conversationId of myCalls) {
// //           const participants = callParticipants.get(conversationId);
// //           if (participants) {
// //             participants.delete(userId);
// //             if (!participants.size) callParticipants.delete(conversationId);
// //           }
// //           socket.to(`convo:${conversationId}`).emit('call:participant:left', { conversationId, userId });
// //         }
// //         socketCalls.delete(socket.id);
// //       }

// //       if (!userSockets.has(userId)) {
// //         await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
// //         io.emit('presence:update', { userId, online: false, lastSeen: new Date() });
// //       }
// //     });
// //   });
// // };


//WORKING FINE

// // backend/socket.js
// const jwt = require('jsonwebtoken');
// const User = require('./models/User');
// const Message = require('./models/Message');
// const Conversation = require('./models/Conversation');

// // Track user's sockets
// const userSockets = new Map(); // userId -> Set<socketId>
// // Track group-call participants per conversation
// const callParticipants = new Map(); // conversationId -> Set<userId>
// // Track which calls a socket is in for cleanup
// const socketCalls = new Map(); // socketId -> Set<conversationId>

// function addUserSocket(userId, socketId) {
//   const set = userSockets.get(userId) || new Set();
//   set.add(socketId);
//   userSockets.set(userId, set);
//   console.log(`[socket] addUserSocket ${userId} -> ${socketId} (count=${set.size})`);
// }
// function removeUserSocket(userId, socketId) {
//   const set = userSockets.get(userId);
//   if (!set) return;
//   set.delete(socketId);
//   console.log(`[socket] removeUserSocket ${userId} -> ${socketId} (remaining=${set.size})`);
//   if (!set.size) userSockets.delete(userId);
// }
// function ensureSet(map, key) {
//   let s = map.get(key);
//   if (!s) { s = new Set(); map.set(key, s); }
//   return s;
// }
// function emitToUser(io, userId, event, payload) {
//   const sockets = userSockets.get(userId);
//   if (!sockets) {
//     console.warn(`[socket] emitToUser: no sockets for user ${userId} (event=${event})`);
//     return;
//   }
//   for (const sid of sockets) {
//     io.to(sid).emit(event, payload);
//   }
//   console.log(`[socket] emitToUser: event=${event} -> user=${userId} sockets=${sockets.size}`);
// }

// module.exports = function attachSocket(io) {
//   // Authenticate sockets with JWT
//   io.use((socket, next) => {
//     const token = socket.handshake.auth?.token || socket.handshake.query?.token;
//     if (!token) return next(new Error('No token'));
//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       socket.userId = String(decoded.user.id); // ensure string
//       next();
//     } catch (e) {
//       console.error('[socket] auth error', e && e.message);
//       next(new Error('Invalid token'));
//     }
//   });

//   io.on('connection', async (socket) => {
//     const userId = socket.userId;
//     console.log(`[socket] connection: socketId=${socket.id} userId=${userId}`);
//     addUserSocket(userId, socket.id);

//     try { await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() }); } catch (e){}

//     io.emit('presence:update', { userId, online: true, lastSeen: new Date() });

//     // --- Chat rooms (DM/Group) ---
//     socket.on('conversation:join', async (conversationId) => {
//       const isMember = await Conversation.exists({ _id: conversationId, members: userId });
//       if (!isMember) {
//         console.warn(`[socket] conversation:join denied ${userId} -> ${conversationId}`);
//         return;
//       }
//       socket.join(`convo:${conversationId}`);
//       console.log(`[socket] ${userId} joined convo:${conversationId}`);
//     });

//     socket.on('conversation:leave', (conversationId) => {
//       socket.leave(`convo:${conversationId}`);
//       console.log(`[socket] ${userId} left convo:${conversationId}`);
//     });

//     // Typing
//     socket.on('typing', ({ conversationId, typing }) => {
//       socket.to(`convo:${conversationId}`).emit('typing', { conversationId, userId, typing });
//     });

//     // Messages
//     socket.on('message:send', async ({ conversationId, body, type = 'text' }) => {
//       try {
//         const isMember = await Conversation.exists({ _id: conversationId, members: userId });
//         if (!isMember) return;
//         const msg = await Message.create({ conversation: conversationId, sender: userId, body, type });
//         await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
//         const full = await msg.populate('sender', 'name avatar');
//         io.to(`convo:${conversationId}`).emit('message:new', full);
//       } catch (e) {
//         console.error('message:send error', e);
//       }
//     });

//     // Group calls (mesh)
//     socket.on('call:join', async ({ conversationId, media }) => {
//       const isMember = await Conversation.exists({ _id: conversationId, members: userId });
//       if (!isMember) return;
//       const participants = ensureSet(callParticipants, conversationId);
//       participants.add(userId);
//       const myCalls = ensureSet(socketCalls, socket.id);
//       myCalls.add(conversationId);
//       io.to(socket.id).emit('call:participants', { conversationId, participants: Array.from(participants) });
//       socket.to(`convo:${conversationId}`).emit('call:participant:joined', { conversationId, userId, media });
//       console.log(`[socket] group call join: ${userId} in ${conversationId}`);
//     });

//     socket.on('call:leave', ({ conversationId }) => {
//       const participants = callParticipants.get(conversationId);
//       if (participants) {
//         participants.delete(userId);
//         if (!participants.size) callParticipants.delete(conversationId);
//       }
//       const myCalls = socketCalls.get(socket.id);
//       if (myCalls) {
//         myCalls.delete(conversationId);
//         if (!myCalls.size) socketCalls.delete(socket.id);
//       }
//       socket.to(`convo:${conversationId}`).emit('call:participant:left', { conversationId, userId });
//       console.log(`[socket] group call leave: ${userId} from ${conversationId}`);
//     });

//     // group signaling
//     socket.on('call:offer', ({ conversationId, to, sdp, media }) => {
//       console.log(`[socket] group offer from ${userId} -> ${to}`);
//       emitToUser(io, to, 'call:offer', { conversationId, from: userId, sdp, media });
//     });
//     socket.on('call:answer', ({ conversationId, to, sdp }) => {
//       console.log(`[socket] group answer from ${userId} -> ${to}`);
//       emitToUser(io, to, 'call:answer', { conversationId, from: userId, sdp });
//     });
//     socket.on('call:ice', ({ conversationId, to, candidate }) => {
//       emitToUser(io, to, 'call:ice', { conversationId, from: userId, candidate });
//     });

//     socket.on('call:mute:hard', ({ conversationId, to, hardMuted }) => {
//       emitToUser(io, to, 'call:hardMuted', { conversationId, hardMuted });
//       socket.to(`convo:${conversationId}`).emit('call:hardMute:notice', { conversationId, target: to, by: userId, hardMuted });
//     });

//     // --- One-to-One Calls ---
//     socket.on("call:ringing", ({ to, media }) => {
//       console.log(`[socket] call:ringing from ${userId} -> ${to} media=${media}`);
//       emitToUser(io, to, "call:incoming", { from: userId, media });
//     });

//     socket.on("call:accept", ({ to }) => {
//       console.log(`[socket] call:accept from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:accepted", { from: userId });
//     });

//     socket.on("call:reject", ({ to }) => {
//       console.log(`[socket] call:reject from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:rejected", { from: userId });
//     });

//     socket.on("call:offer:1to1", ({ to, sdp, media }) => {
//       console.log(`[socket] offer:1to1 from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:offer:1to1", { from: userId, sdp, media });
//     });

//     socket.on("call:answer:1to1", ({ to, sdp }) => {
//       console.log(`[socket] answer:1to1 from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:answer:1to1", { from: userId, sdp });
//     });

//     socket.on("call:ice:1to1", ({ to, candidate }) => {
//       console.log(`[socket] ice:1to1 from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:ice:1to1", { from: userId, candidate });
//     });

//     socket.on("call:end:1to1", ({ to }) => {
//       console.log(`[socket] end:1to1 from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:end:1to1", { from: userId });
//     });

//     // Disconnect cleanup
//     socket.on('disconnect', async () => {
//       console.log(`[socket] disconnect ${socket.id} user=${userId}`);
//       removeUserSocket(userId, socket.id);

//       const myCalls = socketCalls.get(socket.id);
//       if (myCalls) {
//         for (const conversationId of myCalls) {
//           const participants = callParticipants.get(conversationId);
//           if (participants) {
//             participants.delete(userId);
//             if (!participants.size) callParticipants.delete(conversationId);
//           }
//           socket.to(`convo:${conversationId}`).emit('call:participant:left', { conversationId, userId });
//         }
//         socketCalls.delete(socket.id);
//       }

//       if (!userSockets.has(userId)) {
//         try { await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() }); } catch (e) {}
//         io.emit('presence:update', { userId, online: false, lastSeen: new Date() });
//       }
//     });
//   });
// };

// // backend/socket.js
// const jwt = require("jsonwebtoken");
// const User = require("./models/User");
// const Message = require("./models/Message");
// const Conversation = require("./models/Conversation");

// // Track user's sockets
// const userSockets = new Map(); // userId -> Set<socketId>
// // Track group-call participants per conversation
// const callParticipants = new Map(); // conversationId -> Set<userId>
// // Track which calls a socket is in for cleanup
// const socketCalls = new Map(); // socketId -> Set<conversationId>

// function getUserSockets(userId) {
//   return Array.from(userSockets.get(userId) || []);
// }


// function addUserSocket(userId, socketId) {
//   const set = userSockets.get(userId) || new Set();
//   set.add(socketId);
//   userSockets.set(userId, set);
//   console.log(`[socket] addUserSocket ${userId} -> ${socketId} (count=${set.size})`);
// }
// function removeUserSocket(userId, socketId) {
//   const set = userSockets.get(userId);
//   if (!set) return;
//   set.delete(socketId);
//   console.log(`[socket] removeUserSocket ${userId} -> ${socketId} (remaining=${set.size})`);
//   if (!set.size) userSockets.delete(userId);
// }
// function ensureSet(map, key) {
//   let s = map.get(key);
//   if (!s) {
//     s = new Set();
//     map.set(key, s);
//   }
//   return s;
// }
// function emitToUser(io, userId, event, payload) {
//   const sockets = userSockets.get(userId);
//   if (!sockets) {
//     console.warn(`[socket] emitToUser: no sockets for user ${userId} (event=${event})`);
//     return;
//   }
//   for (const sid of sockets) {
//     io.to(sid).emit(event, payload);
//   }
//   console.log(`[socket] emitToUser: event=${event} -> user=${userId} sockets=${sockets.size}`);
// }

// module.exports = function attachSocket(io) {
//   // Authenticate sockets with JWT
//   io.use((socket, next) => {
//     const token = socket.handshake.auth?.token || socket.handshake.query?.token;
//     if (!token) return next(new Error("No token"));
//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       socket.userId = String(decoded.user.id); // ensure string
//       next();
//     } catch (e) {
//       console.error("[socket] auth error", e && e.message);
//       next(new Error("Invalid token"));
//     }
//   });

//   io.on("connection", async (socket) => {
//     const userId = socket.userId;
//     console.log(`[socket] connection: socketId=${socket.id} userId=${userId}`);
//     addUserSocket(userId, socket.id);

//     try {
//       await User.findByIdAndUpdate(userId, { online: true, lastSeen: new Date() });
//     } catch (e) { }

//     io.emit("presence:update", { userId, online: true, lastSeen: new Date() });

//     // --- Chat rooms (DM/Group) ---
//     socket.on("conversation:join", async (conversationId) => {
//       const isMember = await Conversation.exists({ _id: conversationId, members: userId });
//       if (!isMember) {
//         console.warn(`[socket] conversation:join denied ${userId} -> ${conversationId}`);
//         return;
//       }
//       socket.join(`convo:${conversationId}`);
//       console.log(`[socket] ${userId} joined convo:${conversationId}`);
//     });

//     socket.on("conversation:leave", (conversationId) => {
//       socket.leave(`convo:${conversationId}`);
//       console.log(`[socket] ${userId} left convo:${conversationId}`);
//     });

//     // Typing
//     socket.on("typing", ({ conversationId, typing }) => {
//       socket.to(`convo:${conversationId}`).emit("typing", { conversationId, userId, typing });
//     });

//     // Messages
//     socket.on("message:send", async ({ conversationId, body, type = "text" }) => {
//       try {
//         const isMember = await Conversation.exists({ _id: conversationId, members: userId });
//         if (!isMember) return;
//         const msg = await Message.create({ conversation: conversationId, sender: userId, body, type });
//         await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
//         const full = await msg.populate("sender", "name avatar");
//         io.to(`convo:${conversationId}`).emit("message:new", full);
//       } catch (e) {
//         console.error("message:send error", e);
//       }
//     });

//     // ==================================================
//     // ========== Group Calls (mesh + ringing) ==========
//     // ==================================================

//     // Step 1: Start group call (notify all members)
//     // Group call start
//     // socket.on("group:call:start", async ({ conversationId, type }) => {
//     //   try {
//     //     const convo = await Conversation.findById(conversationId).populate("members", "name");
//     //     if (!convo || !convo.isGroup) return;

//     //     console.log(`[group:call:start] ${socket.userId} started ${type} call in group ${convo.name}`);

//     //     // Notify all members except the caller
//     //     for (const member of convo.members) {
//     //       if (member._id.toString() === socket.userId) continue;

//     //       const sockets = getUserSockets(member._id.toString());
//     //       sockets.forEach(sid => {
//     //         io.to(sid).emit("group:call:incoming", {
//     //           conversationId,
//     //           groupName: convo.name,
//     //           from: socket.userId,
//     //           fromName: userDoc ? userDoc.name : "Unknown",
//     //           type,
//     //         });
//     //         console.log(`[socket] sent group:call:incoming -> ${member.name} (${sid})`);
//     //       });
//     //     }

//     //     // Tell caller "ringing"
//     //     io.to(socket.id).emit("group:call:ringing", {
//     //       conversationId,
//     //       type,
//     //     });
//     //   } catch (err) {
//     //     console.error("group:call:start error", err);
//     //   }
//     // }); 


//     // socket.on("group:call:start", async ({ conversationId, media }) => {
//     //   try {
//     //     const convo = await Conversation.findById(conversationId).populate("members", "name");
//     //     if (!convo || !convo.isGroup) return;

//     //     const caller = await User.findById(socket.userId).select("name");

//     //     console.log(`[group:call:start] ${socket.userId} started ${media} call in group ${convo.name}`);

//     //     // Notify all members except the caller
//     //     for (const member of convo.members) {
//     //       if (member._id.toString() === socket.userId) continue;

//     //       const sockets = getUserSockets(member._id.toString());
//     //       sockets.forEach(sid => {
//     //         io.to(sid).emit("group:call:incoming", {
//     //           conversationId,
//     //           groupName: convo.name,
//     //           from: socket.userId,
//     //           fromName: caller?.name || "Unknown",
//     //           media,
//     //         });
//     //         console.log(`[socket] sent group:call:incoming -> ${member.name} (${sid})`);
//     //       });
//     //     }

//     //     // Tell caller "ringing"
//     //     io.to(socket.id).emit("group:call:ringing", {
//     //       conversationId,
//     //       media,
//     //     });
//     //   } catch (err) {
//     //     console.error("group:call:start error", err);
//     //   }
//     // });




//     // // Step 2: Accept / Join
//     // socket.on("group:call:join", ({ conversationId, media }) => {
//     //   console.log(`[socket] group:call:join convo=${conversationId} user=${userId}`);
//     //   const participants = ensureSet(callParticipants, conversationId);
//     //   participants.add(userId);

//     //   const myCalls = ensureSet(socketCalls, socket.id);
//     //   myCalls.add(conversationId);

//     //   socket.join(`groupcall:${conversationId}`);

//     //   // Notify others
//     //   socket.to(`groupcall:${conversationId}`).emit("group:call:joined", {
//     //     conversationId,
//     //     userId,
//     //     media,
//     //   });

//     //   // Send back list of current participants
//     //   io.to(socket.id).emit("group:call:participants", {
//     //     conversationId,
//     //     participants: Array.from(participants),
//     //   });
//     // });

//     // // Step 3: Reject
//     // socket.on("group:call:reject", ({ conversationId }) => {
//     //   console.log(`[socket] group:call:reject convo=${conversationId} user=${userId}`);
//     //   socket.to(`groupcall:${conversationId}`).emit("group:call:rejected", {
//     //     conversationId,
//     //     userId,
//     //   });
//     // });

//     // // Step 4: Leave
//     // socket.on("group:call:leave", ({ conversationId }) => {
//     //   console.log(`[socket] group:call:leave convo=${conversationId} user=${userId}`);
//     //   const participants = callParticipants.get(conversationId);
//     //   if (participants) {
//     //     participants.delete(userId);
//     //     if (!participants.size) callParticipants.delete(conversationId);
//     //   }
//     //   const myCalls = socketCalls.get(socket.id);
//     //   if (myCalls) {
//     //     myCalls.delete(conversationId);
//     //     if (!myCalls.size) socketCalls.delete(socket.id);
//     //   }
//     //   socket.leave(`groupcall:${conversationId}`);
//     //   socket.to(`groupcall:${conversationId}`).emit("group:call:left", {
//     //     conversationId,
//     //     userId,
//     //   });
//     // });

//     // // Step 5: End call (by initiator or last one leaving)
//     // socket.on("group:call:end", ({ conversationId }) => {
//     //   console.log(`[socket] group:call:end convo=${conversationId} by user=${userId}`);
//     //   io.to(`groupcall:${conversationId}`).emit("group:call:end", { conversationId, from: userId });
//     //   const room = io.sockets.adapter.rooms.get(`groupcall:${conversationId}`);
//     //   if (room) {
//     //     room.forEach((socketId) => {
//     //       const s = io.sockets.sockets.get(socketId);
//     //       if (s) s.leave(`groupcall:${conversationId}`);
//     //     });
//     //   }
//     //   callParticipants.delete(conversationId);
//     // });
    
//               // ==================================================
// // ========== Group Calls (mesh + ringing) ==========
// // ==================================================

// socket.on("group:call:start", async ({ conversationId, media }) => {
//   try {
//     const convo = await Conversation.findById(conversationId)
//       .populate("members", "name");
//     if (!convo || !convo.isGroup) return;

//     const caller = await User.findById(socket.userId).select("name");

//     console.log(`[group:call:start] ${socket.userId} (${caller?.name}) started ${media} call in group ${convo.name}`);

//     // Notify all members except the caller
//     for (const member of convo.members) {
//       if (member._id.toString() === socket.userId) continue;

//       const sockets = userSockets.get(member._id.toString());
//       if (!sockets) continue;

//       for (const sid of sockets) {
//         io.to(sid).emit("group:call:incoming", {
//           conversationId,
//           groupName: convo.name,
//           from: socket.userId,
//           fromName: caller?.name || "Unknown",
//           media, // ✅ send "audio" or "video"
//         });
//         console.log(`[socket] sent group:call:incoming -> ${member.name} (${sid})`);
//       }
//     }

//     // Tell caller "ringing"
//     io.to(socket.id).emit("group:call:ringing", {
//       conversationId,
//       media,
//     });
//   } catch (err) {
//     console.error("group:call:start error", err);
//   }
// });

// socket.on("group:call:join", ({ conversationId, media }) => {
//   console.log(`[socket] group:call:join convo=${conversationId} user=${userId}`);

//   const participants = ensureSet(callParticipants, conversationId);
//   participants.add(userId);

//   const myCalls = ensureSet(socketCalls, socket.id);
//   myCalls.add(conversationId);

//   socket.join(`groupcall:${conversationId}`);

//   // Notify others
//   socket.to(`groupcall:${conversationId}`).emit("group:call:joined", {
//     conversationId,
//     userId,
//     media,
//   });

//   // Send back list of current participants
//   io.to(socket.id).emit("group:call:participants", {
//     conversationId,
//     participants: Array.from(participants),
//   });
// });

// socket.on("group:call:reject", ({ conversationId }) => {
//   console.log(`[socket] group:call:reject convo=${conversationId} user=${userId}`);
//   socket.to(`groupcall:${conversationId}`).emit("group:call:rejected", {
//     conversationId,
//     userId,
//   });
// });

// socket.on("group:call:leave", ({ conversationId }) => {
//   console.log(`[socket] group:call:leave convo=${conversationId} user=${userId}`);
//   const participants = callParticipants.get(conversationId);
//   if (participants) {
//     participants.delete(userId);
//     if (!participants.size) callParticipants.delete(conversationId);
//   }
//   const myCalls = socketCalls.get(socket.id);
//   if (myCalls) {
//     myCalls.delete(conversationId);
//     if (!myCalls.size) socketCalls.delete(socket.id);
//   }
//   socket.leave(`groupcall:${conversationId}`);
//   socket.to(`groupcall:${conversationId}`).emit("group:call:left", {
//     conversationId,
//     userId,
//   });
// });

// socket.on("group:call:end", ({ conversationId }) => {
//   console.log(`[socket] group:call:end convo=${conversationId} by user=${userId}`);
//   io.to(`groupcall:${conversationId}`).emit("group:call:end", { conversationId, from: userId });
//   const room = io.sockets.adapter.rooms.get(`groupcall:${conversationId}`);
//   if (room) {
//     room.forEach((socketId) => {
//       const s = io.sockets.sockets.get(socketId);
//       if (s) s.leave(`groupcall:${conversationId}`);
//     });
//   }
//   callParticipants.delete(conversationId);
// });
// // Relay offers
// socket.on("group:call:offer", ({ conversationId, to, description }) => {
//   console.log(`[socket] offer from ${userId} to ${to} in group ${conversationId}`);
//   const sockets = userSockets.get(to);
//   if (!sockets) return;
//   for (const sid of sockets) {
//     io.to(sid).emit("group:call:offer", {
//       from: userId,
//       conversationId,
//       description,
//     });
//   }
// });

// // Relay answers
// socket.on("group:call:answer", ({ conversationId, to, description }) => {
//   console.log(`[socket] answer from ${userId} to ${to} in group ${conversationId}`);
//   const sockets = userSockets.get(to);
//   if (!sockets) return;
//   for (const sid of sockets) {
//     io.to(sid).emit("group:call:answer", {
//       from: userId,
//       conversationId,
//       description,
//     });
//   }
// });

// // Relay ICE candidates
// socket.on("group:call:candidate", ({ conversationId, to, candidate }) => {
//   console.log(`[socket] candidate from ${userId} to ${to} in group ${conversationId}`);
//   const sockets = userSockets.get(to);
//   if (!sockets) return;
//   for (const sid of sockets) {
//     io.to(sid).emit("group:call:candidate", {
//       from: userId,
//       conversationId,
//       candidate,
//     });
//   }
// });

//     // WebRTC signaling inside group call
// // When a user sends SDP offer to others
// socket.on("group:call:signal", ({ conversationId, to, data }) => {
//   io.to(userSockets[to] || []).emit("group:call:signal", {
//     from: userId,
//     conversationId,
//     data, // could be { type: 'offer'|'answer', sdp } or ICE candidate
//   });
// });

// // Relay ICE candidates
// socket.on("group:call:ice-candidate", ({ conversationId, to, candidate }) => {
//   io.to(userSockets[to] || []).emit("group:call:ice-candidate", {
//     from: userId,
//     conversationId,
//     candidate,
//   });
// });

//     socket.on("call:offer", ({ conversationId, to, sdp, media }) => {
//       console.log(`[socket] group offer from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:offer", { conversationId, from: userId, sdp, media });
//     });
//     socket.on("call:answer", ({ conversationId, to, sdp }) => {
//       console.log(`[socket] group answer from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:answer", { conversationId, from: userId, sdp });
//     });
//     socket.on("call:ice", ({ conversationId, to, candidate }) => {
//       emitToUser(io, to, "call:ice", { conversationId, from: userId, candidate });
//     });

//     // ==================================================
//     // ========== One-to-One Calls ======================
//     // ==================================================
//     socket.on("call:ringing", async ({ to, media }) => {
//       console.log(`[socket] call:ringing from ${userId} -> ${to} media=${media}`);
//       try {
//         const caller = await User.findById(userId).select("name");
//         emitToUser(io, to, "call:incoming", {
//           from: userId,
//           fromName: caller?.name || "Unknown",
//           media,
//         });
//       } catch (e) {
//         emitToUser(io, to, "call:incoming", { from: userId, media });
//       }
//     });


//     socket.on("call:accept", ({ to }) => {
//       console.log(`[socket] call:accept from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:accepted", { from: userId });
//     });

//     socket.on("call:reject", ({ to }) => {
//       console.log(`[socket] call:reject from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:rejected", { from: userId });
//     });

//     socket.on("call:offer:1to1", ({ to, sdp, media }) => {
//       console.log(`[socket] offer:1to1 from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:offer:1to1", { from: userId, sdp, media });
//     });

//     socket.on("call:answer:1to1", ({ to, sdp }) => {
//       console.log(`[socket] answer:1to1 from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:answer:1to1", { from: userId, sdp });
//     });

//     socket.on("call:ice:1to1", ({ to, candidate }) => {
//       console.log(`[socket] ice:1to1 from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:ice:1to1", { from: userId, candidate });
//     });

//     socket.on("call:end:1to1", ({ to }) => {
//       console.log(`[socket] end:1to1 from ${userId} -> ${to}`);
//       emitToUser(io, to, "call:end:1to1", { from: userId });
//     });

//     // ==================================================
//     // ========== Disconnect cleanup ====================
//     // ==================================================
//     socket.on("disconnect", async () => {
//       console.log(`[socket] disconnect ${socket.id} user=${userId}`);
//       removeUserSocket(userId, socket.id);

//       const myCalls = socketCalls.get(socket.id);
//       if (myCalls) {
//         for (const conversationId of myCalls) {
//           const participants = callParticipants.get(conversationId);
//           if (participants) {
//             participants.delete(userId);
//             if (!participants.size) callParticipants.delete(conversationId);
//           }
//           socket.to(`convo:${conversationId}`).emit("call:participant:left", {
//             conversationId,
//             userId,
//           });
//         }
//         socketCalls.delete(socket.id);
//       }

//       if (!userSockets.has(userId)) {
//         try {
//           await User.findByIdAndUpdate(userId, { online: false, lastSeen: new Date() });
//         } catch (e) { }
//         io.emit("presence:update", { userId, online: false, lastSeen: new Date() });
//       }
//     });
//   });
// };
