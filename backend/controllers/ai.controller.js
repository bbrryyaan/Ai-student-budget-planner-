import { GoogleGenerativeAI } from "@google/generative-ai";
import Expense from "../models/expense.js";
import Goal from "../models/goal.js";
import User from "../models/user.js";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY || process.env["GEMINI_API+KEY"] || process.env.GEMINI_KEY || "";

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const fallbackAiData = (type = "expense") => ({
  type,
  category: type === "income" ? "Other" : "Other",
  isEssential: type !== "income",
  note: "Saved with default AI fallback.",
  nudge:
    type === "income"
      ? "Set aside a fixed share of this income into savings."
      : "Track this expense against your monthly spending target.",
  sdgScore: type === "income" ? 8 : 5,
});

const buildPrompt = ({ description, amount, transactionDate }) => `You are a personal budgeting assistant.
Classify this transaction and return STRICT JSON only.

Transaction:
- description: "${description}"
- amount: ${amount}
- transactionDate: "${transactionDate}"

Output JSON schema:
{
  "type": "income" | "expense",
  "category": "Salary|Freelance|Investments|Refund|Gift|Food|Transport|Rent|Utilities|Shopping|Health|Entertainment|Education|Savings|Tuition|Books|Hostel|Mess|Data/Internet|Other",
  "isEssential": boolean,
  "note": "short string",
  "nudge": "short actionable budgeting advice",
  "sdgScore": number (1-10)
}`;

const getMonthRangeFromDate = (dateValue) => {
  const reference = new Date(dateValue || Date.now());
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
};

const roundToTwo = (value) => Number((Number(value) || 0).toFixed(2));

const toGoalTimeline = (goal, referenceDate) => {
  const remainingAmount = Math.max((goal.targetAmount || 0) - (goal.savedAmount || 0), 0);

  if (remainingAmount <= 0) {
    return {
      goalId: String(goal._id),
      title: goal.title,
      remainingAmount: 0,
      monthsLeft: 1,
      monthlyRequired: 0,
      targetDate: goal.targetDate || null,
    };
  }

  if (!goal.targetDate) {
    const fallbackMonths = 6;
    return {
      goalId: String(goal._id),
      title: goal.title,
      remainingAmount: roundToTwo(remainingAmount),
      monthsLeft: fallbackMonths,
      monthlyRequired: roundToTwo(remainingAmount / fallbackMonths),
      targetDate: null,
    };
  }

  const targetDate = new Date(goal.targetDate);
  const diffYears = targetDate.getFullYear() - referenceDate.getFullYear();
  const diffMonths = targetDate.getMonth() - referenceDate.getMonth();
  const monthsLeft = Math.max(diffYears * 12 + diffMonths + 1, 1);

  return {
    goalId: String(goal._id),
    title: goal.title,
    remainingAmount: roundToTwo(remainingAmount),
    monthsLeft,
    monthlyRequired: roundToTwo(remainingAmount / monthsLeft),
    targetDate,
  };
};

const buildAffordabilityPrompt = ({ itemName, amount, context, goalRows }) => `You are a strict Student Financial Coach.
Return STRICT JSON only.

Item: "${itemName}" | Price: ₹${amount}

Financial Reality:
- Monthly Pocket Money/Income: ₹${context.totalIncome}
- Already Spent This Month: ₹${context.totalExpenses}
- Savings Goals Commitment: ₹${context.goalMonthlyNeed}
- Safe Daily Spending Limit: ₹${Number(context.budgetRemaining / 15).toFixed(0)} (est.)
- Net Cash in Hand: ₹${context.netBalance}

Rules:
1. If the purchase consumes > 20% of their monthly "In Hand" cash and they have goals, be cautious.
2. If they have already overspent their monthly budget (usage > 100%), say NO unless essential.
3. Be funny, relatable, and use typical student logic (e.g., "That's 40 packs of Maggi").

Output JSON:
{
  "canAfford": boolean,
  "confidence": "high" | "medium" | "low",
  "riskLevel": "low" | "medium" | "high",
  "summary": "one witty student-centric sentence",
  "reasoning": ["max 3 short bullets"],
  "recommendedAction": "e.g., Add to Wishlist / Wait until next month / Go for it",
  "spendCap": number,
  "suggestedMonthlySavings": number
}`;

