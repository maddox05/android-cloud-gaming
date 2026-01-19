import { Link } from "react-router-dom";
import "./GameCard.css";

interface GameCardProps {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  canPlay: () => boolean;
}

export default function GameCard({ id, name, description, thumbnail, canPlay }: GameCardProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (!canPlay()) {
      e.preventDefault();
    }
  };

  return (
    <Link to={`/queue/${encodeURIComponent(id)}`} className="game-card" target="_blank" rel="noopener noreferrer" onClick={handleClick}>
      <div className="thumbnail">
        <img
          src={thumbnail}
          alt={name}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="play-overlay">
          <span className="play-btn">Play</span>
        </div>
      </div>
      <div className="info">
        <div className="name">{name}</div>
        <div className="description">{description}</div>
      </div>
    </Link>
  );
}
