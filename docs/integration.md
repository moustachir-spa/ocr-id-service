# Application integration

The Python worker is deployed once as a standalone CPU-only Docker service. Application backends submit BullMQ jobs through Redis and expose their own authenticated API or RPC methods to their frontend. Redis is never accessed from a browser.

## Backend package

Install `@ocr-id-service/node` in any Node.js backend. It is framework-neutral and can be used inside NestJS, tRPC procedures, Express handlers, or a worker service. The backend should translate its own authenticated request into `submitScan()`, persist the `jobId`, and expose a status operation that calls `getStatus()`.

## React package

Install `@ocr-id-service/react` and implement `IdentityOcrTransport` in the host application. A NestJS application can implement the transport with `fetch()` against its controller. A tRPC application can implement the same two methods with its tRPC mutation and query. The React hook then remains identical in both applications.

```ts
const transport: IdentityOcrTransport = {
  submit: (input) => trpc.identityOcr.submit.mutate({ file: input.file, userId: input.userId }),
  status: (jobId) => trpc.identityOcr.status.query({ jobId }),
};
```

The exact tRPC file serialization and authentication setup belongs to the host application; the package intentionally does not impose it.

## npm versus submodule

Use npm packages for released integrations and versioned upgrades. A Git submodule is reasonable for `moustachir-v4` during active co-development when the team wants to pin the OCR repository at an exact commit, but the application still needs a small tRPC transport adapter. Once the APIs stabilize, consuming the published packages is simpler than maintaining a submodule.
