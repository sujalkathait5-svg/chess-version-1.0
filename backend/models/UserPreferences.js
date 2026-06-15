// backend/models/UserPreferences.js
const mongoose = require('mongoose');

const UserPreferencesSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  boardTheme: { type: String, default: 'wood' },
  pieceStyle: { type: String, default: 'neo' },
  soundEnabled: { type: Boolean, default: true },
  moveHints: { type: Boolean, default: true },
  autoFlip: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

UserPreferencesSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UserPreferences', UserPreferencesSchema);
