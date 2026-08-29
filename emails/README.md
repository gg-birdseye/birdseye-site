# Golf course outreach email

Template: `golf-course-outreach.html`

## Placeholders

Replace these before sending (or map them in Mailchimp, HubSpot, etc.):

| Placeholder | Example value |
|-------------|---------------|
| `{{FIRST_NAME}}` | `Mike` |
| `{{COURSE_NAME}}` | `Pebble Beach Golf Links` |
| `{{GIF_URL}}` | `https://www.birdseye.golf/email/birdseye-demo.gif` |
| `{{GIF_ALT}}` | `Birdseye interactive course preview demo showing scroll flyovers, scorecard, and aerial map` |
| `{{DEMO_URL}}` | `https://www.birdseye.golf/birchcreek` |
| `{{CTA_URL}}` | Your Calendly, contact form, or reply-to mailto link |
| `{{LOGO_URL}}` | Hosted **PNG** logo (~280px wide). SVG is unreliable in email. |
| `{{UNSUBSCRIBE_URL}}` | Required for bulk sends; remove footer row for 1:1 outreach |

## Recommended subject lines

- See your course the way golfers wish they could — before they book
- What if golfers could fly every hole before they tee off?
- A new way to preview {{COURSE_NAME}} online

## GIF tips

- Width: **600px** max
- Length: **15–20 seconds** loop
- Target size: **under 1MB** for email clients
- Host on your domain or CDN (not as an attachment)

## Brand colors used

| Token | Hex | Usage |
|-------|-----|-------|
| Surface | `#0a120e` | Email background |
| Elevated | `#14453d` | Hero + highlight cards |
| Course UI | `#1a1814` | GIF frame |
| Accent | `#5ab078` | Checkmarks |
| Accent light | `#8fcea6` | Labels + links |
| Text | `#f5f5f4` / `#d6d3d1` | Headlines + body |

## Testing

Preview in [Litmus](https://www.litmus.com/) or send test messages to Gmail, Apple Mail, and Outlook before a campaign.
