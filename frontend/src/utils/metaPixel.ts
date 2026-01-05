/**
 * Meta Pixel tracking utilities
 * Provides type-safe wrappers for Facebook Pixel standard events
 * Reference: https://developers.facebook.com/docs/meta-pixel/reference
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

function isFbqAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * Track a page view event
 * Call this on every route change
 */
export function trackPageView(): void {
  if (isFbqAvailable()) {
    window.fbq("track", "PageView");
  }
}

/**
 * Track when user views content (e.g., pricing page, product page)
 */
export function trackViewContent(contentName?: string, contentId?: string): void {
  if (isFbqAvailable()) {
    window.fbq("track", "ViewContent", {
      content_name: contentName,
      content_ids: contentId ? [contentId] : undefined,
    });
  }
}

/**
 * Track when user initiates checkout (clicks checkout button)
 */
export function trackInitiateCheckout(value?: number, currency: string = "USD"): void {
  if (isFbqAvailable()) {
    window.fbq("track", "InitiateCheckout", {
      value: value ?? 0,
      currency,
    });
  }
}

/**
 * Track a successful purchase
 * @param sessionId - Stripe checkout session ID (used for deduplication)
 * @param value - Purchase amount
 * @param currency - Currency code (default: USD)
 */
export function trackPurchase(
  sessionId: string,
  value?: number,
  currency: string = "USD"
): void {
  if (isFbqAvailable()) {
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
 * Track subscription start (paid subscription)
 * @param sessionId - Stripe checkout session ID (used for deduplication)
 * @param value - Subscription price
 * @param currency - Currency code
 * @param predictedLtv - Predicted lifetime value (optional)
 */
export function trackSubscribe(
  sessionId: string,
  value?: number,
  currency: string = "USD",
  predictedLtv?: number
): void {
  if (isFbqAvailable()) {
    window.fbq(
      "track",
      "Subscribe",
      {
        value: value ?? 0,
        currency,
        predicted_ltv: predictedLtv,
      },
      { eventID: sessionId }
    );
  }
}

/**
 * Track free trial start
 * @param value - Trial value (usually 0)
 * @param currency - Currency code
 * @param predictedLtv - Predicted lifetime value after trial
 */
export function trackStartTrial(
  value: number = 0,
  currency: string = "USD",
  predictedLtv?: number
): void {
  if (isFbqAvailable()) {
    window.fbq("track", "StartTrial", {
      value: value.toString(),
      currency,
      predicted_ltv: predictedLtv?.toString(),
    });
  }
}

/**
 * Track user registration/sign-up completion
 */
export function trackCompleteRegistration(method?: string): void {
  if (isFbqAvailable()) {
    window.fbq("track", "CompleteRegistration", {
      content_name: method, // e.g., "Google OAuth"
    });
  }
}

/**
 * Track lead submission (e.g., signing up for trial, submitting form)
 */
export function trackLead(contentName?: string, value?: number, currency: string = "USD"): void {
  if (isFbqAvailable()) {
    window.fbq("track", "Lead", {
      content_name: contentName,
      value: value ?? 0,
      currency,
    });
  }
}

/**
 * Track adding payment info during checkout
 */
export function trackAddPaymentInfo(): void {
  if (isFbqAvailable()) {
    window.fbq("track", "AddPaymentInfo");
  }
}

/**
 * Track contact event (user reaches out via chat, email, etc.)
 */
export function trackContact(): void {
  if (isFbqAvailable()) {
    window.fbq("track", "Contact");
  }
}

/**
 * Track search events
 * @param searchQuery - The search string entered by user
 */
export function trackSearch(searchQuery: string): void {
  if (isFbqAvailable()) {
    window.fbq("track", "Search", {
      search_string: searchQuery,
    });
  }
}
