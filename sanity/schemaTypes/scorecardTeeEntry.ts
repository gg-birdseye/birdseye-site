import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'scorecardTeeEntry',
  title: 'Tee Entry',
  type: 'object',
  fields: [
    defineField({
      name: 'par',
      title: 'Par',
      type: 'scorecardGenderValues',
      description:
        "Par from this tee box (e.g. 4). May differ by gender or tee color.",
    }),
    defineField({
      name: 'yardage',
      title: 'Yardage',
      type: 'string',
    }),
    defineField({
      name: 'comboSourceTeeNumber',
      title: 'Combo source tee #',
      type: 'number',
      description:
        'For combo tee columns: which paired standard tee # this hole plays from (aerial yardage / landing zone).',
      validation: (Rule) => Rule.integer().min(1).max(6),
    }),
    defineField({
      name: 'handicap',
      title: 'Stroke index',
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
    }),
  ],
})
