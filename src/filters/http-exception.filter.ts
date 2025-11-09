import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error?: string;
  details?: unknown;
}

interface HttpExceptionResponse {
  message?: string | string[];
  error?: string;
}

interface UnknownError {
  message?: string;
  code?: string;
  statusCode?: number;
  body?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const response = ctx.getResponse() as {
      status: (code: number) => {
        json: (body: unknown) => void;
      };
    };
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const request = ctx.getRequest() as {
      url: string;
      method: string;
    };

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error: string | undefined = undefined;
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const responseObj = exceptionResponse as HttpExceptionResponse;
        if (typeof responseObj.message === 'string') {
          message = responseObj.message;
        } else if (Array.isArray(responseObj.message)) {
          message = responseObj.message.join(', ');
        }
        if (responseObj.error !== undefined) {
          error = responseObj.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      details = {
        name: exception.name,
        stack: exception.stack,
      };
    } else if (typeof exception === 'object' && exception !== null) {
      const errorObj = exception as UnknownError;
      if (errorObj.message !== undefined) {
        message = errorObj.message;
      }
      if (errorObj.statusCode !== undefined) {
        status = errorObj.statusCode;
      }
      if (errorObj.code !== undefined) {
        error = errorObj.code;
      }
      if (errorObj.body !== undefined) {
        details = errorObj.body;
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    if (error !== undefined) {
      errorResponse.error = error;
    }
    if (details !== undefined) {
      errorResponse.details = details;
    }

    const statusResponse: { json: (body: unknown) => void } = response.status(status);
    statusResponse.json(errorResponse);
  }
}
