import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type AuthMode = "login" | "signup";

interface AuthContextValue {
  isAuthModalOpen: boolean;
  authMode: AuthMode;
  startLogin: () => void;
  startSignup: () => void;
  closeAuthModal: () => void;
  setAuthMode: (mode: AuthMode) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
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
    <AuthContext.Provider
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
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
