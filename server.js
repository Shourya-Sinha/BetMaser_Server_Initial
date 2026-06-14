// ============================================
// BETMASTER - Server Entry Point
// ============================================

import dotenv from 'dotenv';

import dns from 'dns';

dns.setServers([
    '8.8.8.8',
    '8.8.4.4'
]);

console.log('DNS SERVERS:', dns.getServers());

dotenv.config();

// Load environment variables before anything else
dotenv.config();

import app from './app.js';
import mongoose from 'mongoose';
import { createServer } from 'http';
import CLOG from './Utils/Clog.js';
import { Setting } from './Models/index.js';
import healthMonitor from './Utils/healthMonitor.js';
import socketManager from './SocketServer.js';

// ============================================
// 1. CONFIGURATION
// ============================================

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/betmaster';


// MongoDB connection options
const mongooseOptions = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    // retryWrites: true,
    retryReads: true,
    // w: 'majority',
};

// ============================================
// 2. CREATE HTTP SERVER
// ============================================

const httpServer = createServer(app);

// ============================================
// 3. INITIALIZE SOCKET SERVER
// ============================================

const io = socketManager.initialize(httpServer);

// Make socket manager accessible globally
global.io = io;
global.socketManager = socketManager;

// ============================================
// 4. DATABASE CONNECTION
// ============================================

const connectDB = async () => {
    try {
        const connection = await mongoose.connect(MONGODB_URI, mongooseOptions);

        CLOG.divider();
        CLOG.success('✅ MongoDB Connected Successfully!');
        CLOG.info(`📦 Host: ${connection.connection.host}`);
        CLOG.info(`🗄️  Database: ${connection.connection.name}`);
        CLOG.info(`🔌 Port: ${connection.connection.port}`);
        CLOG.info(`🌍 Environment: ${NODE_ENV}`);
        CLOG.divider();

        // Initialize default settings
        await Setting.initializeDefaults();
        CLOG.success('⚙️  Default settings initialized');

        // MongoDB connection events
        mongoose.connection.on('error', (error) => {
            CLOG.error('❌ MongoDB connection error:', error);
        });

        mongoose.connection.on('disconnected', () => {
            CLOG.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            CLOG.success('✅ MongoDB reconnected');
        });

    } catch (error) {
        CLOG.error('❌ MongoDB connection failed:', error.message);
        CLOG.warn('🔄 Retrying connection in 5 seconds...');
        console.error('FULL MONGOOSE ERROR');
        console.error(error);
        setTimeout(connectDB, 5000);
    }
};

// ============================================
// 5. REDIS CONNECTION (Optional)
// ============================================

let redisClient = null;

const connectRedis = async () => {
    try {
        if (process.env.REDIS_URL) {
            const { Redis } = await import('ioredis');

            redisClient = new Redis(process.env.REDIS_URL, {
                maxRetriesPerRequest: 3,
                retryStrategy: (times) => {
                    if (times > 3) {
                        CLOG.error('❌ Redis retry limit reached');
                        return null;
                    }
                    return Math.min(times * 200, 2000);
                },
                reconnectOnError: (error) => {
                    return error.message.includes('READONLY');
                },
            });

            redisClient.on('connect', () => {
                CLOG.success('✅ Redis Connected Successfully!');
            });

            redisClient.on('error', (error) => {
                CLOG.warn('⚠️  Redis connection error (non-fatal):', error.message);
            });

            global.redis = redisClient;
        } else {
            CLOG.warn('⚠️  Redis URL not configured. Running without Redis.');
        }
    } catch (error) {
        CLOG.warn('⚠️  Redis connection failed (non-fatal):', error.message);
    }
};

// ============================================
// 6. AGENDA JOB SCHEDULER SETUP (Optional)
// ============================================

let agenda = null;

