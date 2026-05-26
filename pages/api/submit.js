import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { jobId, inputKey, filter } = req.body;
  if (!jobId || !inputKey || !filter) return res.status(400).json({ error: "Missing fields" });

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify({ jobId, inputKey, filter }),
    })
  );

  res.json({ ok: true, jobId });
}
