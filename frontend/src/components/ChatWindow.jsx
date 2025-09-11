
// // WORKING FINE

// // // frontend/src/components/ChatWindow.jsx
// // import React, { useEffect, useRef, useState } from 'react';
// // import { api } from '../api';
// // import { getSocket } from '../socket';
// // import MessageBubble from './MessageBubble.jsx';
// // import MessageInput from './MessageInput.jsx';
// // import GroupCallModal from './GroupCallModal.jsx';
// // import CallModal from './CallModal.jsx';
// // import IncomingCallPopup from './IncomingCallModal.jsx';

// // export default function ChatWindow({ me, active, onNeedAuth }) {
// //   const [messages, setMessages] = useState([]);
// //   const [loading, setLoading] = useState(false);
// //   const [outgoing, setOutgoing] = useState(null);
// //   const [call, setCall] = useState(null);
// //   const [incoming, setIncoming] = useState(null);
// //   const bottomRef = useRef();
// //   const client = api(() => localStorage.getItem('token'));
// //   const socket = getSocket();

// //   useEffect(() => {
// //     if (!active?._id) return;
// //     setLoading(true);
// //     client.get(`/messages/${active._id}`)
// //       .then(({ data }) => {
// //         setMessages(data);
// //         setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
// //       }).finally(() => setLoading(false));

// //     socket.emit('conversation:join', active._id);
// //     const onNew = (msg) => {
// //       if (msg.conversation === active._id) {
// //         setMessages(m => [...m, msg]);
// //         bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
// //       }
// //     };
// //     socket.on('message:new', onNew);
// //     return () => {
// //       socket.emit('conversation:leave', active._id);
// //       socket.off('message:new', onNew);
// //     };
// //   }, [active?._id]); // eslint-disable-line

// //   useEffect(() => {
// //     const onIncoming = ({ from, media }) => {
// //       console.log('[client] call:incoming', from, media);
// //       setIncoming({ from, media });
// //     };
// //     const onRejected = ({ from }) => {
// //       console.log('[client] call:rejected', from);
// //       if (outgoing && outgoing.peerId === from) setOutgoing(null);
// //       if (incoming && incoming.from === from) setIncoming(null);
// //     };
// //     const onAccepted = ({ from }) => {
// //       console.log('[client] call:accepted', from);
// //       if (outgoing && outgoing.peerId === from) {
// //         setCall({ conversationId: active._id, peerId: from, media: outgoing.media, incoming: false });
// //         setOutgoing(null);
// //       }
// //     };

// //     socket.on('call:incoming', onIncoming);
// //     socket.on('call:rejected', onRejected);
// //     socket.on('call:accepted', onAccepted);

// //     return () => {
// //       socket.off('call:incoming', onIncoming);
// //       socket.off('call:rejected', onRejected);
// //       socket.off('call:accepted', onAccepted);
// //     };
// //   }, [socket, outgoing, incoming, active?._id]);

// //   function send(body) {
// //     socket.emit('message:send', { conversationId: active._id, body });
// //   }
// //   function typing(typing) {
// //     socket.emit('typing', { conversationId: active._id, typing });
// //   }

// //   function startOutgoingCall(media) {
// //     if (!active || active.isGroup) return;
// //     const peer = (active.members || []).find(m => m._id !== me._id);
// //     if (!peer) return alert('No peer');
// //     console.log('[client] startOutgoingCall to', peer._id, media);
// //     socket.emit('call:ringing', { to: peer._id, media });
// //     setOutgoing({ status: 'ringing', peerId: peer._id, media });
// //   }

// //   function acceptIncoming() {
// //     if (!incoming) return;
// //     socket.emit('call:accept', { to: incoming.from });
// //     setCall({ conversationId: active._id, peerId: incoming.from, media: incoming.media, incoming: true });
// //     setIncoming(null);
// //     if (outgoing && outgoing.peerId === incoming.from) setOutgoing(null);
// //   }

// //   function rejectIncoming() {
// //     if (!incoming) return;
// //     socket.emit('call:reject', { to: incoming.from });
// //     setIncoming(null);
// //   }

