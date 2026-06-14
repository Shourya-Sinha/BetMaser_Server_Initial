import mongoose from 'mongoose';
import NOTIFICATION_TYPES from '../Utils/constants.js';

const notificationSchema = new mongoose.Schema({
  // ========== RECIPIENT ==========
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // ========== NOTIFICATION CONTENT ==========
  type: {
    type: String,
    enum: Object.values(NOTIFICATION_TYPES),
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  image: String,
  deepLink: String,
  
  // ========== STATUS ==========
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  isClicked: {
    type: Boolean,
    default: false
  },
  clickedAt: Date,
  
  // ========== RELATED ENTITIES ==========
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game'
  },
  bet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bet'
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  
  // ========== DELIVERY ==========
  channels: [{
    type: String,
    enum: ['push', 'email', 'sms', 'in_app']
  }],
  deliveredAt: Date,
  
  // ========== PRIORITY ==========
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // ========== EXPIRY ==========
  expiresAt: Date,
  isExpired: {
    type: Boolean,
    default: false
  },
  
  // ========== METADATA ==========
  metadata: mongoose.Schema.Types.Mixed,
  
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
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ========== METHODS ==========
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsClicked = function() {
  this.isClicked = true;
  this.clickedAt = new Date();
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
  }
  return this.save();
};

// ========== STATICS ==========
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ user: userId, isRead: false });
};

notificationSchema.statics.getUserNotifications = function(userId, page = 1, limit = 20) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { 
      $set: { 
        isRead: true, 
        readAt: new Date() 
      } 
    }
  );
};

notificationSchema.statics.deleteOldNotifications = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
};

// ========== MIDDLEWARE ==========
notificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-expire after 30 days if not set
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;