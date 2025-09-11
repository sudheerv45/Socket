// import React, { useEffect, useRef, useState } from 'react';
// import { getSocket } from '../socket';

// /**
//  * GroupCallModal
//  * - Mesh WebRTC using addressed signaling over Socket.IO
//  * - Each remote participant has its own RTCPeerConnection
//  * - Simple glare avoidance: user with smaller userId string initiates offers
//  */
// export default function GroupCallModal({ convo, me, media='video', onClose }){
//   const socket = getSocket();
//   const [localStream, setLocalStream] = useState(null);
//   const [participants, setParticipants] = useState([]); // userIds
//   const [peers, setPeers] = useState({}); // userId -> RTCPeerConnection
//   const [remotes, setRemotes] = useState({}); // userId -> MediaStream
//   const localRef = useRef();

//   const conversationId = convo._id;
//   const myId = me._id;

//   // helpers to set state maps safely
//   const setPeer = (uid, pc) => setPeers(p => ({ ...p, [uid]: pc }));
//   const dropPeer = (uid) => setPeers(p => { const n={...p}; delete n[uid]; return n; });
//   const setRemote = (uid, stream) => setRemotes(r => ({ ...r, [uid]: stream }));
//   const dropRemote = (uid) => setRemotes(r => { const n={...r}; delete n[uid]; return n; });

//   useEffect(() => {
//     let mounted = true;
//     (async () => {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: media === 'video' });
//       if (!mounted) { stream.getTracks().forEach(t=>t.stop()); return; }
//       setLocalStream(stream);
//       if (localRef.current) localRef.current.srcObject = stream;
//       socket.emit('call:join', { conversationId, media });
//     })();

//     const onParticipants = ({ conversationId: cid, participants }) => {
//       if (cid !== conversationId) return;
//       setParticipants(participants);
//     };
//     const onJoined = ({ conversationId: cid, userId }) => {
//       if (cid !== conversationId || userId === myId) return;
//       setParticipants(prev => Array.from(new Set([...prev, userId])));
//       // Initiator rule: smaller id string initiates
//       if (myId < userId) createAndOffer(userId);
//     };
//     const onLeft = ({ conversationId: cid, userId }) => {
//       if (cid !== conversationId) return;
//       setParticipants(prev => prev.filter(id => id !== userId));
//       cleanupPeer(userId);
//     };
//     const onOffer = async ({ conversationId: cid, from, sdp }) => {
//       if (cid !== conversationId) return;
//       let pc = peers[from];
//       if (!pc) pc = await createPeer(from);
//       await pc.setRemoteDescription(new RTCSessionDescription(sdp));
//       const answer = await pc.createAnswer();
//       await pc.setLocalDescription(answer);
//       socket.emit('call:answer', { conversationId, to: from, sdp: answer });
//     };
//     const onAnswer = async ({ conversationId: cid, from, sdp }) => {
//       if (cid !== conversationId) return;
//       const pc = peers[from];
//       if (!pc) return;
//       await pc.setRemoteDescription(new RTCSessionDescription(sdp));
//     };
//     const onIce = async ({ conversationId: cid, from, candidate }) => {
//       if (cid !== conversationId) return;
//       const pc = peers[from];
//       if (!pc || !candidate) return;
//       try { await pc.addIceCandidate(candidate); } catch {}
//     };

//     socket.on('call:participants', onParticipants);
//     socket.on('call:participant:joined', onJoined);
//     socket.on('call:participant:left', onLeft);
//     socket.on('call:offer', onOffer);
//     socket.on('call:answer', onAnswer);
//     socket.on('call:ice', onIce);

