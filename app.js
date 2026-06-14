// ============================================
// BETMASTER - Main Application Configuration
// ============================================

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'mongo-sanitize';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

import { 
    notFoundHandler,
    handleUncaughtException,
    handleUnhandledRejection 
} from './Utils/errorHandler.js';

// Load environment variables
dotenv.config();

// Import custom modules
import CLOG from './Utils/Clog.js';
import ApiResponse from './Utils/responseHandler.js';
import { globalErrorHandler, AppError } from './Utils/errorHandler.js';

// Import routes
import router from './Routes/index.js';


// ES6 module dirname setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize express app
const app = express();

// ============================================
// 1. TRUST PROXY (Required for rate limiting behind proxy)
// ============================================
app.set('trust proxy', 1);

// ============================================
// 1. SECURITY MIDDLEWARES (First Layer)
// ============================================

// Set security HTTP headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", process.env.API_URL || '*'],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xssFilter: true,
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:8081', 'http:localhost:5000','http://127.0.0.1:5000','https://betmaser-server-initial.onrender.com'];
// CORS configuration
// const corsOptions = {
//     origin: function (origin, callback) {


//         // Allow requests with no origin (like mobile apps, curl, etc.)
//         if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
//             callback(null, true);
//         } else {
//             CLOG.warn('Blocked by CORS:', origin);
//             callback(new AppError('Not allowed by CORS', 403));
//         }
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//     allowedHeaders: [
//         'Content-Type',
//         'Authorization',
//         'X-Requested-With',
//         'X-Device-Id',
//         'X-Device-Type',
//         'X-App-Version',
//         'X-Location',
//     ],
//     exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
//     maxAge: 86400, // 24 hours
//     optionsSuccessStatus: 204,
// };
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            CLOG.warn('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Device-Id',
        'X-Device-Type',
        'X-App-Version',
        'X-Location',
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,
}));

// app.use(cors(corsOptions));

// Handle preflight requests
// app.options('/api/*', cors(corsOptions));

// ============================================
// 2. RATE LIMITING (Second Layer)
// ============================================

// Global rate limiter
const globalLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        code: 429,
        message: 'Too many requests, please try again later.',
        timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req, res) => {
        const ip = req.ip;
        keyGenerator: (req) => ipKeyGenerator(ip)

        return ip;
    },
    skip: (req) => {
        // Skip rate limiting for certain paths
        const skipPaths = ['/health', '/api/status', '/favicon.ico'];
        return skipPaths.includes(req.path);
    },
    handler: (req, res) => {
        CLOG.warn('Rate limit exceeded:', req.ip);
        res.status(429).json({
            success: false,
            code: 429,
            message: 'Too many requests, please try again later.',
            retryAfter: res.getHeader('Retry-After'),
            timestamp: new Date().toISOString(),
        });
    },
});

app.use(globalLimiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    message: {
        success: false,
        code: 429,
        message: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    // keyGenerator: (req, res) => {
    //     const ip = req.ip ||
    //         req.connection?.remoteAddress ||
    //         req.socket?.remoteAddress ||
    //         '127.0.0.1';

    //     if (ip.startsWith('::ffff:')) {
    //         return ip.substring(7);
    //     }

    //     return ip;
    // },
    keyGenerator: (req, res) => {
        const ip = req.ip;
        keyGenerator: (req) => ipKeyGenerator(ip)

        return ip;
    },
});

// Apply to auth routes specifically
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verify-otp', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// ============================================
// 3. DATA PARSING & SANITIZATION (Third Layer)
// ============================================

// Body parser with size limits
app.use(express.json({
    limit: process.env.MAX_BODY_SIZE || '10mb',
    verify: (req, res, buf) => {
        // Store raw body for webhook verification
        if (req.originalUrl.startsWith('/api/payments/webhook')) {
            req.rawBody = buf.toString();
        }
    }
}));

app.use(express.urlencoded({
    extended: true,
    limit: process.env.MAX_BODY_SIZE || '10mb'
}));

// Cookie parser
app.use(cookieParser(process.env.COOKIE_SECRET));

const sanitizeData = (req, res, next) => {
    if (req.body) {
        req.body = mongoSanitize(req.body);
    }
    if (req.params) {
        Object.keys(req.params).forEach(key => {
            req.params[key] = mongoSanitize(req.params[key]);
        });
    }
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            req.query[key] = mongoSanitize(req.query[key]);
        });
    }
    next();
};
app.use(sanitizeData);

