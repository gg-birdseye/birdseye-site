import { asc, eq } from "drizzle-orm";
import { clientCourses, getDb, type ClientCourse, type NewClientCourse } from "@/lib/db";

export async function getClientCourses(clientId: string): Promise<ClientCourse[]> {
  const db = getDb();
  return db
    .select()
    .from(clientCourses)
    .where(eq(clientCourses.clientId, clientId))
    .orderBy(asc(clientCourses.sortOrder), asc(clientCourses.createdAt));
}

export async function getClientCoursesBySlug(
  courseSlug: string,
): Promise<{ course: ClientCourse; clientId: string } | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(clientCourses)
    .where(eq(clientCourses.courseSlug, courseSlug))
    .limit(1);
  if (!row) return null;
  return { course: row, clientId: row.clientId };
}

export async function insertClientCourses(
  clientId: string,
  lines: Omit<NewClientCourse, "id" | "clientId" | "createdAt" | "updatedAt">[],
) {
  const db = getDb();
  const now = new Date();
  if (lines.length === 0) return [];

  return db
    .insert(clientCourses)
    .values(
      lines.map((line, index) => ({
        ...line,
        clientId,
        sortOrder: line.sortOrder ?? index,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .returning();
}

export async function updateClientCourseById(
  id: string,
  patch: Partial<NewClientCourse>,
) {
  const db = getDb();
  const [updated] = await db
    .update(clientCourses)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clientCourses.id, id))
    .returning();
  return updated ?? null;
}
