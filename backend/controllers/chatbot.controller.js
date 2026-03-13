import { GoogleGenerativeAI } from "@google/generative-ai";
import Expense from "../models/expense.js";
import User from "../models/user.js";
import Goal from "../models/goal.js";
import Chat from "../models/chat.js";

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || "";

const GEMINI_MODEL = "gemini-2.5-flash";

const getGenAI = () => new GoogleGenerativeAI(getGeminiApiKey());

export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.id })
      .select('_id title updatedAt')
      .sort({ updatedAt: -1 });
    res.status(200).json({ chats });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ message: "Failed to load chats" });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findOne({ _id: chatId, userId: req.user.id });
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    res.status(200).json({ messages: chat.messages });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ message: "Failed to load chat history" });
  }
};

export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const deleted = await Chat.findOneAndDelete({ _id: chatId, userId: req.user.id });
    if (!deleted) {
      return res.status(404).json({ message: "Chat not found" });
    }
    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ message: "Failed to delete chat" });
  }
};

export const handleBuddyChat = async (req, res) => {
  try {
    const { message, chatId, mode } = req.body;
    const userId = req.user.id;
    const entryMode = mode === "demo" ? "demo" : "actual";

    // 1. Fetch all data in parallel
    const [user, goals, history, chatRecord] = await Promise.all([
      User.findById(userId),
      Goal.find({ userId, isArchived: false }),
      Expense.find({ userId, entryMode }).sort({ transactionDate: -1 }).limit(100),
      chatId ? Chat.findOne({ _id: chatId, userId }) : Promise.resolve(null)
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 2. Pre-process and create high-level insights
    const monthlyBudget = user.monthlyBudget || 0;
    
    const totalIncome = history
      .filter((txn) => txn.type === "income")
      .reduce((sum, txn) => sum + txn.amount, 0);

    const totalExpenses = history
      .filter((txn) => txn.type === "expense")
      .reduce((sum, txn) => sum + txn.amount, 0);

    const spendingByCategory = history
      .filter((txn) => txn.type === "expense")
      .reduce((acc, txn) => {
        acc[txn.category] = (acc[txn.category] || 0) + txn.amount;
        return acc;
      }, {});

    const discretionaryIncome = totalIncome - totalExpenses;

    const goalInsights = goals.map((goal) => ({
      title: goal.title,
      progressPercent: ((goal.savedAmount / goal.targetAmount) * 100).toFixed(2),
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
    }));
    
    // Minify recent transactions to avoid token bloat
    const recentTxns = history.slice(0, 20).map(t => ({
      date: t.transactionDate ? t.transactionDate.toISOString().split('T')[0] : 'N/A',
      desc: t.description,
      amount: t.amount,
      cat: t.category
    }));

    // Pre-calculate "Balance Killers" (Top 3 highest expenses in the last 100 txns)
    const balanceKillers = history
      .filter(t => t.type === 'expense')
      .sort((a,b) => b.amount - a.amount)
      .slice(0, 3)
      .map(t => `${t.description} (₹${t.amount.toFixed(2)})`);

    // Recent chat history to give context
    const previousMessages = chatRecord 
      ? chatRecord.messages.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Buddy'}: ${m.text}`).join('\\n')
      : "No previous messages.";

    const model = getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. The "Expert Coach" System Prompt
    const prompt = `
      You are "Money Buddy", an expert, empathetic, and hyper-actionable financial AI coach built for a student in India inside a smart budget app.
      Your advice MUST be based ONLY on the financial data and pre-calculated insights provided below. If the user asks something completely unrelated, gently steer them back to their finances.

      ---
      FINANCIAL INSIGHTS & SUMMARY:
      - User's Monthly Budget Goal: ₹${monthlyBudget.toFixed(2)}
      - Real Total Income (Last 100 txns): ₹${totalIncome.toFixed(2)}
      - Real Total Expenses (Last 100 txns): ₹${totalExpenses.toFixed(2)}
      - Net Leftover (Income - Expenses): ₹${discretionaryIncome.toFixed(2)}
      - Spending by Category: ${JSON.stringify(spendingByCategory)}
      - Active Goals: ${JSON.stringify(goalInsights)}
      ---
      
      ---
      PREVIOUS CONVERSATION HISTORY (Use for context, do not just repeat):
      ${previousMessages}
      ---

      User's New Message/Question: "${message}"

      ---
      **YOUR MISSION-CRITICAL RULES:**

      1. **TONE:** Be a super positive and encouraging "buddy", a college-friendly peer. Use "we" and "our". Use emojis.
      
      2. **BE HYPER-SPECIFIC & ACTIONABLE:** Do not give generic advice. Use the EXACT numbers from the insights above.
          - Good: "I see we have ₹${discretionaryIncome.toFixed(2)} left over. What if we put 20% of that (₹${(Math.max(0, discretionaryIncome) * 0.2).toFixed(2)}) straight into your '${goals.length > 0 ? goals[0].title : 'savings goal'}'?"

      3. **THE "BALANCE KILLER" RULE (IMPORTANT):** If the user asks why their balance is low, what brought it down, or what happened to their money, YOU MUST look at the 'BALANCE KILLERS' list below and name the top 2-3 items specifically. NEVER ask the user to "find expenses that brought it down". You do the work!

      4. **STRICT BREVITY:** No greetings like "Hey there buddy" every time. Answer directly in 2-3 sentences max. End with a 1-sentence "Buddy Challenge". Format: [Answer/Insight]. [Challenge]. Use markdown for numbers.
      
      ---
      BALANCE KILLERS (Highest Recent Spending):
      ${balanceKillers.join(', ')}
      ---

      ---
      RECENT TRANSACTIONS (Chronological):
      ${JSON.stringify(recentTxns)}
      ---
      
      Respond now (STRICTLY CONCISE & DATA-DRIVEN):
    `;

    const result = await model.generateContent(prompt);
    const responseBody = await result.response;
    const response = responseBody.text();

    // Save to DB
    let chat = chatRecord;
    if (!chat) {
      // Generate a simple title based on the first few words of the message
      const title = message.split(' ').slice(0, 4).join(' ') + (message.split(' ').length > 4 ? '...' : '');
      chat = new Chat({ userId, title, messages: [] });
    }
    chat.messages.push({ role: "user", text: message });
    chat.messages.push({ role: "buddy", text: response });
    await chat.save();

    res.status(200).json({ reply: response, chatId: chat._id, title: chat.title });
  } catch (error) {
    console.error("Error in handleBuddyChat:", error);
    res.status(500).json({ message: "Buddy is sleeping right now. Try again later!", error: error.message });
  }
};
