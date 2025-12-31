import { useState } from "react";
import { ProfileIcon } from "./Icons";
import "./Avatar.css";

interface AvatarProps {
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: 36,
  md: 40,
  lg: 56,
};

export function Avatar({ src, size = "md", className = "" }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const pixelSize = sizeMap[size];
  const iconSize = Math.round(pixelSize * 0.6);

  const showImage = src && !imgError;

  return (
    <div
      className={`avatar avatar-${size} ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="avatar-img"
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <ProfileIcon size={iconSize} />
      )}
    </div>
  );
}
