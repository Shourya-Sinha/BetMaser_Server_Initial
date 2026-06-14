# 🎮 BetMaster - Ultimate Sports Betting & Fantasy Gaming Platform

<div align="center">

![BetMaster Banner](https://img.shields.io/badge/BetMaster-Play%20%7C%20Predict%20%7C%20Win-4CAF50?style=for-the-badge&logo=gamepad&logoColor=white)

[![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB?style=flat-square&logo=react)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=flat-square&logo=socket.io)](https://socket.io/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](LICENSE)

</div>

---

## 📸 App Preview

<div align="center">

| Dashboard | Games | Live Betting | Wallet |
|:---:|:---:|:---:|:---:|
| 🏠 Modern UI | 🏏 Live Cricket | 💰 Place Bets | 💳 Payments |

</div>

---

## 🚀 Features

### 🎯 Core Features
- ✅ **Multi-Sport Betting** - Cricket, Football, Teen Patti, Ludo, Poker & Rummy
- ✅ **Live Match Data** - Real-time cricket scores via CricAPI
- ✅ **Fantasy Team Creation** - Dream11-style team building
- ✅ **Secure Wallet** - Deposit, withdraw, transaction history
- ✅ **KYC Verification** - Identity verification system
- ✅ **Real-time Updates** - Socket.io live score broadcasting
- ✅ **Multi-language** - English, Hindi, Chinese support

### 🎨 UI/UX
- ✅ **Modern Animated Design** - Glassmorphism, gradients, floating orbs
- ✅ **3D Backgrounds** - Interactive sports-themed animations
- ✅ **Dark Theme** - Eye-friendly dark color scheme
- ✅ **Pull-to-Refresh** - Smooth refresh animations
- ✅ **Skeleton Loading** - Beautiful loading states
- ✅ **Haptic Feedback** - Tactile responses

### 🔐 Security
- ✅ **JWT Authentication** - Access & refresh token system
- ✅ **Argon2 Password Hashing** - Military-grade encryption
- ✅ **Rate Limiting** - API protection
- ✅ **Input Sanitization** - NoSQL injection prevention
- ✅ **Session Management** - Multi-device support

---

## 🛠️ Tech Stack

### Frontend (Mobile App)
| Technology | Purpose |
|------------|---------|
| React Native 0.74 | Cross-platform mobile framework |
| TypeScript | Type-safe development |
| NativeWind (Tailwind) | Utility-first styling |
| React Navigation 7 | Screen navigation |
| Zustand | State management |
| Socket.io Client | Real-time communication |
| Axios | HTTP client |
| React Native Vector Icons | Icon library |
| Framer Motion | Animations |

### Backend (API Server)
| Technology | Purpose |
|------------|---------|
| Node.js 20 | JavaScript runtime |
| Express.js | Web framework |
| MongoDB 7 | NoSQL database |
| Mongoose | ODM for MongoDB |
| Socket.io | WebSocket server |
| JWT | Authentication |
| Redis | Caching & sessions |
| Argon2 | Password hashing |

---

## 📦 Installation

### Prerequisites
- Node.js 18+
- MongoDB 7+
- Redis (optional)
- Android Studio / Xcode

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/betmaster.git
cd betmaster

# Install backend dependencies
cd server
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start backend server
npm run dev

# In another terminal, install frontend dependencies
cd ../BettingApp
npm install

# Start React Native
npm run dev