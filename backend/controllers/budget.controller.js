import Expense from "../models/expense.js";
import User from "../models/user.js";

const getMonthRange = (monthString) => {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (monthString) {
    const [yearStr, monthStr] = monthString.split("-");
    const parsedYear = Number(yearStr);
    const parsedMonth = Number(monthStr);

    if (Number.isInteger(parsedYear) && Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
      year = parsedYear;
      month = parsedMonth;
    }
  }

  const start = new Date(year, month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(year, month, 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
};

export const getDashboardStats = async (req, res) => {
  try {
    const mode = req.query.mode === "demo" ? "demo" : "actual";
    const month = req.query.month;
    const { start, end } = getMonthRange(month);

    const filter = {
      userId: req.user.id,
      entryMode: mode === "demo" ? "demo" : { $ne: "demo" },
      transactionDate: { $gte: start, $lt: end },
    };

    const [transactions, user] = await Promise.all([
      Expense.find(filter),
      User.findById(req.user.id),
    ]);

    const totalIncome = transactions
      .filter((txn) => txn.type === "income")
      .reduce((sum, txn) => sum + txn.amount, 0);
    const totalExpenses = transactions
      .filter((txn) => txn.type !== "income")
      .reduce((sum, txn) => sum + txn.amount, 0);
    const essentialSpend = transactions
      .filter((txn) => txn.type !== "income" && txn.isEssential)
      .reduce((sum, txn) => sum + txn.amount, 0);

    const netBalance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;
    const averageTransactionValue = transactions.length > 0 ? (totalIncome + totalExpenses) / transactions.length : 0;
    const monthlyBudget = Number(user?.monthlyBudget || 0);
    const budgetUsagePercent = monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;

    res.status(200).json({
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      netBalance: Number(netBalance.toFixed(2)),
      essentialSpend: Number(essentialSpend.toFixed(2)),
      savingsRate: Number(savingsRate.toFixed(2)),
      transactionCount: transactions.length,
      averageTransactionValue: Number(averageTransactionValue.toFixed(2)),
      monthlyBudget,
      budgetUsagePercent: Number(budgetUsagePercent.toFixed(2)),
      // Legacy keys for old frontend compatibility.
      totalSpent: Number(totalExpenses.toFixed(2)),
      savingsPotential: Number(Math.max(totalIncome - essentialSpend, 0).toFixed(2)),
      sustainabilityIndex: 0,
      monthStart: start,
      monthEnd: end,
    });
  } catch (error) {
    res.status(500).json({ error: "Analysis failed" });
  }
};

//$$$$$$
export const getAnalysisSummary = async (req, res) => {
  try {
    const mode = req.query.mode === "demo" ? "demo" : "actual";
    const month = req.query.month;
    const { start, end } = getMonthRange(month);

    const filter = {
      userId: req.user.id,
      entryMode: mode === "demo" ? "demo" : { $ne: "demo" },
      transactionDate: { $gte: start, $lt: end },
      type: "expense",
    };

    const analysis = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
        },
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          total: "$total",
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.status(200).json(analysis);
  } catch (error) {
    console.error("Analysis summary failed:", error);
    res.status(500).json({ error: "Failed to get analysis summary" });
  }
};
//$$$$$$
