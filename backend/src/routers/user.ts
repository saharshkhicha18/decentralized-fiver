import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = "saharsh_project"

const router = Router();

const prismaClient = new PrismaClient();

// signin with wallet
// signing a message
router.post("/signin", async (req, res) => {
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
        }, JWT_SECRET)

        res.json({ token })
    } else {
        const user = await prismaClient.user.create({
            data: {
                address: hardcodedWalletAddress,
            }
        })

        const token = jwt.sign({
            userId: user.id
        }, JWT_SECRET)

        res.json({ token })
    }
});

export default router;