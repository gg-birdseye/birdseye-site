import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { DM_Sans } from "next/font/google";
import { getSiteUrl } from "@/lib/seo/site";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const siteUrl = getSiteUrl();
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

const defaultDescription =
  "Turn your course footage into a rich, explorable preview golfers can experience before they tee off.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Birdseye | Golf Course Preview",
    template: "%s",
  },
  description: defaultDescription,
  openGraph: {
    title: "Birdseye | Golf Course Preview",
    description: defaultDescription,
    type: "website",
    siteName: "Birdseye",
  },
  twitter: {
    card: "summary_large_image",
    title: "Birdseye | Golf Course Preview",
    description: defaultDescription,
  },
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en" className={dmSans.variable}>
      <body className="font-sans">
        {children}
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
