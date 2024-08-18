import AWS from 'aws-sdk'
import config from '../config/config';
import httpStatus from 'http-status';
import ApiError from './ApiError';

class S3Manager {
    s3;

    bucketInfo = {
        Bucket: 'decentralized-fiver-app',
        ContentType: 'img/jpg'
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
        userId: string,
        imageName: string
    ) {
        try {
            const signedUrl = this.s3.getSignedUrl('putObject', {
                ...this.bucketInfo,
                Key: `fiver/${userId}/${imageName}`,
                Expires: 60 * 5
            })

            return signedUrl
        } catch(error: any) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `S3 bucket error: ${error.message}`);
        }
    }
}

export default S3Manager;