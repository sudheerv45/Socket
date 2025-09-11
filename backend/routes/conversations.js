const express = require('express');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');

const router = express.Router();

router.post('/dm', auth, async (req, res) => {
  const { userId } = req.body;
  const me = req.user.id;
  if (!userId) return res.status(400).json({ message: 'userId required' });
  let convo = await Conversation.findOne({
    isGroup: false,
    members: { $all: [me, userId], $size: 2 }
  });
  if (!convo) {
    convo = await Conversation.create({ members: [me, userId], isGroup: false });
  }
  res.json(convo);
});

router.post('/group', auth, async (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !Array.isArray(memberIds) || memberIds.length < 2) {
    return res.status(400).json({ message: 'Name and at least 2 members' });
  }
  const members = Array.from(new Set([req.user.id, ...memberIds]));
  const convo = await Conversation.create({ isGroup: true, name, members, admins: [req.user.id] });
  res.json(convo);
});

router.get('/', auth, async (req, res) => {
  const list = await Conversation.find({ members: req.user.id })
    .sort({ updatedAt: -1 })
    .populate('members', 'name avatar online lastSeen');
  res.json(list);
});

module.exports = router;
