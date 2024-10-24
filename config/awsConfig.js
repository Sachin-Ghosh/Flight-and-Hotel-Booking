// awsConfig.js
const AWS = require('aws-sdk');

const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1',
  s3: {
    bucketName: process.env.AWS_S3_BUCKET,
    uploadParams: {
      ACL: 'private',
      ContentType: 'application/pdf'
    },
    signedUrlExpiry: 60 * 60 // 1 hour
  },
  ses: {
    from: process.env.AWS_SES_FROM_EMAIL,
    region: process.env.AWS_SES_REGION || 'ap-south-1'
  }
};

// Initialize AWS SDK
AWS.config.update({
  accessKeyId: awsConfig.accessKeyId,
  secretAccessKey: awsConfig.secretAccessKey,
  region: awsConfig.region
});

module.exports = awsConfig;