const getAffordabilityFallback = (heuristic) => ({
  canAfford: heuristic.canAfford,
  confidence: heuristic.confidence,
  riskLevel: heuristic.riskLevel,
  summary: heuristic.summary,
  reasoning: heuristic.reasoning,
  recommendedAction: heuristic.recommendedAction,
  spendCap: heuristic.spendCap,
  suggestedMonthlySavings: heuristic.suggestedMonthlySavings,
});

const getAffordabilityDecision = async ({ itemName, amount, context, goalRows, heuristic }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return getAffordabilityFallback(heuristic);
  }

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = buildAffordabilityPrompt({ itemName, amount, context, goalRows });
    const result = await model.generateContent(prompt);
    const parsed = safeJsonParse(result.response.text());
    if (!parsed) {
      return getAffordabilityFallback(heuristic);
    }

    const safeCanAfford = typeof parsed.canAfford === "boolean" ? parsed.canAfford : heuristic.canAfford;
    const safeConfidence = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : heuristic.confidence;
    const safeRisk = ["low", "medium", "high"].includes(parsed.riskLevel) ? parsed.riskLevel : heuristic.riskLevel;
    const safeReasoning = Array.isArray(parsed.reasoning)
      ? parsed.reasoning
          .map((line) => String(line || "").trim())
          .filter(Boolean)
          .slice(0, 3)
      : heuristic.reasoning;

    return {
      canAfford: safeCanAfford,
      confidence: safeConfidence,
      riskLevel: safeRisk,
      summary: String(parsed.summary || heuristic.summary),
      reasoning: safeReasoning.length ? safeReasoning : heuristic.reasoning,
      recommendedAction: String(parsed.recommendedAction || heuristic.recommendedAction),
      spendCap: Number.isFinite(Number(parsed.spendCap)) ? roundToTwo(parsed.spendCap) : heuristic.spendCap,
      suggestedMonthlySavings: Number.isFinite(Number(parsed.suggestedMonthlySavings))
        ? roundToTwo(parsed.suggestedMonthlySavings)
        : heuristic.suggestedMonthlySavings,
    };
  } catch (error) {
    return getAffordabilityFallback(heuristic);
  }
};

const getAiClassification = async ({ description, amount, transactionDate, defaultType = "expense" }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return fallbackAiData(defaultType);
  }

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(buildPrompt({ description, amount, transactionDate }));
    const parsed = safeJsonParse(result.response.text());

    if (!parsed) return fallbackAiData(defaultType);

    return {
      type: parsed.type === "income" ? "income" : "expense",
      category:
        typeof parsed.category === "string" && parsed.category.trim()
          ? parsed.category.trim().slice(0, 40)
          : "Other",
      isEssential: Boolean(parsed.isEssential),
      note: typeof parsed.note === "string" ? parsed.note : "",
      nudge: typeof parsed.nudge === "string" ? parsed.nudge : "",
      sdgScore:
        Number.isFinite(Number(parsed.sdgScore)) && Number(parsed.sdgScore) >= 1 && Number(parsed.sdgScore) <= 10
          ? Number(parsed.sdgScore)
          : 5,
    };
  } catch (error) {
    return fallbackAiData(defaultType);
  }
};

export const createSmartTransaction = async (req, res) => {
  try {
    const { description, amount, transactionDate, entryMode, type, paymentMode } = req.body;
    const parsedAmount = Number(amount);

    if (!description?.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Valid description and amount are required" });
    }

    const safeDate = transactionDate ? new Date(transactionDate) : new Date();
    if (Number.isNaN(safeDate.getTime())) {
      return res.status(400).json({ message: "Transaction date is invalid" });
    }

    const validPaymentMode = ["cash", "upi", "savings"].includes(paymentMode) ? paymentMode : "upi";

    const aiData = await getAiClassification({
      description: description.trim(),
      amount: parsedAmount,
      transactionDate: safeDate.toISOString(),
      defaultType: type === "income" ? "income" : "expense",
    });

    const savedTransaction = await Expense.create({
      userId: req.user.id,
      entryMode: entryMode === "demo" ? "demo" : "actual",
      description: description.trim(),
      amount: parsedAmount,
      paymentMode: validPaymentMode,
      type: aiData.type,
      category: aiData.category,
      transactionDate: safeDate,
      note: aiData.note,
      nudge: aiData.nudge,
      isEssential: aiData.type === "expense" ? aiData.isEssential : true,
      sdgImpact: {
        score: aiData.sdgScore,
        description: "AI sustainability estimate",
      },
    });

    res.status(201).json(savedTransaction);
  } catch (error) {
    res.status(500).json({ message: "Failed to create AI transaction" });
  }
};

