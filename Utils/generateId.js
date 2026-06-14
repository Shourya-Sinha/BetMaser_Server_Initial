import crypto from 'crypto';


class IDGenerator {
    // Generate unique user ID like BM-A3X9K2
    static generateUserId() {
        const prefix = 'BABSR';
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = '';
        for (let i = 0; i < 6; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${prefix}${id}`;
    }

    // Generate transaction reference
    static generateTransactionRef() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = crypto.randomBytes(3).toString('hex').toUpperCase();
        return `TXN${timestamp}${random}`;
    }

    // Generate game room code
    static generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Generate OTP
    static generateOTP(length = 6) {
        let otp = '';
        for (let i = 0; i < length; i++) {
            otp += Math.floor(Math.random() * 10);
        }
        return otp;
    }

    // Generate referral code
    static generateReferralCode(userId) {
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        return `REF${userId.slice(-4)}${random}`;
    }
}

export default IDGenerator;
