import { useContext } from "react";
import { SoundContext } from "../contexts/SoundContext";
import type { SoundContextType } from "../contexts/SoundContext";

export function useSound(): SoundContextType {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used within SoundProvider");
  return ctx;
}
