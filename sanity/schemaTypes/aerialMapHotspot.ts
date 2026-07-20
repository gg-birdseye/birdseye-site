import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'aerialMapHotspot',
  title: 'Aerial Map Hotspot',
  type: 'object',
  fields: [
    defineField({
      name: 'holeNumber',
      title: 'Hole',
      type: 'number',
      validation: (Rule) => Rule.required().integer().min(1),
    }),
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
  ],
  preview: {
    select: {
      holeNumber: 'holeNumber',
      x: 'x',
      y: 'y',
    },
    prepare({ holeNumber, x, y }) {
      const xLabel = typeof x === 'number' ? `${x}%` : '—'
      const yLabel = typeof y === 'number' ? `${y}%` : '—'
      return {
        title: holeNumber ? `Hole ${holeNumber}` : 'Hotspot',
        subtitle: `${xLabel}, ${yLabel}`,
      }
    },
  },
})
