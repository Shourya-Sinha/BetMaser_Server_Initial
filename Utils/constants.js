// Application Constants
const USER_ROLES = {
    USER: 'user',
    ADMIN: 'admin',
    MANAGER: 'manager',
    SUPER_ADMIN: 'super_admin'
};

const GAME_TYPES = {
    CRICKET: 'cricket',
    FOOTBALL: 'football',
    TEENPATTI: 'teenpatti',
    LUDO: 'ludo',
    POKER: 'poker',
    RUMMY: 'rummy',
    OTHER: 'other'
};

const GAME_STATUS = {
    UPCOMING: 'upcoming',
    LIVE: 'live',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    PAUSED: 'paused'
};

const BET_TYPES = {
    MATCH_WINNER: 'match_winner',
    TOSS_WINNER: 'toss_winner',
    TOP_BATSMAN: 'top_batsman',
    TOP_BOWLER: 'top_bowler',
    TOTAL_RUNS: 'total_runs',
    TOTAL_WICKETS: 'total_wickets',
    MAN_OF_MATCH: 'man_of_match',
    FIRST_INNINGS_SCORE: 'first_innings_score',
    CUSTOM: 'custom'
};

const TRANSACTION_TYPES = {
    DEPOSIT: 'deposit',
    WITHDRAWAL: 'withdrawal',
    BET_PLACED: 'bet_placed',
    BET_WON: 'bet_won',
    BET_LOST: 'bet_lost',
    BET_REFUND: 'bet_refund',
    BONUS: 'bonus',
    REFERRAL_BONUS: 'referral_bonus',
    CASHBACK: 'cashback',
    COMMISSION: 'commission'
};

const TRANSACTION_STATUS = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded'
};

const PAYMENT_METHODS = {
    UPI: 'upi',
    BANK_TRANSFER: 'bank_transfer',
    PAYTM: 'paytm',
    PHONEPE: 'phonepe',
    GOOGLE_PAY: 'google_pay',
    RAZORPAY: 'razorpay'
};

const KYC_STATUS = {
    PENDING: 'pending',
    SUBMITTED: 'submitted',
    VERIFIED: 'verified',
    REJECTED: 'rejected'
};

const NOTIFICATION_TYPES = {
    GAME_START: 'game_start',
    GAME_END: 'game_end',
    BET_WON: 'bet_won',
    BET_LOST: 'bet_lost',
    DEPOSIT_SUCCESS: 'deposit_success',
    WITHDRAWAL_SUCCESS: 'withdrawal_success',
    KYC_VERIFIED: 'kyc_verified',
    REFERRAL_BONUS: 'referral_bonus',
    SYSTEM: 'system'
};

const COMMISSION_RATES = {
    CRICKET: 5, // 5%
    FOOTBALL: 5,
    TEENPATTI: 3,
    LUDO: 3,
    POKER: 4,
    RUMMY: 4
};

const MIN_MAX_AMOUNTS = {
    MIN_DEPOSIT: 100,
    MAX_DEPOSIT: 50000,
    MIN_WITHDRAWAL: 200,
    MAX_WITHDRAWAL: 20000,
    MIN_BET: 10,
    MAX_BET: 10000
};

export default {
    USER_ROLES,
    GAME_TYPES,
    GAME_STATUS,
    BET_TYPES,
    TRANSACTION_TYPES,
    TRANSACTION_STATUS,
    PAYMENT_METHODS,
    KYC_STATUS,
    NOTIFICATION_TYPES,
    COMMISSION_RATES,
    MIN_MAX_AMOUNTS
};