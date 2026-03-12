import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, PiggyBank, Sparkles, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { monthTitle } from "../../lib/budget";
import { useBudgetOutlet } from "./useBudgetOutlet";

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

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Income", value: money(stats.totalIncome), icon: TrendingUp, color: "text-emerald-300" },
          { label: "Expenses", value: money(stats.totalExpenses), icon: TrendingDown, color: "text-red-300" },
          { label: "Net Balance", value: money(stats.netBalance), icon: Wallet, color: "text-cyan-300" },
          { label: "Budget Left", value: money(budgetLeft), icon: PiggyBank, color: "text-indigo-300" },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
            <card.icon size={18} className={card.color} />
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold mt-2">{card.label}</p>
            <p className="text-2xl font-black mt-1 text-white">{card.value}</p>
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
    </div>
  );
};

export default BudgetOverviewPage;
