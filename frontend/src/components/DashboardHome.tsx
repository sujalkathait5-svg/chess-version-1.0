import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { SavedGame, TimeControl } from "../chess-logic/models";
import { getPieceImgPath } from "../chess-logic/models";
import { authService } from "../services/authService";
import { 
  Zap, Trophy, Search, BarChart2, Calendar, User, Cpu, Clock, Swords, Star, 
  Sparkles, Compass, PieChart, AlertTriangle, Lightbulb, CheckCircle2, 
  Award, ArrowUpRight, Share2, Play
} from "lucide-react";
import { getOpeningName } from "../services/openings";
import { Spinner } from "./Spinner";
import { SkeletonWrapper } from "./SkeletonWrapper";
import { ProgressBar } from "./ProgressBar";



import { LeaderboardTab } from "./LeaderboardTab";
import { SocialTab } from "./SocialTab";
import { LayoutDashboard, Users } from "lucide-react";

interface DashboardHomeProps {
  savedGames: SavedGame[];
  timeControls: TimeControl[];
  onSelectTimeControl: (control: TimeControl) => void;
  onSelectCasualPlay: () => void;
  onSelectPlayComputer: () => void;
  onSelectPlayOnline: () => void;
  onOpenGame: (game: SavedGame, mode: "play" | "review") => void;
  onClearHistory: () => void;
  highestRating: number;
  pieceStyle: string;
  boardTheme: string;
  currentUser: any;
  onChallengeFriend: (friendName: string) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  savedGames,
  timeControls,
  onSelectTimeControl,
  onSelectCasualPlay,
  onSelectPlayComputer,
  onSelectPlayOnline,
  onOpenGame,
  onClearHistory,
  highestRating,
  pieceStyle,
  boardTheme,
  currentUser,
  onChallengeFriend,
}) => {
  const [activeTab, setActiveTab] = useState<"arena" | "leaderboard" | "social">("arena");
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [quickMatchTime, setQuickMatchTime] = useState<string>("5m");

  // ── Cloud social & leaderboard data ─────────────────────────────────────
  const [friendData, setFriendData] = useState<{
    friends: any[];
    incoming: any[];
    outgoing: any[];
  }>({ friends: [], incoming: [], outgoing: [] });
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

  // Derived: count of pending incoming friend requests (for badge)
  const pendingRequestCount = friendData.incoming.length;
  
  // Interactive tooltip state for accuracy chart
  const [activeTooltip, setActiveTooltip] = useState<{
    index: number;
    x: number;
    y: number;
    accuracy: number;
  } | null>(null);

  // Local state for favorite games
  const [starredGames, setStarredGames] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("kg_starred_games");
      return JSON.parse(raw ?? 'null') ?? {};
    } catch {
      return {};
    }
  });

  const toggleStar = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarredGames((prev) => {
      const next = { ...prev, [gameId]: !prev[gameId] };
      try {
        localStorage.setItem("kg_starred_games", JSON.stringify(next));
      } catch (err) {
        console.warn("Could not save starred games to localStorage", err);
      }
      return next;
    });
  };
