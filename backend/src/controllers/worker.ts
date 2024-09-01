import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import bs58 from "bs58";
import jwt from "jsonwebtoken";
import catchAsync from "../utils/catchAsync";
import config from "../config/config";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import { getNextTask } from "../service/worker";
import { createSignInInput, createSubmissionInput } from "../validations/worker";
import nacl from "tweetnacl";
import { Connection, SystemProgram, PublicKey, Transaction, Keypair, sendAndConfirmTransaction } from "@solana/web3.js";
import { privateKey } from '../privateKey';

const MAX_TOTAL_SUBMISSIONS = 100;
const connection = new Connection(config.rpcUrl ?? "");

const prismaClient = new PrismaClient();
const jwtSecretWorker = config.jwtSecret + "_worker";

const signin = catchAsync(async (req: Request, res: Response) => {
    const body = req.body;
    const parseData = createSignInInput.safeParse(body)

    if (!parseData.success) {
        throw new ApiError(httpStatus.LENGTH_REQUIRED, "Something went wrong in signin")
    }
    const message = new TextEncoder().encode("Sign into dFiver as a worker");

    console.log(parseData)
    const result = nacl.sign.detached.verify(
        message,
        new Uint8Array(parseData.data.signature.data),
        new PublicKey(parseData.data.publicKey).toBytes(),
    );

    if (!result) {
        throw new ApiError(httpStatus.LENGTH_REQUIRED, "Incorrect Signature")
    }

    const existingUser = await prismaClient.worker.findFirst({
        where: {
            address: parseData.data.publicKey
        }
    })

    if (existingUser) {
        const token = jwt.sign({
            userId: existingUser.id
        }, jwtSecretWorker)

        res.json({
            token,
            amount: existingUser.pending_amount / config.totalDecimals
        })
    } else {
        const user = await prismaClient.worker.create({
            data: {
                address: parseData.data.publicKey,
                pending_amount: 0,
                locked_amount: 0
            }
        });

        const token = jwt.sign({
            userId: user.id
        }, jwtSecretWorker)

        res.json({
            token,
            amount: 0
        })
    }
})

const nextTask = catchAsync(async (req: Request, res: Response) => {
    //@ts-ignore
    const userId: string = req.userId;
    console.log(userId)

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
        console.log(userId)
        const task = await getNextTask(Number(userId))
        console.log(task, parsedBody)
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

    // logic to create a tx
    const transaction = new Transaction().add(
        SystemProgram.transfer({
            toPubkey: new PublicKey(worker.address),
            fromPubkey: new PublicKey("3J8i5KzS3cPij7QtdgAmgDZg9hUSFwm9fnuRrHMa7MNi"),
            lamports: 1000_000_000 * worker.pending_amount / config.totalDecimals,
        })
    );

    const keyPair = Keypair.fromSecretKey(bs58.decode(privateKey))

    // TODO: There's a double spending problem here
    // The user can request the withdrawal multiple times?
    let signature = "";
    try {
        signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [keyPair],
        );
    
     } catch(e) {
        return res.json({
            message: "Transaction failed"
        })
     }

     console.log(signature)

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
                signature
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