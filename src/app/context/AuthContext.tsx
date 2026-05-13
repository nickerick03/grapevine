import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

import {
  saveAccountFrozenMetadata,
  saveProfileMetadata,
  saveProfilePreferences,
  setAccountFrozen as setAccountFrozenInProfile,
  type ProfilePreferencesInput,
} from "@/lib/services/profile";
import { isAtLeastAge, MINIMUM_REGISTER_AGE } from "@/lib/auth/ageGate";
import { normalizeUsernameInput, validateUsername } from "@/lib/auth/username";
import { getAuthCallbackUrl, getGoogleAuthCallbackUrl, getPasswordResetCallbackUrl } from "@/lib/auth/redirect";
import { supabase } from "@/lib/supabase/client";
import type { ProfileRecord } from "@/types/database";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  profilePhoto?: string;
  city?: string;
  birthDate?: string;
  hideScore?: boolean;
  showPublicNotes?: boolean;
  isFrozen?: boolean;
  isSuperAdmin: boolean;
  canAccessAdmin: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: ProfileRecord | null;
  loading: boolean;
  rememberMe: boolean;
  rememberedEmail: string;
  setRememberMe: (remember: boolean) => void;
  login: (user: AuthUser) => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  saveUserPreferences: (
    input: Omit<ProfilePreferencesInput, "emoji" | "gradientFrom" | "gradientTo" | "profilePhoto"> & {
      emoji?: string;
      gradientFrom?: string;
      gradientTo?: string;
      birthDate?: string;
      profilePhoto?: string;
    },
  ) => Promise<{ error: string | null }>;
  setAccountFrozen: (next: boolean) => Promise<{ error: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    username: string,
    email: string,
    password: string,
    birthDate: string,
  ) => Promise<{ error: string | null; requiresEmailConfirmation: boolean }>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: string | null }>;
  sendMagicLink: (email: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  authModalOpen: boolean;
  authModalInitialTab: "login" | "register";
  openAuthModal: (tab?: "login" | "register") => void;
  closeAuthModal: () => void;
  profileDrawerOpen: boolean;
  openProfileDrawer: () => void;
  closeProfileDrawer: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  rememberMe: true,
  rememberedEmail: "",
  setRememberMe: () => {},
  login: () => {},
  updateUser: () => {},
  saveUserPreferences: async () => ({ error: "Auth provider not initialized." }),
  setAccountFrozen: async () => ({ error: "Auth provider not initialized." }),
  changePassword: async () => ({ error: "Auth provider not initialized." }),
  signInWithPassword: async () => ({ error: "Auth provider not initialized." }),
  signUpWithPassword: async () => ({ error: "Auth provider not initialized.", requiresEmailConfirmation: false }),
  sendPasswordResetEmail: async () => ({ error: "Auth provider not initialized." }),
  sendMagicLink: async () => ({ error: "Auth provider not initialized." }),
  signInWithGoogle: async () => ({ error: "Auth provider not initialized." }),
  logout: async () => {},
  authModalOpen: false,
  authModalInitialTab: "login",
  openAuthModal: () => {},
  closeAuthModal: () => {},
  profileDrawerOpen: false,
  openProfileDrawer: () => {},
  closeProfileDrawer: () => {},
});

const AUTH_REMEMBER_KEY = "grapevine.auth.remember";
const AUTH_EPHEMERAL_KEY = "grapevine.auth.ephemeral";
const AUTH_REMEMBERED_EMAIL_KEY = "grapevine.auth.remembered_email";
const AUTH_CALLBACK_FLOW_HINT_KEY = "grapevine.auth.callbackFlow";
const AUTH_TIMEOUT_MS = 12000;
const PROFILE_TIMEOUT_MS = 8000;

const AVATAR_GRADIENTS = [
  { from: "#F59E0B", to: "#EF4444" },
  { from: "#EF4444", to: "#EC4899" },
  { from: "#8B5CF6", to: "#6366F1" },
  { from: "#10B981", to: "#3B82F6" },
  { from: "#3B82F6", to: "#8B5CF6" },
] as const;

export const AVATAR_EMOJIS = [
  "🦊", "🐻", "🦁", "🐯", "🐺", "🦝", "🦉", "🐧", "🦋", "🌊",
  "🍺", "🎸", "🎩", "👑", "🌈", "🔥", "✨", "🎯", "🏆", "🚀",
  "🌙", "⭐", "🎭", "🌸", "🍀", "🎲", "♟️", "🧙", "🤖", "👻",
  "🦸", "🐉", "🌵", "🍄", "🎪", "💎", "🔮", "🎨", "🌺", "🪐",
] as const;

