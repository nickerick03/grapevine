import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  ArrowLeft,
  Bookmark,
  Share2,
  Plus,
  MapPin as MapPinLucide,
  Navigation,
  Clock3,
  Phone,
  Mail,
  Globe,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Pencil,
  Trash2,
  History,
  X,
  CheckCircle2,
} from "lucide-react";
import { DotsThree } from "@phosphor-icons/react";
import { divIcon } from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { SLIDERS, type Pub } from "../vibe";
import { VibeSlider } from "../VibeSlider";
import { PubCard } from "../PubCard";
import { VenueImage } from "../VenueImage";
import { AdUnit } from "../AdUnit";
import { useAuth } from "../../context/AuthContext";
import { usePlaces } from "../../context/PlacesContext";
import { useUI } from "../../context/UIContext";
import { calculateStrictSimilarityMatch } from "../similarityScore";
import { formatPubAddress } from "../placeAddress";
import { getTraitPillSlug } from "@/lib/chips";
import {
  clearNoteVote,
  flagNote,
  getPlaceNoteFeed,
  getSavedPlaceIds,
  removeOwnRatingNote,
  savePlace,
  setNoteVote,
  updateOwnRatingNote,
  unsavePlace,
} from "@/lib/services/places";
import { getMatchPillLabel, getMatchPillStyle, isPerfectMatch } from "../matchColors";
import type { NoteFlagReason, NoteVote, PlaceNoteCard } from "@/types/place";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const detailMarkerIcon = divIcon({
  className: "",
  html: "<div style='width:14px;height:14px;border-radius:999px;background:#111827;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.24);'></div>",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function confidence(n: number) {
  if (n === 0) return { label: "No ratings yet", color: "text-gray-700 bg-gray-50 border-gray-200" };
  if (n <= 9) return { label: "Low confidence", color: "text-amber-700 bg-amber-50 border-amber-200" };
  if (n <= 49) return { label: "Medium confidence", color: "text-blue-700 bg-blue-50 border-blue-200" };
  return { label: "High confidence", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
}

function toPriceRangeLabel(value: 1 | 2 | 3 | 4 | null): string {
  if (value === 1) return "Low";
  if (value === 2) return "Moderate";
  if (value === 3) return "High";
  if (value === 4) return "Very high";
  return "Not enough data yet";
}

function formatNoteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function DetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, openAuthModal } = useAuth();
  const { openRate } = useUI();
  const { pubs } = usePlaces();
  const { id } = useParams<{ id: string }>();
  const externalPubFromState = (location.state as { externalPub?: Pub } | null)?.externalPub;
  const pub = useMemo(() => {
    const dbPub = pubs.find((p) => p.id === id);
    if (dbPub) {
      return dbPub;
    }
    if (externalPubFromState && externalPubFromState.id === id) {
      return externalPubFromState;
    }
    return null;
  }, [externalPubFromState, id, pubs]);
  const conf = confidence(pub?.ratings ?? 0);
  const perfectMatch = isPerfectMatch(pub?.match ?? 0, pub?.perfectMatch);
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState<PlaceNoteCard[]>([]);
  const [pendingNoteIds, setPendingNoteIds] = useState<Record<string, boolean>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState("");
  const [originalNotePreview, setOriginalNotePreview] = useState<{
    username: string;
    original: string;
    current: string;
  } | null>(null);
  const [reportModalNote, setReportModalNote] = useState<PlaceNoteCard | null>(null);
  const [reportReason, setReportReason] = useState<NoteFlagReason>("incorrect");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const similarScored: Pub[] = useMemo(() => {
    if (!pub) {
      return [];
    }

    if (pub.ratings <= 0) {
      return [];
    }

    return pubs
      .filter((entry) => entry.id !== pub.id && entry.ratings > 0)
      .map((entry) => ({
        ...entry,
        match: calculateStrictSimilarityMatch(pub.vibe, entry.vibe),
      }))
      .sort((a, b) => {
        const sameCityA = a.city === pub.city ? 1 : 0;
        const sameCityB = b.city === pub.city ? 1 : 0;

        if (sameCityA !== sameCityB) {
          return sameCityB - sameCityA;
        }

        const sameVenueTypeA = a.venueType && pub.venueType && a.venueType === pub.venueType ? 1 : 0;
        const sameVenueTypeB = b.venueType && pub.venueType && b.venueType === pub.venueType ? 1 : 0;

        if (sameVenueTypeA !== sameVenueTypeB) {
          return sameVenueTypeB - sameVenueTypeA;
        }

        return b.match - a.match;
      });
  }, [pub, pubs]);

  const similarHighMatch = useMemo(
    () => similarScored.filter((entry) => entry.match >= 80).slice(0, 6),
    [similarScored],
  );
  const fullAddress = useMemo(() => {
    if (!pub) {
      return "";
    }
    const area = pub.address?.trim() || pub.area.trim();
    return [area, pub.city, pub.country].filter(Boolean).join(", ");
  }, [pub]);

  const directionsQuery = useMemo(
    () => (pub ? `${pub.lat},${pub.lng}` : ""),
    [pub],
  );

  const openPill = (pill: string) => {
    navigate(`/pill/${getTraitPillSlug(pill)}`);
  };

  const contact = useMemo(() => {
    if (!pub) {
      return {
        openingHours: null,
        phone: null,
        email: null,
        website: null,
        websiteHref: null,
        hasAny: false,
      };
    }

    const openingHours = pub.openingHours?.trim() || null;
    const phone = pub.phone?.trim() || null;
    const email = pub.email?.trim() || null;
    const website = pub.website?.trim() || null;

    const websiteHref = website
      ? website.startsWith("http://") || website.startsWith("https://")
        ? website
        : `https://${website}`
      : null;

    return {
      openingHours,
      phone,
      email,
      website,
      websiteHref,
      hasAny: Boolean(openingHours || phone || email || websiteHref),
    };
  }, [pub]);

  useEffect(() => {
    if (!pub || pub.isExternalCandidate) {
      setComments([]);
      setPendingNoteIds({});
      setEditingNoteId(null);
      setEditingNoteValue("");
      setOriginalNotePreview(null);
      return;
    }

    const placeId = pub.id;
    let cancelled = false;

    async function loadComments() {
      try {
        const notes = await getPlaceNoteFeed(placeId, 30);
        if (!cancelled) {
          setComments(notes);
        }
      } catch {
        if (!cancelled) {
          setComments([]);
          setPendingNoteIds({});
          setEditingNoteId(null);
          setEditingNoteValue("");
          setOriginalNotePreview(null);
        }
      }
    }

    loadComments();
    return () => {
      cancelled = true;
    };
  }, [pub]);

  useEffect(() => {
    if (!user || !pub || pub.isExternalCandidate) {
      setSaved(false);
      return;
    }
    const userId = user.id;
    const placeId = pub.id;
    let cancelled = false;

    async function loadSavedState() {
      try {
        const savedIds = await getSavedPlaceIds(userId);
        if (!cancelled) {
          setSaved(savedIds.includes(placeId));
        }
      } catch {
        if (!cancelled) {
          setSaved(false);
        }
      }
    }

    loadSavedState();
    return () => {
      cancelled = true;
    };
  }, [pub, user]);

  const toggleSaved = async () => {
    if (!pub) return;
    if (pub.isExternalCandidate) return;
    if (!user) {
      openAuthModal();
      return;
    }

    const next = !saved;
    setSaved(next);

    try {
      if (next) {
        await savePlace(user.id, pub.id);
      } else {
        await unsavePlace(user.id, pub.id);
      }
    } catch {
      setSaved(!next);
    }
  };

  const handleAddRating = () => {
    if (!pub) return;

    if (pub.isExternalCandidate && pub.sourceProvider === "osm" && pub.sourcePlaceId) {
      openRate(pub.id, {
        sourceProvider: "osm",
        sourcePlaceId: pub.sourcePlaceId,
        name: pub.name,
        category: pub.category ?? "bar",
        venueType: pub.venueType ?? "bar",
        priceRange: null,
        address: pub.address ?? pub.area,
        city: pub.city,
        country: pub.country ?? "Hungary",
        latitude: pub.lat,
        longitude: pub.lng,
        imageUrl: pub.image,
        openingHours: pub.openingHours ?? null,
        phone: pub.phone ?? null,
        email: pub.email ?? null,
        website: pub.website ?? null,
      });
      return;
    }

    navigate(`/rate/${pub.id}`);
  };

  const handleGetDirections = () => {
    if (!pub) return;
    const popout = window.open("", "_blank", "noopener,noreferrer");

    const destination = `${pub.lat},${pub.lng}`;
    const target = new URL("https://www.google.com/maps/dir/");
    target.searchParams.set("api", "1");
    target.searchParams.set("destination", destination);
    target.searchParams.set("travelmode", "walking");
    target.searchParams.set("dir_action", "navigate");

    const openTarget = (origin?: { lat: number; lng: number }) => {
      if (origin) {
        target.searchParams.set("origin", `${origin.lat},${origin.lng}`);
      }
      const nextUrl = target.toString();
      if (popout && !popout.closed) {
        popout.location.replace(nextUrl);
      } else {
        window.open(nextUrl, "_blank", "noopener,noreferrer");
      }
    };

    if (!navigator.geolocation) {
      openTarget();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        openTarget({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        openTarget();
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 120000,
      },
    );
  };

  const setNotePending = (ratingId: string, pending: boolean) => {
    setPendingNoteIds((previous) => {
      if (!pending) {
        const next = { ...previous };
        delete next[ratingId];
        return next;
      }
      return { ...previous, [ratingId]: true };
    });
  };

  const handleOpenNoteUser = (username: string) => {
    const normalized = username.replace(/^@+/, "").trim();
    if (!normalized) {
      return;
    }
    navigate(`/profile/${encodeURIComponent(normalized)}`);
  };

  const handleNoteVote = async (ratingId: string, vote: -1 | 1) => {
    if (!user) {
      openAuthModal();
      return;
    }

    if (pendingNoteIds[ratingId]) {
      return;
    }

    const snapshot = comments;
    let nextVote: NoteVote = 0;

    setNotePending(ratingId, true);
    setComments((previous) =>
      previous.map((entry) => {
        if (entry.rating_id !== ratingId) {
          return entry;
        }

        const prevVote = entry.my_vote;
        nextVote = prevVote === vote ? 0 : vote;

        let upvotes = entry.upvotes;
        let downvotes = entry.downvotes;

        if (prevVote === 1) upvotes = Math.max(0, upvotes - 1);
        if (prevVote === -1) downvotes = Math.max(0, downvotes - 1);
        if (nextVote === 1) upvotes += 1;
        if (nextVote === -1) downvotes += 1;

        return {
          ...entry,
          upvotes,
          downvotes,
          my_vote: nextVote,
        };
      }),
    );

    try {
      if (nextVote === 0) {
        await clearNoteVote(user.id, ratingId);
      } else {
        await setNoteVote(user.id, ratingId, nextVote);
      }
    } catch {
      setComments(snapshot);
    } finally {
      setNotePending(ratingId, false);
    }
  };

  const handleNoteFlag = async (ratingId: string) => {
    if (!user) {
      openAuthModal();
      return;
    }

    if (pendingNoteIds[ratingId]) {
      return;
    }

    setNotePending(ratingId, true);

    try {
      await flagNote(user.id, ratingId, reportReason, reportDetails);
      setComments((previous) =>
        previous.map((entry) => (
          entry.rating_id === ratingId ? { ...entry, flagged_by_me: true } : entry
        )),
      );
      setReportModalNote(null);
      setReportDetails("");
      setReportReason("incorrect");
      setReportSuccess("Thanks. Your report was submitted.");
      window.setTimeout(() => setReportSuccess(null), 2400);
      setReportError(null);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Could not submit the report.");
    } finally {
      setNotePending(ratingId, false);
    }
  };

  useEffect(() => {
    if (!reportModalNote) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReportModalNote(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [reportModalNote]);

  const beginNoteEdit = (entry: PlaceNoteCard) => {
    if (!user || user.id !== entry.user_id) {
      return;
    }
    setEditingNoteId(entry.rating_id);
    setEditingNoteValue(entry.note);
  };

  const cancelNoteEdit = () => {
    setEditingNoteId(null);
    setEditingNoteValue("");
  };

  const saveNoteEdit = async (entry: PlaceNoteCard) => {
    if (!user) {
      openAuthModal();
      return;
    }

    if (pendingNoteIds[entry.rating_id]) {
      return;
    }

    const nextNote = editingNoteValue.trim().slice(0, 160);
    if (!nextNote) {
      return;
    }

    const snapshot = comments;
    const editedAtIso = new Date().toISOString();

    setNotePending(entry.rating_id, true);
    setComments((previous) =>
      previous.map((item) => {
        if (item.rating_id !== entry.rating_id) {
          return item;
        }

        return {
          ...item,
          note: nextNote,
          note_original: item.note_original ?? item.note,
          note_edited_at: item.note_edited_at ?? editedAtIso,
          noted_at: editedAtIso,
          is_edited: true,
        };
      }),
    );

    try {
      const saved = await updateOwnRatingNote(user.id, entry.rating_id, nextNote);
      setComments((previous) =>
        previous.map((item) => {
          if (item.rating_id !== entry.rating_id) {
            return item;
          }

          return {
            ...item,
            note: saved.note,
            note_original: saved.note_original ?? item.note_original ?? entry.note,
            note_edited_at: saved.note_edited_at ?? item.note_edited_at ?? editedAtIso,
            noted_at: saved.noted_at ?? item.noted_at,
            is_edited: Boolean(saved.note_original ?? saved.note_edited_at ?? item.note_original ?? item.note_edited_at),
          };
        }),
      );
      setEditingNoteId(null);
      setEditingNoteValue("");
    } catch {
      setComments(snapshot);
    } finally {
      setNotePending(entry.rating_id, false);
    }
  };

  const removeNote = async (entry: PlaceNoteCard) => {
    if (!user) {
      openAuthModal();
      return;
    }

    if (user.id !== entry.user_id || pendingNoteIds[entry.rating_id]) {
      return;
    }

    const confirmed = window.confirm("Remove this note from the place page?");
    if (!confirmed) {
      return;
    }

    const snapshot = comments;
    setNotePending(entry.rating_id, true);
    setComments((previous) => previous.filter((item) => item.rating_id !== entry.rating_id));

    try {
      await removeOwnRatingNote(user.id, entry.rating_id);
    } catch {
      setComments(snapshot);
    } finally {
      setNotePending(entry.rating_id, false);
      if (editingNoteId === entry.rating_id) {
        setEditingNoteId(null);
        setEditingNoteValue("");
      }
    }
  };

  if (!pub) {
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-gray-900">Place not found</div>
          <button onClick={() => navigate("/")} className="mt-3 rounded-full bg-gray-900 px-4 py-2 text-white text-[13px]">
            Back to explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#fbf8f3]">
      <div className="relative h-64">
        <VenueImage pub={pub} alt={pub.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#fbf8f3]" />
        <button
          onClick={() => navigate(-1 as any)}
          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="absolute top-3 right-3 flex gap-2">
        <button
          onClick={toggleSaved}
          disabled={pub.isExternalCandidate}
          className={`w-9 h-9 rounded-full flex items-center justify-center shadow transition-colors ${
              pub.isExternalCandidate
                ? "bg-white/60 text-gray-400 cursor-not-allowed"
                : saved
                  ? "bg-gray-900 text-white"
                  : "bg-white/95 text-gray-900"
            }`}
            title={pub.isExternalCandidate ? "Save becomes available after first rating" : saved ? "Remove from saved places" : "Save this place"}
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="-mt-10 relative px-4 pb-8">
        {/* Rate button — above the info card */}
        <button
          onClick={handleAddRating}
          className="w-full mb-3 py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add your rating
        </button>
        {!pub.isExternalCandidate ? (
          <button
            onClick={() => navigate(`/similar/${pub.id}`)}
            className="w-full mb-3 py-3 rounded-2xl bg-gray-900 text-white shadow-sm flex items-center justify-center gap-2"
          >
            Find similar places
          </button>
        ) : null}

        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-gray-900 text-lg">{pub.name}</div>
              <div className="text-[13px] text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPinLucide className="w-3.5 h-3.5" /> {formatPubAddress(pub)}
              </div>
            </div>
            {pub.ratings > 0 ? (
              <div
                className={`px-2.5 py-1 rounded-full border whitespace-nowrap ${
                  perfectMatch ? "perfect-match-pill text-[11px] tracking-wide font-semibold" : "text-[12px]"
                }`}
                style={getMatchPillStyle(pub.match, pub.perfectMatch)}
              >
                <span>{getMatchPillLabel(pub.match, pub.perfectMatch)}</span>
              </div>
            ) : (
              <div className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 text-[12px] border border-gray-200">
                Unrated
              </div>
            )}
          </div>

          <div className="mt-3">
            {pub.chips.length > 0 ? (
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {pub.chips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => openPill(chip)}
                    className="text-[11px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="text-[12px] text-gray-500 mb-1.5">Recent notes</div>
            {comments.length === 0 ? (
              <div className="p-3 rounded-2xl bg-gray-50 text-center">
                <div className="text-[13px] text-gray-800">No community notes yet</div>
                <div className="text-[12px] text-gray-500 mt-1">
                  Be the first to leave a short impression after rating this place.
                </div>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 snap-x snap-mandatory touch-pan-x">
                {comments.map((c) => {
                  const isMine = user?.id === c.user_id;
                  const isEditing = editingNoteId === c.rating_id;
                  const canShowOriginal = Boolean(c.is_edited);

                  return (
                    <div key={c.rating_id} className="min-w-[86%] snap-start p-3 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenNoteUser(c.username)}
                          className="text-[13px] text-gray-900 truncate hover:underline underline-offset-2 text-left flex-1 min-w-0"
                        >
                          @{c.username.replace(/^@+/, "")}
                        </button>
                        <div className="text-[11px] text-gray-500 whitespace-nowrap">{formatNoteDate(c.noted_at)}</div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              disabled={pendingNoteIds[c.rating_id]}
                              className="h-7 w-7 rounded-full border border-gray-200 bg-white text-gray-600 inline-flex items-center justify-center disabled:opacity-60"
                              aria-label="More note options"
                            >
                              <DotsThree className="w-4 h-4" weight="bold" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            side="bottom"
                            sideOffset={8}
                            className="z-[120] min-w-[176px] rounded-xl border-gray-200"
                          >
                            {canShowOriginal ? (
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault();
                                  setOriginalNotePreview({
                                    username: c.username,
                                    original: c.note_original ?? "Original note is unavailable for this older edit.",
                                    current: c.note,
                                  });
                                }}
                                className="text-[12px]"
                              >
                                <History className="w-3.5 h-3.5" />
                                Show original
                              </DropdownMenuItem>
                            ) : null}

                            {isMine ? (
                              <>
                                {canShowOriginal ? <DropdownMenuSeparator /> : null}
                                <DropdownMenuItem
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    beginNoteEdit(c);
                                  }}
                                  className="text-[12px]"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit note
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    void removeNote(c);
                                  }}
                                  className="text-[12px] text-rose-700 focus:text-rose-700"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Remove note
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                {canShowOriginal ? <DropdownMenuSeparator /> : null}
                                {c.flagged_by_me ? (
                                  <DropdownMenuItem
                                    disabled
                                    className="text-[12px] text-emerald-700 data-[disabled]:opacity-100"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Already reported
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      setReportReason("incorrect");
                                      setReportDetails("");
                                      setReportError(null);
                                      setReportModalNote(c);
                                    }}
                                    className="text-[12px]"
                                  >
                                    <Flag className="w-3.5 h-3.5" />
                                    Report note
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {isEditing ? (
                        <div className="mt-1.5">
                          <textarea
                            value={editingNoteValue}
                            onChange={(event) => setEditingNoteValue(event.target.value.slice(0, 160))}
                            rows={3}
                            maxLength={160}
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-800 outline-none focus:border-gray-300 resize-none"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="text-[11px] text-gray-500">{editingNoteValue.length}/160</div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={cancelNoteEdit}
                                className="h-7 px-2.5 rounded-full border border-gray-200 bg-white text-[11px] text-gray-600"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void saveNoteEdit(c);
                                }}
                                disabled={pendingNoteIds[c.rating_id] || editingNoteValue.trim().length === 0}
                                className="h-7 px-2.5 rounded-full bg-gray-900 text-white text-[11px] disabled:opacity-60"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[13px] text-gray-700 mt-1">{c.note}</div>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-gray-200 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleNoteVote(c.rating_id, 1)}
                          disabled={pendingNoteIds[c.rating_id]}
                          className={`h-7 px-2 rounded-full border text-[11px] inline-flex items-center gap-1 ${
                            c.my_vote === 1
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "bg-white border-gray-200 text-gray-600"
                          } disabled:opacity-60`}
                          aria-label="Upvote note"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          {c.upvotes}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNoteVote(c.rating_id, -1)}
                          disabled={pendingNoteIds[c.rating_id]}
                          className={`h-7 px-2 rounded-full border text-[11px] inline-flex items-center gap-1 ${
                            c.my_vote === -1
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : "bg-white border-gray-200 text-gray-600"
                          } disabled:opacity-60`}
                          aria-label="Downvote note"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          {c.downvotes}
                        </button>
                        {c.is_edited ? (
                          <span
                            className="ml-auto inline-flex items-center gap-1 text-[10px] text-gray-500"
                            title="This note was edited"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                            edited
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {contact.hasAny ? (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="text-[12px] text-gray-500 mb-2">Contact info</div>
              <div className="space-y-1.5">
                {contact.openingHours ? (
                  <div className="flex items-center gap-2 text-[13px] text-gray-700">
                    <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-600 inline-flex items-center justify-center">
                      <Clock3 className="w-3.5 h-3.5" />
                    </span>
                    <span>{contact.openingHours}</span>
                  </div>
                ) : null}
                {contact.phone ? (
                  <div className="flex items-center gap-2 text-[13px] text-gray-700">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 inline-flex items-center justify-center">
                      <Phone className="w-3.5 h-3.5" />
                    </span>
                    <a href={`tel:${contact.phone}`} className="hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                ) : null}
                {contact.email ? (
                  <div className="flex items-center gap-2 text-[13px] text-gray-700">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 inline-flex items-center justify-center">
                      <Mail className="w-3.5 h-3.5" />
                    </span>
                    <a href={`mailto:${contact.email}`} className="hover:underline">
                      {contact.email}
                    </a>
                  </div>
                ) : null}
                {contact.website && contact.websiteHref ? (
                  <div className="flex items-center gap-2 text-[13px] text-gray-700">
                    <span className="w-6 h-6 rounded-full bg-purple-50 text-purple-600 inline-flex items-center justify-center">
                      <Globe className="w-3.5 h-3.5" />
                    </span>
                    <a href={contact.websiteHref} target="_blank" rel="noreferrer" className="hover:underline truncate">
                      {contact.website}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Ad — above place profile */}
        <AdUnit variant="banner" className="mt-3" />

        <div className="bg-white rounded-3xl border border-gray-100 p-4 mt-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="text-gray-900">Place profile</div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${conf.color}`}>{conf.label}</span>
          </div>
          <div className="text-[12px] text-gray-500 mb-2">based on {pub.ratings} ratings</div>
          <div className="space-y-2">
            {SLIDERS.map((s) => (
              <VibeSlider
                key={s.key}
                def={s}
                value={pub.vibe[s.key]}
                hasData={pub.ratings > 0}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-4 mt-3">
          <div className="text-gray-900 mb-2">Price range</div>
          {pub.priceRange ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className={`text-[16px] leading-none ${level <= pub.priceRange! ? "text-amber-500" : "text-gray-300"}`}
                  >
                    $
                  </span>
                ))}
              </div>
              <span className="text-[13px] text-gray-700">{toPriceRangeLabel(pub.priceRange)}</span>
            </div>
          ) : (
            <div className="text-[13px] text-gray-500">
              No price-range ratings yet.
            </div>
          )}
        </div>

        {/* Mini map */}
        <div className="bg-white rounded-3xl border border-gray-100 p-4 mt-3">
          <div className="text-gray-900 mb-2">Location</div>
          <div className="h-36 rounded-2xl overflow-hidden border border-gray-100">
            <MapContainer
              center={[pub.lat, pub.lng]}
              zoom={16}
              scrollWheelZoom={false}
              dragging
              zoomControl={false}
              style={{ width: "100%", height: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <Marker position={[pub.lat, pub.lng]} icon={detailMarkerIcon} />
            </MapContainer>
          </div>
          <div className="mt-2 text-[12px] text-gray-600">
            <div className="truncate">{fullAddress}</div>
            <div className="text-gray-500 mt-0.5">
              {directionsQuery}
            </div>
          </div>
          <button
            onClick={handleGetDirections}
            className="mt-2.5 w-full py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-[13px] flex items-center justify-center gap-2 hover:border-gray-300 transition-colors shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-500" />
            Get directions
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-4 mt-3">
          <div className="text-gray-900 mb-3">Similar places</div>
          {similarHighMatch.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-4 text-center">
              <div className="text-[13px] text-gray-800">No strong matches yet</div>
              <div className="mt-1 text-[12px] text-gray-500">
                We only show places here when similarity is at least 80%.
              </div>
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {similarHighMatch.map((p) => (
                <PubCard key={p.id} pub={p} compact onClick={() => navigate(`/detail/${p.id}`)} />
              ))}
            </div>
          )}
          {!pub.isExternalCandidate ? (
            <button
              onClick={() => navigate(`/similar/${pub.id}`)}
              className="mt-2 w-full py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-[13px] hover:border-gray-300 transition-colors"
            >
              Show all similar places
            </button>
          ) : null}
        </div>

        {/* Ad — below similar places */}
        <AdUnit variant="rectangle" className="mt-3" />
      </div>

      {originalNotePreview ? (
        <div
          className="fixed inset-0 z-[130] bg-black/40 flex items-center justify-center px-4"
          onClick={() => setOriginalNotePreview(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-white border border-gray-200 shadow-[0_18px_48px_rgba(0,0,0,0.2)] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOriginalNotePreview(null)}
              className="absolute top-3 right-3 h-7 w-7 rounded-full border border-gray-200 bg-white text-gray-500 inline-flex items-center justify-center hover:text-gray-700 hover:border-gray-300"
              aria-label="Close original note preview"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="text-[15px] text-gray-900">Original note</div>
            <div className="text-[12px] text-gray-500 mt-0.5">@{originalNotePreview.username.replace(/^@+/, "")}</div>
            <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-700">
              {originalNotePreview.original}
            </div>
            <div className="mt-2 text-[12px] text-gray-500">Current note</div>
            <div className="mt-1 rounded-xl border border-gray-100 bg-white px-3 py-2 text-[13px] text-gray-700">
              {originalNotePreview.current}
            </div>
          </div>
        </div>
      ) : null}

      {reportModalNote ? (
        <div
          className="fixed inset-0 z-[132] bg-black/45 flex items-center justify-center px-4"
          onClick={() => setReportModalNote(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white border border-gray-200 shadow-[0_18px_48px_rgba(0,0,0,0.2)] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-[16px] text-gray-900">Report this note</div>
            <div className="mt-1 text-[12px] text-gray-500">
              Select a reason so our moderators can review it faster.
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                { value: "incorrect", label: "Incorrect" },
                { value: "false", label: "False" },
                { value: "inappropriate", label: "Inappropriate" },
                { value: "other", label: "Other" },
              ].map((option) => {
                const active = reportReason === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReportReason(option.value as NoteFlagReason)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-[13px] ${
                      active ? "border-amber-300 bg-amber-50 text-amber-900" : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {reportReason === "other" ? (
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value.slice(0, 280))}
                rows={3}
                maxLength={280}
                placeholder="Optional details"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-800 outline-none focus:border-gray-300 resize-none"
              />
            ) : null}
            {reportError ? (
              <div className="mt-2 text-[12px] text-rose-600">{reportError}</div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReportModalNote(null)}
                className="h-10 rounded-xl border border-gray-200 bg-white text-[13px] text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pendingNoteIds[reportModalNote.rating_id]}
                onClick={() => {
                  void handleNoteFlag(reportModalNote.rating_id);
                }}
                className="h-10 rounded-xl bg-rose-600 text-[13px] text-white disabled:opacity-60"
              >
                {pendingNoteIds[reportModalNote.rating_id] ? "Reporting..." : "Report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reportSuccess ? (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[98px] z-[133] rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[12px] text-emerald-800 shadow-sm">
          {reportSuccess}
        </div>
      ) : null}

      {/* Removed fixed bottom button — moved above info card */}
    </div>
  );
}
