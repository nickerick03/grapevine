import { type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Bookmark, Share2, Plus, MapPin as MapPinLucide, Navigation, Phone, Mail, Globe, Clock } from "lucide-react";
import { Users, Wine, ChatCircle, Heart, Star, MapPin, Coffee } from "@phosphor-icons/react";
import { PUBS, SLIDERS, Pub } from "../vibe";
import { VibeSlider } from "../VibeSlider";
import { PubCard } from "../PubCard";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { AdUnit } from "../AdUnit";

const chipIconMap: Record<string, ReactNode> = {
  "lively":           <Star weight="duotone" size={16} />,
  "retro":            <Wine weight="duotone" size={16} />,
  "local":            <MapPin weight="duotone" size={16} />,
  "spacious":         <Coffee weight="duotone" size={16} />,
  "good for groups":  <Users weight="duotone" size={16} />,
  "good for talking": <ChatCircle weight="duotone" size={16} />,
  "cozy":             <Heart weight="duotone" size={16} />,
  "intimate":         <Heart weight="duotone" size={16} />,
};

const VENUE_CONTACT: Record<string, {
  hours: { day: string; time: string }[];
  phone: string;
  email: string;
  website: string;
}> = {
  default: {
    hours: [
      { day: "Mon – Thu", time: "12:00 – 23:00" },
      { day: "Fri – Sat", time: "12:00 – 00:00" },
      { day: "Sunday",    time: "12:00 – 22:30" },
    ],
    phone: "+44 20 7946 0321",
    email: "hello@venue.co.uk",
    website: "www.venue.co.uk",
  },
};

function getContact(id: string) {
  return VENUE_CONTACT[id] ?? VENUE_CONTACT["default"];
}