function randomEmoji(): string {
  return AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
}

function seedEmoji(seed: string): string {
  if (!seed) {
    return randomEmoji();
  }
  const index = Array.from(seed).reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_EMOJIS.length;
  return AVATAR_EMOJIS[index];
}

function buildAvatarPalette(seed: string) {
  const index = seed.charCodeAt(0) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

function displayNameFromEmail(email: string): string {
  return email
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeAuthErrorMessage(message: string): string {
  const raw = message?.trim();
  if (!raw) {
    return "Authentication failed. Please try again.";
  }

  const lower = raw.toLowerCase();

  if (lower.includes("email not confirmed") || lower.includes("email not verified")) {
    return "Please verify your email first. Open the confirmation link we sent, then try logging in again.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Email or password is not correct.";
  }

  if (lower.includes("otp expired") || lower.includes("token has expired") || lower.includes("expired")) {
    return "This sign-in link has expired. Please request a new one.";
  }

  if (lower.includes("token has been used") || lower.includes("already used")) {
    return "This verification link was already used. Please request a new one.";
  }

  return raw;
}

function toAuthUser(supabaseUser: SupabaseUser, profile: ProfileRecord | null): AuthUser {
  const email = supabaseUser.email ?? "unknown@grapevine.local";
  const metadataUsername = typeof supabaseUser.user_metadata?.username === "string"
    ? normalizeUsernameInput(supabaseUser.user_metadata.username)
    : null;
  const resolvedUsername = normalizeUsernameInput(
    profile?.username
    ?? metadataUsername
    ?? displayNameFromEmail(email).replace(/\s+/g, "_").toLowerCase(),
  ) || "grapevine_user";

  const name =
    resolvedUsername ??
    (typeof supabaseUser.user_metadata?.full_name === "string" ? supabaseUser.user_metadata.full_name : undefined) ??
    displayNameFromEmail(email);
  const palette = buildAvatarPalette(supabaseUser.id || email);

  const metadataEmoji = typeof supabaseUser.user_metadata?.emoji === "string"
    ? supabaseUser.user_metadata.emoji
    : null;

  const metadataPhoto = typeof supabaseUser.user_metadata?.profile_photo === "string"
    ? supabaseUser.user_metadata.profile_photo
    : undefined;

  const metadataCity = typeof supabaseUser.user_metadata?.city === "string"
    ? supabaseUser.user_metadata.city
    : "";
  const metadataBirthDate = typeof supabaseUser.user_metadata?.birth_date === "string"
    ? supabaseUser.user_metadata.birth_date
    : "";

  const metadataHideScore = typeof supabaseUser.user_metadata?.hide_score === "boolean"
    ? supabaseUser.user_metadata.hide_score
    : false;
  const metadataShowPublicNotes = typeof supabaseUser.user_metadata?.show_public_notes === "boolean"
    ? supabaseUser.user_metadata.show_public_notes
    : true;
  const metadataIsFrozen = typeof supabaseUser.user_metadata?.is_frozen === "boolean"
    ? supabaseUser.user_metadata.is_frozen
    : false;

  const metadataGradientFrom = typeof supabaseUser.user_metadata?.gradient_from === "string"
    ? supabaseUser.user_metadata.gradient_from
    : null;
  const metadataGradientTo = typeof supabaseUser.user_metadata?.gradient_to === "string"
    ? supabaseUser.user_metadata.gradient_to
    : null;

  const isSuperAdmin = profile?.role === "super_admin";

  return {
    id: supabaseUser.id,
    name,
    username: resolvedUsername,
    email,
    emoji: profile?.emoji ?? metadataEmoji ?? seedEmoji(supabaseUser.id || email),
    gradientFrom: profile?.gradient_from ?? metadataGradientFrom ?? palette.from,
    gradientTo: profile?.gradient_to ?? metadataGradientTo ?? palette.to,
    profilePhoto: profile?.avatar_url ?? metadataPhoto,
    city: profile?.city ?? metadataCity,
    birthDate: profile?.birth_date ?? metadataBirthDate,
    hideScore: profile?.hide_score ?? metadataHideScore,
    showPublicNotes: profile?.show_public_notes ?? metadataShowPublicNotes,
    isFrozen: profile?.is_frozen ?? metadataIsFrozen,
    isSuperAdmin,
    canAccessAdmin: isSuperAdmin,
  };
}

async function loadOwnProfile(userId: string): Promise<ProfileRecord | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (error) {
    console.warn("Failed to load profile:", error.message);
    return null;
  }

  return data;
}

function isProfileMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false;
  }
  return error.code === "42703" || error.message?.toLowerCase().includes("does not exist") || false;
}

