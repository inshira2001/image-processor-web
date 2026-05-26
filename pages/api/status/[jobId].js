import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const s3 = new S3Client({ region });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

export default async function handler(req, res) {
  const { jobId } = req.query;

  const { Item } = await ddb.send(
    new GetCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Key: { jobId },
    })
  );

  if (!Item) return res.status(404).json({ error: "Job not found" });

  let outputUrl;
  if (Item.status === "DONE" && Item.outputKey) {
    outputUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: Item.outputKey }),
      { expiresIn: 3600 }
    );
  }

  res.json({ ...Item, outputUrl });
}
