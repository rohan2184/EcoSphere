import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { errorMessage } from "../../lib/api";
import { Button, Input } from "../../components/ui";

// ponytail: dev bypass — one click logs in as the seeded admin so devs can view
// the whole app without typing. Real backend login (auth is enforced on every
// route, so a fake token would just 401). Gated by import.meta.env.DEV, so Vite
// strips this from production builds. Change creds here if your seed differs.
const DEV_EMAIL = "asha@eco.test";
const DEV_PASSWORD = "secret123";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function runLogin(e: string, p: string) {
    setBusy(true);
    setError("");
    try {
      await login(e, p);
      navigate("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-emerald-950">
      <form onSubmit={(e) => { e.preventDefault(); runLogin(email, password); }} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <Link to="/" className="text-xs text-stone-400 hover:text-stone-600">← Back to home</Link>
        <h1 className="mt-3 text-xl font-bold text-emerald-900">🌿 EcoSphere</h1>
        <p className="mb-6 text-sm text-stone-500">Sign in to your account</p>
        <div className="space-y-3">
          <Input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full" />
          <Input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
        </div>

        {import.meta.env.DEV && (
          <div className="mt-6 border-t border-dashed border-stone-200 pt-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => runLogin(DEV_EMAIL, DEV_PASSWORD)} className="w-full">
              🔓 Dev login (admin)
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-stone-400">
              Skips the form as {DEV_EMAIL} · dev builds only
            </p>
          </div>
        )}

        <p className="mt-4 text-center text-sm text-stone-500">
          No account? <Link to="/register" className="text-emerald-700 underline">Register</Link>
        </p>
      </form>
    </div>
  );
}
