import { useCallback, useEffect, useRef, useState } from "react";
/** React state machine for a non-blocking scan submitted through an application backend. */
export function useIdentityOcr(options) {
    const { transport, pollIntervalMs = 2000 } = options;
    const [jobId, setJobId] = useState(null);
    const [state, setState] = useState("idle");
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const generation = useRef(0);
    useEffect(() => {
        if (!jobId)
            return;
        let cancelled = false;
        const currentGeneration = generation.current;
        const poll = async () => {
            try {
                const status = await transport.status(jobId);
                if (cancelled || currentGeneration !== generation.current)
                    return;
                setState(status.state);
                if (status.result)
                    setResult(status.result);
                if (status.state === "completed" || status.state === "manual_review" || status.state === "failed") {
                    if (status.error)
                        setError(status.error);
                    return;
                }
                window.setTimeout(() => void poll(), pollIntervalMs);
            }
            catch (pollError) {
                if (!cancelled)
                    setError(pollError instanceof Error ? pollError.message : "OCR status failed");
            }
        };
        void poll();
        return () => {
            cancelled = true;
        };
    }, [jobId, pollIntervalMs, transport]);
    const submit = useCallback(async (file, input = {}) => {
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
