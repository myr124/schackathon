import Account from '../models/account.model.js';
import mongoose from 'mongoose';

export const signUp = async (req, res) => {
    const account = req.body;
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const existingAccount = await Account.findOne({ email });
        if (existingAccount) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        const newAccount = new Account(account);
        await newAccount.save();
        res.status(201).json(newAccount);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const signIn = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const account = await Account.findOne({ email, password });
        if (!account) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }   
        res.status(200).json(account);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const getAccountById = async (req, res) => {
    
    try {
        const account = await Account.findById(req.params.id);
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.status(200).json(account);
    }
    catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ message: 'Invalid account ID' });
        }
        res.status(500).json({ message: error.message });
    }
}

export const updateAccount = async (req, res) => {
    try {
        const updatedAccount = await Account.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedAccount) {
            return res.status(404).json({ message: 'Account not found' });
        }
        res.status(200).json(updatedAccount);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            return res.status(400).json({ message: 'Invalid account ID' });
        }
        res.status(500).json({ message: error.message });
    }
}