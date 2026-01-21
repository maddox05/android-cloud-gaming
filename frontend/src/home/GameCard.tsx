import { Link, useNavigate } from "react-router-dom";
import { getGameInfoPath, getGameQueuePath } from "../in_game/helpers";
import "./GameCard.css";

interface GameCardProps {
  slug: string;
  name: string;
  thumbnail: string;
  canPlay: () => boolean;
}

export default function GameCard({ slug, name, thumbnail, canPlay }: GameCardProps) {
  const navigate = useNavigate();

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canPlay()) {
      navigate(getGameQueuePath(slug));
    }
  };

  return (
    <Link to={getGameInfoPath(slug)} className="game-card">
      <div className="thumbnail">
        <img
          src={thumbnail}
          alt={name}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div className="name">{name}</div>
      <button className="play-btn" onClick={handlePlayClick}>
        Play
      </button>
    </Link>
  );
}
