import Link from "next/link";
import {
  annualSavings,
  formatPrice,
  HOLE_OPTIONS,
  PRICING_BY_HOLES,
  type HoleCount,
} from "@/lib/pricing";

type PricingSectionProps = {
  holeCount: HoleCount;
};

export function PricingSection({ holeCount }: PricingSectionProps) {
  const isCustom = holeCount === "other";
  const tier = isCustom ? null : PRICING_BY_HOLES[holeCount];
  const savings = tier ? annualSavings(tier) : 0;

  return (
    <>
      <div className="relative z-10 mt-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">
          Number of holes
        </p>
        <div
          className="mt-3 inline-flex flex-wrap gap-2 rounded-full border border-white/10 bg-white/5 p-1"
          role="group"
          aria-label="Number of holes"
        >
          {HOLE_OPTIONS.map((option) => {
            const isSelected = holeCount === option.value;
            const href =
              option.value === 18 ? "/pricing" : `/pricing?holes=${option.value}`;

            return (
              <Link
                key={option.label}
                href={href}
                scroll={false}
                aria-current={isSelected ? "true" : undefined}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  isSelected
                    ? "bg-birdseye-500 text-white shadow-sm"
                    : "text-white hover:bg-white/10"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 mt-8 grid gap-6 md:grid-cols-2">
        <PricingCard
          name="Monthly"
          year1Price={isCustom ? null : formatPrice(tier!.monthly)}
          year2Price={isCustom ? null : formatPrice(tier!.year2.monthly)}
          cadence={isCustom ? null : "/mo"}
          billing={isCustom ? "Tailored to your course" : "Billed monthly"}
          note={
            isCustom
              ? "We'll build a plan that fits"
              : "Year 1 at the launch rate, then the lower rate from year 2 on"
          }
          highlighted={false}
          badge={null}
          isCustom={isCustom}
        />

        <PricingCard
          name="Annual"
          year1Price={isCustom ? null : formatPrice(tier!.yearly)}
          year2Price={isCustom ? null : formatPrice(tier!.year2.yearly)}
          cadence={isCustom ? null : "/yr"}
          billing={isCustom ? "Tailored to your course" : "Billed annually"}
          note={
            isCustom
              ? "We'll build a plan that fits"
              : "Best value for your course — 2 months free each year"
          }
          highlighted={!isCustom}
          badge={
            isCustom || savings <= 0
              ? null
              : `Save ${formatPrice(savings)} — 2 months free`
          }
          isCustom={isCustom}
        />
      </div>
    </>
  );
}

type PricingCardProps = {
  name: string;
  year1Price: string | null;
  year2Price: string | null;
  cadence: string | null;
  billing: string;
  note: string;
  highlighted: boolean;
  badge: string | null;
  isCustom: boolean;
};

function PriceRow({
  label,
  price,
  cadence,
  featured,
}: {
  label: string;
  price: string;
  cadence: string;
  featured: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={`font-bold tracking-tight text-white ${
            featured ? "text-5xl" : "text-3xl"
          }`}
        >
          {price}
        </span>
        <span className="text-lg font-medium text-white">{cadence}</span>
      </p>
    </div>
  );
}

function PricingCard({
  name,
  year1Price,
  year2Price,
  cadence,
  billing,
  note,
  highlighted,
  badge,
  isCustom,
}: PricingCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 ${
        highlighted
          ? "border-birdseye-400/60 bg-birdseye-900/60"
          : "border-white/10 bg-white/5"
      }`}
    >
      {badge ? (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-birdseye-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-lg">
          {badge}
        </span>
      ) : null}

      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-birdseye-400">
        {name}
      </p>

      {isCustom || !year1Price || !year2Price || !cadence ? (
        <p className="mt-4 flex flex-col items-start gap-2">
          <span className="text-2xl font-bold leading-snug tracking-tight text-white md:text-3xl">
            Contact for custom pricing
          </span>
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          <PriceRow
            label="Year 1"
            price={year1Price}
            cadence={cadence}
            featured
          />
          <PriceRow
            label="Year 2+"
            price={year2Price}
            cadence={cadence}
            featured={false}
          />
        </div>
      )}

      <p className="mt-5 text-sm text-white">{billing}</p>
      <p className="mt-1 text-sm text-white">{note}</p>
    </div>
  );
}
