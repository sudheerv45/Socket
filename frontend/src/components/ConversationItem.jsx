import React from 'react';

export default function ConversationItem({ convo, me, onClick, active }){
  const other = !convo.isGroup && (convo.members||[]).find(m=>m._id!==me._id);
  const title = convo.isGroup ? (convo.name||'Group') : (other?.name||'User');
  const isActive = active?._id === convo._id;
  return (
    <div className="item" onClick={onClick} style={{background:isActive?'#eef2ff':undefined}}>
      <span className={`badge ${other?.online? 'online':'offline'}`}></span>
      <div>{title}</div>
    </div>
  );
}
