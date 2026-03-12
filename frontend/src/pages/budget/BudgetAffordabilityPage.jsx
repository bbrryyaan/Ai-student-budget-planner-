import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Sparkles,
  Target,
  Wallet,
  PlusCircle,
  Wand2,
  FileText,
  Trash2,
  ShoppingBag,
  TrendingDown,
  AlertCircle,
  Clock,
} from "lucide-react";
import api from "../../lib/api";
import { useBudgetOutlet } from "./useBudgetOutlet";
import AiBudgetBrief from "./AiBudgetBrief.jsx";

const getToday = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const BudgetAffordabilityPage = () => {
  const { notify, refreshData, money, stats } = useBudgetOutlet();

  const [goals, setGoals] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loadingWishlist, setLoadingWishlist] = useState(false);

  const [goalForm, setGoalForm] = useState({
    title: "",
    targetAmount: "",
    targetDate: "",
    note: "",
  });

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
      const { data } = await api.get("/api/goals");
      setGoals(Array.isArray(data) ? data : []);
    } catch {
      notify("error", "Could not load savings goals.");
    }
  }, [notify]);

  const loadWishlist = useCallback(async () => {
    try {
      setLoadingWishlist(true);
      const { data } = await api.get("/api/wishlist");
      setWishlist(Array.isArray(data) ? data : []);
    } catch {
      notify("error", "Failed to load wishlist.");
    } finally {
      setLoadingWishlist(false);
    }
  }, [notify]);

  useEffect(() => {
    loadGoals();
    loadWishlist();
  }, [loadGoals, loadWishlist]);

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
      setGoalForm({ title: "", targetAmount: "", targetDate: "", note: "" });
      await loadGoals();
      notify("success", "Savings goal created.");
    } catch (error) {
      notify("error", error.response?.data?.message || "Could not create goal.");
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

  const handleAddToWishlist = async () => {
    try {
      setBusy(true);
      await api.post("/api/wishlist", {
        itemName: affordabilityForm.itemName,
        amount: Number(affordabilityForm.amount),
        priority: affordabilityResult?.decision?.riskLevel === "high" ? "low" : "medium",
        note: `AI logic: ${affordabilityResult?.decision?.summary}`
      });
      setAffordabilityResult(null);
      setAffordabilityForm({ itemName: "", amount: "", plannedDate: getToday(), goalId: "" });
      await loadWishlist();
      notify("success", "Item dumped into Wishlist Radar. Focus on your goals first!");
    } catch {
      notify("error", "Failed to add to wishlist.");
    } finally {
      setBusy(false);
    }
  };

  const removeFromWishlist = async (id) => {
    try {
      await api.delete(`/api/wishlist/${id}`);
      await loadWishlist();
      notify("success", "Removed from radar.");
    } catch {
      notify("error", "Failed to remove.");
    }
  };

  const handleCreateSmartTransaction = async () => {
    if (!affordabilityForm.itemName.trim() || !affordabilityForm.amount) return;
    try {
      setAiTransactionBusy(true);
      await api.post("/api/transactions/ai-add", {
        description: affordabilityForm.itemName,
        amount: Number(affordabilityForm.amount),
        transactionDate: affordabilityForm.plannedDate || getToday()
      });
      notify("success", "Purchase logged. AI will adjust your budget brief hourly.");
      await refreshData();
      setAffordabilityResult(null);
      setAffordabilityForm({ itemName: "", amount: "", plannedDate: getToday(), goalId: "" });
    } catch (error) {
      notify("error", "Transaction log failed.");
    } finally {
      setAiTransactionBusy(false);
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
    <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
      <section className="space-y-6">
        {/* Affordability Entry Card */}
        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          
          <h2 className="text-2xl font-black text-white flex items-center gap-3 relative z-10">
            <Sparkles size={24} className="text-cyan-400" />
            Can I Afford This? <span className="text-cyan-400/50">AI Engine</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1 mb-6 relative z-10">
            Our strict student coach cross-references your goals, mess fees, and current net cash.
          </p>

          <form onSubmit={handleAffordabilityCheck} className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1 mb-1 block">Item Description</label>
              <input
                value={affordabilityForm.itemName}
                onChange={(e) => setAffordabilityForm((prev) => ({ ...prev, itemName: e.target.value }))}
                placeholder="e.g., PS5, Noise-cancelling headphones, Extra pack of Maggi"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 px-4 text-white placeholder:text-slate-600 focus:border-cyan-500/50 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1 mb-1 block">Price (₹)</label>
              <input
                type="number"
                value={affordabilityForm.amount}
                onChange={(e) => setAffordabilityForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 px-4 text-white placeholder:text-slate-600 focus:border-cyan-500/50 outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest ml-1 mb-1 block">Planned Purchase Date</label>
              <input
                type="date"
                value={affordabilityForm.plannedDate}
                onChange={(e) => setAffordabilityForm((prev) => ({ ...prev, plannedDate: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl py-3 px-4 text-white focus:border-cyan-500/50 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={checkingAffordability}
              className="md:col-span-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 py-4 px-3 text-sm font-black text-white shadow-xl shadow-indigo-900/20 disabled:opacity-50 transition-all flex items-center justify-center gap-3 mt-2"
            >
              {checkingAffordability ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Wand2 size={18} />
              )}
              ASK THE COACH
            </button>
          </form>

          {/* AI Decision Result */}
          {affordabilityResult && (
            <div className="mt-8 bg-slate-950 border border-slate-800 rounded-3xl p-6 relative z-10 animate-in zoom-in duration-300">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                     <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                       affordabilityResult.decision.canAfford ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                     }`}>
                        {affordabilityResult.decision.canAfford ? 'Affordable' : 'Too Risky'} 
                        <span>•</span> 
                        {affordabilityResult.decision.confidence} confidence
                     </div>
                     <h3 className="text-xl font-black text-white">Coaches Verdict:</h3>
                     <p className="text-slate-300 italic">"{affordabilityResult.decision.summary}"</p>
                  </div>

                  <div className="shrink-0 flex gap-3">
                     <button 
                       onClick={handleAddToWishlist}
                       className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all"
                     >
                       Park in Radar
                     </button>
                     <button 
                        onClick={handleCreateSmartTransaction}
                        className="px-6 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/20"
                     >
                        Force Buy
                     </button>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-8 border-t border-slate-800">
                  <div className="space-y-3">
                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">The Reasoning</p>
                     {affordabilityResult.decision.reasoning.map((r, i) => (
                       <div key={i} className="flex gap-3 text-xs text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5"></span>
                          <p>{r}</p>
                       </div>
                     ))}
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3">Goal Impact Analysis</p>
                     <div className="space-y-3">
                        <div className="flex justify-between text-xs">
                           <span className="text-slate-400">Current Goal Need</span>
                           <span className="text-white font-bold">{money(affordabilityResult.goals.monthlyNeed)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                           <span className="text-slate-400">Spendable Cash Left</span>
                           <span className={`font-bold ${affordabilityResult.context.spendableNow > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                             {money(affordabilityResult.context.spendableNow)}
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}
        </article>

        {/* Wishlist Radar Section */}
        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-md relative overflow-hidden">
           <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                  <ShoppingBag size={20} className="text-fuchsia-400" />
                  Wishlist Radar
                </h2>
                <p className="text-xs text-slate-500 font-medium">Park your impulse buys here. The coach will tell you when it's safe.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Radar Value</p>
                <p className="text-lg font-black text-fuchsia-400">
                  {money(wishlist.reduce((sum, item) => sum + item.amount, 0))}
                </p>
              </div>
           </div>

           {loadingWishlist ? (
             <div className="flex justify-center p-12"><Loader2 className="animate-spin text-slate-600" /></div>
           ) : wishlist.length === 0 ? (
             <div className="bg-slate-950/50 border border-slate-800 border-dashed rounded-2xl p-12 text-center">
                <ShoppingBag size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-sm text-slate-500 font-medium italic">Radar is clear. You're being very disciplined recently!</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {wishlist.map(item => (
                 <div key={item._id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl group flex justify-between items-start transition-all hover:border-slate-700">
                    <div className="flex gap-4">
                       <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 group-hover:text-fuchsia-400 transition-colors">
                          <ShoppingBag size={20} />
                       </div>
                       <div>
                          <h4 className="text-white text-sm font-bold">{item.itemName}</h4>
                          <p className="text-fuchsia-400 font-black text-sm">{money(item.amount)}</p>
                          <div className="flex items-center gap-3 mt-2">
                             <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded border ${
                               item.priority === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                             }`}>
                               {item.priority} Priority
                             </span>
                             <span className="text-[9px] flex items-center gap-1 text-slate-500">
                               <Clock size={10} /> {new Date(item.createdAt).toLocaleDateString()}
                             </span>
                          </div>
                       </div>
                    </div>
                    <button 
                      onClick={() => removeFromWishlist(item._id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                 </div>
               ))}
             </div>
           )}
        </article>
      </section>

      <section className="space-y-6">
        {/* Monthly Budget Brief */}
        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <h2 className="font-bold text-white flex items-center gap-2 mb-6">
            <FileText size={18} className="text-teal-400" />
            AI Budget Brief
          </h2>
          {loadingBrief ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-slate-300" size={24} />
            </div>
          ) : aiBrief ? (
            <AiBudgetBrief brief={aiBrief} />
          ) : (
            <div className="bg-slate-950 rounded-2xl p-8 text-center border border-slate-800">
               <AlertCircle size={32} className="mx-auto text-slate-700 mb-3" />
               <p className="text-sm text-slate-500">No brief data available. AI requires at least 3 transactions to generate insights.</p>
            </div>
          )}
        </article>

        {/* Savings Goals */}
        <article className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
          <h2 className="font-bold text-white flex items-center gap-2 mb-6">
            <Target size={18} className="text-emerald-300" />
            Active Goals
          </h2>

          <form onSubmit={handleCreateGoal} className="space-y-4 mb-8">
            <div className="space-y-3">
              <input
                value={goalForm.title}
                onChange={(e) => setGoalForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Goal name (e.g., New Laptop, Semester Fees)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/30"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={goalForm.targetAmount}
                  onChange={(e) => setGoalForm((prev) => ({ ...prev, targetAmount: e.target.value }))}
                  placeholder="Target (₹)"
                  className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-emerald-500/30"
                />
                <input
                  type="date"
                  value={goalForm.targetDate}
                  onChange={(e) => setGoalForm((prev) => ({ ...prev, targetDate: e.target.value }))}
                  className="bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3 text-sm text-white outline-none focus:border-emerald-500/30"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-sm font-bold transition-all border border-slate-700 hover:border-emerald-500/50"
            >
              Set New Goal
            </button>
          </form>

          <div className="space-y-4">
             {goals.length === 0 ? (
               <p className="text-xs text-slate-500 text-center italic py-4">No goals active. Define what you're saving for!</p>
             ) : (
               goals.map(goal => (
                 <div key={goal._id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
                    <div className="relative z-10">
                       <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-bold text-white">{goal.title}</p>
                          <p className="text-xs font-black text-emerald-400">{money(goal.targetAmount)}</p>
                       </div>
                       <div className="h-1.5 w-full bg-slate-900 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${Math.min((goal.savedAmount / goal.targetAmount) * 100, 100)}%` }}
                          />
                       </div>
                       <p className="text-[10px] text-slate-500 mt-2 font-medium uppercase tracking-tight">Focusing on this goal in AI analysis</p>
                    </div>
                 </div>
               ))
             )}
          </div>
        </article>
      </section>
    </div>
  );
};

export default BudgetAffordabilityPage;