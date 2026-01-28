import { useParams, Link } from "react-router-dom";
import { getGameBySlug } from "../../../shared/const";
import { usePlayGame } from "../context/usePlayGame";
import "./GameInfo.css";

const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80";

export default function GameInfo() {
  const { slug } = useParams<{ slug: string }>();
  const { playGame } = usePlayGame();

  const game = slug ? getGameBySlug(slug) : undefined;

  if (!game) {
    return (
      <div className="game-info-page">
        <div className="game-not-found">
          <h1>Game not found</h1>
          <Link to="/">Back to Home</Link>
        </div>
      </div>
    );
  }

  const images = game.images.filter(Boolean).length > 0 ? game.images.filter(Boolean) : [PLACEHOLDER_IMAGE];

  const handlePlay = () => {
    playGame(game);
  };

  return (
    <div className="game-info-page">
      <Link to="/" className="back-link">
        &larr; Back
      </Link>

      <div className="game-info-content">
        <div className="game-carousel">
          {images.map((img, index) => (
            <div key={index} className="carousel-item">
              <img
                src={img}
                alt={`${game.name} screenshot ${index + 1}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                }}
              />
            </div>
          ))}
        </div>

        <div className="game-details">
          <div className="game-details-content">
            <img
              src={game.thumbnail}
              alt={game.name}
              className="game-icon"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <h1 className="game-title">{game.name}</h1>
            <p className="game-category">{game.category}</p>

            <div className="game-description">
              {game.description.split("\n\n").map((paragraph, index) => {
                if (paragraph.startsWith("**") && paragraph.includes(":**")) {
                  const title = paragraph.match(/\*\*(.*?):\*\*/)?.[1];
                  const items = paragraph
                    .replace(/\*\*.*?:\*\*/, "")
                    .split("\n")
                    .filter((line) => line.startsWith("- "))
                    .map((line) => line.replace("- ", ""));
                  return (
                    <div key={index}>
                      {title && <strong>{title}:</strong>}
                      <ul>
                        {items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                return <p key={index}>{paragraph}</p>;
              })}
            </div>
          </div>

          <button className="play-button" onClick={handlePlay}>
            Play
          </button>
        </div>
      </div>

    </div>
  );
}
