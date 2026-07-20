import { readFileSync } from "node:fs";
import Stripe from "stripe";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY missing");
  process.exit(1);
}

const stripe = new Stripe(key);

const expected = {
  STRIPE_PRICE_9_MONTHLY: 30000,
  STRIPE_PRICE_9_ANNUAL: 300000,
  STRIPE_PRICE_18_MONTHLY: 50000,
  STRIPE_PRICE_18_ANNUAL: 500000,
  STRIPE_PRICE_27_MONTHLY: 70000,
  STRIPE_PRICE_27_ANNUAL: 700000,
};

const prices = await stripe.prices.list({
  active: true,
  limit: 100,
  expand: ["data.product"],
});

const recurring = prices.data.filter((price) => price.type === "recurring");

const mapped = {};
const unmatched = [];

for (const [envKey, amount] of Object.entries(expected)) {
  const interval = envKey.endsWith("_MONTHLY") ? "month" : "year";
  const matches = recurring.filter(
    (price) =>
      price.unit_amount === amount &&
      price.currency === "usd" &&
      price.recurring?.interval === interval,
  );

  if (matches.length === 1) {
    mapped[envKey] = matches[0].id;
  } else if (matches.length > 1) {
    mapped[envKey] = matches[0].id;
    console.warn(`Multiple prices for ${envKey}, using ${matches[0].id}`);
  } else {
    unmatched.push({ envKey, amount, interval });
  }
}

console.log(JSON.stringify({ mapped, unmatched, allPrices: recurring.map((p) => ({
  id: p.id,
  amount: p.unit_amount,
  interval: p.recurring?.interval,
  product: typeof p.product === "object" ? p.product?.name : p.product,
})) }, null, 2));
