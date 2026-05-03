import { type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Bookmark, Share2, Plus, MapPin as MapPinLucide, Navigation } from "lucide-react";
import { Users, Wine, ChatCircle, Heart, Star, MapPin, Coffee } from "@phosphor-icons/react";
import { PUBS, SLIDERS, Pub } from "../vibe";
import { VibeSlider } from "../VibeSlider";
import { PubCard } from "../PubCard";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { AdUnit } from "../AdUnit";

function confidence(n: number) {
  if (n < 50) return { label: "Low confidence", color: "text-amber-700 bg-amber-50 border-amber-200" };
  if (n < 200) return { label: "Medium confidence", color: "text-blue-700 bg-blue-50 border-blue-200" };
  return { label: "High confidence", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
}

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

export function DetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const pub = PUBS.find((p) => p.id === id) ?? PUBS[0];
  const conf = confidence(pub.ratings);
  const similar: Pub[] = PUBS.filter((p) => p.id !== pub.id).slice(0, 3);

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
        {/* Rate button — above the info card */}
        <button
          onClick={() => navigate(`/rate/${pub.id}`)}
          className="w-full mb-3 py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 shadow-sm flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add your rating
        </button>

        <div className="bg-white rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.05)] border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-gray-900 text-lg">{pub.name}</div>
              <div className="text-[13px] text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPinLucide className="w-3.5 h-3.5" /> {pub.area}, {pub.city}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[12px] border border-emerald-100">
              {pub.match}% match
            </div>
          </div>

          <div className="mt-3 p-3 rounded-2xl bg-gradient-to-br from-amber-50 via-rose-50 to-purple-50 border border-amber-100/60">
            <div className="text-[12px] text-gray-500 mb-1">VibeMap summary</div>
            <div className="text-[14px] text-gray-800">"{pub.summary}"</div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${conf.color}`}>{conf.label}</span>
            <span className="text-[12px] text-gray-500">based on {pub.ratings} ratings</span>
          </div>

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
        </div>

        {/* Ad — above vibe profile */}
        <AdUnit variant="banner" index={0} className="mt-3" />

        <div className="bg-white rounded-3xl border border-gray-100 p-4 mt-3">
          <div className="text-gray-900 mb-2">Vibe profile</div>
          <div className="space-y-2">
            {SLIDERS.map((s) => <VibeSlider key={s.key} def={s} value={pub.vibe[s.key]} />)}
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
          {/* Navigate button */}
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

      {/* Removed fixed bottom button — moved above info card */}
    </div>
  );
}