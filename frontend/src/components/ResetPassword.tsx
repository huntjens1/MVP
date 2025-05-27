import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) setError(error.message);
    else setMessage("Er is een herstelmail verstuurd (check ook je spam).");
  }

  return (
    <section className="max-w-md mx-auto mt-24 bg-calllogix-card p-8 rounded-2xl shadow-xl">
      <h2 className="text-2xl font-black text-calllogix-primary mb-8">Reset wachtwoord</h2>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="E-mailadres"
          className="px-4 py-2 rounded-xl border border-calllogix-primary bg-calllogix-dark text-calllogix-text"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="bg-calllogix-primary text-calllogix-text font-bold px-4 py-2 rounded-xl hover:bg-calllogix-accent hover:text-calllogix-dark transition"
        >
          Stuur reset-link
        </button>
        {message && <div className="text-calllogix-accent font-bold">{message}</div>}
        {error && <div className="text-red-500 font-bold">{error}</div>}
      </form>
    </section>
  );
}
