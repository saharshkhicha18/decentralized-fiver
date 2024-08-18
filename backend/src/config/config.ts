import * as dotenv from "dotenv";
dotenv.config();
export default {
  env: process.env.ENV,
  port: process.env.PORT,
  awsAccessKey: process.env.AWS_ACCESS_KEY!,
  awsSecretKey: process.env.AWS_SECRET_KEY!,
  db: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!
};