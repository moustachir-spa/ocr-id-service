import { Job } from "bullmq";
import type { OcrJobStatus, OcrResult, OcrScanInput } from "@ocr-id-service/contracts";
export interface RedisConnection {
    host: string;
    port: number;
    db?: number;
    username?: string;
    password?: string;
    tls?: Record<string, never>;
}
export interface OcrIdClientOptions {
    redisUrl: string;
    queueName?: string;
    prefix?: string;
}
export interface SubmitScanOptions extends OcrScanInput {
    jobId?: string;
    attempts?: number;
}
/** Parse redis:// or rediss:// URLs into the connection shape shared by BullMQ. */
export declare function redisConnection(redisUrl: string): RedisConnection;
/** BullMQ client for submitting scans and waiting for Python worker results. */
export declare class OcrIdClient {
    private readonly queue;
    private readonly events;
    private readonly queueName;
    constructor(options: OcrIdClientOptions);
    submitScan(input: SubmitScanOptions): Promise<Job>;
    waitForResult(jobId: string, timeoutMs?: number): Promise<OcrResult>;
    getStatus(jobId: string): Promise<OcrJobStatus>;
    close(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map