function isUniqueUsernameConstraintError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) {
    return false;
  }
  const message = error.message?.toLowerCase() ?? "";
  return error.code === "23505" && message.includes("username");
}

function profileSeedUsername(user: SupabaseUser): string | null {
  const metadataUsername = normalizeUsernameInput(
    typeof user.user_metadata?.username === "string" ? user.user_metadata.username : "",
  );
  if (metadataUsername) {
    return metadataUsername;
  }
  const fallback = normalizeUsernameInput(displayNameFromEmail(user.email ?? "").replace(/\s+/g, "_").toLowerCase());
  return fallback || null;
}

function profileSeedBirthDate(user: SupabaseUser): string | null {
  const metadataBirthDate = typeof user.user_metadata?.birth_date === "string"
    ? user.user_metadata.birth_date.trim()
    : "";
  if (!metadataBirthDate) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadataBirthDate)) {
    return null;
  }
  return metadataBirthDate;
}

async function createOwnProfileFromAuthUser(user: SupabaseUser): Promise<ProfileRecord | null> {
  const username = profileSeedUsername(user);
  const birthDate = profileSeedBirthDate(user);

  const insertCandidate = async (
    payload: { id: string; username?: string | null; birth_date?: string | null },
  ): Promise<{ profile: ProfileRecord | null; shouldRetryWithoutUsername: boolean }> => {
    const { data, error } = await supabase
      .from("profiles")
      .insert(payload)
      .select("*")
      .single();

    if (!error) {
      return { profile: data, shouldRetryWithoutUsername: false };
    }

    if (isProfileMissingColumnError(error)) {
      const fallbackPayload: { id: string; username?: string | null } = {
        id: payload.id,
      };
      if ("username" in payload) {
        fallbackPayload.username = payload.username ?? null;
      }

      const fallbackResult = await supabase
        .from("profiles")
        .insert(fallbackPayload)
        .select("*")
        .single();

      if (!fallbackResult.error) {
        return { profile: fallbackResult.data, shouldRetryWithoutUsername: false };
      }

      if (isUniqueUsernameConstraintError(fallbackResult.error)) {
        return { profile: null, shouldRetryWithoutUsername: true };
      }

      if (fallbackResult.error.code === "23505") {
        const existingProfile = await loadOwnProfile(user.id);
        if (existingProfile) {
          return { profile: existingProfile, shouldRetryWithoutUsername: false };
        }
      }

      throw fallbackResult.error;
    }

    if (isUniqueUsernameConstraintError(error)) {
      return { profile: null, shouldRetryWithoutUsername: true };
    }

    if (error.code === "23505") {
      const existingProfile = await loadOwnProfile(user.id);
      if (existingProfile) {
        return { profile: existingProfile, shouldRetryWithoutUsername: false };
      }
    }

    throw error;
  };

  const initialPayload: { id: string; username?: string | null; birth_date?: string | null } = {
    id: user.id,
  };
  if (username) {
    initialPayload.username = username;
  }
  if (birthDate) {
    initialPayload.birth_date = birthDate;
  }

  const initialResult = await insertCandidate(initialPayload);
  if (initialResult.profile) {
    return initialResult.profile;
  }

  if (initialResult.shouldRetryWithoutUsername) {
    const retryPayload: { id: string; username?: string | null; birth_date?: string | null } = {
      id: user.id,
      username: null,
    };
    if (birthDate) {
      retryPayload.birth_date = birthDate;
    }
    const retryResult = await insertCandidate(retryPayload);
    if (retryResult.profile) {
      return retryResult.profile;
    }
  }

  return loadOwnProfile(user.id);
}

function persistRememberPreference(remember: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(AUTH_REMEMBER_KEY, remember ? "1" : "0");
    if (remember) {
      sessionStorage.removeItem(AUTH_EPHEMERAL_KEY);
    } else {
      sessionStorage.setItem(AUTH_EPHEMERAL_KEY, "1");
    }
  } catch (storageError) {
    console.warn("Failed to persist auth preference:", storageError);
  }
}

