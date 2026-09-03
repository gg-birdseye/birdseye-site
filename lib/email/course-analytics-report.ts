import type { CourseAnalyticsReport, NamedCount } from "@/lib/ga4/course-report";
import { formatEngagement, formatShortDate } from "@/lib/ga4/dates";
import { sendEmail } from "@/lib/email/send";

const GREEN = "#5ab078";
const GREEN_DARK = "#14453d";
const BG = "#0a120e";
const CARD = "#12352f";
const TEXT = "#f5f5f4";
const MUTED = "#d6d3d1";
const SUBTLE = "#a8a29e";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function barRow(item: NamedCount, max: number) {
  const width = max > 0 ? Math.max(6, Math.round((item.count / max) * 100)) : 0;
  return `
    <tr>
      <td style="padding:8px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT};">
        ${escapeHtml(item.label)}
      </td>
      <td align="right" style="padding:8px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${GREEN};font-weight:700;white-space:nowrap;padding-left:12px;">
        ${formatCount(item.count)}
      </td>
    </tr>
    <tr>
      <td colspan="2" style="padding:0 0 10px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a120e;border-radius:4px;">
          <tr>
            <td width="${width}%" style="height:8px;background:${GREEN};border-radius:4px;font-size:0;line-height:0;">&nbsp;</td>
            <td width="${100 - width}%" style="height:8px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function sectionTitle(title: string, description: string) {
  return `
    <h2 style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.3;font-weight:700;color:${TEXT};">
      ${escapeHtml(title)}
    </h2>
    <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:${SUBTLE};">
      ${escapeHtml(description)}
    </p>
  `;
}

function scorecard(label: string, value: string, description: string) {
  return `
    <td width="50%" valign="top" style="padding:6px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${CARD};border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
        <tr>
          <td style="padding:18px 16px;">
            <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${GREEN};font-weight:700;">
              ${escapeHtml(label)}
            </p>
            <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:1;font-weight:700;color:${TEXT};">
              ${escapeHtml(value)}
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:${SUBTLE};">
              ${escapeHtml(description)}
            </p>
          </td>
        </tr>
      </table>
    </td>
  `;
}

function dailyChart(points: CourseAnalyticsReport["daily"]) {
  if (points.length === 0) {
    return `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED};">No visits in this period yet.</p>`;
  }
  const max = Math.max(...points.map((point) => point.visitors), 1);
  const cells = points
    .map((point) => {
      const height = Math.max(4, Math.round((point.visitors / max) * 72));
      return `
        <td valign="bottom" style="padding:0 1px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td title="${escapeHtml(formatShortDate(point.date))}: ${formatCount(point.visitors)} visitors" height="${height}" style="height:${height}px;background:${GREEN};border-radius:2px 2px 0 0;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td>
      `;
    })
    .join("");

  const first = formatShortDate(points[0]!.date);
  const last = formatShortDate(points[points.length - 1]!.date);

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="border-bottom:1px solid rgba(255,255,255,0.08);height:76px;">
          <table role="presentation" width="100%" height="76" cellspacing="0" cellpadding="0" border="0">
            <tr>${cells}</tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-top:8px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${SUBTLE};">${escapeHtml(first)}</td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${SUBTLE};">${escapeHtml(last)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function listSection(
  title: string,
  description: string,
  rows: NamedCount[],
  empty: string,
) {
  const max = rows[0]?.count ?? 0;
  return `
    ${sectionTitle(title, description)}
    ${
      rows.length === 0
        ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${MUTED};">${escapeHtml(empty)}</p>`
        : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows.map((row) => barRow(row, max)).join("")}</table>`
    }
  `;
}

