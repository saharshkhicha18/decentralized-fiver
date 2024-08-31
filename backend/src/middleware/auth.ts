import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config/config";

const jwtSecretWorker = config.jwtSecret + "_worker";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"] ?? "";
    try {
        const decoded = jwt.verify(authHeader, config.jwtSecret);
        //@ts-ignore
        if (decoded.userId) {
            //@ts-ignore
            req.userId = decoded.userId;
            return next(); // passing the req.userId to the next function in the get/post request
        }
    } catch(e) {
        return res.status(403).json({ message: "User not logged in" });
    }

}

export function authWorkerMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"] ?? "";
    try {
        const decoded = jwt.verify(authHeader, jwtSecretWorker);
        //@ts-ignore
        if (decoded.userId) {
            //@ts-ignore
            req.userId = decoded.userId;
            return next(); // passing the req.userId to the next function in the get/post request
        }
    } catch(e) {
        return res.status(403).json({ message: "User not logged in" });
    }

}