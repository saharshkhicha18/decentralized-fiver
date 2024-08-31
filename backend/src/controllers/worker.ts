import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import catchAsync from "../utils/catchAsync";
import config from "../config/config";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { getNextTask } from "../service/worker";
import { createSubmissionInput } from "../validations/worker";

const MAX_TOTAL_SUBMISSIONS = 100;

const prismaClient = new PrismaClient();
const jwtSecretWorker = config.jwtSecret + "_worker";

const signin = catchAsync(async (req: Request, res: Response) => {
    //TODO: add sign verification logic here
    const hardcodedWalletAddress = "0.0.23456";

    const existingUser = await prismaClient.worker.findFirst({
        where: {
            address: hardcodedWalletAddress
        }
    })

    if (existingUser) {
        const token = jwt.sign({
            userId: existingUser.id
        }, jwtSecretWorker)

        res.json({ token })
    } else {
        const user = await prismaClient.worker.create({
            data: {
                address: hardcodedWalletAddress,
                pending_amount: 0,
                locked_amount: 0
            }
        })

        const token = jwt.sign({
            userId: user.id
        }, jwtSecretWorker)

        res.json({ token })
    }
})

const nextTask = catchAsync(async (req: Request, res: Response) => {
    //@ts-ignore
    const userId: string = req.userId;

    const task = await getNextTask(Number(userId))

    if (!task) throw new ApiError(httpStatus.BAD_REQUEST, "No more tasks left for you to review");
    res.json({
        task
    })
})

const submission = catchAsync(async (req: Request, res: Response) => {
    //@ts-ignore
    const userId = req.userId;
    const body = req.body;
    const parsedBody = createSubmissionInput.safeParse(body);

    if (parsedBody.success) {
        const task = await getNextTask(Number(userId))
        if (! task || task.id !== Number(parsedBody.data.taskId)) {
            throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect task id");
        }

        const amount = task.amount / MAX_TOTAL_SUBMISSIONS

        await prismaClient.$transaction(async tx => {
            const submission = await tx.submission.create({
                data: {
                    option_id: Number(parsedBody.data.selection),
                    worker_id: Number(userId),
                    task_id: Number(parsedBody.data.taskId),
                    amount
                }
            })

            await tx.worker.update({
                where: {
                    id: userId
                },
                data: {
                    pending_amount: {
                        increment: amount
                    }
                }
            })

            return submission;
        })

        const nextTask = await getNextTask(Number(userId))

        res.json({
            amount,
            nextTask
        })
    } else {

    }

    const task = await getNextTask(Number(userId))
})

const balance = catchAsync(async(req: Request, res: Response) => {
    //@ts-ignore
    const userId: string = req.userId;
    
    const worker = await prismaClient.worker.findFirst({
        where: {
            id: Number(userId)
        }
    })

    res.json({
        pendingAmount: worker?.pending_amount,
        lockedAmount: worker?.locked_amount
    })
})

const payout = catchAsync(async(req: Request, res: Response) => {
    //@ts-ignore
    const userId: string = req.userId;
    
    const worker = await prismaClient.worker.findFirst({
        where: {
            id: Number(userId)
        }
    })
    if (!worker) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Worker not found")
    
    const address = worker.address

    // logic to create a tx
    const txId = "0X1234"

    // need to add a lock here
    await prismaClient.$transaction(async (tx) => {
        await tx.worker.update({
            where: {
                id: Number(userId)
            },
            data: {
                pending_amount: {
                    decrement: worker.pending_amount
                },
                locked_amount: {
                    increment: worker.pending_amount
                }
            }
        })

        await tx.payouts.create({
            data: {
                user_id: Number(userId),
                amount: worker.pending_amount,
                status: "Processing",
                signature: txId
            }
        })
    })

    //send transaction to blockchain

    res.json({
        message: "Processing payout",
        amount: worker.pending_amount
    })
})

export default {
    signin,
    nextTask,
    submission,
    balance,
    payout
}