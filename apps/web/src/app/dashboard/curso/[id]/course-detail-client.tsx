"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, clearSession, getApiOrigin, getSession } from "@/lib/api";
import { NotificationCenter } from "@/components/notification-center";

/* ÔöÇÔöÇÔöÇ Types ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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
  deliveryMode: "PLATFORM" | "FILE_UPLOAD";
  durationMinutes: number | null;
  secureMode: boolean;
  attachmentUrl: string | null;
  questions: string[];
};

type AttendanceRecord = {
  id: number;
  courseId: number;
  studentId: number;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  notes: string | null;
  justificationUrl: string | null;
  justificationMessage: string | null;
  justificationStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  justificationReviewComment: string | null;
  justificationReviewedAt: string | null;
  student: { id: number; fullName: string };
};

type Announcement = {
  id: number;
  title: string;
  body: string;
  courseId: number | null;
  createdAt: string;
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
  fileUrl: string | null;
  status: "DRAFT" | "SUBMITTED" | "DISQUALIFIED";
  submittedAt: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  student: { id: number; fullName: string };
  assignment: { id: number; title: string };
  grade: Grade | null;
};

type Tab = "students" | "assignments" | "attendance" | "grades" | "calendar" | "report";
type StudentAssignmentFilter = "ALL" | "PENDING" | "SUBMITTED" | "OVERDUE";

/* ÔöÇÔöÇÔöÇ Page ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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
  const [studentSummary, setStudentSummary] = useState<{
    totalAttendance: number;
    absences: number;
    absencePercentage: number;
    averageGrade: number | null;
  } | null>(null);
  const requestedTab = searchParams.get("tab");

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession) {
      router.replace("/");
      setReady(true);
      return;
    }

    const allowedTabs: Tab[] = ["students", "assignments", "attendance", "grades", "calendar", "report"];
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

  useEffect(() => {
    if (!session || session.user.role !== "STUDENT") {
      setStudentSummary(null);
      return;
    }

    Promise.all([
      apiFetch<AttendanceRecord[]>(`/attendance/course/${courseId}`),
      apiFetch<Submission[]>(`/grades/course/${courseId}`),
    ])
      .then(([attendance, submissions]) => {
        const mineAttendance = attendance.filter((r) => r.studentId === session.user.id);
        const mineSubmissions = submissions.filter((s) => s.studentId === session.user.id);

        const totalAttendance = mineAttendance.length;
        const absences = mineAttendance.filter((r) => r.status === "ABSENT").length;
        const absencePercentage = totalAttendance > 0 ? (absences / totalAttendance) * 100 : 0;

        const gradedScores = mineSubmissions
          .filter((s) => s.grade?.score !== undefined)
          .map((s) => Number(s.grade!.score));
        const averageGrade =
          gradedScores.length > 0
            ? gradedScores.reduce((sum, score) => sum + score, 0) / gradedScores.length
            : null;

        setStudentSummary({
          totalAttendance,
          absences,
          absencePercentage,
          averageGrade,
        });
      })
      .catch(() => setStudentSummary(null));
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
        { key: "calendar", label: "Calendario" },
      ]
    : isStudent
    ? [
        { key: "assignments", label: "Mis tareas" },
        { key: "attendance", label: "Mi asistencia" },
        { key: "grades", label: "Mis notas" },
        { key: "report", label: "Boletin" },
        { key: "calendar", label: "Calendario" },
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
              ÔåÉ Volver
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
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <button
              onClick={handleLogout}
              className="rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-2 text-sm font-medium text-[#15231d] transition hover:bg-[#f1e7db]"
            >
              Salir
            </button>
          </div>
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

            {isStudent && studentSummary && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8c6d57]">
                    Recuento faltas
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#b0413e]">
                    {studentSummary.absences}
                  </p>
                  <p className="mt-1 text-xs text-[#55635d]">
                    de {studentSummary.totalAttendance} clases registradas
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8c6d57]">
                    Porcentaje faltas
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#7a3a1e]">
                    {studentSummary.absencePercentage.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-[#55635d]">
                    sobre asistencias de esta asignatura
                  </p>
                </div>
                <div className="rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8c6d57]">
                    Media notas
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#1b5c40]">
                    {studentSummary.averageGrade === null
                      ? "-"
                      : studentSummary.averageGrade.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-[#55635d]">
                    promedio exclusivo de esta asignatura
                  </p>
                </div>
              </div>
            )}

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
              {tab === "report" && isStudent && (
                <ReportTab courseId={courseId} studentId={session.user.id} />
              )}
              {tab === "calendar" && (
                <CalendarTab
                  courseId={courseId}
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

/* ÔöÇÔöÇÔöÇ Students Tab ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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
          Sin estudiantes matriculados todav├¡a.
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

/* ÔöÇÔöÇÔöÇ Assignments Tab ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    deliveryMode: "PLATFORM" as "PLATFORM" | "FILE_UPLOAD",
    durationMinutes: "",
    secureMode: false,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Student mode: track submissions per assignment
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [submitContent, setSubmitContent] = useState("");
  const [submitAnswers, setSubmitAnswers] = useState<string[]>([]);
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const submitFileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [secureAssignmentId, setSecureAssignmentId] = useState<number | null>(null);
  const [secureDraft, setSecureDraft] = useState("");
  const [secureAnswers, setSecureAnswers] = useState<string[]>([]);
  const [secureWarning, setSecureWarning] = useState<string | null>(null);
  const [secureSubmitting, setSecureSubmitting] = useState(false);
  const [screenShieldActive, setScreenShieldActive] = useState(false);
  const [screenWarning, setScreenWarning] = useState<string | null>(null);
  const [studentFilter, setStudentFilter] = useState<StudentAssignmentFilter>("ALL");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const secureTerminatedRef = useRef(false);
  const screenShieldTimeoutRef = useRef<number | null>(null);
  const timedAutoSubmitRef = useRef(false);

  const isScreenshotShortcut = (ev: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }) => {
    const key = ev.key.toLowerCase();
    if (key === "printscreen") return true;
    if (ev.shiftKey && (ev.ctrlKey || ev.metaKey) && ["s", "3", "4", "5"].includes(key)) {
      return true;
    }
    return false;
  };

  const activateScreenShield = (message: string) => {
    setScreenWarning(message);
    setScreenShieldActive(true);
    if (screenShieldTimeoutRef.current) {
      window.clearTimeout(screenShieldTimeoutRef.current);
    }
    screenShieldTimeoutRef.current = window.setTimeout(() => {
      setScreenShieldActive(false);
    }, 1400);
    void navigator.clipboard?.writeText("").catch(() => undefined);
  };

  const preventQuestionClipboardAction = (ev: React.SyntheticEvent) => {
    ev.preventDefault();
  };

  const preventQuestionShortcut = (ev: React.KeyboardEvent<HTMLElement>) => {
    const key = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && ["c", "x", "v", "a", "insert"].includes(key)) {
      ev.preventDefault();
    }
  };

  const activeSecureAssignment = assignments.find((a) => a.id === secureAssignmentId) ?? null;
  const activeTimedAssignment = assignments.find((a) => a.id === (secureAssignmentId ?? submittingId)) ?? null;

  const timerStorageKey = (assignmentId: number) => `assignment-timer-${studentId ?? "guest"}-${assignmentId}`;

  const clearAssignmentTimer = (assignmentId: number) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(timerStorageKey(assignmentId));
    }
    if (activeTimedAssignment?.id === assignmentId) {
      setRemainingSeconds(null);
    }
    timedAutoSubmitRef.current = false;
  };

  const formatRemainingTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const orderedAssignments = [...assignments].sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (aTime === bTime) return b.id - a.id;
    return aTime - bTime;
  });

  const upcomingAssignments = orderedAssignments
    .filter((a) => {
      const alreadySubmitted = submissions.some((s) => s.assignmentId === a.id);
      if (alreadySubmitted) return false;
      if (!a.dueDate) return false;
      return new Date(a.dueDate).getTime() >= Date.now();
    })
    .slice(0, 3);

  const getAssignmentState = (assignment: Assignment): Exclude<StudentAssignmentFilter, "ALL"> => {
    const isSubmitted = submissions.some((s) => s.assignmentId === assignment.id);
    if (isSubmitted) return "SUBMITTED";

    const isOverdue = assignment.dueDate
      ? new Date(assignment.dueDate).getTime() < Date.now()
      : false;
    if (isOverdue) return "OVERDUE";

    return "PENDING";
  };

  const visibleStudentAssignments = orderedAssignments.filter((assignment) => {
    if (studentFilter === "ALL") return true;
    return getAssignmentState(assignment) === studentFilter;
  });

  const composeSubmissionContent = (
    questions: string[],
    answers: string[],
    fallback: string,
  ): string | undefined => {
    if (questions.length === 0) {
      const text = fallback.trim();
      return text || undefined;
    }

    const lines = questions.map((question, index) => {
      const answer = answers[index]?.trim() ?? "";
      return `Pregunta ${index + 1}: ${question}\nRespuesta: ${answer || "(sin respuesta)"}`;
    });

    return lines.join("\n\n");
  };

  async function reloadSubmissions() {
    if (!studentId) return;
    const updated = await apiFetch<Submission[]>(`/grades/course/${courseId}`);
    setSubmissions(updated.filter((s) => s.studentId === studentId));
  }

  function closeSecureMode() {
    setSecureAssignmentId(null);
    setSecureDraft("");
    setSecureAnswers([]);
    setSecureWarning(null);
    secureTerminatedRef.current = false;
  }

  async function terminateSecureAttempt(reason: string) {
    if (!secureAssignmentId || secureTerminatedRef.current || !studentId) return;
    secureTerminatedRef.current = true;
    setSecureSubmitting(true);
    setSecureWarning("Se detect├│ salida de foco. Entrega descalificada.");
    try {
      await apiFetch(`/assignments/${secureAssignmentId}/submissions`, {
        method: "POST",
        body: JSON.stringify({
          terminatedByFocusLoss: true,
          terminationReason: reason,
        }),
      });
      await reloadSubmissions();
      clearAssignmentTimer(secureAssignmentId);
      closeSecureMode();
      setSubmitError("Has sido descalificado por salir de la pesta├▒a durante modo seguro.");
    } catch (e) {
      setSecureWarning(e instanceof Error ? e.message : "No se pudo registrar la descalificaci├│n");
      secureTerminatedRef.current = false;
    } finally {
      setSecureSubmitting(false);
    }
  }

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

  useEffect(() => {
    const onScreenshotAttempt = (ev: KeyboardEvent) => {
      if (!isScreenshotShortcut(ev)) return;
      ev.preventDefault();
      activateScreenShield("No se permiten capturas ni recortes en la p├ígina de tareas.");
      if (secureAssignmentId) {
        void terminateSecureAttempt("SCREENSHOT_ATTEMPT");
      }
    };

    document.addEventListener("keydown", onScreenshotAttempt);

    return () => {
      document.removeEventListener("keydown", onScreenshotAttempt);
    };
  }, [secureAssignmentId]);

  useEffect(() => {
    return () => {
      if (screenShieldTimeoutRef.current) {
        window.clearTimeout(screenShieldTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!secureAssignmentId) return;

    const preventClipboard = (ev: Event) => {
      ev.preventDefault();
      setSecureWarning("Copiar, cortar y pegar est├í bloqueado en modo seguro.");
    };

    const preventDrop = (ev: DragEvent) => {
      ev.preventDefault();
      setSecureWarning("No se permite arrastrar contenido en modo seguro.");
    };

    const preventKeyCombo = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase();
      if (isScreenshotShortcut(ev)) {
        ev.preventDefault();
        activateScreenShield("Intento de captura detectado. Entrega descalificada.");
        void terminateSecureAttempt("SCREENSHOT_ATTEMPT");
        return;
      }
      if ((ev.ctrlKey || ev.metaKey) && ["c", "x", "v", "a", "insert"].includes(key)) {
        ev.preventDefault();
        setSecureWarning("Atajos de portapapeles desactivados en modo seguro.");
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        void terminateSecureAttempt("TAB_HIDDEN");
      }
    };

    const onBlur = () => {
      void terminateSecureAttempt("WINDOW_BLUR");
    };

    document.addEventListener("copy", preventClipboard);
    document.addEventListener("cut", preventClipboard);
    document.addEventListener("paste", preventClipboard);
    document.addEventListener("contextmenu", preventClipboard);
    document.addEventListener("drop", preventDrop);
    document.addEventListener("keydown", preventKeyCombo);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("copy", preventClipboard);
      document.removeEventListener("cut", preventClipboard);
      document.removeEventListener("paste", preventClipboard);
      document.removeEventListener("contextmenu", preventClipboard);
      document.removeEventListener("drop", preventDrop);
      document.removeEventListener("keydown", preventKeyCombo);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [secureAssignmentId]);

  useEffect(() => {
    if (!secureAssignmentId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [secureAssignmentId]);

  useEffect(() => {
    if (!activeTimedAssignment || !studentId || activeTimedAssignment.deliveryMode !== "PLATFORM" || !activeTimedAssignment.durationMinutes) {
      setRemainingSeconds(null);
      timedAutoSubmitRef.current = false;
      return;
    }

    const storageKey = timerStorageKey(activeTimedAssignment.id);
    const startedRaw = window.localStorage.getItem(storageKey);
    const parsedStart = startedRaw ? Number(startedRaw) : NaN;
    const effectiveStart = Number.isNaN(parsedStart) ? Date.now() : parsedStart;

    if (!startedRaw || Number.isNaN(parsedStart)) {
      window.localStorage.setItem(storageKey, String(effectiveStart));
    }

    const endAt = effectiveStart + activeTimedAssignment.durationMinutes * 60 * 1000;

    const tick = () => {
      const next = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemainingSeconds(next);

      if (next === 0 && !timedAutoSubmitRef.current) {
        timedAutoSubmitRef.current = true;
        if (secureAssignmentId === activeTimedAssignment.id) {
          void handleSecureSubmit(true);
        } else if (submittingId === activeTimedAssignment.id) {
          void handleStudentSubmit(activeTimedAssignment, true);
        }
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeTimedAssignment, studentId, secureAssignmentId, submittingId, submitContent, submitAnswers, secureDraft, secureAnswers]);

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
      fd.append("deliveryMode", form.deliveryMode);
      if (form.deliveryMode === "PLATFORM" && form.durationMinutes) {
        fd.append("durationMinutes", form.durationMinutes);
      }
      fd.append("secureMode", String(form.deliveryMode === "PLATFORM" ? form.secureMode : false));
      if (selectedFile) fd.append("file", selectedFile);

      const created = await apiFetch<Assignment>("/assignments", {
        method: "POST",
        body: fd,
      });
      setAssignments((prev) => [created, ...prev]);
      setForm({
        title: "",
        description: "",
        dueDate: "",
        deliveryMode: "PLATFORM",
        durationMinutes: "",
        secureMode: false,
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al crear tarea");
    } finally {
      setSaving(false);
    }
  }

  async function handleStudentSubmit(assignment: Assignment, autoSubmit = false) {
    setSubmitting(true);
    setSubmitError(autoSubmit ? "Tiempo agotado. Enviando autom├íticamente..." : null);
    try {
      if (assignment.deliveryMode === "FILE_UPLOAD") {
        if (!submitFile) {
          setSubmitError("Debes subir un archivo para esta tarea.");
          setSubmitting(false);
          return;
        }

        const fd = new FormData();
        fd.append("file", submitFile);
        await apiFetch<unknown>(`/assignments/${assignment.id}/submissions`, {
          method: "POST",
          body: fd,
        });
      } else {
        const content = composeSubmissionContent(assignment.questions, submitAnswers, submitContent);
        await apiFetch<unknown>(`/assignments/${assignment.id}/submissions`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
      }

      // Reload submissions to get full nested data
      await reloadSubmissions();
      if (assignment.durationMinutes) {
        clearAssignmentTimer(assignment.id);
      }
      setSubmittingId(null);
      setSubmitContent("");
      setSubmitAnswers([]);
      setSubmitFile(null);
      if (submitFileInputRef.current) submitFileInputRef.current.value = "";
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Error al entregar");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSecureSubmit(autoSubmit = false) {
    if (!secureAssignmentId) return;
    setSecureSubmitting(true);
    setSecureWarning(autoSubmit ? "Tiempo agotado. Enviando autom├íticamente..." : null);
    try {
      const content = composeSubmissionContent(
        activeSecureAssignment?.questions ?? [],
        secureAnswers,
        secureDraft,
      );
      await apiFetch<unknown>(`/assignments/${secureAssignmentId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      await reloadSubmissions();
      if (activeSecureAssignment?.durationMinutes) {
        clearAssignmentTimer(secureAssignmentId);
      }
      closeSecureMode();
    } catch (e) {
      setSecureWarning(e instanceof Error ? e.message : "No se pudo enviar la tarea");
    } finally {
      setSecureSubmitting(false);
    }
  }

  if (studentId) {
    return (
      <div className="space-y-6">
        {screenShieldActive && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[60] bg-[#111111] opacity-95 pointer-events-none"
          />
        )}
        <h3 className="text-lg font-semibold text-[#15231d]">Mis tareas</h3>
        {screenWarning && (
          <p className="text-xs font-semibold text-[#b0413e]">{screenWarning}</p>
        )}

        {!loading && !error && (
          <div className="flex flex-wrap gap-2">
            {[
              { key: "ALL" as StudentAssignmentFilter, label: "Todas" },
              { key: "PENDING" as StudentAssignmentFilter, label: "Pendientes" },
              { key: "SUBMITTED" as StudentAssignmentFilter, label: "Entregadas" },
              { key: "OVERDUE" as StudentAssignmentFilter, label: "Vencidas" },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStudentFilter(filter.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  studentFilter === filter.key
                    ? "border-[#c4643b] bg-[#f3d4b7] text-[#7a3a1e]"
                    : "border-[rgba(21,35,29,0.14)] bg-white text-[#55635d] hover:bg-[#f1e7db]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {!loading && !error && upcomingAssignments.length > 0 && (
          <div className="rounded-2xl border border-[rgba(196,100,59,0.28)] bg-[#fff7ec] p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
              Proximas tareas
            </p>
            <ul className="mt-2 space-y-2">
              {upcomingAssignments.map((a) => (
                <li key={`upcoming-${a.id}`} className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-[#15231d]">{a.title}</span>
                  <span className="text-xs text-[#8c6d57]">
                    {a.dueDate
                      ? new Date(a.dueDate).toLocaleDateString("es", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Sin fecha"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#55635d]">Cargando...</p>
        ) : error ? (
          <p className="text-sm text-[#b0413e]">{error}</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-[#8c6d57]">Sin tareas publicadas todav├¡a.</p>
        ) : visibleStudentAssignments.length === 0 ? (
          <p className="text-sm text-[#8c6d57]">No hay tareas para este filtro.</p>
        ) : (
          <div className="space-y-3">
            {visibleStudentAssignments.map((a) => {
              const sub = submissions.find((s) => s.assignmentId === a.id);
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-[rgba(21,35,29,0.08)] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[#15231d]">{a.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-[#f1e7db] px-2 py-0.5 text-[11px] font-semibold text-[#7a3a1e]">
                          {a.deliveryMode === "PLATFORM" ? "Entrega en plataforma" : "Entrega por archivo"}
                        </span>
                        {a.durationMinutes && (
                          <span className="inline-flex rounded-full bg-[#dfeee4] px-2 py-0.5 text-[11px] font-semibold text-[#1b5c40]">
                            {a.durationMinutes} min
                          </span>
                        )}
                        {a.secureMode && (
                          <span className="inline-flex rounded-full bg-[#15231d] px-2 py-0.5 text-[11px] font-semibold text-white">
                            Modo seguro
                          </span>
                        )}
                      </div>
                      {a.description && (
                        <p className="mt-1 text-sm text-[#55635d]">{a.description}</p>
                      )}
                      {a.dueDate && (
                        <p className="mt-1 text-xs text-[#8c6d57]">
                          Fecha l├¡mite:{" "}
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
                          ­ƒôÄ Ver adjunto
                        </a>
                      )}
                      {a.deliveryMode === "PLATFORM" && a.questions.length > 0 && (
                        <div
                          className="mt-3 rounded-xl border border-[rgba(21,35,29,0.1)] bg-[#fffaf4] p-3 select-none"
                          tabIndex={0}
                          onCopy={preventQuestionClipboardAction}
                          onCut={preventQuestionClipboardAction}
                          onPaste={preventQuestionClipboardAction}
                          onContextMenu={preventQuestionClipboardAction}
                          onDragStart={preventQuestionClipboardAction}
                          onDrop={preventQuestionClipboardAction}
                          onKeyDown={preventQuestionShortcut}
                        >
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
                            Preguntas
                          </p>
                          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#30433a]">
                            {a.questions.map((q, index) => (
                              <li key={`${a.id}-q-${index}`}>{q}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {sub ? (
                        <div>
                          {sub.status === "DISQUALIFIED" ? (
                            <span className="rounded-full bg-[#f9d9d8] px-2.5 py-0.5 text-xs font-semibold text-[#b0413e]">
                              Descalificado
                            </span>
                          ) : null}
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
                          {sub.fileUrl && (
                            <a
                              href={`${getApiOrigin()}${sub.fileUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#c4643b] hover:underline"
                            >
                              ­ƒôä Ver archivo enviado
                            </a>
                          )}
                          {sub.status === "DISQUALIFIED" && sub.terminationReason && (
                            <p className="mt-1 text-xs text-[#b0413e]">{sub.terminationReason}</p>
                          )}
                        </div>
                      ) : (
                        <>
                          {a.deliveryMode === "PLATFORM" && a.secureMode ? (
                            <button
                              onClick={() => {
                                setSecureAssignmentId(a.id);
                                setSecureDraft("");
                                setSecureAnswers(Array(a.questions.length).fill(""));
                                setSecureWarning(null);
                                secureTerminatedRef.current = false;
                              }}
                              className="rounded-2xl bg-[#15231d] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2a3e35]"
                            >
                              Iniciar modo seguro
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSubmittingId(a.id);
                                setSubmitContent("");
                                setSubmitAnswers(Array(a.questions.length).fill(""));
                                setSubmitFile(null);
                                if (submitFileInputRef.current) submitFileInputRef.current.value = "";
                                setSubmitError(null);
                              }}
                              className="rounded-2xl bg-[#c4643b] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#9f4c2a]"
                            >
                              {a.deliveryMode === "FILE_UPLOAD" ? "Subir archivo" : "Entregar"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {a.deliveryMode === "PLATFORM" && a.secureMode && !sub && (
                    <div className="rounded-xl border border-[rgba(176,65,62,0.25)] bg-[#fff1ef] px-3 py-2 text-xs text-[#8a2f2c]">
                      Esta tarea exige modo seguro: si cambias de pesta├▒a o ventana, quedas descalificado.
                    </div>
                  )}

                  {submittingId === a.id && (
                    <div className="space-y-3 rounded-xl bg-[#fdf7f2] p-4">
                      {a.durationMinutes && a.deliveryMode === "PLATFORM" && remainingSeconds !== null && (
                        <div className="rounded-2xl border border-[rgba(196,100,59,0.24)] bg-[#fff7ec] px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">Temporizador activo</p>
                          <p className="mt-1 text-2xl font-bold text-[#c4643b]">{formatRemainingTime(remainingSeconds)}</p>
                          <p className="mt-1 text-xs text-[#55635d]">Al agotarse el tiempo, la entrega se enviar├í autom├íticamente.</p>
                        </div>
                      )}
                      {a.deliveryMode === "FILE_UPLOAD" ? (
                        <div className="space-y-2 rounded-2xl border border-[rgba(21,35,29,0.1)] bg-white p-4">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
                            Archivo de entrega
                          </p>
                          <div className="flex items-center gap-3">
                            <input
                              ref={submitFileInputRef}
                              type="file"
                              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg"
                              className="hidden"
                              onChange={(e) => setSubmitFile(e.target.files?.[0] ?? null)}
                            />
                            <button
                              type="button"
                              onClick={() => submitFileInputRef.current?.click()}
                              className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-2 text-xs font-semibold text-[#15231d] transition hover:bg-[#f1e7db]"
                            >
                              Elegir archivo
                            </button>
                            <span className="text-xs text-[#55635d]">
                              {submitFile ? submitFile.name : "Ning├║n archivo seleccionado"}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8c6d57]">M├íximo 10 MB</p>
                        </div>
                      ) : a.questions.length > 0 ? (
                        <div className="space-y-3">
                          {a.questions.map((question, index) => (
                            <label
                              key={`${a.id}-answer-${index}`}
                              className="block rounded-2xl border border-[rgba(21,35,29,0.1)] bg-white p-4 shadow-[0_1px_0_rgba(21,35,29,0.03)]"
                            >
                              <span className="inline-flex items-center rounded-full bg-[#f3d4b7] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#7a3a1e]">
                                Pregunta {index + 1}
                              </span>
                              <p className="mt-2 text-sm font-medium leading-relaxed text-[#15231d]">{question}</p>
                              <textarea
                                value={submitAnswers[index] ?? ""}
                                onChange={(e) =>
                                  setSubmitAnswers((prev) => {
                                    const next = [...prev];
                                    next[index] = e.target.value;
                                    return next;
                                  })
                                }
                                placeholder={`Escribe la respuesta de la pregunta ${index + 1}...`}
                                rows={4}
                                className="mt-3 w-full rounded-xl border border-[rgba(21,35,29,0.16)] bg-[#fffefc] px-4 py-3 text-sm text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
                              />
                            </label>
                          ))}
                        </div>
                      ) : (
                        <label className="block space-y-1">
                          <span className="text-xs font-medium text-[#30433a]">Respuesta / comentarios (opcional)</span>
                          <textarea
                            value={submitContent}
                            onChange={(e) => setSubmitContent(e.target.value)}
                            placeholder="Escribe tu respuesta aqu├¡..."
                            rows={3}
                            className="w-full rounded-xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-sm text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
                          />
                        </label>
                      )}
                      {submitError && <p className="text-xs text-[#b0413e]">{submitError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStudentSubmit(a)}
                          disabled={submitting}
                          className="rounded-xl bg-[#15231d] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
                        >
                          {submitting ? "Enviando..." : "Confirmar entrega"}
                        </button>
                        <button
                          onClick={() => {
                            setSubmittingId(null);
                            setSubmitAnswers([]);
                            setSubmitFile(null);
                            if (submitFileInputRef.current) submitFileInputRef.current.value = "";
                          }}
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

        {activeSecureAssignment && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(21,35,29,0.78)] p-4">
            <div className="mx-auto my-6 w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">Modo seguro activo</p>
                  <h4 className="mt-1 text-xl font-semibold text-[#15231d]">{activeSecureAssignment.title}</h4>
                  <p className="mt-1 text-sm text-[#55635d]">
                    No puedes copiar, pegar, cortar ni cambiar de pesta├▒a o ventana.
                  </p>
                  {activeSecureAssignment.durationMinutes && remainingSeconds !== null && (
                    <div className="mt-3 rounded-2xl border border-[rgba(196,100,59,0.24)] bg-[#fff7ec] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">Tiempo restante</p>
                      <p className="mt-1 text-2xl font-bold text-[#c4643b]">{formatRemainingTime(remainingSeconds)}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void terminateSecureAttempt("MANUAL_EXIT")}
                  disabled={secureSubmitting}
                  className="rounded-xl border border-[rgba(176,65,62,0.25)] px-3 py-1.5 text-xs font-semibold text-[#b0413e]"
                >
                  Salir (descalifica)
                </button>
              </div>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-[#30433a]">Respuesta</span>
                {activeSecureAssignment.questions.length > 0 ? (
                  <div className="space-y-3">
                    {activeSecureAssignment.questions.map((question, index) => (
                      <div
                        key={`${activeSecureAssignment.id}-secure-answer-${index}`}
                        className="rounded-2xl border border-[rgba(21,35,29,0.1)] bg-[#fffdf9] p-4"
                      >
                        <p className="inline-flex items-center rounded-full bg-[#f3d4b7] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-[#7a3a1e]">
                          Pregunta {index + 1}
                        </p>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-[#15231d]">{question}</p>
                        <textarea
                          value={secureAnswers[index] ?? ""}
                          onChange={(e) =>
                            setSecureAnswers((prev) => {
                              const next = [...prev];
                              next[index] = e.target.value;
                              return next;
                            })
                          }
                          placeholder={`Escribe la respuesta de la pregunta ${index + 1}...`}
                          rows={4}
                          className="mt-3 w-full rounded-2xl border border-[rgba(21,35,29,0.16)] bg-white px-4 py-3 text-sm text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={secureDraft}
                    onChange={(e) => setSecureDraft(e.target.value)}
                    placeholder="Resuelve la tarea aqu├¡..."
                    rows={14}
                    className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] px-4 py-3 text-sm text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
                  />
                )}
              </label>

              {(secureWarning || submitError) && (
                <p className="mt-3 text-sm text-[#b0413e]">{secureWarning ?? submitError}</p>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={() => void terminateSecureAttempt("MANUAL_EXIT")}
                  disabled={secureSubmitting}
                  className="rounded-xl border border-[rgba(21,35,29,0.12)] px-4 py-2 text-sm text-[#55635d]"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleSecureSubmit()}
                  disabled={secureSubmitting}
                  className="rounded-xl bg-[#15231d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2a3e35] disabled:opacity-60"
                >
                  {secureSubmitting ? "Enviando..." : "Entregar tarea"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {screenShieldActive && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[60] bg-[#111111] opacity-95 pointer-events-none"
        />
      )}
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
      {screenWarning && (
        <p className="text-xs font-semibold text-[#b0413e]">{screenWarning}</p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-4 rounded-2xl border border-[rgba(196,100,59,0.2)] bg-[#fdf7f2] p-5 sm:grid-cols-2"
        >
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-[#30433a]">T├¡tulo</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Examen parcial 1"
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium text-[#30433a]">Descripci├│n (opcional)</span>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Instrucciones..."
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Fecha l├¡mite (opcional)</span>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Duraci├│n (minutos, opcional)</span>
            <input
              type="number"
              min={1}
              value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              disabled={form.deliveryMode !== "PLATFORM"}
              placeholder="45"
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)] disabled:bg-[#f5f7f6]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[#30433a]">Modalidad de entrega</span>
            <select
              value={form.deliveryMode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  deliveryMode: e.target.value as "PLATFORM" | "FILE_UPLOAD",
                  durationMinutes: e.target.value === "PLATFORM" ? f.durationMinutes : "",
                  secureMode: e.target.value === "PLATFORM" ? f.secureMode : false,
                }))
              }
              className="w-full rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-[#15231d] outline-none transition focus:border-[#c4643b] focus:ring-4 focus:ring-[rgba(196,100,59,0.14)]"
            >
              <option value="PLATFORM">Entrega en la plataforma</option>
              <option value="FILE_UPLOAD">Entrega subiendo archivo</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-2xl border border-[rgba(21,35,29,0.12)] bg-white px-4 py-3 text-sm text-[#15231d]">
            <input
              type="checkbox"
              disabled={form.deliveryMode !== "PLATFORM"}
              checked={form.secureMode}
              onChange={(e) => setForm((f) => ({ ...f, secureMode: e.target.checked }))}
              className="h-4 w-4"
            />
            Activar modo seguro anti-copia y expulsi├│n por cambio de pesta├▒a
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
                    Ô£ò
                  </button>
                </div>
              ) : (
                <span className="text-sm text-[#8d9a94]">Sin archivo</span>
              )}
            </div>
            <p className="text-xs text-[#8c6d57]">PDF, Word, PowerPoint, Excel, ZIP, im├ígenes ┬À m├íx. 10 MB</p>
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
        <p className="text-sm text-[#8c6d57]">Sin tareas todav├¡a.</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-[rgba(21,35,29,0.08)] p-4"
            >
              <p className="font-semibold text-[#15231d]">{a.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex rounded-full bg-[#f1e7db] px-2 py-0.5 text-[11px] font-semibold text-[#7a3a1e]">
                  {a.deliveryMode === "PLATFORM" ? "Entrega en plataforma" : "Entrega por archivo"}
                </span>
                {a.durationMinutes && (
                  <span className="inline-flex rounded-full bg-[#dfeee4] px-2 py-0.5 text-[11px] font-semibold text-[#1b5c40]">
                    {a.durationMinutes} min
                  </span>
                )}
              </div>
              {a.secureMode && (
                <span className="mt-1 inline-flex rounded-full bg-[#15231d] px-2 py-0.5 text-[11px] font-semibold text-white">
                  Modo seguro
                </span>
              )}
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
                  ­ƒôÄ Ver adjunto
                </a>
              )}
              {a.deliveryMode === "PLATFORM" && a.questions.length > 0 && (
                <div
                  className="mt-3 rounded-xl border border-[rgba(21,35,29,0.1)] bg-[#fffaf4] p-3 select-none"
                  tabIndex={0}
                  onCopy={preventQuestionClipboardAction}
                  onCut={preventQuestionClipboardAction}
                  onPaste={preventQuestionClipboardAction}
                  onContextMenu={preventQuestionClipboardAction}
                  onDragStart={preventQuestionClipboardAction}
                  onDrop={preventQuestionClipboardAction}
                  onKeyDown={preventQuestionShortcut}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
                    Preguntas detectadas en Word
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#30433a]">
                    {a.questions.map((q, index) => (
                      <li key={`${a.id}-teacher-q-${index}`}>{q}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ÔöÇÔöÇÔöÇ Attendance Tab ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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
const JUSTIFICATION_LABEL: Record<string, string> = {
  NONE: "Sin justificar",
  PENDING: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};
const JUSTIFICATION_COLOR: Record<string, string> = {
  NONE: "bg-[#f3f4f6] text-[#4b5563]",
  PENDING: "bg-[#fef3c7] text-[#6b4a00]",
  APPROVED: "bg-[#d1e8de] text-[#1b5c40]",
  REJECTED: "bg-[#fde8e8] text-[#8a2f2d]",
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
  const [justifyingId, setJustifyingId] = useState<number | null>(null);
  const [justificationMessage, setJustificationMessage] = useState("");
  const [justificationFile, setJustificationFile] = useState<File | null>(null);
  const [justificationError, setJustificationError] = useState<string | null>(null);
  const [justificationSaving, setJustificationSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewDecision, setReviewDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    void loadRecords();
  }, [courseId]);

  async function loadRecords() {
    setLoading(true);
    try {
      const data = await apiFetch<AttendanceRecord[]>(`/attendance/course/${courseId}`);
      setRecords(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

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

  async function handleSubmitJustification(attendanceId: number) {
    if (!justificationFile) {
      setJustificationError("Debes adjuntar un justificante.");
      return;
    }

    setJustificationSaving(true);
    setJustificationError(null);
    try {
      const fd = new FormData();
      fd.append("file", justificationFile);
      if (justificationMessage.trim()) fd.append("message", justificationMessage.trim());
      await apiFetch<AttendanceRecord>(`/attendance/${attendanceId}/justify`, {
        method: "POST",
        body: fd,
      });
      await loadRecords();
      setJustifyingId(null);
      setJustificationFile(null);
      setJustificationMessage("");
    } catch (e) {
      setJustificationError(e instanceof Error ? e.message : "No se pudo enviar el justificante");
    } finally {
      setJustificationSaving(false);
    }
  }

  async function handleReviewJustification(attendanceId: number) {
    setReviewSaving(true);
    setReviewError(null);
    try {
      await apiFetch<AttendanceRecord>(`/attendance/${attendanceId}/justification/review`, {
        method: "POST",
        body: JSON.stringify({
          status: reviewDecision,
          comment: reviewComment.trim() || undefined,
        }),
      });
      await loadRecords();
      setReviewingId(null);
      setReviewComment("");
      setReviewDecision("APPROVED");
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "No se pudo revisar el justificante");
    } finally {
      setReviewSaving(false);
    }
  }

  if (studentId) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-[#15231d]">Mi asistencia</h3>
        {loading ? (
          <p className="text-sm text-[#55635d]">Cargando...</p>
        ) : error ? (
          <p className="text-sm text-[#b0413e]">{error}</p>
        ) : sortedDates.length === 0 ? (
          <p className="text-sm text-[#8c6d57]">Sin registros de asistencia todav├¡a.</p>
        ) : (
          <div className="space-y-4">
            {sortedDates.map((d) => (
              <div key={d} className="rounded-xl border border-[rgba(21,35,29,0.06)] px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
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

                {byDate[d][0].status !== "PRESENT" && (
                  <div className="mt-3 space-y-3 rounded-2xl bg-[#fcfaf7] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${JUSTIFICATION_COLOR[byDate[d][0].justificationStatus]}`}>
                        {JUSTIFICATION_LABEL[byDate[d][0].justificationStatus]}
                      </span>
                      {byDate[d][0].justificationUrl && (
                        <a
                          href={`${getApiOrigin()}${byDate[d][0].justificationUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-[#c4643b] hover:underline"
                        >
                          Ver justificante
                        </a>
                      )}
                    </div>

                    {byDate[d][0].justificationMessage && (
                      <p className="text-xs text-[#55635d]">{byDate[d][0].justificationMessage}</p>
                    )}

                    {byDate[d][0].justificationReviewComment && (
                      <p className="text-xs text-[#55635d]">Revisi├│n: {byDate[d][0].justificationReviewComment}</p>
                    )}

                    {(byDate[d][0].justificationStatus === "NONE" || byDate[d][0].justificationStatus === "REJECTED") && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => {
                            setJustifyingId((current) => (current === byDate[d][0].id ? null : byDate[d][0].id));
                            setJustificationError(null);
                            setJustificationMessage(byDate[d][0].justificationStatus === "REJECTED" ? byDate[d][0].justificationMessage ?? "" : "");
                            setJustificationFile(null);
                          }}
                          className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-1.5 text-xs font-semibold text-[#15231d] hover:bg-[#f1e7db]"
                        >
                          {byDate[d][0].justificationStatus === "REJECTED" ? "Reenviar justificante" : "Justificar falta"}
                        </button>

                        {justifyingId === byDate[d][0].id && (
                          <div className="space-y-3 rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-3">
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={(e) => setJustificationFile(e.target.files?.[0] ?? null)}
                              className="block w-full text-xs text-[#55635d]"
                            />
                            <textarea
                              value={justificationMessage}
                              onChange={(e) => setJustificationMessage(e.target.value)}
                              placeholder="A├▒ade un comentario opcional para el profesor"
                              rows={3}
                              className="w-full rounded-xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-sm text-[#15231d] outline-none focus:border-[#c4643b]"
                            />
                            {justificationError && <p className="text-xs text-[#b0413e]">{justificationError}</p>}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void handleSubmitJustification(byDate[d][0].id)}
                                disabled={justificationSaving}
                                className="rounded-xl bg-[#15231d] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                {justificationSaving ? "Enviando..." : "Enviar justificante"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setJustifyingId(null)}
                                className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-2 text-xs text-[#55635d]"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
        <p className="text-sm text-[#8c6d57]">Sin registros de asistencia todav├¡a.</p>
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
                    className="rounded-xl border border-[rgba(21,35,29,0.06)] px-4 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[#15231d]">{r.student.fullName}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[r.status] ?? ""}`}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </div>

                    {r.status !== "PRESENT" && (
                      <div className="mt-3 space-y-3 rounded-2xl bg-[#fcfaf7] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${JUSTIFICATION_COLOR[r.justificationStatus]}`}>
                            {JUSTIFICATION_LABEL[r.justificationStatus]}
                          </span>
                          {r.justificationUrl && (
                            <a
                              href={`${getApiOrigin()}${r.justificationUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-[#c4643b] hover:underline"
                            >
                              Ver justificante
                            </a>
                          )}
                        </div>

                        {r.justificationMessage && (
                          <p className="text-xs text-[#55635d]">Alumno: {r.justificationMessage}</p>
                        )}
                        {r.justificationReviewComment && (
                          <p className="text-xs text-[#55635d]">Revisi├│n: {r.justificationReviewComment}</p>
                        )}

                        {r.justificationStatus === "PENDING" && (
                          <div className="space-y-3">
                            <button
                              type="button"
                              onClick={() => {
                                setReviewingId((current) => (current === r.id ? null : r.id));
                                setReviewDecision("APPROVED");
                                setReviewComment("");
                                setReviewError(null);
                              }}
                              className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-1.5 text-xs font-semibold text-[#15231d] hover:bg-[#f1e7db]"
                            >
                              Revisar justificante
                            </button>

                            {reviewingId === r.id && (
                              <div className="space-y-3 rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-3">
                                <select
                                  value={reviewDecision}
                                  onChange={(e) => setReviewDecision(e.target.value as "APPROVED" | "REJECTED")}
                                  className="rounded-xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-sm text-[#15231d] outline-none focus:border-[#c4643b]"
                                >
                                  <option value="APPROVED">Aprobar</option>
                                  <option value="REJECTED">Rechazar</option>
                                </select>
                                <textarea
                                  value={reviewComment}
                                  onChange={(e) => setReviewComment(e.target.value)}
                                  placeholder="Comentario opcional para el alumno"
                                  rows={3}
                                  className="w-full rounded-xl border border-[rgba(21,35,29,0.12)] bg-white px-3 py-2 text-sm text-[#15231d] outline-none focus:border-[#c4643b]"
                                />
                                {reviewError && <p className="text-xs text-[#b0413e]">{reviewError}</p>}
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleReviewJustification(r.id)}
                                    disabled={reviewSaving}
                                    className="rounded-xl bg-[#15231d] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                  >
                                    {reviewSaving ? "Guardando..." : "Guardar revisi├│n"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setReviewingId(null)}
                                    className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-2 text-xs text-[#55635d]"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
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

/* ÔöÇÔöÇÔöÇ Grades Tab ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

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
            ? "A├║n no tienes entregas calificadas."
            : "No hay entregas todav├¡a. Las aparecer├ín aqu├¡ cuando los estudiantes entreguen tareas."}
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
                  {sub.fileUrl && (
                    <a
                      href={`${getApiOrigin()}${sub.fileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#c4643b] hover:underline"
                    >
                      ­ƒôä Ver archivo entregado
                    </a>
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
                      min={1}
                      max={10}
                      value={gradeForm.score}
                      onChange={(e) => setGradeForm((f) => ({ ...f, score: e.target.value }))}
                      placeholder="1-10"
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
                      Ô£ò
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

/* ÔöÇÔöÇÔöÇ Report Tab ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

function ReportTab({
  courseId,
  studentId,
}: {
  courseId: number;
  studentId: number;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<Assignment[]>(`/assignments?courseId=${courseId}`),
      apiFetch<Submission[]>(`/grades/course/${courseId}`),
      apiFetch<AttendanceRecord[]>(`/attendance/course/${courseId}`),
    ])
      .then(([assignmentData, submissionData, attendanceData]) => {
        setAssignments(assignmentData);
        setSubmissions(submissionData.filter((submission) => submission.studentId === studentId));
        setAttendance(attendanceData.filter((record) => record.studentId === studentId));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el bolet├¡n"))
      .finally(() => setLoading(false));
  }, [courseId, studentId]);

  const gradedSubmissions = submissions.filter((submission) => submission.grade);
  const averageGrade =
    gradedSubmissions.length > 0
      ? gradedSubmissions.reduce((sum, submission) => sum + (submission.grade?.score ?? 0), 0) /
        gradedSubmissions.length
      : null;
  const submittedAssignments = submissions.filter((submission) => submission.status !== "DISQUALIFIED").length;
  const pendingAssignments = Math.max(assignments.length - submissions.length, 0);
  const absences = attendance.filter((record) => record.status === "ABSENT").length;
  const attendanceRate =
    attendance.length > 0
      ? ((attendance.length - absences) / attendance.length) * 100
      : null;

  const latestGrades = [...gradedSubmissions].sort(
    (a, b) => new Date(b.grade?.gradedAt ?? 0).getTime() - new Date(a.grade?.gradedAt ?? 0).getTime(),
  );
  const latestAttendance = [...attendance].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const stats = [
    { label: "Media", value: averageGrade !== null ? averageGrade.toFixed(2) : "-", helper: "Calificaciones del curso" },
    { label: "Entregadas", value: String(submittedAssignments), helper: "Tareas enviadas" },
    { label: "Pendientes", value: String(pendingAssignments), helper: "Tareas a├║n no entregadas" },
    { label: "Asistencia", value: attendanceRate !== null ? `${attendanceRate.toFixed(0)}%` : "-", helper: "Presente o tardanza" },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#15231d]">Boletin de la asignatura</h3>

      {loading ? (
        <p className="text-sm text-[#55635d]">Cargando bolet├¡n...</p>
      ) : error ? (
        <p className="text-sm text-[#b0413e]">{error}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-[rgba(21,35,29,0.08)] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-[#15231d]">{stat.value}</p>
                <p className="mt-1 text-xs text-[#55635d]">{stat.helper}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
              <h4 className="text-base font-semibold text-[#15231d]">├Ültimas calificaciones</h4>
              {latestGrades.length === 0 ? (
                <p className="mt-3 text-sm text-[#8c6d57]">A├║n no hay notas en esta asignatura.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {latestGrades.slice(0, 5).map((submission) => (
                    <div key={submission.id} className="flex items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-[#15231d]">{submission.assignment.title}</p>
                        <p className="text-xs text-[#8c6d57]">
                          {submission.grade?.gradedAt ? new Date(submission.grade.gradedAt).toLocaleDateString("es") : "Sin fecha"}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-[#c4643b]">{submission.grade?.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[rgba(21,35,29,0.08)] bg-white p-5">
              <h4 className="text-base font-semibold text-[#15231d]">Asistencia reciente</h4>
              {latestAttendance.length === 0 ? (
                <p className="mt-3 text-sm text-[#8c6d57]">Sin registros de asistencia todav├¡a.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {latestAttendance.slice(0, 5).map((record) => (
                    <div key={record.id} className="flex items-center justify-between rounded-xl border border-[rgba(21,35,29,0.08)] px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-[#15231d]">
                          {new Date(record.date).toLocaleDateString("es", {
                            day: "numeric",
                            month: "long",
                          })}
                        </p>
                        {record.justificationStatus !== "NONE" && (
                          <p className="text-xs text-[#8c6d57]">Justificante: {JUSTIFICATION_LABEL[record.justificationStatus]}</p>
                        )}
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[record.status]}`}>
                        {STATUS_LABEL[record.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/* ÔöÇÔöÇÔöÇ Calendar Tab ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */

