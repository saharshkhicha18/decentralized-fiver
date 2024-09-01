import AWS from 'aws-sdk'
import config from '../config/config';
import httpStatus from 'http-status';
import ApiError from './ApiError';

class S3Manager {
    s3;

    bucketInfo = {
        Bucket: 'decentralized-fiver-app',
        ContentType: 'image/*'
    }

    constructor() {
        AWS.config.update({ region: 'ap-southeast-1' });
        this.s3 = new AWS.S3({
            accessKeyId: config.awsAccessKey,
            secretAccessKey: config.awsSecretKey,
            signatureVersion: 'v4',
        });
    }

    generateSignedURL(
        userId: string
    ) {
        try {
            const key = `fiver/${userId}/${Math.random()}/image`;
            const preSignedUrl = this.s3.getSignedUrl('putObject', {
                ...this.bucketInfo,
                Key: key,
                Expires: 60 * 5
            })

            return { preSignedUrl, key }
        } catch(error: any) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `S3 bucket error: ${error.message}`);
        }
    }
}

export default S3Manager;