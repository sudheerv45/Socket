const express = require('express');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/:conversationId', auth, async (req, res) => {
  const { conversationId } = req.params;
  const ok = await Conversation.exists({ _id: conversationId, members: req.user.id });
  if (!ok) return res.status(403).json({ message: 'Not a member' });
  const msgs = await Message.find({ conversation: conversationId })
    .sort({ createdAt: 1 })
    .populate('sender', 'name avatar');
  res.json(msgs);
});

module.exports = router;