// //   function hangupActive() {
// //     if (call?.peerId) socket.emit('call:end:1to1', { to: call.peerId });
// //     setCall(null); setOutgoing(null); setIncoming(null);
// //   }

// //   if (!active) return (<div className="chat"><div className="chat-header">No chat selected</div></div>);

// //   const title = active.isGroup ? active.name : (active.members || []).find(m => m._id !== me._id)?.name;

// //   return (
// //     <div className="chat">
// //       <div className="chat-header">
// //         <div><strong>{title}</strong></div>
// //         <div style={{ display: 'flex', gap: 8 }}>
// //           {active.isGroup ? (
// //             <>
// //               <button className="btn" onClick={() => setCall({ conversationId: active._id, media: 'audio' })}>Group Audio</button>
// //               <button className="btn" onClick={() => setCall({ conversationId: active._id, media: 'video' })}>Group Video</button>
// //             </>
// //           ) : (
// //             <>
// //               <button className="btn" onClick={() => startOutgoingCall('audio')}>Call</button>
// //               <button className="btn" onClick={() => startOutgoingCall('video')}>Video</button>
// //             </>
// //           )}
// //         </div>
// //       </div>

// //       <div className="messages">
// //         {loading && <div>Loading...</div>}
// //         {messages.map(m => <MessageBubble key={m._id} meId={me._id} msg={m} />)}
// //         <div ref={bottomRef} />
// //       </div>

// //       {active._id && <MessageInput onSend={send} onTyping={typing} />}

// //       {outgoing && outgoing.status === 'ringing' && (
// //         <div className="outgoing-ringing">🔔 Ringing {outgoing.media} to {outgoing.peerId} <button onClick={() => { socket.emit('call:end:1to1', { to: outgoing.peerId }); setOutgoing(null); }}>Cancel</button></div>
// //       )}

// //       {incoming && (
// //         <IncomingCallPopup socket={socket} incoming={incoming} onDismiss={() => setIncoming(null)} onAccept={acceptIncoming} />
// //       )}

// //       {call && !active.isGroup && (
// //         <CallModal call={call} me={me} onClose={hangupActive} />
// //       )}

// //       {call && active.isGroup && (
// //         <GroupCallModal convo={active} me={me} media={call.media} onClose={() => setCall(null)} />
// //       )}
// //     </div>
// //   );
// // }


// // frontend/src/components/ChatWindow.jsx
// import React, { useEffect, useRef, useState } from "react";
// import { api } from "../api";
// import { getSocket } from "../socket";
// import MessageBubble from "./MessageBubble.jsx";
// import MessageInput from "./MessageInput.jsx";
// import GroupCallModal from "./GroupCallModal.jsx";
// import CallModal from "./CallModal.jsx";
// import IncomingCallPopup from "./IncomingCallModal.jsx";

// export default function ChatWindow({ me, active, onNeedAuth }) {
//   const [messages, setMessages] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [outgoing, setOutgoing] = useState(null); // 1-1 outgoing
//   const [call, setCall] = useState(null); // active call (1-1 or group)
//   const [incoming, setIncoming] = useState(null); // incoming call
//   const bottomRef = useRef();
//   const client = api(() => localStorage.getItem("token"));
//   const socket = getSocket();

//   //
//   // ====== Messages ======
//   //
//   useEffect(() => {
//     if (!active?._id) return;
//     setLoading(true);
//     client
//       .get(`/messages/${active._id}`)
//       .then(({ data }) => {
//         setMessages(data);
//         setTimeout(
//           () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
//           0
//         );
//       })
//       .finally(() => setLoading(false));

//     socket.emit("conversation:join", active._id);

//     const onNew = (msg) => {
//       if (msg.conversation === active._id) {
//         setMessages((m) => [...m, msg]);
//         bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//       }
//     };
//     socket.on("message:new", onNew);

//     return () => {
//       socket.emit("conversation:leave", active._id);
//       socket.off("message:new", onNew);
//     };
//   }, [active?._id]); // eslint-disable-line

