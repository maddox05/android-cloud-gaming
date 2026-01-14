import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";

type AuthMode = "login" | "signup" | "link-google" | "link-azure" | "link-email";

interface AuthModalContextValue {
  isAuthModalOpen: boolean;
  authMode: AuthMode;
  startLogin: () => void;
  startSignup: () => void;
  closeAuthModal: () => void;
  setAuthMode: (mode: AuthMode) => void;
  startLinkGoogle: () => void;
  startLinkAzure: () => void;
  startLinkEmail: () => void;
  isLinkMode: boolean;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const startLogin = useCallback(() => {
    setAuthMode("login");
    setIsAuthModalOpen(true);
  }, []);

  const startSignup = useCallback(() => {
    setAuthMode("signup");
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const startLinkGoogle = useCallback(() => {
    setAuthMode("link-google");
    setIsAuthModalOpen(true);
  }, []);

  const startLinkAzure = useCallback(() => {
    setAuthMode("link-azure");
    setIsAuthModalOpen(true);
  }, []);

  const startLinkEmail = useCallback(() => {
    setAuthMode("link-email");
    setIsAuthModalOpen(true);
  }, []);

  const isLinkMode = useMemo(() => authMode.startsWith("link-"), [authMode]);

  return (
    <AuthModalContext.Provider
      value={{
        isAuthModalOpen,
        authMode,
        startLogin,
        startSignup,
        closeAuthModal,
        setAuthMode,
        startLinkGoogle,
        startLinkAzure,
        startLinkEmail,
        isLinkMode,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return context;
}
