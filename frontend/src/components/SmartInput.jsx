import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import api from "../lib/api";

const categoryMap = {
  expense: ["Food", "Transport", "Rent", "Utilities", "Shopping", "Health", "Entertainment", "Education", "Savings", "Other"],
  income: ["Salary", "Freelance", "Investments", "Refund", "Gift", "Other"],
};

const getToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const SmartInput = ({ onTransactionAdded, entryMode }) => {
  const [type, setType] = useState("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categoryMap.expense[0]);
  const [transactionDate, setTransactionDate] = useState(getToday());
  const [note, setNote] = useState("");
  const [paymentMode, setPaymentMode] = useState("upi");
  const [useAi, setUseAi] = useState(true);
  const [isEssential, setIsEssential] = useState(true);

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState(null);

  useEffect(() => {
    setCategory(categoryMap[type][0]);
    setIsEssential(type === "expense");
  }, [type]);

  const categoryOptions = useMemo(() => categoryMap[type], [type]);

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setCategory(categoryMap[type][0]);
    setNote("");
    setAiSuggestion(null);
  };

  const handleAiSuggest = async () => {
    setErrorMessage("");
    const parsedAmount = Number(amount);
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Add description and amount before AI suggest.");
      return;
    }

    try {
      setAiLoading(true);
      const { data } = await api.post("/api/transactions/ai-suggest", {
        description,
        amount: parsedAmount,
        transactionDate,
        type,
      });

      setAiSuggestion(data);
      setType(data.type === "income" ? "income" : "expense");
      setCategory(data.category || "Other");
      setNote(data.note || "");
      setIsEssential(Boolean(data.isEssential));
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "AI suggestion failed.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    const parsedAmount = Number(amount);
    if (!description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Enter a valid description and amount.");
      return;
    }

    try {
      setLoading(true);

      if (useAi) {
        await api.post("/api/transactions/ai-add", {
          description,
          amount: parsedAmount,
          transactionDate,
          type,
          paymentMode,
          entryMode: entryMode || "actual",
        });
      } else {
        await api.post("/api/transactions", {
          description,
          amount: parsedAmount,
          transactionDate,
          type,
          category,
          note,
          paymentMode,
          isEssential: type === "expense" ? isEssential : true,
          entryMode: entryMode || "actual",
        });
      }

      resetForm();
      onTransactionAdded?.();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Could not save transaction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-400" /> 
            <span className="truncate">Add Entry</span>
          </p>
          <p className="hidden sm:block text-xs text-slate-400 mt-1">Track income or expenses with AI assist.</p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAiSuggest}
            disabled={aiLoading}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px] sm:text-sm flex items-center gap-1.5 disabled:opacity-60"
          >
            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Suggest
          </button>
          <button
            type="button"
            onClick={() => setUseAi((prev) => !prev)}
            className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[10px] sm:text-sm font-bold ${
              useAi
                ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                : "border-slate-700 bg-slate-800 text-slate-300"
            }`}
          >
            AI: {useAi ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="col-span-1 bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-white outline-none focus:border-indigo-500/50"
            disabled={loading}
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="col-span-1 bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-white outline-none focus:border-indigo-500/50"
            disabled={loading}
          />

          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (e.g. Lunch)"
            className="col-span-2 lg:col-span-2 bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-white outline-none focus:border-indigo-500/50"
            disabled={loading}
          />

          <input
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            className="col-span-1 lg:col-span-1 bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-white outline-none focus:border-indigo-500/50"
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading}
            className="col-span-1 lg:col-span-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-xl py-2 px-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-indigo-900/20 active:scale-95 transition-all"
          >
            {loading ? "..." : "Save"}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-white outline-none focus:border-indigo-500/50"
            disabled={loading || useAi}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-white outline-none focus:border-indigo-500/50"
            disabled={loading}
          >
            <option value="upi">UPI / Bank</option>
            <option value="cash">Cash</option>
            <option value="savings">Savings</option>
          </select>

          <label className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-[10px] sm:text-sm text-slate-400 cursor-pointer hover:border-slate-600 transition-colors">
            <input
              type="checkbox"
              checked={isEssential}
              onChange={(e) => setIsEssential(e.target.checked)}
              disabled={loading || useAi || type !== "expense"}
              className="accent-indigo-500"
            />
            {isEssential ? <span className="text-white font-bold">Essential</span> : "Essential"}
          </label>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note"
            className="col-span-1 md:col-span-2 lg:col-span-1 bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-white outline-none focus:border-indigo-500/50"
            disabled={loading || useAi}
          />
        </div>
      </form>

      {aiSuggestion && (
        <div className="mt-3 text-xs sm:text-sm rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-cyan-100">
          AI: classified as <b>{aiSuggestion.type}</b> in <b>{aiSuggestion.category}</b>. {aiSuggestion.nudge}
        </div>
      )}

      {errorMessage && (
        <p className="mt-3 text-sm text-red-300 border border-red-500/30 bg-red-500/10 rounded-xl px-3 py-2">
          {errorMessage}
        </p>
      )}
    </section>
  );
};

export default SmartInput;
