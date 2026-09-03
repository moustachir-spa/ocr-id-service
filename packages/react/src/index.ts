import { useCallback, useEffect, useRef, useState } from "react";
import type { OcrJobStatus, OcrResult, OcrScanInput } from "@ocr-id-service/contracts";

/** Backend operations required by the React hook. Implement this with tRPC, REST, or another transport. */
export interface IdentityOcrTransport {
  submit(input: OcrScanInput & { file: File }): Promise<{ jobId: string }>;
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
export function useIdentityOcr(options: UseIdentityOcrOptions): UseIdentityOcrState {
  const { transport, pollIntervalMs = 2000 } = options;
  const [jobId, setJobId] = useState<string | null>(null);
  const [state, setState] = useState<UseIdentityOcrState["state"]>("idle");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const currentGeneration = generation.current;
    const poll = async (): Promise<void> => {
      try {
        const status = await transport.status(jobId);
        if (cancelled || currentGeneration !== generation.current) return;
        setState(status.state);
        if (status.result) setResult(status.result);
        if (status.state === "completed" || status.state === "manual_review" || status.state === "failed") {
          if (status.error) setError(status.error);
          return;
        }
        window.setTimeout(() => void poll(), pollIntervalMs);
      } catch (pollError: unknown) {
        if (!cancelled) setError(pollError instanceof Error ? pollError.message : "OCR status failed");
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [jobId, pollIntervalMs, transport]);

  const submit = useCallback(async (file: File, input: Omit<OcrScanInput, "imagePath" | "imageBase64"> = {}) => {
    generation.current += 1;
    setError(null);
    setResult(null);
    setState("queued");
    const submitted = await transport.submit({ ...input, file });
    setJobId(submitted.jobId);
    return submitted.jobId;
  }, [transport]);

  const reset = useCallback(() => {
    generation.current += 1;
    setJobId(null);
    setState("idle");
    setResult(null);
    setError(null);
  }, []);

  return { jobId, state, result, error, isProcessing: state === "queued" || state === "processing", submit, reset };
}

