import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import { isDatabaseConfigured } from "@/lib/db";
import type { NewReferral } from "@/lib/db/schema";
import {
  sendReferralReleasedEmail,
  sendReferralWonEmail,
} from "@/lib/email/referrals";
import { getReferralById, updateReferral } from "@/lib/referrals/store";

type ReferralActionBody = {
  action?: "qualify" | "release" | "win" | "fulfill" | "notes";
  releaseReason?: string;
  rewardReference?: string;
  adminNotes?: string;
  sendEmail?: boolean;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;

  let body: ReferralActionBody;
  try {
    body = (await request.json()) as ReferralActionBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const referral = await getReferralById(id);
  if (!referral) {
    return NextResponse.json({ error: "Referral not found." }, { status: 404 });
  }

  const now = new Date();
  let values: Partial<NewReferral>;

  switch (body.action) {
    case "qualify": {
      if (referral.status !== "pending_verify") {
        return NextResponse.json(
          { error: "Only pending referrals can be qualified." },
          { status: 400 },
        );
      }
      values = { status: "qualified", qualifiedAt: now };
      break;
    }
    case "release": {
      if (referral.status === "won") {
        return NextResponse.json(
          { error: "A won referral can't be released." },
          { status: 400 },
        );
      }
      values = {
        status: "released",
        releaseReason: body.releaseReason?.trim() || "released_by_admin",
        releasedAt: now,
      };
      break;
    }
    case "win": {
      if (referral.status !== "qualified" && referral.status !== "pending_verify") {
        return NextResponse.json(
          { error: "Only active referrals can be marked won." },
          { status: 400 },
        );
      }
      values = {
        status: "won",
        wonAt: now,
        qualifiedAt: referral.qualifiedAt ?? now,
      };
      break;
    }
    case "fulfill": {
      if (referral.status !== "won") {
        return NextResponse.json(
          { error: "Only won referrals can be marked fulfilled." },
          { status: 400 },
        );
      }
      values = {
        rewardFulfilledAt: now,
        rewardReference: body.rewardReference?.trim() || null,
      };
      break;
    }
    case "notes": {
      values = { adminNotes: body.adminNotes?.trim() || null };
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  if (body.action !== "notes" && body.adminNotes != null) {
    values.adminNotes = body.adminNotes.trim() || null;
  }

  const updated = await updateReferral(id, values);
  if (!updated) {
    return NextResponse.json({ error: "Failed to update referral." }, { status: 500 });
  }

  const shouldEmail = body.sendEmail !== false;
  if (shouldEmail && body.action === "release") {
    await sendReferralReleasedEmail(updated);
  }
  if (shouldEmail && body.action === "win") {
    await sendReferralWonEmail(updated);
  }

  return NextResponse.json({ referral: updated });
}
