import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatDateKey, getCalendarGrid, toInputDate } from "../../lib/budget";
import { useBudgetOutlet } from "./useBudgetOutlet";

const BudgetCalendarPage = () => {
  const { currentMonth, calendarSummary, transactions, money } = useBudgetOutlet();
  const [selectedDateKey, setSelectedDateKey] = useState("");

  const summaryByDate = useMemo(
    () =>
      calendarSummary.reduce((acc, item) => {
        acc[item.date] = item;
        return acc;
      }, {}),
    [calendarSummary],
  );

  const calendarGrid = useMemo(() => getCalendarGrid(currentMonth), [currentMonth]);

  const selectedDayTransactions = useMemo(() => {
    if (!selectedDateKey) return [];

    return transactions
      .filter((txn) => formatDateKey(new Date(txn.transactionDate || txn.createdAt)) === selectedDateKey)
      .sort((a, b) => new Date(b.transactionDate || b.createdAt) - new Date(a.transactionDate || a.createdAt));
  }, [transactions, selectedDateKey]);

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-[1.15fr_1fr] gap-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <h2 className="font-semibold text-white flex items-center gap-2 mb-3">
          <CalendarDays size={16} className="text-cyan-300" /> Monthly Calendar
        </h2>

        <div className="grid grid-cols-7 text-center text-[11px] uppercase tracking-wide text-slate-500 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarGrid.map((day) => {
            const dayKey = formatDateKey(day);
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const selected = selectedDateKey === dayKey;
            const dayData = summaryByDate[dayKey];

            return (
              <button
                key={dayKey}
                onClick={() => setSelectedDateKey((prev) => (prev === dayKey ? "" : dayKey))}
                className={`h-[74px] rounded-lg border px-1.5 py-1 text-left transition ${
                  selected
                    ? "border-indigo-400 bg-indigo-500/15"
                    : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                } ${!isCurrentMonth ? "opacity-35" : "opacity-100"}`}
              >
                <p className="text-[11px] text-slate-200">{day.getDate()}</p>
                {dayData && (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[10px] text-emerald-300">+{Math.round(dayData.income || 0)}</p>
                    <p className="text-[10px] text-red-300">-{Math.round(dayData.expense || 0)}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {selectedDateKey && (
          <button onClick={() => setSelectedDateKey("")} className="mt-3 text-xs text-cyan-300 hover:underline">
            Clear date filter ({selectedDateKey})
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <h2 className="font-semibold text-white mb-3">Selected Day Details</h2>

        {!selectedDateKey ? (
          <p className="text-sm text-slate-400">Pick a date from the calendar to inspect entries.</p>
        ) : (
          <>
            <p className="text-sm text-slate-300 mb-2">{selectedDateKey}</p>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {selectedDayTransactions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                  No entries on this day.
                </div>
              ) : (
                selectedDayTransactions.map((txn) => (
                  <div key={txn._id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">{txn.description}</p>
                        <p className="text-xs text-slate-400">
                          {toInputDate(txn.transactionDate || txn.createdAt)} | {txn.category}
                          {txn.isSample ? " | Sample" : ""}
                        </p>
                      </div>
                      <p className={`font-bold ${txn.type === "income" ? "text-emerald-300" : "text-red-300"}`}>
                        {txn.type === "income" ? "+" : "-"}
                        {money(txn.amount)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default BudgetCalendarPage;
