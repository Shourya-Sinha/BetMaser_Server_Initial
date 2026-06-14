import os from 'os';
import mongoose from 'mongoose';
import CLOG from './Clog.js';

class HealthMonitor {
    constructor() {
        this.maxMemory = 0;
        this.healthData = {
            status: 'healthy',
            uptime: 0,
            timestamp: new Date().toISOString(),
            server: {},
            database: {},
            memory: {},
            cpu: {},
            connections: {}
        };
    }

    /**
     * Get current memory usage details
     */
    getMemoryStats() {
        const used = process.memoryUsage();
        const memoryData = {
            heapUsed: Math.round(used.heapUsed / 1024 / 1024),
            heapTotal: Math.round(used.heapTotal / 1024 / 1024),
            external: Math.round(used.external / 1024 / 1024),
            rss: Math.round(used.rss / 1024 / 1024),
            arrayBuffers: Math.round(used.arrayBuffers / 1024 / 1024),
            maxMemory: this.maxMemory,
            unit: 'MB'
        };

        // Update max memory
        this.maxMemory = Math.max(this.maxMemory, memoryData.heapUsed);

        // Check memory threshold
        const threshold = process.env.MEMORY_WARNING_THRESHOLD || 450;
        if (memoryData.heapUsed > threshold) {
            memoryData.warning = true;
            memoryData.threshold = threshold;
        }

        return memoryData;
    }

    /**
     * Get CPU usage details
     */
    getCPUStats() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();

