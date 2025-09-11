import React, { useState } from 'react';
import { api } from '../api';

export default function Register({ setMode, onRegistered }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const client = api();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await client.post('/auth/register', { name, email, password });
      onRegistered(data.token);
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="auth">
      <h2>Register</h2>
      <form onSubmit={submit}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button className="btn" disabled={loading}>{loading ? '...' : 'Create account'}</button>
      </form>
      <p>Have an account? <button className="btn" onClick={() => setMode('login')}>Login</button></p>
    </div>
  );
}
