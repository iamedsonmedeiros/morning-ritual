"use client";

import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");

    try {
      const supabase = createSupabaseBrowserClient();

      const signUpResult = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpResult.error && !signUpResult.error.message.toLowerCase().includes("already registered")) {
        throw signUpResult.error;
      }

      if (!signUpResult.data.session) {
        const signInResult = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInResult.error) throw signInResult.error;
      }

      setStatus("success");
      window.location.assign("/app");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div>
        <label htmlFor="email" className="text-sm font-medium text-slate-200">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@exemplo.com"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-400"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-medium text-slate-200">
          Senha
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="mínimo 8 caracteres"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-cyan-400"
        />
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-full bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Entrando..." : "Entrar ou criar conta"}
      </button>

      {status === "success" ? (
        <p className="text-sm text-cyan-300">
          Acesso liberado. Redirecionando para o app...
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-rose-300">
          Não consegui autenticar. Verifique o e-mail, a senha e o Supabase.
        </p>
      ) : null}
    </form>
  );
}
