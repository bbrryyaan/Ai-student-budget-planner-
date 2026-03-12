import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  LogOut,
  Pencil,
  PiggyBank,
  PlusCircle,
  RefreshCcw,
  Trash2,
  Wallet,
} from "lucide-react";
import SmartInput from "../components/SmartInput";
import { useAuth } from "../context/useAuth";
import api from "../lib/api";

const typeOptions = ["all", "income", "expense"];
const categoriesByType = {
  income: ["Salary", "Freelance", "Investments", "Refund", "Gift", "Other"],
  expense: ["Food", "Transport", "Rent", "Utilities", "Shopping", "Health", "Entertainment", "Education", "Other"],
};

const formatMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toInputDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDateKey(date);
};

const monthTitle = (monthDate) =>
  monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

const getCalendarGrid = (monthDate) => {
  const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startDay = startOfMonth.getDay();
  const gridStart = new Date(startOfMonth);
  gridStart.setDate(startOfMonth.getDate() - startDay);

  return Array.from({ length: 42 }, (_, idx) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + idx);
    return day;
  });
};

const Dashboard = () => {
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

  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDateKey, setSelectedDateKey] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    type: "expense",
    category: "Other",
    transactionDate: "",
    note: "",
  });

  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(user?.monthlyBudget || 5000));
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
  const messageTimeoutRef = useRef(null);

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

  const money = (value) => currencyFormatter.format(Number(value) || 0);

  const showMessage = (type, text) => {
    setActionMessage({ type, text });
    if (messageTimeoutRef.current) {
      window.clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = window.setTimeout(() => {
      setActionMessage({ type: "", text: "" });
    }, 2500);
  };

  useEffect(() => {
    setBudgetInput(String(user?.monthlyBudget || 5000));
  }, [user?.monthlyBudget]);

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        window.clearTimeout(messageTimeoutRef.current);
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
      showMessage("error", "Failed to load budget data.");
    } finally {
      setLoading(false);
    }
  }, [monthKey, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const loadSampleData = async () => {
    try {
      setBusyAction(true);
      await api.post("/api/transactions/seed");
      await fetchData();
      showMessage("success", "Sample transactions added.");
    } catch {
      showMessage("error", "Could not seed sample transactions.");
    } finally {
      setBusyAction(false);
    }
  };

  const updateBudget = async () => {
    const parsedBudget = Number(budgetInput);
    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      showMessage("error", "Budget must be greater than zero.");
      return;
    }

    try {
      setBusyAction(true);
      const { data } = await api.patch("/api/auth/budget", { monthlyBudget: parsedBudget });
      setUser(data.user);
      await fetchData();
      showMessage("success", "Budget updated.");
    } catch {
      showMessage("error", "Could not update budget.");
    } finally {
      setBusyAction(false);
    }
  };

  const startEditing = (txn) => {
    setEditingId(txn._id);
    setEditForm({
      description: txn.description,
      amount: String(txn.amount),
      type: txn.type || "expense",
      category: txn.category || "Other",
      transactionDate: toInputDate(txn.transactionDate || txn.createdAt),
      note: txn.note || "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({
      description: "",
      amount: "",
      type: "expense",
      category: "Other",
      transactionDate: "",
      note: "",
    });
  };

  const saveEdit = async (transactionId) => {
    const parsedAmount = Number(editForm.amount);
    if (!editForm.description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showMessage("error", "Please add valid description and amount.");
      return;
    }

    try {
      setBusyAction(true);
      await api.put(`/api/transactions/${transactionId}`, {
        description: editForm.description,
        amount: parsedAmount,
        type: editForm.type,
        category: editForm.category,
        transactionDate: editForm.transactionDate,
        note: editForm.note,
      });
      await fetchData();
      cancelEditing();
      showMessage("success", "Transaction updated.");
    } catch {
      showMessage("error", "Could not update transaction.");
    } finally {
      setBusyAction(false);
    }
  };

  const deleteTransaction = async (transactionId) => {
    try {
      setBusyAction(true);
      await api.delete(`/api/transactions/${transactionId}`);
      if (editingId === transactionId) {
        cancelEditing();
      }
      await fetchData();
      showMessage("success", "Transaction deleted.");
    } catch {
      showMessage("error", "Could not delete transaction.");
    } finally {
      setBusyAction(false);
    }
  };

  const summaryByDate = useMemo(() => {
    return calendarSummary.reduce((acc, item) => {
      acc[item.date] = item;
      return acc;
    }, {});
  }, [calendarSummary]);

  const calendarGrid = useMemo(() => getCalendarGrid(currentMonth), [currentMonth]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const txnDateKey = formatDateKey(new Date(txn.transactionDate || txn.createdAt));
      const matchesDate = !selectedDateKey || txnDateKey === selectedDateKey;
      const matchesType = typeFilter === "all" || txn.type === typeFilter;
      const matchesSearch = txn.description.toLowerCase().includes(searchText.trim().toLowerCase());
      return matchesDate && matchesType && matchesSearch;
    });
  }, [transactions, selectedDateKey, typeFilter, searchText]);

  const chartData = useMemo(() => {
    const sorted = [...calendarSummary].sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted.map((item) => ({
      day: item.date.slice(-2),
      income: item.income,
      expense: item.expense,
      net: item.net,
    }));
  }, [calendarSummary]);

  const budgetLeft = Math.max((stats.monthlyBudget || 0) - (stats.totalExpenses || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <Loader2 className="animate-spin" size={34} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="w-full px-4 py-6 lg:px-8 xl:px-10">
        <div className="max-w-[1600px] mx-auto space-y-5">
          <header className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-white">Personal Budget Planner</h1>
                <p className="text-sm text-slate-400 mt-1">Track income, expenses, and calendar cashflow with AI assist.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={loadSampleData}
                  disabled={busyAction}
                  className="px-3 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-sm flex items-center gap-2 disabled:opacity-60"
                >
                  <PlusCircle size={15} /> Load Sample
                </button>
                <button
                  onClick={fetchData}
                  disabled={busyAction}
                  className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm flex items-center gap-2 disabled:opacity-60"
                >
                  <RefreshCcw size={15} /> Refresh
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </div>
          </header>

          {actionMessage.text && (
            <p
              className={`rounded-xl border px-3 py-2 text-sm ${
                actionMessage.type === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {actionMessage.text}
            </p>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Income", value: money(stats.totalIncome), icon: Wallet, color: "text-emerald-400" },
              { label: "Expenses", value: money(stats.totalExpenses), icon: Wallet, color: "text-red-400" },
              { label: "Net Balance", value: money(stats.netBalance), icon: PiggyBank, color: "text-cyan-400" },
              { label: "Budget Left", value: money(budgetLeft), icon: PiggyBank, color: "text-indigo-400" },
            ].map((card) => (
              <article key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <card.icon size={18} className={card.color} />
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold mt-2">{card.label}</p>
                <p className="text-2xl font-black mt-1">{card.value}</p>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Monthly Budget</p>
                <p className="text-xs text-slate-400 mt-1">
                  Usage: {Number(stats.budgetUsagePercent || 0).toFixed(1)}% of {money(stats.monthlyBudget || 0)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-36 bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-sm"
                />
                <button
                  onClick={updateBudget}
                  disabled={busyAction}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
            <div className="mt-3 h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${
                  Number(stats.budgetUsagePercent || 0) > 100
                    ? "bg-red-500"
                    : Number(stats.budgetUsagePercent || 0) > 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(Math.max(Number(stats.budgetUsagePercent || 0), 0), 100)}%` }}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-4">
            <SmartInput onTransactionAdded={fetchData} />

            <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold flex items-center gap-2 text-white">
                  <CalendarDays size={16} className="text-cyan-400" /> {monthTitle(currentMonth)}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                    }
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                    }
                    className="p-1.5 rounded-lg border border-slate-700 bg-slate-800"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

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
                  const net = dayData?.net || 0;

                  return (
                    <button
                      key={dayKey}
                      onClick={() => setSelectedDateKey((prev) => (prev === dayKey ? "" : dayKey))}
                      className={`h-16 rounded-lg border px-1 py-1 text-left transition ${
                        selected
                          ? "border-indigo-400 bg-indigo-500/15"
                          : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                      } ${!isCurrentMonth ? "opacity-40" : "opacity-100"}`}
                    >
                      <p className="text-[11px] text-slate-300">{day.getDate()}</p>
                      {dayData && (
                        <p className={`text-[10px] mt-1 font-semibold ${net >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {net >= 0 ? "+" : ""}{Math.round(net)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedDateKey && (
                <button
                  onClick={() => setSelectedDateKey("")}
                  className="mt-3 text-xs text-cyan-300 hover:underline"
                >
                  Clear date filter ({selectedDateKey})
                </button>
              )}
            </article>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="font-semibold">Monthly Cashflow Trend ({monthTitle(currentMonth)})</p>
              <p className="text-xs text-slate-400">Savings rate: {stats.savingsRate || 0}%</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="income" stroke="#10b981" fill="url(#incomeFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#expenseFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="font-semibold">Transactions</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search"
                    className="bg-slate-950 border border-slate-700 rounded-xl py-2 pl-8 pr-3 text-sm w-40"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-sm"
                >
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {filteredTransactions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                  No transactions for this filter.
                </div>
              ) : (
                filteredTransactions.map((txn) => (
                  <div key={txn._id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    {editingId === txn._id ? (
                      <div className="grid grid-cols-1 lg:grid-cols-8 gap-2">
                        <select
                          value={editForm.type}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              type: e.target.value,
                              category: categoriesByType[e.target.value][0],
                            }))
                          }
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                        >
                          <option value="expense">expense</option>
                          <option value="income">income</option>
                        </select>
                        <input
                          value={editForm.description}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                          className="lg:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                        />
                        <input
                          type="number"
                          value={editForm.amount}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                        />
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                        >
                          {(categoriesByType[editForm.type] || ["Other"]).map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={editForm.transactionDate}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, transactionDate: e.target.value }))}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                        />
                        <input
                          value={editForm.note}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, note: e.target.value }))}
                          placeholder="Note"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm"
                        />
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => saveEdit(txn._id)}
                            className="px-2 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="px-2 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-slate-200 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs ${
                                txn.type === "income"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-red-500/15 text-red-300"
                              }`}
                            >
                              {txn.type}
                            </span>
                            <span className="text-slate-400">{toInputDate(txn.transactionDate || txn.createdAt)}</span>
                            <span className="text-slate-500">{txn.category}</span>
                          </div>
                          <p className="font-semibold text-white truncate">{txn.description}</p>
                          {txn.note && <p className="text-xs text-slate-400 truncate">{txn.note}</p>}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`font-bold ${txn.type === "income" ? "text-emerald-300" : "text-red-300"}`}>
                            {txn.type === "income" ? "+" : "-"}{money(txn.amount)}
                          </p>
                          <button
                            onClick={() => startEditing(txn)}
                            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteTransaction(txn._id)}
                            className="p-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
