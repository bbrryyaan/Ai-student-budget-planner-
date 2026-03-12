import fetch from "node-fetch";
import mongoose from "mongoose";
import User from "../models/user.js";
import Expense from "../models/expense.js";
import Goal from "../models/goal.js";

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  monthlyBudget: user.monthlyBudget,
  currency: user.currency,
});

export const convertCurrency = async (req, res) => {
    try {
        const { newCurrency } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const oldCurrency = user.currency;
        if (oldCurrency === newCurrency) {
            return res.status(200).json({ message: "Currency is already set to the desired one.", user: sanitizeUser(user) });
        }

        const response = await fetch(`https://api.frankfurter.app/latest?from=${oldCurrency}&to=${newCurrency}`);
        if (!response.ok) {
            return res.status(400).json({ message: "Failed to fetch exchange rate. The currency code may be invalid." });
        }
        const data = await response.json();
        const rate = data.rates[newCurrency];

        if (!rate) {
            return res.status(400).json({ message: `Invalid currency code: ${newCurrency}` });
        }

        // Use a transaction to ensure all updates are successful
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            // 1. Convert all transactions
            await Expense.updateMany({ userId }, { $mul: { amount: rate } }, { session });

            // 2. Convert all goals
            await Goal.updateMany({ userId }, { $mul: { targetAmount: rate, savedAmount: rate } }, { session });

            // 3. Convert monthly budget and update currency
            user.monthlyBudget *= rate;
            user.currency = newCurrency;
            await user.save({ session });

            await session.commitTransaction();
            res.status(200).json({ message: "Currency and all financial data converted successfully.", user: sanitizeUser(user) });

        } catch (error) {
            await session.abortTransaction();
            throw error; // Rethrow to be caught by outer catch block
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error("Currency conversion error:", error);
        res.status(500).json({ message: "An unexpected error occurred during currency conversion." });
    }
};
