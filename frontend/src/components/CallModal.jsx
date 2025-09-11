// import React, { useEffect, useRef, useState } from 'react';
// import { getSocket } from '../socket';

// export default function CallModal({ call, onClose, me }){
//   const socket = getSocket();
//   const [pc, setPc] = useState(null);
//   const localRef = useRef();
//   const remoteRef = useRef();

//   useEffect(() => {
//     const peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
//     setPc(peer);

//     peer.onicecandidate = (e) => {
//       if (e.candidate) socket.emit('call:ice', { conversationId: call.conversationId, candidate: e.candidate });
//     };
//     peer.ontrack = (e) => { remoteRef.current.srcObject = e.streams[0]; };

//     let localStream;
//     (async () => {
//       localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.media === 'video' });
//       localRef.current.srcObject = localStream;
//       localStream.getTracks().forEach(t => peer.addTrack(t, localStream));

//       if (!call.incoming) {
//         const offer = await peer.createOffer();
//         await peer.setLocalDescription(offer);
//         socket.emit('call:offer', { conversationId: call.conversationId, sdp: offer, media: call.media });
//       }
//     })();

//     window.__webrtcAnswer = async (sdp) => {
//       await peer.setRemoteDescription(sdp);
//     };
//     window.__webrtcIce = async (candidate) => {
//       try { await peer.addIceCandidate(candidate); } catch {}
//     };
//     window.__webrtcEnd = () => { cleanup(); onClose(); };

//     async function onOffer({ from, sdp, media }) {
//       if (!call.incoming) return;
//       await peer.setRemoteDescription(sdp);
//       const answer = await peer.createAnswer();
//       await peer.setLocalDescription(answer);
//       socket.emit('call:answer', { conversationId: call.conversationId, sdp: answer });
//     }

//     socket.on('call:offer', onOffer);

//     const cleanup = () => {
//       socket.off('call:offer', onOffer);
//       peer.close();
//       localRef.current?.srcObject?.getTracks().forEach(t=>t.stop());
//       localRef.current.srcObject = null;
//       remoteRef.current.srcObject = null;
//       window.__webrtcAnswer = null; window.__webrtcIce = null; window.__webrtcEnd = null;
//     };

//     return cleanup;
//   }, []);

//   return (
//     <div className="modal">
//       <div className="modal-card">
//         <div>
//           <video ref={localRef} autoPlay muted playsInline></video>
//           <div style={{marginTop:8}}>You ({me?.name})</div>
//         </div>
//         <div>
//           <video ref={remoteRef} autoPlay playsInline></video>
//           <div style={{marginTop:8}}>Remote</div>
//         </div>
//         <div style={{gridColumn:'span 2', display:'flex', gap:8, justifyContent:'flex-end'}}>
//           <button className="btn" onClick={()=>{ getSocket().emit('call:end', { conversationId: call.conversationId }); onClose(); }}>End</button>
//         </div>
//       </div>
//     </div>
//   );
// }

// import React, { useEffect, useRef, useState } from 'react';
// import { getSocket } from '../socket';

// export default function CallModal({ convo, me, media, onClose }) {
//   const socket = getSocket();
//   const [pc, setPc] = useState(null);
//   const localRef = useRef();
//   const remoteRef = useRef();

//   useEffect(() => {
//     if (!convo) return;

//     const peer = new RTCPeerConnection({
//       iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
//     });
//     setPc(peer);

//     // Send ICE to the other user
//     peer.onicecandidate = (e) => {
//       if (e.candidate) {
//         socket.emit('call:ice:1to1', {
//           to: otherUser._id,
//           candidate: e.candidate
//         });
//       }
//     };

//     // Remote stream → play it
//     peer.ontrack = (e) => {
//       remoteRef.current.srcObject = e.streams[0];
//     };

//     let localStream;
//     (async () => {
//       localStream = await navigator.mediaDevices.getUserMedia({
//         audio: true,
//         video: media === 'video'
//       });
//       localRef.current.srcObject = localStream;
//       localStream.getTracks().forEach((t) => peer.addTrack(t, localStream));

