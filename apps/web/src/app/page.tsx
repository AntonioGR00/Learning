"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "FAMILY";
  createdAt: string;
};

type SessionData = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
const sessionStorageKey = "school.session";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@school.local");
  const [password, setPassword] = useState("Admin123!");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(sessionStorageKey);
    if (stored) {
      try {
        JSON.parse(stored) as SessionData;
        router.replace("/dashboard");
        return;
      } catch {
        window.localStorage.removeItem(sessionStorageKey);
      }
    }
    setIsReady(true);
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string | string[] }
          | null;
        const message = Array.isArray(payload?.message)
          ? payload?.message.join(", ")
          : payload?.message ?? "No se pudo iniciar sesion.";
        throw new Error(message);
      }

      const payload = (await response.json()) as SessionData;
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(payload));
      router.push("/dashboard");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Ocurrio un error inesperado.",
      );
    } finally {
      setIsLoading(false);
    }
  }


  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-[#15231d] sm:px-6 lg:px-8">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute left-[10%] top-[10%] h-36 w-36 rounded-full bg-[#f3d4b7] blur-3xl" />
        <div className="absolute bottom-[16%] right-[8%] h-56 w-56 rounded-full bg-[#b8d8cb] blur-3xl" />
        <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-[#f5c5ab] blur-3xl" />
      </div>

      <section className="relative grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/50 bg-[rgba(255,252,247,0.66)] shadow-[0_24px_60px_rgba(38,29,20,0.12)] backdrop-blur-xl lg:grid-cols-[1.2fr_0.9fr]">
        <div className="flex flex-col justify-between gap-10 border-b border-[rgba(21,35,29,0.08)] p-8 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-[rgba(21,35,29,0.1)] bg-white/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#6a5a4b]">
              Aula Nexus
            </p>
            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.05em] text-[#15231d] sm:text-5xl lg:text-6xl">
                Gestion escolar con acceso claro por rol.
              </h1>
              <p className="max-w-xl text-base leading-8 text-[#55635d] sm:text-lg">
                Base inicial conectada a Next.js y NestJS con PostgreSQL y JWT.
                Desde aqui ya puedes autenticarte y validar la sesion del
                administrador.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <InfoCard label="Backend" value="NestJS + JWT" />
            <InfoCard label="Base de datos" value="PostgreSQL" />
            <InfoCard label="Frontend" value="Next.js 16" />
          </div>
        </div>

        <div className="flex items-center p-6 sm:p-8 lg:p-10">
          <div className="w-full rounded-[28px] border border-[rgba(21,35,29,0.08)] bg-[rgba(255,255,255,0.8)] p-6 shadow-[0_12px_30px_rgba(0,0,0,0.06)] sm:p-8">
            {!isReady ? (
              <p className="text-sm text-[#55635d]">Cargando sesion...</p>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8c6d57]">
                    Iniciar sesion
                  </p>
                  <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#15231d]">
                    Acceso al panel escolar
                  </h2>
                </div>

                <Field
                  label="Correo"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="admin@school.local"
                />
                <Field
                  label="Contrasena"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="Admin123!"
                />

                {error ? (
                  <div className="rounded-2xl border border-[rgba(176,65,62,0.2)] bg-[rgba(176,65,62,0.08)] px-4 py-3 text-sm text-[#8a2f2d]">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-[#c4643b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#9f4c2a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Validando acceso..." : "Entrar al sistema"}
                </button>

                <div className="rounded-2xl bg-[#f7efe5] px-4 py-4 text-sm text-[#5f6d67]">
                  Credenciales seed:
                  <div className="mt-2 font-mono text-[13px] text-[#15231d]">
                    admin@school.local / Admin123!
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[#30433a]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition placeholder:text-[#8d9a94] focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
      />
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[rgba(21,35,29,0.08)] bg-white/65 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8c6d57]">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-[#15231d]">{value}</div>
    </div>
  );
}
