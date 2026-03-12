import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, PiggyBank, Sparkles, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { monthTitle } from "../../lib/budget";
import { useBudgetOutlet } from "./useBudgetOutlet";
import MarketRates from "../../components/MarketRates";

const BudgetOverviewPage = () => {
  const { stats, calendarSummary, transactions, money, currentMonth } = useBudgetOutlet();

  const chartData = [...calendarSummary]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((entry) => ({
      day: entry.date.slice(-2),
      income: entry.income,
      expense: entry.expense,
    }));

  const sampleCount = transactions.filter((txn) => txn.isSample).length;
  const budgetLeft = Math.max((stats.monthlyBudget || 0) - (stats.totalExpenses || 0), 0);
  
  const today = new Date();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(lastDayOfMonth - today.getDate() + 1, 1);
  const dailySafeSpend = budgetLeft / daysRemaining;

  return (
    <div className="space-y-4">
      {/* Student Welcome Header */}
      <div className="bg-gradient-to-r from-indigo-600/20 to-fuchsia-600/20 rounded-2xl border border-indigo-500/20 p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-white font-bold leading-tight">Student Pocket Genie Active</h2>
            <p className="text-indigo-300 text-[10px] uppercase font-bold tracking-widest">Live financial tracking for campus life</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-xl border border-slate-800">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">System Healthy</span>
        </div>
      </div>
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: "Pocket Money", value: money(stats.totalIncome), icon: TrendingUp, color: "text-emerald-300" },
          { label: "Spent", value: money(stats.totalExpenses), icon: TrendingDown, color: "text-red-300" },
          { label: "In Wallet", value: money(stats.netBalance), icon: Wallet, color: "text-cyan-300" },
          { 
            label: "Safe to Spend Today", 
            value: money(dailySafeSpend), 
            icon: Sparkles, 
            color: "text-fuchsia-300", 
            highlight: true,
            info: "Formula: (Budget Left) / (Days Remaining). Adjusted daily to keep you on track."
          },
          { 
            label: "Month Goal Left", 
            value: money(budgetLeft), 
            icon: PiggyBank, 
            color: "text-indigo-300",
            info: "Remaining portion of your set monthly limit. Negative means overspent."
          },
        ].map((card) => (
          <article 
            key={card.label} 
            className={`group relative rounded-2xl border ${card.highlight ? 'border-fuchsia-500/30 bg-fuchsia-500/10' : 'border-slate-800 bg-slate-900/80'} p-4 transition-transform hover:scale-[1.02]`}
          >
            <div className="flex justify-between items-start">
              <card.icon size={18} className={card.color} />
              {card.info && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-[9px] text-slate-300 px-2 py-1 rounded absolute top-2 right-2 max-w-[120px] pointer-events-none z-20 shadow-xl border border-slate-700">
                  {card.info}
                </div>
              )}
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold mt-2">{card.label}</p>
            <p className={`text-2xl font-black mt-1 ${card.highlight ? 'text-fuchsia-100' : 'text-white'}`}>{card.value}</p>
            {card.highlight && <p className="text-[10px] text-fuchsia-400 font-bold mt-1 uppercase tracking-tight">Based on {daysRemaining} days left</p>}
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="font-semibold text-white">Cashflow Trend ({monthTitle(currentMonth)})</h2>
          <p className="text-xs text-slate-400">Savings rate: {Number(stats.savingsRate || 0).toFixed(1)}%</p>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="incomeFillOverview" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseFillOverview" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                }}
              />
              <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#incomeFillOverview)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#expenseFillOverview)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-300" /> Hackathon Demo Panel
        </h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-slate-300 font-medium flex items-center gap-2">
              <BadgeCheck size={14} className="text-emerald-300" /> Sample Transactions Loaded
            </p>
            <p className="text-2xl font-black text-white mt-1">{sampleCount}</p>
            <p className="text-xs text-slate-400 mt-1">Rows marked as sample are visible in Transactions.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-slate-300 font-medium">Monthly Budget</p>
            <p className="text-xl font-bold text-white mt-1">{money(stats.monthlyBudget || 0)}</p>
            <p className="text-xs text-slate-400 mt-1">Usage: {Number(stats.budgetUsagePercent || 0).toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-slate-300 font-medium">Transaction Count</p>
            <p className="text-xl font-bold text-white mt-1">{transactions.length}</p>
            <p className="text-xs text-slate-400 mt-1">Income + expense entries for this month.</p>
          </div>
        </div>
      </section>

      <section className="bg-slate-900 border border-indigo-500/20 rounded-2xl p-4 flex items-center gap-4">
         <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
           <BadgeCheck size={20} />
         </div>
         <div className="flex-1">
           <p className="text-white text-sm font-bold">Campus Perk Alert!</p>
           <p className="text-slate-400 text-xs mt-0.5">Your University ID gets you 50% off on "Money Buddy Pro" and local cafes. Check your student email!</p>
         </div>
         <button className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition-colors">Claim</button>
      </section>

      <MarketRates />
    </div>
  );
};

export default BudgetOverviewPage;
