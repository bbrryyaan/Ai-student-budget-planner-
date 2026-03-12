import Expense from "../models/expense.js";

const VALID_TYPES = ["income", "expense", "transfer"];
const VALID_MODES = ["demo", "actual"];
const DEFAULT_CATEGORIES = {
  income: ["Salary", "Freelance", "Investments", "Refund", "Gift", "Other"],
  expense: [
    "Food",
    "Transport",
    "Rent",
    "Utilities",
    "Shopping",
    "Health",
    "Entertainment",
    "Education",
    "Savings",
    "Other",
  ],
};

const normalizeType = (type) => (VALID_TYPES.includes(type) ? type : "expense");
const normalizeMode = (mode) => (VALID_MODES.includes(mode) ? mode : "actual");

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getMonthRange = (monthString) => {
  const fallbackDate = new Date();
  fallbackDate.setDate(1);
  fallbackDate.setHours(0, 0, 0, 0);

  if (!monthString) {
    const start = fallbackDate;
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  const [yearStr, monthStr] = monthString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    const start = fallbackDate;
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return { start, end };
  }

  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month, 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
};

const getDateBounds = (dateString) => {
  if (!dateString) return null;

  const selectedDate = new Date(dateString);
  if (Number.isNaN(selectedDate.getTime())) return null;

  const start = new Date(selectedDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(selectedDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const normalizeCategory = (type, category) => {
  const safeType = normalizeType(type);
  const categoryList = DEFAULT_CATEGORIES[safeType];

  if (categoryList.includes(category)) return category;
  return "Other";
};

const buildTransactionFilter = (req) => {
  const filter = { userId: req.user.id };
  const mode = req.query?.mode || req.body?.entryMode;
  const type = req.query?.type;
  const month = req.query?.month;
  const date = req.query?.date;
  const search = req.query?.search;

  const normalizedMode = normalizeMode(mode || "actual");
  if (normalizedMode === "demo") {
    filter.entryMode = "demo";
  } else {
    // Backward-compatible for records created before entryMode was introduced.
    filter.entryMode = { $ne: "demo" };
  }

  if (VALID_TYPES.includes(type)) {
    filter.type = type;
  }

  if (month) {
    const { start, end } = getMonthRange(month);
    filter.transactionDate = { $gte: start, $lt: end };
  }

  if (date) {
    const bounds = getDateBounds(date);
    if (bounds) {
      filter.transactionDate = { $gte: bounds.start, $lte: bounds.end };
    }
  }

  if (search?.trim()) {
    filter.description = { $regex: escapeRegex(search.trim()), $options: "i" };
  }

  return filter;
};

const normalizeTransactionPayload = (payload = {}, fallbackType = "expense") => {
  const type = normalizeType(payload.type || fallbackType);
  const amount = Number(payload.amount);
  const transactionDate = payload.transactionDate ? new Date(payload.transactionDate) : new Date();

  if (!payload.description?.trim()) {
    return { error: "Description is required" };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be greater than zero" };
  }

  if (Number.isNaN(transactionDate.getTime())) {
    return { error: "Transaction date is invalid" };
  }

  return {
    data: {
      description: payload.description.trim(),
      amount,
      type,
      category: normalizeCategory(type, payload.category),
      transactionDate,
      note: String(payload.note || "").trim(),
      isEssential: payload.isEssential !== undefined ? Boolean(payload.isEssential) : type === "expense",
      nudge: String(payload.nudge || "").trim(),
    },
  };
};

export const listTransactions = async (req, res) => {
  try {
    const transactions = await Expense.find(buildTransactionFilter(req)).sort({ transactionDate: -1, createdAt: -1 });
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
};

export const createTransaction = async (req, res) => {
  try {
    const normalized = normalizeTransactionPayload(req.body);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    const entryMode = normalizeMode(req.body.entryMode || "actual");
    const transaction = await Expense.create({
      userId: req.user.id,
      entryMode,
      ...normalized.data,
      sdgImpact: {
        score: normalized.data.type === "income" ? 9 : normalized.data.isEssential ? 7 : 5,
        description:
          normalized.data.type === "income"
            ? "Income transaction impact"
            : normalized.data.isEssential
              ? "Essential expense pattern"
              : "Discretionary expense pattern",
      },
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: "Failed to create transaction" });
  }
};

export const updateTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const existing = await Expense.findOne({ _id: transactionId, userId: req.user.id });

    if (!existing) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const mergedPayload = {
      description: req.body.description ?? existing.description,
      amount: req.body.amount ?? existing.amount,
      type: req.body.type ?? existing.type,
      category: req.body.category ?? existing.category,
      transactionDate: req.body.transactionDate ?? existing.transactionDate,
      note: req.body.note ?? existing.note,
      isEssential: req.body.isEssential ?? existing.isEssential,
      nudge: req.body.nudge ?? existing.nudge,
    };

    const normalized = normalizeTransactionPayload(mergedPayload, existing.type);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    const updated = await Expense.findOneAndUpdate(
      { _id: transactionId, userId: req.user.id },
      {
        ...normalized.data,
        category: normalizeCategory(normalized.data.type, mergedPayload.category),
      },
      { new: true },
    );

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update transaction" });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const deleted = await Expense.findOneAndDelete({ _id: transactionId, userId: req.user.id });

    if (!deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.status(200).json({ message: "Transaction deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete transaction" });
  }
};

export const clearTransactions = async (req, res) => {
  try {
    const result = await Expense.deleteMany(buildTransactionFilter(req));
    res.status(200).json({ message: "Transactions cleared", count: result.deletedCount || 0 });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear transactions" });
  }
};

export const getCalendarSummary = async (req, res) => {
  try {
    const { start, end } = getMonthRange(req.query.month);
    const mode = normalizeMode(req.query.mode || "actual");
    const filter = {
      userId: req.user.id,
      transactionDate: { $gte: start, $lt: end },
      entryMode: mode === "demo" ? "demo" : { $ne: "demo" },
    };

    const transactions = await Expense.find(filter).sort({ transactionDate: 1 });
    const dailyMap = transactions.reduce((acc, txn) => {
      const dateObj = new Date(txn.transactionDate);
      const dayKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(
        dateObj.getDate(),
      ).padStart(2, "0")}`;
      if (!acc[dayKey]) {
        acc[dayKey] = { income: 0, expense: 0, count: 0 };
      }

      if (txn.type === "income") {
        acc[dayKey].income += txn.amount;
      } else {
        acc[dayKey].expense += txn.amount;
      }
      acc[dayKey].count += 1;
      return acc;
    }, {});

    const summary = Object.entries(dailyMap).map(([date, stats]) => ({
      date,
      ...stats,
      net: Number((stats.income - stats.expense).toFixed(2)),
    }));

    res.status(200).json({
      monthStart: start,
      monthEnd: end,
      days: summary,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch calendar summary" });
  }
};

export const seedDemoData = async (req, res) => {
  try {
    const entryMode = normalizeMode(req.body?.entryMode || req.query?.mode || "actual");
    const now = new Date();
    const getDate = (dayOffset) => {
      const copy = new Date(now);
      copy.setDate(now.getDate() + dayOffset);
      return copy;
    };

    const demoData = [
      {
        userId: req.user.id,
        entryMode,
        type: "income",
        description: "Monthly Salary",
        amount: 45000,
        category: "Salary",
        transactionDate: getDate(-12),
        note: "Main salary credit",
        isSample: true,
      },
      {
        userId: req.user.id,
        entryMode,
        type: "income",
        description: "Freelance Design",
        amount: 8000,
        category: "Freelance",
        transactionDate: getDate(-4),
        note: "Weekend project payout",
        isSample: true,
      },
      {
        userId: req.user.id,
        entryMode,
        type: "expense",
        description: "Apartment Rent",
        amount: 16000,
        category: "Rent",
        transactionDate: getDate(-10),
        isEssential: true,
        nudge: "Fixed expense, keep it under 35% of monthly income.",
        isSample: true,
      },
      {
        userId: req.user.id,
        entryMode,
        type: "expense",
        description: "Groceries",
        amount: 3200,
        category: "Food",
        transactionDate: getDate(-8),
        isEssential: true,
        isSample: true,
      },
      {
        userId: req.user.id,
        entryMode,
        type: "expense",
        description: "Streaming Subscription",
        amount: 599,
        category: "Entertainment",
        transactionDate: getDate(-5),
        isEssential: false,
        isSample: true,
      },
      {
        userId: req.user.id,
        entryMode,
        type: "expense",
        description: "Metro Card Recharge",
        amount: 1200,
        category: "Transport",
        transactionDate: getDate(-2),
        isEssential: true,
        isSample: true,
      },
    ];

    await Expense.insertMany(demoData);
    res.status(200).json({ message: "Demo data seeded", count: demoData.length });
  } catch (error) {
    res.status(500).json({ message: "Failed to seed data" });
  }
};

// Legacy aliases kept for backward compatibility with older frontend paths.
export const getHistory = listTransactions;
export const createManualExpense = createTransaction;
export const updateExpense = updateTransaction;
export const deleteExpense = deleteTransaction;
export const clearExpenses = clearTransactions;
