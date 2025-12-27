const GAME_NAMES: Record<string, string> = {
  "com.supercell.clashroyale": "Clash Royale",
};

export function getGameName(appId: string): string {
  return GAME_NAMES[appId] || appId;
}
