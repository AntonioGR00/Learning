"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearSession, getSession } from "@/lib/api";
import { io, type Socket } from "socket.io-client";
import * as XLSX from "xlsx";

/* ─── Types ─────────────────────────────────────────────────── */

type User = {
  id: number;
  email: string;
  fullName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  createdAt: string;
};

type Course = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  teacherId: number;
};

type EducationStage = "ESO" | "BACHILLERATO" | "GRADO_MEDIO" | "GRADO_SUPERIOR";

type Family = {
  id: number;
  name: string;
  stage: EducationStage;
  createdAt: string;
};

type AssignmentOverview = {
  id: number;
  courseId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  attachmentUrl: string | null;
};

type GradeOverview = {
  id: number;
  score: number;
  feedback: string | null;
  gradedAt: string;
  submission: {
    id: number;
    assignment: {
      id: number;
      courseId: number;
      title: string;
      dueDate: string | null;
    };
  };
};

type AttendanceOverview = {
  id: number;
  courseId: number;
  studentId: number;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  notes: string | null;
  course: {
    id: number;
    code: string;
    title: string;
  };
};

type MessageContact = {
  id: number;
  fullName: string;
  email: string;
  role: "TEACHER" | "STUDENT";
  unreadCount: number;
};

type ChatMessage = {
  id: number;
  content: string;
  createdAt: string;
  readAt: string | null;
  sender: {
    id: number;
    fullName: string;
    role: "TEACHER" | "STUDENT";
  };
  recipient: {
    id: number;
    fullName: string;
    role: "TEACHER" | "STUDENT";
  };
};

const STAGE_OPTIONS: EducationStage[] = [
  "ESO",
  "BACHILLERATO",
  "GRADO_MEDIO",
  "GRADO_SUPERIOR",
];

const STAGE_LABEL: Record<EducationStage, string> = {
  ESO: "ESO",
  BACHILLERATO: "Bachillerato",
  GRADO_MEDIO: "Grado Medio",
  GRADO_SUPERIOR: "Grado Superior",
};

const GRADE_OPTIONS_BY_STAGE: Record<EducationStage, string[]> = {
  ESO: ["1", "2", "3", "4"],
  BACHILLERATO: ["1", "2"],
  GRADO_MEDIO: ["1", "2"],
  GRADO_SUPERIOR: ["1", "2"],
};

type Tab = "users" | "courses";

/* ─── Page ──────────────────────────────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession) {
      router.replace("/");
      setReady(true);
      return;
    }

    setSession(currentSession);
    setReady(true);
  }, [router]);

  if (!ready || !session) return null;

  return (
    <div className="min-h-screen bg-[#f4efe6]">
      <Header fullName={session.user.fullName} role={session.user.role} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {session.user.role === "ADMIN" ? (
          <AdminPanel teacherId={session.user.id} />
        ) : session.user.role === "TEACHER" ? (
          <TeacherPanel teacherId={session.user.id} />
        ) : (
          <StudentPanel studentId={session.user.id} />
        )}
      </main>
    </div>
  );
}

/* ─── Header ────────────────────────────────────────────────── */

