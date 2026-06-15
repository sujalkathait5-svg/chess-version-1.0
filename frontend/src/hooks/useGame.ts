import { useContext } from "react";
import { GameContext } from "../contexts/GameContext";
import type { GameContextType } from "../contexts/GameContext";

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
