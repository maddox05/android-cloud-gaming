import { useNavigate } from "react-router-dom";
import { useUser } from "./useUser";
import { useAuthModal } from "./AuthModalContext";
import { showAlert } from "../services/alertService";
import { getGameQueuePath } from "../in_game/helpers";
import type { Game } from "../../../shared/types";

/**
 * Hook that provides play game functionality with onPhone check.
 * Returns a function that handles the play button click for a game.
 */
export function usePlayGame() {
  const navigate = useNavigate();
  const { user, accessType } = useUser();
  const { startLogin } = useAuthModal();

  /**
   * Attempts to play the given game.
   * Returns true if navigation to game queue occurred, false otherwise.
   */
  const playGame = (game: Game): boolean => {
    // Check if game supports phone play
    if (!game.onPhone && game.relativeLink) {
      window.location.href = `/${game.relativeLink}`; // todo fix
      return false;
    }

    // Check if user is logged in
    if (!user) {
      startLogin();
      return false;
    }

    // Check if user has access
    if (accessType === null) {
      showAlert({
        type: "warning",
        title: "Access Required",
        message:
          "Join the waitlist for early access, or buy access now. Full release is coming soon.",
        link: { href: "/waitlist", label: "Join Waitlist" },
      });
      return false;
    }

    // Show quick alert if set, then continue on dismiss
    if (game.quickAlert) {
      showAlert({
        type: "info",
        title: "Notice",
        message: game.quickAlert,
        link: { href: `${getGameQueuePath(game.slug)}`, label: "Continue" },
        onDismiss: () => {
          navigate(getGameQueuePath(game.slug));
        },
      });
      return true;
    }

    // All checks passed, navigate to game queue
    navigate(getGameQueuePath(game.slug));
    return true;
  };

  /**
   * Checks if user can play (without navigating).
   * Useful for showing login modal or alerts without the onPhone check.
   */
  const canPlay = (): boolean => {
    if (!user) {
      startLogin();
      return false;
    }
    if (accessType === null) {
      showAlert({
        type: "warning",
        title: "Access Required",
        message:
          "Join the waitlist for early access, or buy access now. Full release is coming soon.",
        link: { href: "/waitlist", label: "Join Waitlist" },
      });
      return false;
    }
    return true;
  };

  return { playGame, canPlay };
}
