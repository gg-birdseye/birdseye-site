import { defineField, defineType } from 'sanity'

/** Shared men/women string pair (par, stroke index, etc.). */
export default defineType({
  name: 'scorecardGenderValues',
  title: "Men's / women's values",
  type: 'object',
  fields: [
    defineField({
      name: 'men',
      title: "Men's",
      type: 'string',
    }),
    defineField({
      name: 'women',
      title: "Women's",
      type: 'string',
    }),
  ],
})
