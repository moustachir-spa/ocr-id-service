import { Queue, QueueEvents } from "bullmq";
import { existsSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

type DocumentType = "national_id" | "passport" | "driving_license" | "unknown";

interface OCRResult {
  success: boolean;
  confidence: number;
  fields: {
    document_type: DocumentType;
    document_type_confidence: number;
    first_name: string | null;
    last_name: string | null;
    arabic_name: string | null;
    birth_date: string | null;
    birth_place: string | null;
    gender: string | null;
    nin: string | null;
    document_number: string | null;
  };
  processing_time_ms: number;
  error: string | null;
}

interface QueueTestResult {
  job_id: string;
  success: boolean;
  document: {
    type: DocumentType;
    confidence: number;
    recognized: boolean;
  };
  fields: Omit<OCRResult["fields"], "document_type" | "document_type_confidence">;
  ocr_confidence: number;
  processing_time_ms: number;
  error: string | null;
}

interface Arguments {
  imagePath: string;
  redisUrl: string;
  queueName: string;
  inputDir: string;
  timeoutMs: number;
}

function usage(): never {
  console.error(
    "Usage: pnpm test:queue -- data/input/card.jpg [--redis-url redis://localhost:6379/0] [--queue algerian-id-ocr] [--timeout-ms 300000]",
  );
  process.exit(1);
}

function parseArguments(argv: string[]): Arguments {
  const values = argv[0] === "--" ? [...argv.slice(1)] : [...argv];
  const imagePath = values.shift();
  if (!imagePath || imagePath.startsWith("-")) usage();

  const getOption = (name: string, fallback: string): string => {
    const index = values.indexOf(name);
    if (index === -1) return fallback;
    const value = values[index + 1];
    if (!value || value.startsWith("-")) usage();
    values.splice(index, 2);
    return value;
  };

  const redisUrl = getOption("--redis-url", process.env.REDIS_URL ?? "redis://localhost:6379/0");
  const queueName = getOption("--queue", process.env.BULLMQ_QUEUE ?? "algerian-id-ocr");
  const inputDir = getOption("--input-dir", process.env.OCR_INPUT_DIR ?? "data/input");
  const timeoutMs = Number.parseInt(getOption("--timeout-ms", "300000"), 10);
  if (values.length > 0 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) usage();

  return { imagePath, redisUrl, queueName, inputDir, timeoutMs };
}

function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("Redis URL must start with redis:// or rediss://");
  }
  const database = url.pathname === "/" ? 0 : Number.parseInt(url.pathname.slice(1), 10);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error("Redis URL database must be a non-negative integer");
  }
  return {
    host: url.hostname,
    port: Number.parseInt(url.port || "6379", 10),
    username: url.username || undefined,
    password: url.password || undefined,
    db: database,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

function workerVisiblePath(imagePath: string, inputDir: string): string {
  const inputRoot = resolve(inputDir);
  const source = resolve(imagePath);
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Image does not exist: ${source}`);
  }
  const workerPath = relative(inputRoot, source);
  if (!workerPath || workerPath === ".." || workerPath.startsWith(`..${sep}`)) {
    throw new Error(`Image must be inside ${inputRoot} so the worker can read its path`);
  }
  return workerPath.split(sep).join("/");
}

function queueTestResult(jobId: string, result: OCRResult): QueueTestResult {
  const { document_type, document_type_confidence, ...fields } = result.fields;
  return {
    job_id: jobId,
    success: result.success,
    document: {
      type: document_type,
      confidence: document_type_confidence,
      recognized: document_type !== "unknown" && document_type_confidence >= 0.8,
    },
    fields,
    ocr_confidence: result.confidence,
    processing_time_ms: result.processing_time_ms,
    error: result.error,
  };
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2));
  const connection = redisConnection(args.redisUrl);
  const imagePath = workerVisiblePath(args.imagePath, args.inputDir);
  const queue = new Queue(args.queueName, { connection });
  const events = new QueueEvents(args.queueName, { connection });

  try {
    await events.waitUntilReady();
    const job = await queue.add(
      "scan-id",
      { image_path: imagePath },
      { removeOnComplete: false, removeOnFail: false },
    );
    console.log(`Queued ${job.id} for ${imagePath}; waiting for the OCR worker...`);

    const result = (await job.waitUntilFinished(events, args.timeoutMs)) as OCRResult;
    console.log(JSON.stringify(queueTestResult(job.id ?? "unknown", result), null, 2));
    if (!result.success) process.exitCode = 2;
  } finally {
    await events.close();
    await queue.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
