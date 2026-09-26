import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'scorecardTeeSet',
  title: 'Tee Set',
  type: 'object',
  fields: [
    defineField({
      name: 'name',
      title: 'Tee Name',
      type: 'string',
      description: 'e.g. Red, White, Blue, or White/Silver for a combo',
    }),
    defineField({
      name: 'isCombo',
      title: 'Combo tee',
      type: 'boolean',
      initialValue: false,
      description: 'Combo tees pull colors from two standard tee numbers.',
    }),
    defineField({
      name: 'teeNumber',
      title: 'Tee number',
      type: 'number',
      description: '1 = shortest standard tee; higher = longer. Used for women’s shortest-N and combo pairing.',
      hidden: ({ parent }) => Boolean(parent?.isCombo),
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { isCombo?: boolean } | undefined
          if (parent?.isCombo) return true
          if (value == null) return true
          if (!Number.isInteger(value) || value < 1 || value > 6) {
            return 'Tee number must be an integer from 1 to 6'
          }
          return true
        }),
    }),
    defineField({
      name: 'color',
      title: 'Tee Color',
      type: 'string',
      description: 'Hex color used on the scorecard chart for this tee (e.g. #CF8018).',
      hidden: ({ parent }) => Boolean(parent?.isCombo),
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { isCombo?: boolean } | undefined
          if (parent?.isCombo) return true
          if (!value) return true
          return /^#[0-9A-Fa-f]{6}$/.test(value)
            ? true
            : 'Use a 6-digit hex color like #CF8018'
        }),
    }),
    defineField({
      name: 'comboTeeNumbers',
      title: 'Combo of tee numbers',
      type: 'object',
      description: 'Two distinct standard tee numbers (e.g. 2 & 3). Lower number color appears top-left.',
      hidden: ({ parent }) => !parent?.isCombo,
      fields: [
        defineField({
          name: 'low',
          title: 'Lower tee #',
          type: 'number',
          validation: (Rule) => Rule.integer().min(1).max(6),
        }),
        defineField({
          name: 'high',
          title: 'Higher tee #',
          type: 'number',
          validation: (Rule) => Rule.integer().min(1).max(6),
        }),
      ],
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { isCombo?: boolean } | undefined
          if (!parent?.isCombo) return true
          const pair = value as { low?: number; high?: number } | undefined
          if (pair?.low == null || pair?.high == null) {
            return 'Select two tee numbers for this combo'
          }
          if (pair.low === pair.high) return 'Combo tee numbers must be different'
          return true
        }),
    }),
    defineField({
      name: 'availableFor',
      title: 'Available for',
      type: 'string',
      options: {
        list: [
          { title: 'Both', value: 'both' },
          { title: "Men's only", value: 'men' },
          { title: "Women's only", value: 'women' },
        ],
        layout: 'radio',
      },
      initialValue: 'both',
      hidden: ({ parent }) => !parent?.isCombo,
      description: 'Whether this combo tee appears for men’s, women’s, or both scorecards.',
    }),
    defineField({
      name: 'totalYards',
      title: 'Total Yards',
      type: 'string',
      description: 'Total yardage for this tee set (e.g. 6524).',
    }),
    defineField({
      name: 'totalPar',
      title: 'Total par',
      type: 'scorecardGenderValues',
      description:
        'Auto-calculated from per-hole par values in the scorecard editor. Stored for the course page.',
    }),
    defineField({
      name: 'ratings',
      title: 'Ratings by gender',
      type: 'object',
      fields: [
        defineField({
          name: 'men',
          title: "Men's",
          type: 'scorecardGenderRatings',
        }),
        defineField({
          name: 'women',
          title: "Women's",
          type: 'scorecardGenderRatings',
        }),
      ],
    }),
    defineField({
      name: 'courseRating',
      title: 'Course Rating (legacy)',
      type: 'string',
      hidden: true,
      readOnly: true,
      deprecated: {
        reason: "Moved to ratings.men — kept for legacy documents.",
      },
    }),
    defineField({
      name: 'slopeRating',
      title: 'Slope Rating (legacy)',
      type: 'string',
      hidden: true,
      readOnly: true,
      deprecated: {
        reason: "Moved to ratings.men — kept for legacy documents.",
      },
    }),
  ],
})