export function buildCourseAnalyticsReportHtml(
  report: CourseAnalyticsReport,
  _greetingName?: string | null,
): string {
  const logoUrl = "https://www.birdseye.golf/email/logo.png";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(report.courseTitle)} — Birdseye preview report</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    How golfers explored ${escapeHtml(report.courseTitle)} on Birdseye during ${escapeHtml(report.rangeLabel)}.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;">
          <tr>
            <td style="padding:8px 8px 20px;">
              <img src="${logoUrl}" width="132" alt="Birdseye Golf" style="display:block;border:0;max-width:132px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="background:${GREEN_DARK};border-radius:16px;padding:32px 28px;">
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${GREEN};font-weight:700;">
                ${escapeHtml(report.rangeLabel)}
              </p>
              <h1 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:28px;line-height:1.2;color:${TEXT};">
                ${escapeHtml(report.courseTitle)}
              </h1>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${MUTED};">
                This is how golfers used your Birdseye course page for the dates listed above.
              </p>
            </td>
          </tr>
          <tr><td style="height:20px;line-height:20px;font-size:20px;">&nbsp;</td></tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  ${scorecard("Unique visitors", formatCount(report.visitors), "Golfers who opened your preview at least once.")}
                  ${scorecard("Sessions", formatCount(report.sessions), "Total visits. One golfer may visit more than once.")}
                </tr>
                <tr>
                  ${scorecard("Avg. time exploring", formatEngagement(report.avgEngagementSeconds), "Average time spent on all course content.")}
                  ${scorecard("Book tee time clicks", formatCount(report.bookTeeTimeClicks), "Clicks that sent golfers to your tee sheet.")}
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:20px;line-height:20px;font-size:20px;">&nbsp;</td></tr>
          <tr>
            <td style="background:${CARD};border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px 22px;">
              ${sectionTitle("Preview traffic over time", "Daily visitors to your Birdseye course page. Spikes often follow emails, social posts, or QR scans.")}
              ${dailyChart(report.daily)}
            </td>
          </tr>
          <tr><td style="height:20px;line-height:20px;font-size:20px;">&nbsp;</td></tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="50%" valign="top" style="padding-right:8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${CARD};border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
                      <tr>
                        <td style="padding:22px 20px;">
                          ${listSection(
                            "How they found you",
                            "Where golfers came from before opening your course page.",
                            report.sources,
                            "No traffic sources recorded yet.",
                          )}
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" valign="top" style="padding-left:8px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${CARD};border:1px solid rgba(255,255,255,0.08);border-radius:16px;">
                      <tr>
                        <td style="padding:22px 20px;">
                          ${listSection(
                            "Devices",
                            "Most golfers preview courses on a phone.",
                            report.devices,
                            "No device data yet.",
                          )}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height:20px;line-height:20px;font-size:20px;">&nbsp;</td></tr>
          <tr>
            <td style="background:${CARD};border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px 22px;">
              ${listSection(
                "Most explored holes",
                "Holes golfers jumped to most often in the interactive preview.",
                report.holes,
                report.eventTotals.holeSelects > 0
                  ? `${formatCount(report.eventTotals.holeSelects)} hole jumps were recorded. Register the hole_number custom dimension in GA4 to break this out by hole.`
                  : "Golfers have not jumped between holes yet.",
              )}
            </td>
          </tr>
          <tr><td style="height:20px;line-height:20px;font-size:20px;">&nbsp;</td></tr>
          <tr>
            <td style="background:${CARD};border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px 22px;">
              ${listSection(
                "Feature usage",
                "Which parts of your preview golfers opened.",
                report.panels.length > 0
                  ? report.panels
                  : [
                      ...(report.eventTotals.panelOpens
                        ? [{ label: "Scorecard / Aerial panels", count: report.eventTotals.panelOpens }]
                        : []),
                      ...(report.eventTotals.aerialOpens
                        ? [{ label: "Aerial map", count: report.eventTotals.aerialOpens }]
                        : []),
                      ...(report.eventTotals.embedViews
                        ? [{ label: "Website embed views", count: report.eventTotals.embedViews }]
                        : []),
                    ],
                "No panel or embed activity yet.",
              )}
            </td>
          </tr>
          <tr><td style="height:28px;line-height:28px;font-size:28px;">&nbsp;</td></tr>
          <tr>
            <td align="center" style="padding:0 8px 8px;">
              <a href="${escapeHtml(report.pageUrl)}" style="display:inline-block;padding:14px 28px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.08);font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${TEXT};text-decoration:none;">
                Open your course page
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 8px;">
              <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${MUTED};">
                Questions about these numbers? Just reply to this email.
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${TEXT};">
                — The Birdseye team
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 8px 8px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${SUBTLE};text-align:center;">
                Powered by <a href="https://www.birdseye.golf" style="color:${GREEN};text-decoration:none;">Birdseye Golf</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function courseAnalyticsReportSubject(report: CourseAnalyticsReport) {
  return `Your Birdseye preview report — ${report.rangeLabel}`;
}

export async function sendCourseAnalyticsReportEmail(options: {
  report: CourseAnalyticsReport;
  to: string[];
  greetingName?: string | null;
}) {
  await sendEmail({
    to: options.to,
    replyTo: process.env.CONTACT_TO_EMAIL?.trim(),
    required: true,
    subject: courseAnalyticsReportSubject(options.report),
    html: buildCourseAnalyticsReportHtml(options.report, options.greetingName),
  });
}
