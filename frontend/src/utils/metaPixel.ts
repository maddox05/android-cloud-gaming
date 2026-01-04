/**
 * Meta Pixel tracking utilities
 * Provides type-safe wrappers for Facebook Pixel events
 */

declare global {
  interface Window {
    fbq: (
      action: string,
      event: string,
      params?: Record<string, unknown>,
      options?: { eventID?: string }
    ) => void;
  }
}

/**
 * Track a page view event
 * Call this on every route change
 */
export function trackPageView(): void {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "PageView");
  }
}

/**
 * Track when user views pricing/content
 */
export function trackViewContent(contentName?: string): void {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "ViewContent", {
      content_name: contentName ?? "Pricing Page",
    });
  }
}

/**
 * Track when user initiates checkout
 */
export function trackInitiateCheckout(): void {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "InitiateCheckout");
  }
}

/**
 * Track a successful purchase
 * @param sessionId - Stripe checkout session ID (used for deduplication)
 * @param value - Purchase amount in dollars
 * @param currency - Currency code (default: USD)
 */
export function trackPurchase(
  sessionId: string,
  value?: number,
  currency: string = "USD"
): void {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq(
      "track",
      "Purchase",
      {
        value: value ?? 0,
        currency,
      },
      { eventID: sessionId } // Deduplication: prevents double-counting on refresh
    );
  }
}

/**
 * Track user registration/sign-up
 */
export function trackCompleteRegistration(): void {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "CompleteRegistration");
  }
}