//   //
//   // ====== Call listeners ======
//   //
//   useEffect(() => {
//     // 1-to-1 incoming
//     const onIncoming = ({ from, media }) => {
//       console.log("[client] call:incoming", from, media);
//       setIncoming({ type: "1to1", from, media });
//     };

//     // Group incoming
//     const onGroupIncoming = ({ conversationId, media, groupName, from }) => {
//       console.log(
//         "[client] group:call:incoming",
//         conversationId,
//         groupName,
//         media,
//         "from",
//         from
//       );
//       if (conversationId === active?._id) {
//         setIncoming({
//           type: "group",
//           conversationId,
//           media,
//           groupName,
//           from,
//         });
//       }
//     };

//     const onRejected = ({ from }) => {
//       console.log("[client] call:rejected", from);
//       if (outgoing && outgoing.peerId === from) setOutgoing(null);
//       if (incoming && incoming.from === from) setIncoming(null);
//     };

//     const onAccepted = ({ from }) => {
//       console.log("[client] call:accepted", from);
//       if (outgoing && outgoing.peerId === from) {
//         setCall({
//           conversationId: active._id,
//           peerId: from,
//           media: outgoing.media,
//           incoming: false,
//         });
//         setOutgoing(null);
//       }
//     };

//     const onGroupEnd = ({ conversationId }) => {
//       console.log("[client] group:call:end", conversationId);
//       if (call && call.conversationId === conversationId) {
//         setCall(null);
//       }
//     };

//     socket.on("call:incoming", onIncoming);
//     socket.on("call:rejected", onRejected);
//     socket.on("call:accepted", onAccepted);
//     socket.on("group:call:incoming", onGroupIncoming);
//     socket.on("group:call:end", onGroupEnd);

//     return () => {
//       socket.off("call:incoming", onIncoming);
//       socket.off("call:rejected", onRejected);
//       socket.off("call:accepted", onAccepted);
//       socket.off("group:call:incoming", onGroupIncoming);
//       socket.off("group:call:end", onGroupEnd);
//     };
//   }, [socket, outgoing, incoming, call, active?._id]);

//   //
//   // ====== Message helpers ======
//   //
//   function send(body) {
//     socket.emit("message:send", { conversationId: active._id, body });
//   }
//   function typing(typing) {
//     socket.emit("typing", { conversationId: active._id, typing });
//   }

//   //
//   // ====== Call helpers ======
//   //
//   function startOutgoingCall(media) {
//     if (!active || active.isGroup) return;
//     const peer = (active.members || []).find((m) => m._id !== me._id);
//     if (!peer) return alert("No peer");
//     console.log("[client] startOutgoingCall to", peer._id, media);
//     socket.emit("call:ringing", { to: peer._id, media });
//     setOutgoing({ status: "ringing", peerId: peer._id, media });
//   }

//   function startGroupCall(media) {
//     if (!active || !active.isGroup) return;
//     console.log("[client] startGroupCall", active._id, media);
//     socket.emit("group:call:ringing", {
//       conversationId: active._id,
//       media,
//     });
//     setCall({ conversationId: active._id, media, initiator: me._id });
//   }

//   function acceptIncoming() {
//     if (!incoming) return;
//     if (incoming.type === "1to1") {
//       socket.emit("call:accept", { to: incoming.from });
//       setCall({
//         conversationId: active._id,
//         peerId: incoming.from,
//         media: incoming.media,
//         incoming: true,
//       });
//       setIncoming(null);
//       if (outgoing && outgoing.peerId === incoming.from) setOutgoing(null);
//     } else if (incoming.type === "group") {
//       socket.emit("group:call:join", {
//         conversationId: incoming.conversationId,
//         media: incoming.media,
//       });
//       setCall({
//         conversationId: incoming.conversationId,
//         media: incoming.media,
//         incoming: true,
//         isGroup: true,
//       });
//       setIncoming(null);
//     }
//   }

//   function rejectIncoming() {
//     if (!incoming) return;
//     if (incoming.type === "1to1") {
//       socket.emit("call:reject", { to: incoming.from });
//     } else if (incoming.type === "group") {
//       socket.emit("group:call:reject", {
//         conversationId: incoming.conversationId,
//       });
//     }
//     setIncoming(null);
//   }

