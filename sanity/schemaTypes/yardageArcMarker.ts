import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'yardageArcMarker',
  title: 'Yardage Arc Marker',
  type: 'object',
  fields: [
    defineField({
      name: 'x',
      title: 'Horizontal position (%)',
      type: 'number',
      validation: (Rule) => Rule.required().min(0).max(100),
    }),
    defineField({
      name: 'y',
      title: 'Vertical position (%)',
      type: 'number',
      validation: (Rule) => Rule.required().min(0).max(100),
    }),
    defineField({
      name: 'yards',
      title: 'Yards to pin',
      type: 'number',
      validation: (Rule) => Rule.required().min(1).max(700),
    }),
  ],
  preview: {
    select: { yards: 'yards', x: 'x', y: 'y' },
    prepare({ yards, x, y }) {
      const yardsLabel = typeof yards === 'number' ? `${yards} yds` : '—'
      const xLabel = typeof x === 'number' ? `${x}%` : '—'
      const yLabel = typeof y === 'number' ? `${y}%` : '—'
      return {
        title: yardsLabel,
        subtitle: `${xLabel}, ${yLabel}`,
      }
    },
  },
})
