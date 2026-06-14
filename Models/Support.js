import mongoose from 'mongoose';

const supportSchema = new mongoose.Schema({
  // ========== TICKET INFO ==========
  ticketId: {
    type: String,
    unique: true,
    default: () => 'TKT' + Date.now().toString(36).toUpperCase()
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // ========== TICKET DETAILS ==========
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: 200
  },
  category: {
    type: String,
    enum: [
      'account', 'payment', 'withdrawal', 'deposit',
      'game', 'bet', 'kyc', 'bonus', 'technical', 'other'
    ],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // ========== STATUS ==========
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'],
    default: 'open'
  },
  statusHistory: [{
    status: String,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    remark: String
  }],
  
  // ========== MESSAGES ==========
  messages: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderType: {
      type: String,
      enum: ['user', 'admin'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    attachments: [{
      url: String,
      publicId: String,
      type: String,
      name: String,
      size: Number
    }],
    isRead: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ========== ASSIGNMENT ==========
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedAt: Date,
  
  // ========== RESOLUTION ==========
  resolution: {
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    solution: String,
    userSatisfaction: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String
  },
  
  // ========== RELATED ENTITIES ==========
  relatedTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  relatedGame: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game'
  },
  relatedBet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bet'
  },
  
  // ========== METADATA ==========
  tags: [String],
  internalNotes: [{
    note: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
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
  },
  lastRepliedAt: Date,
  closedAt: Date
}, {
  timestamps: true
});

// ========== INDEXES ==========
// supportSchema.index({ user: 1, status: 1 });
// supportSchema.index({ ticketId: 1 });
supportSchema.index({ status: 1, priority: 1 });
supportSchema.index({ assignedTo: 1 });
supportSchema.index({ category: 1 });
supportSchema.index({ createdAt: -1 });

// ========== VIRTUALS ==========
supportSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

supportSchema.virtual('lastMessage').get(function() {
  return this.messages[this.messages.length - 1];
});

supportSchema.virtual('unreadCount').get(function() {
  return this.messages.filter(m => !m.isRead).length;
});

supportSchema.virtual('isOverdue').get(function() {
  if (this.status === 'resolved' || this.status === 'closed') return false;
  
  const hoursSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  
  const sla = {
    urgent: 2,
    high: 8,
    medium: 24,
    low: 48
  };
  
  return hoursSinceCreation > sla[this.priority];
});

// ========== METHODS ==========
supportSchema.methods.addMessage = async function(senderId, senderType, message, attachments = []) {
  this.messages.push({
    sender: senderId,
    senderType,
    message,
    attachments,
    createdAt: new Date()
  });
  
  this.lastRepliedAt = new Date();
  
  // Auto-update status based on sender
  if (senderType === 'admin' && this.status === 'open') {
    this.status = 'in_progress';
  } else if (senderType === 'user' && this.status === 'in_progress') {
    this.status = 'waiting_user';
  }
  
  return this.save();
};

supportSchema.methods.assign = async function(adminId) {
  this.assignedTo = adminId;
  this.assignedAt = new Date();
  
  if (this.status === 'open') {
    this.status = 'in_progress';
  }
  
  return this.save();
};

supportSchema.methods.resolve = async function(adminId, solution) {
  this.status = 'resolved';
  this.resolution = {
    resolvedBy: adminId,
    resolvedAt: new Date(),
    solution
  };
  
  this.statusHistory.push({
    status: 'resolved',
    changedBy: adminId,
    remark: solution
  });
  
  return this.save();
};

supportSchema.methods.close = async function(userId) {
  this.status = 'closed';
  this.closedAt = new Date();
  
  this.statusHistory.push({
    status: 'closed',
    changedBy: userId,
    remark: 'Ticket closed'
  });
  
  return this.save();
};

supportSchema.methods.addInternalNote = async function(adminId, note) {
  this.internalNotes.push({
    note,
    addedBy: adminId,
    addedAt: new Date()
  });
  
  return this.save();
};

supportSchema.methods.addFeedback = async function(rating, feedback) {
  if (this.resolution) {
    this.resolution.userSatisfaction = rating;
    this.resolution.feedback = feedback;
  }
  return this.save();
};

// ========== STATICS ==========
supportSchema.statics.getUserTickets = function(userId, page = 1, limit = 20) {
  return this.find({ user: userId })
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

supportSchema.statics.getAdminTickets = function(filters = {}, page = 1, limit = 20) {
  return this.find(filters)
    .populate('user', 'fullName uid')
    .populate('assignedTo', 'fullName')
    .sort({ priority: -1, createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

supportSchema.statics.getTicketStats = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgResolutionTime: {
          $avg: {
            $cond: [
              { $eq: ['$status', 'resolved'] },
              { $subtract: ['$resolution.resolvedAt', '$createdAt'] },
              null
            ]
          }
        }
      }
    }
  ]);
};

// ========== MIDDLEWARE ==========
supportSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Support = mongoose.models.Support || mongoose.model('Support', supportSchema);
export default Support;