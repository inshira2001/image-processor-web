import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const region = process.env.AWS_REGION || "us-east-1";
const s3 = new S3Client({ region });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { contentType = "image/jpeg" } = req.body;
  const jobId = randomUUID();
  const inputKey = `uploads/${jobId}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: inputKey,
      ContentType: contentType,
    }),
    { expiresIn: 300 }
  );

  await ddb.send(
    new PutCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Item: { jobId, status: "PENDING", inputKey, createdAt: Date.now() },
    })
  );

  res.json({ jobId, uploadUrl, inputKey });
}
