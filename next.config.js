/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    S3_BUCKET: process.env.S3_BUCKET || "image-processor-manual-755289",
    SQS_QUEUE_URL:
      process.env.SQS_QUEUE_URL ||
      "https://sqs.us-east-1.amazonaws.com/755289151223/image-processor-jobs-manual",
    DYNAMODB_TABLE: process.env.DYNAMODB_TABLE || "image-processor-jobs-manual",
  },
};
module.exports = nextConfig;
