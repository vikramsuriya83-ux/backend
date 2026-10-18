import { AppError } from "../utils/AppError.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: `No route found for ${req.method} ${req.path}`,
    },
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  const statusCode = err instanceof AppError ? err.statusCode : err.statusCode || 500;
  const isTimeout =
    err.code === "ECONNABORTED" || err.code === "ETIMEDOUT" || err.code === "ENOTFOUND";

  let message = err.message || "Unexpected server error";
  let status = statusCode;

  if (isTimeout) {
    status = 504;
    message = "An external API did not respond in time. Please try again.";
  }

  if (err.response?.status === 429) {
    status = 429;
    message = "The external API rate limit was reached. Please wait and retry.";
  }

  res.status(status).json({
    success: false,
    error: {
      message,
      details: err instanceof AppError ? err.details : undefined,
    },
  });
}

export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
