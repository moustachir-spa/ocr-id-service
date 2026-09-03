import { Queue, QueueEvents } from "bullmq";
/** Parse redis:// or rediss:// URLs into the connection shape shared by BullMQ. */
export function redisConnection(redisUrl) {
    const url = new URL(redisUrl);
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
        throw new Error("Redis URL must start with redis:// or rediss://");
    }
    const db = Number.parseInt(url.pathname.slice(1) || "0", 10);
    if (!Number.isInteger(db) || db < 0)
        throw new Error("Redis database must be a non-negative integer");
    return {
        host: url.hostname,
        port: Number.parseInt(url.port || "6379", 10),
        db,
        username: url.username || undefined,
        password: url.password || undefined,
        ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    };
}
function toWorkerInput(input) {
    if (!input.imagePath && !input.imageBase64)
        throw new Error("imagePath or imageBase64 is required");
    if (input.imagePath && input.imageBase64)
        throw new Error("Provide only one image source");
    return {
        ...(input.imagePath ? { image_path: input.imagePath } : {}),
        ...(input.imageBase64 ? { image_base64: input.imageBase64 } : {}),
        ...(input.requestId ? { request_id: input.requestId } : {}),
        ...(input.userId ? { user_id: input.userId } : {}),
        ...(input.documentId ? { document_id: input.documentId } : {}),
        ...(input.documentSide ? { document_side: input.documentSide } : {}),
        ...(input.schemaVersion ? { schema_version: input.schemaVersion } : {}),
    };
}
/** BullMQ client for submitting scans and waiting for Python worker results. */
export class OcrIdClient {
    queue;
    events;
    queueName;
    constructor(options) {
        this.queueName = options.queueName ?? "algerian-id-ocr";
        const connection = redisConnection(options.redisUrl);
        this.queue = new Queue(this.queueName, { connection, prefix: options.prefix });
        this.events = new QueueEvents(this.queueName, { connection, prefix: options.prefix });
    }
    async submitScan(input) {
        const { jobId, attempts = 2, ...scan } = input;
        const jobOptions = {
            ...(jobId ? { jobId } : {}),
            attempts,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: { age: 86400, count: 1000 },
            removeOnFail: { age: 604800, count: 1000 },
        };
        return this.queue.add("scan-id", toWorkerInput(scan), jobOptions);
    }
    async waitForResult(jobId, timeoutMs = 300000) {
        await this.events.waitUntilReady();
        const job = await this.queue.getJob(jobId);
        if (!job)
            throw new Error(`OCR job ${jobId} was not found`);
        return (await job.waitUntilFinished(this.events, timeoutMs));
    }
    async getStatus(jobId) {
        const job = await this.queue.getJob(jobId);
        if (!job)
            return { jobId, state: "failed", error: "Job not found" };
        const state = await job.getState();
        if (state === "completed")
            return { jobId, state, result: job.returnvalue };
        if (state === "failed")
            return { jobId, state, error: job.failedReason };
        return { jobId, state: state === "active" ? "processing" : "queued" };
    }
    async close() {
        await Promise.all([this.events.close(), this.queue.close()]);
    }
}
