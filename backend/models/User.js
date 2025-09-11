const { Schema, model } = require('mongoose');

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    avatar: { type: String },
    status: { type: String, default: 'Hey there! I am using Chat.' },
    online: { type: Boolean, default: false },
    lastSeen: { type: Date }
  },
  { timestamps: true }
);

module.exports = model('User', UserSchema);
