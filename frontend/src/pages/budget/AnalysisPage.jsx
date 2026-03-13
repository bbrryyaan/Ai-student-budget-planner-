import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Brain, CheckCircle2, Loader2, Sparkles, PieChartIcon } from "lucide-react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import api from "../../lib/api";
import { useBudgetOutlet } from "./useBudgetOutlet";

const COLORS = ['#22d3ee', '#818cf8', '#f472b6', '#fbbf24', '#34d399', '#f87171', '#c084fc', '#fb923c'];

const AnalysisPage = () => {
  const { currentMonth, money, notify } = useBudgetOutlet();
  const [loading, setLoading] = useState(true);
  const [brief, setBrief] = useState(null);
  const [categorySummary, setCategorySummary] = useState([]);

  const monthParam = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [currentMonth]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const [briefRes, summaryRes] = await Promise.all([
          api.get("/api/transactions/ai-brief", { params: { month: monthParam, mode: "actual" } }),
          api.get("/api/analysis/summary", { params: { month: monthParam, mode: "actual" } })
        ]);
        setBrief(briefRes.data);
        setCategorySummary(summaryRes.data || []);
      } catch (error) {
        notify("error", error.response?.data?.message || "Could not load AI analysis.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [monthParam, notify]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-slate-300 flex items-center gap-2">
        <Loader2 size={18} className="animate-spin" /> Loading AI analysis...
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 text-slate-300">
        AI analysis is currently unavailable.
      </div>
    );
  }

  const scoreTiles = [
    { label: "Overall", value: brief.scorecard?.overall || 0 },
    { label: "Spending Discipline", value: brief.scorecard?.spendingDiscipline || 0 },
    { label: "Savings Stability", value: brief.scorecard?.savingsStability || 0 },
    { label: "Goal Momentum", value: brief.scorecard?.goalMomentum || 0 },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-300" /> AI Budget Brief
        </h2>
        <p className="text-sm text-slate-400 mt-1">{brief.coach?.summary || "No summary generated."}</p>

        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
          {scoreTiles.map((tile) => (
            <article key={tile.label} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 flex flex-col items-center justify-center">
              <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate w-full">{tile.label}</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-1 leading-none">{Number(tile.value).toFixed(0)}</p>
              <div className="mt-3 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400" style={{ width: `${Math.max(0, Math.min(100, tile.value))}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
          <h3 className="font-semibold text-white">Top Spend Categories</h3>
          <div className="h-60 sm:h-72 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brief.topCategories || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="category" stroke="#94a3b8" tick={{fontSize: 10}} />
                <YAxis stroke="#94a3b8" tick={{fontSize: 10}} />
                <RechartsTooltip
                  formatter={(value) => money(value)}
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "10px" }}
                />
                <Bar dataKey="amount" fill="#22d3ee" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        
        <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <PieChartIcon size={16} className="text-purple-300" /> Category Breakdown
          </h3>
          <div className="h-48 sm:h-72 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categorySummary}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="total"
                  nameKey="category"
                  stroke="none"
                >
                  {categorySummary.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value) => money(value)}
                  contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "10px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-4 mt-2">
            {categorySummary.map((entry, index) => (
              <div key={entry.category} className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-300 bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/50">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="truncate">{entry.category}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-300" /> Wins
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300 list-disc list-inside">
            {(brief.coach?.wins || []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-300" /> Risks
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300 list-disc list-inside">
            {(brief.coach?.risks || []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Brain size={16} className="text-violet-300" /> 7-Day AI Action Plan
        </h3>
        <ol className="mt-3 space-y-2 text-sm text-slate-200 list-decimal list-inside">
          {(brief.coach?.actionPlan || []).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {brief.coach?.challenge && (
          <p className="mt-4 rounded-xl border border-violet-400/30 bg-violet-500/10 p-3 text-sm text-violet-100">
            Challenge: {brief.coach.challenge}
          </p>
        )}
      </section>
    </div>
  );
};

export default AnalysisPage;
