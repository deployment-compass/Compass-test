// src/observability/correlation-id.middleware.ts
//
// Reads X-Correlation-ID if a caller supplied one, otherwise generates a
// fresh one, attaches it to the request, and echoes it back in the
// response header. Same role as the Go CorrelationIDMiddleware.
//

import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

// Augment Express's Request type so req.correlationId is typed everywhere
declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header(CORRELATION_ID_HEADER);
    const correlationId = incoming && incoming.length > 0 ? incoming : uuidv4();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}
