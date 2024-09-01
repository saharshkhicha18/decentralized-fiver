import z from 'zod'

export const createSubmissionInput = z.object({
    selection: z.string(),
    taskId: z.string()
})

export const createSignInInput = z.object({
    publicKey: z.string(),
    signature: z.any()
})