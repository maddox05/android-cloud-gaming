import { GAMES_LIST } from "../../../shared/const";

export function getGameName(appId: string): string {
  const game = GAMES_LIST.find((g) => g.id === appId);
  return game ? game.name : appId;
}
