import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import JWTUtils from '../Utils/jwtUtils.js';
import { User } from '../Models/index.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';

import { KYC } from '../models/index.js';

class AuthMiddleware {
  /**
   * Verify JWT token and attach user to request
   */
  static authenticate = async (req, res, next) => {
    try {
      // ✅ Skip auth for public routes
      const publicPaths = [
        '/auth/refresh-token',
        '/auth/login',
        '/auth/register',
        '/auth/verify-otp',
        '/auth/resend-otp',
        '/auth/forgot-password',
        '/auth/reset-password',
        '/auth/login-uid',
        '/health',
      ];

      const isPublicPath = publicPaths.some(path =>
        req.originalUrl.includes(path)
      );

      if (isPublicPath) {
        return next();
      }

      let token;
      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
      ) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Please login to access this resource',
        });
      }

      // ✅ Try to verify token
      let decoded;
      try {
        decoded = JWTUtils.verifyToken(token, process.env.JWT_ACCESS_SECRET);
      } catch (jwtError) {
        // ✅ Return proper response for expired token
        if (jwtError.name === 'TokenExpiredError' || jwtError.message === 'Token expired') {
          return res.status(401).json({
            success: false,
            message: 'Token expired',
            code: 'TOKEN_EXPIRED',
          });
        }
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
      }

      // Find user
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated',
        });
      }

      // Attach user to request
      req.user = user;
      next();
    } catch (error) {
      console.error('Auth Middleware Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  /**
   * Authorize based on user roles
   * @param  {...string} roles - Allowed roles
   */
  static authorize(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json(
          ApiResponse.unauthorized('User not authenticated')
        );
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json(
          ApiResponse.forbidden('You do not have permission to perform this action')
        );
      }

      next();
    };
  }

  /**
   * Verify refresh token
   */
  static async verifyRefreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json(
          ApiResponse.badRequest('Refresh token is required')
        );
      }

      // Verify token
      const decoded = JWTUtils.verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Check token type
      if (decoded.type !== 'refresh') {
        return res.status(401).json(
          ApiResponse.unauthorized('Invalid refresh token')
        );
      }

      // Get user
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json(
          ApiResponse.unauthorized('User not found')
        );
      }

      req.user = user;
      req.decoded = decoded;

      next();
    } catch (error) {
      return res.status(401).json(
        ApiResponse.unauthorized('Invalid refresh token')
      );
    }
  }

  /**
   * Optional authentication (doesn't throw error if no token)
   */
  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = JWTUtils.verifyToken(token);
        const user = await User.findById(decoded.id).select('-password');

        if (user && user.isActive && !user.isBlocked) {
          req.user = user;
        }
      }
    } catch (error) {
      // Ignore errors for optional auth
    }

    next();
  }

  /**
   * Verify KYC completion
   */
  static async requireKYC(req, res, next) {
    try {

      const kyc = await KYC.findOne({ user: req.user._id });

      if (!kyc || kyc.status !== 'verified') {
        return res.status(403).json(
          ApiResponse.forbidden('KYC verification is required for this action')
        );
      }

      req.kyc = kyc;
      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rate limiting helper
   */
  static createRateLimiter(windowMs = 15 * 60 * 1000, max = 100) {

    return rateLimit({
      windowMs,
      max,
      message: ApiResponse.tooMany('Too many requests, please try again later'),
      standardHeaders: true,
      legacyHeaders: false,

      keyGenerator: (req) => ipKeyGenerator(req.ip),
      skip: (req) => {
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
      }

    });
  }

  /**
   * Check device authorization
   */
  static async checkDevice(req, res, next) {
    try {
      const deviceId = req.headers['x-device-id'];

      if (!deviceId) {
        return next(); // Skip if no device ID
      }

      const { Security } = require('../models/index.js');
      const security = await Security.findOne({ user: req.user._id });

      if (security) {
        const isTrusted = security.trustedDevices.some(
          device => device.deviceId === deviceId && device.isActive
        );

        if (!isTrusted) {
          // Log suspicious activity
          security.securityLogs.push({
            action: 'new_device_login',
            details: `Login from new device: ${req.headers['user-agent']}`,
            ipAddress: req.ip,
            deviceInfo: req.headers['user-agent'],
            timestamp: new Date()
          });

          await security.save();
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate 2FA if enabled
   */
  static async verify2FA(req, res, next) {
    try {
      if (!req.user) {
        return next();
      }

      const { Security } = require('../models/index.js');
      const security = await Security.findOne({ user: req.user._id });

      if (security && security.twoFactorAuth.enabled) {
        const { twoFactorCode } = req.body;

        if (!twoFactorCode) {
          return res.status(400).json(
            ApiResponse.badRequest('2FA code is required')
          );
        }

        const speakeasy = require('speakeasy');
        const verified = speakeasy.totp.verify({
          secret: security.twoFactorAuth.secret,
          encoding: 'base32',
          token: twoFactorCode
        });

        if (!verified) {
          return res.status(401).json(
            ApiResponse.unauthorized('Invalid 2FA code')
          );
        }

        security.twoFactorAuth.lastVerifiedAt = new Date();
        await security.save();
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}

export default AuthMiddleware;