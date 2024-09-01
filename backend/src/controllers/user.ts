import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config/config"
import S3Manager from "../utils/S3Manager";
import { createTaskInput, createSignInInput } from "../validations/user";
import ApiError from "../utils/ApiError";
import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import nacl from "tweetnacl";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

const DEFAULT_TITLE = "Please select the most clickable thumbnail"
const connection = new Connection(config.rpcUrl ?? "");
const TREASURY_WALLET_ADDRESS = "3J8i5KzS3cPij7QtdgAmgDZg9hUSFwm9fnuRrHMa7MNi";

const prismaClient = new PrismaClient();

// signin with wallet
// signing a message
const signin = catchAsync(async (req: Request, res: Response) => {
    const body = req.body;
    const parseData = createSignInInput.safeParse(body)

    if (!parseData.success) {
        throw new ApiError(httpStatus.LENGTH_REQUIRED, "Something went wrong in signin")
    }
    const message = new TextEncoder().encode("Sign into dFiver!");

    const result = nacl.sign.detached.verify(
        message,
        new Uint8Array(parseData.data.signature.data),
        new PublicKey(parseData.data.publicKey).toBytes(),
    );


    if (!result) {
        throw new ApiError(httpStatus.LENGTH_REQUIRED, "Incorrect Signature")
    }

    const existingUser = await prismaClient.user.findFirst({
        where: {
            address: parseData.data.publicKey
        }
    })

    if (existingUser) {
        const token = jwt.sign({
            userId: existingUser.id
        }, config.jwtSecret)

        res.json({
            token
        })
    } else {
        const user = await prismaClient.user.create({
            data: {
                address: parseData.data.publicKey,
            }
        })

        const token = jwt.sign({
            userId: user.id
        }, config.jwtSecret)

        res.json({
            token
        })
    }
})

const preSignedUrl = (req: Request, res: Response) => {
    //@ts-ignore
    const userId = req.userId
    const s3Manager = new S3Manager();
    const data = s3Manager.generateSignedURL(userId)
    res.json(data)
}

const createTask = catchAsync(async (req: Request, res: Response) => {
    //@ts-ignore
    const userId = req.userId
    //validate the input from user
    const body = req.body;

    const parseData = createTaskInput.safeParse(body)

    const user = await prismaClient.user.findFirst({
        where: {
            id: userId
        }
    })

    if (!parseData.success) {
        throw new ApiError(httpStatus.LENGTH_REQUIRED, "You have sent the wrong inputs")
    }

    // parse the signature here to ensure the person has paid correct amount
    const transaction = await connection.getTransaction(parseData.data.signature, {
        maxSupportedTransactionVersion: 1
    });

    console.log(connection, transaction);

    if (!transaction) throw new ApiError(httpStatus.LENGTH_REQUIRED, "Transaction not found. Try in sometime")

    // need a better way to verify here  --- parse the Bytes from the SystemProgram
    if ((transaction?.meta?.postBalances[1] ?? 0) - (transaction?.meta?.preBalances[1] ?? 0) !== 100000000) {
        throw new ApiError(httpStatus.LENGTH_REQUIRED, "Transaction signature/amount incorrect")
    }

    if (transaction?.transaction.message.getAccountKeys().get(1)?.toString() !== TREASURY_WALLET_ADDRESS) {
        throw new ApiError(httpStatus.LENGTH_REQUIRED, "Transaction sent to wrong address")
    }

    if (transaction?.transaction.message.getAccountKeys().get(0)?.toString() !== user?.address) {
        throw new ApiError(httpStatus.LENGTH_REQUIRED, "Transaction sent from wrong address")
    }
    // was this money paid by this user address or a different address?

    // parse the signature here to ensure the person has paid 0.1 SOL
    // const transaction = Transaction.from(parseData.data.signature);

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
    // @ts-ignore
    const taskId: string = req.query.taskId;
    // @ts-ignore
    const userId: string = req.userId;

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
        return res.status(411).json({
            message: "You dont have access to this task"
        })
    }

    // Todo: Can u make this faster?
    const responses = await prismaClient.submission.findMany({
        where: {
            task_id: Number(taskId)
        },
        include: {
            option: true
        }
    });

    const result: Record<string, {
        count: number;
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
    });

    res.json({
        result,
        taskDetails
    })
})

export default {
    signin,
    preSignedUrl,
    createTask,
    getTask
}