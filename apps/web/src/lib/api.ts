const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export function getApiOrigin(): string {
  return BASE_URL.replace(/\/api$/, "");
}

const SESSION_KEY = "school.session";

type SessionData = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    fullName: string;
    role: "ADMIN" | "TEACHER" | "STUDENT";
    createdAt: string;
  };
};

export function getSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

function saveSession(session: SessionData) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
}

function parseErrorMessage(payload: unknown, status: number) {
  const message = (payload as { message?: string | string[] } | null)?.message;
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string") return message;
  return `HTTP ${status}`;
}

async function attemptRefresh(session: SessionData): Promise<SessionData | null> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!res.ok) return null;

  const refreshed = (await res.json()) as SessionData;
  saveSession(refreshed);
  return refreshed;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const buildHeaders = (token?: string) => {
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  };

  let session = getSession();
  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(session?.accessToken),
  });

  if (
    res.status === 401 &&
    session?.refreshToken &&
    path !== "/auth/refresh"
  ) {
    const refreshedSession = await attemptRefresh(session);
    if (refreshedSession?.accessToken) {
      session = refreshedSession;
      res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(session.accessToken),
      });
    } else {
      clearSession();
    }
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(parseErrorMessage(payload, res.status));
  }

  return res.json() as Promise<T>;
}