export const getAiSuggestion = async (req, res) => {
  try {
    const { description, amount, transactionDate, type } = req.body;
    const parsedAmount = Number(amount);

    if (!description?.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Valid description and amount are required" });
    }

    const safeDate = transactionDate ? new Date(transactionDate) : new Date();
    if (Number.isNaN(safeDate.getTime())) {
      return res.status(400).json({ message: "Transaction date is invalid" });
    }

    const aiData = await getAiClassification({
      description: description.trim(),
      amount: parsedAmount,
      transactionDate: safeDate.toISOString(),
      defaultType: type === "income" ? "income" : "expense",
    });

    res.status(200).json(aiData);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate AI suggestion" });
  }
};

export const getCanIAffordInsight = async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    const itemName = String(req.body.itemName || req.body.description || "").trim();
    const plannedDate = req.body.plannedDate ? new Date(req.body.plannedDate) : new Date();
    const entryMode = req.body.entryMode === "demo" ? "demo" : "actual";
    const selectedGoalId = req.body.goalId ? String(req.body.goalId) : null;

    if (!itemName) {
      return res.status(400).json({ message: "Item name is required" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than zero" });
    }

    if (Number.isNaN(plannedDate.getTime())) {
      return res.status(400).json({ message: "Planned date is invalid" });
    }

    const { start, end } = getMonthRangeFromDate(plannedDate);
    const [transactions, user, goals] = await Promise.all([
      Expense.find({
        userId: req.user.id,
        entryMode: entryMode === "demo" ? "demo" : { $ne: "demo" },
        transactionDate: { $gte: start, $lt: end },
      }),
      User.findById(req.user.id),
      Goal.find({ userId: req.user.id, isArchived: false }),
    ]);

    const totalIncome = transactions
      .filter((txn) => txn.type === "income")
      .reduce((sum, txn) => sum + txn.amount, 0);
    const totalExpenses = transactions
      .filter((txn) => txn.type !== "income")
      .reduce((sum, txn) => sum + txn.amount, 0);
    const netBalance = totalIncome - totalExpenses;
    const monthlyBudget = Number(user?.monthlyBudget || 0);
    const budgetRemaining = monthlyBudget > 0 ? Math.max(monthlyBudget - totalExpenses, 0) : Math.max(netBalance, 0);

    const goalRows = goals.map((goal) => toGoalTimeline(goal, plannedDate));
    const goalMonthlyNeed = goalRows.reduce((sum, goal) => sum + goal.monthlyRequired, 0);

    const spendableBeforeGoals = Math.max(Math.min(Math.max(netBalance, 0), budgetRemaining), 0);
    const spendableNow = Math.max(spendableBeforeGoals - goalMonthlyNeed, 0);
    const projectedAfterPurchase = spendableNow - amount;
    const canAfford = projectedAfterPurchase >= 0;
    const confidence = canAfford ? (projectedAfterPurchase > amount * 0.25 ? "high" : "medium") : "medium";
    const riskLevel = canAfford ? (projectedAfterPurchase <= amount * 0.1 ? "medium" : "low") : "high";
    const shortfall = Math.max(amount - spendableNow, 0);
    const suggestedMonthlySavings = Math.max(goalMonthlyNeed + shortfall / 3, goalMonthlyNeed);

    const heuristic = {
      canAfford,
      confidence,
      riskLevel,
      summary: canAfford
        ? "You can afford this purchase without violating your current monthly goal commitments."
        : "This purchase is likely to stretch your budget and goal commitments this month.",
      reasoning: canAfford
        ? [
            `Estimated spendable now after goals: ${roundToTwo(spendableNow)}`,
            `Projected balance after purchase: ${roundToTwo(projectedAfterPurchase)}`,
          ]
        : [
            `Shortfall after purchase: ${roundToTwo(shortfall)}`,
            `Current monthly goal need: ${roundToTwo(goalMonthlyNeed)}`,
          ],
      recommendedAction: canAfford
        ? "Proceed, but keep some buffer for unplanned expenses."
        : "Delay the purchase or split it across months to protect your savings goals.",
      spendCap: roundToTwo(spendableNow),
      suggestedMonthlySavings: roundToTwo(suggestedMonthlySavings),
    };

    const aiDecision = await getAffordabilityDecision({
      itemName,
      amount,
      context: {
        totalIncome: roundToTwo(totalIncome),
        totalExpenses: roundToTwo(totalExpenses),
        netBalance: roundToTwo(netBalance),
        monthlyBudget: roundToTwo(monthlyBudget),
        budgetRemaining: roundToTwo(budgetRemaining),
        spendableNow: roundToTwo(spendableNow),
        projectedAfterPurchase: roundToTwo(projectedAfterPurchase),
        goalMonthlyNeed: roundToTwo(goalMonthlyNeed),
      },
      goalRows,
      heuristic,
    });

    const goalImpact = goalRows.map((goal) => {
      const selected = selectedGoalId && goal.goalId === selectedGoalId;
      const extraDelayMonths = !canAfford && selected && goal.monthlyRequired > 0 ? Math.ceil(shortfall / goal.monthlyRequired) : 0;
      return {
        ...goal,
        isSelected: Boolean(selected),
        potentialDelayMonths: extraDelayMonths,
      };
    });

    return res.status(200).json({
      itemName,
      amount: roundToTwo(amount),
      currency: user?.currency || "INR",
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      context: {
        totalIncome: roundToTwo(totalIncome),
        totalExpenses: roundToTwo(totalExpenses),
        netBalance: roundToTwo(netBalance),
        monthlyBudget: roundToTwo(monthlyBudget),
        budgetRemaining: roundToTwo(budgetRemaining),
        spendableNow: roundToTwo(spendableNow),
        projectedAfterPurchase: roundToTwo(projectedAfterPurchase),
      },
      goals: {
        selectedGoalId,
        monthlyNeed: roundToTwo(goalMonthlyNeed),
        active: goalImpact,
      },
      decision: aiDecision,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate affordability insight" });
  }
};

// Legacy alias kept for compatibility with previous frontend route.
export const createSmartExpense = createSmartTransaction;


//=====used incognito chatgpt for honest opinion on features:

//$$$%%
// ==========================
// AI STUDENT BUDGET INSIGHTS
// ==========================

const buildMonthlyInsightPrompt = ({ metrics }) => `You are an AI financial coach for students.

User metrics:
${JSON.stringify(metrics)}

Return STRICT JSON:

{
 "summary": "short monthly explanation",
 "topSpendingCategory": "string",
 "insights": ["max 3 short insights"],
 "riskLevel": "low|medium|high"
}
`;

const getMonthlyInsights = async (metrics) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  try {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(
      buildMonthlyInsightPrompt({ metrics })
    );

    return safeJsonParse(result.response.text());
  } catch {
    return null;
  }
};

export const getMonthlyAiReport = async (req, res) => {
  try {
    const { start, end } = getMonthRangeFromDate(new Date());

    const filter = { 
      userId: req.user.id,
      transactionDate: { $gte: start, $lt: end }
    };
    if (req.query.mode === "demo") filter.entryMode = "demo";
    else if (req.query.mode === "actual") filter.entryMode = { $ne: "demo" };

    const transactions = await Expense.find(filter);

    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type !== "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const categories = {};

    transactions.forEach((t) => {
      if (t.type === "income") return;
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    const metrics = {
      totalIncome: roundToTwo(totalIncome),
      totalExpenses: roundToTwo(totalExpenses),
      categoryBreakdown: categories,
    };

    const aiInsights = await getMonthlyInsights(metrics);

    return res.status(200).json({
      metrics,
      aiInsights,
    });
  } catch {
    return res.status(500).json({ message: "AI report failed" });
  }
};



//$$$%%
// ==========================
// END OF MONTH PREDICTION
// ==========================

export const getEndOfMonthPrediction = async (req, res) => {
  try {
    const today = new Date();
    const { start, end } = getMonthRangeFromDate(today);

    const filter = { 
      userId: req.user.id,
      transactionDate: { $gte: start, $lt: today }
    };
    if (req.query.mode === "demo") filter.entryMode = "demo";
    else if (req.query.mode === "actual") filter.entryMode = { $ne: "demo" };

    const transactions = await Expense.find(filter);

    const daysPassed = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - daysPassed;

    const totalExpenses = transactions
      .filter((t) => t.type !== "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const avgDailySpend = totalExpenses / Math.max(daysPassed, 1);
    const predictedSpend = avgDailySpend * daysRemaining;

    const predictedBalance = totalIncome - (totalExpenses + predictedSpend);

    return res.status(200).json({
      avgDailySpend: roundToTwo(avgDailySpend),
      predictedEndBalance: roundToTwo(predictedBalance),
      daysRemaining,
      riskLevel: predictedBalance < 0 ? "high" : predictedBalance < totalIncome * 0.1 ? "medium" : "low",
    });
  } catch {
    return res.status(500).json({ message: "Prediction failed" });
  }
};



//$$$%%
// ==========================
// SPENDING LEAK DETECTOR
// ==========================

export const detectSpendingLeaks = async (req, res) => {
  try {
    const { start, end } = getMonthRangeFromDate(new Date());

    const filter = { 
      userId: req.user.id,
      transactionDate: { $gte: start, $lt: end }
    };
    if (req.query.mode === "demo") filter.entryMode = "demo";
    else if (req.query.mode === "actual") filter.entryMode = { $ne: "demo" };

    const transactions = await Expense.find(filter);

    const categoryCounts = {};
    const categoryTotals = {};

    transactions.forEach((t) => {
      if (t.type === "income") return;

      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const leaks = Object.entries(categoryCounts)
      .filter(([_, count]) => count >= 5)
      .map(([category]) => ({
        category,
        frequency: categoryCounts[category],
        totalSpent: roundToTwo(categoryTotals[category]),
      }));

    return res.status(200).json({ leaks });
  } catch {
    return res.status(500).json({ message: "Leak detection failed" });
  }
};



//$$$%%
// ==========================
// SUBSCRIPTION DETECTOR
// ==========================

export const detectSubscriptions = async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.mode === "demo") filter.entryMode = "demo";
    else if (req.query.mode === "actual") filter.entryMode = { $ne: "demo" };

    const transactions = await Expense.find(filter);

    const merchantMap = {};

    transactions.forEach((t) => {
      const key = t.description.toLowerCase();

      merchantMap[key] = merchantMap[key] || [];
      merchantMap[key].push(t);
    });

    const subscriptions = Object.entries(merchantMap)
      .filter(([_, txns]) => txns.length >= 3)
      .map(([merchant, txns]) => ({
        merchant,
        occurrences: txns.length,
        avgAmount: roundToTwo(
          txns.reduce((s, t) => s + t.amount, 0) / txns.length
        ),
      }));

    return res.status(200).json({ subscriptions });
  } catch {
    return res.status(500).json({ message: "Subscription detection failed" });
  }
};



//$$$%%
// ==========================
// GOAL DELAY PREDICTION
// ==========================

export const getGoalDelayImpact = async (req, res) => {
  try {
    const amount = Number(req.body.amount);

    const goals = await Goal.find({
      userId: req.user.id,
      isArchived: false,
    });

    const impacts = goals.map((goal) => {
      const remaining =
        (goal.targetAmount || 0) - (goal.savedAmount || 0);

      const monthly = remaining / 6;

      const delayMonths = Math.ceil(amount / monthly);

      return {
        goalId: goal._id,
        title: goal.title,
        potentialDelayMonths: delayMonths,
      };
    });

    return res.status(200).json({ impacts });
  } catch {
    return res.status(500).json({ message: "Goal delay calculation failed" });
  }
};



//$$$%%
// ==========================
// WEEKLY AI CHECK-IN
// ==========================

export const getWeeklyAiCheckin = async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const filter = { 
      userId: req.user.id,
      transactionDate: { $gte: weekAgo, $lte: now }
    };
    if (req.query.mode === "demo") filter.entryMode = "demo";
    else if (req.query.mode === "actual") filter.entryMode = { $ne: "demo" };

    const transactions = await Expense.find(filter);

    const totalSpent = transactions
      .filter((t) => t.type !== "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const categories = {};

    transactions.forEach((t) => {
      if (t.type === "income") return;
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });

    return res.status(200).json({
      totalSpent: roundToTwo(totalSpent),
      categories,
      message:
        totalSpent > 2000
          ? "High spending week detected."
          : "Spending looks balanced this week.",
    });
  } catch {
    return res.status(500).json({ message: "Weekly check-in failed" });
  }
};  