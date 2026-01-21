import { GAMES_LIST, getGameBySlug } from "../../../shared/const";

/** Base path for game routes - change this to switch route prefix */
const GAME_ROUTE_PREFIX = "/app";

/** Get the route path for a game's info page */
export function getGameInfoPath(slug: string): string {
  return `${GAME_ROUTE_PREFIX}/${slug}`;
}

/** Get the route path for a game's queue page */
export function getGameQueuePath(slug: string): string {
  return `${GAME_ROUTE_PREFIX}/${slug}/queue`;
}

/** Get the route path for a game's run page */
export function getGameRunPath(slug: string): string {
  return `${GAME_ROUTE_PREFIX}/${slug}/run`;
}

/** Get the route pattern for Router (with :slug param) */
export function getGameRoutePattern(suffix: string = ""): string {
  return `${GAME_ROUTE_PREFIX}/:slug${suffix}`;
}

export function getGameName(appId: string): string {
  const game = GAMES_LIST.find((g) => g.id === appId);
  return game ? game.name : appId;
}

export function getGameNameBySlug(slug: string): string {
  const game = getGameBySlug(slug);
  return game ? game.name : slug;
}

export function getGameIdBySlug(slug: string): string | undefined {
  const game = getGameBySlug(slug);
  return game?.id;
}