const setupAgenda = async () => {
    try {
        if (mongoose.connection.readyState === 1) {
            const { Agenda } = await import('agenda');

            agenda = new Agenda({
                mongo: mongoose.connection.db,
                db: { collection: 'agenda_jobs' },
                processEvery: '1 minute',
                maxConcurrency: 20,
                defaultConcurrency: 5,
            });

            // Define jobs
            agenda.define('reset-daily-limits', async (job) => {
                CLOG.info('🔄 Running daily reset job...');
                const { Wallet } = await import('./Models/index.js');
                await Wallet.updateMany({}, {
                    $set: {
                        'limits.dailyDeposit': 0,
                        'limits.dailyWithdrawal': 0,
                        'limits.dailyBetAmount': 0,
                        'lastResetDate.daily': new Date(),
                    },
                });
                CLOG.success('✅ Daily limits reset completed');
            });

            agenda.define('expire-old-notifications', async (job) => {
                CLOG.info('🔄 Running notification cleanup...');
                const { Notification } = await import('./Models/index.js');
                await Notification.deleteOldNotifications(30);
                CLOG.success('✅ Old notifications cleaned up');
            });

            agenda.define('update-game-stats', async (job) => {
                CLOG.info('🔄 Running game stats update...');
                // Update player statistics, rankings, etc.
            });

            agenda.define('health-check-report', async (job) => {
                CLOG.info('🔄 Running scheduled health check...');
                healthMonitor.logHealthReport();
            });

            agenda.define('cleanup-inactive-sessions', async (job) => {
                CLOG.info('🔄 Running session cleanup...');
                const { Security } = await import('./Models/index.js');
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                await Security.updateMany(
                    { 'activeSessions.lastActiveAt': { $lt: thirtyDaysAgo } },
                    { $pull: { activeSessions: { lastActiveAt: { $lt: thirtyDaysAgo } } } }
                );
                CLOG.success('✅ Inactive sessions cleaned up');
            });

            await agenda.start();

            // Schedule recurring jobs
            await agenda.every('0 0 * * *', 'reset-daily-limits'); // Daily at midnight
            await agenda.every('0 2 * * *', 'expire-old-notifications'); // Daily at 2 AM
            await agenda.every('*/30 * * * *', 'update-game-stats'); // Every 30 minutes
            await agenda.every('0 */6 * * *', 'health-check-report'); // Every 6 hours
            await agenda.every('0 3 * * *', 'cleanup-inactive-sessions'); // Daily at 3 AM

            CLOG.success('✅ Agenda job scheduler started');
        }
    } catch (error) {
        CLOG.warn('⚠️  Agenda setup failed (non-fatal):', error.message);
    }
};

// ============================================
// 7. START SERVER
// ============================================

