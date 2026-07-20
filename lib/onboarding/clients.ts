import { desc, eq } from "drizzle-orm";
import { clients, getDb, withDbRetry, type ClientWithCourses } from "@/lib/db";
import { createInviteToken } from "@/lib/onboarding/tokens";
import {
  getClientCourses,
  insertClientCourses,
} from "@/lib/onboarding/client-courses";
import {
  calculateMultiCourseQuote,
  type CourseLineInput,
} from "@/lib/pricing/multi-course";
import {
  evaluateTravelFeeFromCourses,
} from "@/lib/onboarding/evaluate-travel-fee";
import { resolveContractVariant } from "@/lib/onboarding/contract-variants";
import type {
  NewClient,
  PaymentMethod,
  PlanInterval,
} from "@/lib/db/schema";

export async function attachCourses(client: Awaited<ReturnType<typeof getClientById>>) {
  if (!client) return null;
  const courses = await getClientCourses(client.id);
  return { ...client, courses } satisfies ClientWithCourses;
}

export async function getClientByToken(token: string) {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.token, token))
    .limit(1);
  return client ?? null;
}

export async function getClientByTokenWithCourses(token: string) {
  return attachCourses(await getClientByToken(token));
}

export async function getClientById(id: string) {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  return client ?? null;
}

export async function getClientByIdWithCourses(id: string) {
  return attachCourses(await getClientById(id));
}

export async function listClients() {
  return withDbRetry(async () => {
    const db = getDb();
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  });
}

export async function listClientsWithCourses(): Promise<ClientWithCourses[]> {
  const rows = await listClients();
  return Promise.all(
    rows.map(async (client) => {
      const courses = await getClientCourses(client.id);
      return { ...client, courses };
    }),
  );
}

type CreateInviteInput = {
  organizationName?: string;
  courseName: string;
  contactEmail: string;
  billingApEmail?: string;
  contactName?: string;
  courses: CourseLineInput[];
  holeCount?: number | null;
  customHoleCount?: number | null;
  plan: PlanInterval;
  paymentMethod: PaymentMethod;
  customPriceCents?: number | null;
  adminNotes?: string;
  travelMobilizationFeeRequired?: boolean;
  tradeOutElected?: boolean;
  tradeOutCreditAmount?: string | null;
  tradeOutCompRoundsPerYear?: number | null;
  tradeOutMaxPlayersPerRound?: number | null;
  tradeOutBookingRestrictions?: string | null;
  tradeOutBookingContact?: string | null;
  productionWindow?: string | null;
  teeTime1?: string | null;
  teeTime2?: string | null;
  teeTime3?: string | null;
  onSiteCourseRepresentative?: string | null;
  specialAccessInstructions?: string | null;
  projectSpecificNotes?: string | null;
};

function toCourseLocationLines(courses: CourseLineInput[]) {
  return courses.map((course) => ({
    courseName: course.courseName,
    addressLine1: course.courseAddressLine1,
    city: course.courseCity,
    state: course.courseState,
    zip: course.courseZip,
  }));
}