        return {
            cores: cpus.length,
            model: cpus[0]?.model || 'Unknown',
            speed: cpus[0]?.speed || 0,
            loadAverage: {
                '1min': loadAvg[0],
                '5min': loadAvg[1],
                '15min': loadAvg[2]
            },
            usagePercent: Math.round((loadAvg[0] / cpus.length) * 100)
        };
    }

    /**
     * Get database connection status
     */
    getDatabaseStatus() {
        const dbState = mongoose.connection.readyState;
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };

        return {
            status: states[dbState] || 'unknown',
            connected: dbState === 1,
            host: mongoose.connection.host || 'N/A',
            name: mongoose.connection.name || 'N/A',
            port: mongoose.connection.port || 'N/A',
            collections: Object.keys(mongoose.connection.collections || {}).length,
            poolSize: mongoose.connection.client?.topology?.connections?.()?.length || 0
        };
    }

    /**
     * Get Redis connection status
     */
    getRedisStatus() {
        if (global.redis) {
            return {
                status: global.redis.status === 'ready' ? 'connected' : global.redis.status,
                connected: global.redis.status === 'ready'
            };
        }
        return { status: 'not_configured', connected: false };
    }

    /**
     * Get active socket connections
     */
    getSocketConnections() {
        if (global.io) {
            const sockets = global.io.sockets?.sockets;
            return {
                total: sockets?.size || 0,
                rooms: global.io.sockets?.adapter?.rooms?.size || 0
            };
        }
        return { total: 0, rooms: 0 };
    }

    /**
     * Get server uptime and info
     */
    getServerInfo() {
        return {
            uptime: process.uptime(),
            uptimeFormatted: this.formatUptime(process.uptime()),
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            environment: process.env.NODE_ENV || 'development',
            totalMemory: Math.round(os.totalmem() / 1024 / 1024),
            freeMemory: Math.round(os.freemem() / 1024 / 1024),
            hostname: os.hostname()
        };
    }

    /**
     * Format uptime to readable string
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        parts.push(`${secs}s`);

        return parts.join(' ');
    }

    /**
     * Get complete health report
     */
    getHealthReport() {
        const memory = this.getMemoryStats();
        const cpu = this.getCPUStats();
        const database = this.getDatabaseStatus();
        const redis = this.getRedisStatus();
        const sockets = this.getSocketConnections();
        const server = this.getServerInfo();

        // Determine overall status
        let status = 'healthy';
        const issues = [];

        if (!database.connected) {
            status = 'unhealthy';
            issues.push('Database disconnected');
        }

        if (memory.warning) {
            status = status === 'healthy' ? 'degraded' : status;
            issues.push(`High memory usage: ${memory.heapUsed}MB`);
        }

        if (cpu.usagePercent > 80) {
            status = status === 'healthy' ? 'degraded' : status;
            issues.push(`High CPU usage: ${cpu.usagePercent}%`);
        }

        this.healthData = {
            status,
            issues: issues.length > 0 ? issues : undefined,
            timestamp: new Date().toISOString(),
            server,
            database,
            redis,
            memory,
            cpu,
            connections: sockets
        };

        return this.healthData;
    }

    /**
     * Start periodic health monitoring
     */
    startMonitoring(intervalMs = 20000) {
        CLOG.info('Health monitoring started');

        // Memory monitoring
        setInterval(() => {
            const memory = this.getMemoryStats();

            if (memory.warning) {
                CLOG.error(
                    `⚠️ HIGH MEMORY USAGE: ${memory.heapUsed}MB (Max: ${memory.maxMemory}MB)`
                );

                // Force garbage collection if available
                if (global.gc) {
                    CLOG.info('♻️ Running garbage collection...');
                    global.gc();
                    
                    // Log memory after GC
                    const afterGC = this.getMemoryStats();
                    CLOG.success(
                        `✅ Memory after GC: ${afterGC.heapUsed}MB (Freed: ${memory.heapUsed - afterGC.heapUsed}MB)`
                    );
                }
            }

            // Log memory stats every 5 minutes
            if (Math.floor(Date.now() / 1000) % 300 === 0) {
                CLOG.info(
                    `📊 Memory: ${memory.heapUsed}MB / ${memory.heapTotal}MB | RSS: ${memory.rss}MB | Max: ${memory.maxMemory}MB`
                );
            }
        }, intervalMs);

        // Database health check
        setInterval(() => {
            const dbStatus = this.getDatabaseStatus();
            if (!dbStatus.connected) {
                CLOG.error('❌ Database connection lost!');
            }
        }, 30000); // Every 30 seconds

        // CPU monitoring
        setInterval(() => {
            const cpu = this.getCPUStats();
            if (cpu.usagePercent > 80) {
                CLOG.warn(
                    `⚠️ High CPU Usage: ${cpu.usagePercent}% (Load: ${cpu.loadAverage['1min']})`
                );
            }
        }, 60000); // Every 60 seconds
    }

    /**
     * Log health report to console
     */
    logHealthReport() {
        const report = this.getHealthReport();
        
        CLOG.divider();
        CLOG.info('📊 HEALTH REPORT');
        CLOG.divider();
        CLOG.info(`Status: ${report.status.toUpperCase()}`);
        CLOG.info(`Uptime: ${report.server.uptimeFormatted}`);
        CLOG.info(`Memory: ${report.memory.heapUsed}MB / ${report.memory.heapTotal}MB`);
        CLOG.info(`CPU: ${report.cpu.usagePercent}% (${report.cpu.cores} cores)`);
        CLOG.info(`Database: ${report.database.status.toUpperCase()}`);
        CLOG.info(`Redis: ${report.redis.status.toUpperCase()}`);
        CLOG.info(`Connections: ${report.connections.total} sockets`);
        
        if (report.issues) {
            CLOG.error('Issues:');
            report.issues.forEach(issue => CLOG.error(`  - ${issue}`));
        }
        
        CLOG.divider();
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown(signal) {
        CLOG.warn(`Received ${signal}. Starting graceful shutdown...`);
        
        this.logHealthReport();

        try {
            // Close socket connections
            if (global.io) {
                CLOG.info('Closing socket connections...');
                await new Promise((resolve) => {
                    global.io.close(() => {
                        CLOG.success('Socket connections closed');
                        resolve();
                    });
                });
            }

            // Close Redis connection
            if (global.redis) {
                CLOG.info('Closing Redis connection...');
                await global.redis.quit();
                CLOG.success('Redis connection closed');
            }

            // Close MongoDB connection
            if (mongoose.connection.readyState !== 0) {
                CLOG.info('Closing MongoDB connection...');
                await mongoose.connection.close();
                CLOG.success('MongoDB connection closed');
            }

            CLOG.success('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            CLOG.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
}

// Create singleton instance
const healthMonitor = new HealthMonitor();

export default healthMonitor;