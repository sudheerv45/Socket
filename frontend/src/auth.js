export function getToken() { return localStorage.getItem('token'); }
export function setToken(t) { localStorage.setItem('token', t); }
export function clearToken() { localStorage.removeItem('token'); }
import { getSocket } from './socket';

export function logout() {
  // Remove auth token
  localStorage.removeItem('token');

  // Disconnect socket if connected
  try {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.disconnect();
    }
  } catch (e) {
    console.warn('Socket disconnect failed', e);
  }

  // Hard reload to reset app state
  window.location.reload();
}
