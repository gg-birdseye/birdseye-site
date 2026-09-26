import { defineField, defineType } from 'sanity'

export const SCORECARD_TEE_COUNT_OPTIONS = [
  { title: '3 tees', value: 3 },
  { title: '4 tees', value: 4 },
  { title: '5 tees', value: 5 },
  { title: '6 tees', value: 6 },
] as const

export const SCORECARD_COMBO_TEE_COUNT_OPTIONS = [
  { title: '1 combo tee', value: 1 },
  { title: '2 combo tees', value: 2 },
  { title: '3 combo tees', value: 3 },
  { title: '4 combo tees', value: 4 },
] as const

export const SCORECARD_COMBO_AVAILABLE_FOR_OPTIONS = [
  { title: 'Both', value: 'both' },
  { title: "Men's only", value: 'men' },
  { title: "Women's only", value: 'women' },
] as const

export default defineType({
  name: 'scorecardConfig',
  title: 'Scorecard',
  type: 'object',
  fields: [
    defineField({
      name: 'hasWomenRatings',
      title: "Publish women's ratings & stroke index",
      type: 'boolean',
      initialValue: false,
      description:
        "When enabled, the course page shows a Men's/Women's toggle for ratings, stroke index, and par.",
    }),
    defineField({
      name: 'teeCount',
      title: "Number of Tees (Men's / standard)",
      type: 'number',
      options: {
        list: [...SCORECARD_TEE_COUNT_OPTIONS],
      },
      initialValue: 3,
      validation: (Rule) => Rule.required().integer().min(3).max(6),
      description:
        'Number of standard (non-combo) tees. When women’s ratings are published, this is the men’s tee count.',
    }),
    defineField({
      name: 'teeCountWomen',
      title: "Number of Tees (Women's)",
      type: 'number',
      description:
        'How many of the shortest standard tees (tee #1 … N) have women’s ratings. Must be ≤ men’s tee count.',
      hidden: ({ parent }) => !parent?.hasWomenRatings,
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as
            | { hasWomenRatings?: boolean; teeCount?: number }
            | undefined
          if (!parent?.hasWomenRatings) return true
          if (value == null) return "Required when women's ratings are published"
          if (!Number.isInteger(value) || value < 1) return 'Must be at least 1'
          const men = parent.teeCount ?? 3
          if (value > men) return `Cannot exceed men's tee count (${men})`
          return true
        }),
    }),
    defineField({
      name: 'hasComboTees',
      title: 'Combo Tees?',
      type: 'boolean',
      initialValue: false,
      description:
        'When enabled, add combo tee columns that alternate between two standard tee boxes.',
    }),
    defineField({
      name: 'comboTeeCount',
      title: 'Number of Combo Tees',
      type: 'number',
      options: {
        list: [...SCORECARD_COMBO_TEE_COUNT_OPTIONS],
      },
      initialValue: 1,
      hidden: ({ parent }) => !parent?.hasComboTees,
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { hasComboTees?: boolean } | undefined
          if (!parent?.hasComboTees) return true
          if (value == null) return 'Select how many combo tees to offer'
          if (!Number.isInteger(value) || value < 1 || value > 4) {
            return 'Combo tee count must be 1–4'
          }
          return true
        }),
    }),
    defineField({
      name: 'teeSets',
      title: 'Tee Sets',
      type: 'array',
      of: [{ type: 'scorecardTeeSet' }],
      description:
        'Name, total yards, color (standard), course rating, and slope for each tee. Combo tees append after standard tees.',
    }),
    defineField({
      name: 'teeNames',
      title: 'Tee Names (legacy)',
      type: 'array',
      of: [{ type: 'string' }],
      hidden: true,
      readOnly: true,
      deprecated: {
        reason: 'Replaced by teeSets — kept for legacy documents.',
      },
    }),
    defineField({
      name: 'holes',
      title: 'Holes',
      type: 'array',
      of: [{ type: 'holeScorecard' }],
    }),
  ],
})
