import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Public pricing is unpublished. Restore the previous page to republish. */
export default function PricingPage() {
  notFound();
}
