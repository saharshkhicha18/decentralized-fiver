import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config/config"
import S3Manager from "../utils/S3Manager";
import { createTaskInput } from "../validations/user";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";

const prismaClient = new PrismaClient();

const DEFAULT_TITLE = "Please select the most clickable thumbnail"

// signin with wallet
// signing a message
const signin = catchAsync(async (req: Request, res: Response) => {
    //TODO: add sign verification logic here
    const hardcodedWalletAddress = "0.0.1532012";

    const existingUser = await prismaClient.user.findFirst({
        where: {
            address: hardcodedWalletAddress
        }
    })

    if (existingUser) {
        const token = jwt.sign({
            userId: existingUser.id
        }, config.jwtSecret)

        res.json({ token })
    } else {
        const user = await prismaClient.user.create({
            data: {
                address: hardcodedWalletAddress,
            }
        })

        const token = jwt.sign({
            userId: user.id
        }, config.jwtSecret)

        res.json({ token })
    }
})

const preSignedUrl = (req: Request, res: Response) => {
    //@ts-ignore
    const userId = req.userId
    const s3Manager = new S3Manager();
    const preSignedUrl = s3Manager.generateSignedURL(userId, '1')
    res.json(preSignedUrl)
}

const createTask = catchAsync(async (req: Request, res: Response) => {
    //@ts-ignore
    const userId = req.userId
    //validate the input from user
    const body = req.body;

    const parseData = createTaskInput.safeParse(body)

    if (!parseData.success) {
        throw new ApiError(httpStatus.LENGTH_REQUIRED, "You have sent the wrong inputs")
    }

    // parse the signature here to ensure the person has paid correct amount
    console.log(config.totalDecimals)

    let response = await prismaClient.$transaction(async tx => {
        const response = await tx.task.create({
            data: {
                title: parseData.data.title ?? DEFAULT_TITLE,
                amount: 1 * config.totalDecimals,
                signature: parseData.data.signature,
                user_id: userId
            }
        })

        await tx.option.createMany({
            data: parseData.data.options.map(option => ({
                image_url: option.imageUrl,
                task_id: response.id
            }))
        })

        return response;
    })

    res.json({
        id: response.id,
    })
    
})

const getTask = catchAsync(async (req: Request, res: Response) => {
    //@ts-ignore
    const userId = req.userId;
    //@ts-ignore
    const taskId: string = req.query.taskId;

    const taskDetails = await prismaClient.task.findFirst({
        where: {
            user_id: Number(userId),
            id: Number(taskId)
        },
        include: {
            options: true
        }
    })

    if (!taskDetails) {
        throw new ApiError(httpStatus.BAD_REQUEST, "No such task")
    }

    //TODO: can you make this faster
    const responses = await prismaClient.submission.findMany({
        where: {
            task_id: Number(taskId)
        }, 
        include: {
            option: true
        }
    })

    const result: Record<string, {
        count: number,
        option: {
            imageUrl: string
        }
    }> = {};

    taskDetails.options.forEach(option => {
        result[option.id] = {
            count: 0,
            option: {
                imageUrl: option.image_url
            }
        }
    })
    responses.forEach(r => {
        result[r.option_id].count++;
    })

    res.json({result})
})

export default {
    signin,
    preSignedUrl,
    createTask,
    getTask
}