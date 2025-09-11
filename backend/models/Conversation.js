const { Schema, model, Types } = require('mongoose');

const ConversationSchema = new Schema(
  {
    isGroup: { type: Boolean, default: false },
    name: { type: String },
    members: [{ type: Types.ObjectId, ref: 'User' }],
    admins: [{ type: Types.ObjectId, ref: 'User' }],
    lastMessageAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = model('Conversation', ConversationSchema);
