import type { MoveClassification } from "../chess-logic/models";

export const classificationMetadata: Record<MoveClassification, { label: string; color: string; icon: string; iconBg: string }> = {
  brilliant: { label: "Brilliant", color: "#06b6d4", icon: "!!", iconBg: "rgba(6, 182, 212, 0.15)" },
  great: { label: "Great", color: "#3b82f6", icon: "!", iconBg: "rgba(59, 130, 246, 0.15)" },
  best: { label: "Best", color: "#10b981", icon: "★", iconBg: "rgba(16, 185, 129, 0.15)" },
  excellent: { label: "Excellent", color: "#10b981", icon: "✓", iconBg: "rgba(16, 185, 129, 0.1)" },
  good: { label: "Good", color: "#84cc16", icon: "✓", iconBg: "rgba(132, 204, 22, 0.1)" },
  book: { label: "Book", color: "#d97706", icon: "📖", iconBg: "rgba(217, 119, 6, 0.1)" },
  inaccuracy: { label: "Inaccuracy", color: "#eab308", icon: "?", iconBg: "rgba(234, 179, 8, 0.15)" },
  mistake: { label: "Mistake", color: "#f97316", icon: "?", iconBg: "rgba(249, 115, 22, 0.15)" },
  miss: { label: "Miss", color: "#ef4444", icon: "✖", iconBg: "rgba(239, 68, 68, 0.15)" },
  blunder: { label: "Blunder", color: "#ef4444", icon: "??", iconBg: "rgba(239, 68, 68, 0.25)" },
};
