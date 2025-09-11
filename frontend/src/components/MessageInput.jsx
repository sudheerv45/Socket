import React, { useState } from 'react';

export default function MessageInput({ onSend, onTyping }){
  const [text, setText] = useState('');

  function submit(e){
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
    onTyping(false);
  }

  return (
    <form className="input" onSubmit={submit}>
      <input value={text} onChange={e=>{ setText(e.target.value); onTyping(true); }} onBlur={()=>onTyping(false)} placeholder="Type a message" />
      <button className="btn" type="submit">Send</button>
    </form>
  );
}
