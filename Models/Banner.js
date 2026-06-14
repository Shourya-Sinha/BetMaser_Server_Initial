import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  // ========== BASIC INFO ==========
  title: {
    type: String,
    required: [true, 'Banner title is required'],
    trim: true,
    maxlength: 100
  },
  subtitle: {
    type: String,
    trim: true,
    maxlength: 200
  },
  
  // ========== MEDIA ==========
  image: {
    url: {
      type: String,
      required: true
    },
    publicId: String,
    thumbnail: String
  },
  imageType: {
    type: String,
    enum: ['image', 'video', 'gif'],
    default: 'image'
  },
  
  // ========== LINK ==========
  actionType: {
    type: String,
    enum: ['game', 'contest', 'deposit', 'referral', 'external', 'none'],
    default: 'none'
  },
  actionLink: String,
  actionData: mongoose.Schema.Types.Mixed,
  
  // ========== DISPLAY ==========
  position: {
    type: String,
    enum: ['home_top', 'home_middle', 'home_bottom', 'game_list', 'sidebar', 'popup'],
    required: true
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  
  // ========== TARGETING ==========
  targetAudience: {
    type: String,
    enum: ['all', 'new_users', 'active_users', 'inactive_users', 'high_value'],
    default: 'all'
  },
  targetGameType: [String],
  
  // ========== SCHEDULE ==========
  isScheduled: {
    type: Boolean,
    default: false
  },
  startDate: Date,
  endDate: Date,
  
  // ========== STATUS ==========
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  
  // ========== ANALYTICS ==========
  analytics: {
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 }
  },
  
  // ========== METADATA ==========
  tags: [String],
  createdBy: {
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
bannerSchema.index({ position: 1, isActive: 1 });
bannerSchema.index({ displayOrder: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });
bannerSchema.index({ targetAudience: 1 });

// ========== VIRTUALS ==========
bannerSchema.virtual('isActiveNow').get(function() {
  if (!this.isActive) return false;
  
  const now = new Date();
  
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  
  return true;
});

// ========== METHODS ==========
bannerSchema.methods.incrementViews = async function() {
  this.analytics.views += 1;
  return this.save();
};

bannerSchema.methods.incrementClicks = async function() {
  this.analytics.clicks += 1;
  this.analytics.clickRate = (this.analytics.clicks / this.analytics.views) * 100;
  return this.save();
};

bannerSchema.methods.incrementConversions = async function() {
  this.analytics.conversions += 1;
  return this.save();
};

// ========== STATICS ==========
bannerSchema.statics.getActiveBanners = function(position) {
  const now = new Date();
  
  return this.find({
    position,
    isActive: true,
    $or: [
      { startDate: null, endDate: null },
      { startDate: { $lte: now }, endDate: { $gte: now } },
      { startDate: { $lte: now }, endDate: null },
      { startDate: null, endDate: { $gte: now } }
    ]
  }).sort({ displayOrder: 1 });
};

bannerSchema.statics.getHomeBanners = function() {
  return this.getActiveBanners('home_top');
};

// ========== MIDDLEWARE ==========
bannerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate click rate
  if (this.analytics.views > 0) {
    this.analytics.clickRate = (this.analytics.clicks / this.analytics.views) * 100;
  }
  
  next();
});

const Banner = mongoose.models.Banner || mongoose.model('Banner', bannerSchema);
export default Banner;