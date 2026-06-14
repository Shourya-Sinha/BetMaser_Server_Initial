import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  // ========== KEY ==========
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  
  // ========== VALUE ==========
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // ========== TYPE ==========
  type: {
    type: String,
    enum: ['string', 'number', 'boolean', 'array', 'object', 'json'],
    default: 'string'
  },
  
  // ========== DESCRIPTION ==========
  description: {
    type: String,
    trim: true
  },
  
  // ========== CATEGORY ==========
  category: {
    type: String,
    enum: [
      'general', 'payment', 'game', 'notification',
      'security', 'bonus', 'commission', 'limit', 'kyc'
    ],
    required: true
  },
  
  // ========== ACCESS ==========
  isPublic: {
    type: Boolean,
    default: false
  },
  isEditable: {
    type: Boolean,
    default: true
  },
  
  // ========== METADATA ==========
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
// settingSchema.index({ key: 1 });
settingSchema.index({ category: 1 });

// ========== STATICS ==========
settingSchema.statics.get = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

settingSchema.statics.set = async function(key, value, updatedBy = null) {
  const setting = await this.findOne({ key });
  
  if (setting) {
    setting.value = value;
    if (updatedBy) setting.updatedBy = updatedBy;
    return setting.save();
  }
  
  return this.create({ key, value, updatedBy });
};

settingSchema.statics.getAll = async function(category = null) {
  const query = category ? { category } : {};
  const settings = await this.find(query);
  
  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
};

settingSchema.statics.bulkUpdate = async function(settings, updatedBy = null) {
  const operations = settings.map(({ key, value }) => ({
    updateOne: {
      filter: { key },
      update: { $set: { value, updatedBy, updatedAt: new Date() } },
      upsert: true
    }
  }));
  
  return this.bulkWrite(operations);
};

// ========== DEFAULT SETTINGS ==========
const defaultSettings = [
  // General
  { key: 'app_name', value: 'BetMaster', type: 'string', category: 'general', description: 'Application name' },
  { key: 'app_version', value: '1.0.0', type: 'string', category: 'general', description: 'Application version' },
  { key: 'maintenance_mode', value: false, type: 'boolean', category: 'general', description: 'Enable maintenance mode' },
  { key: 'min_app_version', value: '1.0.0', type: 'string', category: 'general', description: 'Minimum required app version' },
  { key: 'support_email', value: 'support@betmaster.com', type: 'string', category: 'general', description: 'Support email address' },
  { key: 'support_phone', value: '+91-9999999999', type: 'string', category: 'general', description: 'Support phone number' },
  
  // Payment
  { key: 'min_deposit', value: 100, type: 'number', category: 'payment', description: 'Minimum deposit amount' },
  { key: 'max_deposit', value: 50000, type: 'number', category: 'payment', description: 'Maximum deposit amount' },
  { key: 'min_withdrawal', value: 200, type: 'number', category: 'payment', description: 'Minimum withdrawal amount' },
  { key: 'max_withdrawal', value: 20000, type: 'number', category: 'payment', description: 'Maximum withdrawal amount' },
  { key: 'withdrawal_fee_percentage', value: 2, type: 'number', category: 'payment', description: 'Withdrawal processing fee percentage' },
  { key: 'daily_withdrawal_limit', value: 20000, type: 'number', category: 'payment', description: 'Daily withdrawal limit' },
  
  // Game
  { key: 'min_bet_amount', value: 10, type: 'number', category: 'game', description: 'Minimum bet amount' },
  { key: 'max_bet_amount', value: 10000, type: 'number', category: 'game', description: 'Maximum bet amount' },
  { key: 'max_teams_per_user', value: 6, type: 'number', category: 'game', description: 'Maximum teams per user per game' },
  { key: 'auto_cancel_time', value: 30, type: 'number', category: 'game', description: 'Auto cancel game if not full (minutes)' },
  
  // Commission
  { key: 'cricket_commission', value: 5, type: 'number', category: 'commission', description: 'Cricket commission percentage' },
  { key: 'football_commission', value: 5, type: 'number', category: 'commission', description: 'Football commission percentage' },
  { key: 'teenpatti_commission', value: 3, type: 'number', category: 'commission', description: 'Teen Patti commission percentage' },
  { key: 'ludo_commission', value: 3, type: 'number', category: 'commission', description: 'Ludo commission percentage' },
  
  // Bonus
  { key: 'signup_bonus', value: 50, type: 'number', category: 'bonus', description: 'Signup bonus amount' },
  { key: 'referral_bonus', value: 50, type: 'number', category: 'bonus', description: 'Referral bonus amount' },
  { key: 'referral_bonus_referrer', value: 100, type: 'number', category: 'bonus', description: 'Referral bonus for referrer' },
  { key: 'first_deposit_bonus_percentage', value: 100, type: 'number', category: 'bonus', description: 'First deposit bonus percentage' },
  { key: 'max_bonus_amount', value: 500, type: 'number', category: 'bonus', description: 'Maximum bonus amount' },
  
  // Security
  { key: 'max_login_attempts', value: 5, type: 'number', category: 'security', description: 'Maximum login attempts before lock' },
  { key: 'lock_duration_minutes', value: 30, type: 'number', category: 'security', description: 'Account lock duration in minutes' },
  { key: 'otp_expiry_minutes', value: 10, type: 'number', category: 'security', description: 'OTP expiry time in minutes' },
  { key: 'session_expiry_days', value: 30, type: 'number', category: 'security', description: 'Session expiry in days' },
  
  // KYC
  { key: 'kyc_required_for_withdrawal', value: true, type: 'boolean', category: 'kyc', description: 'Require KYC for withdrawals' },
  { key: 'kyc_required_for_deposit', value: false, type: 'boolean', category: 'kyc', description: 'Require KYC for deposits' },
  { key: 'max_withdrawal_without_kyc', value: 1000, type: 'number', category: 'kyc', description: 'Max withdrawal without KYC' },
  
  // Notification
  { key: 'push_notification_enabled', value: true, type: 'boolean', category: 'notification', description: 'Enable push notifications' },
  { key: 'sms_notification_enabled', value: true, type: 'boolean', category: 'notification', description: 'Enable SMS notifications' },
  { key: 'email_notification_enabled', value: false, type: 'boolean', category: 'notification', description: 'Enable email notifications' }
];

// ========== METHOD TO INITIALIZE DEFAULT SETTINGS ==========
settingSchema.statics.initializeDefaults = async function() {
  const existingCount = await this.countDocuments();
  
  if (existingCount === 0) {
    await this.insertMany(defaultSettings);
    return true;
  }
  
  return false;
};

// ========== MIDDLEWARE ==========
settingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
export default Setting;