//       // Only the caller creates offer
//       if (convo.isCaller) {
//         const offer = await peer.createOffer();
//         await peer.setLocalDescription(offer);
//         socket.emit('call:offer:1to1', {
//           to: otherUser._id,
//           sdp: offer,
//           media
//         });
//       }
//     })();

//     const otherUser = (convo.members || []).find((m) => m._id !== me._id);

//     // --- Socket events ---
//     async function onOffer({ from, sdp }) {
//       if (from !== otherUser._id) return;
//       await peer.setRemoteDescription(sdp);
//       const answer = await peer.createAnswer();
//       await peer.setLocalDescription(answer);
//       socket.emit('call:answer:1to1', { to: from, sdp: answer });
//     }

//     async function onAnswer({ from, sdp }) {
//       if (from !== otherUser._id) return;
//       await peer.setRemoteDescription(sdp);
//     }

//     async function onIce({ from, candidate }) {
//       if (from !== otherUser._id) return;
//       try {
//         await peer.addIceCandidate(candidate);
//       } catch {}
//     }

//     function onEnd({ from }) {
//       if (from !== otherUser._id) return;
//       cleanup();
//       onClose();
//     }

//     socket.on('call:offer:1to1', onOffer);
//     socket.on('call:answer:1to1', onAnswer);
//     socket.on('call:ice:1to1', onIce);
//     socket.on('call:end:1to1', onEnd);

//     const cleanup = () => {
//       socket.off('call:offer:1to1', onOffer);
//       socket.off('call:answer:1to1', onAnswer);
//       socket.off('call:ice:1to1', onIce);
//       socket.off('call:end:1to1', onEnd);
//       peer.close();
//       localRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
//       localRef.current.srcObject = null;
//       remoteRef.current.srcObject = null;
//     };

//     return cleanup;
//   }, [convo?._id]);

//   return (
//     <div className="modal">
//       <div className="modal-card">
//         <div>
//           <video ref={localRef} autoPlay muted playsInline></video>
//           <div style={{ marginTop: 8 }}>You ({me?.name})</div>
//         </div>
//         <div>
//           <video ref={remoteRef} autoPlay playsInline></video>
//           <div style={{ marginTop: 8 }}>Remote</div>
//         </div>
//         <div
//           style={{
//             gridColumn: 'span 2',
//             display: 'flex',
//             gap: 8,
//             justifyContent: 'flex-end'
//           }}
//         >
//           <button
//             className="btn"
//             onClick={() => {
//               socket.emit('call:end:1to1', {
//                 to: (convo.members || []).find((m) => m._id !== me._id)?._id
//               });
//               onClose();
//             }}
//           >
//             End
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


// import React, { useEffect, useRef, useState } from "react";
// import { getSocket } from "../socket";

// export default function CallModal({ call, me, onClose }) {
//   const socket = getSocket();
//   const localVideo = useRef();
//   const remoteVideo = useRef();
//   const pcRef = useRef(null);
//   const [connected, setConnected] = useState(false);

//   // --- Setup WebRTC PeerConnection ---
//   useEffect(() => {
//     const pc = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });
//     pcRef.current = pc;

//     // Local stream (mic/cam)
//     navigator.mediaDevices
//       .getUserMedia({
//         audio: true,
//         video: call.media === "video",
//       })
//       .then((stream) => {
//         if (localVideo.current) {
//           localVideo.current.srcObject = stream;
//         }
//         stream.getTracks().forEach((track) => pc.addTrack(track, stream));
//       })
//       .catch((err) => console.error("Media error:", err));

//     // Remote stream
//     pc.ontrack = (event) => {
//       if (remoteVideo.current) {
//         remoteVideo.current.srcObject = event.streams[0];
//       }
//     };

