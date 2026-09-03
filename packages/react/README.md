# @ocr-id-service/react

Framework-neutral React hooks for non-blocking identity-document OCR. The package does not connect to Redis and does not assume REST, NestJS, tRPC, or any other backend framework.

Pass an `IdentityOcrTransport` implementation to `useIdentityOcr()`. The host application owns authentication, file upload, backend API calls, and authorization.
