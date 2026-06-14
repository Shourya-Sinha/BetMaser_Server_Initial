import jwt from 'jsonwebtoken';
import crypto from 'crypto';

class JWTUtils {
  /**
   * Generate access token
   * @param {Object} payload - User data to encode
   * @returns {string} - JWT token
   */
  static generateAccessToken(payload) {
    return jwt.sign(
      {
        id: payload._id || payload.id,
        uid: payload.uid,
        role: payload.role,
        type: 'access'
      },
      process.env.JWT_ACCESS_SECRET,
      {
        expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',
        issuer: 'betmaster',
        audience: 'betmaster-app'
      }
    );
  }

  /**
   * Generate refresh token
   * @param {Object} payload - User data to encode
   * @returns {string} - Refresh token
   */
  static generateRefreshToken(payload) {
    return jwt.sign(
      {
        id: payload._id || payload.id,
        type: 'refresh',
        tokenId: crypto.randomBytes(16).toString('hex')
      },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
        issuer: 'betmaster',
        audience: 'betmaster-app'
      }
    );
  }

  /**
   * Generate email verification token
   * @param {string} userId - User ID
   * @returns {string} - Verification token
   */
  static generateVerificationToken(userId) {
    return jwt.sign(
      { id: userId, type: 'email_verification' },
      process.env.JWT_VERIFICATION_SECRET,
      { expiresIn: '24h' }
    );
  }

  /**
   * Generate password reset token
   * @param {string} userId - User ID
   * @returns {string} - Reset token
   */
  static generatePasswordResetToken(userId) {
    return jwt.sign(
      { id: userId, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );
  }

  /**
   * Verify token
   * @param {string} token - JWT token
   * @param {string} secret - Secret key
   * @returns {Object} - Decoded payload
   */
  static verifyToken(token, secret = process.env.JWT_ACCESS_SECRET) {
    // console.log("log token in verufy token in server side:-",token,secret);
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Decode token without verification
   * @param {string} token - JWT token
   * @returns {Object} - Decoded payload
   */
  static decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Check if token is about to expire
   * @param {string} token - JWT token
   * @param {number} thresholdMinutes - Minutes before expiry to consider
   * @returns {boolean} - True if token is about to expire
   */
  static isTokenExpiringSoon(token, thresholdMinutes = 5) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    const expiresIn = decoded.exp * 1000 - Date.now();
    return expiresIn < thresholdMinutes * 60 * 1000;
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} user - User object
   * @returns {Object} - Token pair
   */
  static generateTokenPair(user) {
    const payload = {
      id: user._id,
      uid: user.uid,
      phone: user.phone,
      role: user.role,
    };

    const accessToken = jwt.sign(
      { ...payload, type: 'access' },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );

    return { accessToken, refreshToken };
  }
}

export default JWTUtils;