import Expense from "../models/expense.js";
import Goal from "../models/goal.js";

const normalizeGoalPayload = (payload = {}) => {
  const title = String(payload.title || "").trim();
  const targetAmount = Number(payload.targetAmount);
  const savedAmount =
    payload.savedAmount === undefined || payload.savedAmount === null ? 0 : Number(payload.savedAmount);
  const note = String(payload.note || "").trim();
  const targetDate = payload.targetDate ? new Date(payload.targetDate) : null;

  if (!title) {
    return { error: "Goal title is required" };
  }

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { error: "Target amount must be greater than zero" };
  }

  if (!Number.isFinite(savedAmount) || savedAmount < 0) {
    return { error: "Saved amount cannot be negative" };
  }

  if (targetDate && Number.isNaN(targetDate.getTime())) {
    return { error: "Goal target date is invalid" };
  }

  return {
    data: {
      title,
      targetAmount,
      savedAmount,
      targetDate,
      note,
    },
  };
};

const toResponseGoal = (goal) => {
  const raw = typeof goal?.toObject === "function" ? goal.toObject() : goal;
  const remainingAmount = Math.max(raw.targetAmount - raw.savedAmount, 0);
  const progressPercent = raw.targetAmount > 0 ? (raw.savedAmount / raw.targetAmount) * 100 : 0;
  return {
    ...raw,
    remainingAmount: Number(remainingAmount.toFixed(2)),
    progressPercent: Number(Math.min(progressPercent, 100).toFixed(2)),
    isCompleted: remainingAmount <= 0,
  };
};

export const listGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ userId: req.user.id, isArchived: false }).sort({ createdAt: -1 });
    res.status(200).json(goals.map((goal) => toResponseGoal(goal)));
  } catch (error) {
    res.status(500).json({ message: "Failed to load goals" });
  }
};

export const createGoal = async (req, res) => {
  try {
    const normalized = normalizeGoalPayload(req.body);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    const goal = await Goal.create({
      userId: req.user.id,
      ...normalized.data,
    });

    res.status(201).json(toResponseGoal(goal));
  } catch (error) {
    res.status(500).json({ message: "Failed to create goal" });
  }
};

export const updateGoal = async (req, res) => {
  try {
    const { goalId } = req.params;
    const existing = await Goal.findOne({ _id: goalId, userId: req.user.id, isArchived: false });
    if (!existing) {
      return res.status(404).json({ message: "Goal not found" });
    }

    const mergedPayload = {
      title: req.body.title ?? existing.title,
      targetAmount: req.body.targetAmount ?? existing.targetAmount,
      savedAmount: req.body.savedAmount ?? existing.savedAmount,
      targetDate: req.body.targetDate ?? existing.targetDate,
      note: req.body.note ?? existing.note,
    };

    const normalized = normalizeGoalPayload(mergedPayload);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    const updated = await Goal.findOneAndUpdate(
      { _id: goalId, userId: req.user.id, isArchived: false },
      normalized.data,
      { new: true },
    );

    res.status(200).json(toResponseGoal(updated));
  } catch (error) {
    res.status(500).json({ message: "Failed to update goal" });
  }
};

export const contributeToGoal = async (req, res) => {
  try {
    const { goalId } = req.params;
    const contributionAmount = Number(req.body.amount);
    const contributionDate = req.body.transactionDate ? new Date(req.body.transactionDate) : new Date();

    if (!Number.isFinite(contributionAmount) || contributionAmount <= 0) {
      return res.status(400).json({ message: "Contribution amount must be greater than zero" });
    }

    if (Number.isNaN(contributionDate.getTime())) {
      return res.status(400).json({ message: "Contribution date is invalid" });
    }

    const goal = await Goal.findOne({ _id: goalId, userId: req.user.id, isArchived: false });
    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    goal.savedAmount = Number((goal.savedAmount + contributionAmount).toFixed(2));
    await goal.save();

    // Record contribution as a dedicated expense so monthly cashflow remains accurate.
    await Expense.create({
      userId: req.user.id,
      entryMode: "actual",
      type: "expense",
      description: `Savings transfer: ${goal.title}`,
      amount: contributionAmount,
      category: "Savings",
      transactionDate: contributionDate,
      note: String(req.body.note || "Saved toward goal"),
      isEssential: true,
      nudge: "Consistent contributions make big goals easier.",
    });

    res.status(200).json({
      message: "Contribution added",
      goal: toResponseGoal(goal),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add contribution" });
  }
};

export const deleteGoal = async (req, res) => {
  try {
    const { goalId } = req.params;
    const deleted = await Goal.findOneAndUpdate(
      { _id: goalId, userId: req.user.id, isArchived: false },
      { isArchived: true },
      { new: true },
    );

    if (!deleted) {
      return res.status(404).json({ message: "Goal not found" });
    }

    res.status(200).json({ message: "Goal archived" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete goal" });
  }
};