export function DetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const pub = PUBS.find((p) => p.id === id) ?? PUBS[0];
  const similar: Pub[] = PUBS.filter((p) => p.id !== pub.id).slice(0, 3);
  const contact = getContact(pub.id);

  const comments = [
    { user: "Anna", note: "Perfect for a quiet drink with friends.", visit: "Weekday evening" },
    { user: "Mark", note: "Got pricey on the weekend, but good vibes.", visit: "Weekend evening" },
    { user: "Lila", note: "Super cozy corner near the back.", visit: "Weekday afternoon" },
  ];

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#fbf8f3]">
      <div className="relative h-64">
        <ImageWithFallback src={pub.image} alt={pub.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#fbf8f3]" />
        <button
          onClick={() => navigate(-1 as any)}
          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="absolute top-3 right-3 flex gap-2">
          <button className="w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow">
            <Bookmark className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="-mt-10 relative px-4 pb-8">
        {/* Rate button */}
        <button
          onClick={() => navigate(`/rate/${pub.id}`)}
          className="w-full mb-3 py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add your rating
        </button>

        {/* Find Similar button */}
        <button
          onClick={() => navigate(`/similar/${pub.id}`)}
          className="w-full mb-3 py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 shadow-sm flex items-center justify-center gap-2"
        >
          <MapPinLucide className="w-4 h-4" /> Find similar places
        </button>

        {/* ── First info card ── */}
        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] border border-gray-100 p-4">
          {/* Name + match */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-gray-900 text-lg">{pub.name}</div>
              <div className="text-[13px] text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPinLucide className="w-3.5 h-3.5" /> {pub.area}, {pub.city}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[12px] border border-emerald-100 flex-none">
              {pub.match}% match
            </div>
          </div>

          {/* Good for chips */}
          <div className="mt-3">
            <div className="text-[12px] text-gray-500 mb-1.5">Good for...</div>
            <div className="flex flex-wrap gap-1.5">
              {pub.chips.map((c) => (
                <span key={c} className="text-[11.5px] px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-100 flex items-center gap-1">
                  {chipIconMap[c] || <Star weight="duotone" size={16} />}
                  {c}
                </span>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 my-4" />

          {/* ── Contact info ── */}
          <div className="space-y-3.5">

            {/* Opening hours */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-none mt-0.5">
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-gray-400 mb-1">Opening hours</div>
                <div className="space-y-0.5">
                  {contact.hours.map((h) => (
                    <div key={h.day} className="flex items-center justify-between">
                      <span className="text-[13px] text-gray-600">{h.day}</span>
                      <span className="text-[13px] text-gray-900">{h.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Phone */}
            <a
              href={`tel:${contact.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center flex-none">
                <Phone className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-gray-400">Phone</div>
                <div className="text-[13px] text-gray-900 group-hover:text-emerald-600 transition-colors">{contact.phone}</div>
              </div>
            </a>

            {/* Email */}
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-none">
                <Mail className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-gray-400">Email</div>
                <div className="text-[13px] text-gray-900 group-hover:text-blue-600 transition-colors truncate">{contact.email}</div>
              </div>
            </a>

            {/* Website */}
            <a
              href={`https://${contact.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 group"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-none">
                <Globe className="w-4 h-4 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-gray-400">Website</div>
                <div className="text-[13px] text-gray-900 group-hover:text-purple-600 transition-colors truncate">{contact.website}</div>
              </div>
            </a>

          </div>
        </div>

        {/* Ad — above vibe profile */}
        <AdUnit variant="banner" index={0} className="mt-3" />

        {/* ── Vibe profile ── */}
        <div className="bg-white rounded-3xl border border-gray-100 p-4 mt-3">
          <div className="text-gray-900 mb-2">Vibe profile</div>
          <div className="space-y-2">
            {SLIDERS.map((s) => <VibeSlider key={s.key} def={s} value={pub.vibe[s.key]} />)}
          </div>
          {/* Ratings count — replaces the old confidence pill */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5">
            {[1,2,3,4,5].map((i) => (
              <Star
                key={i}
                weight={i <= Math.round(pub.ratings / 20) ? "fill" : "regular"}
                size={13}
                className={i <= Math.round(pub.ratings / 20) ? "text-amber-400" : "text-gray-200"}
              />
            ))}
            <span className="text-[12px] text-gray-500 ml-1">Based on {pub.ratings} ratings</span>
          </div>
        </div>

        {/* Mini map */}
        <div className="bg-white rounded-3xl border border-gray-100 p-4 mt-3">
          <div className="text-gray-900 mb-2">Location</div>
          <div className="h-32 rounded-2xl relative overflow-hidden" style={{ background: "linear-gradient(135deg, #f5f1ea, #ecf1ec)" }}>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
              <div className="px-2 py-0.5 rounded-full bg-gray-900 text-white text-[11px] shadow">{pub.name}</div>
              <div className="w-2.5 h-2.5 rotate-45 bg-gray-900 mx-auto -mt-1" />
            </div>
          </div>
          <button
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pub.name + " " + pub.area + " " + pub.city)}`, "_blank")}
            className="mt-2.5 w-full py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 text-[13px] flex items-center justify-center gap-2 hover:border-gray-300 transition-colors shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-500" />
            Get directions
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-4 mt-3">
          <div className="text-gray-900 mb-3">Similar places</div>
          <div className="space-y-2 mb-3">
            {similar.map((p) => (
              <PubCard key={p.id} pub={p} compact onClick={() => navigate(`/detail/${p.id}`)} />
            ))}
          </div>
          <button
            onClick={() => navigate(`/similar/${pub.id}`)}
            className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-[13px] flex items-center justify-center gap-1.5"
          >
            Find similar places
          </button>
        </div>

        {/* Ad — below similar places */}
        <AdUnit variant="rectangle" index={2} className="mt-3" />

        <div className="bg-white rounded-3xl border border-gray-100 p-4 mt-3">
          <div className="text-gray-900 mb-2">Recent notes</div>
          <div className="space-y-2">
            {comments.map((c, i) => (
              <div key={i} className="p-3 rounded-2xl bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] text-gray-900">{c.user}</div>
                  <div className="text-[11px] text-gray-500">{c.visit}</div>
                </div>
                <div className="text-[13px] text-gray-700 mt-0.5">{c.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}