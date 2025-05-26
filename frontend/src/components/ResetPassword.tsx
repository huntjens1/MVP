import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useSearchParams, useNavigate } from "react-router-dom";

function getHashParams() {
  const hash = window.location.hash.substr(1);
  const params = new URLSearchParams(hash);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    type: params.get("type"),
  };
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Hash redirect: als iemand landt op "/" met een hash (invite/reset), stuur naar /reset-password
  useEffect(() => {
    if (window.location.pathname === "/" && window.location.hash) {
      const hash = window.location.hash.substr(1);
      navigate(`/reset-password?${hash}`, { replace: true });
    }
  }, [navigate]);

  const hashParams = getHashParams();
  const access_token =
    searchParams.get("access_token") ||
    searchParams.get("token") ||
    hashParams.access_token;
  const refresh_token =
    searchParams.get("refresh_token") ||
    hashParams.refresh_token ||
    access_token;

  useEffect(() => {
    if (access_token) {
      supabase.auth.setSession({
        access_token: access_token || "",
        refresh_token: refresh_token || "",
      });
    }
  }, [access_token, refresh_token]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== confirmPw) {
      setMsg("Wachtwoorden komen niet overeen.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) setMsg(error.message);
    else {
      setMsg("Wachtwoord ingesteld! Je wordt doorgestuurd...");
      setTimeout(() => navigate("/"), 1500);
    }
  }

  if (!access_token) {
    return <div>Geen geldige invite/token gevonden.</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950">
      <form className="bg-zinc-900 p-8 rounded-xl shadow-xl flex flex-col gap-4 w-full max-w-md" onSubmit={handleSetPassword}>
        <h2 className="text-cyan-400 text-xl font-bold mb-2">Stel je wachtwoord in</h2>
        <input type="password" required minLength={8} placeholder="Nieuw wachtwoord" value={pw} onChange={e => setPw(e.target.value)} className="bg-zinc-800 p-3 rounded text-white" />
        <input type="password" required minLength={8} placeholder="Bevestig wachtwoord" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="bg-zinc-800 p-3 rounded text-white" />
        <button className="bg-cyan-600 hover:bg-cyan-700 text-white rounded p-2 font-bold" disabled={loading}>
          {loading ? "Bezig..." : "Wachtwoord instellen"}
        </button>
        {msg && <div className="text-cyan-200 text-center">{msg}</div>}
      </form>
    </div>
  );
}
