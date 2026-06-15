// frontend/src/contexts/SoundContext.tsx
import { createContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { MoveType } from "../types/moveTypes";
import { SoundManager } from "../utils/soundManager";

export const SOUND_EVENT_MAP: Record<string, string> = {
  move: "/sounds/move.mp3",
  capture: "/sounds/capture.mp3",
  castle: "/sounds/castle.mp3",
  check: "/sounds/check.mp3",
  checkmate: "/sounds/checkmate.mp3",
  promote: "/sounds/promote.mp3",
  gameStart: "/sounds/game-start.mp3",
  gameEnd: "/sounds/game-end.mp3",
  win: "/sounds/win.mp3",
  lose: "/sounds/lose.mp3",
  draw: "/sounds/draw.mp3",
  notification: "/sounds/notification.mp3",
  premove: "/sounds/premove.mp3",
  illegal: "/sounds/illegal.mp3",
  lowTime: "/sounds/low-time.mp3",
  puzzleCorrect: "/sounds/puzzle-correct.mp3",
  puzzleIncorrect: "/sounds/puzzle-incorrect.mp3",
  puzzleComplete: "/sounds/puzzle-complete.mp3",
};

export interface SoundContextType {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  toggleSound: () => void;
  volume: number;
  setVolume: (v: number) => void;
  playSound: (eventName: string) => void;
  playMoveSound: (moveTypeSet?: Set<MoveType>) => void;
  playIncorrectMoveSound: () => void;
  soundManagerRef: React.MutableRefObject<SoundManager | null>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const SoundContext = createContext<SoundContextType | null>(null);

function safeLocalStorageSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("kg_sound_enabled") !== "false");
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem("kg_sound_volume");
    return saved !== null ? parseFloat(saved) : 0.7;
  });
  const soundManagerRef = useRef<SoundManager | null>(null);

  useEffect(() => {
    soundManagerRef.current = new SoundManager(!soundEnabled, volume);
    return () => {
      soundManagerRef.current = null;
    };
  }, []);

  // Preload and unlock audio
  useEffect(() => {
    const soundSrcs = Object.values(SOUND_EVENT_MAP);
    soundManagerRef.current?.preload(soundSrcs);

    const handleInteraction = () => {
      soundManagerRef.current?.unlock().then(() => {
        if (soundManagerRef.current?.isUnlocked()) {
          cleanup();
        }
      });
    };

    const cleanup = () => {
      document.removeEventListener("touchstart", handleInteraction);
      document.removeEventListener("touchend", handleInteraction);
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };

    if (!soundManagerRef.current?.isUnlocked()) {
      document.addEventListener("touchstart", handleInteraction);
      document.addEventListener("touchend", handleInteraction);
      document.addEventListener("click", handleInteraction);
      document.addEventListener("keydown", handleInteraction);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        soundManagerRef.current?.unlock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cleanup();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // Sync soundEnabled to soundManager
  useEffect(() => {
    soundManagerRef.current?.setMuted(!soundEnabled);
    safeLocalStorageSet("kg_sound_enabled", String(soundEnabled));
  }, [soundEnabled]);

  // Sync volume to soundManager
  useEffect(() => {
    soundManagerRef.current?.setVolume(volume);
    safeLocalStorageSet("kg_sound_volume", String(volume));
  }, [volume]);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
  }, []);

  const playSound = useCallback((eventName: string) => {
    if (!soundEnabled) return;
    const src = SOUND_EVENT_MAP[eventName];
    if (src) {
      soundManagerRef.current?.play(src);
    }
  }, [soundEnabled]);

  const playMoveSound = useCallback((moveTypeSet?: Set<MoveType>) => {
    let eventName = "move";
    if (moveTypeSet) {
      if (moveTypeSet.has(MoveType.CheckMate)) eventName = "checkmate";
      else if (moveTypeSet.has(MoveType.Check)) eventName = "check";
      else if (moveTypeSet.has(MoveType.Promotion)) eventName = "promote";
      else if (moveTypeSet.has(MoveType.Castling)) eventName = "castle";
      else if (moveTypeSet.has(MoveType.Capture)) eventName = "capture";
    }
    playSound(eventName);
  }, [playSound]);

  const playIncorrectMoveSound = useCallback(() => {
    playSound("illegal");
  }, [playSound]);

  return (
    <SoundContext.Provider value={{
      soundEnabled,
      setSoundEnabled,
      toggleSound,
      volume,
      setVolume,
      playSound,
      playMoveSound,
      playIncorrectMoveSound,
      soundManagerRef,
    }}>
      {children}
    </SoundContext.Provider>
  );
}
