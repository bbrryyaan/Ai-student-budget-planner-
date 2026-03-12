import { useMemo, useState } from "react";
import { Filter, Pencil, Trash2 } from "lucide-react";
import SmartInput from "../../components/SmartInput";
import api from "../../lib/api";
import { categoriesByType, toInputDate, typeOptions } from "../../lib/budget";
import { useBudgetOutlet } from "./useBudgetOutlet";

const sampleFilterOptions = ["all", "sample", "manual"];

const BudgetTransactionsPage = () => {
  const { transactions, refreshData, money, notify, busyAction, setBusyAction } = useBudgetOutlet();

  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sampleFilter, setSampleFilter] = useState("all");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    type: "expense",
    category: "Other",
    transactionDate: "",
    note: "",
  });

  const sampleCount = transactions.filter((txn) => txn.isSample).length;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesSearch = txn.description.toLowerCase().includes(searchText.trim().toLowerCase());
      const matchesType = typeFilter === "all" || txn.type === typeFilter;
      const matchesSample =
        sampleFilter === "all" || (sampleFilter === "sample" && txn.isSample) || (sampleFilter === "manual" && !txn.isSample);

      return matchesSearch && matchesType && matchesSample;
    });
  }, [transactions, searchText, typeFilter, sampleFilter]);

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
      notify("error", "Please add valid description and amount.");
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

      await refreshData();
      cancelEditing();
      notify("success", "Transaction updated.");
    } catch {
      notify("error", "Could not update transaction.");
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
      await refreshData();
      notify("success", "Transaction deleted.");
    } catch {
      notify("error", "Could not delete transaction.");
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
        Sample rows loaded: <b>{sampleCount}</b>. They are labeled in the list below for easy demo storytelling.
      </div>

      <SmartInput onTransactionAdded={refreshData} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="font-semibold text-white">Transactions</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search"
                className="bg-slate-950 border border-slate-700 rounded-xl py-2 pl-8 pr-3 text-sm w-44"
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
            <select
              value={sampleFilter}
              onChange={(e) => setSampleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-sm"
            >
              {sampleFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 max-h-[620px] overflow-y-auto">
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
                        disabled={busyAction}
                        className="px-2 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs disabled:opacity-60"
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
                      <div className="flex items-center gap-2 text-sm flex-wrap">
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
                        {txn.isSample && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            sample
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-white truncate">{txn.description}</p>
                      {txn.note && <p className="text-xs text-slate-400 truncate">{txn.note}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`font-bold ${txn.type === "income" ? "text-emerald-300" : "text-red-300"}`}>
                        {txn.type === "income" ? "+" : "-"}
                        {money(txn.amount)}
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
  );
};

export default BudgetTransactionsPage;
