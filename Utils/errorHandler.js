import CLOG from "./Clog.js";
import ApiResponse from "./responseHandler.js";

// Custom Error Classes
class AppError extends Error {
    constructor(message, statusCode, errors = null) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class NotFoundError extends AppError {
    constructor(message = 'Resource not found', errors = null) {
        super(message, 404, errors);
    }
}

class ValidationError extends AppError {
    constructor(message = 'Validation failed', errors = null) {
        super(message, 422, errors);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized access', errors = null) {
        super(message, 401, errors);
    }
}

class ForbiddenError extends AppError {
    constructor(message = 'Forbidden access', errors = null) {
        super(message, 403, errors);
    }
}

class BadRequestError extends AppError {
    constructor(message = 'Bad request', errors = null) {
        super(message, 400, errors);
    }
}

class ConflictError extends AppError {
    constructor(message = 'Conflict occurred', errors = null) {
        super(message, 409, errors);
    }
}

class TooManyRequestsError extends AppError {
    constructor(message = 'Too many requests', errors = null) {
        super(message, 429, errors);
    }
}

// Global Error Handler Middleware
const globalErrorHandler = (err, req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (res.headersSent) {
        CLOG.error('⚠️ Headers already sent, passing to default error handler');
        return next(err);
    }
    CLOG.error('Error:', err.message);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(422).json(ApiResponse.validationError(errors));
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
        return res.status(409).json(
            ApiResponse.error(message, 409)
        );
    }

    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json(
            ApiResponse.badRequest('Invalid ID format')
        );
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json(ApiResponse.unauthorized('Invalid token'));
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json(ApiResponse.unauthorized('Token expired'));
    }

    // Multer file upload errors
    if (err.name === 'MulterError') {
        return res.status(400).json(
            ApiResponse.badRequest(`File upload error: ${err.message}`)
        );
    }

    // Custom AppError
    if (err.isOperational) {
        return res.status(err.statusCode).json(
            ApiResponse.error(err.message, err.statusCode, err.errors)
        );
    }

    // MongoDB connection errors
    if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
        CLOG.error('Database connection error:', err);
        return res.status(503).json(
            ApiResponse.error('Database service unavailable', 503)
        );
    }

    // SyntaxError (invalid JSON)
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json(
            ApiResponse.badRequest('Invalid JSON in request body')
        );
    }

    // Unknown error
    CLOG.error('Unexpected Error:', err);
    return res.status(500).json(
        ApiResponse.error(
            isProduction ? 'Something went wrong' : err.message,
            500,
            isProduction ? null : { stack: err.stack }
        )
    );
};

// Async handler wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            // ✅ Log the error but pass to next error handler
            CLOG.error(`Async Handler Error: ${err.message}`);
            next(err);
        });
    };
};

// ✅ NEW: Not found handler (for 404 routes)
const notFoundHandler = (req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl} not found`));
};

// ✅ NEW: Uncaught exception handler
const handleUncaughtException = (error) => {
    CLOG.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
    CLOG.error('Error:', error.name, error.message);
    console.error(error.stack);

    // Graceful shutdown
    process.exit(1);
};

// ✅ NEW: Unhandled rejection handler
const handleUnhandledRejection = (reason, promise) => {
    CLOG.error('❌ UNHANDLED REJECTION! Shutting down...');
    CLOG.error('Reason:', reason?.message || reason);
    console.error(reason?.stack || reason);

    // Graceful shutdown
    process.exit(1);
};

export {
    AppError, NotFoundError, ValidationError, UnauthorizedError,
    ForbiddenError,
    BadRequestError,
    ConflictError,
    TooManyRequestsError,
    globalErrorHandler,
    asyncHandler,
    notFoundHandler,
    handleUncaughtException,
    handleUnhandledRejection
}
