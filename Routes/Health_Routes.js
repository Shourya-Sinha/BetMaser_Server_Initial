import { Router } from "express";
import healthMonitor from '../Utils/HealthMonitor.js';
import ApiResponse from '../Utils/responseHandler.js';
import AuthMiddleware from '../Middlewares/Auth_Middleware.js';

const router = Router();





/**
 * @route   GET /health
 * @desc    Basic health check (public)
 * @access  Public
 */
router.get('/', (req, res) => {
    const report = healthMonitor.getHealthReport();
    
    res.status(200).json({
        success: true,
        message: 'BetMaster API is running',
        data: {
            status: report.status,
            uptime: report.server.uptimeFormatted,
            timestamp: report.timestamp,
            environment: report.server.environment,
            version: process.env.npm_package_version || '1.0.0',
        }
    });
});

/**
 * @route   GET /health/detailed
 * @desc    Detailed health report (protected)
 * @access  Private (Admin only)
 */
router.get('/detailed', 
    AuthMiddleware.authenticate,
    AuthMiddleware.authorize('admin', 'super_admin'),
    (req, res) => {
        const report = healthMonitor.getHealthReport();
        
        res.status(200).json(
            ApiResponse.success(report, 'Detailed health report')
        );
    }
);

/**
 * @route   GET /health/memory
 * @desc    Memory usage details (protected)
 * @access  Private (Admin only)
 */
router.get('/memory',
    AuthMiddleware.authenticate,
    AuthMiddleware.authorize('admin', 'super_admin'),
    (req, res) => {
        const memory = healthMonitor.getMemoryStats();
        
        res.status(200).json(
            ApiResponse.success(memory, 'Memory usage details')
        );
    }
);

/**
 * @route   GET /health/database
 * @desc    Database status (protected)
 * @access  Private (Admin only)
 */
router.get('/database',
    AuthMiddleware.authenticate,
    AuthMiddleware.authorize('admin', 'super_admin'),
    (req, res) => {
        const db = healthMonitor.getDatabaseStatus();
        
        res.status(200).json(
            ApiResponse.success(db, 'Database status')
        );
    }
);

/**
 * @route   GET /health/connections
 * @desc    Active connections (protected)
 * @access  Private (Admin only)
 */
router.get('/connections',
    AuthMiddleware.authenticate,
    AuthMiddleware.authorize('admin', 'super_admin'),
    (req, res) => {
        const connections = healthMonitor.getSocketConnections();
        
        res.status(200).json(
            ApiResponse.success(connections, 'Active connections')
        );
    }
);

/**
 * @route   POST /health/gc
 * @desc    Force garbage collection (protected)
 * @access  Private (Admin only)
 */
router.post('/gc',
    AuthMiddleware.authenticate,
    AuthMiddleware.authorize('admin', 'super_admin'),
    (req, res) => {
        if (global.gc) {
            const before = healthMonitor.getMemoryStats();
            global.gc();
            const after = healthMonitor.getMemoryStats();
            
            res.status(200).json(
                ApiResponse.success({
                    before: { heapUsed: before.heapUsed },
                    after: { heapUsed: after.heapUsed },
                    freed: Math.round((before.heapUsed - after.heapUsed) * 100) / 100 + 'MB'
                }, 'Garbage collection executed')
            );
        } else {
            res.status(400).json(
                ApiResponse.badRequest('Garbage collection not available. Run with --expose-gc flag')
            );
        }
    }
);

export default router;