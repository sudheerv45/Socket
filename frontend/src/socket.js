import { io } from 'socket.io-client';
import { getToken } from './auth';
import { API_BASE } from './api';

let socket;
export function getSocket() {
  if (!socket) {
    socket = io(API_BASE, { auth: { token: getToken() } });
  }
  return socket;
}