//     // ICE candidates
//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         socket.emit("call:ice:1to1", {
//           to: call.incoming ? call.from : getPeerId(),
//           candidate: event.candidate,
//         });
//       }
//     };

//     // Handle offers/answers
//     if (!call.incoming) {
//       makeOffer(pc);
//     }

//     // Socket listeners
//     socket.on("call:offer:1to1", async ({ from, sdp }) => {
//       await pc.setRemoteDescription(new RTCSessionDescription(sdp));
//       const answer = await pc.createAnswer();
//       await pc.setLocalDescription(answer);
//       socket.emit("call:answer:1to1", { to: from, sdp: answer });
//     });

//     socket.on("call:answer:1to1", async ({ sdp }) => {
//       await pc.setRemoteDescription(new RTCSessionDescription(sdp));
//       setConnected(true);
//     });

//     socket.on("call:ice:1to1", async ({ candidate }) => {
//       try {
//         await pc.addIceCandidate(new RTCIceCandidate(candidate));
//       } catch (e) {
//         console.error("ICE error", e);
//       }
//     });

//     socket.on("call:end:1to1", () => {
//       cleanup();
//       onClose();
//     });

//     return () => {
//       cleanup();
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   async function makeOffer(pc) {
//     const offer = await pc.createOffer();
//     await pc.setLocalDescription(offer);
//     socket.emit("call:offer:1to1", {
//       to: getPeerId(),
//       sdp: offer,
//       media: call.media,
//     });
//   }

//   function getPeerId() {
//     // The peer is whoever is not me in this conversation
//     return call?.peerId || null;
//   }

//   function endCall() {
//     socket.emit("call:end:1to1", { to: getPeerId() });
//     cleanup();
//     onClose();
//   }

//   function cleanup() {
//     if (pcRef.current) {
//       pcRef.current.close();
//       pcRef.current = null;
//     }
//     if (localVideo.current?.srcObject) {
//       localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
//     }
//     if (remoteVideo.current?.srcObject) {
//       remoteVideo.current.srcObject.getTracks().forEach((t) => t.stop());
//     }
//   }

//   return (
//     <div className="modal-overlay">
//       <div className="modal">
//         <h3>
//           {call.media === "video" ? "Video Call" : "Audio Call"}{" "}
//           {connected ? "✅ Connected" : "⏳ Connecting..."}
//         </h3>

//         <div className="video-container">
//           {call.media === "video" && (
//             <>
//               <video ref={localVideo} autoPlay playsInline muted />
//               <video ref={remoteVideo} autoPlay playsInline />
//             </>
//           )}
//           {call.media === "audio" && (
//             <>
//               <audio ref={localVideo} autoPlay muted />
//               <audio ref={remoteVideo} autoPlay />
//               <p>🔊 Audio call in progress...</p>
//             </>
//           )}
//         </div>

//         <div style={{ marginTop: 12 }}>
//           <button className="btn btn-danger" onClick={endCall}>
//             End Call
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


// import React, { useEffect, useRef, useState } from "react";
// import { getSocket } from "../socket";

// export default function CallModal({ call, me, onClose }) {
//   const socket = getSocket();
//   const localVideo = useRef();
//   const remoteVideo = useRef();
//   const pcRef = useRef(null);
//   const [connected, setConnected] = useState(false);

//   useEffect(() => {
//     const pc = new RTCPeerConnection({
//       iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
//     });
//     pcRef.current = pc;

//     // Local media
//     navigator.mediaDevices
//       .getUserMedia({
//         audio: true,
//         video: call.media === "video",
//       })
//       .then((stream) => {
//         if (localVideo.current) {
//           localVideo.current.srcObject = stream;
//         }
//         stream.getTracks().forEach((track) => pc.addTrack(track, stream));
//       })
//       .catch((err) => console.error("Media error:", err));

//     // Remote media
//     pc.ontrack = (event) => {
//       if (remoteVideo.current) {
//         remoteVideo.current.srcObject = event.streams[0];
//       }
//     };

//     // ICE candidate exchange
//     pc.onicecandidate = (event) => {
//       if (event.candidate) {
//         socket.emit("call:ice:1to1", {
//           to: call.peerId,
//           candidate: event.candidate,
//         });
//       }
//     };

//     // Caller creates offer
//     if (!call.incoming) {
//       makeOffer(pc);
//     }

//     // Socket listeners
//     const onOffer = async ({ from, sdp }) => {
//       if (from !== call.peerId) return;
//       await pc.setRemoteDescription(new RTCSessionDescription(sdp));
//       const answer = await pc.createAnswer();
//       await pc.setLocalDescription(answer);
//       socket.emit("call:answer:1to1", { to: from, sdp: answer });
//     };

//     const onAnswer = async ({ from, sdp }) => {
//       if (from !== call.peerId) return;
//       await pc.setRemoteDescription(new RTCSessionDescription(sdp));
//       setConnected(true);
//     };

//     const onIce = async ({ from, candidate }) => {
//       if (from !== call.peerId) return;
//       try {
//         await pc.addIceCandidate(new RTCIceCandidate(candidate));
//       } catch (e) {
//         console.error("ICE error", e);
//       }
//     };

//     const onEnd = ({ from }) => {
//       if (from === call.peerId) {
//         cleanup();
//         onClose();
//       }
//     };

//     socket.on("call:offer:1to1", onOffer);
//     socket.on("call:answer:1to1", onAnswer);
//     socket.on("call:ice:1to1", onIce);
//     socket.on("call:end:1to1", onEnd);

//     return () => {
//       socket.off("call:offer:1to1", onOffer);
//       socket.off("call:answer:1to1", onAnswer);
//       socket.off("call:ice:1to1", onIce);
//       socket.off("call:end:1to1", onEnd);
//       cleanup();
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [call.peerId]);