//   function hangupActive() {
//     if (!call) return;
//     if (call.peerId) {
//       socket.emit("call:end:1to1", { to: call.peerId });
//     } else if (call.conversationId) {
//       socket.emit("group:call:end", { conversationId: call.conversationId });
//     }
//     setCall(null);
//     setOutgoing(null);
//     setIncoming(null);
//   }

//   //
//   // ====== UI ======
//   //
//   if (!active)
//     return (
//       <div className="chat">
//         <div className="chat-header">No chat selected</div>
//       </div>
//     );

//   const title = active.isGroup
//     ? active.name
//     : (active.members || []).find((m) => m._id !== me._id)?.name;

//   return (
//     <div className="chat">
//       <div className="chat-header">
//         <div>
//           <strong>{title}</strong>
//         </div>
//         <div style={{ display: "flex", gap: 8 }}>
//           {active.isGroup ? (
//             <>
//               <button className="btn" onClick={() => startGroupCall("audio")}>
//                 Group Audio
//               </button>
//               <button className="btn" onClick={() => startGroupCall("video")}>
//                 Group Video
//               </button>
//             </>
//           ) : (
//             <>
//               <button className="btn" onClick={() => startOutgoingCall("audio")}>
//                 Call
//               </button>
//               <button className="btn" onClick={() => startOutgoingCall("video")}>
//                 Video
//               </button>
//             </>
//           )}
//         </div>
//       </div>

//       <div className="messages">
//         {loading && <div>Loading...</div>}
//         {messages.map((m) => (
//           <MessageBubble key={m._id} meId={me._id} msg={m} />
//         ))}
//         <div ref={bottomRef} />
//       </div>

//       {active._id && <MessageInput onSend={send} onTyping={typing} />}

//       {/* Outgoing ringing */}
//       {outgoing && outgoing.status === "ringing" && (
//         <div className="outgoing-ringing">
//           🔔 Ringing {outgoing.media} to {outgoing.peerId}{" "}
//           <button
//             onClick={() => {
//               socket.emit("call:end:1to1", { to: outgoing.peerId });
//               setOutgoing(null);
//             }}
//           >
//             Cancel
//           </button>
//         </div>
//       )}

//       {/* Incoming call popup */}
//       {incoming && (
//         <IncomingCallPopup
//           socket={socket}
//           incoming={incoming}
//           onDismiss={() => setIncoming(null)}
//           onAccept={acceptIncoming}
//           onReject={rejectIncoming}
//         />
//       )}

//       {/* Active calls */}
//       {call && !active.isGroup && (
//         <CallModal call={call} me={me} onClose={hangupActive} />
//       )}
//       {call && active.isGroup && (
//         <GroupCallModal
//           convo={active}
//           me={me}
//           media={call.media}
//           onClose={hangupActive}
//         />
//       )}
//     </div>
//   );
// }

// frontend/src/components/ChatWindow.jsx
import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { getSocket } from "../socket";
import MessageBubble from "./MessageBubble.jsx";
import MessageInput from "./MessageInput.jsx";
import GroupCallModal from "./GroupCallModal.jsx";
import CallModal from "./CallModal.jsx";
import IncomingCallPopup from "./IncomingCallModal.jsx";