const [isLoading, setIsLoading] = useState(true);
const [shareProgress, setShareProgress] = useState(0);

  // Simulate data loading delay
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // ── Load social + leaderboard data when user is logged in ──────────────
  const refreshSocialData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [social, lb] = await Promise.all([
        authService.getFriends(),
        authService.getLeaderboard(),
      ]);
      setFriendData(social);
      setLeaderboardData(lb || []);
    } catch (err) {
      console.warn("Could not prefetch social/leaderboard data:", err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    (async () => {
      try {
        const [social, lb] = await Promise.all([
          authService.getFriends(),
          authService.getLeaderboard(),
        ]);
        if (!cancelled) {
          setFriendData(social);
          setLeaderboardData(lb || []);
        }
      } catch (err) {
        if (!cancelled) console.warn("Could not fetch social/leaderboard data:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Helper to convert moves list to flat array
  const getFlatMoves = (moves: [string, string?][]) => {
    const flat: string[] = [];
    moves.forEach((pair) => {
      flat.push(pair[0]);
      if (pair[1]) flat.push(pair[1]);
    });
    return flat;
  };

  const totalGamesCount = savedGames.length;

  // Stats Calculations (Strictly realtime, no fake fallbacks)
  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalAccuracySum = 0;
    let reviewedGamesCount = 0;
    let blundersCount = 0;

    savedGames.forEach((g) => {
      const resultLower = g.result.toLowerCase();
      const isDraw = resultLower.includes("draw") || resultLower.includes("stalemate") || resultLower.includes("agreement") || resultLower.includes("repetition") || resultLower.includes("fifty move") || resultLower.includes("insufficient") || resultLower.includes("aborted");
      const whiteWon = resultLower.startsWith("white won") || resultLower.startsWith("white wins") || (resultLower.includes("black resigned") && !resultLower.includes("white resigned"));
      const blackWon = resultLower.startsWith("black won") || resultLower.startsWith("black wins") || (resultLower.includes("white resigned") && !resultLower.includes("black resigned"));

      if (isDraw) {
        draws++;
      } else if (g.gameMode === "computer") {
        if (whiteWon) wins++;
        else if (blackWon) losses++;
      } else {
        if (whiteWon) wins++;
        else if (blackWon) losses++;
      }

      if (g.review) {
        reviewedGamesCount++;
        totalAccuracySum += Math.round((g.review.whiteAccuracy + g.review.blackAccuracy) / 2);
        
        const bWhite = g.review.whiteClassifications?.blunder || 0;
        const bBlack = g.review.blackClassifications?.blunder || 0;
        blundersCount += (bWhite + bBlack);
      }
    });

    const avgAccuracy = reviewedGamesCount > 0 ? Math.round(totalAccuracySum / reviewedGamesCount) : 0;
    const displayBlunders = reviewedGamesCount > 0 ? blundersCount : 0;

    return {
      wins,
      losses,
      draws,
      avgAccuracy,
      blunders: displayBlunders,
    };
  }, [savedGames, totalGamesCount]);

  const displayTotalGames = totalGamesCount;

  // Sort games from newest to oldest
  const sortedGames = useMemo(() => {
    return [...savedGames].reverse();
  }, [savedGames]);

  // Filter games based on search query
  const filteredGames = useMemo(() => {
    return sortedGames.filter((g) => {
      const oppName = g.gameMode === "computer" ? `Stockfish Lvl ${g.computerLevel}` : "Local Friend";
      return oppName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.result.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.timeControl.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [sortedGames, searchQuery]);

  // Realtime Openings stats
  const openingsStats = useMemo(() => {
    const openingCounts: Record<string, number> = {};
    savedGames.forEach((g) => {
      const op = getOpeningName(getFlatMoves(g.moves));
      if (op) {
        openingCounts[op] = (openingCounts[op] || 0) + 1;
      }
    });

    const entries = Object.entries(openingCounts).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((sum, item) => sum + item[1], 0);

    if (total === 0) {
      return [
        { name: "No openings analyzed yet", percentage: 100, color: "#475569" }
      ];
    }

    const formatted = entries.slice(0, 4).map(([name, count], index) => {
      const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];
      return {
        name,
        percentage: Math.round((count / total) * 100),
        color: colors[index] || "#64748b"
      };
    });

    if (entries.length > 4) {
      const otherCount = entries.slice(4).reduce((sum, item) => sum + item[1], 0);
      formatted.push({
        name: "Others",
        percentage: Math.round((otherCount / total) * 100),
        color: "#64748b"
      });
    }

    return formatted;
  }, [savedGames]);

  // Last game review extraction
  const lastGame = savedGames[0] || null;

  // Calculate dynamic insights based on stats and openings
  const aiInsights = useMemo(() => {
    const insights = [];
    
    // Insight 1: Opening
    const topOpening = openingsStats.length > 0 && openingsStats[0].name !== "No openings analyzed yet" 
      ? openingsStats[0].name 
      : null;
      
    if (topOpening) {
      insights.push({
        type: "success",
        icon: <CheckCircle2 size={13} />,
        title: "Opening Play",
        text: `Your most played opening is ${topOpening}. Try studying its variations to improve your win rate in familiar positions.`
      });
    } else {
      insights.push({
        type: "success",
        icon: <CheckCircle2 size={13} />,
        title: "Opening Play",
        text: lastGame && lastGame.review && lastGame.review.whiteAccuracy > 85 
          ? "Great job! You played very accurately in the opening phase of your last game."
          : "Focus on opening patterns. Study basic opening principles to gain a better start."
      });
    }

    // Insight 2: Tactics (based on blunders)
    if (stats.blunders > 5) {
      insights.push({
        type: "warning",
        icon: <AlertTriangle size={13} />,
        title: "Middle Game Tactics",
        text: `You have accumulated ${stats.blunders} blunders in your reviewed games. Focus on double-checking enemy captures before moving.`
      });
    } else {
      insights.push({
        type: "info",
        icon: <Lightbulb size={13} />,
        title: "Middle Game Tactics",
        text: "Your tactical focus in the middle game is solid. Keep scanning for tactical threats!"
      });
    }

    // Insight 3: Performance (based on accuracy)
    if (stats.avgAccuracy > 75) {
      insights.push({
        type: "success",
        icon: <Award size={13} />,
        title: "Overall Performance",
        text: `Impressive! You are maintaining an average accuracy of ${stats.avgAccuracy}%. You are playing strong, consistent chess.`
      });
    } else if (stats.avgAccuracy > 0) {
      insights.push({
        type: "info",
        icon: <Compass size={13} />,
        title: "Overall Performance",
        text: `Your average accuracy is ${stats.avgAccuracy}%. Review your games with Stockfish to spot missed opportunities.`
      });
    } else {
      insights.push({
        type: "info",
        icon: <Lightbulb size={13} />,
        title: "Positional Tips",
        text: "Aim to activate your pieces, control open files, and place your knights in central outposts."
      });
    }
    
    return insights;
  }, [stats, openingsStats, lastGame]);


  const lastGameMovesStr = useMemo(() => {
    if (!lastGame) return "Play your first chess battle to analyze your moves, check blunders, and track accuracy statistics!";
    const flat = getFlatMoves(lastGame.moves);
    let movesListText = "";
    for (let i = 0; i < flat.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      movesListText += `${moveNum}. ${flat[i]} ${flat[i+1] || ""} `;
    }
    return movesListText;
  }, [lastGame]);

  // Mini-board piece setups
  const startingBoard: (string | null)[][] = useMemo(() => [
    ["r", "n", "b", "q", "k", "b", "n", "r"],
    ["p", "p", "p", "p", "p", "p", "p", "p"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["P", "P", "P", "P", "P", "P", "P", "P"],
    ["R", "N", "B", "Q", "K", "B", "N", "R"]
  ], []);

  const finalBoard = useMemo(() => {
    if (!lastGame) return null;
    const history = lastGame.gameHistory;
    if (!history || history.length === 0) return null;
    return history[history.length - 1].board;
  }, [lastGame]);

  const displayBoard = finalBoard || startingBoard;

  // Rating history Sparkline points (strictly realtime)
  const ratingHistoryPoints = useMemo(() => {
    if (savedGames.length === 0) {
      return "0,45 150,45";
    }
    if (savedGames.length === 1) {
      return "0,45 150,25";
    }

    const ratings = [1200];
    let curr = 1200;
    const gamesReversed = [...savedGames].reverse();
    gamesReversed.forEach((g) => {
      const resultLower = g.result.toLowerCase();
      if (resultLower.includes("won") || resultLower.includes("white wins")) {
        curr += 16;
      } else if (resultLower.includes("lost") || resultLower.includes("black wins")) {
        curr -= 16;
      }
      ratings.push(curr);
    });

    const max = Math.max(...ratings, 1300);
    const min = Math.min(...ratings, 1100);
    const range = max - min || 1;

    return ratings.map((r, idx) => {
      const x = (idx / (ratings.length - 1)) * 150;
      const y = 45 - ((r - min) / range) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [savedGames]);

  // Accuracy Over Time SVG Data (strictly realtime)
  const accuracyHistory = useMemo(() => {
    const reviewed = savedGames.filter(g => g.review !== null);
    if (reviewed.length === 0) {
      return [];
    }
    return reviewed.slice(0, 20).reverse().map((g, idx) => {
      const acc = Math.round(((g.review?.whiteAccuracy || 80) + (g.review?.blackAccuracy || 80)) / 2);
      return {
        label: `${idx + 1}`,
        val: acc
      };
    });
  }, [savedGames]);

  // Chart coordinates mapping (strictly realtime)
  const chartPoints = useMemo(() => {
    const h = 110;
    const w = 450;
    const padding = 20;
    const count = accuracyHistory.length;
    
    if (count === 0) return [];
    if (count === 1) {
      return [{
        x: w / 2,
        y: h / 2,
        val: accuracyHistory[0].val,
        label: accuracyHistory[0].label
      }];
    }
    
    return accuracyHistory.map((item, idx) => {
      const x = padding + (idx / (count - 1)) * (w - 2 * padding);
      const y = h - padding - (item.val / 100) * (h - 2 * padding);
      return { x, y, val: item.val, label: item.label };
    });
  }, [accuracyHistory]);

  const chartPath = useMemo(() => {
    if (chartPoints.length < 2) return "";
    let d = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    for (let i = 1; i < chartPoints.length; i++) {
      const p0 = chartPoints[i - 1];
      const p1 = chartPoints[i];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [chartPoints]);

  const chartFillPath = useMemo(() => {
    if (chartPoints.length < 2) return "";
    const h = 110;
    const padding = 20;
    return `${chartPath} L ${chartPoints[chartPoints.length - 1].x} ${h - padding} L ${chartPoints[0].x} ${h - padding} Z`;
  }, [chartPoints, chartPath]);

  // Result Distribution percentages (strictly realtime)
  const resultDistribution = useMemo(() => {
    if (totalGamesCount === 0) {
      return [
        { name: "No matches recorded yet", percentage: 100, color: "#475569" }
      ];
    }
    const { wins, losses, draws } = stats;
    return [
      { name: "Wins", percentage: Math.round((wins / totalGamesCount) * 1000) / 10, color: "#10b981" },
      { name: "Losses", percentage: Math.round((losses / totalGamesCount) * 1000) / 10, color: "#ef4444" },
      { name: "Draws", percentage: Math.round((draws / totalGamesCount) * 1000) / 10, color: "#64748b" }
    ];
  }, [totalGamesCount, stats]);

  // Handle Quick match selection
  const handleTriggerQuickMatch = () => {
    const quicktc = timeControls.find((tc) => tc.id === quickMatchTime) || timeControls[0];
    onSelectTimeControl(quicktc);
  };

  const handleShareLastGame = () => {
    if (!lastGame) {
      alert("No games in history to share.");
      return;
    }
    setShareProgress(10);
    const interval = setInterval(() => {
      setShareProgress((p) => {
        if (p >= 90) {
          clearInterval(interval);
          return p;
        }
        return p + 20;
      });
    }, 100);

    navigator.clipboard.writeText(lastGame.pgn).then(() => {
      setTimeout(() => {
        clearInterval(interval);
        setShareProgress(100);
        setTimeout(() => {
          setShareProgress(0);
          alert("PGN Copied to clipboard! Share it with your friends.");
        }, 300);
      }, 500);
    });
  };

  return (
    <div className="db-layout">
      {isLoading && <Spinner />}
      {shareProgress > 0 && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", zIndex: 9999 }}>
          <ProgressBar progress={shareProgress} label="Copying PGN..." />
        </div>
      )}

      {/* Navigation Tab Bar */}
      {currentUser && (
        <div className="dashboard-tab-bar">
          <button className={`dashboard-tab-item ${activeTab === "arena" ? "active" : ""}`} onClick={() => setActiveTab("arena")}>
            <LayoutDashboard size={14} />
            <span>Arena</span>
          </button>
          <button className={`dashboard-tab-item ${activeTab === "leaderboard" ? "active" : ""}`} onClick={() => setActiveTab("leaderboard")}>
            <Trophy size={14} />
            <span>Leaderboard</span>
          </button>
          <button className={`dashboard-tab-item ${activeTab === "social" ? "active" : ""}`} onClick={() => setActiveTab("social")}>
            <Users size={14} />
            <span>Friends & Social</span>
            {pendingRequestCount > 0 && (
              <span style={{
                background: "#ef4444",
                color: "white",
                borderRadius: "50%",
                fontSize: "9px",
                fontWeight: 700,
                width: 16,
                height: 16,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 4,
                flexShrink: 0,
              }}>{pendingRequestCount}</span>
            )}
          </button>
        </div>
      )}

      <SkeletonWrapper loading={isLoading}>
        {currentUser && activeTab === "leaderboard" && (
          <LeaderboardTab
            currentUserId={currentUser?.id}
            prefetchedData={leaderboardData.length > 0 ? leaderboardData : undefined}
          />
        )}

        {currentUser && activeTab === "social" && (
          <SocialTab
            currentUserId={currentUser?.id}
            onChallengeFriend={onChallengeFriend}
            prefetchedData={friendData}
            onDataRefresh={refreshSocialData}
          />
        )}

        {(activeTab === "arena" || !currentUser) && (
          <>
            {/* Main Chess Dashboard Grid */}
            <div className="dashboard-grid">
        
        {/* PANEL 1: Your Stats */}
        <div className="dashboard-card stats-card-anchor">
          <div className="card-header-row">
            <div className="card-title-area">
              <Award className="card-title-icon" size={18} />
              <h3>Your Stats</h3>
            </div>
            <button className="card-header-link" onClick={() => {
              const el = document.querySelector(".db-history");
              el?.scrollIntoView({ behavior: "smooth" });
            }}>View All</button>
          </div>
          
          <div className="stats-overview-row">
            <span className="stats-rating-num">
              {currentUser?.ratings?.vsHuman ?? currentUser?.ratings?.vsAI ?? highestRating ?? 1200}
            </span>
            <span className="stats-rating-change" title={`Peak Rating: ${currentUser?.ratings?.peakVsHuman ?? highestRating}`}>
              <ArrowUpRight size={14} /> Peak: {currentUser?.ratings?.peakVsHuman ?? highestRating}
            </span>
          </div>

          {/* Rating Progress Graph */}
          <div className="stats-sparkline-wrap">
            <svg className="sparkline-svg" viewBox="0 0 150 50">
              <defs>
                <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0052FF" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#0052FF" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Fill */}
              <path
                d={`M 0,50 L ${ratingHistoryPoints} L 150,50 Z`}
                fill="url(#sparklineGrad)"
              />
              {/* Line */}
              <path
                d={`M ${ratingHistoryPoints.replace(/ /g, ' L ')}`}
                fill="none"
                stroke="#0052FF"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Stats grid tiles */}
          <div className="stats-grid-tiles">
            <div className="stats-tile">
              <span className="stats-tile-label">Wins</span>
              <span className="stats-tile-num" style={{ color: "var(--accent-success)" }}>{stats.wins}</span>
            </div>
            <div className="stats-tile">
              <span className="stats-tile-label">Losses</span>
              <span className="stats-tile-num" style={{ color: "var(--accent-error)" }}>{stats.losses}</span>
            </div>
            <div className="stats-tile">
              <span className="stats-tile-label">Draws</span>
              <span className="stats-tile-num" style={{ color: "var(--text-secondary)" }}>{stats.draws}</span>
            </div>
            <div className="stats-tile">
              <span className="stats-tile-label">Avg. Acc</span>
              <span className="stats-tile-num">{stats.avgAccuracy}%</span>
            </div>
            <div className="stats-tile">
              <span className="stats-tile-label">Blunders</span>
              <span className="stats-tile-num" style={{ color: stats.blunders > 0 ? "var(--accent-error)" : "var(--text-primary)" }}>{stats.blunders}</span>
            </div>
            <div className="stats-tile">
              <span className="stats-tile-label">Games</span>
              <span className="stats-tile-num">{displayTotalGames}</span>
            </div>
          </div>
        </div>

        {/* PANEL 2: Play Chess modes */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-area">
              <Swords className="card-title-icon" size={18} />
              <h3>Play Chess</h3>
            </div>
          </div>
          <span className="card-subtitle">Choose your mode and start playing!</span>

          {/* Quick modes launcher */}
          <div className="play-modes-grid">
            <div className="play-mode-card online" onClick={onSelectPlayOnline} style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(37,99,235,0.2))", borderColor: "rgba(59,130,246,0.3)" }}>
              <div className="play-mode-icon-wrap text-blue-400">
                <Sparkles size={16} />
              </div>
              <span className="play-mode-title">Play Online</span>
              <span className="play-mode-subtitle">Matchmaking via WebSocket</span>
            </div>
            <div className="play-mode-card ai" onClick={onSelectPlayComputer}>
              <div className="play-mode-icon-wrap">
                <Cpu size={16} />
              </div>
              <span className="play-mode-title">Play vs AI</span>
              <span className="play-mode-subtitle">Challenge Stockfish</span>
            </div>
            <div className="play-mode-card human" onClick={onSelectCasualPlay}>
              <div className="play-mode-icon-wrap">
                <User size={16} />
              </div>
              <span className="play-mode-title">Play vs Friend</span>
              <span className="play-mode-subtitle">Local 2-player</span>
            </div>
            <div className="play-mode-card quick" onClick={handleTriggerQuickMatch}>
              <div className="play-mode-icon-wrap">
                <Clock size={16} />
              </div>
              <span className="play-mode-title">Quick Match</span>
              <div className="quick-match-select-wrap">
                <select 
                  className="quick-match-select" 
                  value={quickMatchTime} 
                  onChange={(e) => {
                    e.stopPropagation();
                    setQuickMatchTime(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {timeControls.map(tc => (
                    <option key={tc.id} value={tc.id}>{tc.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button className="custom-game-btn" onClick={onSelectCasualPlay}>
            <Zap size={14} style={{ color: "var(--accent-warning)" }} />
            <span>Custom Game (Create Match)</span>
          </button>
        </div>

        {/* PANEL 3: Recent Games list (Realtime, no fake listings) */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-area">
              <Calendar className="card-title-icon" size={18} />
              <h3>Recent Games</h3>
            </div>
            <button className="card-header-link" onClick={() => {
              const el = document.querySelector(".db-history");
              el?.scrollIntoView({ behavior: "smooth" });
            }}>View All</button>
          </div>

          <div className="recent-games-list">
            {savedGames.length === 0 ? (
              <div className="db-empty flex-center" style={{ padding: "40px 10px", height: "100%", width: "100%", justifyContent: "center" }}>
                <div className="db-empty-icon-wrap" style={{ width: "40px", height: "40px", borderRadius: "10px", margin: "0 auto 8px" }}>
                  <BarChart2 size={18} />
                </div>
                <p className="db-empty-title" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>No games played yet</p>
                <p className="db-empty-sub" style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "2px" }}>Play your first chess match!</p>
              </div>
            ) : (
              sortedGames.slice(0, 5).map((game) => {
                const isCpu = game.gameMode === "computer";
                const oppName = isCpu ? `Stockfish Lvl ${game.computerLevel}` : "Local Friend";
                const resultLower = game.result.toLowerCase();
                const isDraw = resultLower.includes("draw") || resultLower.includes("stalemate") || resultLower.includes("agreement") || resultLower.includes("repetition") || resultLower.includes("fifty move") || resultLower.includes("insufficient") || resultLower.includes("aborted");
                const isWin = resultLower.includes("white won") || resultLower.includes("white wins") || (resultLower.includes("black resigned") && !resultLower.includes("white resigned")) || resultLower.includes("white wins on time");
                const outcome = isWin ? "Win" : isDraw ? "Draw" : "Loss";
                const accVal = game.review ? `${Math.round((game.review.whiteAccuracy + game.review.blackAccuracy) / 2)}%` : "--";
                const opName = getOpeningName(getFlatMoves(game.moves)) || "Chess Opening";
                const starred = starredGames[game.id] || false;

                return (
                  <div key={game.id} className="recent-game-row" onClick={() => onOpenGame(game, "play")}>
                    <div className="game-row-left">
                      <div className="game-row-thumb">
                        {isCpu ? <Cpu size={16} /> : <User size={16} />}
                      </div>
                      <div className="game-opponent-info">
                        <span className="game-opponent-name">vs {oppName}</span>
                        <span className="game-opening-desc">{opName}</span>
                      </div>
                    </div>
                    <div className="game-row-right">
                      <span className={`game-result-text ${outcome.toLowerCase()}`}>{outcome}</span>
                      <span className="game-accuracy-tag">{accVal}</span>
                      <div className="recent-game-actions">
                        <button className="recent-game-btn replay" onClick={(e) => { e.stopPropagation(); onOpenGame(game, "play"); }} title="Replay Match">
                          Replay
                        </button>
                        <button className="recent-game-btn review" onClick={(e) => { e.stopPropagation(); onOpenGame(game, "review"); }} title="Review Match">
                          Review
                        </button>
                      </div>
                      <button className={`game-star-btn ${starred ? "active" : ""}`} onClick={(e) => toggleStar(game.id, e)}>
                        <Star size={13} fill={starred ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PANEL 4: Accuracy Over Time (Realtime) */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-area">
              <BarChart2 className="card-title-icon" size={18} />
              <h3>Accuracy Over Time</h3>
            </div>
            <select className="glass-panel" style={{ fontSize: "10.5px", padding: "4px 8px", borderRadius: "6px", color: "var(--text-secondary)", background: "transparent", border: "1px solid var(--border)" }}>
              <option>Last 20 Games</option>
              <option>Last 50 Games</option>
            </select>
          </div>

          <div className="accuracy-chart-container">
            {accuracyHistory.length === 0 ? (
              <svg className="chart-svg-main" viewBox="0 0 450 110">
                <rect x="0" y="0" width="450" height="110" fill="transparent" />
                <line x1="20" y1="90" x2="430" y2="90" stroke="var(--border)" strokeWidth="1" />
                <text x="225" y="55" textAnchor="middle" fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-ui)">
                  Play reviewed games to track accuracy over time.
                </text>
              </svg>
            ) : (
              <svg className="chart-svg-main" viewBox="0 0 450 110">
                <defs>
                  <linearGradient id="chartFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0052FF" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0052FF" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal grid lines */}
                <line x1="20" y1="20" x2="430" y2="20" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1="20" y1="42.5" x2="430" y2="42.5" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1="20" y1="65" x2="430" y2="65" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                <line x1="20" y1="87.5" x2="430" y2="87.5" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />

                {/* Area under line */}
                {chartPath && (
                  <path d={chartFillPath} fill="url(#chartFillGrad)" />
                )}

                {/* Curve Line */}
                {chartPath && (
                  <path d={chartPath} fill="none" stroke="#0052FF" strokeWidth="2.5" strokeLinecap="round" />
                )}

                {/* Data points */}
                {chartPoints.map((p, idx) => (
                  <circle
                    key={idx}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#0052FF"
                    stroke="var(--card)"
                    strokeWidth="1.5"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => {
                      setActiveTooltip({
                        index: idx,
                        x: p.x - 50,
                        y: p.y - 42,
                        accuracy: p.val
                      });
                    }}
                    onMouseLeave={() => setActiveTooltip(null)}
                  />
                ))}

                {/* X Axis label line */}
                <line x1="20" y1="90" x2="430" y2="90" stroke="var(--border)" strokeWidth="1" />
                
                {/* Axis text */}
                <text x="20" y="104" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">1</text>
                {accuracyHistory.length >= 5 && <text x="225" y="104" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)" textAnchor="middle">{(accuracyHistory.length / 2).toFixed(0)}</text>}
                {accuracyHistory.length >= 2 && <text x="430" y="104" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)" textAnchor="end">{accuracyHistory.length}</text>}
              </svg>
            )}

            {/* Hover Tooltip */}
            {activeTooltip && (
              <div 
                className="chart-tooltip"
                style={{ left: `${activeTooltip.x}px`, top: `${activeTooltip.y}px` }}
              >
                Game {activeTooltip.index + 1}: Accuracy: {activeTooltip.accuracy}%
              </div>
            )}
          </div>
        </div>

        {/* PANEL 5: Most Played Openings (Donut Chart) */}
        <div className="dashboard-card openings-card-anchor">
          <div className="card-header-row">
            <div className="card-title-area">
              <Compass className="card-title-icon" size={18} />
              <h3>Most Played Openings</h3>
            </div>
          </div>

          <div className="donut-chart-row">
            {/* SVG circular Donut */}
            <div className="donut-visual-container">
              <svg className="donut-svg" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="4" />
                {(() => {
                  let accumulatedOffset = 0;
                  return openingsStats.map((item, idx) => {
                    const strokeDash = `${item.percentage} ${100 - item.percentage}`;
                    const strokeOffset = 100 - accumulatedOffset;
                    accumulatedOffset += item.percentage;
                    return (
                      <circle
                        key={idx}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="none"
                        stroke={item.color}
                        strokeWidth="4.2"
                        strokeDasharray={strokeDash}
                        strokeDashoffset={strokeOffset}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="donut-center-text">
                <span className="donut-center-num">{displayTotalGames}</span>
                <span className="donut-center-label">Total</span>
              </div>
            </div>

            {/* Legend list */}
            <div className="donut-legend">
              {openingsStats.map((item, idx) => (
                <div key={idx} className="donut-legend-item">
                  <div className="legend-item-left">
                    <span className="legend-color-dot" style={{ backgroundColor: item.color }} />
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "90px" }} title={item.name}>{item.name}</span>
                  </div>
                  <span className="legend-value">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL 6: Game Result Distribution (Donut Chart) */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-area">
              <PieChart className="card-title-icon" size={18} />
              <h3>Game Result Distribution</h3>
            </div>
          </div>

          <div className="donut-chart-row">
            {/* Donut SVG */}
            <div className="donut-visual-container">
              <svg className="donut-svg" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="4" />
                {(() => {
                  let accumulatedOffset = 0;
                  return resultDistribution.map((item, idx) => {
                    const strokeDash = `${item.percentage} ${100 - item.percentage}`;
                    const strokeOffset = 100 - accumulatedOffset;
                    accumulatedOffset += item.percentage;
                    return (
                      <circle
                        key={idx}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="none"
                        stroke={item.color}
                        strokeWidth="4.2"
                        strokeDasharray={strokeDash}
                        strokeDashoffset={strokeOffset}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="donut-center-text">
                <span className="donut-center-num">{displayTotalGames}</span>
                <span className="donut-center-label">Games</span>
              </div>
            </div>

            {/* Legend */}
            <div className="donut-legend">
              {resultDistribution.map((item, idx) => (
                <div key={idx} className="donut-legend-item">
                  <div className="legend-item-left">
                    <span className="legend-color-dot" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="legend-value">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PANEL 7: Last Game Review (Realtime final board state rendering) */}
        <div className="dashboard-card col-span-8">
          <div className="card-header-row">
            <div className="card-title-area">
              <Trophy className="card-title-icon" size={18} />
              <h3>Last Game Review</h3>
            </div>
          </div>

          <div className="last-game-review-layout">
            {/* Chess board rendering actual final position pieces */}
            <div className={`last-game-mini-board board-theme-${boardTheme}`}>
              {Array.from({ length: 64 }).map((_, idx) => {
                const row = Math.floor(idx / 8);
                const col = idx % 8;
                const isDark = (row + col) % 2 === 1;
                const piece = displayBoard[row][col];
                
                // Highlight last move squares if available
                let isHighlighted = false;
                if (lastGame && lastGame.gameHistory && lastGame.gameHistory.length > 0) {
                  const lastM = lastGame.gameHistory[lastGame.gameHistory.length - 1].lastMove;
                  if (lastM) {
                    isHighlighted = (row === lastM.prevX && col === lastM.prevY) || (row === lastM.currX && col === lastM.currY);
                  }
                }
                
                return (
                  <div
                    key={idx}
                    className={`mini-board-square ${isDark ? "dark" : "light"} ${isHighlighted ? "highlight" : ""}`}
                    style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {piece && (
                      <img 
                        src={getPieceImgPath(piece, pieceStyle)} 
                        alt={piece} 
                        className="mini-board-piece-img" 
                        style={{ width: "90%", height: "90%", objectFit: "contain", pointerEvents: "none" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Match review stats & options */}
            <div className="last-game-details-col">
              {lastGame ? (
                <div>
                  <div className="last-game-meta-row">
                    <span className="last-game-opponent">
                      vs {lastGame.gameMode === "computer" ? `Stockfish (Lvl ${lastGame.computerLevel})` : "Local Friend"}
                      <span className={`db-outcome-badge ${lastGame.result.toLowerCase().includes("lost") ? "loss" : lastGame.result.toLowerCase().includes("draw") ? "draw" : "win"}`} style={{ fontSize: "9px", padding: "2px 6px" }}>
                        {lastGame.result.toLowerCase().includes("lost") ? "Loss" : lastGame.result.toLowerCase().includes("draw") ? "Draw" : "Win"}
                      </span>
                    </span>
                    <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                      {new Date(lastGame.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>

                  <div className="last-game-opening">
                    {getOpeningName(getFlatMoves(lastGame.moves)) || "Chess Game"}
                  </div>

                  <p className="last-game-moves-preview">
                    {lastGameMovesStr}
                  </p>

                  <div className="last-game-accuracy-panel">
                    <span className="last-game-accuracy-label">Accuracy</span>
                    <div className="accuracy-comparison-pill">
                      <span className="acc-pill-half you">
                        {lastGame.review ? lastGame.review.whiteAccuracy : "--"}%
                      </span>
                      <span className="acc-vs-divider">vs</span>
                      <span className="acc-pill-half opponent">
                        {lastGame.review ? lastGame.review.blackAccuracy : "--"}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="last-game-meta-row">
                    <span className="last-game-opponent" style={{ color: "var(--text-secondary)" }}>
                      No matches played yet
                    </span>
                  </div>
                  <div className="last-game-opening" style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                    Analyze matches on completion
                  </div>
                  <p className="last-game-moves-preview" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "12px" }}>
                    Challenge Stockfish AI or play a game vs a friend locally. Your moves, accuracies, blunders, and evaluations will appear here.
                  </p>
                  <div className="last-game-accuracy-panel" style={{ marginTop: "12px" }}>
                    <span className="last-game-accuracy-label">Accuracy</span>
                    <div className="accuracy-comparison-pill">
                      <span className="acc-pill-half you" style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-muted)" }}>--%</span>
                      <span className="acc-vs-divider">vs</span>
                      <span className="acc-pill-half opponent" style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-muted)" }}>--%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action triggers */}
              <div className="last-game-actions">
                {lastGame ? (
                  <>
                    <button className="review-btn-primary" onClick={() => onOpenGame(lastGame, "review")}>
                      <Swords size={13} />
                      <span>Review Game</span>
                    </button>
                    <button className="review-btn-secondary" onClick={() => onOpenGame(lastGame, "play")}>
                      <Play size={13} />
                      <span>Replay Game</span>
                    </button>
                    <button className="review-btn-secondary" onClick={handleShareLastGame}>
                      <Share2 size={13} />
                      <span>Share Game</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button className="review-btn-primary" onClick={onSelectPlayComputer}>
                      <Cpu size={13} />
                      <span>Challenge AI</span>
                    </button>
                    <button className="review-btn-secondary" onClick={onSelectCasualPlay}>
                      <User size={13} />
                      <span>Play Friend</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 8: AI Insight */}
        <div className="dashboard-card">
          <div className="card-header-row">
            <div className="card-title-area">
              <Sparkles className="card-title-icon" size={18} />
              <h3>AI Insight</h3>
            </div>
          </div>

          <div className="ai-insights-list">
            {lastGame ? (
              <>
                {aiInsights.map((insight, idx) => (
                  <div key={idx} className="ai-insight-item">
                    <div className={`ai-insight-icon-wrap ${insight.type}`}>
                      {insight.icon}
                    </div>
                    <div className="ai-insight-content">
                      <span className="ai-insight-title">{insight.title}</span>
                      <span className="ai-insight-text">{insight.text}</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="db-empty flex-center" style={{ height: "100%", justifyContent: "center", padding: "20px" }}>
                <Lightbulb size={24} style={{ color: "var(--text-muted)", marginBottom: "8px" }} />
                <p className="db-empty-title" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>No insights available</p>
                <p className="db-empty-sub" style={{ fontSize: "10.5px", color: "var(--text-muted)", textAlign: "center", marginTop: "2px" }}>
                  AI insights will analyze your blunders and accuracy after your first reviewed match.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── RECENT MATCHES LOG TABLE ── */}
      <div className="db-history glass-panel" style={{ marginTop: "10px" }}>
        <div className="db-history-header">
          <div className="db-card-header">
            <Calendar size={18} className="db-header-icon accent" />
            <h3>Matches Log</h3>
          </div>
          <div className="db-history-controls">
            <div className="db-search">
              <Search size={14} className="db-search-icon" />
              <input
                type="text"
                placeholder="Search matches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {savedGames.length > 0 && (
              <button className="db-clear-btn" onClick={onClearHistory}>
                Clear History
              </button>
            )}
          </div>
        </div>

        {filteredGames.length === 0 ? (
          <div className="db-empty flex-center">
            <div className="db-empty-icon-wrap">
              <BarChart2 size={32} />
            </div>
            <p className="db-empty-title">No games found</p>
            <p className="db-empty-sub">Start a new match to build your history!</p>
          </div>
        ) : (
          <div className="db-table-wrap">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Opponent</th>
                  <th>Outcome</th>
                  <th>Time Control</th>
                  <th>Moves</th>
                  <th>Accuracies</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((game) => {
                  const isCpu = game.gameMode === "computer";
                  const opponentName = isCpu ? `Stockfish Lvl ${game.computerLevel}` : "Local Friend";
                  const dateStr = new Date(game.date).toLocaleDateString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                  });
                  const resultLower = game.result.toLowerCase();
                  const isDraw = resultLower.includes("draw") || resultLower.includes("stalemate") || resultLower.includes("agreement") || resultLower.includes("repetition") || resultLower.includes("fifty move") || resultLower.includes("insufficient") || resultLower.includes("aborted");
                  const isWin = resultLower.includes("white won") || resultLower.includes("white wins") || (resultLower.includes("black resigned") && !resultLower.includes("white resigned")) || resultLower.includes("white wins on time");

                  return (
                    <tr key={game.id} className="db-table-row">
                      <td>
                        <div className="db-opp-cell">
                          <div className="db-opp-icon-wrap" style={{ background: isCpu ? "rgba(0,82,255,0.15)" : "rgba(148,163,184,0.1)" }}>
                            {isCpu ? <Cpu size={14} style={{ color: "#4D7CFF" }} /> : <User size={14} />}
                          </div>
                          <div>
                            <div className="db-opp-name">{opponentName}</div>
                            <div className="db-opp-date">{dateStr}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`db-outcome-badge ${isWin ? "win" : isDraw ? "draw" : "loss"}`}>
                          {isWin ? "Win" : isDraw ? "Draw" : "Loss"}
                        </span>
                        <div className="db-outcome-detail" style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                          {game.result}
                        </div>
                      </td>
                      <td className="db-tc-cell">{game.timeControl}</td>
                      <td className="db-moves-cell">{game.moves.length}</td>
                      <td>
                        {game.review ? (
                          <div className="db-acc-pair">
                            <span className="db-acc-tag white">{game.review.whiteAccuracy}%</span>
                            <span className="db-acc-sep">|</span>
                            <span className="db-acc-tag black">{game.review.blackAccuracy}%</span>
                          </div>
                        ) : (
                          <span className="db-no-review">Unanalyzed</span>
                        )}
                      </td>
                      <td>
                        <div className="db-action-btns">
                          <button className="db-action-btn replay" onClick={() => onOpenGame(game, "play")}>
                            Replay
                          </button>
                          <button className="db-action-btn review" onClick={() => onOpenGame(game, "review")}>
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
          </>
        )}
      </SkeletonWrapper>
      
      <style>{`
        .db-layout {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          animation: fade-in-up 0.5s ease both;
        }

        /* Dashboard Tabs Styling */
        .dashboard-tab-bar {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid var(--glass-border);
          padding-bottom: 12px;
          margin-bottom: 4px;
        }
        
        .dashboard-tab-item {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        .dashboard-tab-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-primary);
        }
        
        .dashboard-tab-item.active {
          background: rgba(0, 82, 255, 0.15);
          border-color: rgba(0, 82, 255, 0.4);
          color: #60a5fa;
          font-weight: 600;
        }

        /* Auth CTA Banner */
        .auth-cta-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(0, 82, 255, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%);
          border: 1px solid rgba(0, 82, 255, 0.25);
          margin-bottom: 16px;
          gap: 16px;
          flex-wrap: wrap;
          animation: slideUp 0.3s ease;
        }

        .auth-cta-text h4 {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .auth-cta-text p {
          margin: 0;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .auth-cta-btn {
          background: #0052FF;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .auth-cta-btn:hover {
          background: #0042cc;
        }

        /* Missing Dashboard Grid & Cards Styles */
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 20px;
          width: 100%;
        }

        .dashboard-card {
          grid-column: span 4;
          background: rgba(19, 19, 42, 0.6);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }

        .dashboard-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .dashboard-card.col-span-8 {
          grid-column: span 8;
        }

        @media (max-width: 1200px) {
          .dashboard-card {
            grid-column: span 6;
          }
          .dashboard-card.col-span-8 {
            grid-column: span 12;
          }
        }

        @media (max-width: 768px) {
          .dashboard-card, .dashboard-card.col-span-8 {
            grid-column: span 12;
          }
        }

        /* Card Header */
        .card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .card-title-area {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .card-title-icon {
          color: var(--accent-secondary);
        }

        .card-title-area h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .card-header-link {
          font-size: 12px;
          color: var(--accent-secondary);
          font-weight: 500;
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .card-header-link:hover {
          color: var(--text-primary);
        }

        .card-subtitle {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        /* Panel 1: Stats Card */
        .stats-overview-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin-bottom: 15px;
        }

        .stats-rating-num {
          font-size: 32px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        .stats-rating-change {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--accent-success);
          font-weight: 500;
        }

        .stats-sparkline-wrap {
          width: 100%;
          height: 50px;
          margin-bottom: 20px;
        }

        .sparkline-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .stats-grid-tiles {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .stats-tile {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }

        .stats-tile:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .stats-tile-label {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .stats-tile-num {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        /* Panel 2: Play Modes */
        .play-modes-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 16px;
          flex-grow: 1;
        }

        .play-mode-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .play-mode-card:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
        }

        .play-mode-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-secondary);
        }

        .play-mode-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .play-mode-subtitle {
          font-size: 10.5px;
          color: var(--text-muted);
        }

        .quick-match-select-wrap {
          width: 100%;
          margin-top: 4px;
        }

        .quick-match-select {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          color: var(--text-primary);
          padding: 4px 6px;
          font-size: 11px;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s ease;
        }

        .quick-match-select:focus {
          border-color: rgba(0, 82, 255, 0.4);
        }

        .custom-game-btn {
          width: 100%;
          background: rgba(0, 82, 255, 0.1);
          border: 1px solid rgba(0, 82, 255, 0.25);
          border-radius: 10px;
          padding: 12px;
          color: var(--accent-secondary);
          font-weight: 600;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .custom-game-btn:hover {
          background: rgba(0, 82, 255, 0.15);
          border-color: rgba(0, 82, 255, 0.4);
          transform: translateY(-1px);
        }

        /* Panel 3: Recent Games */
        .recent-games-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-grow: 1;
        }

        .recent-game-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .recent-game-row:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: var(--glass-border);
          transform: translateX(2px);
        }

        .game-row-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .game-row-thumb {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .game-opponent-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .game-opponent-name {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .game-opening-desc {
          font-size: 10.5px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .game-row-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .game-result-text {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .game-result-text.win {
          color: var(--accent-success);
          background: rgba(16, 185, 129, 0.1);
        }

        .game-result-text.loss {
          color: var(--accent-error);
          background: rgba(239, 68, 68, 0.1);
        }

        .game-result-text.draw {
          color: var(--text-secondary);
          background: rgba(148, 163, 184, 0.1);
        }

        .game-accuracy-tag {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
          padding: 3px 6px;
          border-radius: 6px;
          font-family: var(--font-mono);
        }

        .recent-game-actions {
          display: flex;
          gap: 6px;
        }

        .recent-game-btn {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .recent-game-btn.replay {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
          border: 1px solid var(--glass-border);
        }

        .recent-game-btn.replay:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }

        .recent-game-btn.review {
          background: var(--accent);
          color: white;
        }

        .recent-game-btn.review:hover {
          opacity: 0.9;
        }

        .game-star-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.15s ease, transform 0.15s ease;
        }

        .game-star-btn:hover {
          color: var(--accent-warning);
          transform: scale(1.1);
        }

        .game-star-btn.active {
          color: var(--accent-warning);
        }

        /* Panel 4: Accuracy Chart */
        .accuracy-chart-container {
          position: relative;
          width: 100%;
          height: 110px;
          margin-top: 10px;
        }

        .chart-svg-main {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        .chart-tooltip {
          position: absolute;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 10.5px;
          font-weight: 500;
          color: white;
          pointer-events: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          z-index: 10;
          white-space: nowrap;
          backdrop-filter: blur(4px);
          animation: fade-in 0.15s ease;
        }

        /* Panels 5 & 6: Donut Charts */
        .donut-chart-row {
          display: flex;
          align-items: center;
          justify-content: space-around;
          gap: 15px;
          margin-top: 10px;
          flex-grow: 1;
        }

        .donut-visual-container {
          position: relative;
          width: 90px;
          height: 90px;
          flex-shrink: 0;
        }

        .donut-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .donut-center-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .donut-center-num {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          font-family: var(--font-mono);
          line-height: 1;
        }

        .donut-center-label {
          font-size: 9px;
          color: var(--text-muted);
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }

        .donut-legend {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }

        .donut-legend-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: var(--text-secondary);
          gap: 8px;
        }

        .legend-item-left {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }

        .legend-color-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .legend-value {
          font-weight: 600;
          color: var(--text-primary);
          font-family: var(--font-mono);
        }

        /* Panel 7: Last Game Review */
        .last-game-review-layout {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 24px;
          align-items: center;
        }

        @media (max-width: 600px) {
          .last-game-review-layout {
            grid-template-columns: 1fr;
            justify-items: center;
          }
        }

        .last-game-mini-board {
          width: 200px;
          height: 200px;
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          grid-template-rows: repeat(8, 1fr);
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--glass-border);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
        }

        .mini-board-square {
          aspect-ratio: 1;
          transition: background-color 0.2s;
        }

        .mini-board-square.light {
          background-color: var(--square-light);
        }

        .mini-board-square.dark {
          background-color: var(--square-dark);
        }

        .mini-board-square.highlight {
          position: relative;
        }

        .mini-board-square.highlight::after {
          content: '';
          position: absolute;
          inset: 0;
          background-color: rgba(251, 191, 36, 0.35);
        }

        .mini-board-piece-img {
          z-index: 2;
        }

        .last-game-details-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
          justify-content: center;
        }

        .last-game-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2px;
        }

        .last-game-opponent {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .db-outcome-badge {
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: inline-block;
        }

        .db-outcome-badge.win {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }

        .db-outcome-badge.loss {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .db-outcome-badge.draw {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .last-game-opening {
          font-size: 13px;
          font-weight: 600;
          color: var(--accent-secondary);
        }

        .last-game-moves-preview {
          font-size: 11.5px;
          color: var(--text-secondary);
          line-height: 1.5;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 8px 12px;
          max-height: 52px;
          overflow-y: auto;
          font-family: var(--font-mono);
        }

        .last-game-accuracy-panel {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .last-game-accuracy-label {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
          text-transform: uppercase;
        }

        .accuracy-comparison-pill {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 99px;
          overflow: hidden;
          padding: 2px;
        }

        .acc-pill-half {
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 700;
          font-family: var(--font-mono);
          border-radius: 99px;
        }

        .acc-pill-half.you {
          background: rgba(0, 82, 255, 0.2);
          color: #60a5fa;
        }

        .acc-pill-half.opponent {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
        }

        .acc-vs-divider {
          font-size: 9px;
          color: var(--text-muted);
          padding: 0 6px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .last-game-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .review-btn-primary {
          background: var(--gradient);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 12px var(--accent-glow);
        }

        .review-btn-primary:hover {
          opacity: 0.95;
          transform: translateY(-1px);
          box-shadow: 0 6px 16px var(--accent-glow-lg);
        }

        .review-btn-secondary {
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .review-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary);
          border-color: rgba(255, 255, 255, 0.15);
        }

        /* Mini board themes */
        .last-game-mini-board.board-theme-blue .mini-board-square.light {
          background-color: #dee3e6;
        }
        .last-game-mini-board.board-theme-blue .mini-board-square.dark {
          background-color: #8ca2ad;
        }
        .last-game-mini-board.board-theme-green .mini-board-square.light {
          background-color: #eeeed2;
        }
        .last-game-mini-board.board-theme-green .mini-board-square.dark {
          background-color: #769656;
        }
        .last-game-mini-board.board-theme-wood .mini-board-square.light {
          background-color: #f0d9b5;
        }
        .last-game-mini-board.board-theme-wood .mini-board-square.dark {
          background-color: #b58863;
        }
        .last-game-mini-board.board-theme-dark .mini-board-square.light {
          background-color: #e5e5e5;
        }
        .last-game-mini-board.board-theme-dark .mini-board-square.dark {
          background-color: #4b4b4b;
        }
        .last-game-mini-board.board-theme-cyber .mini-board-square.light {
          background-color: #2d2d44;
        }
        .last-game-mini-board.board-theme-cyber .mini-board-square.dark {
          background-color: #1a1a2e;
        }
        .last-game-mini-board.board-theme-marble .mini-board-square.light {
          background-color: #f0d9b5;
        }
        .last-game-mini-board.board-theme-marble .mini-board-square.dark {
          background-color: #b58863;
        }

        /* Panel 8: AI Insights list */
        .ai-insights-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-grow: 1;
        }

        .ai-insight-item {
          display: flex;
          gap: 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.02);
          border-radius: 10px;
          padding: 10px;
          align-items: flex-start;
          transition: border-color 0.2s;
        }

        .ai-insight-item:hover {
          border-color: var(--glass-border);
        }

        .ai-insight-icon-wrap {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ai-insight-icon-wrap.success {
          background: rgba(16, 185, 129, 0.12);
          color: var(--accent-success);
        }

        .ai-insight-icon-wrap.warning {
          background: rgba(245, 158, 11, 0.12);
          color: var(--accent-warning);
        }

        .ai-insight-icon-wrap.info {
          background: rgba(59, 130, 246, 0.12);
          color: #60a5fa;
        }

        .ai-insight-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ai-insight-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .ai-insight-text {
          font-size: 10.5px;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        /* Matches Log / History Table */
        .db-history {
          padding: 20px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .db-history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .db-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .db-header-icon {
          color: var(--accent-secondary);
        }

        .db-card-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .db-history-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .db-search {
          position: relative;
          display: flex;
          align-items: center;
        }

        .db-search input {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 6px 12px 6px 30px;
          font-size: 12px;
          color: var(--text-primary);
          outline: none;
          width: 170px;
          transition: all 0.2s ease;
        }

        .db-search input:focus {
          border-color: rgba(0, 82, 255, 0.4);
          width: 200px;
        }

        .db-search-icon {
          position: absolute;
          left: 10px;
          color: var(--text-muted);
        }

        .db-clear-btn {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .db-clear-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.35);
        }

        .db-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .db-empty-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          margin-bottom: 12px;
        }

        .db-empty-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .db-empty-sub {
          font-size: 12px;
          color: var(--text-muted);
        }

        .db-table-wrap {
          overflow-x: auto;
          width: 100%;
        }

        .db-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .db-table th {
          padding: 12px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--glass-border);
        }

        .db-table td {
          padding: 12px;
          font-size: 12.5px;
          color: var(--text-secondary);
          border-bottom: 1px solid rgba(255, 255, 255, 0.02);
        }

        .db-table-row {
          transition: background-color 0.15s;
        }

        .db-table-row:hover {
          background-color: rgba(255, 255, 255, 0.01);
        }

        .db-opp-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .db-opp-icon-wrap {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
        }

        .db-opp-name {
          font-weight: 600;
          color: var(--text-primary);
        }

        .db-opp-date {
          font-size: 10px;
          color: var(--text-muted);
          margin-top: 1px;
        }

        .db-tc-cell {
          font-family: var(--font-mono);
          font-size: 11.5px;
        }

        .db-moves-cell {
          font-family: var(--font-mono);
        }

        .db-acc-pair {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-mono);
          font-size: 11.5px;
        }

        .db-acc-tag {
          font-weight: 600;
        }

        .db-acc-tag.white {
          color: #60a5fa;
        }

        .db-acc-tag.black {
          color: var(--text-secondary);
        }

        .db-acc-sep {
          color: var(--text-muted);
          font-size: 10px;
        }

        .db-no-review {
          font-size: 11px;
          color: var(--text-muted);
          font-style: italic;
        }

        .db-action-btns {
          display: flex;
          gap: 6px;
        }

        .db-action-btn {
          font-size: 11px;
          font-weight: 600;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .db-action-btn.replay {
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-secondary);
          border: 1px solid var(--glass-border);
        }

        .db-action-btn.replay:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary);
        }

        .db-action-btn.review {
          background: var(--accent);
          color: white;
        }

        .db-action-btn.review:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
};
