// aws.service.js
const AWS = require('aws-sdk');
const { createLogger } = require('../utils/logger');
const { AWS_CONFIG } = require('../config/awsConfig');

const logger = createLogger('AWSService');

class AWSService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: AWS_CONFIG.accessKeyId,
      secretAccessKey: AWS_CONFIG.secretAccessKey,
      region: AWS_CONFIG.region
    });
  }

  async uploadFile(file, path) {
    try {
      const params = {
        Bucket: AWS_CONFIG.bucketName,
        Key: `${path}/${file.originalname}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'private'
      };

      const result = await this.s3.upload(params).promise();
      return result.Location;
    } catch (error) {
      logger.error('File upload error:', error);
      throw error;
    }
  }

  async getSignedUrl(key, expiryTime = 3600) {
    try {
      const params = {
        Bucket: AWS_CONFIG.bucketName,
        Key: key,
        Expires: expiryTime
      };

      return await this.s3.getSignedUrlPromise('getObject', params);
    } catch (error) {
      logger.error('Signed URL generation error:', error);
      throw error;
    }
  }

  async deleteFile(key) {
    try {
      const params = {
        Bucket: AWS_CONFIG.bucketName,
        Key: key
      };

      await this.s3.deleteObject(params).promise();
      return true;
    } catch (error) {
      logger.error('File deletion error:', error);
      throw error;
    }
  }
}

module.exports = new AWSService();