// frontend/src/contexts/ThemeContext.tsx
import { createContext, useState, useEffect, type ReactNode } from "react";

export interface ThemeContextType {
  appTheme: "dark" | "light";
  setAppTheme: (t: "dark" | "light") => void;
  boardTheme: string;
  setBoardTheme: (t: string) => void;
  pieceStyle: string;
  setPieceStyle: (s: string) => void;
  showMoveHints: boolean;
  setShowMoveHints: (v: boolean) => void;
  toggleMoveHints: () => void;
  autoFlip: boolean;
  setAutoFlip: (v: boolean) => void;
  toggleAutoFlip: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeContextType | null>(null);

function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.warn(`localStorage quota exceeded — could not save "${key}".`);
    }
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appTheme, setAppTheme] = useState<"dark" | "light">("dark");
  const [boardTheme, setBoardTheme] = useState(() => localStorage.getItem("kg_board_theme") || "wood");
  const [pieceStyle, setPieceStyle] = useState(() => localStorage.getItem("kg_piece_style") || "neo");
  const [showMoveHints, setShowMoveHints] = useState(() => localStorage.getItem("kg_show_move_hints") !== "false");
  const [autoFlip, setAutoFlip] = useState(() => localStorage.getItem("kg_auto_flip") === "true");

  useEffect(() => { safeLocalStorageSet("kg_board_theme", boardTheme); }, [boardTheme]);
  useEffect(() => { safeLocalStorageSet("kg_piece_style", pieceStyle); }, [pieceStyle]);
  useEffect(() => { safeLocalStorageSet("kg_show_move_hints", String(showMoveHints)); }, [showMoveHints]);
  useEffect(() => { safeLocalStorageSet("kg_auto_flip", String(autoFlip)); }, [autoFlip]);

  const toggleMoveHints = () => setShowMoveHints(prev => !prev);
  const toggleAutoFlip = () => setAutoFlip(prev => !prev);

  return (
    <ThemeContext.Provider value={{
      appTheme, setAppTheme,
      boardTheme, setBoardTheme,
      pieceStyle, setPieceStyle,
      showMoveHints, setShowMoveHints, toggleMoveHints,
      autoFlip, setAutoFlip, toggleAutoFlip,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}
