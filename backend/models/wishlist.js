import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    itemName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["radar", "bought"], default: "radar" },
    note: { type: String, default: "" },
    entryMode: { type: String, enum: ["actual", "demo"], default: "actual" },
  },
  { timestamps: true },
);

export default mongoose.model("Wishlist", wishlistSchema);
