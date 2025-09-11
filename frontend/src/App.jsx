import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { getToken, setToken, clearToken } from './auth';
import { getSocket } from './socket';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import CallModal from './components/CallModal.jsx';

export default function App() {
  const [mode, setMode] = useState('login');
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [call, setCall] = useState(null);

  const apiClient = useMemo(() => api(() => getToken()), []);

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    apiClient.get('/auth/me').then(({ data }) => {
      setMe(data);
      setMode('app');
      refresh();
      const s = getSocket();
      s.on('presence:update', (p) => {
        setUsers((prev) => prev.map(u => u._id === p.userId ? { ...u, online: p.online, lastSeen: p.lastSeen } : u));
      });
      s.on('message:new', (msg) => {
        if (active && msg.conversation === active._id) {
          setActive(a => ({ ...a, _ts: Date.now() }));
        }
      });
      s.on('typing', ({ conversationId, userId, typing }) => {
        if (active && active._id === conversationId) {
          setActive(a => ({ ...a, typing: typing ? userId : null }));
        }
      });
      s.on('call:offer', ({ from, sdp, media }) => {
        setCall({ incoming: true, from, sdp, media, conversationId: active?._id });
      });
      s.on('call:answer', ({ sdp }) => {
        window.__webrtcAnswer && window.__webrtcAnswer(sdp);
      });
      s.on('call:ice', ({ candidate }) => {
        window.__webrtcIce && window.__webrtcIce(candidate);
      });
      s.on('call:end', () => {
        window.__webrtcEnd && window.__webrtcEnd();
        setCall(null);
      });
    }).catch(() => { clearToken(); setMode('login'); });
  }, []);

  async function refresh() {
    const [us, convos] = await Promise.all([
      apiClient.get('/users').then(r => r.data),
      apiClient.get('/conversations').then(r => r.data),
    ]);
    setUsers(us);
    setConversations(convos);
  }

  if (mode === 'login') return <Login setMode={setMode} onLogged={(t)=>{ setToken(t); setMode('app'); location.reload(); }} />;
  if (mode === 'register') return <Register setMode={setMode} onRegistered={(t)=>{ setToken(t); setMode('app'); location.reload(); }} />;

  return (
    <div className="app">
      <Sidebar me={me} users={users} conversations={conversations} onRefresh={refresh} onPick={setActive} active={active} />
      <ChatWindow me={me} active={active} onNeedAuth={()=>{ clearToken(); location.reload(); }} onCall={(opts)=> setCall(opts)} />
      {call && <CallModal call={call} onClose={()=> setCall(null)} me={me} />}
    </div>
  );
}
