import { Response } from "express";

export function successResponse(res: Response, message: string, data?: any, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function errorResponse(res: Response, message: string, errorCode: string, errorDetails?: any, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code: errorCode,
      details: errorDetails,
    },
  });
}