//     return () => {
//       socket.off('call:participants', onParticipants);
//       socket.off('call:participant:joined', onJoined);
//       socket.off('call:participant:left', onLeft);
//       socket.off('call:offer', onOffer);
//       socket.off('call:answer', onAnswer);
//       socket.off('call:ice', onIce);
//       // leave call
//       socket.emit('call:leave', { conversationId });
//       // teardown
//       Object.values(peers).forEach(pc => pc.close());
//       Object.values(remotes).forEach(s => s.getTracks().forEach(t=>t.stop()));
//       if (localRef.current?.srcObject) localRef.current.srcObject.getTracks().forEach(t=>t.stop());
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   async function createPeer(remoteUserId){
//     const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
//     // Attach local tracks
//     localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
//     pc.onicecandidate = (e) => {
//       if (e.candidate) socket.emit('call:ice', { conversationId, to: remoteUserId, candidate: e.candidate });
//     };
//     pc.ontrack = (e) => {
//       setRemote(remoteUserId, e.streams[0]);
//     };
//     setPeer(remoteUserId, pc);
//     return pc;
//   }

//   async function createAndOffer(remoteUserId){
//     const pc = await createPeer(remoteUserId);
//     const offer = await pc.createOffer();
//     await pc.setLocalDescription(offer);
//     socket.emit('call:offer', { conversationId, to: remoteUserId, sdp: offer, media });
//   }

//   function cleanupPeer(uid){
//     const pc = peers[uid];
//     if (pc) pc.close();
//     dropPeer(uid);
//     dropRemote(uid);
//   }

//   return (
//     <div className="modal">
//       <div className="modal-card" style={{ gridTemplateColumns: '1fr 1fr' }}>
//         <div>
//           <video ref={localRef} autoPlay muted playsInline></video>
//           <div style={{marginTop:8}}>You ({me?.name})</div>
//         </div>
//         <div style={{display:'grid', gap:8}}>
//           {Object.entries(remotes).map(([uid, stream]) => (
//             <div key={uid}>
//               <video autoPlay playsInline ref={(el)=>{ if (el && stream && el.srcObject !== stream) el.srcObject = stream; }} />
//               <div style={{marginTop:8}}>User {uid.slice(-4)}</div>
//             </div>
//           ))}
//           {!Object.keys(remotes).length && <div style={{alignSelf:'center', color:'#6b7280'}}>Waiting for others to join…</div>}
//         </div>
//         <div style={{gridColumn:'span 2', display:'flex', gap:8, justifyContent:'space-between', alignItems:'center'}}>
//           <div style={{fontSize:12, color:'#6b7280'}}>In call: {participants.length}</div>
//           <div style={{display:'flex', gap:8}}>
//             <button className="btn" onClick={()=>{
//               localStream.getAudioTracks().forEach(t=>t.enabled = !t.enabled);
//             }}>Toggle Mic</button>
//             {media==='video' && (
//               <button className="btn" onClick={()=>{
//                 localStream.getVideoTracks().forEach(t=>t.enabled = !t.enabled);
//               }}>Toggle Camera</button>
//             )}
//             <button className="btn" onClick={onClose}>End Call</button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// WORKING GOOD BEST VERSION

// import React, { useEffect, useRef, useState } from "react";
// import { getSocket } from "../socket";

// export default function GroupCallModal({ conversationId, media, me, onClose }) {
//   const socket = getSocket();
//   const localVideo = useRef();
//   const [remoteStreams, setRemoteStreams] = useState([]); // [{userId, stream}]
//   const pcMap = useRef(new Map()); // userId -> RTCPeerConnection

//   useEffect(() => {
//     const pcMapRef = pcMap.current;

//     async function setupLocalStream() {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         audio: true,
//         video: media === "video",
//       });
//       if (localVideo.current) localVideo.current.srcObject = stream;

//       // Save local stream for later track adds
//       return stream;
//     }

//     setupLocalStream().then((localStream) => {
//       // Join call
//       socket.emit("call:join", { conversationId, media });

//       // Existing participants list
//       socket.on("call:participants", async ({ participants }) => {
//         participants.forEach((uid) => {
//           if (uid !== me.id) makePeerConnection(uid, localStream, true);
//         });
//       });

//       // New participant joined
//       socket.on("call:participant:joined", ({ userId }) => {
//         if (userId !== me.id) makePeerConnection(userId, localStream, true);
//       });

//       // Handle offer
//       socket.on("call:offer", async ({ from, sdp }) => {
//         const pc = makePeerConnection(from, localStream, false);
//         await pc.setRemoteDescription(new RTCSessionDescription(sdp));
//         const answer = await pc.createAnswer();
//         await pc.setLocalDescription(answer);
//         socket.emit("call:answer", { conversationId, to: from, sdp: answer });
//       });

//       // Handle answer
//       socket.on("call:answer", async ({ from, sdp }) => {
//         const pc = pcMapRef.get(from);
//         if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
//       });

//       // Handle ICE
//       socket.on("call:ice", async ({ from, candidate }) => {
//         const pc = pcMapRef.get(from);
//         if (pc && candidate) {
//           try {
//             await pc.addIceCandidate(new RTCIceCandidate(candidate));
//           } catch (err) {
//             console.error("ICE add error", err);
//           }
//         }
//       });

//       // Participant left
//       socket.on("call:participant:left", ({ userId }) => {
//         const pc = pcMapRef.get(userId);
//         if (pc) pc.close();
//         pcMapRef.delete(userId);
//         setRemoteStreams((prev) => prev.filter((s) => s.userId !== userId));
//       });
//     });

//     function makePeerConnection(peerId, localStream, isInitiator) {
//       if (pcMapRef.has(peerId)) return pcMapRef.get(peerId);

//       const pc = new RTCPeerConnection({
//         iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//       });

//       // Add local tracks
//       localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

//       // Handle remote tracks
//       pc.ontrack = (e) => {
//         setRemoteStreams((prev) => {
//           if (prev.some((s) => s.userId === peerId)) return prev;
//           return [...prev, { userId: peerId, stream: e.streams[0] }];
//         });
//       };

//       // ICE candidates
//       pc.onicecandidate = (e) => {
//         if (e.candidate) {
//           socket.emit("call:ice", {
//             conversationId,
//             to: peerId,
//             candidate: e.candidate,
//           });
//         }
//       };

//       pcMapRef.set(peerId, pc);

//       // If initiator, create offer
//       if (isInitiator) {
//         pc.createOffer()
//           .then((offer) => pc.setLocalDescription(offer))
//           .then(() => {
//             socket.emit("call:offer", {
//               conversationId,
//               to: peerId,
//               sdp: pc.localDescription,
//               media,
//             });
//           });
//       }

//       return pc;
//     }

//     return () => {
//       socket.emit("call:leave", { conversationId });
//       for (const pc of pcMapRef.values()) pc.close();
//       pcMapRef.clear();
//       if (localVideo.current?.srcObject) {
//         localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
//       }
//     };
//   }, [conversationId, media, me.id, socket]);

//   return (
//     <div className="modal-overlay">
//       <div className="modal">
//         <h3>👥 Group {media === "video" ? "Video" : "Audio"} Call</h3>

//         <div className="video-container grid">
//           {media === "video" && (
//             <>
//               <video ref={localVideo} autoPlay playsInline muted />
//               {remoteStreams.map((s) => (
//                 <video key={s.userId} autoPlay playsInline srcObject={s.stream} />
//               ))}
//             </>
//           )}
//           {media === "audio" && (
//             <>
//               <audio ref={localVideo} autoPlay muted />
//               {remoteStreams.map((s) => (
//                 <audio key={s.userId} autoPlay srcObject={s.stream} />
//               ))}
//               <p>🔊 Group audio call in progress...</p>
//             </>
//           )}
//         </div>

//         <div style={{ marginTop: 12 }}>
//           <button className="btn btn-danger" onClick={onClose}>
//             Leave Call
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // frontend/components/GroupCallModal.jsx
// import React, { useEffect, useRef, useState } from "react";
// import { createPortal } from "react-dom";
// import { getSocket } from "../socket";

// export default function GroupCallModal({ convo, me, media, onClose }) {
//   const socket = getSocket();
//   const [connections, setConnections] = useState({});
//   const [remoteStreams, setRemoteStreams] = useState({});
//   const localVideoRef = useRef(null);
//   const [localStream, setLocalStream] = useState(null);

//   // ---- Setup local media
//   useEffect(() => {
//     async function init() {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           audio: true,
//           video: media === "video",
//         });
//         setLocalStream(stream);
//         if (localVideoRef.current) {
//           localVideoRef.current.srcObject = stream;
//         }
//         socket.emit("group:call:join", { conversationId: convo._id, media });
//       } catch (err) {
//         console.error("[client] group media error", err);
//       }
//     }
//     init();
//   }, [media]);

//   // ---- Socket events
//   useEffect(() => {
//     if (!socket) return;

//     socket.on("group:call:joined", ({ userId }) => {
//       console.log("[client] group:call:joined", userId);
//       if (userId !== me._id) createOffer(userId);
//     });

//     socket.on("group:call:left", ({ userId }) => {
//       console.log("[client] group:call:left", userId);
//       removePeer(userId);
//     });

//     socket.on("group:call:end", () => {
//       console.log("[client] group:call:end");
//       cleanup();
//     });

//     socket.on("call:offer", async ({ from, sdp }) => {
//       console.log("[client] offer from", from);
//       await createAnswer(from, sdp);
//     });

//     socket.on("call:answer", async ({ from, sdp }) => {
//       console.log("[client] answer from", from);
//       const pc = connections[from];
//       if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
//     });

//     socket.on("call:ice", async ({ from, candidate }) => {
//       const pc = connections[from];
//       if (pc && candidate) {
//         try {
//           await pc.addIceCandidate(new RTCIceCandidate(candidate));
//         } catch (e) {
//           console.error("ice error", e);
//         }
//       }
//     });

//     return () => {
//       socket.off("group:call:joined");
//       socket.off("group:call:left");
//       socket.off("group:call:end");
//       socket.off("call:offer");
//       socket.off("call:answer");
//       socket.off("call:ice");
//     };
//   }, [socket, connections]);

//   // ---- WebRTC helpers
//   const createPeer = (peerId) => {
//     const pc = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });

//     if (localStream) {
//       localStream.getTracks().forEach((track) =>
//         pc.addTrack(track, localStream)
//       );
//     }

//     pc.onicecandidate = (e) => {
//       if (e.candidate) {
//         socket.emit("call:ice", {
//           conversationId: convo._id,
//           to: peerId,
//           candidate: e.candidate,
//         });
//       }
//     };

//     pc.ontrack = (e) => {
//       console.log("[client] remote track from", peerId);
//       setRemoteStreams((prev) => ({ ...prev, [peerId]: e.streams[0] }));
//     };

//     setConnections((prev) => ({ ...prev, [peerId]: pc }));
//     return pc;
//   };

//   const createOffer = async (peerId) => {
//     const pc = createPeer(peerId);
//     const offer = await pc.createOffer();
//     await pc.setLocalDescription(offer);
//     socket.emit("call:offer", {
//       conversationId: convo._id,
//       to: peerId,
//       sdp: offer,
//       media,
//     });
//   };

//   const createAnswer = async (peerId, offer) => {
//     const pc = createPeer(peerId);
//     await pc.setRemoteDescription(new RTCSessionDescription(offer));
//     const answer = await pc.createAnswer();
//     await pc.setLocalDescription(answer);
//     socket.emit("call:answer", {
//       conversationId: convo._id,
//       to: peerId,
//       sdp: answer,
//     });
//   };

//   const removePeer = (peerId) => {
//     if (connections[peerId]) {
//       connections[peerId].close();
//       const newConns = { ...connections };
//       delete newConns[peerId];
//       setConnections(newConns);
//     }
//     setRemoteStreams((prev) => {
//       const copy = { ...prev };
//       delete copy[peerId];
//       return copy;
//     });
//   };

//   const cleanup = () => {
//     Object.values(connections).forEach((pc) => pc.close());
//     setConnections({});
//     setRemoteStreams({});
//     if (localStream) {
//       localStream.getTracks().forEach((t) => t.stop());
//     }
//     socket.emit("group:call:leave", { conversationId: convo._id });
//     onClose?.();
//   };

//   // ---- UI
//   return createPortal(
//     <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center">
//       <video
//         ref={localVideoRef}
//         autoPlay
//         muted
//         playsInline
//         className="w-1/3 rounded-lg border mb-4"
//       />
//       <div className="grid grid-cols-2 gap-4 w-full">
//         {Object.entries(remoteStreams).map(([peerId, stream]) => (
//           <video
//             key={peerId}
//             ref={(el) => {
//               if (el) el.srcObject = stream;
//             }}
//             autoPlay
//             playsInline
//             className="w-full rounded-lg border"
//           />
//         ))}
//       </div>
//       <button
//         onClick={cleanup}
//         className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
//       >
//         Leave Call
//       </button>
//     </div>,
//     document.body
//   );
// // }
// // frontend/src/components/GroupCallModal.jsx
// import React, { useEffect, useRef, useState } from "react";
// import { getSocket } from "../socket";

// export default function GroupCallModal({ convo, me, media, onClose }) {
//   const socket = getSocket();
//   const localVideoRef = useRef(null);
//   const [localStream, setLocalStream] = useState(null);
//   const [remoteStreams, setRemoteStreams] = useState({}); // userId -> MediaStream
//   const peers = useRef({}); // userId -> RTCPeerConnection

//   // ---- 1. Get local media
//   useEffect(() => {
//     async function initMedia() {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: media === "video",
//           audio: true,
//         });
//         setLocalStream(stream);
//         if (localVideoRef.current) {
//           localVideoRef.current.srcObject = stream;
//         }

//         // Announce join to backend
//         socket.emit("group:call:join", {
//           conversationId: convo._id,
//           media,
//         });
//       } catch (err) {
//         console.error("Error getting user media:", err);
//         onClose();
//       }
//     }
//     initMedia();

//     return () => {
//       // cleanup
//       if (localStream) {
//         localStream.getTracks().forEach((t) => t.stop());
//       }
//       Object.values(peers.current).forEach((pc) => pc.close());
//       peers.current = {};
//       setRemoteStreams({});
//     };
//   }, []); // eslint-disable-line

//   // ---- 2. Helper to create peer connection
//   function createPeerConnection(userId, initiator) {
//     if (peers.current[userId]) return peers.current[userId];

//     const pc = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });

//     // Add local tracks
//     localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

//     // Remote stream
//     pc.ontrack = (event) => {
//       console.log("[GroupCall] Remote track from", userId);
//       setRemoteStreams((prev) => ({
//         ...prev,
//         [userId]: event.streams[0],
//       }));
//     };

//     // ICE candidates
//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         socket.emit("group:call:ice-candidate", {
//           conversationId: convo._id,
//           to: userId,
//           candidate: event.candidate,
//         });
//       }
//     };

//     peers.current[userId] = pc;
//     return pc;
//   }

//   // ---- 3. Socket listeners
//   useEffect(() => {
//     const handleJoined = async ({ userId }) => {
//       console.log("[GroupCall] user joined:", userId);
//       if (userId === me._id) return;

//       const pc = createPeerConnection(userId, true);
//       // Create offer
//       const offer = await pc.createOffer();
//       await pc.setLocalDescription(offer);
//       socket.emit("group:call:signal", {
//         conversationId: convo._id,
//         to: userId,
//         description: offer,
//       });
//     };

//     const handleSignal = async ({ from, description }) => {
//       console.log("[GroupCall] signal from", from, description.type);
//       const pc = createPeerConnection(from, false);
//       await pc.setRemoteDescription(new RTCSessionDescription(description));

//       if (description.type === "offer") {
//         const answer = await pc.createAnswer();
//         await pc.setLocalDescription(answer);
//         socket.emit("group:call:signal", {
//           conversationId: convo._id,
//           to: from,
//           description: answer,
//         });
//       }
//     };

//     const handleIceCandidate = async ({ from, candidate }) => {
//       console.log("[GroupCall] ICE from", from);
//       const pc = createPeerConnection(from, false);
//       try {
//         await pc.addIceCandidate(new RTCIceCandidate(candidate));
//       } catch (err) {
//         console.error("Error adding ICE candidate", err);
//       }
//     };

//     socket.on("group:call:joined", handleJoined);
//     socket.on("group:call:signal", handleSignal);
//     socket.on("group:call:ice-candidate", handleIceCandidate);

//     return () => {
//       socket.off("group:call:joined", handleJoined);
//       socket.off("group:call:signal", handleSignal);
//       socket.off("group:call:ice-candidate", handleIceCandidate);
//     };
//   }, [localStream]); // eslint-disable-line

//   return (
//     <div className="modal">
//       <div className="modal-content">
//         <h3>Group Call - {convo.name}</h3>
//         <div className="videos" style={{ display: "flex", flexWrap: "wrap" }}>
//           {/* Local video */}
//           <video
//             ref={localVideoRef}
//             autoPlay
//             muted
//             playsInline
//             style={{ width: "200px", border: "2px solid green" }}
//           />
//           {/* Remote videos */}
//           {Object.entries(remoteStreams).map(([userId, stream]) => (
//             <video
//               key={userId}
//               autoPlay
//               playsInline
//               ref={(el) => {
//                 if (el && !el.srcObject) {
//                   el.srcObject = stream;
//                 }
//               }}
//               style={{ width: "200px", border: "2px solid red" }}
//             />
//           ))}
//         </div>
//         <button onClick={onClose}>Hang Up</button>
//       </div>
//     </div>
//   );
// }


// frontend/src/components/GroupCallModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { getSocket } from "../socket";

export default function GroupCallModal({ convo, me, media, onClose }) {
  const socket = getSocket();
  const localVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // userId -> MediaStream
  const peers = useRef({}); // userId -> RTCPeerConnection

  // ---- 1. Get local media and join group call
  useEffect(() => {
    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: media === "video",
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Announce join to backend
        socket.emit("group:call:join", {
          conversationId: convo._id,
          media,
        });
      } catch (err) {
        console.error("Error getting user media:", err);
        onClose();
      }
    }
    initMedia();

    return () => {
      // cleanup
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
      }
      Object.values(peers.current).forEach((pc) => pc.close());
      peers.current = {};
      setRemoteStreams({});
      socket.emit("group:call:leave", { conversationId: convo._id });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 2. Helper to create peer connection
  // function createPeerConnection(userId) {
  //   if (peers.current[userId]) return peers.current[userId];

  //   const pc = new RTCPeerConnection({
  //     iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  //   });

  //   // Add local tracks
  //   if (localStream) {
  //     localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  //   }

  //   // Remote stream
  //   pc.ontrack = (event) => {
  //     console.log("[GroupCall] Remote track from", userId);
  //     setRemoteStreams((prev) => ({
  //       ...prev,
  //       [userId]: event.streams[0],
  //     }));
  //   };

  //   // ICE candidates
  //   pc.onicecandidate = (event) => {
  //     if (event.candidate) {
  //       socket.emit("group:call:ice-candidate", {
  //         conversationId: convo._id,
  //         to: userId,
  //         candidate: event.candidate,
  //       });
  //     }
  //   };

  //   peers.current[userId] = pc;
  //   return pc;
  // }

  function createPeerConnection(userId) {
    if (peers.current[userId]) return peers.current[userId];

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // Add tracks if we already have localStream
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Remote track
    pc.ontrack = (event) => {
      console.log("[GroupCall] Remote track from", userId);
      setRemoteStreams((prev) => ({
        ...prev,
        [userId]: event.streams[0],
      }));
    };

    // ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("group:call:ice-candidate", {
          conversationId: convo._id,
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    peers.current[userId] = pc;
    return pc;
  }



  // ---- 3. Socket listeners
  useEffect(() => {
    // Existing participants when I join
    const handleParticipants = async ({ participants }) => {
      console.log("[GroupCall] existing participants:", participants);
      for (const userId of participants) {
        if (userId === me._id) continue;

        const pc = createPeerConnection(userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("group:call:signal", {
          conversationId: convo._id,
          to: userId,
          description: offer,
        });
      }
    };

    // A new user joined after me
    const handleJoined = async ({ userId }) => {
      console.log("[GroupCall] user joined:", userId);
      if (userId === me._id) return;

      const pc = createPeerConnection(userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("group:call:signal", {
        conversationId: convo._id,
        to: userId,
        description: offer,
      });
    };

    const handleSignal = async ({ from, description }) => {
      console.log("[GroupCall] signal from", from, description.type);
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(description));

      if (description.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("group:call:signal", {
          conversationId: convo._id,
          to: from,
          description: answer,
        });
      }
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      console.log("[GroupCall] ICE from", from);
      const pc = createPeerConnection(from);
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate", err);
      }
    };

    socket.on("group:call:participants", handleParticipants);
    socket.on("group:call:joined", handleJoined);
    socket.on("group:call:signal", handleSignal);
    socket.on("group:call:ice-candidate", handleIceCandidate);

    return () => {
      socket.off("group:call:participants", handleParticipants);
      socket.off("group:call:joined", handleJoined);
      socket.off("group:call:signal", handleSignal);
      socket.off("group:call:ice-candidate", handleIceCandidate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Group Call - {convo.name}</h3>
        <div className="videos" style={{ display: "flex", flexWrap: "wrap" }}>
          {/* Local video */}
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: "200px", border: "2px solid green" }}
          />
          {/* Remote videos */}
          {Object.entries(remoteStreams).map(([userId, stream]) => (
            <video
              key={userId}
              autoPlay
              playsInline
              ref={(el) => {
                if (el && !el.srcObject) {
                  el.srcObject = stream;
                }
              }}
              style={{ width: "200px", border: "2px solid red" }}
            />
          ))}
        </div>
        <button onClick={onClose}>Hang Up</button>
      </div>
    </div>
  );
}
