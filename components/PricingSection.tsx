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
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
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
                    : "text-stone-300 hover:bg-white/10 hover:text-white"
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
          price={isCustom ? "Contact for custom pricing" : formatPrice(tier!.monthly)}
          cadence={isCustom ? null : "/mo"}
          billing={isCustom ? "Tailored to your course" : "Billed monthly"}
          note={isCustom ? "We'll build a plan that fits" : "Cancel anytime"}
          highlighted={false}
          badge={null}
          isCustom={isCustom}
        />

        <PricingCard
          name="Annual"
          price={isCustom ? "Contact for custom pricing" : formatPrice(tier!.yearly)}
          cadence={isCustom ? null : "/yr"}
          billing={isCustom ? "Tailored to your course" : "Billed annually"}
          note={isCustom ? "We'll build a plan that fits" : "Best value for your course"}
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
  price: string;
  cadence: string | null;
  billing: string;
  note: string;
  highlighted: boolean;
  badge: string | null;
  isCustom: boolean;
};

function PricingCard({
  name,
  price,
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

      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-400">
        {name}
      </p>

      <p
        className={`mt-4 flex items-baseline gap-1 ${isCustom ? "flex-col items-start gap-2" : ""}`}
      >
        <span
          className={`font-bold tracking-tight text-white ${
            isCustom ? "text-2xl leading-snug md:text-3xl" : "text-5xl"
          }`}
        >
          {price}
        </span>
        {cadence ? (
          <span className="text-lg font-medium text-stone-400">{cadence}</span>
        ) : null}
      </p>

      <p className="mt-4 text-sm text-stone-300">{billing}</p>
      <p className="mt-1 text-sm text-stone-500">{note}</p>
    </div>
  );
}
