import { defineField, defineType } from 'sanity'

export const SCORECARD_TEE_COUNT_OPTIONS = [
  { title: '3 tees', value: 3 },
  { title: '4 tees', value: 4 },
  { title: '5 tees', value: 5 },
  { title: '6 tees', value: 6 },
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
      title: 'Number of Tees',
      type: 'number',
      options: {
        list: [...SCORECARD_TEE_COUNT_OPTIONS],
      },
      initialValue: 3,
      validation: (Rule) => Rule.required().integer().min(3).max(6),
    }),
    defineField({
      name: 'teeSets',
      title: 'Tee Sets',
      type: 'array',
      of: [{ type: 'scorecardTeeSet' }],
      description: 'Name, total yards, color, course rating, and slope for each tee.',
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
