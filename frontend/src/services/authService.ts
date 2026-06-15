// frontend/src/services/authService.ts

const API_BASE = "/api";

// ── Token storage ─────────────────────────────────────────────────────────
export function getStoredToken(): string | null {
  return localStorage.getItem("kg_auth_token");
}

export function setStoredToken(token: string) {
  try {
    localStorage.setItem("kg_auth_token", token);
  } catch {
    // Ignore
  }
}

export function removeStoredToken() {
  localStorage.removeItem("kg_user");
  localStorage.removeItem("kg_auth_token");
}

export function getStoredUser() {
  try {
    const user = localStorage.getItem("kg_user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: any) {
  try {
    localStorage.setItem("kg_user", JSON.stringify(user));
  } catch {
    // Storage full or unavailable
  }
}

// ── Generic fetch wrapper with auth header ────────────────────────────────
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

export const authService = {
  // ── Authentication ────────────────────────────────────────────────────
  async login(username: string, password: string, rememberMe: boolean = false) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, rememberMe }),
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    if (data.user) setStoredUser(data.user);
    return data.user;
  },

  async register(username: string, password: string) {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    if (data.user) setStoredUser(data.user);
    return data.user;
  },

  async checkUsername(username: string) {
    const data = await apiFetch(`/auth/check-username?username=${encodeURIComponent(username)}`, {
      method: "GET"
    });
    return data.available;
  },

  async getMe() {
    const data = await apiFetch("/auth/me");
    if (data.user) setStoredUser(data.user);
    return data.user;
  },

  isAuthenticated() {
    return !!getStoredUser();
  },

  async logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    removeStoredToken();
  },

  getCurrentUser() {
    return getStoredUser();
  },

  async updateAvatar(avatarUrl: string) {
    const data = await apiFetch("/auth/avatar", {
      method: "PUT",
      body: JSON.stringify({ avatarUrl }),
    });
    return data.avatarUrl as string;
  },

  // ── Games ────────────────────────────────────────────────────────────
  async getGames() {
    const data = await apiFetch("/games");
    return data.games;
  },

  async getGame(gameId: string) {
    const data = await apiFetch(`/games/${gameId}`);
    return data.game;
  },

  async saveGame(gameData: object) {
    return await apiFetch("/games", {
      method: "POST",
      body: JSON.stringify(gameData),
    });
  },

  async saveAnalysis(gameId: string, analysisData: object) {
    return await apiFetch(`/games/${gameId}/analysis`, {
      method: "POST",
      body: JSON.stringify(analysisData),
    });
  },

  async getGameAnalysis(gameId: string) {
    const data = await apiFetch(`/games/${gameId}/analysis`);
    return data.analysis;
  },

  /**
   * Bulk-migrate localStorage games to the cloud.
   * Endpoint deduplicates by gameId — calling twice with the same data is safe.
   * Original playedAt timestamps are preserved.
   */
  async migrateLocalGames(games: object[]) {
    return await apiFetch("/games/migrate", {
      method: "POST",
      body: JSON.stringify({ games }),
    });
  },

  // ── Preferences ──────────────────────────────────────────────────────
  async getPreferences() {
    const data = await apiFetch("/preferences");
    return data.preferences;
  },

  async savePreferences(prefData: {
    boardTheme?: string;
    pieceStyle?: string;
    soundEnabled?: boolean;
    moveHints?: boolean;
    autoFlip?: boolean;
  }) {
    const data = await apiFetch("/preferences", {
      method: "POST",
      body: JSON.stringify(prefData),
    });
    return data.preferences;
  },

  // ── Leaderboard ──────────────────────────────────────────────────────
  async getLeaderboard() {
    const data = await apiFetch("/leaderboard");
    return data.leaderboard;
  },

  // ── Friends & Social ─────────────────────────────────────────────────
  async getFriends() {
    const data = await apiFetch("/friends");
    return {
      friends: data.friends || [],
      incoming: data.incoming || [],
      outgoing: data.outgoing || [],
    };
  },

  async searchPlayers(query: string) {
    const data = await apiFetch(
      `/friends/search?query=${encodeURIComponent(query)}`
    );
    return data.users;
  },

  async sendFriendRequest(recipientId: string) {
    return await apiFetch("/friends/request", {
      method: "POST",
      body: JSON.stringify({ recipientId }),
    });
  },

  async acceptFriendRequest(friendshipId: string) {
    return await apiFetch("/friends/accept", {
      method: "POST",
      body: JSON.stringify({ friendshipId }),
    });
  },

  async rejectFriendRequest(friendshipId: string) {
    return await apiFetch("/friends/reject", {
      method: "POST",
      body: JSON.stringify({ friendshipId }),
    });
  },

  async removeFriend(friendshipId: string) {
    // Re-uses reject endpoint — works for accepted friendships too
    return await apiFetch("/friends/reject", {
      method: "POST",
      body: JSON.stringify({ friendshipId }),
    });
  },
};
