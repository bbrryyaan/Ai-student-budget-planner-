import express from "express";
const router = express.Router();

// Import Controllers
import { login, logout, me, refresh, register, updateBudget } from "../controllers/auth.controller.js";
import { updateNetBalance } from "../controllers/netBalance.controller.js";

import {
  createSmartExpense,
  createSmartTransaction,
  getAiSuggestion,
  getCanIAffordInsight,

  // $$$%% AI insights features
  getMonthlyAiReport,
  getEndOfMonthPrediction,
  detectSpendingLeaks,
  detectSubscriptions,
  getGoalDelayImpact,
  getWeeklyAiCheckin,

} from "../controllers/ai.controller.js";

import { getDashboardStats, getAnalysisSummary } from "../controllers/budget.controller.js";
import { getAiBudgetBrief } from "../controllers/aiInsights.controller.js";
import { handleBuddyChat, getChatHistory, getChats } from "../controllers/chatbot.controller.js";
import {
  contributeToGoal,
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
} from "../controllers/goal.controller.js";
import {
  clearExpenses,
  clearTransactions,
  createManualExpense,
  createTransaction,
  deleteExpense,
  deleteTransaction,
  getCalendarSummary,
  getHistory,
  listTransactions,
  seedDemoData,
  updateExpense,
  updateTransaction,
  importTransactionsFromPDF,
} from "../controllers/transaction.controller.js";
import { addToWishlist, listWishlist, removeFromWishlist, markAsBought } from "../controllers/wishlist.controller.js";
import { convertCurrency } from "../controllers/settings.controller.js";

// Import Middleware
import authMiddleware from "../middleware/auth.middleware.js";

// Public Routes
router.post("/auth/register", register);
router.post("/auth/login", login);
router.post("/auth/refresh", refresh);
router.post("/auth/logout", logout);
router.get("/auth/me", authMiddleware, me);
router.patch("/auth/budget", authMiddleware, updateBudget);
router.patch("/auth/net-balance", authMiddleware, updateNetBalance);

// Protected Routes (Require Auth)
router.post("/transactions", authMiddleware, createTransaction);
router.post("/transactions/ai-add", authMiddleware, createSmartTransaction);
router.post("/transactions/ai-suggest", authMiddleware, getAiSuggestion);
router.post("/transactions/ai-afford", authMiddleware, getCanIAffordInsight);
router.get("/transactions/ai-brief", authMiddleware, getAiBudgetBrief);
router.get("/transactions", authMiddleware, listTransactions);
router.get("/transactions/stats", authMiddleware, getDashboardStats);
router.get("/transactions/calendar", authMiddleware, getCalendarSummary);
router.post("/transactions/seed", authMiddleware, seedDemoData);
router.put("/transactions/:transactionId", authMiddleware, updateTransaction);
router.delete("/transactions/:transactionId", authMiddleware, deleteTransaction);
router.delete("/transactions", authMiddleware, clearTransactions);
router.post("/transactions/import/pdf", authMiddleware, importTransactionsFromPDF);

//$$$$$$
// Analysis Routes
router.get("/analysis/summary", authMiddleware, getAnalysisSummary);
//$$$$$$

// $$$%% Advanced AI Insights

router.get("/ai/report/monthly", authMiddleware, getMonthlyAiReport);

router.get("/ai/prediction/end-month", authMiddleware, getEndOfMonthPrediction);

router.get("/ai/insights/leaks", authMiddleware, detectSpendingLeaks);

router.get("/ai/insights/subscriptions", authMiddleware, detectSubscriptions);

router.post("/ai/goals/delay-impact", authMiddleware, getGoalDelayImpact);

router.get("/ai/checkin/weekly", authMiddleware, getWeeklyAiCheckin);

router.get("/ai/chats", authMiddleware, getChats);
router.get("/ai/chats/:chatId", authMiddleware, getChatHistory);
router.post("/ai/chats", authMiddleware, handleBuddyChat);



//dssdfsf

router.get("/goals", authMiddleware, listGoals);
router.post("/goals", authMiddleware, createGoal);
router.patch("/goals/:goalId", authMiddleware, updateGoal);
router.post("/goals/:goalId/contribute", authMiddleware, contributeToGoal);
router.delete("/goals/:goalId", authMiddleware, deleteGoal);

// Wishlist Routes
router.get("/wishlist", authMiddleware, listWishlist);
router.post("/wishlist", authMiddleware, addToWishlist);
router.patch("/wishlist/:id/bought", authMiddleware, markAsBought);
router.delete("/wishlist/:id", authMiddleware, removeFromWishlist);

// Legacy expense routes kept temporarily for compatibility.
router.post("/expenses/add", authMiddleware, createSmartExpense);
router.post("/expenses", authMiddleware, createManualExpense);
router.get("/expenses/history", authMiddleware, getHistory);
router.get("/expenses/stats", authMiddleware, getDashboardStats);
router.post("/expenses/seed", authMiddleware, seedDemoData);
router.put("/expenses/:expenseId", authMiddleware, updateExpense);
router.delete("/expenses/:expenseId", authMiddleware, deleteExpense);
router.delete("/expenses", authMiddleware, clearExpenses);

// Settings Routes
router.post("/settings/convert-currency", authMiddleware, convertCurrency);

export default router;
