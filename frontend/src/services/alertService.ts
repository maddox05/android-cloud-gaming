export type AlertType = "error" | "warning" | "info";

export interface AlertOptions {
  type?: AlertType;
  title?: string;
  message: string;
  link?: { href: string; label: string };
  onCloseRedirect?: string;
  onDismiss?: () => void;
}

type AlertListener = (options: AlertOptions | null) => void;

let listener: AlertListener | null = null;

export function subscribeToAlerts(callback: AlertListener): () => void {
  listener = callback;
  return () => {
    listener = null;
  };
}

export function showAlert(options: AlertOptions): void {
  if (listener) {
    listener({ type: "error", ...options });
  }
}

export function hideAlert(): void {
  if (listener) {
    listener(null);
  }
}
