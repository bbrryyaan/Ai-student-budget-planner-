import mongoose from "mongoose";

const goalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true, min: 1 },
    savedAmount: { type: Number, default: 0, min: 0 },
    targetDate: { type: Date, default: null },
    note: { type: String, default: "" },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model("Goal", goalSchema);