// Custom sanitization middleware
app.use((req, res, next) => {
    // Remove any MongoDB operators
    if (req.body) {
        const sanitize = (obj) => {
            for (let key in obj) {
                if (key.startsWith('$') || key.includes('.')) {
                    delete obj[key];
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitize(obj[key]);
                }
            }
        };
        sanitize(req.body);
    }

    // Trim all string values
    if (req.body && typeof req.body === 'object') {
        const trimStrings = (obj) => {
            for (let key in obj) {
                if (typeof obj[key] === 'string') {
                    obj[key] = obj[key].trim();
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    trimStrings(obj[key]);
                }
            }
        };
        trimStrings(req.body);
    }

    next();
});

// ============================================
// 4. COMPRESSION & LOGGING (Fourth Layer)
// ============================================

// Gzip compression
app.use(compression({
    level: 6, // Compression level (0-9)
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
        // Don't compress if already compressed
        if (req.headers['x-no-compression']) {
            return false;
        }
        // Use compression filter
        return compression.filter(req, res);
    },
}));

// Request logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    // Combined format for production
    app.use(morgan('combined', {
        skip: (req) => req.url === '/health' || req.url === '/favicon.ico',
        stream: {
            write: (message) => CLOG.info(message.trim()),
        },
    }));
}

// ============================================
// 5. RESPONSE TIME & HEADERS (Fifth Layer)
// ============================================

// Add response time header
// app.use((req, res, next) => {
//     const startTime = Date.now();

//     // Add response time header on finish
//     res.on('finish', () => {
//         const duration = Date.now() - startTime;
//         res.setHeader('X-Response-Time', `${duration}ms`);

//         // Log slow requests
//         if (duration > 1000) {
//             CLOG.warn(`Slow request: ${req.method} ${req.url} - ${duration}ms`);
//         }
//     });

//     next();
// });
app.use((req, res, next) => {
    const startTime = Date.now();

    res.setHeader('X-Request-Start', startTime);

    res.on('finish', () => {
        const duration = Date.now() - startTime;

        if (duration > 1000) {
            CLOG.warn(
                `Slow request: ${req.method} ${req.url} - ${duration}ms`
            );
        }
    });

    next();
});

// Add security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Remove sensitive headers
    res.removeHeader('X-Powered-By');

    next();
});

// ============================================
// 6. STATIC FILES (Sixth Layer)
// ============================================

// Serve static files
app.use('/uploads', express.static(join(__dirname, 'uploads'), {
    maxAge: '7d',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        // Set cache control for images
        if (path.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
        }
    },
}));

// ============================================
// 7. API ROUTES (Seventh Layer)
// ============================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'BetMaster API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        memoryUsage: process.memoryUsage(),
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    const mongoose = require('mongoose');

    res.status(200).json({
        success: true,
        data: {
            server: 'running',
            database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        },
    });
});

// Mount API routes
app.use('/api/v1', router);
// app.use('/api/users', userRoutes);
// app.use('/api/wallet', walletRoutes);
// app.use('/api/games', gameRoutes);
// app.use('/api/bets', betRoutes);
// app.use('/api/transactions', transactionRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api/support', supportRoutes);
// app.use('/api/withdrawals', withdrawalRoutes);
// app.use('/api/payments', paymentRoutes);
// app.use('/api/banners', bannerRoutes);

// ============================================
// 8. 404 HANDLER (Eighth Layer)
// ============================================

app.use((req, res, next) => {
    const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
    next(error);
});

// ============================================
// 9. GLOBAL ERROR HANDLER (Ninth Layer)
// ============================================

app.use(globalErrorHandler);

// ============================================
// 10. UNHANDLED REJECTIONS & EXCEPTIONS
// ============================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    CLOG.error('UNHANDLED REJECTION! Shutting down...');
    CLOG.error('Reason:', reason);

    // Graceful shutdown
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    CLOG.error('UNCAUGHT EXCEPTION! Shutting down...');
    CLOG.error('Error:', error);

    // Graceful shutdown
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    }
});

// Handle SIGTERM signal
process.on('SIGTERM', () => {
    CLOG.info('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

// Handle SIGINT signal
process.on('SIGINT', () => {
    CLOG.info('SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

export default app;