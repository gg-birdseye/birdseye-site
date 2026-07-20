import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/db";
import { isDocuSignConfigured } from "@/lib/docusign/config";
import {
  getClientByIdWithCourses,
  getClientByTokenWithCourses,
} from "@/lib/onboarding/clients";
import { buildContractMergeFields } from "@/lib/onboarding/contract-merge-fields";
import { formatScheduleAText } from "@/lib/onboarding/contract-schedule";
import { resolvePlan } from "@/lib/onboarding/client-utils";
import { markClientContractSigned } from "@/lib/onboarding/mark-contract-signed";

type Params = { params: Promise<{ token: string }> };

type ContractBody = {
  signerName?: string;
  agreed?: boolean;
};

export async function GET(_request: Request, { params }: Params) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Onboarding is not configured." },
      { status: 503 },
    );
  }

  const { token } = await params;
  const client = await getClientByTokenWithCourses(token);
  if (!client) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const courses = client.courses ?? [];
  const plan = resolvePlan(client);

  return NextResponse.json({
    docusignEnabled: isDocuSignConfigured(),
    courseCount: courses.length,
    scheduleA: formatScheduleAText(client, courses, plan),
    mergeFields: buildContractMergeFields(client),
    docusignEnvelopeId: client.docusignEnvelopeId,
    docusignContractStatus: client.docusignContractStatus,
  });
}

export async function POST(request: Request, { params }: Params) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Onboarding is not configured." },
      { status: 503 },
    );
  }

  const { token } = await params;
  const client = await getClientByTokenWithCourses(token);
  if (!client) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  if (client.onboardingStatus === "active") {
    return NextResponse.json({ client });
  }

  if (client.onboardingStatus === "invited") {
    return NextResponse.json(
      { error: "Complete intake before signing the agreement." },
      { status: 400 },
    );
  }

  let body: ContractBody;
  try {
    body = (await request.json()) as ContractBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const signerName = body.signerName?.trim() ?? "";
  if (!body.agreed || !signerName) {
    return NextResponse.json(
      { error: "Agreement acceptance and full legal name are required." },
      { status: 400 },
    );
  }

  const updated = await markClientContractSigned(client, { signerName });

  return NextResponse.json({
    client: updated,
  });
}
