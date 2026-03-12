import { GoogleGenerativeAI } from "@google/generative-ai";
import Expense from "../models/expense.js";
import Goal from "../models/goal.js";
import User from "../models/user.js";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY || process.env["GEMINI_API+KEY"] || process.env.GEMINI_KEY || "";

const roundToTwo = (value) => Number((Number(value) || 0).toFixed(2));

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getMonthRange = (monthString) => {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (monthString) {
    const [yearStr, monthStr] = String(monthString).split("-");
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

const buildCoachPrompt = ({ metrics, topCategories, goals }) => `You are a strict but supportive AI budgeting coach for students in India.
Return STRICT JSON only.

Context:
${JSON.stringify({ metrics, topCategories, goals })}

Output schema:
{
  "summary": "short paragraph",
  "wins": ["max 3 short bullets"],
  "risks": ["max 3 short bullets"],
  "actionPlan": ["exactly 4 short steps for next 7 days"],
  "challenge": "single habit challenge"
}`;

const buildFallbackCoach = ({ metrics, topCategories, goals }) => {
  const biggestCategory = topCategories[0]?.category || "Daily expenses";
  const goalNeed = roundToTwo(goals.reduce((sum, goal) => sum + Number(goal.monthlyRequired || 0), 0));
  const buffer = roundToTwo(Math.max(metrics.netBalance - goalNeed, 0));

  return {
    summary:
      metrics.netBalance >= 0
        ? `You are currently cash-flow positive. Protect this by capping ${biggestCategory} and locking savings first.`
        : `You are currently cash-flow negative. Stabilize by reducing ${biggestCategory} and delaying non-essential spends.`,
    wins: [
      `This month income: ${roundToTwo(metrics.totalIncome)}`,
      `Essential spend ratio: ${roundToTwo(metrics.essentialRatio)}%`,
      `Goal progress tracked across ${goals.length} active goal(s).`,
    ],
    risks: [
      `Top spend category is ${biggestCategory}.`,
      `Budget usage is ${roundToTwo(metrics.budgetUsagePercent)}%.`,
      goalNeed > 0 ? `Monthly goal requirement is ${goalNeed}.` : "No monthly goal target has been set yet.",
    ],
    actionPlan: [
      "Set a weekly spending cap and track it daily.",
      `Reduce ${biggestCategory} spend by at least 10% this month.`,
      "Auto-transfer savings on income day before discretionary spending.",
      "Review transactions every Sunday and label one avoidable spend pattern.",
    ],
    challenge: buffer > 0 ? `No-spend challenge for 2 days to preserve ${buffer} buffer.` : "No online impulse purchases for 7 days.",
  };
};

const getCoachInsights = async ({ metrics, topCategories, goals }) => {
  const fallback = buildFallbackCoach({ metrics, topCategories, goals });
  const apiKey = getGeminiApiKey();

  if (!apiKey) return fallback;

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(buildCoachPrompt({ metrics, topCategories, goals }));
    const parsed = safeJsonParse(result.response.text());
    if (!parsed) return fallback;

    const normalizeList = (value, max = 4) =>
      Array.isArray(value)
        ? value
            .map((line) => String(line || "").trim())
            .filter(Boolean)
            .slice(0, max)
        : [];

    return {
      summary: String(parsed.summary || fallback.summary),
      wins: normalizeList(parsed.wins, 3).length ? normalizeList(parsed.wins, 3) : fallback.wins,
      risks: normalizeList(parsed.risks, 3).length ? normalizeList(parsed.risks, 3) : fallback.risks,
      actionPlan: normalizeList(parsed.actionPlan, 4).length ? normalizeList(parsed.actionPlan, 4) : fallback.actionPlan,
      challenge: String(parsed.challenge || fallback.challenge),
    };
  } catch {
    return fallback;
  }
};

const scoreClamp = (value) => Math.max(0, Math.min(100, roundToTwo(value)));

const toGoalTimeline = (goal, referenceDate) => {
  const remainingAmount = Math.max((goal.targetAmount || 0) - (goal.savedAmount || 0), 0);
  if (remainingAmount <= 0) {
    return {
      goalId: String(goal._id),
      title: goal.title,
      remainingAmount: 0,
      monthsLeft: 1,
      monthlyRequired: 0,
      progressPercent: 100,
    };
  }

  const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
  let monthsLeft = 6;
  if (targetDate && !Number.isNaN(targetDate.getTime())) {
    const diffYears = targetDate.getFullYear() - referenceDate.getFullYear();
    const diffMonths = targetDate.getMonth() - referenceDate.getMonth();
    monthsLeft = Math.max(diffYears * 12 + diffMonths + 1, 1);
  }

  return {
    goalId: String(goal._id),
    title: goal.title,
    remainingAmount: roundToTwo(remainingAmount),
    monthsLeft,
    monthlyRequired: roundToTwo(remainingAmount / monthsLeft),
    progressPercent: scoreClamp((Number(goal.savedAmount || 0) / Number(goal.targetAmount || 1)) * 100),
  };
};

export const getAiBudgetBrief = async (req, res) => {
  try {
    const mode = req.query.mode === "demo" ? "demo" : "actual";
    const { start, end } = getMonthRange(req.query.month);

    const [transactions, goals, user] = await Promise.all([
      Expense.find({
        userId: req.user.id,
        entryMode: mode === "demo" ? "demo" : { $ne: "demo" },
        transactionDate: { $gte: start, $lt: end },
      }),
      Goal.find({ userId: req.user.id, isArchived: false }),
      User.findById(req.user.id),
    ]);

    const expenses = transactions.filter((txn) => txn.type !== "income");
    const incomes = transactions.filter((txn) => txn.type === "income");

    const totalIncome = incomes.reduce((sum, txn) => sum + txn.amount, 0);
    const totalExpenses = expenses.reduce((sum, txn) => sum + txn.amount, 0);
    const essentialSpend = expenses.filter((txn) => txn.isEssential).reduce((sum, txn) => sum + txn.amount, 0);
    const netBalance = totalIncome - totalExpenses;

    const monthlyBudget = Number(user?.monthlyBudget || 0);
    const budgetUsagePercent = monthlyBudget > 0 ? (totalExpenses / monthlyBudget) * 100 : 0;
    const essentialRatio = totalExpenses > 0 ? (essentialSpend / totalExpenses) * 100 : 0;

    const categoryMap = expenses.reduce((acc, txn) => {
      const key = txn.category || "Other";
      acc[key] = (acc[key] || 0) + Number(txn.amount || 0);
      return acc;
    }, {});

    const topCategories = Object.entries(categoryMap)
      .map(([category, amount]) => ({ category, amount: roundToTwo(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const goalsTimeline = goals.map((goal) => toGoalTimeline(goal, start));
    const monthlyGoalNeed = goalsTimeline.reduce((sum, goal) => sum + Number(goal.monthlyRequired || 0), 0);

    const disciplineScore = scoreClamp(100 - budgetUsagePercent * 0.75);
    const savingsScore = scoreClamp(totalIncome > 0 ? (Math.max(netBalance, 0) / totalIncome) * 100 : 20);
    const goalScore = goalsTimeline.length
      ? scoreClamp(goalsTimeline.reduce((sum, goal) => sum + goal.progressPercent, 0) / goalsTimeline.length)
      : 55;
    const overallScore = scoreClamp(disciplineScore * 0.35 + savingsScore * 0.35 + goalScore * 0.3);

    const metrics = {
      totalIncome: roundToTwo(totalIncome),
      totalExpenses: roundToTwo(totalExpenses),
      netBalance: roundToTwo(netBalance),
      essentialSpend: roundToTwo(essentialSpend),
      essentialRatio: roundToTwo(essentialRatio),
      monthlyBudget: roundToTwo(monthlyBudget),
      budgetUsagePercent: roundToTwo(budgetUsagePercent),
      monthlyGoalNeed: roundToTwo(monthlyGoalNeed),
      transactionCount: transactions.length,
    };

    const coach = await getCoachInsights({ metrics, topCategories, goals: goalsTimeline });

    return res.status(200).json({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      currency: user?.currency || "INR",
      scorecard: {
        overall: overallScore,
        spendingDiscipline: disciplineScore,
        savingsStability: savingsScore,
        goalMomentum: goalScore,
      },
      metrics,
      topCategories,
      goals: goalsTimeline,
      coach,
    });
  } catch {
    return res.status(500).json({ message: "Failed to generate AI budget brief" });
  }
};
