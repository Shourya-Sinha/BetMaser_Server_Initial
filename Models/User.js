import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import IDGenerator from '../Utils/generateId.js';
import USER_ROLES from '../Utils/constants.js';
import KYC_STATUS from '../Utils/constants.js';

const userSchema = new mongoose.Schema({
  // ========== BASIC INFO ==========
  uid: {
    type: String,
    unique: true,
    default: () => IDGenerator.generateUserId(),
    immutable: true
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: 4,
    maxlength: 20
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false
  },
  
  // ========== PERSONAL INFO ==========
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: 50
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(dob) {
        if (!dob) return true;
        const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 18;
      },
      message: 'User must be at least 18 years old'
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  profilePicture: {
    url: String,
    publicId: String,
    uploadedAt: Date
  },
  
  // ========== ROLE & STATUS ==========
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.USER
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockReason: String,
  blockedAt: Date,

  // ========== ADDRESS ==========
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: {
      type: String,
      default: 'India'
    }
  },

  // ========== PREFERENCES ==========
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'hi', 'gu', 'mr', 'ta', 'te']
    },
    theme: {
      type: String,
      default: 'dark',
      enum: ['dark', 'light']
    },
    notifications: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: true },
      gameReminders: { type: Boolean, default: true },
      promotionalOffers: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      vibration: { type: Boolean, default: true }
    }
  },

  // ========== ACTIVITY TRACKING ==========
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: Date,
  loginHistory: [{
    ipAddress: String,
    deviceInfo: String,
    location: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success'
    }
  }],
  
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
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ========== INDEXES ==========
// userSchema.index({ phone: 1 });
// userSchema.index({ email: 1 });
// userSchema.index({ uid: 1 }, { unique: true });
// userSchema.index({ username: 1 }, { sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1, isBlocked: 1 });
userSchema.index({ createdAt: -1 });

// ========== MIDDLEWARE ==========
// userSchema.pre('save', async function(next) {
//   if (this.isModified('password')) {
//     this.password = await bcrypt.hash(this.password, 12);
//     this.security.passwordChangedAt = Date.now() - 1000;
//   }
//   this.updatedAt = Date.now();
//   next();
// });
// userSchema.pre('save', async function(next) {
//   // Only hash password if it's modified
//   if (this.isModified('password')) {
//     try {
//       // Hash the password
//       this.password = await bcrypt.hash(this.password, 12);
      
//       // ✅ Set passwordChangedAt on the User model itself
//       this.passwordChangedAt = new Date(Date.now() - 1000);
//     } catch (error) {
//       return next(error);
//     }
//   }
  
//   // Update timestamp
//   this.updatedAt = new Date();
  
//   next();
// });

// ========== METHODS ==========
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// Method to check if password changed after token was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// ========== STATICS ==========
userSchema.statics.findByUid = function(uid) {
  return this.findOne({ uid });
};

userSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true, isBlocked: false });
};

// export default userSchema;
const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;