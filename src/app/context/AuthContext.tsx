import { createContext, useContext, useState, ReactNode } from "react";

export interface AuthUser {
  name: string;
  email: string;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  profilePhoto?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
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
  updateUser: () => {},
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

export const AVATAR_EMOJIS = [
  "🦊","🐻","🦁","🐯","🐺","🦝","🦉","🐧","🦋","🌊",
  "🍺","🎸","🎩","👑","🌈","🔥","✨","🎯","🏆","🚀",
  "🌙","⭐","🎭","🌸","🍀","🎲","♟️","🧙","🤖","👻",
  "🦸","🐉","🌵","🍄","🎪","💎","🔮","🎨","🌺","🪐",
];

export function buildUser(name: string, email: string): AuthUser {
  const idx = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  // pick a random emoji each time a new user is created
  const emoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
  return {
    name,
    email,
    emoji,
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

  const updateUser = (partial: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        updateUser,
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