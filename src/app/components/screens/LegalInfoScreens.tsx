import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import {
  getLegalDocument,
  getLegalDocumentDefinition,
  type LegalDocumentKey,
  type LegalDocumentRecord,
} from "@/lib/services/legal";

function LegalScreenLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1 as never)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-gray-900 text-[16px]">{title}</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <p className="text-[12px] text-gray-500">{subtitle}</p>
          <div className="mt-3 space-y-2 text-[13px] leading-5 text-gray-700">{children}</div>
        </div>
      </div>
    </div>
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently updated";
  }
  return `Updated ${date.toLocaleDateString()}`;
}

function LegalDocumentScreen({ documentKey }: { documentKey: LegalDocumentKey }) {
  const definition = useMemo(() => getLegalDocumentDefinition(documentKey), [documentKey]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [document, setDocument] = useState<LegalDocumentRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void getLegalDocument(documentKey)
      .then((result) => {
        if (!cancelled) {
          setDocument(result);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load this legal document.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [documentKey]);

  const title = document?.title?.trim() || definition.title;
  const content = document?.content?.trim() || "";
  const subtitle = loading
    ? "Loading legal content..."
    : document?.updated_at
      ? formatUpdatedAt(document.updated_at)
      : "Draft mode: this page is awaiting final legal copy.";

  return (
    <LegalScreenLayout title={title} subtitle={subtitle}>
      {error ? <p className="text-rose-600">{error}</p> : null}
      {!error && loading ? <p>Loading…</p> : null}
      {!error && !loading && content ? <div className="whitespace-pre-wrap">{content}</div> : null}
      {!error && !loading && !content
        ? definition.fallbackLines.map((line) => <p key={line}>{line}</p>)
        : null}
    </LegalScreenLayout>
  );
}

export function PrivacyPolicyScreen() {
  return <LegalDocumentScreen documentKey="privacy-policy" />;
}

export function CookiePolicyScreen() {
  return <LegalDocumentScreen documentKey="cookie-policy" />;
}

export function TermsOfServiceScreen() {
  return <LegalDocumentScreen documentKey="terms-of-service" />;
}

export function ImpressumScreen() {
  return <LegalDocumentScreen documentKey="impressum" />;
}

export function DataDeletionRequestScreen() {
  return <LegalDocumentScreen documentKey="data-deletion" />;
}

export function ContactInfoScreen() {
  return <LegalDocumentScreen documentKey="contact" />;
}
