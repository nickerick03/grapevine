import { supabase } from "@/lib/supabase/client";

export type LegalDocumentKey =
  | "privacy-policy"
  | "cookie-policy"
  | "terms-of-service"
  | "impressum"
  | "data-deletion"
  | "contact";

export interface LegalDocumentDefinition {
  key: LegalDocumentKey;
  title: string;
  path: string;
  subtitle: string;
  fallbackLines: string[];
}

export interface LegalDocumentRecord {
  document_key: LegalDocumentKey;
  title: string;
  content: string;
  updated_at: string;
  updated_by: string | null;
}

export const LEGAL_DOCUMENT_DEFINITIONS: LegalDocumentDefinition[] = [
  {
    key: "privacy-policy",
    title: "Privacy Policy",
    path: "/settings/privacy-policy",
    subtitle: "How personal data is collected and processed",
    fallbackLines: [
      "TODO: Insert operator legal name and business form.",
      "TODO: Insert registered/correspondence address, tax number, and EU VAT number.",
      "TODO: Insert data categories, legal bases, and retention details.",
      "TODO: Insert user rights under GDPR and contact process.",
    ],
  },
  {
    key: "cookie-policy",
    title: "Cookie Policy",
    path: "/settings/cookie-policy",
    subtitle: "Cookie categories and consent information",
    fallbackLines: [
      "TODO: Insert complete cookie inventory and purposes.",
      "TODO: Insert consent flow and withdrawal instructions.",
      "TODO: Insert retention duration for each cookie category.",
      "Current MVP does not intentionally load analytics/ads tracking cookies.",
    ],
  },
  {
    key: "terms-of-service",
    title: "Terms of Service / ÁSZF",
    path: "/settings/terms-of-service",
    subtitle: "Platform rules and usage terms",
    fallbackLines: [
      "TODO: Insert eligibility, user obligations, and prohibited behavior.",
      "TODO: Insert content policy, moderation process, and limitation of liability.",
      "TODO: Insert governing law and dispute handling.",
      "TODO: Insert business contact details.",
    ],
  },
  {
    key: "impressum",
    title: "Impressum / Company Information",
    path: "/settings/impressum",
    subtitle: "Operator and legal business details",
    fallbackLines: [
      "TODO: Insert operator full legal entity details.",
      "TODO: Insert address/correspondence address and tax details.",
      "TODO: Insert public contact channels.",
      "TODO: Insert supervisory/registry details if legally required.",
    ],
  },
  {
    key: "data-deletion",
    title: "Data Deletion Request",
    path: "/settings/data-deletion",
    subtitle: "How users can request account/data deletion",
    fallbackLines: [
      "TODO: Insert dedicated deletion request email/form.",
      "TODO: Insert identity verification and response timeline.",
      "TODO: Insert what data is deleted immediately vs retained for legal reasons.",
      "TODO: Insert restoration/recovery policy (if any).",
    ],
  },
  {
    key: "contact",
    title: "Contact",
    path: "/settings/contact",
    subtitle: "Support and legal contact channels",
    fallbackLines: [
      "TODO: Insert public support email.",
      "TODO: Insert business contact method and support hours.",
      "TODO: Insert expected response time.",
      "TODO: Insert legal/privacy contact channel.",
    ],
  },
];

export function getLegalDocumentDefinition(key: LegalDocumentKey): LegalDocumentDefinition {
  return LEGAL_DOCUMENT_DEFINITIONS.find((item) => item.key === key) ?? LEGAL_DOCUMENT_DEFINITIONS[0];
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01"
    || error.code === "PGRST205"
    || error.message?.toLowerCase().includes("does not exist")
    || false
  );
}

export async function getLegalDocument(key: LegalDocumentKey): Promise<LegalDocumentRecord | null> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("document_key,title,content,updated_at,updated_by")
    .eq("document_key", key)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }

  return (data ?? null) as LegalDocumentRecord | null;
}

export async function listLegalDocuments(): Promise<LegalDocumentRecord[]> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("document_key,title,content,updated_at,updated_by")
    .order("document_key", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as LegalDocumentRecord[];
}

export async function upsertLegalDocument(input: {
  key: LegalDocumentKey;
  title: string;
  content: string;
}): Promise<LegalDocumentRecord> {
  const { data, error } = await supabase.rpc("upsert_legal_document", {
    p_document_key: input.key,
    p_title: input.title.trim(),
    p_content: input.content,
  });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Failed to save legal document.");
  }

  return row as LegalDocumentRecord;
}