async function withAuthTimeout<T>(promise: Promise<T>, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), AUTH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function withProfileTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Profile loading timed out.")), PROFILE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function buildUser(name: string, email: string): AuthUser {
  const palette = buildAvatarPalette(email);
  const fallbackUsername = normalizeUsernameInput(name).replace(/\s+/g, "_").toLowerCase() || "grapevine_user";
  return {
    id: email,
    name,
    username: fallbackUsername,
    email,
    emoji: randomEmoji(),
    gradientFrom: palette.from,
    gradientTo: palette.to,
    city: "",
    hideScore: false,
    showPublicNotes: true,
    isFrozen: false,
    isSuperAdmin: false,
    canAccessAdmin: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [rememberMe, setRememberMeState] = useState(true);
  const [rememberedEmail, setRememberedEmail] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialTab, setAuthModalInitialTab] = useState<"login" | "register">("login");
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);

  async function hydrateFromUser(nextUser: SupabaseUser, options?: { optimistic?: boolean }) {
    if (options?.optimistic) {
      setUser((prev) => {
        const optimistic = toAuthUser(nextUser, null);
        return {
          ...optimistic,
          profilePhoto: optimistic.profilePhoto ?? prev?.profilePhoto,
          city: optimistic.city || prev?.city || "",
          hideScore: optimistic.hideScore ?? prev?.hideScore ?? false,
          showPublicNotes: optimistic.showPublicNotes ?? prev?.showPublicNotes ?? true,
          isFrozen: optimistic.isFrozen ?? prev?.isFrozen ?? false,
          emoji: optimistic.emoji || prev?.emoji || optimistic.emoji,
          gradientFrom: optimistic.gradientFrom || prev?.gradientFrom || optimistic.gradientFrom,
          gradientTo: optimistic.gradientTo || prev?.gradientTo || optimistic.gradientTo,
        };
      });
    }

    try {
      let loadedProfile = await withProfileTimeout(loadOwnProfile(nextUser.id));
      if (!loadedProfile) {
        loadedProfile = await withProfileTimeout(createOwnProfileFromAuthUser(nextUser));
      }
      setProfile(loadedProfile);
      setUser(toAuthUser(nextUser, loadedProfile));
    } catch (profileError) {
      console.warn("Profile hydration skipped:", profileError);
      setProfile(null);
      setUser(toAuthUser(nextUser, null));
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const canUseStorage = typeof window !== "undefined";
      const storedRemember = canUseStorage ? localStorage.getItem(AUTH_REMEMBER_KEY) : null;

      if (storedRemember === "0") {
        setRememberMeState(false);
      } else if (storedRemember === "1") {
        setRememberMeState(true);
      }

      if (canUseStorage) {
        const storedEmail = localStorage.getItem(AUTH_REMEMBERED_EMAIL_KEY);
        if (storedEmail) {
          setRememberedEmail(storedEmail);
        }
      }

      const { data, error } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        console.warn("Failed to fetch auth session:", error.message);
      }

      if (data.session?.user) {
        const hasEphemeralMarker = canUseStorage && sessionStorage.getItem(AUTH_EPHEMERAL_KEY) === "1";
        if (storedRemember === "0" && !hasEphemeralMarker) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
        } else {
          await hydrateFromUser(data.session.user, { optimistic: true });
        }
      } else {
        setUser(null);
        setProfile(null);
      }

      if (active) {
        setLoading(false);
      }
    }

    bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      if (session?.user) {
        void hydrateFromUser(session.user, { optimistic: true });
      } else {
        setUser(null);
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = (nextUser: AuthUser) => {
    setUser(nextUser);
    setAuthModalOpen(false);
  };

  const updateUser = (partial: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const saveUserPreferences: AuthContextType["saveUserPreferences"] = async (input) => {
    if (!user) {
      return { error: "You need to be logged in." };
    }

    const payload: ProfilePreferencesInput = {
      username: input.username,
      city: input.city,
      hideScore: input.hideScore,
      showPublicNotes: input.showPublicNotes ?? user.showPublicNotes ?? true,
      emoji: input.emoji ?? user.emoji,
      gradientFrom: input.gradientFrom ?? user.gradientFrom,
      gradientTo: input.gradientTo ?? user.gradientTo,
      birthDate: input.birthDate ?? user.birthDate,
      profilePhoto: input.profilePhoto,
    };

    try {
      const nextProfile = await saveProfilePreferences(user.id, payload);
      setProfile(nextProfile);

      try {
        await saveProfileMetadata(payload);
      } catch (metadataError) {
        console.warn("Failed to save auth metadata:", metadataError);
      }

      setUser((prev) =>
        prev
          ? {
              ...prev,
              username: payload.username.replace(/^@+/, "").trim(),
              city: payload.city.trim(),
              ...(payload.birthDate !== undefined ? { birthDate: payload.birthDate.trim() || undefined } : {}),
              hideScore: payload.hideScore,
              showPublicNotes: payload.showPublicNotes,
              emoji: payload.emoji,
              gradientFrom: payload.gradientFrom,
              gradientTo: payload.gradientTo,
              ...(payload.profilePhoto !== undefined ? { profilePhoto: payload.profilePhoto } : {}),
            }
          : prev,
      );

      return { error: null };
    } catch (err) {
      const message =
        err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505"
          ? "This username is already taken."
          : err instanceof Error
            ? err.message
            : "Failed to save your profile.";
      return { error: message };
    }
  };

  const setAccountFrozen: AuthContextType["setAccountFrozen"] = async (next) => {
    if (!user) {
      return { error: "You need to be logged in." };
    }

    try {
      const nextProfile = await setAccountFrozenInProfile(user.id, next);
      setProfile(nextProfile);

      try {
        await saveAccountFrozenMetadata(next);
      } catch (metadataError) {
        console.warn("Failed to save freeze metadata:", metadataError);
      }

      setUser((prev) => (prev ? { ...prev, isFrozen: next } : prev));
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update account freeze state.";
      return { error: message };
    }
  };

  const changePassword: AuthContextType["changePassword"] = async (currentPassword, newPassword) => {
    if (!user?.email) {
      return { error: "You need to be logged in." };
    }

    try {
      const verifyResult = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (verifyResult.error) {
        return { error: "Current password is not correct." };
      }

      const updateResult = await supabase.auth.updateUser({ password: newPassword });
      if (updateResult.error) {
        return { error: updateResult.error.message };
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Password update failed.";
      return { error: message };
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    try {
      const { data, error } = await withAuthTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        "Login is taking too long. Please check your connection and try again.",
      );

      if (error) {
        return { error: normalizeAuthErrorMessage(error.message) };
      }

      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        return {
          error: "Please verify your email first. Open the confirmation link we sent, then try again.",
        };
      }

      persistRememberPreference(rememberMe);
      if (typeof window !== "undefined") {
        try {
          if (rememberMe) {
            localStorage.setItem(AUTH_REMEMBERED_EMAIL_KEY, email);
            setRememberedEmail(email);
          } else {
            localStorage.removeItem(AUTH_REMEMBERED_EMAIL_KEY);
            setRememberedEmail("");
          }
        } catch (storageError) {
          console.warn("Failed to persist remembered email:", storageError);
        }
      }

      if (data.user) {
        await hydrateFromUser(data.user, { optimistic: true });
      }

      setAuthModalOpen(false);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      return { error: message };
    }
  };

  const signUpWithPassword = async (usernameInput: string, email: string, password: string, birthDate: string) => {
    try {
      const callbackUrl = getAuthCallbackUrl();
      const emoji = randomEmoji();
      const username = normalizeUsernameInput(usernameInput);
      const normalizedBirthDate = birthDate.trim();
      const usernameError = validateUsername(username);

      if (usernameError) {
        return {
          error: usernameError,
          requiresEmailConfirmation: false,
        };
      }

      if (!isAtLeastAge(normalizedBirthDate, MINIMUM_REGISTER_AGE)) {
        return {
          error: `You must be at least ${MINIMUM_REGISTER_AGE} years old to register.`,
          requiresEmailConfirmation: false,
        };
      }

      const { data, error } = await withAuthTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl,
            data: {
              username: username,
              emoji,
              city: "",
              hide_score: false,
              show_public_notes: true,
              is_frozen: false,
              birth_date: normalizedBirthDate,
            },
          },
        }),
        "Sign-up is taking too long. Please check your connection and try again.",
      );

      if (error) {
        return { error: normalizeAuthErrorMessage(error.message), requiresEmailConfirmation: false };
      }

      const requiresEmailConfirmation = !data.session;

      if (data.user && data.session && !data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        return {
          error: null,
          requiresEmailConfirmation: true,
        };
      }

      if (data.user && data.session) {
        persistRememberPreference(rememberMe);
        if (typeof window !== "undefined") {
          try {
            if (rememberMe) {
              localStorage.setItem(AUTH_REMEMBERED_EMAIL_KEY, email);
              setRememberedEmail(email);
            } else {
              localStorage.removeItem(AUTH_REMEMBERED_EMAIL_KEY);
              setRememberedEmail("");
            }
          } catch (storageError) {
            console.warn("Failed to persist remembered email:", storageError);
          }
        }
        await hydrateFromUser(data.user, { optimistic: true });
        setAuthModalOpen(false);
      }

      return { error: null, requiresEmailConfirmation };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-up failed. Please try again.";
      return { error: message, requiresEmailConfirmation: false };
    }
  };

  const sendMagicLink = async (email: string) => {
    try {
      const callbackUrl = getAuthCallbackUrl();
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: callbackUrl,
          },
        }),
        "Magic-link request is taking too long. Please try again.",
      );

      if (error) {
        return { error: normalizeAuthErrorMessage(error.message) };
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Magic-link sign-in failed. Please try again.";
      return { error: message };
    }
  };

  const sendPasswordResetEmail = async (email: string) => {
    try {
      const callbackUrl = getPasswordResetCallbackUrl();
      const { error } = await withAuthTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: callbackUrl,
        }),
        "Password reset request is taking too long. Please try again.",
      );

      if (error) {
        return { error: normalizeAuthErrorMessage(error.message) };
      }

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send password reset email.";
      return { error: message };
    }
  };

  const signInWithGoogle: AuthContextType["signInWithGoogle"] = async () => {
    try {
      persistRememberPreference(rememberMe);
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(AUTH_CALLBACK_FLOW_HINT_KEY, "google");
        } catch (storageError) {
          console.warn("Failed to persist auth callback flow hint:", storageError);
        }
      }

      const callbackUrl = getGoogleAuthCallbackUrl();
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: callbackUrl,
            queryParams: {
              prompt: "select_account",
            },
          },
        }),
        "Google sign-in is taking too long. Please try again.",
      );

      if (error) {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(AUTH_CALLBACK_FLOW_HINT_KEY);
        }
        return { error: normalizeAuthErrorMessage(error.message) };
      }

      return { error: null };
    } catch (err) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(AUTH_CALLBACK_FLOW_HINT_KEY);
      }
      const message = err instanceof Error ? err.message : "Google sign-in failed. Please try again.";
      return { error: message };
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn("Failed to sign out:", error.message);
    }

    setUser(null);
    setProfile(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(AUTH_EPHEMERAL_KEY);
      if (!rememberMe) {
        localStorage.removeItem(AUTH_REMEMBERED_EMAIL_KEY);
        setRememberedEmail("");
      }
    }
    setAuthModalOpen(false);
    setProfileDrawerOpen(false);
  };

  const setRememberMe = (remember: boolean) => {
    setRememberMeState(remember);
    if (typeof window === "undefined") {
      return;
    }
    try {
      localStorage.setItem(AUTH_REMEMBER_KEY, remember ? "1" : "0");
      if (!remember) {
        localStorage.removeItem(AUTH_REMEMBERED_EMAIL_KEY);
        setRememberedEmail("");
      }
    } catch (storageError) {
      console.warn("Failed to persist remember-me preference:", storageError);
    }
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      rememberMe,
      rememberedEmail,
      setRememberMe,
      login,
      updateUser,
      saveUserPreferences,
      setAccountFrozen,
      changePassword,
      signInWithPassword,
      signUpWithPassword,
      sendPasswordResetEmail,
      sendMagicLink,
      signInWithGoogle,
      logout,
      authModalOpen,
      authModalInitialTab,
      openAuthModal: (tab: "login" | "register" = "login") => {
        setAuthModalInitialTab(tab);
        setAuthModalOpen(true);
      },
      closeAuthModal: () => setAuthModalOpen(false),
      profileDrawerOpen,
      openProfileDrawer: () => setProfileDrawerOpen(true),
      closeProfileDrawer: () => setProfileDrawerOpen(false),
    }),
    [authModalInitialTab, authModalOpen, loading, profile, profileDrawerOpen, rememberMe, rememberedEmail, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
