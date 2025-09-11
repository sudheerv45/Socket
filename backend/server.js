require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));

app.get('/', (req, res) => res.send('API OK'));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN, methods: ['GET', 'POST'] }
});

require('./socket')(io);

const PORT = process.env.PORT || 5000;
connectDB(process.env.MONGO_URI).then(() => {
  server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
});
