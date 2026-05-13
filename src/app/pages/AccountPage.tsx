import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "@/app/context/AuthContext";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { getPlaces, getRatingsByUser, getSavedPlaces } from "@/lib/services/places";
import { normalizeVisitContexts, type PlaceRatingRecord, type PlaceRecord } from "@/types/place";

export function AccountPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, openAuthModal, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [savedPlaces, setSavedPlaces] = useState<PlaceRecord[]>([]);
  const [ratings, setRatings] = useState<PlaceRatingRecord[]>([]);
  const [placeMap, setPlaceMap] = useState<Map<string, PlaceRecord>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setSavedPlaces([]);
      setRatings([]);
      setPlaceMap(new Map());
      return;
    }
    const userId = user.id;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [saved, userRatings, allPlaces] = await Promise.all([
          getSavedPlaces(userId),
          getRatingsByUser(userId),
          getPlaces(),
        ]);

        if (cancelled) return;

        setSavedPlaces(saved);
        setRatings(userRatings);
        setPlaceMap(new Map(allPlaces.map((place) => [place.id, place])));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load account details.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const displayName = useMemo(() => {
    if (profile?.username?.trim()) {
      return profile.username.trim();
    }

    if (user?.username?.trim()) {
      return user.username.trim();
    }

    if (user?.email) {
      return user.email.split("@")[0];
    }

    return "Member";
  }, [profile?.username, user?.email, user?.username]);

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    try {
      await logout();
      navigate("/");
    } finally {
      setSigningOut(false);
    }
  };

  if (authLoading) {
    return (
      <div className="absolute inset-0 overflow-y-auto px-4 py-4 pb-[76px]">
        <LoadingState label="Checking session..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="absolute inset-0 overflow-y-auto space-y-4 bg-[#fbf8f3] px-4 py-4 pb-[76px]">
        <EmptyState title="You are not signed in" message="Sign in to view your account, ratings, and saved places." />
        <button onClick={openAuthModal} className="rounded-full bg-gray-900 px-4 py-2 text-[13px] text-white">
          Sign in with magic link
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto space-y-4 bg-[#fbf8f3] px-4 py-4 pb-[76px]">
      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h1 className="text-[28px] tracking-tight text-gray-900">Account</h1>
        <p className="mt-1 text-[13px] text-gray-500">Email: {user.email}</p>
        <p className="text-[13px] text-gray-500">Username: {displayName}</p>

        <button
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="mt-3 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-[13px] text-red-700 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
      </section>

      {loading ? <LoadingState label="Loading your activity..." /> : null}
      {error ? <EmptyState title="Could not load account data" message={error} /> : null}

      {!loading && !error ? (
        <>
          <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[18px] text-gray-900">Saved places</h2>
              <span className="text-[12px] text-gray-500">{savedPlaces.length}</span>
            </div>

            {savedPlaces.length === 0 ? (
              <p className="text-[13px] text-gray-500">No saved places yet.</p>
            ) : (
              <ul className="space-y-1 text-[13px] text-gray-700">
                {savedPlaces.map((place) => (
                  <li key={place.id}>
                    <Link to={`/places/${place.slug}`} className="hover:text-gray-900">
                      {place.name} · {place.city}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[18px] text-gray-900">Your ratings</h2>
              <span className="text-[12px] text-gray-500">{ratings.length}</span>
            </div>

            {ratings.length === 0 ? (
              <p className="text-[13px] text-gray-500">You have not rated any places yet.</p>
            ) : (
              <ul className="space-y-2">
                {ratings.map((rating) => {
                  const place = placeMap.get(rating.place_id);

                  return (
                    <li key={rating.id} className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-[13px] text-gray-900">{place?.name ?? "Unknown place"}</p>
                      <p className="text-[12px] text-gray-500">
                        {(() => {
                          const contexts = normalizeVisitContexts(rating.visit_contexts ?? rating.visit_context ?? null);
                          return contexts.length > 0 ? contexts.join(" • ") : "Visit context not set";
                        })()}
                      </p>
                      {rating.note ? <p className="mt-1 text-[12px] text-gray-700">{rating.note}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h2 className="text-[18px] text-gray-900">Data deletion request</h2>
        <p className="mt-2 text-[13px] text-gray-600">
          Contact email placeholder: <span className="font-medium">TODO_INSERT_SUPPORT_EMAIL</span>
        </p>
      </section>
    </div>
  );
}
