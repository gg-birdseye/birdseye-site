import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'holeScorecard',
  title: 'Hole Scorecard',
  type: 'object',
  fields: [
    defineField({
      name: 'holeNumber',
      title: 'Hole',
      type: 'number',
      readOnly: true,
      validation: (Rule) => Rule.required().min(1).max(27),
    }),
    defineField({
      name: 'tees',
      title: 'Tees',
      type: 'array',
      of: [{ type: 'scorecardTeeEntry' }],
    }),
    defineField({
      name: 'par',
      title: 'Legacy par (per hole)',
      type: 'scorecardGenderValues',
      hidden: true,
      readOnly: true,
      deprecated: {
        reason: 'Moved to tees[].par — kept for legacy documents.',
      },
    }),
    defineField({
      name: 'yardage',
      title: 'Legacy yardage',
      type: 'string',
      hidden: true,
      readOnly: true,
      deprecated: {
        reason: 'Moved to tees array — kept for legacy documents.',
      },
    }),
    defineField({
      name: 'handicap',
      title: 'Legacy handicap',
      type: 'string',
      hidden: true,
      readOnly: true,
      deprecated: {
        reason: 'Moved to tees array — kept for legacy documents.',
      },
    }),
  ],
  preview: {
    select: {
      holeNumber: 'holeNumber',
      tee0ParMen: 'tees.0.par.men',
      tee0Yardage: 'tees.0.yardage',
      tee0HandicapMen: 'tees.0.handicap.men',
      yardage: 'yardage',
      handicap: 'handicap',
      parMen: 'par.men',
    },
    prepare({
      holeNumber,
      tee0ParMen,
      tee0Yardage,
      tee0HandicapMen,
      yardage,
      handicap,
      parMen,
    }) {
      const y = tee0Yardage ?? yardage
      const h = tee0HandicapMen ?? handicap
      const p = tee0ParMen ?? parMen
      const parts = [
        p ? `Par ${p}` : null,
        y ? `${y} yds` : null,
        h ? `HDCP ${h}` : null,
      ].filter(Boolean)
      return {
        title: `Hole ${holeNumber ?? '?'}`,
        subtitle: parts.length ? parts.join(' · ') : 'No yardage or handicap yet',
      }
    },
  },
})
