import { CheckCircle, TrendingUp, TrendingDown, Trophy, Zap, ShieldCheck, CalendarCheck, Lightbulb } from "lucide-react";

const ScoreBar = ({ score, label, color = "bg-green-500" }) => (
  <div>
    <div className="flex justify-between text-xs font-medium text-slate-300">
      <span>{label}</span>
      <span>{score.toFixed(1)}/100</span>
    </div>
    <div className="mt-1 w-full bg-slate-700 rounded-full h-1.5">
      <div
        className={`${color} h-1.5 rounded-full`}
        style={{ width: `${score}%` }}
      />
    </div>
  </div>
);

const MetricItem = ({ label, value, currency }) => (
  <div className="flex justify-between items-center py-2 border-b border-slate-800">
    <span className="text-slate-400">{label}</span>
    <span className="font-semibold text-white">
      {currency && `${currency} `}
      {value}
    </span>
  </div>
);

const CoachItem = ({ icon, title, content }) => (
  <div>
    <h4 className="font-semibold text-white flex items-center gap-2">
      {icon}
      {title}
    </h4>
    <ul className="mt-2 list-disc list-inside text-slate-300 space-y-1">
      {Array.isArray(content) ? (
        content.map((item, i) => <li key={i}>{item}</li>)
      ) : (
        <li>{content}</li>
      )}
    </ul>
  </div>
);

const AiBudgetBrief = ({ brief }) => {
  const { scorecard, metrics, coach, currency } = brief;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold text-lg text-center text-white">
          Your Scorecard: {scorecard.overall.toFixed(1)}/100
        </h3>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreBar score={scorecard.spendingDiscipline} label="Discipline" color="bg-cyan-500" />
          <ScoreBar score={scorecard.savingsStability} label="Savings" color="bg-emerald-500" />
          <ScoreBar score={scorecard.goalMomentum} label="Goals" color="bg-amber-500" />
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-white mb-2">Key Metrics</h3>
        <div className="text-sm">
          <MetricItem label="Total Income" value={metrics.totalIncome.toFixed(2)} currency={currency} />
          <MetricItem label="Total Expenses" value={metrics.totalExpenses.toFixed(2)} currency={currency} />
          <MetricItem label="Net Balance" value={metrics.netBalance.toFixed(2)} currency={currency} />
          <MetricItem label="Essential Spending" value={`${metrics.essentialRatio.toFixed(1)}%`} />
          <MetricItem label="Budget Utilization" value={`${metrics.budgetUsagePercent.toFixed(1)}%`} />
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-white mb-3">AI Coach Insights</h3>
        <p className="text-slate-300 italic mb-4">&quot;{coach.summary}&quot;</p>
        <div className="space-y-4">
          <CoachItem icon={<TrendingUp size={16} className="text-green-400" />} title="Wins" content={coach.wins} />
          <CoachItem icon={<TrendingDown size={16} className="text-red-400" />} title="Risks" content={coach.risks} />
          <CoachItem icon={<CalendarCheck size={16} className="text-blue-400" />} title="Action Plan" content={coach.actionPlan} />
          <CoachItem icon={<Zap size={16} className="text-yellow-400" />} title="Weekly Challenge" content={coach.challenge} />
        </div>
      </div>
    </div>
  );
};

export default AiBudgetBrief;
