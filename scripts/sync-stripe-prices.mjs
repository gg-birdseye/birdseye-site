import { readFileSync, writeFileSync } from "node:fs";
import Stripe from "stripe";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const tiers = [
  {
    label: "9",
    productMatch: "9 Hole",
    monthly: 30000,
    annual: 300000,
    monthlyKey: "STRIPE_PRICE_9_MONTHLY",
    annualKey: "STRIPE_PRICE_9_ANNUAL",
  },
  {
    label: "18",
    productMatch: "18 Hole",
    monthly: 50000,
    annual: 500000,
    monthlyKey: "STRIPE_PRICE_18_MONTHLY",
    annualKey: "STRIPE_PRICE_18_ANNUAL",
  },
  {
    label: "27",
    productMatch: "27 Hole",
    monthly: 70000,
    annual: 700000,
    monthlyKey: "STRIPE_PRICE_27_MONTHLY",
    annualKey: "STRIPE_PRICE_27_ANNUAL",
  },
];

const prices = await stripe.prices.list({
  active: true,
  limit: 100,
  expand: ["data.product"],
});

const mapped = {};

for (const tier of tiers) {
  const sample = prices.data.find(
    (price) =>
      typeof price.product === "object" &&
      price.product?.name?.includes(tier.productMatch),
  );
  if (!sample || typeof sample.product !== "object") {
    throw new Error(`Missing Stripe product for ${tier.label}-hole tier`);
  }

  const productId = sample.product.id;

  for (const [interval, amount, key] of [
    ["month", tier.monthly, tier.monthlyKey],
    ["year", tier.annual, tier.annualKey],
  ]) {
    const match = prices.data.find((price) => {
      const pid =
        typeof price.product === "object" ? price.product.id : price.product;
      return (
        pid === productId &&
        price.unit_amount === amount &&
        price.currency === "usd" &&
        price.recurring?.interval === interval
      );
    });

    if (match) {
      mapped[key] = match.id;
      continue;
    }

    const created = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: amount,
      recurring: { interval },
    });
    mapped[key] = created.id;
  }
}

let env = readFileSync(".env.local", "utf8");
for (const [key, value] of Object.entries(mapped)) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(env)) {
    env = env.replace(pattern, `${key}=${value}`);
  } else {
    env += `\n${key}=${value}`;
  }
}
writeFileSync(".env.local", env);

console.log(JSON.stringify({ mapped, message: "Updated .env.local" }, null, 2));
