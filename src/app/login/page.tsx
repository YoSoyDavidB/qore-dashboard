"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, AlertCircle, User } from "lucide-react";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        const from = searchParams.get("from") || "/office";
        router.push(from);
        router.refresh();
      } else if (res.status === 429) {
        setError("Demasiados intentos. Intenta en 15 minutos.");
      } else {
        setError("Usuario o contrase\u00f1a incorrectos");
      }
    } catch {
      setError("Error de conexi\u00f3n");
    }
    setLoading(false);
  };

  return (
    <div className="rounded-2xl p-10 bg-zinc-900 border border-zinc-800">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#C9A84C" }}>
          QORE
        </h1>
        <p className="text-zinc-500 text-sm mt-1">by Qualitas Funds</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-[#C9A84C]"
            placeholder="Usuario"
            autoComplete="username"
            required
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-lg text-sm bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-[#C9A84C]"
            placeholder="Contrase\u00f1a"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-lg bg-red-900/20 text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full font-semibold py-3 px-4 rounded-lg transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "#C9A84C", color: "#0A0A0A" }}
        >
          {loading ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0A0A0A]">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div className="rounded-2xl p-10 bg-zinc-900 animate-pulse h-80" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
