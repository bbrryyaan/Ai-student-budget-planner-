import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    refreshTokenHash: { type: String, default: null, select: false },
    monthlyBudget: { type: Number, required: true },
    currency: { type: String, default: "INR" }
}, { timestamps: true });

export default mongoose.model("User", userSchema);