const startServer = async () => {
    try {
        CLOG.divider();
        CLOG.info('🚀 Starting BetMaster Server...');
        CLOG.divider();

        // Connect to database
        console.log('MONGODB_URI =', process.env.MONGODB_URI);
        await connectDB();

        // Connect to Redis (optional)
        await connectRedis();

        // Setup job scheduler (optional)
        await setupAgenda();

        // Start HTTP server
        httpServer.listen(PORT, () => {
            // Start health monitoring
            healthMonitor.startMonitoring(20000);

            // Display startup banner
            CLOG.divider();
            CLOG.success('✅ Server Started Successfully!');
            CLOG.divider();
            CLOG.info(`📡 Environment: ${NODE_ENV}`);
            CLOG.info(`🔌 Port: ${PORT}`);
            CLOG.info(`🌐 URL: http://localhost:${PORT}`);
            CLOG.info(`💚 Health: http://localhost:${PORT}/health`);
            CLOG.info(`📊 API: http://localhost:${PORT}/api/v1`);
            CLOG.info(`🔌 WebSocket: ws://localhost:${PORT}`);

            if (process.env.SWAGGER_ENABLED === 'true') {
                CLOG.info(`📚 Docs: http://localhost:${PORT}/api-docs`);
            }

            CLOG.divider();
            CLOG.info('📊 Memory Monitoring: Active (every 20s)');
            CLOG.info('🔄 Garbage Collection: Automatic');
            CLOG.info('📝 Health Reports: Every 6 hours');
            CLOG.info('🔌 Socket Server: Active');
            CLOG.divider();
            CLOG.info(`
    ╔═══════════════════════════════════════════╗
    ║     🎮 BETMASTER SERVER RUNNING 🎮       ║
    ║                                           ║
    ║  📅 ${new Date().toLocaleDateString().padEnd(35)}║
    ║  ⏰ ${new Date().toLocaleTimeString().padEnd(35)}║
    ║  🔒 Security: ACTIVE                      ║
    ║  📊 Monitoring: ACTIVE                    ║
    ║  🔌 WebSocket: ACTIVE                     ║
    ║  ⚙️  Scheduler: ${agenda ? 'ACTIVE' : 'INACTIVE'}                      ║
    ╚═══════════════════════════════════════════╝
            `);
        });

        // Handle server errors
        httpServer.on('error', (error) => {
            if (error.syscall !== 'listen') {
                throw error;
            }

            const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

            switch (error.code) {
                case 'EACCES':
                    CLOG.error(`❌ ${bind} requires elevated privileges`);
                    process.exit(1);
                    break;
                case 'EADDRINUSE':
                    CLOG.error(`❌ ${bind} is already in use`);
                    process.exit(1);
                    break;
                default:
                    throw error;
            }
        });

    } catch (error) {
        CLOG.error('❌ Failed to start server:', error.message);
        CLOG.error('Stack:', error.stack);
        process.exit(1);
    }
};

// ============================================
// 8. GRACEFUL SHUTDOWN HANDLERS
// ============================================

const gracefulShutdown = async (signal) => {
    CLOG.warn(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
    CLOG.divider();

    try {
        // Log final health report
        healthMonitor.logHealthReport();

        // Close socket connections
        await socketManager.shutdown();

        // Close Redis connection
        if (global.redis) {
            CLOG.info('🔌 Closing Redis connection...');
            await global.redis.quit();
            CLOG.success('✅ Redis connection closed');
        }

        // Stop agenda jobs
        if (agenda) {
            CLOG.info('⏹️  Stopping agenda jobs...');
            await agenda.stop();
            CLOG.success('✅ Agenda jobs stopped');
        }

        // Close MongoDB connection
        if (mongoose.connection.readyState !== 0) {
            CLOG.info('🔌 Closing MongoDB connection...');
            await mongoose.connection.close();
            CLOG.success('✅ MongoDB connection closed');
        }

        // Close HTTP server
        CLOG.info('🔌 Closing HTTP server...');
        httpServer.close(() => {
            CLOG.success('✅ HTTP server closed');
            CLOG.divider();
            CLOG.success('✅ Graceful shutdown completed');
            process.exit(0);
        });

        // Force exit after 10 seconds if graceful shutdown fails
        setTimeout(() => {
            CLOG.error('❌ Forced shutdown after timeout');
            process.exit(1);
        }, 10000);

    } catch (error) {
        CLOG.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
};

// Handle SIGTERM (e.g., from Kubernetes, Docker, etc.)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT (e.g., Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    CLOG.error('❌ UNHANDLED REJECTION!');
    CLOG.error('Reason:', reason);

    // Log health report before potential crash
    healthMonitor.logHealthReport();

    // Don't exit in production, but exit in development to catch issues
    if (process.env.NODE_ENV !== 'production') {
        gracefulShutdown('UNHANDLED_REJECTION');
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    CLOG.error('❌ UNCAUGHT EXCEPTION!');
    CLOG.error('Error:', error.message);
    CLOG.error('Stack:', error.stack);

    // Log health report before crash
    healthMonitor.logHealthReport();

    // Graceful shutdown
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// ============================================
// 9. STARTUP
// ============================================

startServer();

// ============================================
// 10. EXPORTS (for testing)
// ============================================

export { app, httpServer, io, redisClient, agenda, healthMonitor, socketManager };