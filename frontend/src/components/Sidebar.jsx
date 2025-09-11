
// import React, { useMemo, useState } from "react";
// import ConversationItem from "./ConversationItem.jsx";
// import { api } from "../api";
// import { logout } from "../auth";
// import CreateGroupModal from "./CreateGroupModal.jsx"; // <-- Add this import

// export default function Sidebar({
//   me,
//   users,
//   conversations,
//   onRefresh,
//   onPick,
//   active,
// }) {
//   const [q, setQ] = useState("");
//   const [showGroupModal, setShowGroupModal] = useState(false); // <-- Add modal state
//   const client = useMemo(() => api(() => localStorage.getItem("token")), []);

//   // 🔹 Split conversations
//   const personalConvos = conversations.filter(
//     (c) => !c.isGroup && (c.name || (c.members || []).find((m) => m._id !== me._id)?.name || "")
//       .toLowerCase()
//       .includes(q.toLowerCase())
//   );

//   const groupConvos = conversations.filter(
//     (c) => c.isGroup && (c.name || "").toLowerCase().includes(q.toLowerCase())
//   );

//   const filteredUsers = users.filter((u) =>
//     u.name.toLowerCase().includes(q.toLowerCase())
//   );

//   async function startDM(userId) {
//     const { data } = await client.post("/conversations/dm", { userId });
//     await onRefresh();
//     onPick(data);
//   }

//   return (
//     <div className="sidebar">
//       {/* Header */}
//       <div className="header">
//         <strong>{me?.name}</strong>
//         <div style={{ display: "flex", gap: 8 }}>
//           <button className="btn" onClick={onRefresh}>
//             Refresh
//           </button>
//           <button className="btn" onClick={logout}>
//             Logout
//           </button>
//         </div>
//       </div>

//       {/* Search */}
//       <div className="search">
//         <input
//           placeholder="Search"
//           value={q}
//           onChange={(e) => setQ(e.target.value)}
//           style={{
//             width: "100%",
//             padding: 10,
//             border: "1px solid #e5e7eb",
//             borderRadius: 8,
//           }}
//         />
//       </div>

//       <div className="list">
//         {/* Groups */}
//         <div style={{ padding: "6px 12px", color: "#6b7280", fontSize: 12 }}>
//           Groups
//         </div>
//         {groupConvos.map((c) => (
//           <ConversationItem
//             key={c._id}
//             convo={c}
//             me={me}
//             active={active}
//             onClick={() => onPick(c)}
//           />
//         ))}

//         {/* Personal Chats */}
//         <div
//           style={{
//             padding: "6px 12px",
//             color: "#6b7280",
//             fontSize: 12,
//             marginTop: 8,
//           }}
//         >
//           Personal Chats
//         </div>
//         {personalConvos.map((c) => (
//           <ConversationItem
//             key={c._id}
//             convo={c}
//             me={me}
//             active={active}
//             onClick={() => onPick(c)}
//           />
//         ))}

//         {/* Start DM */}
//         <div
//           style={{
//             padding: "6px 12px",
//             color: "#6b7280",
//             fontSize: 12,
//             marginTop: 8,
//           }}
//         >
//           Start a DM
//         </div>
//         {filteredUsers.map((u) => (
//           <div
//             key={u._id}
//             className="item"
//             onClick={() => startDM(u._id)}
//             style={{ cursor: "pointer" }}
//           >
//             <span className={`badge ${u.online ? "online" : "offline"}`}></span>
//             <div>{u.name}</div>
//           </div>
//         ))}

//         {/* 🔹 Just a button now */}
//         <div style={{ padding: "12px" }}>
//           <button className="btn" onClick={() => setShowGroupModal(true)}>
//             ➕ Create Group
//           </button>
//         </div>
//       </div>

//       {/* Modal */}
//       {showGroupModal && (
//         <CreateGroupModal
//           me={me}
//           users={users}
//           onClose={() => setShowGroupModal(false)}
//           onCreated={async (newGroup) => {
//             await onRefresh();
//             onPick(newGroup);
//           }}
//         />
//       )}
//     </div>
//   );
// }


import React, { useMemo, useState } from "react";
import ConversationItem from "./ConversationItem.jsx";
import { api } from "../api";
import { logout } from "../auth";
import CreateGroupModal from "./CreateGroupModal.jsx";

export default function Sidebar({
  me,
  users,
  conversations,
  onRefresh,
  onPick,
  active,
}) {
  const [q, setQ] = useState("");
  const [showGroupModal, setShowGroupModal] = useState(false);
  const client = useMemo(() => api(() => localStorage.getItem("token")), []);

  // Split conversations
  const personalConvos = conversations.filter(
    (c) =>
      !c.isGroup &&
      (c.name ||
        (c.members || []).find((m) => m._id !== me._id)?.name ||
        "")
        .toLowerCase()
        .includes(q.toLowerCase())
  );

  const groupConvos = conversations.filter(
    (c) => c.isGroup && (c.name || "").toLowerCase().includes(q.toLowerCase())
  );

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(q.toLowerCase())
  );

  async function startDM(userId) {
    const { data } = await client.post("/conversations/dm", { userId });
    await onRefresh();
    onPick(data);
  }

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="header">
        <strong>{me?.name}</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onRefresh}>
            Refresh
          </button>
          <button className="btn" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search">
        <input
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        />
      </div>

      <div className="list">
        {/* Groups */}
        <div style={{ padding: "6px 12px", color: "#6b7280", fontSize: 12 }}>
          Groups
        </div>
        {groupConvos.map((c) => (
          <ConversationItem
            key={c._id}
            convo={c}
            me={me}
            active={active}
            onClick={() => onPick(c)}
          />
        ))}

        {/* Personal Chats */}
        <div
          style={{
            padding: "6px 12px",
            color: "#6b7280",
            fontSize: 12,
            marginTop: 8,
          }}
        >
          Personal Chats
        </div>
        {personalConvos.map((c) => (
          <ConversationItem
            key={c._id}
            convo={c}
            me={me}
            active={active}
            onClick={() => onPick(c)}
          />
        ))}

        {/* Start DM */}
        <div
          style={{
            padding: "6px 12px",
            color: "#6b7280",
            fontSize: 12,
            marginTop: 8,
          }}
        >
          Start a DM
        </div>
        {filteredUsers.map((u) => (
          <div
            key={u._id}
            className="item"
            onClick={() => startDM(u._id)}
            style={{ cursor: "pointer" }}
          >
            <span className={`badge ${u.online ? "online" : "offline"}`}></span>
            <div>{u.name}</div>
          </div>
        ))}

        {/* Create Group Button */}
        <div style={{ padding: "12px" }}>
          <button className="btn" onClick={() => setShowGroupModal(true)}>
            ➕ Create Group
          </button>
        </div>
      </div>

      {/* Modal */}
      {showGroupModal && (
        <CreateGroupModal
          me={me}
          users={users}
          onClose={() => setShowGroupModal(false)}
          onCreated={async (newGroup) => {
            await onRefresh();
            onPick(newGroup);
          }}
        />
      )}
    </div>
  );
}