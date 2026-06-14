import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Wallet, GameStats, KYC, Security, Referral, Game, Player, Setting } from '../Models/index.js';
import PasswordUtils from '../Utils/passwordUtils.js';

dotenv.config();

const seedDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Clear existing data
        await Promise.all([
            User.deleteMany({}),
            Game.deleteMany({}),
            Player.deleteMany({}),
            Setting.deleteMany({})
        ]);
        
        // Create admin user
        const adminPassword = await PasswordUtils.hashPassword('Admin@123');
        const admin = await User.create({
            phone: '9999999999',
            password: adminPassword,
            fullName: 'Super Admin',
            role: 'super_admin',
            isVerified: true,
            isActive: true
        });
        
        // Create wallet for admin
        await Wallet.create({ user: admin._id });
        await GameStats.create({ user: admin._id });
        await KYC.create({ user: admin._id });
        await Security.create({ user: admin._id });
        await Referral.create({ user: admin._id });
        
        // Create test user
        const userPassword = await PasswordUtils.hashPassword('User@123');
        const user = await User.create({
            phone: '8888888888',
            password: userPassword,
            fullName: 'Test User',
            role: 'user',
            isVerified: true,
            isActive: true
        });
        
        await Wallet.create({ user: user._id });
        await GameStats.create({ user: user._id });
        await KYC.create({ user: user._id });
        await Security.create({ user: user._id });
        await Referral.create({ user: user._id });
        
        // Add money to test user
        const wallet = await Wallet.findOne({ user: user._id });
        wallet.mainBalance = 10000;
        await wallet.save();
        
        // Create sample players
        const players = [
            { name: 'Virat Kohli', shortName: 'V Kohli', primaryRole: 'batsman', currentTeam: { name: 'India' }, fantasyCredits: 10.5 },
            { name: 'Rohit Sharma', shortName: 'R Sharma', primaryRole: 'batsman', currentTeam: { name: 'India' }, fantasyCredits: 10 },
            { name: 'Jasprit Bumrah', shortName: 'J Bumrah', primaryRole: 'bowler', currentTeam: { name: 'India' }, fantasyCredits: 9.5 },
            { name: 'MS Dhoni', shortName: 'MS Dhoni', primaryRole: 'wicket-keeper', currentTeam: { name: 'India' }, fantasyCredits: 9 },
            { name: 'Hardik Pandya', shortName: 'H Pandya', primaryRole: 'all-rounder', currentTeam: { name: 'India' }, fantasyCredits: 9 },
        ];
        
        await Player.insertMany(players);
        
        // Create sample games
        await Game.create([
            {
                name: 'India vs Australia - 1st ODI',
                type: 'cricket',
                status: 'upcoming',
                startTime: new Date(Date.now() + 3600000),
                entryFee: 100,
                prizePool: 10000,
                maxPlayers: 100,
                teams: [
                    { name: 'India', shortName: 'IND' },
                    { name: 'Australia', shortName: 'AUS' }
                ],
                odds: { team1: 1.8, team2: 2.1 }
            },
            {
                name: 'Teen Patti Classic Room',
                type: 'teenpatti',
                status: 'live',
                startTime: new Date(),
                entryFee: 50,
                prizePool: 5000,
                maxPlayers: 6,
                currentPlayers: 3
            }
        ]);
        
        console.log('✅ Database seeded successfully!');
        console.log('Admin: 9999999999 / Admin@123');
        console.log('User: 8888888888 / User@123');
        
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
};

seedDatabase();