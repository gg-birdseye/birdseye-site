import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'relatedCourseSelection',
  title: 'Related Course',
  type: 'object',
  fields: [
    defineField({
      name: 'course',
      title: 'Course',
      type: 'reference',
      to: [{ type: 'course' }],
      options: {
        disableNew: true,
      },
    }),
  ],
  preview: {
    select: {
      title: 'course.title',
    },
    prepare({ title }) {
      return {
        title: title || 'Course not selected',
      }
    },
  },
})
