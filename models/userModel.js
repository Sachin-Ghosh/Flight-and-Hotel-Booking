const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/.test(v);
      },
      message: props => `${props.value} is not a valid email!`
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  profile: {
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^[+]?[\d]{10,14}$/.test(v);
        },
        message: props => `${props.value} is not a valid phone number!`
      }
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER']
    },
    nationality: String,
    defaultCurrency: {
      type: String,
      enum: ['USD', 'EUR', 'GBP', 'INR'],
      default: 'USD'
    }
  },
  documents: [{
    type: {
      type: String,
      enum: ['PASSPORT', 'ID_CARD', 'DRIVING_LICENSE'],
      required: true
    },
    number: {
      type: String,
      required: true
    },
    issuingCountry: String,
    issueDate: Date,
    expiryDate: Date,
    fileUrl: String,
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING'
    }
  }],
  frequentFlyers: [{
    airline: {
      type: String,
      required: true
    },
    number: {
      type: String,
      required: true
    },
    tier: String
  }],
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false }
    },
    seatPreference: {
      type: String,
      enum: ['WINDOW', 'AISLE', 'NO_PREFERENCE'],
      default: 'NO_PREFERENCE'
    },
    mealPreference: {
      type: String,
      enum: ['REGULAR', 'VEGETARIAN', 'HALAL', 'KOSHER', 'NONE'],
      default: 'REGULAR'
    }
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'],
    default: 'ACTIVE'
  },
  verification: {
    email: {
      verified: { type: Boolean, default: false },
      token: String,
      expiresAt: Date
    },
    phone: {
      verified: { type: Boolean, default: false },
      otp: String,
      expiresAt: Date
    }
  },
  security: {
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    lastLogin: Date,
    lastPasswordChange: Date,
    sessions: [{
      token: String,
      deviceInfo: String,
      lastActive: Date,
      expiresAt: Date
    }]
  }
}, {
  timestamps: true
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    try {
        const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);