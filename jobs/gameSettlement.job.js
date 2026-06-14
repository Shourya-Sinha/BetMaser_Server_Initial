import { Game, Bet, Wallet, Transaction, GameStats, Notification } from '../Models/index.js';
import CLOG from '../Utils/Clog.js';

class GameSettlementJob {
    
    /**
     * Auto-settle expired games
     * Runs every 5 minutes
     */
    static async settleExpiredGames() {
        try {
            // Find games that ended but not yet settled
            const expiredGames = await Game.find({
                status: 'live',
                endTime: { $lte: new Date() }
            });
            
            for (const game of expiredGames) {
                CLOG.info(`Auto-settling expired game: ${game.name}`);
                
                // Mark game as completed
                game.status = 'completed';
                game.actualEndTime = new Date();
                await game.save();
                
                // Refund all active bets
                const activeBets = await Bet.find({ 
                    game: game._id, 
                    status: 'active' 
                });
                
                for (const bet of activeBets) {
                    await bet.refund();
                    
                    // Refund to wallet
                    const wallet = await Wallet.findOne({ user: bet.user });
                    await wallet.addMoney(bet.amount, 'main');
                    
                    // Create refund transaction
                    await Transaction.create({
                        user: bet.user,
                        type: 'bet_refund',
                        amount: bet.amount,
                        netAmount: bet.amount,
                        balanceBefore: wallet.mainBalance - bet.amount,
                        balanceAfter: wallet.mainBalance,
                        status: 'completed',
                        game: game._id,
                        bet: bet._id,
                        description: `Bet refunded - Game expired: ${game.name}`
                    });
                    
                    // Notify user
                    await Notification.create({
                        user: bet.user,
                        type: 'bet_refund',
                        title: 'Bet Refunded',
                        message: `Your bet of ₹${bet.amount} on ${game.name} has been refunded as the game was not settled in time.`,
                        game: game._id,
                        priority: 'medium'
                    });
                }
                
                CLOG.success(`Settled game: ${game.name} (${activeBets.length} bets refunded)`);
            }
        } catch (error) {
            CLOG.error('Game settlement job failed:', error);
        }
    }
    
    /**
     * Cancel games that didn't meet minimum players
     */
    static async cancelUnderfilledGames() {
        try {
            const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes before start
            
            const underfilledGames = await Game.find({
                status: 'upcoming',
                startTime: { $lte: cutoffTime },
                $expr: { $lt: ['$currentPlayers', '$minPlayers'] }
            });
            
            for (const game of underfilledGames) {
                CLOG.info(`Cancelling underfilled game: ${game.name}`);
                
                game.status = 'cancelled';
                await game.save();
                
                // Refund all participants
                const bets = await Bet.find({ game: game._id, status: 'active' });
                
                for (const bet of bets) {
                    await bet.refund();
                    
                    const wallet = await Wallet.findOne({ user: bet.user });
                    await wallet.addMoney(bet.amount, 'main');
                    
                    await Transaction.create({
                        user: bet.user,
                        type: 'bet_refund',
                        amount: bet.amount,
                        netAmount: bet.amount,
                        balanceBefore: wallet.mainBalance - bet.amount,
                        balanceAfter: wallet.mainBalance,
                        status: 'completed',
                        game: game._id,
                        bet: bet._id,
                        description: `Refund - Game cancelled: ${game.name}`
                    });
                }
            }
        } catch (error) {
            CLOG.error('Game cancellation job failed:', error);
        }
    }
    
    /**
     * Clean up inactive live game rooms
     */
    static async cleanupInactiveRooms() {
        try {
            const { LiveGame } = await import('../Models/index.js');
            
            const inactiveTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
            
            const inactiveRooms = await LiveGame.find({
                state: { $in: ['waiting', 'in_progress'] },
                updatedAt: { $lte: inactiveTime }
            });
            
            for (const room of inactiveRooms) {
                room.state = 'cancelled';
                await room.save();
                CLOG.info(`Cleaned up inactive room: ${room.roomCode}`);
            }
        } catch (error) {
            CLOG.error('Room cleanup job failed:', error);
        }
    }
}

export default GameSettlementJob;