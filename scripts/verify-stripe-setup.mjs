import { readFileSync } from "node:fs";
import Stripe from "stripe";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const required = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_18_ANNUAL",
];

const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error("Missing:", missing.join(", "));
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_18_ANNUAL, {
  expand: ["product"],
});

const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer_email: "stripe-test@birdseye.golf",
  line_items: [{ price: price.id, quantity: 1 }],
  success_url: "http://localhost:3000/onboarding/test?checkout=success",
  cancel_url: "http://localhost:3000/onboarding/test?checkout=cancel",
  metadata: { clientId: "setup-verification" },
});

console.log("Stripe setup OK");
console.log("Sample price:", price.id, price.unit_amount, price.recurring?.interval);
console.log(
  "Product:",
  typeof price.product === "object" ? price.product.name : price.product,
);
console.log("Test checkout session created:", session.id);
console.log("Checkout URL:", session.url);
