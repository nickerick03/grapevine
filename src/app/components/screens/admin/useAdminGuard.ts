import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/app/context/AuthContext";

export function useAdminGuard() {
  const navigate = useNavigate();
  const { loading, user } = useAuth();
  const allowed = Boolean(user?.canAccessAdmin);

  useEffect(() => {
    if (!loading && !allowed) {
      navigate("/settings", { replace: true });
    }
  }, [allowed, loading, navigate]);

  return { loading, allowed };
}
