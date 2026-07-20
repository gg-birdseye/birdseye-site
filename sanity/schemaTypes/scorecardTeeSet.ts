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
      description: 'e.g. Red, White, Blue',
    }),
    defineField({
      name: 'color',
      title: 'Tee Color',
      type: 'string',
      description: 'Hex color used on the scorecard chart for this tee (e.g. #CF8018).',
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return true
          return /^#[0-9A-Fa-f]{6}$/.test(value)
            ? true
            : 'Use a 6-digit hex color like #CF8018'
        }),
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
