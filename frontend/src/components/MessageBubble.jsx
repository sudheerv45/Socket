import React from 'react';

export default function MessageBubble({ meId, msg }){
  const mine = msg.sender?._id === meId || msg.sender === meId;
  return (
    <div className={`msg ${mine? 'right':'left'}`}>
      {msg.type === 'text' ? msg.body : <em>{msg.type} message</em>}
    </div>
  );
}
