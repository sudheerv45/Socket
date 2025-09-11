
// // frontend/src/components/IncomingCallPopup.jsx
// import React, { useState } from "react";
// import CallModal from "./CallModal";

// export default function IncomingCallPopup({ socket, incoming, onDismiss, onAccept }) {
//   const [accepted, setAccepted] = useState(false);
//   if (!incoming) return null;
//   const { from, media } = incoming;

//   const handleAccept = () => {
//     socket.emit("call:accept", { to: from });
//     setAccepted(true);
//     if (onAccept) onAccept();
//   };

//   const handleReject = () => {
//     socket.emit("call:reject", { to: from });
//     onDismiss();
//   };

//   return (
//     <>
//       {!accepted && (
//         <div className="incoming-call-popup">
//           <div>📞 Incoming {media} call from <b>{from}</b></div>
//           <div style={{marginTop:8}}>
//             <button onClick={handleAccept}>Accept</button>
//             <button onClick={handleReject}>Reject</button>
//           </div>
//         </div>
//       )}
//       {accepted && (
//         <CallModal call={{ peerId: from, media, incoming: true }} onClose={onDismiss} />
//       )}
//     </>
//   );
// }


// import React from "react";

// export default function IncomingCallPopup({
//   from,
//   media,
//   isGroup = false,
//   groupName,
//   onAccept,
//   onReject,
// }) {
//   return (
//     <div className="incoming-call-popup">
//       <div className="popup-content">
//         <h3>
//           {isGroup
//             ? `📢 Incoming ${media} group call in ${groupName}`
//             : `📞 Incoming ${media} call from ${from}`}
//         </h3>

//         <div className="popup-actions">
//           <button className="btn btn-success" onClick={onAccept}>
//             ✅ Accept
//           </button>
//           <button className="btn btn-danger" onClick={onReject}>
//             ❌ Reject
//           </button>
//         </div>
//       </div>

//       <style jsx>{`
//         .incoming-call-popup {
//           position: fixed;
//           bottom: 20px;
//           right: 20px;
//           background: white;
//           border: 1px solid #ccc;
//           border-radius: 12px;
//           box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
//           padding: 16px;
//           z-index: 1000;
//           max-width: 300px;
//         }
//         .popup-content h3 {
//           margin: 0 0 12px;
//           font-size: 16px;
//           font-weight: 600;
//         }
//         .popup-actions {
//           display: flex;
//           justify-content: space-between;
//           gap: 8px;
//         }
//         .btn {
//           flex: 1;
//           padding: 8px;
//           border: none;
//           border-radius: 6px;
//           cursor: pointer;
//         }
//         .btn-success {
//           background: #28a745;
//           color: white;
//         }
//         .btn-danger {
//           background: #dc3545;
//           color: white;
//         }
//       `}</style>
//     </div>
//   );
// }

// // frontend/src/components/IncomingCallModal.jsx
// import React from "react";

// export default function IncomingCallModal({ socket, incoming, onDismiss, onAccept, onReject }) {
//   if (!incoming) return null;

//   let title = "";
//   if (incoming.isGroup) {
//     title = `📞 Group ${incoming.groupName || "Group"} is calling you (${incoming.media})`;
//   } else {
//     title = `📞 ${incoming.fromName || incoming.from} is calling you (${incoming.media})`;
//   }


//   return (
//     <div className="incoming-call-modal">
//       <div className="modal-content">
//         <h3>{title}</h3>
//         <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
//           <button className="btn btn-success" onClick={onAccept}>
//             Accept
//           </button>
//           <button className="btn btn-danger" onClick={onReject}>
//             Reject
//           </button>
//           <button className="btn" onClick={onDismiss}>
//             Dismiss
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }
// frontend/src/components/IncomingCallPopup.jsx
import React from "react";

export default function IncomingCallPopup({ incoming, onAccept, onReject, onDismiss }) {
  if (!incoming) return null;

  // ✅ Show caller info differently for group vs one-to-one
  const title = incoming.isGroup
    ? `📞 Group "${incoming.groupName || "Unknown Group"}" is calling you`
    : `📞 ${incoming.fromName || incoming.from} is calling you`;

  return (
    <div
      className="incoming-call-popup"
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        background: "#fff",
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        zIndex: 1000,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <strong>{title}</strong>
        <div style={{ fontSize: 12, color: "#666" }}>
          ({incoming.media === "video" ? "Video" : "Audio"} call)
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          className="btn btn-accept"
          onClick={onAccept}
          style={{ background: "green", color: "white", padding: "6px 12px" }}
        >
          Accept
        </button>
        <button
          className="btn btn-reject"
          onClick={onReject}
          style={{ background: "red", color: "white", padding: "6px 12px" }}
        >
          Reject
        </button>
        <button
          className="btn btn-dismiss"
          onClick={onDismiss}
          style={{ background: "#aaa", color: "white", padding: "6px 12px" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

