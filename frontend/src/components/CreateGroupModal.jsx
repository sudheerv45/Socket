// frontend/src/components/CreateGroupModal.jsx
import React, { useState } from "react";
import { api } from "../api";

export default function CreateGroupModal({ me, users, onClose, onCreated }) {
    const [groupName, setGroupName] = useState("");
    const [selected, setSelected] = useState({});
    const client = api(() => localStorage.getItem("token"));

    async function createGroup() {
        const memberIds = Object.entries(selected)
            .filter(([, v]) => v)
            .map(([k]) => k);

        if (!groupName.trim() || memberIds.length < 2) {
            alert("Pick a group name and at least 2 members");
            return;
        }

        const { data } = await client.post("/conversations/group", {
            name: groupName,
            memberIds,
        });

        setGroupName("");
        setSelected({});
        onCreated(data); // refresh + open convo
        onClose();
    }

    return (
        <div
            className="modal-backdrop"
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
            }}
        >
            <div
                className="modal"
                style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: 32,
                    width: 380,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <h2
                    style={{
                        marginBottom: 18,
                        textAlign: "center",
                        fontWeight: 600,
                        fontSize: 22,
                    }}
                >
                    Create Group
                </h2>

                {/* Group name */}
                <input
                    placeholder="Group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "12px 10px",
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        marginBottom: 18,
                        fontSize: 16,
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />

                {/* Members */}
                <div
                    style={{
                        maxHeight: 180,
                        overflow: "auto",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 18,
                        background: "#f9fafb",
                    }}
                >
                    {users
                        .filter((u) => u._id !== me._id) // exclude self
                        .map((u) => (
                            <label
                                key={u._id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 0",
                                    fontSize: 15,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={!!selected[u._id]}
                                    onChange={(e) =>
                                        setSelected((s) => ({ ...s, [u._id]: e.target.checked }))
                                    }
                                    style={{ accentColor: "#2563eb", width: 18, height: 18 }}
                                />
                                <span>{u.name}</span>
                            </label>
                        ))}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                    <button
                        className="btn"
                        style={{
                            background: "#f3f4f6",
                            color: "#374151",
                            borderRadius: 8,
                            padding: "8px 18px",
                            fontWeight: 500,
                            border: "none",
                            cursor: "pointer",
                        }}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn"
                        style={{
                            background: "#2563eb",
                            color: "#fff",
                            borderRadius: 8,
                            padding: "8px 18px",
                            fontWeight: 500,
                            border: "none",
                            cursor: "pointer",
                        }}
                        onClick={createGroup}
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>
    );
}
