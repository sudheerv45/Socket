const { Schema, model, Types } = require('mongoose');

const MessageSchema = new Schema(
  {
    conversation: { type: Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    body: { type: String },
    attachments: [{ url: String, name: String }],
    readBy: [{ type: Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

module.exports = model('Message', MessageSchema);
