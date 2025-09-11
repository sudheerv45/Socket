import React, { useState } from 'react';
import { api } from '../api';

export default function Login({ setMode, onLogged }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const client = api();

  async function submit(e){
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await client.post('/auth/login', { email, password });
      onLogged(data.token);
    } catch(err) {
      alert(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="auth">
      <h2>Login</h2>
      <form onSubmit={submit}>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" disabled={loading}>{loading? '...' : 'Login'}</button>
      </form>
      <p>New here? <button className="btn" onClick={()=>setMode('register')}>Register</button></p>
    </div>
  );
}
