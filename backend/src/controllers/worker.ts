import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import catchAsync from "../utils/catchAsync";
import config from "../config/config";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";

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
    const userId = req.userId;

    const task = await prismaClient.task.findFirst({
        where: {
            done: false,
            submissions: {
                none: {
                    worker_id: userId, 
                }
            }
        },
        select: {
            title: true,
            options: true
        }
    })

    if (!task) throw new ApiError(httpStatus.BAD_REQUEST, "No more tasks left for you to review");
    res.json({
        task
    })
})

export default {
    signin,
    nextTask
}