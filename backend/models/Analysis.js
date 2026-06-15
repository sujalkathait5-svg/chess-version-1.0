// backend/models/Analysis.js
const mongoose = require('mongoose');

const MoveAnalysisSchema = new mongoose.Schema({
  moveIndex: { type: Number, required: true },
  san: { type: String, required: true },
  fen: { type: String, required: true },
  evalBefore: { type: Number },
  evalAfter: { type: Number },
  bestMove: { type: String },
  bestMoveEval: { type: Number },
  continuation: [String],
  classification: { type: String, required: true },
  cpLoss: { type: Number },
  isMate: { type: Boolean, default: false },
  mateIn: { type: Number, default: null }
}, { _id: false });

const ClassificationCountsSchema = new mongoose.Schema({
  brilliant: { type: Number, default: 0 },
  great: { type: Number, default: 0 },
  best: { type: Number, default: 0 },
  excellent: { type: Number, default: 0 },
  good: { type: Number, default: 0 },
  book: { type: Number, default: 0 },
  inaccuracy: { type: Number, default: 0 },
  mistake: { type: Number, default: 0 },
  miss: { type: Number, default: 0 },
  blunder: { type: Number, default: 0 }
}, { _id: false });

const AnalysisSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true, index: true },
  analyzedAt: { type: Date, default: Date.now },
  engineVersion: { type: String, default: 'stockfish-18' },
  whiteAccuracy: { type: Number, required: true },
  blackAccuracy: { type: Number, required: true },
  whiteEstimatedRating: { type: Number },
  blackEstimatedRating: { type: Number },
  moves: [MoveAnalysisSchema],
  classificationCounts: {
    white: { type: ClassificationCountsSchema, required: true },
    black: { type: ClassificationCountsSchema, required: true }
  }
});

module.exports = mongoose.model('Analysis', AnalysisSchema);
