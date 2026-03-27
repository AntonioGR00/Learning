"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, clearSession, getApiOrigin, getSession } from "@/lib/api";

/* ─── Types ─────────────────────────────────────────────────── */

type Student = { id: number; fullName: string; email: string };
type Enrollment = { student: Student };

type Course = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  teacherId: number;
  teacher: { id: number; fullName: string; email: string };
  enrollments: Enrollment[];
};

type Assignment = {
  id: number;
  courseId: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  attachmentUrl: string | null;
};

type AttendanceRecord = {
  id: number;
  courseId: number;
  studentId: number;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  notes: string | null;
  student: { id: number; fullName: string };
};

type Grade = {
  id: number;
  submissionId: number;
  score: number;
  feedback: string | null;
  gradedAt: string;
};

type Submission = {
  id: number;
  assignmentId: number;
  studentId: number;
  content: string | null;
  submittedAt: string | null;
  student: { id: number; fullName: string };
  assignment: { id: number; title: string };
  grade: Grade | null;
};

type Tab = "students" | "assignments" | "attendance" | "grades";

/* ─── Page ──────────────────────────────────────────────────── */

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const courseId = Number(params.id);
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [ready, setReady] = useState(false);

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("students");
  const requestedTab = searchParams.get("tab");

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession) {
      router.replace("/");
      setReady(true);
      return;
    }

    const allowedTabs: Tab[] = ["students", "assignments", "attendance", "grades"];
    const initialTab =
      requestedTab && allowedTabs.includes(requestedTab as Tab)
        ? (requestedTab as Tab)
        : currentSession.user.role === "STUDENT"
        ? "assignments"
        : "students";

    setSession(currentSession);
    setTab(initialTab);
    setReady(true);
  }, [requestedTab, router]);

  useEffect(() => {
    if (!session) return;

    apiFetch<Course>(`/courses/${courseId}`)
      .then(setCourse)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar el curso"))
      .finally(() => setLoading(false));
  }, [courseId, session]);

  if (!ready || !session) return null;

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  const isTeacher = session.user.role === "TEACHER";
  const isAdmin = session.user.role === "ADMIN";
  const isStudent = session.user.role === "STUDENT";
  const canManageCourse = isTeacher;
  const TABS: { key: Tab; label: string }[] = isTeacher || isAdmin
    ? [
        { key: "students", label: "Estudiantes" },
        { key: "assignments", label: "Tareas" },
        { key: "attendance", label: "Asistencia" },
        { key: "grades", label: "Calificaciones" },
      ]
    : isStudent
    ? [
        { key: "assignments", label: "Mis tareas" },
        { key: "attendance", label: "Mi asistencia" },
        { key: "grades", label: "Mis notas" },
      ]
    : [{ key: "students", label: "Estudiantes" }];

  return (
    <div className="min-h-screen bg-[#f4efe6]">
      {/* Header */}
      <header className="border-b border-[rgba(21,35,29,0.1)] bg-[rgba(255,252,247,0.8)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-3 py-1.5 text-sm text-[#55635d] transition hover:bg-[#f1e7db]"
            >
              ← Volver
            </button>
            {course && (
              <div>
                <span className="font-mono text-xs font-bold text-[#c4643b]">
                  {course.code}
                </span>
                <span className="ml-2 text-sm font-semibold text-[#15231d]">
                  {course.title}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-2 text-sm font-medium text-[#15231d] transition hover:bg-[#f1e7db]"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <p className="text-sm text-[#55635d]">Cargando curso...</p>
        ) : error ? (
          <p className="text-sm text-[#b0413e]">{error}</p>
        ) : !course ? null : (
          <div className="space-y-6">
            {/* Course info */}
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#15231d]">
                {course.title}
              </h2>
              {course.description && (
                <p className="mt-1 text-sm text-[#55635d]">{course.description}</p>
              )}
              <p className="mt-1 text-xs text-[#8c6d57]">
                Docente: {course.teacher.fullName}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-[rgba(21,35,29,0.1)]">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-t-2xl px-5 py-2 text-sm font-semibold transition ${
                    tab === t.key
                      ? "bg-white text-[#c4643b] shadow-sm border border-b-0 border-[rgba(21,35,29,0.1)]"
                      : "text-[#55635d] hover:text-[#15231d]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-6 shadow-sm sm:p-8">
              {tab === "students" && (
                <StudentsTab
                  course={course}
                  onEnrolled={setCourse}
                  canManage={canManageCourse}
                />
              )}
              {tab === "assignments" && (
                <AssignmentsTab
                  courseId={courseId}
                  canManage={canManageCourse}
                  studentId={isStudent ? session.user.id : undefined}
                />
              )}
              {tab === "attendance" && (
                <AttendanceTab
                  courseId={courseId}
                  students={course.enrollments.map((e) => e.student)}
                  canManage={canManageCourse}
                  studentId={isStudent ? session.user.id : undefined}
                />
              )}
              {tab === "grades" && (
                <GradesTab
                  courseId={courseId}
                  canManage={canManageCourse}
                  studentId={isStudent ? session.user.id : undefined}
                />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Students Tab ──────────────────────────────────────────── */

function StudentsTab({
  course,
  onEnrolled,
  canManage,
}: {
  course: Course;
  onEnrolled: (c: Course) => void;
  canManage: boolean;
}) {
  const students = course.enrollments.map((e) => e.student);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!canManage || !showForm) return;

    setLoadingOptions(true);
    setError(null);
    apiFetch<Student[]>(`/courses/${course.id}/available-students`)
      .then((data) => {
        setAvailableStudents(data);
        if (data.length > 0) {
          setSelectedStudentId(String(data[0].id));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar estudiantes"))
      .finally(() => setLoadingOptions(false));
  }, [canManage, showForm, course.id]);

  async function handleEnroll(ev: React.FormEvent) {
    ev.preventDefault();
    if (!selectedStudentId) {
      setError("Selecciona un estudiante");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch("/courses/enrollments", {
        method: "POST",
        body: JSON.stringify({ courseId: course.id, studentId: Number(selectedStudentId) }),
      });
      // Refresh the course to see updated enrollments
      const updated = await apiFetch<Course>(`/courses/${course.id}`);
      onEnrolled(updated);
      setSelectedStudentId("");
      setStudentFilter("");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al matricular");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#15231d]">
          Estudiantes matriculados{" "}
          <span className="ml-1 rounded-full bg-[#f3d4b7] px-2 py-0.5 text-xs font-bold text-[#7a3a1e]">
            {students.length}
          </span>
        </h3>
        {canManage ? (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-2xl bg-[#c4643b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9f4c2a]"
          >
            {showForm ? "Cancelar" : "+ Matricular estudiante"}
          </button>
        ) : null}
      </div>

      {canManage && showForm && (
        <form
          onSubmit={handleEnroll}
          className="grid gap-3 rounded-2xl border border-[rgba(196,100,59,0.2)] bg-[#fdf7f2] p-4 sm:grid-cols-2"
        >
          <label className="space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Curso</span>
            <input
              type="text"
              value={`${course.code} - ${course.title}`}
              readOnly
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-[#f5f7f6] px-4 py-3 text-[#55635d]"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Filtrar estudiante</span>
            <input
              type="text"
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              placeholder="Buscar por nombre o correo"
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            />
          </label>

          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-[#30433a]">Seleccionar estudiante</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={loadingOptions}
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            >
              {(availableStudents.filter((s) => {
                const q = studentFilter.trim().toLowerCase();
                if (!q) return true;
                return (
                  s.fullName.toLowerCase().includes(q) ||
                  s.email.toLowerCase().includes(q) ||
                  String(s.id).includes(q)
                );
              })).map((s) => (
                <option key={s.id} value={s.id}>
                  {`${s.id} - ${s.fullName} (${s.email})`}
                </option>
              ))}
            </select>
            {!loadingOptions && availableStudents.length === 0 ? (
              <p className="text-xs text-[#8c6d57]">No hay estudiantes disponibles para matricular.</p>
            ) : null}
          </label>

          {error && <p className="text-sm text-[#b0413e] sm:col-span-2">{error}</p>}

          <button
            type="submit"
            disabled={saving || loadingOptions || availableStudents.length === 0 || !selectedStudentId}
            className="rounded-2xl bg-[#15231d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60 sm:col-span-2"
          >
            {saving ? "Guardando..." : "Matricular"}
          </button>
        </form>
      )}

      {students.length === 0 ? (
        <p className="text-sm text-[#8c6d57]">
          Sin estudiantes matriculados todavía.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(21,35,29,0.08)] text-left text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
                <th className="pb-3 pr-4">ID</th>
                <th className="pb-3 pr-4">Nombre</th>
                <th className="pb-3">Correo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(21,35,29,0.06)]">
              {students.map((s) => (
                <tr key={s.id} className="text-[#15231d]">
                  <td className="py-3 pr-4 font-mono text-xs text-[#8c6d57]">{s.id}</td>
                  <td className="py-3 pr-4 font-medium">{s.fullName}</td>
                  <td className="py-3 text-[#55635d]">{s.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Assignments Tab ───────────────────────────────────────── */

function AssignmentsTab({
  courseId,
  canManage,
  studentId,
}: {
  courseId: number;
  canManage: boolean;
  studentId?: number;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Student mode: track submissions per assignment
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [submitContent, setSubmitContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const loadAssignments = apiFetch<Assignment[]>(`/assignments?courseId=${courseId}`)
      .then(setAssignments)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));

    if (studentId) {
      Promise.all([
        loadAssignments,
        apiFetch<Submission[]>(`/grades/course/${courseId}`)
          .then((data) => setSubmissions(data.filter((s) => s.studentId === studentId)))
          .catch(() => {}),
      ]).finally(() => setLoading(false));
    } else {
      loadAssignments.finally(() => setLoading(false));
    }
  }, [courseId, studentId]);

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append("courseId", String(courseId));
      fd.append("title", form.title);
      if (form.description) fd.append("description", form.description);
      if (form.dueDate) fd.append("dueDate", form.dueDate);
      if (selectedFile) fd.append("file", selectedFile);

      const created = await apiFetch<Assignment>("/assignments", {
        method: "POST",
        body: fd,
      });
      setAssignments((prev) => [created, ...prev]);
      setForm({ title: "", description: "", dueDate: "" });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al crear tarea");
    } finally {
      setSaving(false);
    }
  }

  async function handleStudentSubmit(assignmentId: number) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiFetch<unknown>(`/assignments/${assignmentId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ content: submitContent || undefined }),
      });
      // Reload submissions to get full nested data
      const updated = await apiFetch<Submission[]>(`/grades/course/${courseId}`);
      setSubmissions(updated.filter((s) => s.studentId === studentId));
      setSubmittingId(null);
      setSubmitContent("");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al entregar");
    } finally {
      setSubmitting(false);
    }
  }

  if (studentId) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-[#15231d]">Mis tareas</h3>

        {loading ? (
          <p className="text-sm text-[#55635d]">Cargando...</p>
        ) : error ? (
          <p className="text-sm text-[#b0413e]">{error}</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-[#8c6d57]">Sin tareas publicadas todavía.</p>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const sub = submissions.find((s) => s.assignmentId === a.id);
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-[rgba(21,35,29,0.08)] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#15231d]">{a.title}</p>
                      {a.description && (
                        <p className="mt-1 text-sm text-[#55635d]">{a.description}</p>
                      )}
                      {a.dueDate && (
                        <p className="mt-1 text-xs text-[#8c6d57]">
                          Fecha límite:{" "}
                          {new Date(a.dueDate).toLocaleDateString("es", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      {a.attachmentUrl && (
                        <a
                          href={`${getApiOrigin()}${a.attachmentUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#c4643b] hover:underline"
                        >
                          📎 Ver adjunto
                        </a>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {sub ? (
                        <div>
                          {sub.grade ? (
                            <p className="text-2xl font-bold text-[#c4643b]">{sub.grade.score}</p>
                          ) : (
                            <span className="rounded-full bg-[#d1e8de] px-2.5 py-0.5 text-xs font-semibold text-[#1b5c40]">
                              Entregado
                            </span>
                          )}
                          {sub.submittedAt && (
                            <p className="mt-1 text-xs text-[#8c6d57]">
                              {new Date(sub.submittedAt).toLocaleDateString("es")}
                            </p>
                          )}
                          {sub.grade?.feedback && (
                            <p className="mt-1 text-xs text-[#55635d]">{sub.grade.feedback}</p>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSubmittingId(a.id); setSubmitContent(""); setSubmitError(null); }}
                          className="rounded-2xl bg-[#c4643b] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#9f4c2a]"
                        >
                          Entregar
                        </button>
                      )}
                    </div>
                  </div>

                  {submittingId === a.id && (
                    <div className="space-y-3 rounded-xl bg-[#fdf7f2] p-4">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-[#30433a]">Respuesta / comentarios (opcional)</span>
                        <textarea
                          value={submitContent}
                          onChange={(e) => setSubmitContent(e.target.value)}
                          placeholder="Escribe tu respuesta aquí..."
                          rows={3}
                          className="w-full rounded-xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-sm text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
                        />
                      </label>
                      {submitError && <p className="text-xs text-[#b0413e]">{submitError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStudentSubmit(a.id)}
                          disabled={submitting}
                          className="rounded-xl bg-[#15231d] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
                        >
                          {submitting ? "Enviando..." : "Confirmar entrega"}
                        </button>
                        <button
                          onClick={() => setSubmittingId(null)}
                          className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-2 text-xs text-[#55635d] transition hover:bg-[#f1e7db]"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#15231d]">Tareas</h3>
        {canManage && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-2xl bg-[#c4643b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9f4c2a]"
          >
            {showForm ? "Cancelar" : "+ Nueva tarea"}
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-4 rounded-2xl border border-[rgba(196,100,59,0.2)] bg-[#fdf7f2] p-5 sm:grid-cols-2"
        >
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-[#30433a]">Título</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Examen parcial 1"
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-[#30433a]">Descripción (opcional)</span>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Instrucciones..."
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Fecha límite (opcional)</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            />
          </label>
          <div className="space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-[#30433a]">Archivo adjunto (opcional)</span>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-2.5 text-sm font-medium text-[#15231d] transition hover:bg-[#f1e7db]"
              >
                Elegir archivo
              </button>
              {selectedFile ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[#55635d] truncate max-w-xs">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-xs text-[#8c6d57] hover:text-[#b0413e]"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <span className="text-sm text-[#8d9a94]">Sin archivo</span>
              )}
            </div>
            <p className="text-xs text-[#8c6d57]">PDF, Word, PowerPoint, Excel, ZIP, imágenes · máx. 10 MB</p>
          </div>
          {formError && (
            <p className="text-sm text-[#b0413e] sm:col-span-2">{formError}</p>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-[#15231d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Crear tarea"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[#55635d]">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-[#b0413e]">{error}</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-[#8c6d57]">Sin tareas todavía.</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-[rgba(21,35,29,0.08)] p-4"
            >
              <p className="font-semibold text-[#15231d]">{a.title}</p>
              {a.description && (
                <p className="mt-1 text-sm text-[#55635d]">{a.description}</p>
              )}
              {a.dueDate && (
                <p className="mt-2 text-xs text-[#8c6d57]">
                  Entrega:{" "}
                  {new Date(a.dueDate).toLocaleDateString("es", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {a.attachmentUrl && (
                <a
                  href={`${getApiOrigin()}${a.attachmentUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#c4643b] hover:underline"
                >
                  📎 Ver adjunto
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Attendance Tab ────────────────────────────────────────── */

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "LATE"] as const;
const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Presente",
  ABSENT: "Ausente",
  LATE: "Tardanza",
};
const STATUS_COLOR: Record<string, string> = {
  PRESENT: "bg-[#d1e8de] text-[#1b5c40]",
  ABSENT: "bg-[#fde8e8] text-[#8a2f2d]",
  LATE: "bg-[#fef3c7] text-[#6b4a00]",
};

function AttendanceTab({
  courseId,
  students,
  canManage,
  studentId,
}: {
  courseId: number;
  students: Student[];
  canManage: boolean;
  studentId?: number;
}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState<Record<number, (typeof STATUS_OPTIONS)[number]>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AttendanceRecord[]>(`/attendance/course/${courseId}`)
      .then(setRecords)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [courseId]);

  // Init all students to PRESENT when form opens
  function openForm() {
    const initial: Record<number, (typeof STATUS_OPTIONS)[number]> = {};
    students.forEach((s) => { initial[s.id] = "PRESENT"; });
    setStatuses(initial);
    setShowForm(true);
  }

  async function handleMark(ev: React.FormEvent) {
    ev.preventDefault();
    if (students.length === 0) return;
    setSaving(true);
    setFormError(null);
    try {
      await Promise.all(
        students.map((s) =>
          apiFetch<unknown>("/attendance", {
            method: "POST",
            body: JSON.stringify({
              courseId,
              studentId: s.id,
              date,
              status: statuses[s.id] ?? "PRESENT",
            }),
          })
        )
      );
      // Reload from API to get records with full student relation
      const fresh = await apiFetch<AttendanceRecord[]>(`/attendance/course/${courseId}`);
      setRecords(fresh);
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar asistencia");
    } finally {
      setSaving(false);
    }
  }

  // Group records by date for display
  const displayRecords = studentId ? records.filter((r) => r.studentId === studentId) : records;
  const byDate: Record<string, AttendanceRecord[]> = {};
  displayRecords.forEach((r) => {
    const d = r.date.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  });
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  if (studentId) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-[#15231d]">Mi asistencia</h3>
        {loading ? (
          <p className="text-sm text-[#55635d]">Cargando...</p>
        ) : error ? (
          <p className="text-sm text-[#b0413e]">{error}</p>
        ) : sortedDates.length === 0 ? (
          <p className="text-sm text-[#8c6d57]">Sin registros de asistencia todavía.</p>
        ) : (
          <div className="space-y-4">
            {sortedDates.map((d) => (
              <div key={d} className="flex items-center justify-between rounded-xl border border-[rgba(21,35,29,0.06)] px-4 py-3 text-sm">
                <span className="text-[#55635d]">
                  {new Date(d + "T12:00:00").toLocaleDateString("es", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[byDate[d][0].status] ?? ""}`}>
                  {STATUS_LABEL[byDate[d][0].status] ?? byDate[d][0].status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#15231d]">Asistencia</h3>
        {canManage ? (
          <button
            onClick={showForm ? () => setShowForm(false) : openForm}
            disabled={students.length === 0}
            className="rounded-2xl bg-[#c4643b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9f4c2a] disabled:opacity-50"
          >
            {showForm ? "Cancelar" : "+ Registrar asistencia"}
          </button>
        ) : null}
      </div>

      {students.length === 0 && (
        <p className="text-sm text-[#8c6d57]">
          Matricula estudiantes primero para registrar asistencia.
        </p>
      )}

      {canManage && showForm && students.length > 0 && (
        <form
          onSubmit={handleMark}
          className="space-y-4 rounded-2xl border border-[rgba(196,100,59,0.2)] bg-[#fdf7f2] p-5"
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-48 rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            />
          </label>

          <div className="space-y-2">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                <span className="text-sm font-medium text-[#15231d]">{s.fullName}</span>
                <select
                  value={statuses[s.id] ?? "PRESENT"}
                  onChange={(e) =>
                    setStatuses((prev) => ({
                      ...prev,
                      [s.id]: e.target.value as (typeof STATUS_OPTIONS)[number],
                    }))
                  }
                  className="rounded-xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-1.5 text-sm text-[#15231d] outline-none focus:border-[#c4643b]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {formError && <p className="text-sm text-[#b0413e]">{formError}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-[#15231d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar asistencia"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[#55635d]">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-[#b0413e]">{error}</p>
      ) : sortedDates.length === 0 ? (
        <p className="text-sm text-[#8c6d57]">Sin registros de asistencia todavía.</p>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((d) => (
            <div key={d}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
                {new Date(d + "T12:00:00").toLocaleDateString("es", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
              <div className="space-y-1">
                {byDate[d].map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-[rgba(21,35,29,0.06)] px-4 py-2.5 text-sm"
                  >
                    <span className="text-[#15231d]">{r.student.fullName}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? ""}`}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Grades Tab ────────────────────────────────────────────── */

function GradesTab({
  courseId,
  canManage,
  studentId,
}: {
  courseId: number;
  canManage: boolean;
  studentId?: number;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState<number | null>(null); // submissionId being graded
  const [gradeForm, setGradeForm] = useState({ score: "", feedback: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Submission[]>(`/grades/course/${courseId}`)
      .then(setSubmissions)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [courseId]);

  async function handleGrade(submissionId: number) {
    setSaving(true);
    setFormError(null);
    try {
      const grade = await apiFetch<Grade>("/grades", {
        method: "POST",
        body: JSON.stringify({
          submissionId,
          score: Number(gradeForm.score),
          feedback: gradeForm.feedback || undefined,
        }),
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, grade } : s))
      );
      setGrading(null);
      setGradeForm({ score: "", feedback: "" });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al calificar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#15231d]">
        {studentId ? "Mis notas" : "Calificaciones"}
      </h3>
      {!studentId && (
        <p className="text-sm text-[#55635d]">
          Entregas de estudiantes para las tareas de este curso.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[#55635d]">Cargando...</p>
      ) : error ? (
        <p className="text-sm text-[#b0413e]">{error}</p>
      ) : submissions.filter((s) => !studentId || s.studentId === studentId).length === 0 ? (
        <p className="text-sm text-[#8c6d57]">
          {studentId
            ? "Aún no tienes entregas calificadas."
            : "No hay entregas todavía. Las aparecerán aquí cuando los estudiantes entreguen tareas."}
        </p>
      ) : (
        <div className="space-y-3">
          {submissions.filter((s) => !studentId || s.studentId === studentId).map((sub) => (
            <div
              key={sub.id}
              className="rounded-2xl border border-[rgba(21,35,29,0.08)] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  {!studentId && <p className="font-semibold text-[#15231d]">{sub.student.fullName}</p>}
                  <p className={studentId ? "font-semibold text-[#15231d]" : "text-xs text-[#8c6d57]"}>
                    {studentId ? sub.assignment.title : `Tarea: ${sub.assignment.title}`}
                  </p>
                  {sub.content && (
                    <p className="mt-1 text-sm text-[#55635d] line-clamp-2">{sub.content}</p>
                  )}
                  {sub.submittedAt && (
                    <p className="mt-1 text-xs text-[#8c6d57]">
                      Entregado:{" "}
                      {new Date(sub.submittedAt).toLocaleDateString("es", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>

                {sub.grade ? (
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-[#c4643b]">
                      {sub.grade.score}
                    </p>
                    {sub.grade.feedback && (
                      <p className="mt-0.5 text-xs text-[#55635d]">{sub.grade.feedback}</p>
                    )}
                    {canManage ? (
                      <button
                        onClick={() => {
                          setGrading(sub.id);
                          setGradeForm({
                            score: String(sub.grade!.score),
                            feedback: sub.grade!.feedback ?? "",
                          });
                        }}
                        className="mt-1 text-xs text-[#8c6d57] underline hover:text-[#c4643b]"
                      >
                        Editar
                      </button>
                    ) : null}
                  </div>
                ) : (
                  canManage ? (
                    <button
                      onClick={() => { setGrading(sub.id); setGradeForm({ score: "", feedback: "" }); }}
                      className="shrink-0 rounded-2xl bg-[#c4643b] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#9f4c2a]"
                    >
                      Calificar
                    </button>
                  ) : null
                )}
              </div>

              {canManage && grading === sub.id && (
                <div className="flex items-end gap-3 rounded-xl bg-[#fdf7f2] p-4">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-[#30433a]">Puntaje</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={gradeForm.score}
                      onChange={(e) => setGradeForm((f) => ({ ...f, score: e.target.value }))}
                      placeholder="0–100"
                      className="w-24 rounded-xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-sm text-[#15231d] outline-none focus:border-[#c4643b]"
                    />
                  </label>
                  <label className="flex-1 space-y-1">
                    <span className="text-xs font-medium text-[#30433a]">Comentario (opcional)</span>
                    <input
                      type="text"
                      value={gradeForm.feedback}
                      onChange={(e) => setGradeForm((f) => ({ ...f, feedback: e.target.value }))}
                      placeholder="Buen trabajo..."
                      className="w-full rounded-xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-sm text-[#15231d] outline-none focus:border-[#c4643b]"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGrade(sub.id)}
                      disabled={saving || !gradeForm.score}
                      className="rounded-xl bg-[#15231d] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? "..." : "Guardar"}
                    </button>
                    <button
                      onClick={() => setGrading(null)}
                      className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-2 text-xs text-[#55635d]"
                    >
                      ✕
                    </button>
                  </div>
                  {formError && <p className="text-xs text-[#b0413e]">{formError}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
