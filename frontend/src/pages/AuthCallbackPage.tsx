import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { setToken, fetchMe } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setToken(token);
    fetchMe().then(() => navigate("/", { replace: true }));
  }, [navigate, setToken, fetchMe]);

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50">
      <p className="text-zinc-400">Signing you in…</p>
    </div>
  );
}
