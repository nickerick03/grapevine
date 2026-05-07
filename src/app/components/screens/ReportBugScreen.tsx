import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { createBugReport } from "@/lib/services/admin";
import { useAuth } from "@/app/context/AuthContext";

export function ReportBugScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, openAuthModal } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pageRoute, setPageRoute] = useState(location.pathname);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return title.trim().length >= 3 && description.trim().length >= 10 && !submitting;
  }, [description, submitting, title]);

  const onSubmit = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await createBugReport(user.id, {
        title,
        description,
        page_route: pageRoute,
        screenshot_url: screenshotUrl,
      });
      setSuccess("Bug report submitted. Thanks for helping us improve Grapevine.");
      setTitle("");
      setDescription("");
      setScreenshotUrl("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit bug report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1 as never)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-gray-900 text-[16px]">Report bug</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
          <p className="text-[12px] text-gray-500">
            Send a short report to help us fix issues faster.
          </p>

          <div>
            <label className="text-[12px] text-gray-700">Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Short summary"
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
            />
          </div>

          <div>
            <label className="text-[12px] text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What happened, and what did you expect?"
              rows={5}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-gray-400 resize-none"
            />
          </div>

          <div>
            <label className="text-[12px] text-gray-700">Page route (optional)</label>
            <input
              value={pageRoute}
              onChange={(event) => setPageRoute(event.target.value)}
              placeholder="/detail/..."
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
            />
          </div>

          <div>
            <label className="text-[12px] text-gray-700">Screenshot URL (optional)</label>
            <input
              value={screenshotUrl}
              onChange={(event) => setScreenshotUrl(event.target.value)}
              placeholder="https://..."
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
            />
          </div>

          {error ? <div className="text-[12px] text-rose-600">{error}</div> : null}
          {success ? <div className="text-[12px] text-emerald-700">{success}</div> : null}

          <button
            onClick={() => void onSubmit()}
            disabled={!canSubmit}
            className="h-11 w-full rounded-xl bg-gray-900 text-white text-[13px] disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit bug report"}
          </button>
        </div>
      </div>
    </div>
  );
}
