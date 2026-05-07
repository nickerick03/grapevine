import { useNavigate } from "react-router";

import { useAuth } from "@/app/context/AuthContext";

export function AuthButton() {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();

  if (user) {
    return (
      <button
        onClick={() => navigate("/account")}
        className="rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] text-gray-800 transition hover:border-gray-300"
      >
        Account
      </button>
    );
  }

  return (
    <button
      onClick={openAuthModal}
      className="rounded-full bg-gray-900 px-4 py-2 text-[13px] text-white transition hover:bg-gray-800"
    >
      Sign in
    </button>
  );
}
