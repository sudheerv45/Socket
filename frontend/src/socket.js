// import { io } from 'socket.io-client';
// import { getToken } from './auth';
// import { API_BASE } from './api';

// let socket;
// export function getSocket() {
//   if (!socket) {
//     socket = io(API_BASE, { auth: { token: getToken() } });
//   }
//   return socket;
// }


import { io } from "socket.io-client";
import { getToken } from "./auth";

// Use environment variable if set (Render), otherwise fallback to relative path (local with Vite proxy)
const API_BASE = import.meta.env.VITE_API_URL || "";

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(API_BASE, {
      auth: { token: getToken() },
      withCredentials: true,
    });
  }
  return socket;
}
