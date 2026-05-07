import { useNavigate } from "react-router";

export function NotFoundScreen() {
  const navigate = useNavigate();

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex items-center justify-center px-6 text-center">
      <div>
        <div className="text-gray-900 text-[18px]">Page not found</div>
        <div className="text-[13px] text-gray-500 mt-1">This screen does not exist or was moved.</div>
        <button
          onClick={() => navigate("/")}
          className="mt-4 rounded-full bg-gray-900 px-4 py-2 text-white text-[13px]"
        >
          Back to explore
        </button>
      </div>
    </div>
  );
}