type CalendarEvent = {
  id: string;
  date: string;
  type: "ASSIGNMENT_DUE" | "SUBMISSION" | "ATTENDANCE" | "ANNOUNCEMENT";
  title: string;
  description?: string;
};

type CalendarFilter = "ALL" | CalendarEvent["type"];

function CalendarTab({
  courseId,
  studentId,
}: {
  courseId: number;
  studentId?: number;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [filter, setFilter] = useState<CalendarFilter>("ALL");

  const toDateKey = (input: Date | string) => {
    const d = typeof input === "string" ? new Date(input) : input;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch<Assignment[]>(`/assignments?courseId=${courseId}`),
      apiFetch<AttendanceRecord[]>(`/attendance/course/${courseId}`),
      apiFetch<Submission[]>(`/grades/course/${courseId}`),
      apiFetch<Announcement[]>("/announcements"),
    ])
      .then(([assignments, attendance, submissions, announcements]) => {
        const assignmentEvents: CalendarEvent[] = assignments
          .filter((a) => Boolean(a.dueDate))
          .map((a) => ({
            id: `assignment-due-${a.id}`,
            date: toDateKey(a.dueDate as string),
            type: "ASSIGNMENT_DUE",
            title: `Entrega limite: ${a.title}`,
            description: a.description ?? undefined,
          }));

        const attendanceEvents: CalendarEvent[] = attendance
          .filter((r) => (studentId ? r.studentId === studentId : true))
          .map((r) => ({
            id: `attendance-${r.id}`,
            date: toDateKey(r.date),
            type: "ATTENDANCE",
            title: studentId
              ? `Asistencia: ${r.status}`
              : `Asistencia ${r.student.fullName}: ${r.status}`,
          }));

        const submissionEvents: CalendarEvent[] = submissions
          .filter((s) => Boolean(s.submittedAt))
          .map((s) => ({
            id: `submission-${s.id}`,
            date: toDateKey(s.submittedAt as string),
            type: "SUBMISSION",
            title: studentId
              ? `Entrega enviada: ${s.assignment.title}`
              : `Entrega ${s.student.fullName}: ${s.assignment.title}`,
            description: s.status === "DISQUALIFIED" ? "Descalificado" : undefined,
          }));

        const announcementEvents: CalendarEvent[] = announcements
          .filter((a) => a.courseId === null || a.courseId === courseId)
          .map((a) => ({
            id: `announcement-${a.id}`,
            date: toDateKey(a.createdAt),
            type: "ANNOUNCEMENT",
            title: `Anuncio: ${a.title}`,
            description: a.body,
          }));

        const merged = [
          ...assignmentEvents,
          ...attendanceEvents,
          ...submissionEvents,
          ...announcementEvents,
        ].sort((a, b) => a.date.localeCompare(b.date));

        setEvents(merged);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el calendario"))
      .finally(() => setLoading(false));
  }, [courseId, studentId]);

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = monthEnd.getDate();

  const days: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i += 1) days.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
  }

  const filteredEvents =
    filter === "ALL" ? events : events.filter((event) => event.type === filter);

  const eventsByDate = filteredEvents.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});

  const selectedKey = toDateKey(selectedDate);
  const selectedEvents = eventsByDate[selectedKey] ?? [];

  const EVENT_STYLE: Record<CalendarEvent["type"], string> = {
    ASSIGNMENT_DUE: "bg-[#f3d4b7] text-[#7a3a1e]",
    SUBMISSION: "bg-[#d1e8de] text-[#1b5c40]",
    ATTENDANCE: "bg-[#e5e7eb] text-[#374151]",
    ANNOUNCEMENT: "bg-[#fef3c7] text-[#6b4a00]",
  };

  const EVENT_LABEL: Record<CalendarEvent["type"], string> = {
    ASSIGNMENT_DUE: "Tarea",
    SUBMISSION: "Entrega",
    ATTENDANCE: "Asistencia",
    ANNOUNCEMENT: "Anuncio",
  };

  const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
  const visibleMonthEvents = events.filter((ev) => ev.date.startsWith(currentMonthKey));

  const eventCounts: Record<CalendarFilter, number> = {
    ALL: visibleMonthEvents.length,
    ASSIGNMENT_DUE: 0,
    SUBMISSION: 0,
    ATTENDANCE: 0,
    ANNOUNCEMENT: 0,
  };
  for (const ev of visibleMonthEvents) {
    eventCounts[ev.type] += 1;
  }

  const FILTER_OPTIONS: Array<{ value: CalendarFilter; label: string }> = [
    { value: "ALL", label: "Todos" },
    { value: "ASSIGNMENT_DUE", label: "Tareas" },
    { value: "SUBMISSION", label: "Entregas" },
    { value: "ATTENDANCE", label: "Asistencia" },
    { value: "ANNOUNCEMENT", label: "Anuncios" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#15231d]">Calendario academico</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-1.5 text-xs text-[#55635d] hover:bg-[#f1e7db]"
          >
            ÔåÉ Mes anterior
          </button>
          <button
            onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="rounded-xl border border-[rgba(21,35,29,0.12)] px-3 py-1.5 text-xs text-[#55635d] hover:bg-[#f1e7db]"
          >
            Mes siguiente ÔåÆ
          </button>
        </div>
      </div>

      <p className="text-sm text-[#55635d]">
        {currentMonth.toLocaleDateString("es", { month: "long", year: "numeric" })}
      </p>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === option.value
                ? "bg-[#15231d] text-white"
                : "border border-[rgba(21,35,29,0.12)] bg-white text-[#55635d] hover:bg-[#f1e7db]"
            }`}
          >
            {option.label} ({eventCounts[option.value]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#55635d]">Cargando calendario...</p>
      ) : error ? (
        <p className="text-sm text-[#b0413e]">{error}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-2xl border border-[rgba(21,35,29,0.08)] p-4">
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
              {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="h-20 rounded-xl bg-[#faf7f2]" />;
                }

                const dateKey = toDateKey(day);
                const dayEvents = eventsByDate[dateKey] ?? [];
                const isSelected = dateKey === selectedKey;

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(day)}
                    className={`h-20 rounded-xl border p-2 text-left transition ${
                      isSelected
                        ? "border-[#c4643b] bg-[#fff7ec]"
                        : "border-[rgba(21,35,29,0.08)] bg-white hover:bg-[#f9f4ec]"
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#15231d]">{day.getDate()}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={`${dateKey}-${ev.id}`}
                          className={`h-1.5 w-1.5 rounded-full ${
                            ev.type === "ASSIGNMENT_DUE"
                              ? "bg-[#c4643b]"
                              : ev.type === "SUBMISSION"
                              ? "bg-[#1b5c40]"
                              : ev.type === "ATTENDANCE"
                              ? "bg-[#6b7280]"
                              : "bg-[#b7791f]"
                          }`}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(21,35,29,0.08)] p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#8c6d57]">
              {selectedDate.toLocaleDateString("es", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>

            {selectedEvents.length === 0 ? (
              <p className="mt-3 text-sm text-[#8c6d57]">Sin eventos para esta fecha.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {selectedEvents.map((ev) => (
                  <div key={ev.id} className="rounded-xl border border-[rgba(21,35,29,0.08)] p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${EVENT_STYLE[ev.type]}`}>
                      {EVENT_LABEL[ev.type]}
                    </span>
                    <p className="mt-2 text-sm font-medium text-[#15231d]">{ev.title}</p>
                    {ev.description && (
                      <p className="mt-1 text-xs text-[#55635d] line-clamp-3">{ev.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