export async function createClientInvite(input: CreateInviteInput) {
  const db = getDb();
  const now = new Date();
  const plan = input.plan;
  const courseLines =
    input.courses.length > 0
      ? input.courses
      : [
          {
            courseName: input.courseName,
            holeCount: input.holeCount ?? 18,
            customHoleCount: input.customHoleCount ?? null,
          },
        ];

  const quote = calculateMultiCourseQuote(courseLines, plan);
  if (!quote && !input.customPriceCents) {
    throw new Error(
      "Unable to price this deal. Use standard hole counts (9, 18, 27) or set a custom price.",
    );
  }

  const organizationName =
    input.organizationName?.trim() ||
    (courseLines.length > 1 ? input.courseName.trim() : courseLines[0].courseName.trim());
  const primaryCourse = courseLines[0];
  const displayCourseName =
    courseLines.length === 1
      ? primaryCourse.courseName.trim()
      : organizationName;

  const travelEvaluation = await evaluateTravelFeeFromCourses(
    toCourseLocationLines(courseLines),
  );

  const travelMobilizationFeeRequired = input.travelMobilizationFeeRequired ?? false;
  const tradeOutElected = input.tradeOutElected ?? false;
  const contractVariant = resolveContractVariant({
    travelMobilizationFeeRequired,
    tradeOutElected,
    contractVariant: null,
  });

  const values: NewClient = {
    token: createInviteToken(),
    organizationName,
    courseName: displayCourseName,
    contactName: input.contactName?.trim() || null,
    contactEmail: input.contactEmail.trim().toLowerCase(),
    billingApEmail: input.billingApEmail?.trim().toLowerCase() || null,
    holeCount: primaryCourse.holeCount ?? null,
    customHoleCount: primaryCourse.customHoleCount ?? null,
    plan,
    paymentMethod: input.paymentMethod,
    customPriceCents: input.customPriceCents ?? null,
    quotedSubtotalCents: quote?.subtotalCents ?? input.customPriceCents ?? null,
    multiCourseDiscountCents: quote?.discountCents ?? 0,
    multiCourseDiscountPercent: quote?.discountPercent ?? 0,
    travelMobilizationFeeRequired,
    travelMobilizationFeeOverride: null,
    travelDistanceMiles: travelEvaluation.distanceMiles,
    contractVariant,
    adminNotes: input.adminNotes?.trim() || null,
    tradeOutElected,
    tradeOutCreditAmount: input.tradeOutCreditAmount ?? null,
    tradeOutCompRoundsPerYear: input.tradeOutCompRoundsPerYear ?? null,
    tradeOutMaxPlayersPerRound: input.tradeOutMaxPlayersPerRound ?? null,
    tradeOutBookingRestrictions: input.tradeOutBookingRestrictions ?? null,
    tradeOutBookingContact: input.tradeOutBookingContact ?? null,
    productionWindow: input.productionWindow?.trim() || null,
    teeTime1: input.teeTime1?.trim() || null,
    teeTime2: input.teeTime2?.trim() || null,
    teeTime3: input.teeTime3?.trim() || null,
    onSiteCourseRepresentative: input.onSiteCourseRepresentative?.trim() || null,
    specialAccessInstructions: input.specialAccessInstructions?.trim() || null,
    projectSpecificNotes: input.projectSpecificNotes?.trim() || null,
    onboardingStatus: "invited",
    billingStatus: "inactive",
    paymentStatus: "pending",
    invitedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const [created] = await db.insert(clients).values(values).returning();

  await insertClientCourses(
    created.id,
    courseLines.map((line, index) => ({
      courseName: line.courseName.trim(),
      holeCount: line.holeCount,
      customHoleCount: line.customHoleCount ?? null,
      customUnitPriceCents: line.customUnitPriceCents ?? null,
      courseAddressLine1: line.courseAddressLine1?.trim() || null,
      courseCity: line.courseCity?.trim() || null,
      courseState: line.courseState?.trim() || null,
      courseZip: line.courseZip?.trim() || null,
      sortOrder: index,
    })),
  );

  return (await attachCourses(created))!;
}

export async function updateClientById(
  id: string,
  patch: Partial<NewClient>,
) {
  const db = getDb();
  const [updated] = await db
    .update(clients)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return updated ?? null;
}

export async function getClientByStripeSubscriptionId(subscriptionId: string) {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.stripeSubscriptionId, subscriptionId))
    .limit(1);
  return client ?? null;
}

export async function getClientByStripeCustomerId(customerId: string) {
  const db = getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.stripeCustomerId, customerId))
    .limit(1);
  return client ?? null;
}

export async function deleteClientById(id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(clients)
    .where(eq(clients.id, id))
    .returning({ id: clients.id });
  return deleted.length > 0;
}
