import "./GameCard.css";

interface GameCardProps {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  onPlay: (appId: string) => void;
}

export default function GameCard({ id, name, description, thumbnail, onPlay }: GameCardProps) {
  const handleClick = () => {
    onPlay(id);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay(id);
  };

  return (
    <div className="game-card" onClick={handleClick}>
      <div className="thumbnail">
        <img
          src={thumbnail}
          alt={name}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="play-overlay">
          <button className="play-btn" onClick={handlePlayClick}>
            Play
          </button>
        </div>
      </div>
      <div className="info">
        <div className="name">{name}</div>
        <div className="description">{description}</div>
      </div>
    </div>
  );
}