export default function ChatWindow({ me, active, onNeedAuth }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Separate outgoing states
  const [outgoing1to1, setOutgoing1to1] = useState(null);
  const [outgoingGroup, setOutgoingGroup] = useState(null);

  const [call, setCall] = useState(null);
  const [incoming, setIncoming] = useState(null);

  const bottomRef = useRef();
  const client = api(() => localStorage.getItem("token"));
  const socket = getSocket();

  // ---- Load messages
  useEffect(() => {
    if (!active?._id) return;
    setLoading(true);
    client
      .get(`/messages/${active._id}`)
      .then(({ data }) => {
        setMessages(data);
        setTimeout(
          () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
          0
        );
      })
      .finally(() => setLoading(false));

    socket.emit("conversation:join", active._id);

    const onNew = (msg) => {
      if (msg.conversation === active._id) {
        setMessages((m) => [...m, msg]);
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    };
    socket.on("message:new", onNew);
    return () => {
      socket.emit("conversation:leave", active._id);
      socket.off("message:new", onNew);
    };
  }, [active?._id]); // eslint-disable-line

  // ---- One-to-one call events
  useEffect(() => {
    const onIncoming = ({ from, fromName, media }) => {
      console.log("[client] call:incoming", from, fromName, media);
      setIncoming({ from, fromName, media, isGroup: false });
    };

    const onRejected = ({ from }) => {
      console.log("[client] call:rejected", from);
      if (outgoing1to1 && outgoing1to1.peerId === from) setOutgoing1to1(null);
      if (incoming && incoming.from === from) setIncoming(null);
    };
    const onAccepted = ({ from }) => {
      console.log("[client] call:accepted", from);
      if (outgoing1to1 && outgoing1to1.peerId === from) {
        setCall({
          conversationId: active._id,
          peerId: from,
          media: outgoing1to1.media,
          incoming: false,
          isGroup: false,
        });
        setOutgoing1to1(null);
      }
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:rejected", onRejected);
    socket.on("call:accepted", onAccepted);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:rejected", onRejected);
      socket.off("call:accepted", onAccepted);
    };
  }, [socket, outgoing1to1, incoming, active?._id]);

  // ---- Group call events
  useEffect(() => {
    const onGroupRinging = ({ conversationId, media, participants }) => {
      console.log("[client] group:call:ringing", conversationId, participants);
      if (conversationId === active._id) {
        setOutgoingGroup({
          status: "ringing",
          conversationId,
          media,
          participants,
        });
      }
    };

    // const onGroupIncoming = ({ from, media, conversationId }) => {
    //   console.log("[client] group:call:incoming", from, media, conversationId, groupName);
    //   if (conversationId === active._id) {
    //     setIncoming({ from, media, conversationId, isGroup: true, groupName, participants: group?.participants || [], });
    //   }
    // };


    const onGroupIncoming = ({ from, fromName, media, conversationId, groupName }) => {
  console.log("[client] group:call:incoming", from, fromName, media, conversationId, groupName);
  if (conversationId === active._id) {
    setIncoming({
      from,
      fromName,
      media,
      conversationId,
      isGroup: true,
      groupName,
    });
  }
};


    const onGroupRejected = ({ from, conversationId }) => {
      console.log("[client] group:call:rejected", from);
      if (incoming?.isGroup && incoming.conversationId === conversationId) {
        setIncoming(null);
      }
    };

    const onGroupEnded = ({ conversationId }) => {
      console.log("[client] group:call:end", conversationId);
      if (call?.isGroup && call.conversationId === conversationId) {
        setCall(null);
      }
    };

    socket.on("group:call:ringing", onGroupRinging);
    socket.on("group:call:incoming", onGroupIncoming);
    socket.on("group:call:rejected", onGroupRejected);
    socket.on("group:call:end", onGroupEnded);

    return () => {
      socket.off("group:call:ringing", onGroupRinging);
      socket.off("group:call:incoming", onGroupIncoming);
      socket.off("group:call:rejected", onGroupRejected);
      socket.off("group:call:end", onGroupEnded);
    };
  }, [socket, active?._id, incoming, call]);

  // ---- Helpers
  function send(body) {
    socket.emit("message:send", { conversationId: active._id, body });
  }
  function typing(typing) {
    socket.emit("typing", { conversationId: active._id, typing });
  }

  // ---- Start calls
  function startOutgoingCall(media) {
    if (!active || active.isGroup) return;
    const peer = (active.members || []).find((m) => m._id !== me._id);
    if (!peer) return alert("No peer");
    console.log("[client] startOutgoingCall to", peer._id, media);
    socket.emit("call:ringing", { to: peer._id, media });
    setOutgoing1to1({ status: "ringing", peerId: peer._id, media });
  }

  function startGroupCall(media) {
    console.log("[client] startGroupCall", active._id, media);
    socket.emit("group:call:start", { conversationId: active._id, media, type: media });
    setOutgoingGroup({
      status: "ringing",
      conversationId: active._id,
      media,
      type: media,
      participants: (active.members || []).filter((m) => m._id !== me._id),
    });
  }

  // ---- Accept / Reject
  function acceptIncoming() {
    if (!incoming) return;
    if (incoming.isGroup) {
      socket.emit("group:call:join", {
        conversationId: incoming.conversationId,
        media: incoming.media,
      });
      setCall({
        conversationId: incoming.conversationId,
        media: incoming.media,
        isGroup: true,
        incoming: true,
      });
    } else {
      socket.emit("call:accept", { to: incoming.from });
      setCall({
        conversationId: active._id,
        peerId: incoming.from,
        media: incoming.media,
        incoming: true,
        isGroup: false,
      });
    }
    setIncoming(null);
    setOutgoing1to1(null);
    setOutgoingGroup(null);
  }

  function rejectIncoming() {
    if (!incoming) return;
    if (incoming.isGroup) {
      socket.emit("group:call:reject", {
        conversationId: incoming.conversationId,
      });
    } else {
      socket.emit("call:reject", { to: incoming.from });
    }
    setIncoming(null);
  }

  function hangupActive() {
    if (call?.isGroup) {
      socket.emit("group:call:end", { conversationId: call.conversationId });
    } else if (call?.peerId) {
      socket.emit("call:end:1to1", { to: call.peerId });
    }
    setCall(null);
    setOutgoing1to1(null);
    setOutgoingGroup(null);
    setIncoming(null);
  }

  // ---- UI
  if (!active)
    return (
      <div className="chat">
        <div className="chat-header">No chat selected</div>
      </div>
    );

  const title = active.isGroup
    ? active.name
    : (active.members || []).find((m) => m._id !== me._id)?.name;

  return (
    <div className="chat">
      <div className="chat-header">
        <div>
          <strong>{title}</strong>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {active.isGroup ? (
            <>
              <button className="btn" onClick={() => startGroupCall("audio")}>
                Group Audio
              </button>
              <button className="btn" onClick={() => startGroupCall("video")}>
                Group Video
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => startOutgoingCall("audio")}>
                Call
              </button>
              <button className="btn" onClick={() => startOutgoingCall("video")}>
                Video
              </button>
            </>
          )}
        </div>
      </div>

      <div className="messages">
        {loading && <div>Loading...</div>}
        {messages.map((m) => (
          <MessageBubble key={m._id} meId={me._id} msg={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {active._id && <MessageInput onSend={send} onTyping={typing} />}

      {/* 🔔 Outgoing 1-to-1 Ringing */}
      {outgoing1to1 && outgoing1to1.status === "ringing" && (
        <div className="outgoing-ringing">
          🔔 Ringing {outgoing1to1.media} call to {outgoing1to1.peerId}
          <button
            onClick={() => {
              socket.emit("call:end:1to1", { to: outgoing1to1.peerId });
              setOutgoing1to1(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* 🔔 Outgoing Group Ringing */}
      {outgoingGroup && outgoingGroup.status === "ringing" && (
        <div className="outgoing-ringing">
          📞 Starting {outgoingGroup.media} group call...
          <ul>
            {(outgoingGroup?.participants || []).map((p) => (
              <li key={p._id}>{p.name}</li>
            ))}
          </ul>
          <button
            onClick={() => {
              socket.emit("group:call:end", {
                conversationId: outgoingGroup.conversationId,
              });
              setOutgoingGroup(null);
            }}
          >
            Cancel Call
          </button>
        </div>
      )}

      {/* Incoming Call Popup */}
      {incoming && (
        <IncomingCallPopup
          socket={socket}
          incoming={incoming}
          onDismiss={() => setIncoming(null)}
          onAccept={acceptIncoming}
          onReject={rejectIncoming}
        />
      )}

      {/* Active Calls */}
      {call && !call.isGroup && (
        <CallModal call={call} me={me} onClose={hangupActive} />
      )}
      {call && call.isGroup && (
        <GroupCallModal
          convo={active}
          me={me}
          media={call.media}
          onClose={hangupActive}
        />
      )}
    </div>
  );
}
