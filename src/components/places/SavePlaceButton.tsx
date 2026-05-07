import { useState } from "react";

interface SavePlaceButtonProps {
  isSaved: boolean;
  disabled?: boolean;
  onToggle: () => Promise<{ error: string | null }>;
}

export function SavePlaceButton({ isSaved, disabled, onToggle }: SavePlaceButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setBusy(true);
    setError(null);

    const result = await onToggle();

    if (result.error) {
      setError(result.error);
    }

    setBusy(false);
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        disabled={disabled || busy}
        className={`rounded-full border px-4 py-2 text-[13px] transition ${
          isSaved
            ? "border-gray-900 bg-gray-900 text-white"
            : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
        } disabled:opacity-60`}
      >
        {busy ? "Please wait..." : isSaved ? "Saved" : "Save place"}
      </button>
      {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
