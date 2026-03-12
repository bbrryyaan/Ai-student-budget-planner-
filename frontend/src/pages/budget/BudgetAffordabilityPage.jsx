import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  PiggyBank,
  Sparkles,
  Target,
  Trash2,
  Wallet,
  PlusCircle,
  Wand2,
  FileText,
} from "lucide-react";
import api from "../../lib/api";
import { useBudgetOutlet } from "./useBudgetOutlet";
import AiBudgetBrief from "./AiBudgetBrief.jsx";


const getToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const formatDate = (value) => {
  if (!value) return "No deadline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const BudgetAffordabilityPage = () => {
  const { money, notify, refreshData } = useBudgetOutlet();

  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [busy, setBusy] = useState(false);

  const [goalForm, setGoalForm] = useState({
    title: "",
    targetAmount: "",
    targetDate: "",
    note: "",
  });

  const [contributionMap, setContributionMap] = useState({});

  const [affordabilityForm, setAffordabilityForm] = useState({
    itemName: "",
    amount: "",
    plannedDate: getToday(),
    goalId: "",
  });

  const [checkingAffordability, setCheckingAffordability] = useState(false);
  const [affordabilityResult, setAffordabilityResult] = useState(null);

  const [aiTransactionBusy, setAiTransactionBusy] = useState(false);
  const [aiSuggestionBusy, setAiSuggestionBusy] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiBrief, setAiBrief] = useState(null);
  const [loadingBrief, setLoadingBrief] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      setLoadingGoals(true);
      const { data } = await api.get("/api/goals");
      setGoals(Array.isArray(data) ? data : []);
    } catch {
      notify("error", "Could not load savings goals.");
    } finally {
      setLoadingGoals(false);
    }
  }, [notify]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const totalGoalRemaining = useMemo(
    () => goals.reduce((sum, goal) => sum + Number(goal.remainingAmount || 0), 0),
    [goals]
  );

  const handleCreateGoal = async (event) => {
    event.preventDefault();

    const targetAmount = Number(goalForm.targetAmount);

    if (!goalForm.title.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      notify("error", "Add a valid goal title and target amount.");
      return;
    }

    try {
      setBusy(true);

      await api.post("/api/goals", {
        title: goalForm.title,
        targetAmount,
        targetDate: goalForm.targetDate || undefined,
        note: goalForm.note,
      });

      setGoalForm({
        title: "",
        targetAmount: "",
        targetDate: "",
        note: "",
      });

      await loadGoals();

      notify("success", "Savings goal created.");
    } catch (error) {
      notify("error", error.response?.data?.message || "Could not create goal.");
    } finally {
      setBusy(false);
    }
  };

  const handleContribute = async (goal) => {
    const amount = Number(contributionMap[goal._id] || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      notify("error", "Enter a valid contribution amount.");
      return;
    }

    try {
      setBusy(true);

      await api.post(`/api/goals/${goal._id}/contribute`, {
        amount,
        transactionDate: getToday(),
      });

      setContributionMap((prev) => ({
        ...prev,
        [goal._id]: "",
      }));

      await Promise.all([loadGoals(), refreshData()]);

      notify("success", "Contribution added and logged in transactions.");
    } catch (error) {
      notify("error", error.response?.data?.message || "Could not contribute to goal.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      setBusy(true);

      await api.delete(`/api/goals/${goalId}`);

      await loadGoals();

      notify("success", "Goal archived.");
    } catch (error) {
      notify("error", error.response?.data?.message || "Could not remove goal.");
    } finally {
      setBusy(false);
    }
  };

  const handleAffordabilityCheck = async (event) => {
    event.preventDefault();

    const amount = Number(affordabilityForm.amount);

    if (!affordabilityForm.itemName.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify("error", "Add a valid item name and amount.");
      return;
    }

    try {
      setCheckingAffordability(true);

      const { data } = await api.post("/api/transactions/ai-afford", {
        itemName: affordabilityForm.itemName,
        amount,
        plannedDate: affordabilityForm.plannedDate || getToday(),
        goalId: affordabilityForm.goalId || undefined,
      });

      setAffordabilityResult(data);
    } catch (error) {
      notify("error", error.response?.data?.message || "Affordability check failed.");
    } finally {
      setCheckingAffordability(false);
    }
  };

  const handleCreateSmartTransaction = async () => {
    if (!affordabilityForm.itemName.trim() || !affordabilityForm.amount) {
      notify("error", "Please enter item name and amount to create transaction.");
      return;
    }

    try {
      setAiTransactionBusy(true);

      const { data } = await api.post("/api/transactions/ai-add", {
        description: affordabilityForm.itemName, // <--- Change the key to 'description'
        amount: Number(affordabilityForm.amount),
        plannedDate: affordabilityForm.plannedDate || getToday(),
        goalId: affordabilityForm.goalId || undefined,
      });

      notify("success", `AI Transaction created: ${data.transactionId || "Success"}`);

      await refreshData();
    } catch (error) {
      notify("error", error.response?.data?.message || "AI transaction creation failed.");
    } finally {
      setAiTransactionBusy(false);
    }
  };

  const handleGetAiSuggestion = async () => {
    try {
      setAiSuggestionBusy(true);

      const { data } = await api.post("/api/transactions/ai-suggest", {
        description: affordabilityForm.itemName, 
        amount: Number(affordabilityForm.amount) || 0,
        transactionDate: affordabilityForm.plannedDate || getToday()
      });

      setAiSuggestions(data.suggestions || []);

      notify("success", "AI suggestions loaded.");
    } catch (error) {
      notify("error", error.response?.data?.message || "Failed to get AI suggestions.");
    } finally {
      setAiSuggestionBusy(false);
    }
  };

  const loadAiBrief = useCallback(async () => {
    try {
      setLoadingBrief(true);

      const { data } = await api.get("/api/transactions/ai-brief");

      setAiBrief(data);
    } catch {
      notify("error", "Failed to load AI budget brief.");
    } finally {
      setLoadingBrief(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAiBrief();
  }, [loadAiBrief]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-4">
      <section className="space-y-4">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-300" />
            Can I Afford This? AI
          </h2>

          <form onSubmit={handleAffordabilityCheck} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={affordabilityForm.itemName}
              onChange={(e) =>
                setAffordabilityForm((prev) => ({ ...prev, itemName: e.target.value }))
              }
              placeholder="Item (e.g., Noise-cancelling headphones)"
              className="md:col-span-2 bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm"
            />

            <input
              type="number"
              min="1"
              step="0.01"
              value={affordabilityForm.amount}
              onChange={(e) =>
                setAffordabilityForm((prev) => ({ ...prev, amount: e.target.value }))
              }
              placeholder="Price"
              className="bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm"
            />

            <input
              type="date"
              value={affordabilityForm.plannedDate}
              onChange={(e) =>
                setAffordabilityForm((prev) => ({ ...prev, plannedDate: e.target.value }))
              }
              className="bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm"
            />

            <select
              value={affordabilityForm.goalId}
              onChange={(e) =>
                setAffordabilityForm((prev) => ({ ...prev, goalId: e.target.value }))
              }
              className="md:col-span-2 bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm"
            >
              <option value="">No specific goal focus</option>

              {goals.map((goal) => (
                <option key={goal._id} value={goal._id}>
                  {goal.title}
                </option>
              ))}
            </select>

            <button
              type="submit"
              disabled={checkingAffordability}
              className="md:col-span-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 px-3 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {checkingAffordability ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wallet size={15} />
              )}
              Analyze Affordability
            </button>
          </form>

          {affordabilityResult && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleCreateSmartTransaction}
                disabled={aiTransactionBusy}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 px-3 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {aiTransactionBusy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <PlusCircle size={15} />
                )}
                Log as Expense
              </button>

              <button
                onClick={handleGetAiSuggestion}
                disabled={aiSuggestionBusy}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 py-2.5 px-3 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {aiSuggestionBusy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wand2 size={15} />
                )}
                Get AI Tips
              </button>
            </div>
          )}

          {aiSuggestions.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {aiSuggestions.map((s, i) => (
                <li key={i} className="border border-slate-700 rounded-md p-2">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </article>

        {affordabilityResult && (
          <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
            <h3 className="font-semibold text-white">AI Affordability Analysis</h3>
            <p className="text-white font-semibold mt-3">{affordabilityResult.itemName}</p>
            <p className="text-sm text-slate-300 mt-2">
              {affordabilityResult.decision?.summary}
            </p>
          </article>
        )}
      </section>

      <section className="space-y-4">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <FileText size={16} className="text-teal-400" />
            AI Budget Brief
          </h2>

          {loadingBrief ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-slate-300" size={24} />
            </div>
          ) : aiBrief ? (
            <AiBudgetBrief brief={aiBrief} />
          ) : (
            <p className="text-slate-400 text-center py-4">No brief data available.</p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Target size={16} className="text-emerald-300" />
            Savings Goals
          </h2>


          <form onSubmit={handleCreateGoal} className="mt-4 grid grid-cols-1 gap-3">
            <input
              value={goalForm.title}
              onChange={(e) =>
                setGoalForm((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Goal name (e.g., New Laptop)"
              className="bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm"
            />

            <input
              type="number"
              min="1"
              step="0.01"
              value={goalForm.targetAmount}
              onChange={(e) =>
                setGoalForm((prev) => ({ ...prev, targetAmount: e.target.value }))
              }
              placeholder="Target amount"
              className="bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm"
            />

            <input
              type="date"
              value={goalForm.targetDate}
              onChange={(e) =>
                setGoalForm((prev) => ({ ...prev, targetDate: e.target.value }))
              }
              className="bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm"
            />

            <textarea
              rows={2}
              value={goalForm.note}
              onChange={(e) =>
                setGoalForm((prev) => ({ ...prev, note: e.target.value }))
              }
              placeholder="Why this matters (optional)"
              className="bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-sm resize-none"
            />

            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 px-3 text-sm font-semibold"
            >
              Create Goal
            </button>
          </form>
        </article>
      </section>
    </div>
  );
};

export default BudgetAffordabilityPage;