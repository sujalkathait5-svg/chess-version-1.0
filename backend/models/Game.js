// backend/models/Game.js
const mongoose = require('mongoose');

const MoveSchema = new mongoose.Schema({
  san: { type: String, required: true },
  uci: { type: String },
  fen: { type: String, required: true },
  clock: { type: Number }
}, { _id: false });

const GameSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true, index: true },
  whitePlayerId: { type: String, required: true },
  blackPlayerId: { type: String, required: true },
  mode: { type: String, required: true, enum: ['vs_ai', 'vs_friend', 'pass_and_play'] },
  timeControl: {
    base: { type: Number },
    increment: { type: Number }
  },
  result: { type: String, required: true },
  termination: { type: String },
  opening: {
    eco: { type: String },
    name: { type: String },
    ply: { type: Number }
  },
  moves: [MoveSchema],
  pgn: { type: String },
  totalMoves: { type: Number },
  duration: { type: Number },
  playedAt: { type: Date, default: Date.now, index: true },
  isFavourite: { type: Boolean, default: false },
  eloChange: {
    white: { type: Number, default: 0 },
    black: { type: Number, default: 0 }
  }
});

// Compound indexes to optimize user history dashboard loading
GameSchema.index({ whitePlayerId: 1, playedAt: -1 });
GameSchema.index({ blackPlayerId: 1, playedAt: -1 });

module.exports = mongoose.model('Game', GameSchema);
