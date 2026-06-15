// frontend/src/contexts/AuthContext.tsx
import { createContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { authService, getStoredToken, removeStoredToken } from "../services/authService";

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatarUrl: string;
  createdAt: string;
  lastLogin: string;
  ratings: {
    vsAI: number;
    vsHuman: number;
    peakVsAI: number;
    peakVsHuman: number;
  };
  stats: {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    avgAccuracy: number;
    bestWinStreak: number;
    currentWinStreak: number;
  };
  preferences: {
    boardTheme: string;
    pieceStyle: string;
    soundEnabled: boolean;
    moveHints: boolean;
    autoFlip: boolean;
  };
}

export interface AuthContextType {
  currentUser: UserProfile | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  showAuthModal: boolean;
  setShowAuthModal: (v: boolean) => void;
  handleLoginSuccess: (user: UserProfile) => void;
  handleLogout: () => void;
  refreshUser: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, onPreferencesLoaded }: { children: ReactNode; onPreferencesLoaded?: (prefs: UserProfile["preferences"]) => void }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const user = await authService.getMe();
      setCurrentUser(user);
    } catch {
      removeStoredToken();
      setCurrentUser(null);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    authService.getMe().then((user) => {
      setCurrentUser(user);
      if (user.preferences && onPreferencesLoaded) {
        onPreferencesLoaded(user.preferences);
      }
    }).catch(() => {
      removeStoredToken();
    });
  }, [onPreferencesLoaded]);

  const handleLoginSuccess = useCallback((user: UserProfile) => {
    setCurrentUser(user);
    if (user.preferences && onPreferencesLoaded) {
      onPreferencesLoaded(user.preferences);
    }
  }, [onPreferencesLoaded]);

  const handleLogout = useCallback(() => {
    removeStoredToken();
    setCurrentUser(null);
  }, []);

  return (
    <AuthContext.Provider   value={{
      currentUser,
      setCurrentUser,
      showAuthModal,
      setShowAuthModal,
      handleLoginSuccess,
      handleLogout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
