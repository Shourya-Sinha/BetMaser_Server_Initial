import { User, Wallet, GameStats, KYC, Security, Referral, Setting } from '../Models/index.js';
import PasswordUtils from '../Utils/passwordUtils.js';
import JWTUtils from '../Utils/jwtUtils.js';
import ApiResponse from '../Utils/responseHandler.js';
import CLOG from '../Utils/Clog.js';
import IDGenerator from '../Utils/generateId.js';
import {asyncHandler} from '../Utils/errorHandler.js';

class AuthController {
  /**
   * @desc    Register new user
   * @route   POST /api/auth/register
   * @access  Public
   */
  static register = asyncHandler(async (req, res) => {
    const { phone, password, fullName, email, referralCode } = req.body;
    console.log("log body during registration",req.body);

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json(
        ApiResponse.error('Phone number already registered', 409)
      );
    }

    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(409).json(
          ApiResponse.error('Email already registered', 409)
        );
      }
    }

    // Create user with session for transaction
    const session = await User.startSession();
    session.startTransaction();

    try {
      // Hash password with Argon2
      const hashedPassword = await PasswordUtils.hashPassword(password);

      // Create user
      const user = await User.create([{
        phone,
        password: hashedPassword,
        fullName,
        email,
      }], { session });

      const userId = user[0]._id;

      // Create associated documents
      await Promise.all([
        Wallet.create([{ user: userId }], { session }),
        GameStats.create([{ user: userId }], { session }),
        KYC.create([{ user: userId }], { session }),
        Security.create([{ user: userId }], { session }),
        Referral.create([{ user: userId }], { session })
      ]);

      // Handle referral
      if (referralCode) {
        const referrer = await Referral.findOne({ 
          referralCode: referralCode.toUpperCase() 
        }).session(session);

        if (referrer) {
          // Update referred by
          await Referral.findOneAndUpdate(
            { user: userId },
            {
              'referredBy.user': referrer.user,
              'referredBy.code': referralCode,
              'referredBy.joinedAt': new Date(),
              'referredBy.bonusReceived': true
            },
            { session }
          );

          // Add referral bonus to referrer
          const signupBonus = await Setting.get('signup_bonus', 50);
          await referrer.addReferral(userId, signupBonus);
        }
      }

      await session.commitTransaction();

      // Generate OTP for verification
      const otp = IDGenerator.generateOTP();
      const security = await Security.findOne({ user: userId });
      security.verificationCodes.phone = {
        code: otp,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0
      };
      await security.save();

      // TODO: Send OTP via SMS
      CLOG.info(`OTP for ${phone}: ${otp}`);

      // Generate tokens
      const tokens = JWTUtils.generateTokenPair(user[0]);

      CLOG.success('User registered successfully:', user[0].uid);

      res.status(201).json(
        ApiResponse.created({
          user: {
            uid: user[0].uid,
            phone: user[0].phone,
            fullName: user[0].fullName,
            role: user[0].role
          },
          tokens
        }, 'Registration successful. Please verify your phone number.')
      );

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  });

  /**
   * @desc    Verify OTP
   * @route   POST /api/auth/verify-otp
   * @access  Public
   */
  static verifyOTP = asyncHandler(async (req, res) => {
    const { phone, otp, type = 'phone' } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    const security = await Security.findOne({ user: user._id });
    if (!security) {
      return res.status(400).json(
        ApiResponse.badRequest('Security record not found')
      );
    }

    // Verify OTP
    const isValid = security.verifyCode(type, otp);
    if (!isValid) {
      return res.status(400).json(
        ApiResponse.badRequest('Invalid or expired OTP')
      );
    }

    // Mark user as verified
    user.isVerified = true;
    await user.save();

    // Clear verification code
    security.verificationCodes[type] = {
      code: null,
      expiresAt: null,
      attempts: 0
    };
    await security.save();

    CLOG.success('OTP verified for:', phone);

    res.status(200).json(
      ApiResponse.success(null, 'Phone number verified successfully')
    );
  });

  /**
   * @desc    Login user
   * @route   POST /api/auth/login
   * @access  Public
   */
  static login = asyncHandler(async (req, res) => {
    const { phone, password } = req.body;

    // Find user
    const user = await User.findOne({ phone }).select('+password');
    if (!user) {
      return res.status(401).json(
        ApiResponse.unauthorized('Invalid credentials')
      );
    }

    // Check if account is blocked
    if (user.isBlocked) {
      return res.status(403).json(
        ApiResponse.forbidden('Account is blocked. Please contact support.')
      );
    }

    // Get security record
    const security = await Security.findOne({ user: user._id });
    
    // Check if account is locked
    if (security && security.isAccountLocked()) {
      const lockTime = Math.ceil(
        (security.loginAttempts.lockUntil - Date.now()) / 1000 / 60
      );
      return res.status(429).json(
        ApiResponse.tooMany(`Account is locked. Please try again in ${lockTime} minutes`)
      );
    }

    // Verify password using Argon2
    const { isValid, needsRehash } = await PasswordUtils.verifyPassword(
      user.password,
      password
    );

    if (!isValid) {
      // Increment failed login attempts
      if (security) {
        await security.incrementLoginAttempts();
      }
      
      return res.status(401).json(
        ApiResponse.unauthorized('Invalid credentials')
      );
    }

    // Rehash password if needed (for upgrading hash parameters)
    if (needsRehash) {
      const newHash = await PasswordUtils.hashPassword(password);
      user.password = newHash;
      await user.save();
    }

    // Reset login attempts
    if (security) {
      await security.resetLoginAttempts();
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lastActiveAt = new Date();
    
    // Add login history
    user.loginHistory.push({
      ipAddress: req.ip,
      deviceInfo: req.headers['user-agent'],
      location: req.headers['x-location'] || 'Unknown',
      timestamp: new Date(),
      status: 'success'
    });
    
    await user.save();

    // Generate tokens
    const tokens = JWTUtils.generateTokenPair(user);

    // Add session
    if (security) {
      await security.addSession({
        sessionId: tokens.accessToken.split('.')[2],
        deviceId: req.headers['x-device-id'] || 'unknown',
        deviceInfo: req.headers['user-agent'],
        ipAddress: req.ip,
        location: req.headers['x-location'] || 'Unknown',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    CLOG.success('User logged in:', user.phone);

    // Get wallet balance
    const wallet = await Wallet.findOne({ user: user._id });

    res.status(200).json(
      ApiResponse.success({
        user: {
          uid: user.uid,
          phone: user.phone,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          profilePicture: user.profilePicture?.url
        },
        wallet: {
          balance: wallet?.availableBalance || 0,
          mainBalance: wallet?.mainBalance || 0,
          bonusBalance: wallet?.bonusBalance || 0,
          winningBalance: wallet?.winningBalance || 0
        },
        tokens
      }, 'Login successful')
    );
  });

  /**
   * @desc    Login with UID
   * @route   POST /api/auth/login-uid
   * @access  Public
   */
  static loginWithUID = asyncHandler(async (req, res) => {
    const { uid, password } = req.body;

    const user = await User.findOne({ uid }).select('+password');
    if (!user) {
      return res.status(401).json(
        ApiResponse.unauthorized('Invalid credentials')
      );
    }

    // Use same login logic
    req.body.phone = user.phone;
    return this.login(req, res);
  });

  /**
   * @desc    Refresh token
   * @route   POST /api/auth/refresh-token
   * @access  Public
   */
  // static refreshToken = asyncHandler(async (req, res) => {
  //   const { refreshToken } = req.body;

  //   if (!refreshToken) {
  //     return res.status(400).json(
  //       ApiResponse.badRequest('Refresh token is required')
  //     );
  //   }

  //   // Verify refresh token
  //   const decoded = JWTUtils.verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

  //   if (decoded.type !== 'refresh') {
  //     return res.status(401).json(
  //       ApiResponse.unauthorized('Invalid refresh token')
  //     );
  //   }

  //   // Get user
  //   const user = await User.findById(decoded.id);
  //   if (!user) {
  //     return res.status(401).json(
  //       ApiResponse.unauthorized('User not found')
  //     );
  //   }

  //   // Generate new token pair
  //   const tokens = JWTUtils.generateTokenPair(user);

  //   res.status(200).json(
  //     ApiResponse.success(tokens, 'Token refreshed successfully')
  //   );
  // });
static refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(422).json(
        ApiResponse.validationError(['Refresh token is required'])
      );
    }

    try {
      // Verify refresh token
      const decoded = JWTUtils.verifyToken(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET
      );

      // Check token type
      if (decoded.type !== 'refresh') {
        return res.status(401).json(
          ApiResponse.unauthorized('Invalid token type')
        );
      }

      // Find user
      const user = await User.findById(decoded.id).select('+password');
      if (!user) {
        return res.status(401).json(
          ApiResponse.unauthorized('User not found')
        );
      }

      // Check if user is active
      if (!user.isActive || user.isBlocked) {
        return res.status(401).json(
          ApiResponse.unauthorized('Account is inactive or blocked')
        );
      }

      // Check if password changed after token was issued
      if (user.passwordChangedAt) {
        const passwordChangedTimestamp = parseInt(
          user.passwordChangedAt.getTime() / 1000,
          10
        );
        if (decoded.iat < passwordChangedTimestamp) {
          return res.status(401).json(
            ApiResponse.unauthorized('Password changed. Please login again.')
          );
        }
      }

      // Generate new token pair
      const tokens = JWTUtils.generateTokenPair(user);

      // Update session in security record
      const security = await Security.findOne({ user: user._id });
      if (security) {
        // Remove old session and add new one
        await security.addSession({
          sessionId: tokens.accessToken.split('.')[2],
          deviceId: req.headers['x-device-id'] || 'unknown',
          deviceInfo: req.headers['user-agent'],
          ipAddress: req.ip,
          location: req.headers['x-location'] || 'Unknown',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }

      CLOG.success('Token refreshed for:', user.phone);

      res.status(200).json(
        ApiResponse.success(
          {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          },
          'Token refreshed successfully'
        )
      );
    } catch (error) {
      // Handle specific JWT errors
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json(
          ApiResponse.unauthorized('Invalid refresh token')
        );
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json(
          ApiResponse.unauthorized('Refresh token expired. Please login again.')
        );
      }
      throw error;
    }
  });
  /**
   * @desc    Forgot password
   * @route   POST /api/auth/forgot-password
   * @access  Public
   */
  static forgotPassword = asyncHandler(async (req, res) => {
    const { phone } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    // Generate OTP
    const otp = IDGenerator.generateOTP();
    const security = await Security.findOne({ user: user._id });
    security.verificationCodes.phone = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0
    };
    await security.save();

    // TODO: Send OTP via SMS
    CLOG.info(`Password reset OTP for ${phone}: ${otp}`);

    res.status(200).json(
      ApiResponse.success(null, 'Password reset OTP sent to your phone')
    );
  });

  /**
   * @desc    Reset password
   * @route   POST /api/auth/reset-password
   * @access  Public
   */
  static resetPassword = asyncHandler(async (req, res) => {
    const { phone, otp, newPassword } = req.body;

    const user = await User.findOne({ phone }).select('+password');
    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    // Verify OTP
    const security = await Security.findOne({ user: user._id });
    const isValid = security.verifyCode('phone', otp);
    
    if (!isValid) {
      return res.status(400).json(
        ApiResponse.badRequest('Invalid or expired OTP')
      );
    }

    // Hash new password
    const hashedPassword = await PasswordUtils.hashPassword(newPassword);

    // Update password
    user.password = hashedPassword;
    
    // Add to password history
    if (security) {
      security.passwordHistory.push({
        hash: hashedPassword,
        changedAt: new Date()
      });
      security.lastPasswordChange = new Date();
      
      // Invalidate all sessions
      security.activeSessions = [];
      
      // Clear verification code
      security.verificationCodes.phone = {
        code: null,
        expiresAt: null,
        attempts: 0
      };
      
      await security.save();
    }

    await user.save();

    CLOG.success('Password reset for:', phone);

    res.status(200).json(
      ApiResponse.success(null, 'Password reset successful')
    );
  });

  /**
   * @desc    Change password
   * @route   POST /api/auth/change-password
   * @access  Private
   */
  static changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const { isValid } = await PasswordUtils.verifyPassword(
      user.password,
      currentPassword
    );

    if (!isValid) {
      return res.status(400).json(
        ApiResponse.badRequest('Current password is incorrect')
      );
    }

    // Check if new password is same as old
    const isSamePassword = await PasswordUtils.verifyPassword(
      user.password,
      newPassword
    );

    if (isSamePassword.isValid) {
      return res.status(400).json(
        ApiResponse.badRequest('New password must be different from current password')
      );
    }

    // Hash and save new password
    user.password = await PasswordUtils.hashPassword(newPassword);
    
    // Update security
    const security = await Security.findOne({ user: user._id });
    if (security) {
      security.passwordHistory.push({
        hash: user.password,
        changedAt: new Date()
      });
      security.lastPasswordChange = new Date();
      
      // Invalidate all sessions except current
      security.activeSessions = security.activeSessions.filter(
        session => session.sessionId === req.tokenExp?.toString()
      );
      
      await security.save();
    }

    await user.save();

    CLOG.success('Password changed for:', user.phone);

    res.status(200).json(
      ApiResponse.success(null, 'Password changed successfully')
    );
  });

  /**
   * @desc    Logout user
   * @route   POST /api/auth/logout
   * @access  Private
   */
  static logout = asyncHandler(async (req, res) => {
    // Remove session
    const security = await Security.findOne({ user: req.user._id });
    if (security) {
      security.removeSession(req.tokenExp?.toString());
      await security.save();
    }

    // Update last active
    req.user.lastActiveAt = new Date();
    await req.user.save();

    // TODO: Add refresh token to blacklist in Redis

    res.status(200).json(
      ApiResponse.success(null, 'Logged out successfully')
    );
  });

  /**
   * @desc    Enable 2FA
   * @route   POST /api/auth/enable-2fa
   * @access  Private
   */
  static enable2FA = asyncHandler(async (req, res) => {
    const speakeasy = require('speakeasy');
    const QRCode = require('qrcode');

    const secret = speakeasy.generateSecret({
      name: `BetMaster:${req.user.phone}`
    });

    // Save secret temporarily
    const security = await Security.findOne({ user: req.user._id });
    security.twoFactorAuth.secret = secret.base32;
    security.twoFactorAuth.enabled = false;
    await security.save();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.status(200).json(
      ApiResponse.success({
        secret: secret.base32,
        qrCode: qrCodeUrl
      }, 'Scan QR code with your authenticator app')
    );
  });

  /**
   * @desc    Verify 2FA setup
   * @route   POST /api/auth/verify-2fa
   * @access  Private
   */
  static verify2FA = asyncHandler(async (req, res) => {
    const { code } = req.body;
    const speakeasy = require('speakeasy');

    const security = await Security.findOne({ user: req.user._id });
    
    const verified = speakeasy.totp.verify({
      secret: security.twoFactorAuth.secret,
      encoding: 'base32',
      token: code
    });

    if (!verified) {
      return res.status(400).json(
        ApiResponse.badRequest('Invalid verification code')
      );
    }

    // Enable 2FA
    security.twoFactorAuth.enabled = true;
    security.twoFactorAuth.enabledAt = new Date();
    
    // Generate recovery codes
    const recoveryCodes = [];
    for (let i = 0; i < 8; i++) {
      recoveryCodes.push({
        code: IDGenerator.generateOTP(10),
        used: false
      });
    }
    security.twoFactorAuth.recoveryCodes = recoveryCodes;
    
    await security.save();

    res.status(200).json(
      ApiResponse.success({
        recoveryCodes: recoveryCodes.map(rc => rc.code)
      }, '2FA enabled successfully. Save your recovery codes.')
    );
  });

  /**
   * @desc    Resend OTP
   * @route   POST /api/auth/resend-otp
   * @access  Public
   */
  static resendOTP = asyncHandler(async (req, res) => {
    const { phone,type='phone'} = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json(
        ApiResponse.notFound('User not found')
      );
    }

    // Generate new OTP
    const otp = IDGenerator.generateOTP();
    const security = await Security.findOne({ user: user._id });
    security.verificationCodes[type] = {
      code: otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0
    };
    await security.save();

    // TODO: Send OTP via SMS
    CLOG.info(`Resent OTP for ${phone}: ${otp}`);

    res.status(200).json(
      ApiResponse.success(null, 'OTP resent successfully')
    );
  });

  /**
   * @desc    Update user profile
   * @route   PUT /api/v1/users/update-profile
   * @access  Private
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id || req.user.id;
    const {
      fullName,
      email,
      dateOfBirth,
      gender,
      address,
      preferences,
    } = req.body;

    // Build update object with only provided fields
    const updateData = {};
    
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (gender !== undefined) updateData.gender = gender;
    if (address !== undefined) updateData.address = address;
    if (preferences !== undefined) updateData.preferences = preferences;

    // Check if email is already taken
    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        return res.status(409).json(
          ApiResponse.error('Email already in use', 409)
        );
      }
    }
  })
  

}

export default AuthController;