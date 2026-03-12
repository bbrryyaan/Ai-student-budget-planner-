import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    type: {
        type: String,
        enum: ["income", "expense"],
        default: "expense"
    },
    entryMode: {
        type: String,
        enum: ["demo", "actual"],
        default: "actual"
    },
    category: { type: String, default: "Other" },
    note: { type: String, default: "" },
    isSample: { type: Boolean, default: false },
    transactionDate: { type: Date, default: Date.now },
    isEssential: { type: Boolean, default: false },
    sdgImpact: {
        score: { type: Number, min: 1, max: 10 },
        description: { type: String, default: "SDG 12: Responsible Consumption" }
    },
    nudge: { type: String }, // The AI's advice string
    date: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("Expense", expenseSchema);
