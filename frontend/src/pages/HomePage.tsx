// frontend/src/pages/HomePage.tsx
// Dashboard wrapper - delegates to the existing DashboardHome component
import { DashboardHome } from "../components/DashboardHome";
import { useGame } from "../hooks/useGame";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import type { TimeControl } from "../chess-logic/models";

export function HomePage() {
  const navigate = useNavigate();
  const game = useGame();
  const { boardTheme, pieceStyle } = useTheme();
  const { currentUser } = useAuth();

  const timeControlsList: TimeControl[] = [
    { id: "bullet-1", name: "Bullet", minutes: 1, incrementSeconds: 0, category: "bullet", label: "1 min" },
    { id: "bullet-1-1", name: "Bullet", minutes: 1, incrementSeconds: 1, category: "bullet", label: "1 | 1" },
    { id: "bullet-2-1", name: "Bullet", minutes: 2, incrementSeconds: 1, category: "bullet", label: "2 | 1" },
    { id: "blitz-3", name: "Blitz", minutes: 3, incrementSeconds: 0, category: "blitz", label: "3 min" },
    { id: "blitz-3-2", name: "Blitz", minutes: 3, incrementSeconds: 2, category: "blitz", label: "3 | 2" },
    { id: "blitz-5", name: "Blitz", minutes: 5, incrementSeconds: 0, category: "blitz", label: "5 min" },
    { id: "blitz-5-3", name: "Blitz", minutes: 5, incrementSeconds: 3, category: "blitz", label: "5 | 3" },
    { id: "rapid-10", name: "Rapid", minutes: 10, incrementSeconds: 0, category: "rapid", label: "10 min" },
    { id: "rapid-15-10", name: "Rapid", minutes: 15, incrementSeconds: 10, category: "rapid", label: "15 | 10" },
    { id: "rapid-30", name: "Rapid", minutes: 30, incrementSeconds: 0, category: "rapid", label: "30 min" },
    { id: "classical-60", name: "Classical", minutes: 60, incrementSeconds: 0, category: "classical", label: "60 min" },
    { id: "classical-90-30", name: "Classical", minutes: 90, incrementSeconds: 30, category: "classical", label: "90 | 30" },
  ];

  const highestRating = currentUser
    ? Math.max(currentUser.ratings?.vsAI || 1200, currentUser.ratings?.vsHuman || 1200)
    : 1200;

  return (
    <DashboardHome
      savedGames={game.savedGames}
      timeControls={timeControlsList}
      onSelectTimeControl={(tc) => {
        game.handleSelectTimeControl(tc);
        navigate("/play");
      }}
      onSelectCasualPlay={() => navigate("/play?mode=friend")}
      onSelectPlayComputer={() => navigate("/play?mode=computer")}
      onSelectPlayOnline={() => navigate("/online")}
      onOpenGame={(_savedGame, mode) => {
        // Load the game into context then navigate
        navigate(mode === "review" ? "/review" : "/play");
      }}
      onClearHistory={() => {
        if (confirm("Are you sure you want to clear your local game history? This cannot be undone.")) {
          game.setSavedGames([]);
        }
      }}
      highestRating={highestRating}
      pieceStyle={pieceStyle}
      boardTheme={boardTheme}
      currentUser={currentUser}
      onChallengeFriend={() => navigate("/play?mode=friend")}
    />
  );
}
