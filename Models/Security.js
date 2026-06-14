import  mongoose from 'mongoose';
import  crypto from 'crypto';

const securitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // ========== 2FA ==========
  twoFactorAuth: {
    enabled: { type: Boolean, default: false },
    secret: String,
    recoveryCodes: [{
      code: String,
      used: { type: Boolean, default: false },
      usedAt: Date
    }],
    enabledAt: Date,
    lastVerifiedAt: Date
  },

  // ========== LOGIN SECURITY ==========
  loginAttempts: {
    count: { type: Number, default: 0 },
    lastAttemptAt: Date,
    lockUntil: Date
  },
  
  // ========== PASSWORD MANAGEMENT ==========
  passwordHistory: [{
    hash: String,
    changedAt: {
      type: Date,
      default: Date.now
    }
  }],
  lastPasswordChange: Date,
  passwordExpiryDate: Date,
  
  // ========== PASSWORD RESET ==========
  passwordReset: {
    token: String,
    expiresAt: Date,
    requestedAt: Date,
    usedAt: Date
  },

  // ========== SECURITY QUESTIONS ==========
  securityQuestions: [{
    question: String,
    answer: {
      type: String,
      select: false
    },
    updatedAt: Date
  }],

  // ========== DEVICE MANAGEMENT ==========
  trustedDevices: [{
    deviceId: String,
    deviceName: String,
    deviceType: {
      type: String,
      enum: ['android', 'ios', 'web']
    },
    ipAddress: String,
    location: String,
    trustedAt: Date,
    lastUsedAt: Date,
    isActive: { type: Boolean, default: true }
  }],

  // ========== SESSION MANAGEMENT ==========
  activeSessions: [{
    sessionId: String,
    deviceId: String,
    deviceInfo: String,
    ipAddress: String,
    location: String,
    loginAt: Date,
    lastActiveAt: Date,
    expiresAt: Date,
    isActive: { type: Boolean, default: true }
  }],

  // ========== ACTIVITY LOG ==========
  securityLogs: [{
    action: {
      type: String,
      enum: [
        'login', 'logout', 'password_change', 'password_reset',
        '2fa_enable', '2fa_disable', 'device_added', 'device_removed',
        'phone_change', 'email_change', 'account_locked', 'account_unlocked'
      ]
    },
    details: String,
    ipAddress: String,
    deviceInfo: String,
    location: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],

  // ========== VERIFICATION CODES ==========
  verificationCodes: {
    email: {
      code: String,
      expiresAt: Date,
      attempts: { type: Number, default: 0 }
    },
    phone: {
      code: String,
      expiresAt: Date,
      attempts: { type: Number, default: 0 }
    }
  },

  // ========== TIMESTAMPS ==========
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ========== INDEXES ==========
// securitySchema.index({ user: 1 });
securitySchema.index({ 'activeSessions.sessionId': 1 });
securitySchema.index({ 'trustedDevices.deviceId': 1 });

// ========== METHODS ==========
securitySchema.methods.incrementLoginAttempts = async function() {
  this.loginAttempts.count += 1;
  this.loginAttempts.lastAttemptAt = new Date();
  
  // Lock account after 5 failed attempts
  if (this.loginAttempts.count >= 5) {
    this.loginAttempts.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    this.securityLogs.push({
      action: 'account_locked',
      details: 'Account locked due to multiple failed login attempts',
      timestamp: new Date()
    });
  }
  
  return this.save();
};

securitySchema.methods.resetLoginAttempts = function() {
  this.loginAttempts.count = 0;
  this.loginAttempts.lockUntil = undefined;
  return this.save();
};

securitySchema.methods.isAccountLocked = function() {
  if (!this.loginAttempts.lockUntil) return false;
  return this.loginAttempts.lockUntil > new Date();
};

securitySchema.methods.addSession = function(sessionData) {
  // Deactivate old sessions for same device
  this.activeSessions.forEach(session => {
    if (session.deviceId === sessionData.deviceId) {
      session.isActive = false;
    }
  });
  
  // Limit active sessions to 5
  if (this.activeSessions.length >= 5) {
    const oldestSession = this.activeSessions
      .filter(s => s.isActive)
      .sort((a, b) => a.loginAt - b.loginAt)[0];
    if (oldestSession) {
      oldestSession.isActive = false;
    }
  }
  
  this.activeSessions.push({
    ...sessionData,
    loginAt: new Date(),
    lastActiveAt: new Date(),
    isActive: true
  });
  
  return this.save();
};

securitySchema.methods.removeSession = function(sessionId) {
  const session = this.activeSessions.find(s => s.sessionId === sessionId);
  if (session) {
    session.isActive = false;
  }
  return this.save();
};

securitySchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  
  this.passwordReset = {
    token: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    requestedAt: new Date()
  };
  
  return token;
};

securitySchema.methods.verifyPasswordResetToken = function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  if (this.passwordReset.token !== hashedToken) return false;
  if (this.passwordReset.expiresAt < new Date()) return false;
  if (this.passwordReset.usedAt) return false;
  
  return true;
};

securitySchema.methods.generateVerificationCode = function(type) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  this.verificationCodes[type] = {
    code,
    expiresAt,
    attempts: 0
  };
  
  return code;
};

securitySchema.methods.verifyCode = function(type, code) {
  const verification = this.verificationCodes[type];
  
  if (!verification) return false;
  if (verification.attempts >= 3) return false;
  if (verification.expiresAt < new Date()) return false;
  
  verification.attempts += 1;
  
  return verification.code === code;
};

// ========== MIDDLEWARE ==========
securitySchema.pre('save', function(next) {
  // Keep only last 5 password hashes
  if (this.passwordHistory.length > 5) {
    this.passwordHistory = this.passwordHistory.slice(-5);
  }
  
  // Keep only last 50 security logs
  if (this.securityLogs.length > 50) {
    this.securityLogs = this.securityLogs.slice(-50);
  }
  
  this.updatedAt = Date.now();
  // next();
});

const Security = mongoose.models.Security || mongoose.model('Security', securitySchema);
export default Security;