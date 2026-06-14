import mongoose from 'mongoose';

import KYC_STATUS from '../Utils/constants.js';

const kycSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // ========== STATUS ==========
  status: {
    type: String,
    enum: Object.values(KYC_STATUS),
    default: KYC_STATUS.PENDING
  },

  // ========== PAN CARD ==========
  panCard: {
    number: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          return !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: 'Invalid PAN card number format'
      }
    },
    name: {
      type: String,
      trim: true
    },
    dateOfBirth: Date,
    image: {
      url: String,
      publicId: String,
      uploadedAt: Date
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date
  },

  // ========== AADHAR CARD ==========
  aadharCard: {
    number: {
      type: String,
      trim: true,
      validate: {
        validator: function(v) {
          return !v || /^\d{12}$/.test(v);
        },
        message: 'Invalid Aadhar card number format'
      }
    },
    name: {
      type: String,
      trim: true
    },
    dateOfBirth: Date,
    address: String,
    frontImage: {
      url: String,
      publicId: String,
      uploadedAt: Date
    },
    backImage: {
      url: String,
      publicId: String,
      uploadedAt: Date
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date
  },

  // ========== BANK DETAILS ==========
  bankDetails: {
    accountNumber: {
      type: String,
      trim: true
    },
    confirmAccountNumber: {
      type: String,
      trim: true
    },
    accountHolderName: {
      type: String,
      trim: true
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          return !v || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
        },
        message: 'Invalid IFSC code format'
      }
    },
    bankName: String,
    branchName: String,
    accountType: {
      type: String,
      enum: ['savings', 'current']
    },
    passbookImage: {
      url: String,
      publicId: String,
      uploadedAt: Date
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date
  },

  // ========== UPI DETAILS ==========
  upiDetails: {
    upiId: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^[\w.-]+@[\w]+$/.test(v);
        },
        message: 'Invalid UPI ID format'
      }
    },
    upiApp: {
      type: String,
      enum: ['google_pay', 'phonepe', 'paytm', 'bhim', 'other']
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date
  },

  // ========== VERIFICATION INFO ==========
  submittedAt: Date,
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectionReason: String,
  rejectionAt: Date,

  // ========== ADDITIONAL DOCUMENTS ==========
  additionalDocuments: [{
    documentType: {
      type: String,
      enum: ['driving_license', 'voter_id', 'passport', 'electricity_bill', 'other']
    },
    documentNumber: String,
    image: {
      url: String,
      publicId: String
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // ========== SELFIE VERIFICATION ==========
  selfie: {
    image: {
      url: String,
      publicId: String
    },
    uploadedAt: Date,
    verified: {
      type: Boolean,
      default: false
    }
  },

  // ========== NOTES ==========
  adminNotes: [{
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
  }
}, {
  timestamps: true
});

// ========== INDEXES ==========
// kycSchema.index({ user: 1 });
kycSchema.index({ status: 1 });
kycSchema.index({ 'panCard.number': 1 });
kycSchema.index({ 'aadharCard.number': 1 });
kycSchema.index({ submittedAt: -1 });

// ========== VIRTUALS ==========
kycSchema.virtual('isComplete').get(function() {
  return !!(this.panCard.number && 
            this.aadharCard.number && 
            this.bankDetails.accountNumber && 
            this.panCard.image?.url && 
            this.aadharCard.frontImage?.url);
});

kycSchema.virtual('isFullyVerified').get(function() {
  return this.status === KYC_STATUS.VERIFIED &&
         this.panCard.verified &&
         this.aadharCard.verified &&
         this.bankDetails.verified;
});

kycSchema.virtual('verificationProgress').get(function() {
  let total = 0;
  let completed = 0;
  
  // PAN
  total += 2;
  if (this.panCard.number) completed += 1;
  if (this.panCard.verified) completed += 1;
  
  // Aadhar
  total += 2;
  if (this.aadharCard.number) completed += 1;
  if (this.aadharCard.verified) completed += 1;
  
  // Bank
  total += 2;
  if (this.bankDetails.accountNumber) completed += 1;
  if (this.bankDetails.verified) completed += 1;
  
  return Math.round((completed / total) * 100);
});

// ========== METHODS ==========
kycSchema.methods.verify = async function(adminId) {
  this.status = KYC_STATUS.VERIFIED;
  this.verifiedAt = new Date();
  this.verifiedBy = adminId;
  
  // Mark all documents as verified
  if (this.panCard.number) {
    this.panCard.verified = true;
    this.panCard.verifiedAt = new Date();
  }
  if (this.aadharCard.number) {
    this.aadharCard.verified = true;
    this.aadharCard.verifiedAt = new Date();
  }
  if (this.bankDetails.accountNumber) {
    this.bankDetails.verified = true;
    this.bankDetails.verifiedAt = new Date();
  }
  if (this.upiDetails.upiId) {
    this.upiDetails.verified = true;
    this.upiDetails.verifiedAt = new Date();
  }
  
  return this.save();
};

kycSchema.methods.reject = async function(adminId, reason) {
  this.status = KYC_STATUS.REJECTED;
  this.rejectionReason = reason;
  this.rejectionAt = new Date();
  this.verifiedBy = adminId;
  
  return this.save();
};

// ========== MIDDLEWARE ==========
kycSchema.pre('save', function(next) {
  // Auto-set submission date when documents are added
  if (this.isModified('panCard.image') || 
      this.isModified('aadharCard.frontImage') || 
      this.isModified('aadharCard.backImage')) {
    if (!this.submittedAt) {
      this.submittedAt = new Date();
    }
  }
  
  this.updatedAt = Date.now();
  // next();
});

const KYC =  mongoose.models.KYC || mongoose.model('KYC', kycSchema);
export default KYC;