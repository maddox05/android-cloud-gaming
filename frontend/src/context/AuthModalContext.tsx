import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type AuthMode = "login" | "signup";

interface AuthModalContextValue {
  isAuthModalOpen: boolean;
  authMode: AuthMode;
  startLogin: () => void;
  startSignup: () => void;
  closeAuthModal: () => void;
  setAuthMode: (mode: AuthMode) => void;
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

  return (
    <AuthModalContext.Provider
      value={{
        isAuthModalOpen,
        authMode,
        startLogin,
        startSignup,
        closeAuthModal,
        setAuthMode,
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