//   async function makeOffer(pc) {
//     const offer = await pc.createOffer();
//     await pc.setLocalDescription(offer);
//     socket.emit("call:offer:1to1", {
//       to: call.peerId,
//       sdp: offer,
//       media: call.media,
//     });
//   }

//   function endCall() {
//     socket.emit("call:end:1to1", { to: call.peerId });
//     cleanup();
//     onClose();
//   }

//   function cleanup() {
//     if (pcRef.current) {
//       pcRef.current.close();
//       pcRef.current = null;
//     }
//     if (localVideo.current?.srcObject) {
//       localVideo.current.srcObject.getTracks().forEach((t) => t.stop());
//       localVideo.current.srcObject = null;
//     }
//     if (remoteVideo.current?.srcObject) {
//       remoteVideo.current.srcObject.getTracks().forEach((t) => t.stop());
//       remoteVideo.current.srcObject = null;
//     }
//   }

//   return (
//     <div className="modal-overlay">
//       <div className="modal">
//         <h3>
//           {call.media === "video" ? "Video Call" : "Audio Call"}{" "}
//           {connected ? "✅ Connected" : "⏳ Connecting..."}
//         </h3>

//         <div className="video-container">
//           {call.media === "video" && (
//             <>
//               <video ref={localVideo} autoPlay playsInline muted />
//               <video ref={remoteVideo} autoPlay playsInline />
//             </>
//           )}
//           {call.media === "audio" && (
//             <>
//               <audio ref={localVideo} autoPlay muted />
//               <audio ref={remoteVideo} autoPlay />
//               <p>🔊 Audio call in progress...</p>
//             </>
//           )}
//         </div>

//         <div style={{ marginTop: 12 }}>
//           <button className="btn btn-danger" onClick={endCall}>
//             End Call
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }


// frontend/src/components/CallModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { getSocket } from "../socket";

