import { Suspense } from "react";
import CourseDetailClient from "./course-detail-client";

export function generateStaticParams() {
  return Array.from({ length: 200 }, (_, index) => ({
    id: String(index + 1),
  }));
}

export default function CourseDetailPage() {
  return (
    <Suspense fallback={null}>
      <CourseDetailClient />
    </Suspense>
  );
}
