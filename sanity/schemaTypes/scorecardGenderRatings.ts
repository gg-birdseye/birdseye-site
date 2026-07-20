import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'scorecardGenderRatings',
  title: 'Course & slope ratings',
  type: 'object',
  fields: [
    defineField({
      name: 'courseRating',
      title: 'Course Rating',
      type: 'string',
      description: 'USGA course rating (e.g. 72.4).',
    }),
    defineField({
      name: 'slopeRating',
      title: 'Slope Rating',
      type: 'string',
      description: 'USGA slope rating (e.g. 135).',
    }),
  ],
})
