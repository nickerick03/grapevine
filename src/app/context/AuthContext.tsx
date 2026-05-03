import { createContext, useContext, useState, ReactNode } from "react";

export interface AuthUser {
  name: string;
  email: string;
  initials: string;
  gradientFrom: string;
  gradientTo: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  profileDrawerOpen: boolean;
  openProfileDrawer: () => void;
  closeProfileDrawer: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  authModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  profileDrawerOpen: false,
  openProfileDrawer: () => {},
  closeProfileDrawer: () => {},
});

const AVATAR_GRADIENTS = [
  { from: "#F59E0B", to: "#EF4444" },
  { from: "#EF4444", to: "#EC4899" },
  { from: "#8B5CF6", to: "#6366F1" },
  { from: "#10B981", to: "#3B82F6" },
  { from: "#3B82F6", to: "#8B5CF6" },
];

export function buildUser(name: string, email: string): AuthUser {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const idx = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return {
    name,
    email,
    initials,
    gradientFrom: AVATAR_GRADIENTS[idx].from,
    gradientTo: AVATAR_GRADIENTS[idx].to,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);

  const login = (u: AuthUser) => {
    setUser(u);
    setAuthModalOpen(false);
  };

  const logout = () => {
    setUser(null);
    setProfileDrawerOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        authModalOpen,
        openAuthModal: () => setAuthModalOpen(true),
        closeAuthModal: () => setAuthModalOpen(false),
        profileDrawerOpen,
        openProfileDrawer: () => setProfileDrawerOpen(true),
        closeProfileDrawer: () => setProfileDrawerOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
