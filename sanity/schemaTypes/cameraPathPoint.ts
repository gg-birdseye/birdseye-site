import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'cameraPathPoint',
  title: 'Camera Path Point',
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
  ],
  preview: {
    select: { x: 'x', y: 'y' },
    prepare({ x, y }) {
      const xLabel = typeof x === 'number' ? `${x}%` : '—'
      const yLabel = typeof y === 'number' ? `${y}%` : '—'
      return {
        title: 'Path point',
        subtitle: `${xLabel}, ${yLabel}`,
      }
    },
  },
})
