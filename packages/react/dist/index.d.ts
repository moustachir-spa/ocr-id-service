import type { OcrJobStatus, OcrResult, OcrScanInput } from "@ocr-id-service/contracts";
/** Backend operations required by the React hook. Implement this with tRPC, REST, or another transport. */
export interface IdentityOcrTransport {
    submit(input: OcrScanInput & {
        file: File;
    }): Promise<{
        jobId: string;
    }>;
    status(jobId: string): Promise<OcrJobStatus>;
}
export interface UseIdentityOcrOptions {
    transport: IdentityOcrTransport;
    pollIntervalMs?: number;
}
export interface UseIdentityOcrState {
    jobId: string | null;
    state: OcrJobStatus["state"] | "idle";
    result: OcrResult | null;
    error: string | null;
    isProcessing: boolean;
    submit: (file: File, input?: Omit<OcrScanInput, "imagePath" | "imageBase64">) => Promise<string>;
    reset: () => void;
}
/** React state machine for a non-blocking scan submitted through an application backend. */
export declare function useIdentityOcr(options: UseIdentityOcrOptions): UseIdentityOcrState;
//# sourceMappingURL=index.d.ts.map