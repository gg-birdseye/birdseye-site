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
    defineField({
      name: 'videoProgress',
      title: 'Video progress (%)',
      type: 'number',
      description:
        'How far through the flyover video this point should be. Start is 0%, end is 100%. Example: a midpoint at 30 means the tracker reaches this spot when the video is 30% complete.',
      validation: (Rule) => Rule.min(0).max(100),
    }),
  ],
  preview: {
    select: { x: 'x', y: 'y', videoProgress: 'videoProgress' },
    prepare({ x, y, videoProgress }) {
      const xLabel = typeof x === 'number' ? `${x}%` : '—'
      const yLabel = typeof y === 'number' ? `${y}%` : '—'
      const progressLabel =
        typeof videoProgress === 'number' && Number.isFinite(videoProgress)
          ? ` · ${videoProgress}% video`
          : ''
      return {
        title: 'Path point',
        subtitle: `${xLabel}, ${yLabel}${progressLabel}`,
      }
    },
  },
})
