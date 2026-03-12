import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
//$$$$$$
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Loader2,
  LogOut,
  PlusCircle,
  ReceiptText,
  RefreshCcw,
  Settings,
  Sparkles,
  Zap,
  PieChart, //$$$$$$
} from "lucide-react";
import api from "../../lib/api";
import { formatMonthKey, monthTitle } from "../../lib/budget";
import { useAuth } from "../../context/useAuth";

const navItems = [
  { to: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard/analysis", label: "Analysis", icon: PieChart }, //$$$$$$
  { to: "/dashboard/affordability", label: "Affordability AI", icon: Sparkles },
  { to: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/dashboard/transactions", label: "Transactions", icon: ReceiptText },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

const BudgetLayout = () => {
  const navigate = useNavigate();
  const { user, logout, setUser } = useAuth();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [transactions, setTransactions] = useState([]);
  const [calendarSummary, setCalendarSummary] = useState([]);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netBalance: 0,
    monthlyBudget: 0,
    savingsRate: 0,
    budgetUsagePercent: 0,
  });

  const [budgetInput, setBudgetInput] = useState(String(user?.monthlyBudget || 5000));
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [flash, setFlash] = useState({ type: "", text: "" });
  const flashTimeoutRef = useRef(null);

  const monthKey = useMemo(() => formatMonthKey(currentMonth), [currentMonth]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: user?.currency || "INR",
        maximumFractionDigits: 0,
      }),
    [user?.currency],
  );

  const money = useCallback((value) => currencyFormatter.format(Number(value) || 0), [currencyFormatter]);

  const notify = useCallback((type, text) => {
    setFlash({ type, text });
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlash({ type: "", text: "" });
    }, 2600);
  }, []);

  useEffect(() => {
    setBudgetInput(String(user?.monthlyBudget || 5000));
  }, [user?.monthlyBudget]);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { month: monthKey, mode: "actual" };
      const [transactionsResponse, statsResponse, calendarResponse] = await Promise.all([
        api.get("/api/transactions", { params }),
        api.get("/api/transactions/stats", { params }),
        api.get("/api/transactions/calendar", { params }),
      ]);

      setTransactions(transactionsResponse.data || []);
      setStats(statsResponse.data || {});
      setCalendarSummary(calendarResponse.data?.days || []);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login");
        return;
      }
      notify("error", "Failed to load budget data.");
    } finally {
      setLoading(false);
    }
  }, [monthKey, navigate, notify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSeedSample = async () => {
    try {
      setBusyAction(true);
      await api.post("/api/transactions/seed", { entryMode: "actual" });
      await fetchData();
      notify("success", "Sample transactions added.");
    } catch {
      notify("error", "Could not seed sample transactions.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleUpdateBudget = async () => {
    const parsedBudget = Number(budgetInput);
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      notify("error", "Budget must be greater than zero.");
      return;
    }

    try {
      setBusyAction(true);
      const { data } = await api.patch("/api/auth/budget", { monthlyBudget: parsedBudget });
      setUser(data.user);
      await fetchData();
      notify("success", "Budget updated.");
    } catch {
      notify("error", "Could not update budget.");
    } finally {
      setBusyAction(false);
    }
  };

  const shiftMonth = (offset) => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const outletContext = {
    currentMonth,
    setCurrentMonth,
    monthKey,
    stats,
    transactions,
    calendarSummary,
    refreshData: fetchData,
    money,
    notify,
    busyAction,
    setBusyAction,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="w-full px-4 py-5 lg:px-6 xl:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-5 xl:gap-6">
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 lg:p-5 h-fit lg:sticky lg:top-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-indigo-600">
                <Zap size={18} className="text-white" />
              </div>
              <div>
                <p className="font-bold text-white">Budget Hub</p>
                <p className="text-xs text-slate-400">{user?.name || "User"}</p>
              </div>
            </div>

            <nav className="space-y-1.5 mb-6">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                      isActive
                        ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                        : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700"
                    }`
                  }
                >
                  <item.icon size={15} /> {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="space-y-2.5 border-t border-slate-800 pt-4">
              <button
                onClick={handleSeedSample}
                disabled={busyAction}
                className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 px-3 py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <PlusCircle size={14} /> Load Sample
              </button>
              <button
                onClick={fetchData}
                disabled={busyAction}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 text-slate-200 px-3 py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <RefreshCcw size={14} /> Refresh
              </button>
              <button
                onClick={handleLogout}
                className="w-full rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-2 text-sm flex items-center justify-center gap-2"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2">Monthly Budget</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={budgetInput}
                  onChange={(event) => setBudgetInput(event.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-sm"
                />
                <button
                  onClick={handleUpdateBudget}
                  disabled={busyAction}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
          </aside>

          <main className="space-y-4 min-w-0">
            <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-black text-white">Personal Budget Planner</h1>
                  <p className="text-sm text-slate-400 mt-1">Navigate sections from the sidebar.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => shiftMonth(-1)}
                    className="p-2 rounded-xl border border-slate-700 bg-slate-800"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <div className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-sm font-semibold min-w-[160px] text-center">
                    {monthTitle(currentMonth)}
                  </div>
                  <button
                    onClick={() => shiftMonth(1)}
                    className="p-2 rounded-xl border border-slate-700 bg-slate-800"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </header>

            {flash.text && (
              <p
                className={`rounded-xl border px-3 py-2 text-sm ${
                  flash.type === "error"
                    ? "border-red-500/30 bg-red-500/10 text-red-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {flash.text}
              </p>
            )}

            {loading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 flex items-center justify-center">
                <Loader2 className="animate-spin" size={30} />
              </div>
            ) : (
              <Outlet context={outletContext} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default BudgetLayout;
