"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearSession, getSession } from "@/lib/api";
import { NotificationCenter } from "@/components/notification-center";
import { io, type Socket } from "socket.io-client";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

/* ─── Types ─────────────────────────────────────────────────── */

type User = {
  id: number;
  email: string;
  fullName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "FAMILY";
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

type TeacherSubmissionOverview = {
  id: number;
  studentId: number;
  status: "DRAFT" | "SUBMITTED" | "DISQUALIFIED";
  submittedAt: string | null;
  student: {
    id: number;
    fullName: string;
  };
  assignment: {
    id: number;
    title: string;
  };
  grade: {
    id: number;
    score: number;
  } | null;
};

type TeacherAttendanceOverview = {
  id: number;
  courseId: number;
  studentId: number;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  justificationStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  student: {
    id: number;
    fullName: string;
  };
};

type MessageContact = {
  id: number;
  fullName: string;
  email: string;
  role: "TEACHER" | "STUDENT" | "FAMILY";
  unreadCount: number;
  lastMessageAt?: string | null;
};

type ChatMessage = {
  id: number;
  content: string;
  createdAt: string;
  readAt: string | null;
  sender: {
    id: number;
    fullName: string;
    role: "TEACHER" | "STUDENT" | "FAMILY";
  };
  recipient: {
    id: number;
    fullName: string;
    role: "TEACHER" | "STUDENT" | "FAMILY";
  };
};

type FamilyLink = {
  id: number;
  relationship: string | null;
  familyUser: { id: number; fullName: string; email: string };
  student: { id: number; fullName: string; email: string };
};

type FamilyPortalStudent = {
  relationship: string | null;
  student: {
    id: number;
    fullName: string;
    email: string;
    enrollments: Array<{
      course: {
        id: number;
        code: string;
        title: string;
        description: string | null;
        teacher: { id: number; fullName: string; email: string };
      };
    }>;
  };
  submissions: Array<{
    id: number;
    submittedAt: string | null;
    assignment: { id: number; courseId: number; title: string; dueDate: string | null };
    grade: { id: number; score: number; feedback: string | null; gradedAt: string } | null;
  }>;
  attendance: Array<{
    id: number;
    date: string;
    status: "PRESENT" | "ABSENT" | "LATE";
    justificationStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
    course: { id: number; code: string; title: string };
  }>;
  assignments: AssignmentOverview[];
  announcements: Array<{
    id: number;
    title: string;
    body: string;
    courseId: number | null;
    createdAt: string;
  }>;
  notifications: Array<{
    id: number;
    title: string;
    body: string;
    createdAt: string;
  }>;
};

type FamilyPortalResponse = {
  students: FamilyPortalStudent[];
};

type TrackingCourse = {
  code?: string;
  title: string;
};

type TrackingAssignment = {
  courseTitle: string;
  title: string;
  dueDate: string | null;
};

type TrackingSubmission = {
  courseTitle: string;
  assignmentTitle: string;
  submittedAt: string | null;
  status: "DRAFT" | "SUBMITTED" | "DISQUALIFIED";
  grade: number | null;
  feedback?: string | null;
};

type TrackingAttendance = {
  courseTitle: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE";
};

type StudentTrackingReport = {
  studentName: string;
  studentEmail?: string;
  relationship?: string | null;
  contextLabel: string;
  courses: TrackingCourse[];
  assignments: TrackingAssignment[];
  submissions: TrackingSubmission[];
  attendance: TrackingAttendance[];
  notices: string[];
};

type TeacherStudentReport = {
  studentId: number;
  studentName: string;
  courses: TrackingCourse[];
  assignments: TrackingAssignment[];
  submissions: TrackingSubmission[];
  attendance: TrackingAttendance[];
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

function formatDateES(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es");
}

function exportStudentTrackingPdf(report: StudentTrackingReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxY = pageHeight - margin;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const addLine = (text: string, size = 10, bold = false, spacing = 14) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      if (y > maxY) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += spacing;
    }
  };

  const addGap = (size = 8) => {
    y += size;
    if (y > maxY) {
      doc.addPage();
      y = margin;
    }
  };

  const graded = report.submissions.filter((submission) => submission.grade !== null);
  const averageGrade =
    graded.length > 0
      ? graded.reduce((sum, submission) => sum + (submission.grade ?? 0), 0) / graded.length
      : null;
  const absences = report.attendance.filter((record) => record.status === "ABSENT").length;
  const absencePct =
    report.attendance.length > 0
      ? (absences / report.attendance.length) * 100
      : 0;

  addLine("Seguimiento del alumno", 18, true, 22);
  addLine(`${report.contextLabel} · ${new Date().toLocaleDateString("es")}`, 10, false, 14);
  addGap(2);
  addLine(`Alumno: ${report.studentName}`, 12, true, 16);
  if (report.studentEmail) addLine(`Correo: ${report.studentEmail}`, 10, false, 14);
  if (report.relationship) addLine(`Relacion: ${report.relationship}`, 10, false, 14);
  addGap(4);

  addLine("Resumen", 12, true, 16);
  addLine(`Cursos: ${report.courses.length}`);
  addLine(`Media: ${averageGrade !== null ? averageGrade.toFixed(2) : "-"}`);
  addLine(`Faltas: ${absences} / ${report.attendance.length}`);
  addLine(`Porcentaje de faltas: ${absencePct.toFixed(1)}%`);
  addGap();

  addLine("Cursos", 12, true, 16);
  if (report.courses.length === 0) {
    addLine("Sin cursos registrados.");
  } else {
    report.courses.forEach((course) => {
      addLine(`- ${course.code ? `${course.code} · ` : ""}${course.title}`);
    });
  }
  addGap();

  addLine("Proximas tareas", 12, true, 16);
  const upcomingAssignments = [...report.assignments]
    .filter((assignment) => {
      if (!assignment.dueDate) return false;
      return new Date(assignment.dueDate).getTime() >= Date.now();
    })
    .sort(
      (a, b) =>
        new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime(),
    )
    .slice(0, 12);
  if (upcomingAssignments.length === 0) {
    addLine("Sin tareas proximas.");
  } else {
    upcomingAssignments.forEach((assignment) => {
      addLine(`- ${assignment.courseTitle}: ${assignment.title} (Entrega: ${formatDateES(assignment.dueDate)})`);
    });
  }
  addGap();

  addLine("Ultimas calificaciones", 12, true, 16);
  const latestGrades = [...graded]
    .sort(
      (a, b) =>
        new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime(),
    )
    .slice(0, 12);
  if (latestGrades.length === 0) {
    addLine("Sin calificaciones disponibles.");
  } else {
    latestGrades.forEach((submission) => {
      addLine(
        `- ${submission.courseTitle}: ${submission.assignmentTitle} · Nota ${submission.grade?.toFixed(2) ?? "-"} (${formatDateES(submission.submittedAt)})`,
      );
      if (submission.feedback) {
        addLine(`  Comentario: ${submission.feedback}`);
      }
    });
  }
  addGap();

  addLine("Asistencia reciente", 12, true, 16);
  const latestAttendance = [...report.attendance]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 14);
  if (latestAttendance.length === 0) {
    addLine("Sin registros de asistencia.");
  } else {
    latestAttendance.forEach((record) => {
      const label =
        record.status === "ABSENT"
          ? "Ausente"
          : record.status === "LATE"
          ? "Tardanza"
          : "Presente";
      addLine(`- ${formatDateES(record.date)} · ${record.courseTitle} · ${label}`);
    });
  }
  addGap();

  addLine("Avisos", 12, true, 16);
  if (report.notices.length === 0) {
    addLine("Sin avisos recientes.");
  } else {
    report.notices.slice(0, 12).forEach((notice) => {
      addLine(`- ${notice}`);
    });
  }

  const safeStudentName = report.studentName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const fileName = `seguimiento-${safeStudentName || "alumno"}-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(fileName);
}

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
        ) : session.user.role === "FAMILY" ? (
          <FamilyPanel familyId={session.user.id} />
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
          <NotificationCenter />
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

const ROLE_OPTIONS = ["ADMIN", "TEACHER", "STUDENT", "FAMILY"] as const;
const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Docente",
  STUDENT: "Estudiante",
  FAMILY: "Familiar",
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
  if (v === "FAMILY" || v === "FAMILIAR" || v === "PADRE" || v === "MADRE") return "FAMILY";
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
  const [familyLinks, setFamilyLinks] = useState<FamilyLink[]>([]);
  const [selectedFamilyUserId, setSelectedFamilyUserId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [relationship, setRelationship] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [removingLinkId, setRemovingLinkId] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([loadUsers(), loadFamilyLinks()]);
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

  async function loadFamilyLinks() {
    try {
      const data = await apiFetch<FamilyLink[]>("/families/links");
      setFamilyLinks(data);
    } catch {
      setFamilyLinks([]);
    }
  }

  const familyUsers = users.filter((user) => user.role === "FAMILY");
  const students = users.filter((user) => user.role === "STUDENT");

  useEffect(() => {
    if (!selectedFamilyUserId && familyUsers[0]) {
      setSelectedFamilyUserId(String(familyUsers[0].id));
    }
    if (!selectedStudentId && students[0]) {
      setSelectedStudentId(String(students[0].id));
    }
  }, [familyUsers, selectedFamilyUserId, selectedStudentId, students]);

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

  async function handleCreateFamilyLink(ev: React.FormEvent) {
    ev.preventDefault();
    if (!selectedFamilyUserId || !selectedStudentId) {
      setLinkError("Selecciona un familiar y un alumno.");
      return;
    }

    setLinking(true);
    setLinkError(null);
    try {
      const created = await apiFetch<FamilyLink>("/families/links", {
        method: "POST",
        body: JSON.stringify({
          familyUserId: Number(selectedFamilyUserId),
          studentId: Number(selectedStudentId),
          relationship: relationship.trim() || undefined,
        }),
      });
      setFamilyLinks((prev) => [...prev, created]);
      setRelationship("");
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "No se pudo crear el vínculo");
    } finally {
      setLinking(false);
    }
  }

  async function handleRemoveFamilyLink(id: number) {
    setRemovingLinkId(id);
    setLinkError(null);
    try {
      await apiFetch<{ success: boolean }>(`/families/links/${id}`, { method: "DELETE" });
      setFamilyLinks((prev) => prev.filter((link) => link.id !== id));
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "No se pudo eliminar el vínculo");
    } finally {
      setRemovingLinkId(null);
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

      <div className="space-y-4 rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
        <div>
          <h4 className="text-base font-semibold text-[#15231d]">Portal de familias</h4>
          <p className="mt-1 text-sm text-[#55635d]">Vincula usuarios con rol familiar a alumnos concretos para darles acceso de seguimiento.</p>
        </div>

        <form onSubmit={handleCreateFamilyLink} className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Familiar</span>
            <select
              value={selectedFamilyUserId}
              onChange={(e) => setSelectedFamilyUserId(e.target.value)}
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none focus:border-[#c4643b]"
            >
              {familyUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.fullName}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Alumno</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none focus:border-[#c4643b]"
            >
              {students.map((user) => (
                <option key={user.id} value={user.id}>{user.fullName}</option>
              ))}
            </select>
          </label>
          <Input
            label="Relación (opcional)"
            value={relationship}
            onChange={setRelationship}
            placeholder="Madre, padre, tutor..."
          />
          {linkError && <p className="text-sm text-[#b0413e] sm:col-span-3">{linkError}</p>}
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={linking || familyUsers.length === 0 || students.length === 0}
              className="rounded-2xl bg-[#15231d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
            >
              {linking ? "Vinculando..." : "Vincular familiar"}
            </button>
          </div>
        </form>

        <div className="space-y-2">
          {familyLinks.length === 0 ? (
            <p className="text-sm text-[#8c6d57]">Todavía no hay vínculos familiares.</p>
          ) : (
            familyLinks.map((link) => (
              <div key={link.id} className="flex items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#15231d]">{link.familyUser.fullName} → {link.student.fullName}</p>
                  <p className="text-xs text-[#8c6d57]">{link.relationship || "Sin relación indicada"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemoveFamilyLink(link.id)}
                  disabled={removingLinkId === link.id}
                  className="rounded-xl border border-[rgba(176,65,62,0.3)] px-3 py-1.5 text-xs font-semibold text-[#8a2f2d] transition hover:bg-[rgba(176,65,62,0.08)] disabled:opacity-60"
                >
                  {removingLinkId === link.id ? "Eliminando..." : "Desvincular"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

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

function FamilyPanel({ familyId }: { familyId: number }) {
  const [data, setData] = useState<FamilyPortalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    apiFetch<FamilyPortalResponse>("/families/portal")
      .then((response) => {
        setData(response);
        setSelectedStudentId(response.students[0]?.student.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el portal familiar"))
      .finally(() => setLoading(false));
  }, []);

  const selected = data?.students.find((entry) => entry.student.id === selectedStudentId) ?? data?.students[0] ?? null;

  if (loading) {
    return <p className="text-sm text-[#55635d]">Cargando portal familiar...</p>;
  }

  if (error) {
    return <p className="text-sm text-[#b0413e]">{error}</p>;
  }

  if (!selected || !data || data.students.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight text-[#15231d]">Portal familiar</h2>
        <p className="text-sm text-[#8c6d57]">Tu cuenta aún no está vinculada a ningún alumno.</p>
      </div>
    );
  }

  const graded = selected.submissions.filter((submission) => submission.grade);
  const averageGrade = graded.length > 0 ? graded.reduce((sum, submission) => sum + (submission.grade?.score ?? 0), 0) / graded.length : null;
  const absences = selected.attendance.filter((record) => record.status === "ABSENT").length;
  const attendanceRate = selected.attendance.length > 0 ? ((selected.attendance.length - absences) / selected.attendance.length) * 100 : null;
  const upcomingAssignments = selected.assignments.filter((assignment) => assignment.dueDate && new Date(assignment.dueDate).getTime() >= Date.now()).slice(0, 5);
  const courseInsights = selected.student.enrollments.map((enrollment) => {
    const courseId = enrollment.course.id;
    const courseSubmissions = selected.submissions.filter((submission) => submission.assignment.courseId === courseId);
    const courseGraded = courseSubmissions.filter((submission) => submission.grade);
    const courseAttendance = selected.attendance.filter((record) => record.course.id === courseId);
    const courseAbsences = courseAttendance.filter((record) => record.status === "ABSENT").length;
    const absencePct = courseAttendance.length > 0 ? (courseAbsences / courseAttendance.length) * 100 : 0;
    const average =
      courseGraded.length > 0
        ? courseGraded.reduce((sum, submission) => sum + (submission.grade?.score ?? 0), 0) / courseGraded.length
        : null;

    return {
      courseId,
      title: enrollment.course.title,
      code: enrollment.course.code,
      average,
      absences: courseAbsences,
      attendanceTotal: courseAttendance.length,
      absencePct,
      riskScore: (average !== null && average < 5 ? 1 : 0) + (absencePct >= 20 ? 1 : 0),
    };
  }).sort((a, b) => b.riskScore - a.riskScore || b.absencePct - a.absencePct);
  const highRiskCourses = courseInsights.filter((insight) => insight.riskScore >= 2);
  const hasHighRisk = highRiskCourses.length > 0;

  function handleExportPdf() {
    const reportSource = selected;
    if (!reportSource) return;

    setExportingPdf(true);
    try {
      exportStudentTrackingPdf({
        studentName: reportSource.student.fullName,
        studentEmail: reportSource.student.email,
        relationship: reportSource.relationship,
        contextLabel: "Portal familiar",
        courses: reportSource.student.enrollments.map((enrollment) => ({
          code: enrollment.course.code,
          title: enrollment.course.title,
        })),
        assignments: reportSource.assignments.map((assignment) => ({
          courseTitle:
            reportSource.student.enrollments.find((enrollment) => enrollment.course.id === assignment.courseId)
              ?.course.title ?? "Asignatura",
          title: assignment.title,
          dueDate: assignment.dueDate,
        })),
        submissions: reportSource.submissions.map((submission) => ({
          courseTitle:
            reportSource.student.enrollments.find((enrollment) => enrollment.course.id === submission.assignment.courseId)
              ?.course.title ?? "Asignatura",
          assignmentTitle: submission.assignment.title,
          submittedAt: submission.submittedAt,
          status: submission.submittedAt ? "SUBMITTED" : "DRAFT",
          grade: submission.grade?.score ?? null,
          feedback: submission.grade?.feedback,
        })),
        attendance: reportSource.attendance.map((record) => ({
          courseTitle: record.course.title,
          date: record.date,
          status: record.status,
        })),
        notices: [
          ...reportSource.notifications.map((notification) => notification.title),
          ...reportSource.announcements.map((announcement) => announcement.title),
        ],
      });
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-[#15231d]">Portal familiar</h2>
            {hasHighRisk && (
              <span className="rounded-full bg-[#b0413e] px-2.5 py-1 text-xs font-bold uppercase tracking-widest text-white">
                Riesgo alto detectado
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#55635d]">Seguimiento académico, asistencia y avisos del alumno vinculado.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.students.length > 1 && (
            <select
              value={selected.student.id}
              onChange={(e) => setSelectedStudentId(Number(e.target.value))}
              className="rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-sm text-[#15231d] outline-none focus:border-[#c4643b]"
            >
              {data.students.map((entry) => (
                <option key={entry.student.id} value={entry.student.id}>{entry.student.fullName}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className="rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-2.5 text-sm font-semibold text-[#15231d] transition hover:bg-[#f1e7db] disabled:opacity-60"
          >
            {exportingPdf ? "Generando PDF..." : "Exportar seguimiento PDF"}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
        <p className="text-lg font-semibold text-[#15231d]">{selected.student.fullName}</p>
        <p className="mt-1 text-sm text-[#55635d]">{selected.student.email}{selected.relationship ? ` · ${selected.relationship}` : ""}</p>
      </div>

      {hasHighRisk && (
        <section className="rounded-3xl border border-[rgba(176,65,62,0.3)] bg-[#fff3f2] p-5">
          <h3 className="text-base font-semibold text-[#8a2f2d]">Aviso prioritario</h3>
          <p className="mt-1 text-sm text-[#8a2f2d]">
            Se detectó riesgo alto en {highRiskCourses.length} asignatura{highRiskCourses.length === 1 ? "" : "s"}. Revisa faltas y rendimiento para actuar cuanto antes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {highRiskCourses.map((course) => (
              <span
                key={`high-risk-chip-${course.courseId}`}
                className="rounded-full border border-[rgba(176,65,62,0.24)] bg-white px-2.5 py-1 text-xs font-semibold text-[#8a2f2d]"
              >
                {course.code} · {course.title}
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Cursos", value: selected.student.enrollments.length, helper: "Matriculado" },
          { label: "Media", value: averageGrade !== null ? averageGrade.toFixed(2) : "-", helper: "Notas registradas" },
          { label: "Faltas", value: absences, helper: "Ausencias acumuladas" },
          { label: "Asistencia", value: attendanceRate !== null ? `${attendanceRate.toFixed(0)}%` : "-", helper: "Presencia global" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-[#15231d]">{stat.value}</p>
            <p className="mt-1 text-xs text-[#55635d]">{stat.helper}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
        <h3 className="text-base font-semibold text-[#15231d]">Riesgo por asignatura</h3>
        <p className="mt-1 text-xs text-[#8c6d57]">Se marca riesgo cuando la media es menor a 5 o el porcentaje de faltas es mayor o igual al 20%.</p>
        {courseInsights.length === 0 ? (
          <p className="mt-3 text-sm text-[#8c6d57]">Sin asignaturas para analizar.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {courseInsights.map((insight) => {
              const riskLabel = insight.riskScore >= 2 ? "Alto" : insight.riskScore === 1 ? "Medio" : "Bajo";
              const riskClass =
                insight.riskScore >= 2
                  ? "bg-[#fde8e8] text-[#8a2f2d]"
                  : insight.riskScore === 1
                  ? "bg-[#fef3c7] text-[#6b4a00]"
                  : "bg-[#d1e8de] text-[#1b5c40]";

              return (
                <div key={`risk-${insight.courseId}`} className="rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[#15231d]">{insight.code} · {insight.title}</p>
                      <p className="text-xs text-[#8c6d57]">Media: {insight.average !== null ? insight.average.toFixed(2) : "-"} · Faltas: {insight.absences}/{insight.attendanceTotal}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskClass}`}>Riesgo {riskLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
          <h3 className="text-base font-semibold text-[#15231d]">Próximas tareas</h3>
          {upcomingAssignments.length === 0 ? (
            <p className="mt-3 text-sm text-[#8c6d57]">No hay tareas próximas.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {upcomingAssignments.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2">
                  <p className="text-sm font-medium text-[#15231d]">{assignment.title}</p>
                  <p className="text-xs text-[#8c6d57]">Entrega: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString("es") : "Sin fecha"}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
          <h3 className="text-base font-semibold text-[#15231d]">Últimas calificaciones</h3>
          {graded.length === 0 ? (
            <p className="mt-3 text-sm text-[#8c6d57]">Aún no hay notas publicadas.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {graded.slice(0, 5).map((submission) => (
                <div key={submission.id} className="flex items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[#15231d]">{submission.assignment.title}</p>
                    <p className="text-xs text-[#8c6d57]">{submission.grade?.gradedAt ? new Date(submission.grade.gradedAt).toLocaleDateString("es") : "Sin fecha"}</p>
                  </div>
                  <span className="text-lg font-bold text-[#c4643b]">{submission.grade?.score}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
          <h3 className="text-base font-semibold text-[#15231d]">Asistencia reciente</h3>
          {selected.attendance.length === 0 ? (
            <p className="mt-3 text-sm text-[#8c6d57]">Sin registros de asistencia.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {selected.attendance.slice(0, 6).map((record) => (
                <div key={record.id} className="flex items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-[#15231d]">{record.course.title}</p>
                    <p className="text-xs text-[#8c6d57]">{new Date(record.date).toLocaleDateString("es")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#15231d]">{record.status === "ABSENT" ? "Ausente" : record.status === "LATE" ? "Tardanza" : "Presente"}</p>
                    {record.justificationStatus !== "NONE" && (
                      <p className="text-[11px] text-[#8c6d57]">Justificante: {record.justificationStatus}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
          <h3 className="text-base font-semibold text-[#15231d]">Avisos relevantes</h3>
          {selected.notifications.length === 0 && selected.announcements.length === 0 ? (
            <p className="mt-3 text-sm text-[#8c6d57]">Sin avisos recientes.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {selected.notifications.slice(0, 3).map((notification) => (
                <div key={`notification-${notification.id}`} className="rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2">
                  <p className="text-sm font-medium text-[#15231d]">{notification.title}</p>
                  <p className="mt-1 text-xs text-[#55635d]">{notification.body}</p>
                </div>
              ))}
              {selected.announcements.slice(0, 3).map((announcement) => (
                <div key={`announcement-${announcement.id}`} className="rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2">
                  <p className="text-sm font-medium text-[#15231d]">{announcement.title}</p>
                  <p className="mt-1 text-xs text-[#55635d]">{announcement.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <MessagesPanel
        currentUserId={familyId}
        title="Mensajes con profesorado"
        emptyHint="Cuando haya docentes vinculados a tus alumnos, podrás escribirles aquí."
      />
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
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [pendingSubmissions, setPendingSubmissions] = useState<Array<TeacherSubmissionOverview & { courseId: number; courseTitle: string }>>([]);
  const [pendingJustifications, setPendingJustifications] = useState<Array<TeacherAttendanceOverview & { courseTitle: string }>>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<AssignmentOverview[]>([]);
  const [riskStudents, setRiskStudents] = useState<Array<{ courseId: number; courseTitle: string; studentId: number; studentName: string; absenceRate: number; absences: number; total: number }>>([]);
  const [studentReports, setStudentReports] = useState<TeacherStudentReport[]>([]);
  const [selectedReportStudentId, setSelectedReportStudentId] = useState<number | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Course[]>("/courses"),
    ])
      .then(([coursesData]) => {
        setCourses(coursesData);
        return coursesData;
      })
      .then(async (coursesData) => {
        if (coursesData.length === 0) {
          setPendingSubmissions([]);
          setPendingJustifications([]);
          setUpcomingAssignments([]);
          setRiskStudents([]);
          return;
        }

        setAlertsLoading(true);
        const courseData = await Promise.all(
          coursesData.map(async (course) => {
            const [assignments, submissions, attendance] = await Promise.all([
              apiFetch<AssignmentOverview[]>(`/assignments?courseId=${course.id}`),
              apiFetch<TeacherSubmissionOverview[]>(`/grades/course/${course.id}`),
              apiFetch<TeacherAttendanceOverview[]>(`/attendance/course/${course.id}`),
            ]);

            return { course, assignments, submissions, attendance };
          }),
        );

        const now = Date.now();
        const nextWeek = now + 7 * 24 * 60 * 60 * 1000;

        setPendingSubmissions(
          courseData
            .flatMap(({ course, submissions }) =>
              submissions
                .filter((submission) => submission.status === "SUBMITTED" && !submission.grade)
                .map((submission) => ({
                  ...submission,
                  courseId: course.id,
                  courseTitle: course.title,
                })),
            )
            .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()),
        );

        setPendingJustifications(
          courseData.flatMap(({ course, attendance }) =>
            attendance
              .filter((record) => record.justificationStatus === "PENDING")
              .map((record) => ({ ...record, courseTitle: course.title })),
          ),
        );

        setUpcomingAssignments(
          courseData
            .flatMap(({ assignments }) => assignments)
            .filter((assignment) => {
              if (!assignment.dueDate) return false;
              const dueTime = new Date(assignment.dueDate).getTime();
              return dueTime >= now && dueTime <= nextWeek;
            })
            .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()),
        );

        setRiskStudents(
          courseData.flatMap(({ course, attendance }) => {
            const grouped = attendance.reduce<Record<number, { studentName: string; total: number; absences: number }>>((acc, record) => {
              if (!acc[record.studentId]) {
                acc[record.studentId] = {
                  studentName: record.student.fullName,
                  total: 0,
                  absences: 0,
                };
              }
              acc[record.studentId].total += 1;
              if (record.status === "ABSENT") acc[record.studentId].absences += 1;
              return acc;
            }, {});

            return Object.entries(grouped)
              .map(([studentId, data]) => ({
                courseId: course.id,
                courseTitle: course.title,
                studentId: Number(studentId),
                studentName: data.studentName,
                absenceRate: data.total > 0 ? (data.absences / data.total) * 100 : 0,
                absences: data.absences,
                total: data.total,
              }))
              .filter((student) => student.total >= 3 && student.absenceRate >= 20)
              .sort((a, b) => b.absenceRate - a.absenceRate);
          }),
        );

        const reportsByStudent = new Map<number, TeacherStudentReport>();
        const courseIdsByStudent = new Map<number, Set<number>>();

        for (const { course, submissions, attendance } of courseData) {
          for (const submission of submissions) {
            const existing = reportsByStudent.get(submission.studentId) ?? {
              studentId: submission.studentId,
              studentName: submission.student.fullName,
              courses: [],
              assignments: [],
              submissions: [],
              attendance: [],
            };

            existing.submissions.push({
              courseTitle: course.title,
              assignmentTitle: submission.assignment.title,
              submittedAt: submission.submittedAt,
              status: submission.status,
              grade: submission.grade?.score ?? null,
            });
            reportsByStudent.set(submission.studentId, existing);

            const coursesSet = courseIdsByStudent.get(submission.studentId) ?? new Set<number>();
            coursesSet.add(course.id);
            courseIdsByStudent.set(submission.studentId, coursesSet);
          }

          for (const record of attendance) {
            const existing = reportsByStudent.get(record.studentId) ?? {
              studentId: record.studentId,
              studentName: record.student.fullName,
              courses: [],
              assignments: [],
              submissions: [],
              attendance: [],
            };

            existing.attendance.push({
              courseTitle: course.title,
              date: record.date,
              status: record.status,
            });
            reportsByStudent.set(record.studentId, existing);

            const coursesSet = courseIdsByStudent.get(record.studentId) ?? new Set<number>();
            coursesSet.add(course.id);
            courseIdsByStudent.set(record.studentId, coursesSet);
          }
        }

        const reports = Array.from(reportsByStudent.values())
          .map((report) => {
            const studentCourseIds = courseIdsByStudent.get(report.studentId) ?? new Set<number>();
            const coursesForStudent = courseData
              .filter(({ course }) => studentCourseIds.has(course.id))
              .map(({ course }) => ({ code: course.code, title: course.title }));

            const assignmentMap = new Map<string, TrackingAssignment>();
            courseData
              .filter(({ course }) => studentCourseIds.has(course.id))
              .forEach(({ course, assignments }) => {
                assignments.forEach((assignment) => {
                  assignmentMap.set(`${course.id}-${assignment.id}`, {
                    courseTitle: course.title,
                    title: assignment.title,
                    dueDate: assignment.dueDate,
                  });
                });
              });

            return {
              ...report,
              courses: coursesForStudent,
              assignments: Array.from(assignmentMap.values()),
            };
          })
          .sort((a, b) => a.studentName.localeCompare(b.studentName));

        setStudentReports(reports);
        setSelectedReportStudentId((prev) => {
          if (prev && reports.some((report) => report.studentId === prev)) return prev;
          return reports[0]?.studentId ?? null;
        });
      })
      .finally(() => {
        setLoading(false);
        setAlertsLoading(false);
      });
  }, [teacherId]);

  function handleExportStudentPdf() {
    if (!selectedReportStudentId) return;
    const selectedReport = studentReports.find((report) => report.studentId === selectedReportStudentId);
    if (!selectedReport) return;

    setExportingPdf(true);
    try {
      exportStudentTrackingPdf({
        studentName: selectedReport.studentName,
        contextLabel: "Panel docente",
        courses: selectedReport.courses,
        assignments: selectedReport.assignments,
        submissions: selectedReport.submissions,
        attendance: selectedReport.attendance,
        notices: [
          `Exportado por docente el ${new Date().toLocaleDateString("es")}`,
        ],
      });
    } finally {
      setExportingPdf(false);
    }
  }

  const alertStats = [
    { label: "Pendientes de corregir", value: pendingSubmissions.length, helper: "Entregas sin nota" },
    { label: "Justificantes pendientes", value: pendingJustifications.length, helper: "Esperan revisión" },
    { label: "Entregas próximas", value: upcomingAssignments.length, helper: "Próximos 7 días" },
    { label: "Alumnos en riesgo", value: riskStudents.length, helper: "Faltas >= 20%" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight text-[#15231d]">
          Mis cursos
        </h2>
        {studentReports.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedReportStudentId ?? ""}
              onChange={(e) => setSelectedReportStudentId(Number(e.target.value))}
              className="rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-2.5 text-sm text-[#15231d] outline-none focus:border-[#c4643b]"
            >
              {studentReports.map((report) => (
                <option key={report.studentId} value={report.studentId}>{report.studentName}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportStudentPdf}
              disabled={!selectedReportStudentId || exportingPdf}
              className="rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-2.5 text-sm font-semibold text-[#15231d] transition hover:bg-[#f1e7db] disabled:opacity-60"
            >
              {exportingPdf ? "Generando PDF..." : "Exportar seguimiento PDF"}
            </button>
          </div>
        )}
      </div>
      {alertsLoading ? (
        <p className="text-sm text-[#55635d]">Preparando alertas...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {alertStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-[#15231d]">{stat.value}</p>
                <p className="mt-1 text-xs text-[#55635d]">{stat.helper}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
              <h3 className="text-base font-semibold text-[#15231d]">Alertas del profesorado</h3>
              <div className="mt-3 space-y-2">
                {pendingSubmissions.slice(0, 4).map((submission) => (
                  <button
                    key={`submission-${submission.id}`}
                    type="button"
                    onClick={() => router.push(`/dashboard/curso/${submission.courseId}?tab=grades`)}
                    className="flex w-full items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2 text-left transition hover:border-[#c4643b] hover:bg-[#fffaf5]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#15231d]">{submission.student.fullName}</p>
                      <p className="text-xs text-[#8c6d57]">{submission.assignment.title} · {submission.courseTitle}</p>
                    </div>
                    <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-[#6b4a00]">Corregir</span>
                  </button>
                ))}
                {pendingJustifications.slice(0, 4).map((record) => (
                  <button
                    key={`justification-${record.id}`}
                    type="button"
                    onClick={() => router.push(`/dashboard/curso/${record.courseId}?tab=attendance`)}
                    className="flex w-full items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2 text-left transition hover:border-[#c4643b] hover:bg-[#fffaf5]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#15231d]">{record.student.fullName}</p>
                      <p className="text-xs text-[#8c6d57]">Justificante pendiente · {record.courseTitle}</p>
                    </div>
                    <span className="rounded-full bg-[#fde8e8] px-2 py-0.5 text-[11px] font-semibold text-[#8a2f2d]">Revisar</span>
                  </button>
                ))}
                {pendingSubmissions.length === 0 && pendingJustifications.length === 0 && (
                  <p className="text-sm text-[#8c6d57]">No hay alertas urgentes ahora mismo.</p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
              <h3 className="text-base font-semibold text-[#15231d]">Seguimiento del curso</h3>
              <div className="mt-3 space-y-2">
                {riskStudents.slice(0, 4).map((student) => (
                  <button
                    key={`risk-${student.courseId}-${student.studentId}`}
                    type="button"
                    onClick={() => router.push(`/dashboard/curso/${student.courseId}?tab=attendance`)}
                    className="flex w-full items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2 text-left transition hover:border-[#c4643b] hover:bg-[#fffaf5]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#15231d]">{student.studentName}</p>
                      <p className="text-xs text-[#8c6d57]">{student.courseTitle} · {student.absences}/{student.total} faltas</p>
                    </div>
                    <span className="text-sm font-bold text-[#b0413e]">{student.absenceRate.toFixed(0)}%</span>
                  </button>
                ))}
                {upcomingAssignments.slice(0, 4).map((assignment) => (
                  <button
                    key={`upcoming-${assignment.id}`}
                    type="button"
                    onClick={() => router.push(`/dashboard/curso/${assignment.courseId}?tab=assignments`)}
                    className="flex w-full items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2 text-left transition hover:border-[#c4643b] hover:bg-[#fffaf5]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#15231d]">{assignment.title}</p>
                      <p className="text-xs text-[#8c6d57]">Entrega próxima</p>
                    </div>
                    <span className="text-xs font-semibold text-[#8c6d57]">
                      {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString("es") : "Sin fecha"}
                    </span>
                  </button>
                ))}
                {riskStudents.length === 0 && upcomingAssignments.length === 0 && (
                  <p className="text-sm text-[#8c6d57]">Sin incidencias ni entregas próximas destacables.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
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
  const [peerTyping, setPeerTyping] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const selectedContactRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectedContactRef.current = selectedContactId;
    setPeerTyping(false);
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
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("reconnect", () => setSocketConnected(true));

    socket.on("typing:start", (data: { userId: number }) => {
      if (selectedContactRef.current === data.userId) {
        setPeerTyping(true);
      }
    });

    socket.on("typing:stop", (data: { userId: number }) => {
      if (selectedContactRef.current === data.userId) {
        setPeerTyping(false);
      }
    });

    socket.on("messages:new", (incoming: ChatMessage) => {
      const currentContactId = selectedContactRef.current;
      const peerId =
        incoming.sender.id === currentUserId
          ? incoming.recipient.id
          : incoming.sender.id;
      const incomingForMe = incoming.recipient.id === currentUserId;

      setContacts((prev) => {
        const updated = prev.map((contact) => {
          if (contact.id !== peerId) return contact;
          if (!incomingForMe) return { ...contact, lastMessageAt: incoming.createdAt };
          if (currentContactId === peerId) {
            return { ...contact, unreadCount: 0, lastMessageAt: incoming.createdAt };
          }
          return { ...contact, unreadCount: contact.unreadCount + 1, lastMessageAt: incoming.createdAt };
        });
        return [...updated].sort((a, b) => {
          if (a.lastMessageAt && b.lastMessageAt) {
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
          }
          if (a.lastMessageAt) return -1;
          if (b.lastMessageAt) return 1;
          return a.fullName.localeCompare(b.fullName);
        });
      });

      if (peerId !== currentContactId) return;

      // Stop typing indicator when a message arrives
      setPeerTyping(false);

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

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!selectedContactId || !socketRef.current?.connected) return;
    socketRef.current.emit("typing:start", { recipientId: selectedContactId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", { recipientId: selectedContactId });
    }, 2000);
  }

  async function sendMessage(ev: React.FormEvent) {
    ev.preventDefault();
    if (!selectedContactId || !draft.trim()) return;

    // Stop typing indicator before sending
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socketRef.current?.emit("typing:stop", { recipientId: selectedContactId });

    setSending(true);
    setError(null);
    try {
      const created = await apiFetch<ChatMessage>("/messages", {
        method: "POST",
        body: JSON.stringify({ recipientId: selectedContactId, content: draft.trim() }),
      });
      setThread((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });
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
                            <div
                              className={`mt-1 flex items-center gap-1 text-[11px] ${
                                mine ? "justify-end text-[#d7e0da]" : "text-[#8c6d57]"
                              }`}
                            >
                              <span>{new Date(m.createdAt).toLocaleString("es")}</span>
                              {mine && (
                                <span title={m.readAt ? "Leído" : "Enviado"}>
                                  {m.readAt ? "✓✓" : "✓"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {peerTyping && (
                  <p className="mt-1 text-[11px] italic text-[#8c6d57]">
                    está escribiendo...
                  </p>
                )}

                <form onSubmit={sendMessage} className="mt-3 space-y-2">
                  <textarea
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    rows={3}
                    placeholder="Escribe un mensaje..."
                    className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-3 text-sm text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
                  />
                  <div className="flex items-center justify-between">
                    {error ? (
                      <p className="text-xs text-[#b0413e]">{error}</p>
                    ) : (
                      <span className="text-xs text-[#8c6d57]">
                        {!socketConnected && contacts.length > 0
                          ? "⚠ Reconectando..."
                          : "Mensajería disponible entre usuarios vinculados."}
                      </span>
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
    FAMILY: "bg-[#f7e4cf] text-[#8a4b1f]",
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