function Header({
  fullName,
  role,
}: {
  fullName: string;
  role: string;
}) {
  const router = useRouter();

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  return (
    <header className="border-b border-[rgba(21,35,29,0.1)] bg-[rgba(255,252,247,0.8)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-[#c4643b] px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
            Aula Nexus
          </span>
          <span className="text-sm text-[#55635d]">Panel de gestión</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-[#15231d]">{fullName}</p>
            <p className="text-xs text-[#8c6d57]">{role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-2 text-sm font-medium text-[#15231d] transition hover:bg-[#f1e7db]"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─── Admin Panel ───────────────────────────────────────────── */

function AdminPanel({ teacherId }: { teacherId: number }) {
  const [tab, setTab] = useState<Tab>("users");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-[#15231d]">
          Panel Administrador
        </h2>
        <p className="mt-1 text-sm text-[#55635d]">
          Gestión de usuarios y cursos de la institución.
        </p>
      </div>

      <div className="flex gap-2 border-b border-[rgba(21,35,29,0.1)] pb-0">
        {(["users", "courses"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-t-2xl px-5 py-2 text-sm font-semibold transition ${
              tab === t
                ? "bg-white text-[#c4643b] shadow-sm border border-b-0 border-[rgba(21,35,29,0.1)]"
                : "text-[#55635d] hover:text-[#15231d]"
            }`}
          >
            {t === "users" ? "Usuarios" : "Cursos"}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-6 shadow-sm sm:p-8">
        {tab === "users" ? (
          <UsersTab />
        ) : (
          <CoursesTab teacherId={teacherId} />
        )}
      </div>
    </div>
  );
}

/* ─── Users Tab ─────────────────────────────────────────────── */

const ROLE_OPTIONS = ["ADMIN", "TEACHER", "STUDENT"] as const;
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Docente",
  STUDENT: "Estudiante",
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function normalizeRole(value: string): User["role"] | null {
  const v = value.trim().toUpperCase();
  if (v === "ADMIN" || v === "ADMINISTRADOR") return "ADMIN";
  if (v === "TEACHER" || v === "DOCENTE" || v === "PROFESOR") return "TEACHER";
  if (v === "STUDENT" || v === "ESTUDIANTE" || v === "ALUMNO") return "STUDENT";
  return null;
}

function asString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "STUDENT" as (typeof ROLE_OPTIONS)[number],
  });
  const [editForm, setEditForm] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "STUDENT" as (typeof ROLE_OPTIONS)[number],
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<User[]>("/users");
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const created = await apiFetch<User>("/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setUsers((prev) => [...prev, created]);
      setForm({ email: "", fullName: "", password: "", role: "STUDENT" });
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al crear usuario");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(user: User) {
    setEditingUserId(user.id);
    setEditError(null);
    setEditForm({
      email: user.email,
      fullName: user.fullName,
      password: "",
      role: user.role,
    });
  }

  async function handleUpdate(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editingUserId) return;

    setEditing(true);
    setEditError(null);
    try {
      const payload: {
        email: string;
        fullName: string;
        role: User['role'];
        password?: string;
      } = {
        email: editForm.email,
        fullName: editForm.fullName,
        role: editForm.role,
      };

      if (editForm.password.trim().length > 0) {
        payload.password = editForm.password;
      }

      const updated = await apiFetch<User>(`/users/${editingUserId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditingUserId(null);
      setEditForm({ email: "", fullName: "", password: "", role: "STUDENT" });
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Error al editar usuario");
    } finally {
      setEditing(false);
    }
  }

  async function handleDelete(user: User) {
    if (user.role === "ADMIN") {
      setDeleteError("Los usuarios admin no se pueden eliminar.");
      return;
    }

    const ok = window.confirm(
      `Vas a eliminar a ${user.fullName} (${user.email}). Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setDeletingUserId(user.id);
    setDeleteError(null);
    try {
      await apiFetch<{ success: boolean }>(`/users/${user.id}`, {
        method: "DELETE",
      });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (editingUserId === user.id) {
        setEditingUserId(null);
      }
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Error al eliminar usuario");
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setDeleteError(null);

    try {
      const bytes = await file.arrayBuffer();
      const workbook = XLSX.read(bytes, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("El archivo no contiene hojas");
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      if (rows.length === 0) {
        throw new Error("El archivo está vacío");
      }

      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const normalizedRow: Record<string, unknown> = {};

        Object.entries(row).forEach(([key, value]) => {
          normalizedRow[normalizeHeader(key)] = value;
        });

        const fullName = asString(
          normalizedRow.nombre ?? normalizedRow.fullname ?? normalizedRow.nombrecompleto,
        );
        const email = asString(normalizedRow.correo ?? normalizedRow.email);
        const roleRaw = asString(normalizedRow.rol ?? normalizedRow.role);
        const role = normalizeRole(roleRaw);
        const explicitPassword = asString(normalizedRow.password ?? normalizedRow.contrasena);
        const idValue = asString(normalizedRow.id);
        const password = explicitPassword || "Cambio123!";

        if (!fullName || !email || !role) {
          errors.push(`Fila ${i + 2}: falta Nombre/Correo/Rol válido`);
          continue;
        }

        try {
          await apiFetch<User>("/users", {
            method: "POST",
            body: JSON.stringify({
              fullName,
              email,
              role,
              password,
            }),
          });
          successCount += 1;
        } catch (rowError) {
          const hint = idValue ? ` (id origen: ${idValue})` : "";
          const message =
            rowError instanceof Error ? rowError.message : "Error desconocido";
          errors.push(`Fila ${i + 2}${hint}: ${message}`);
        }
      }

      await loadUsers();

      const summary = [
        `Importados: ${successCount}`,
        errors.length ? `Errores: ${errors.length}` : "Errores: 0",
        "Si no envías columna password, se usa Cambio123!",
      ].join(" | ");

      setImportResult(
        errors.length > 0 ? `${summary} | ${errors.slice(0, 3).join(" ; ")}` : summary,
      );
    } catch (e) {
      setImportResult(e instanceof Error ? e.message : "Error al importar archivo");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#15231d]">Usuarios</h3>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-2 text-sm font-semibold text-[#15231d] transition hover:bg-[#f1e7db] disabled:opacity-60"
          >
            {importing ? "Importando..." : "Importar Excel"}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-2xl bg-[#c4643b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9f4c2a]"
          >
            {showForm ? "Cancelar" : "+ Nuevo usuario"}
          </button>
        </div>
      </div>

      {importResult && (
        <p className="rounded-2xl border border-[rgba(21,35,29,0.1)] bg-[#f8fbf9] px-4 py-3 text-sm text-[#30433a]">
          {importResult}
        </p>
      )}

      {deleteError && (
        <p className="rounded-2xl border border-[rgba(176,65,62,0.2)] bg-[rgba(176,65,62,0.08)] px-4 py-3 text-sm text-[#8a2f2d]">
          {deleteError}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-4 rounded-2xl border border-[rgba(196,100,59,0.2)] bg-[#fdf7f2] p-5 sm:grid-cols-2"
        >
          <Input
            label="Nombre completo"
            value={form.fullName}
            onChange={(v) => setForm((f) => ({ ...f, fullName: v }))}
            placeholder="María González"
          />
          <Input
            label="Correo"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            placeholder="maria@school.local"
          />
          <Input
            label="Contraseña"
            type="password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
            placeholder="Mínimo 6 caracteres"
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Rol</span>
            <select
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  role: e.target.value as (typeof ROLE_OPTIONS)[number],
                }))
              }
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          {formError && (
            <p className="text-sm text-[#b0413e] sm:col-span-2">{formError}</p>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[#15231d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      )}

      {editingUserId && (
        <form
          onSubmit={handleUpdate}
          className="grid gap-4 rounded-2xl border border-[rgba(21,35,29,0.15)] bg-[#eef4f0] p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#3f564b]">
              Editar usuario ID {editingUserId}
            </p>
          </div>

          <Input
            label="Nombre completo"
            value={editForm.fullName}
            onChange={(v) => setEditForm((f) => ({ ...f, fullName: v }))}
            placeholder="Nombre actualizado"
          />
          <Input
            label="Correo"
            type="email"
            value={editForm.email}
            onChange={(v) => setEditForm((f) => ({ ...f, email: v }))}
            placeholder="correo@school.local"
          />
          <Input
            label="Nueva contraseña (opcional)"
            type="password"
            value={editForm.password}
            onChange={(v) => setEditForm((f) => ({ ...f, password: v }))}
            placeholder="Deja vacío para conservar"
          />
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Rol</span>
            <select
              value={editForm.role}
              disabled={users.find((u) => u.id === editingUserId)?.role === "ADMIN"}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  role: e.target.value as (typeof ROLE_OPTIONS)[number],
                }))
              }
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {users.find((u) => u.id === editingUserId)?.role === "ADMIN" ? (
              <p className="text-xs text-[#8c6d57]">El rol ADMIN está bloqueado.</p>
            ) : null}
          </label>

          {editError && (
            <p className="text-sm text-[#b0413e] sm:col-span-2">{editError}</p>
          )}

          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={editing}
              className="rounded-2xl bg-[#15231d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
            >
              {editing ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => setEditingUserId(null)}
              className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-5 py-2.5 text-sm font-semibold text-[#15231d] transition hover:bg-[#f1e7db]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[#55635d]">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-[#b0413e]">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(21,35,29,0.08)] text-left text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
                <th className="pb-3 pr-4">ID</th>
                <th className="pb-3 pr-4">Nombre</th>
                <th className="pb-3 pr-4">Correo</th>
                <th className="pb-3 pr-4">Rol</th>
                <th className="pb-3 pr-4">Alta</th>
                <th className="pb-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(21,35,29,0.06)]">
              {users.map((u) => (
                <tr key={u.id} className="text-[#15231d]">
                  <td className="py-3 pr-4 font-mono text-xs text-[#8c6d57]">
                    {u.id}
                  </td>
                  <td className="py-3 pr-4 font-medium">{u.fullName}</td>
                  <td className="py-3 pr-4 text-[#55635d]">{u.email}</td>
                  <td className="py-3 pr-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="py-3 pr-4 text-[#8c6d57]">
                    {new Date(u.createdAt).toLocaleDateString("es")}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(u)}
                        className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-1.5 text-xs font-semibold text-[#15231d] transition hover:bg-[#f1e7db]"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        disabled={deletingUserId === u.id || u.role === "ADMIN"}
                        className="rounded-xl border border-[rgba(176,65,62,0.3)] px-3 py-1.5 text-xs font-semibold text-[#8a2f2d] transition hover:bg-[rgba(176,65,62,0.08)] disabled:opacity-60"
                      >
                        {u.role === "ADMIN"
                          ? "Protegido"
                          : deletingUserId === u.id
                            ? "Eliminando..."
                            : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="pt-4 text-center text-sm text-[#8c6d57]">
              Sin usuarios todavía.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Courses Tab ───────────────────────────────────────────── */

function CoursesTab({ teacherId }: { teacherId: number }) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [courseFilter, setCourseFilter] = useState("");
  const [schoolGrade, setSchoolGrade] = useState("4");
  const [schoolSection, setSchoolSection] = useState("B");
  const [selectedStage, setSelectedStage] = useState<EducationStage>("ESO");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [familyStageFilter, setFamilyStageFilter] =
    useState<EducationStage>("GRADO_MEDIO");
  const [newFamilyName, setNewFamilyName] = useState("");
  const [savingFamily, setSavingFamily] = useState(false);
  const [removingFamilyId, setRemovingFamilyId] = useState<number | null>(null);
  const [familyError, setFamilyError] = useState<string | null>(null);

  const teachers = users.filter((u) => u.role === "TEACHER");

  const [form, setForm] = useState({
    code: "",
    title: "",
    description: "",
    teacherId: String(teacherId),
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reassignCourseId, setReassignCourseId] = useState<number | null>(null);
  const [reassignTeacherId, setReassignTeacherId] = useState<string>("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Course[]>("/courses"),
      apiFetch<User[]>("/users"),
      apiFetch<Family[]>("/families"),
    ])
      .then(([c, u, f]) => {
        setCourses(c);
        setUsers(u);
        setFamilies(f);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Error al cargar datos"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const options = families.filter((f) => f.stage === selectedStage);
    setSelectedFamilyId(options[0] ? String(options[0].id) : "");
  }, [selectedStage, families]);

  useEffect(() => {
    const validGrades = GRADE_OPTIONS_BY_STAGE[selectedStage];
    if (!validGrades.includes(schoolGrade)) {
      setSchoolGrade(validGrades[0]);
    }
  }, [selectedStage, schoolGrade]);

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const selectedFamily = families.find((f) => String(f.id) === selectedFamilyId);
      const generatedDescription = [
        `Etapa: ${STAGE_LABEL[selectedStage]}`,
        selectedFamily ? `Familia: ${selectedFamily.name}` : undefined,
      ]
        .filter(Boolean)
        .join(" | ");

      const payload = {
        ...form,
        teacherId: Number(form.teacherId),
        description: form.description || generatedDescription || undefined,
      };
      const created = await apiFetch<Course>("/courses", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCourses((prev) => [...prev, created]);
      setForm({ code: "", title: "", description: "", teacherId: String(teacherId) });
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al crear curso");
    } finally {
      setSaving(false);
    }
  }

  function applySchoolTemplate() {
    const section = schoolSection.trim().toUpperCase();
    const grade = schoolGrade.trim();
    if (!grade || !section) return;

    const group = `${grade}º${section}`;
    const family = families.find((f) => String(f.id) === selectedFamilyId);
    const stageLabel = STAGE_LABEL[selectedStage];
    const label =
      selectedStage === "ESO" || selectedStage === "BACHILLERATO"
        ? `${group} ${stageLabel}`
        : `${stageLabel} ${family ? `- ${family.name} ` : ""}${group}`;

    const prefixByStage: Record<EducationStage, string> = {
      ESO: "ESO",
      BACHILLERATO: "BACH",
      GRADO_MEDIO: "GM",
      GRADO_SUPERIOR: "GS",
    };

    setForm((f) => ({
      ...f,
      code: `${prefixByStage[selectedStage]}-${grade}${section}`,
      title: label,
      description:
        f.description ||
        `Curso ${label}${family ? ` | Familia: ${family.name}` : ""}`,
    }));
  }

  async function handleCreateFamily(ev: React.FormEvent) {
    ev.preventDefault();
    if (!newFamilyName.trim()) return;

    setSavingFamily(true);
    setFamilyError(null);
    try {
      const created = await apiFetch<Family>("/families", {
        method: "POST",
        body: JSON.stringify({
          name: newFamilyName.trim(),
          stage: familyStageFilter,
        }),
      });
      setFamilies((prev) => [...prev, created]);
      setNewFamilyName("");
    } catch (e) {
      setFamilyError(e instanceof Error ? e.message : "Error al crear familia");
    } finally {
      setSavingFamily(false);
    }
  }

  async function handleRemoveFamily(family: Family) {
    setRemovingFamilyId(family.id);
    setFamilyError(null);
    try {
      await apiFetch<{ success: boolean }>(`/families/${family.id}`, {
        method: "DELETE",
      });
      setFamilies((prev) => prev.filter((f) => f.id !== family.id));
    } catch (e) {
      setFamilyError(e instanceof Error ? e.message : "Error al eliminar familia");
    } finally {
      setRemovingFamilyId(null);
    }
  }

  function startReassign(course: Course) {
    setReassignCourseId(course.id);
    setReassignTeacherId(String(course.teacherId));
    setReassignError(null);
  }

  async function handleReassign(ev: React.FormEvent) {
    ev.preventDefault();
    if (!reassignCourseId || !reassignTeacherId) return;

    setReassigning(true);
    setReassignError(null);
    try {
      const updated = await apiFetch<Course>(`/courses/${reassignCourseId}`, {
        method: "PATCH",
        body: JSON.stringify({ teacherId: Number(reassignTeacherId) }),
      });
      setCourses((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, teacherId: updated.teacherId } : c)),
      );
      setReassignCourseId(null);
      setReassignTeacherId("");
    } catch (e) {
      setReassignError(
        e instanceof Error ? e.message : "Error al cambiar docente del curso",
      );
    } finally {
      setReassigning(false);
    }
  }

  const filteredCourses = courses.filter((c) => {
    const q = courseFilter.trim().toLowerCase();
    if (!q) return true;
    const teacher = users.find((u) => u.id === c.teacherId);
    return (
      c.code.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q) ||
      (teacher?.fullName ?? "").toLowerCase().includes(q)
    );
  });

  const familiesByStage = families
    .filter((f) => f.stage === familyStageFilter)
    .sort((a, b) => a.name.localeCompare(b.name));

  const templateFamilies = families
    .filter((f) => f.stage === selectedStage)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#15231d]">Cursos</h3>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-2xl bg-[#c4643b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9f4c2a]"
        >
          {showForm ? "Cancelar" : "+ Nuevo curso"}
        </button>
      </div>

      <div className="rounded-2xl border border-[rgba(21,35,29,0.1)] bg-[#f8fbf9] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8c6d57]">
          Familias profesionales (Admin)
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr_auto]">
          <label className="space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Etapa</span>
            <select
              value={familyStageFilter}
              onChange={(e) => setFamilyStageFilter(e.target.value as EducationStage)}
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-[#15231d] outline-none transition focus:border-[#c4643b]"
            >
              {STAGE_OPTIONS.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABEL[stage]}
                </option>
              ))}
            </select>
          </label>

          <form onSubmit={handleCreateFamily} className="grid grid-cols-[1fr_auto] items-end gap-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-[#30433a]">Nueva familia</span>
              <input
                type="text"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="Ej. Informatica y Comunicaciones"
                className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-2.5 text-[#15231d] outline-none transition focus:border-[#c4643b]"
              />
            </label>
            <button
              type="submit"
              disabled={savingFamily}
              className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-2.5 text-sm font-semibold text-[#15231d] transition hover:bg-[#f1e7db] disabled:opacity-60"
            >
              {savingFamily ? "Añadiendo..." : "Añadir"}
            </button>
          </form>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {familiesByStage.map((family) => (
            <span
              key={family.id}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,35,29,0.12)] bg-white px-3 py-1 text-xs text-[#15231d]"
            >
              {family.name}
              <button
                type="button"
                onClick={() => handleRemoveFamily(family)}
                disabled={removingFamilyId === family.id}
                className="text-[#8a2f2d] hover:underline disabled:opacity-60"
              >
                {removingFamilyId === family.id ? "..." : "Quitar"}
              </button>
            </span>
          ))}
        </div>

        {familyError && (
          <p className="mt-2 text-sm text-[#b0413e]">{familyError}</p>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-4 rounded-2xl border border-[rgba(196,100,59,0.2)] bg-[#fdf7f2] p-5 sm:grid-cols-2"
        >
          <div className="sm:col-span-2 rounded-2xl border border-[rgba(21,35,29,0.1)] bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#8c6d57]">
              Plantilla rápida escolar
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[170px_210px_120px_120px_auto]">
              <label className="space-y-1">
                <span className="text-sm font-medium text-[#30433a]">Etapa</span>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value as EducationStage)}
                  className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-[#15231d] outline-none transition focus:border-[#c4643b]"
                >
                  {STAGE_OPTIONS.map((stage) => (
                    <option key={stage} value={stage}>
                      {STAGE_LABEL[stage]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-[#30433a]">Familia</span>
                <select
                  value={selectedFamilyId}
                  onChange={(e) => setSelectedFamilyId(e.target.value)}
                  disabled={templateFamilies.length === 0}
                  className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-[#15231d] outline-none transition focus:border-[#c4643b] disabled:opacity-60"
                >
                  {templateFamilies.length === 0 ? (
                    <option value="">Sin familias para esta etapa</option>
                  ) : (
                    templateFamilies.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-[#30433a]">Grado</span>
                <select
                  value={schoolGrade}
                  onChange={(e) => setSchoolGrade(e.target.value)}
                  className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-[#15231d] outline-none transition focus:border-[#c4643b]"
                >
                  {GRADE_OPTIONS_BY_STAGE[selectedStage].map((g) => (
                    <option key={g} value={g}>{g}º</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-[#30433a]">Sección</span>
                <select
                  value={schoolSection}
                  onChange={(e) => setSchoolSection(e.target.value)}
                  className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-[#15231d] outline-none transition focus:border-[#c4643b]"
                >
                  {["A", "B", "C", "D", "E"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={applySchoolTemplate}
                  className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-2 text-sm font-semibold text-[#15231d] transition hover:bg-[#f1e7db]"
                >
                  Aplicar {schoolGrade}º{schoolSection}
                </button>
              </div>
            </div>
          </div>

          <Input
            label="Código"
            value={form.code}
            onChange={(v) => setForm((f) => ({ ...f, code: v }))}
            placeholder="MAT101"
          />
          <Input
            label="Título"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholder="Matemáticas I"
          />
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-[#30433a]">
              Descripción (opcional)
            </span>
            <input
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Breve descripción del curso"
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition placeholder:text-[#8d9a94] focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Docente</span>
            <select
              value={form.teacherId}
              onChange={(e) =>
                setForm((f) => ({ ...f, teacherId: e.target.value }))
              }
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            >
              {teachers.length === 0 ? (
                <option value="">Sin docentes. Crea uno primero.</option>
              ) : (
                teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))
              )}
            </select>
          </label>
          {formError && (
            <p className="text-sm text-[#b0413e] sm:col-span-2">{formError}</p>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving || teachers.length === 0}
              className="rounded-2xl bg-[#15231d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Crear curso"}
            </button>
          </div>
        </form>
      )}

      {reassignCourseId && (
        <form
          onSubmit={handleReassign}
          className="grid gap-4 rounded-2xl border border-[rgba(21,35,29,0.15)] bg-[#eef4f0] p-5 sm:grid-cols-[1fr_auto]"
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">
              Nuevo docente para curso ID {reassignCourseId}
            </span>
            <select
              value={reassignTeacherId}
              onChange={(e) => setReassignTeacherId(e.target.value)}
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={reassigning}
              className="rounded-2xl bg-[#15231d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
            >
              {reassigning ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setReassignCourseId(null)}
              className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-5 py-2.5 text-sm font-semibold text-[#15231d] transition hover:bg-[#f1e7db]"
            >
              Cancelar
            </button>
          </div>

          {reassignError && (
            <p className="text-sm text-[#b0413e] sm:col-span-2">{reassignError}</p>
          )}
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[#55635d]">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-[#b0413e]">{error}</p>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            placeholder="Filtrar cursos por código, título, descripción o docente"
            className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition placeholder:text-[#8d9a94] focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
          />

          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(21,35,29,0.08)] text-left text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
                <th className="pb-3 pr-4">ID</th>
                <th className="pb-3 pr-4">Código</th>
                <th className="pb-3 pr-4">Título</th>
                <th className="pb-3 pr-4">Descripción</th>
                <th className="pb-3 pr-4">Docente</th>
                <th className="pb-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(21,35,29,0.06)]">
              {filteredCourses.map((c) => {
                const teacher = users.find((u) => u.id === c.teacherId);
                return (
                  <tr key={c.id} className="text-[#15231d]">
                    <td className="py-3 pr-4 font-mono text-xs text-[#8c6d57]">
                      {c.id}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs font-semibold text-[#c4643b]">
                      {c.code}
                    </td>
                    <td className="py-3 pr-4 font-medium">{c.title}</td>
                    <td className="py-3 pr-4 text-[#55635d]">
                      {c.description ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-[#55635d]">
                      {teacher?.fullName ?? `ID ${c.teacherId}`}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/curso/${c.id}`)}
                          className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-1.5 text-xs font-semibold text-[#15231d] transition hover:bg-[#f1e7db]"
                        >
                          Abrir
                        </button>
                        <button
                          onClick={() => startReassign(c)}
                          className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-1.5 text-xs font-semibold text-[#15231d] transition hover:bg-[#f1e7db]"
                        >
                          Cambiar docente
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredCourses.length === 0 && (
            <p className="pt-4 text-center text-sm text-[#8c6d57]">
              No hay cursos con ese filtro.
            </p>
          )}
        </div>
        </div>
      )}
    </div>
  );
}

/* ─── Teacher Panel ─────────────────────────────────────────── */

function TeacherPanel({ teacherId }: { teacherId: number }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Course[]>("/courses")
      .then(setCourses)
      .finally(() => setLoading(false));
  }, [teacherId]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight text-[#15231d]">
        Mis cursos
      </h2>
      {loading ? (
        <p className="text-sm text-[#55635d]">Cargando...</p>
      ) : courses.length === 0 ? (
        <p className="text-sm text-[#8c6d57]">No tienes cursos asignados todavía.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}

      <MessagesPanel
        currentUserId={teacherId}
        title="Mensajes con alumnado"
        emptyHint="Cuando haya estudiantes en tus cursos, podrás escribirles aquí."
      />
    </div>
  );
}

/* ─── Student Panel ─────────────────────────────────────────── */

function StudentPanel({ studentId }: { studentId: number }) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<AssignmentOverview[]>([]);
  const [grades, setGrades] = useState<GradeOverview[]>([]);
  const [attendance, setAttendance] = useState<AttendanceOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Course[]>("/courses"),
      apiFetch<AssignmentOverview[]>("/assignments"),
      apiFetch<GradeOverview[]>("/grades/me"),
      apiFetch<AttendanceOverview[]>("/attendance/me"),
    ])
      .then(([coursesData, assignmentsData, gradesData, attendanceData]) => {
        setCourses(coursesData);
        setAssignments(assignmentsData);
        setGrades(gradesData);
        setAttendance(attendanceData);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar datos"))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcomingAssignments = assignments
    .filter((a) => a.dueDate && new Date(a.dueDate) >= today)
    .sort(
      (a, b) =>
        new Date(a.dueDate ?? "").getTime() - new Date(b.dueDate ?? "").getTime(),
    )
    .slice(0, 5);

  const recentGrades = [...grades].sort(
    (a, b) => new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime(),
  );

  const averageGrade =
    grades.length > 0
      ? grades.reduce((acc, g) => acc + g.score, 0) / grades.length
      : null;

  const attendanceRate =
    attendance.length > 0
      ? (attendance.filter((r) => r.status !== "ABSENT").length / attendance.length) * 100
      : null;

  const stats = [
    { label: "Cursos", value: String(courses.length), helper: "Matriculados" },
    {
      label: "Próximas tareas",
      value: String(upcomingAssignments.length),
      helper: "Con fecha de entrega",
    },
    {
      label: "Media",
      value: averageGrade !== null ? averageGrade.toFixed(1) : "-",
      helper: "Notas registradas",
    },
    {
      label: "Asistencia",
      value: attendanceRate !== null ? `${attendanceRate.toFixed(0)}%` : "-",
      helper: "Presente + tardanza",
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight text-[#15231d]">
        Mi panel de estudiante
      </h2>
      {loading ? (
        <p className="text-sm text-[#55635d]">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-[#b0413e]">{error}</p>
      ) : courses.length === 0 ? (
        <p className="text-sm text-[#8c6d57]">
          No estás matriculado en ningún curso todavía.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-[#15231d]">{stat.value}</p>
                <p className="mt-1 text-xs text-[#55635d]">{stat.helper}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
              <h3 className="text-base font-semibold text-[#15231d]">Próximas entregas</h3>
              {upcomingAssignments.length === 0 ? (
                <p className="mt-3 text-sm text-[#8c6d57]">No tienes tareas próximas.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {upcomingAssignments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        router.push(`/dashboard/curso/${a.courseId}?tab=assignments`)
                      }
                      className="w-full text-left rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2 transition hover:border-[#c4643b] hover:bg-[#fffaf5]"
                    >
                      <p className="text-sm font-medium text-[#15231d]">{a.title}</p>
                      <p className="text-xs text-[#8c6d57]">
                        Entrega: {new Date(a.dueDate as string).toLocaleDateString("es")}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
              <h3 className="text-base font-semibold text-[#15231d]">Últimas notas</h3>
              {recentGrades.length === 0 ? (
                <p className="mt-3 text-sm text-[#8c6d57]">Aún no tienes notas publicadas.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentGrades.slice(0, 5).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/dashboard/curso/${g.submission.assignment.courseId}?tab=grades`,
                        )
                      }
                      className="w-full text-left flex items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2 transition hover:border-[#c4643b] hover:bg-[#fffaf5]"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#15231d]">
                          {g.submission.assignment.title}
                        </p>
                        <p className="text-xs text-[#8c6d57]">
                          {new Date(g.gradedAt).toLocaleDateString("es")}
                        </p>
                      </div>
                      <p className="text-lg font-bold text-[#c4643b]">{g.score}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div>
            <h3 className="mb-3 text-base font-semibold text-[#15231d]">Mis cursos</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </div>

          <MessagesPanel
            currentUserId={studentId}
            title="Mensajes con profesorado"
            emptyHint="Cuando estés matriculado en cursos con docente, podrás escribirle aquí."
          />
        </div>
      )}
    </div>
  );
}

/* ─── Messages Panel ────────────────────────────────────────── */

function MessagesPanel({
  currentUserId,
  title,
  emptyHint,
}: {
  currentUserId: number;
  title: string;
  emptyHint: string;
}) {
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedContactRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    selectedContactRef.current = selectedContactId;
  }, [selectedContactId]);

  useEffect(() => {
    const session = getSession();
    if (!session?.accessToken) return;

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
    const wsBase = apiBase.replace(/\/api$/, "");

    const socket = io(wsBase, {
      auth: { token: session.accessToken },
      transports: ["websocket"],
    });

    socket.on("messages:new", (incoming: ChatMessage) => {
      const currentContactId = selectedContactRef.current;
      const peerId =
        incoming.sender.id === currentUserId
          ? incoming.recipient.id
          : incoming.sender.id;
      const incomingForMe = incoming.recipient.id === currentUserId;

      setContacts((prev) =>
        prev.map((contact) => {
          if (contact.id !== peerId) return contact;
          if (!incomingForMe) return contact;
          if (currentContactId === peerId) {
            return { ...contact, unreadCount: 0 };
          }
          return { ...contact, unreadCount: contact.unreadCount + 1 };
        }),
      );

      if (peerId !== currentContactId) return;

      setThread((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming];
      });

      if (incomingForMe) {
        apiFetch<{ updated: number }>(`/messages/${peerId}/read`, {
          method: "POST",
        }).catch(() => {});
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId]);

  async function loadThread(
    contactId: number,
    options?: {
      showLoader?: boolean;
      markRead?: boolean;
      silent?: boolean;
    },
  ) {
    const showLoader = options?.showLoader ?? false;
    const markRead = options?.markRead ?? false;
    const silent = options?.silent ?? false;

    if (showLoader) setLoadingThread(true);
    if (!silent) setError(null);

    try {
      const tasks: Array<Promise<unknown>> = [
        apiFetch<ChatMessage[]>(`/messages/${contactId}`),
      ];

      if (markRead) {
        tasks.push(
          apiFetch<{ updated: number }>(`/messages/${contactId}/read`, {
            method: "POST",
          }),
        );
      }

      const [messages] = (await Promise.all(tasks)) as [ChatMessage[], ...unknown[]];
      setThread(messages);
      if (markRead) {
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === contactId ? { ...contact, unreadCount: 0 } : contact,
          ),
        );
      }
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "Error al cargar conversación");
      }
    } finally {
      if (showLoader) setLoadingThread(false);
    }
  }

  useEffect(() => {
    setLoadingContacts(true);
    apiFetch<MessageContact[]>("/messages/contacts")
      .then((data) => {
        setContacts(data.map((c) => ({ ...c, unreadCount: c.unreadCount ?? 0 })));
        if (data.length > 0) {
          setSelectedContactId((prev) => prev ?? data[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar contactos"))
      .finally(() => setLoadingContacts(false));
  }, []);

  useEffect(() => {
    if (!selectedContactId) return;

    loadThread(selectedContactId, { showLoader: true, markRead: true });
  }, [selectedContactId]);

  async function sendMessage(ev: React.FormEvent) {
    ev.preventDefault();
    if (!selectedContactId || !draft.trim()) return;

    setSending(true);
    setError(null);
    try {
      const created = await apiFetch<ChatMessage>("/messages", {
        method: "POST",
        body: JSON.stringify({ recipientId: selectedContactId, content: draft.trim() }),
      });
      setThread((prev) => [...prev, created]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-[#15231d]">{title}</h3>

      {loadingContacts ? (
        <p className="mt-3 text-sm text-[#55635d]">Cargando contactos...</p>
      ) : contacts.length === 0 ? (
        <p className="mt-3 text-sm text-[#8c6d57]">{emptyHint}</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-2">
            {contacts.map((contact) => {
              const selected = contact.id === selectedContactId;
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                    selected
                      ? "border-[#c4643b] bg-[#fff4ea]"
                      : "border-[rgba(21,35,29,0.08)] hover:border-[#c4643b]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#15231d]">{contact.fullName}</p>
                    {contact.unreadCount > 0 ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#c4643b] px-1.5 py-0.5 text-[11px] font-bold text-white">
                        {contact.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-[#8c6d57]">{ROLE_LABEL[contact.role]}</p>
                </button>
              );
            })}
          </aside>

          <div className="rounded-2xl border border-[rgba(21,35,29,0.08)] p-4">
            {loadingThread ? (
              <p className="text-sm text-[#55635d]">Cargando conversación...</p>
            ) : (
              <>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {thread.length === 0 ? (
                    <p className="text-sm text-[#8c6d57]">
                      Aún no hay mensajes en esta conversación.
                    </p>
                  ) : (
                    thread.map((m) => {
                      const mine = m.sender.id === currentUserId;
                      return (
                        <div
                          key={m.id}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                              mine
                                ? "bg-[#15231d] text-white"
                                : "bg-[#f3eee6] text-[#15231d]"
                            }`}
                          >
                            <p>{m.content}</p>
                            <p
                              className={`mt-1 text-[11px] ${
                                mine ? "text-[#d7e0da]" : "text-[#8c6d57]"
                              }`}
                            >
                              {new Date(m.createdAt).toLocaleString("es")}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={sendMessage} className="mt-3 space-y-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder="Escribe un mensaje..."
                    className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-3 text-sm text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
                  />
                  <div className="flex items-center justify-between">
                    {error ? (
                      <p className="text-xs text-[#b0413e]">{error}</p>
                    ) : (
                      <span className="text-xs text-[#8c6d57]">Máximo contexto: docente-alumno vinculados.</span>
                    )}
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="rounded-2xl bg-[#c4643b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9f4c2a] disabled:opacity-60"
                    >
                      {sending ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ─── Shared components ─────────────────────────────────────── */

function CourseCard({ course }: { course: Course }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/dashboard/curso/${course.id}`)}
      className="w-full text-left rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5 shadow-sm transition hover:border-[#c4643b] hover:shadow-md"
    >
      <p className="font-mono text-xs font-bold text-[#c4643b]">{course.code}</p>
      <p className="mt-2 font-semibold text-[#15231d]">{course.title}</p>
      {course.description && (
        <p className="mt-1 text-sm text-[#55635d]">{course.description}</p>
      )}
      <p className="mt-3 text-xs text-[#8c6d57]">Ver detalle →</p>
    </button>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    ADMIN: "bg-[#f3d4b7] text-[#7a3a1e]",
    TEACHER: "bg-[#d1e8de] text-[#1b5c40]",
    STUDENT: "bg-[#e0e8ff] text-[#2a3a8c]",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[role] ?? "bg-gray-100 text-gray-700"}`}
    >
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-[#30433a]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition placeholder:text-[#8d9a94] focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
      />
    </label>
  );
}
