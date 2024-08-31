import z from 'zod'

export const createSubmissionInput = z.object({
    selection: z.string(),
    taskId: z.string()
})