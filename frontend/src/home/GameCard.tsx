import { Link } from "react-router-dom";
import { getGameInfoPath } from "../in_game/helpers";
import { usePlayGame } from "../context/usePlayGame";
import type { Game } from "../../../shared/types";
import "./GameCard.css";

interface GameCardProps {
  game: Game;
}

export default function GameCard({ game }: GameCardProps) {
  const { playGame } = usePlayGame();

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    playGame(game);
  };

  return (
    <Link to={getGameInfoPath(game.slug)} className="game-card">
      <div className="thumbnail">
        <img
          src={game.thumbnail}
          alt={game.name}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div className="name">{game.name}</div>
      <button className="play-btn" onClick={handlePlayClick}>
        Play
      </button>
    </Link>
  );
}