export default function CallModal({ call, me, onClose }) {
  const socket = getSocket();
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const pcRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    console.log("[CallModal] init, peerId=", call.peerId, "incoming=", call.incoming);

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
      ],
    });
    pcRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setConnected(true);
      }
    };

    // Collect local media and add tracks BEFORE creating offer
    navigator.mediaDevices.getUserMedia({ audio: true, video: call.media === "video" })
      .then((stream) => {
        console.log("[Media] got stream", stream);
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }
        stream.getTracks().forEach((t) => {
          pc.addTrack(t, stream);
          console.log("[Media] track added:", t.kind);
        });

        // Only caller creates offer AFTER tracks are attached
        if (!call.incoming) {
          createAndSendOffer(pc);
        }
      })
      .catch((err) => {
        console.error("[Media] getUserMedia error", err);
        alert("Unable to access mic/camera");
        onClose();
      });

    pc.ontrack = (event) => {
      console.log("[WebRTC] ontrack", event.streams);
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[ICE] send candidate", event.candidate);
        socket.emit("call:ice:1to1", { to: call.peerId, candidate: event.candidate });
      }
    };

    const onOffer = async ({ from, sdp }) => {
      if (from !== call.peerId) return;
      console.log("[Socket] offer from", from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("[SDP] sending answer");
        socket.emit("call:answer:1to1", { to: from, sdp: answer });
      } catch (err) {
        console.error("[SDP] handle offer error", err);
      }
    };

    const onAnswer = async ({ from, sdp }) => {
      if (from !== call.peerId) return;
      console.log("[Socket] answer from", from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error("[SDP] set remote answer error", err);
      }
    };

    const onIce = async ({ from, candidate }) => {
      if (from !== call.peerId) return;
      console.log("[Socket] ice from", from, candidate);
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[ICE] add error", err);
      }
    };

    const onEnd = ({ from }) => {
      if (from === call.peerId) { cleanup(); onClose(); }
    };

    socket.on("call:offer:1to1", onOffer);
    socket.on("call:answer:1to1", onAnswer);
    socket.on("call:ice:1to1", onIce);
    socket.on("call:end:1to1", onEnd);

    return () => {
      socket.off("call:offer:1to1", onOffer);
      socket.off("call:answer:1to1", onAnswer);
      socket.off("call:ice:1to1", onIce);
      socket.off("call:end:1to1", onEnd);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.peerId]);

  async function createAndSendOffer(pc) {
    try {
      console.log("[WebRTC] creating offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("[WebRTC] send offer");
      socket.emit("call:offer:1to1", { to: call.peerId, sdp: offer, media: call.media });
    } catch (err) {
      console.error("[WebRTC] create offer error", err);
    }
  }

  function endCall() {
    socket.emit("call:end:1to1", { to: call.peerId });
    cleanup(); onClose();
  }

  function cleanup() {
    console.log("[CallModal] cleanup");
    try { if (pcRef.current) { pcRef.current.close(); pcRef.current = null; } } catch(e){}
    try { if (localVideo.current?.srcObject) { localVideo.current.srcObject.getTracks().forEach(t => t.stop()); localVideo.current.srcObject = null; } } catch(e){}
    try { if (remoteVideo.current?.srcObject) { remoteVideo.current.srcObject.getTracks().forEach(t => t.stop()); remoteVideo.current.srcObject = null; } } catch(e){}
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{call.media === "video" ? "Video Call" : "Audio Call"} {connected ? "✅ Connected" : "⏳ Connecting..."}</h3>
        <div className="video-container">
          {call.media === "video" && (
            <>
              <video ref={localVideo} autoPlay playsInline muted style={{width:120, height:90}} />
              <video ref={remoteVideo} autoPlay playsInline style={{width:320, height:240}} />
            </>
          )}
          {call.media === "audio" && (
            <>
              <audio ref={localVideo} autoPlay muted />
              <audio ref={remoteVideo} autoPlay />
              <p>🔊 Audio call in progress...</p>
            </>
          )}
        </div>
        <div style={{marginTop:12}}>
          <button className="btn btn-danger" onClick={endCall}>End Call</button>
        </div>
      </div>
    </div>
  );
}
