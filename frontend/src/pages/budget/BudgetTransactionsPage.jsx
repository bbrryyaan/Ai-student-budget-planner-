import { useMemo, useState, useRef } from "react";
import { Filter, Pencil, Trash2, FileText, Loader2, Home, Car, Coffee, Zap, Shield, Heart, PiggyBank, User, Film, DollarSign, Gift, TrendingUp, Box } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// Standard Vite way to resolve the worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

import SmartInput from "../../components/SmartInput";
import api from "../../lib/api";
import { categoriesByType, toInputDate, typeOptions } from "../../lib/budget";
import { useBudgetOutlet } from "./useBudgetOutlet";



const CATEGORY_STYLES = {
  // Expense
  "Housing": { bg: "bg-blue-500/20", color: "text-blue-400", Icon: Home },
  "Transportation": { bg: "bg-orange-500/20", color: "text-orange-400", Icon: Car },
  "Food": { bg: "bg-amber-500/20", color: "text-amber-400", Icon: Coffee },
  "Utilities": { bg: "bg-cyan-500/20", color: "text-cyan-400", Icon: Zap },
  "Insurance": { bg: "bg-indigo-500/20", color: "text-indigo-400", Icon: Shield },
  "Medical": { bg: "bg-red-500/20", color: "text-red-400", Icon: Heart },
  "Savings": { bg: "bg-emerald-500/20", color: "text-emerald-400", Icon: PiggyBank },
  "Personal": { bg: "bg-pink-500/20", color: "text-pink-400", Icon: User },
  "Entertainment": { bg: "bg-purple-500/20", color: "text-purple-400", Icon: Film },
  "Other": { bg: "bg-slate-500/20", color: "text-slate-400", Icon: Box },
  // Income
  "Salary": { bg: "bg-green-500/20", color: "text-green-400", Icon: DollarSign },
  "Bonus": { bg: "bg-teal-500/20", color: "text-teal-400", Icon: Gift },
  "Investment": { bg: "bg-sky-500/20", color: "text-sky-400", Icon: TrendingUp },
  "Gift": { bg: "bg-rose-500/20", color: "text-rose-400", Icon: Gift },
};

const getCategoryStyle = (category) => CATEGORY_STYLES[category] || CATEGORY_STYLES["Other"];

const BudgetTransactionsPage = () => {
  const { transactions, refreshData, money, notify, busyAction, setBusyAction, entryMode } = useBudgetOutlet();
  const fileInputRef = useRef(null);

  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sampleFilter] = useState("all");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    description: "",
    amount: "",
    type: "expense",
    category: "Other",
    paymentMode: "upi",
    transactionDate: "",
    note: "",
  });

  const sampleCount = transactions.filter((txn) => txn.isSample).length;

  // --- PDF Parsing Logic ---
  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setBusyAction(true);
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item) => item.str).join(" ");
      }

      const extractedTxs = parseTransactionsFromText(fullText);

      if (extractedTxs.length === 0) {
        notify("error", "No valid transactions found in PDF.");
        return;
      }

      await api.post("/api/transactions/import/pdf", { 
        transactions: extractedTxs,
        entryMode: entryMode || "actual" 
      });

      await refreshData();
      notify("success", `Imported ${extractedTxs.length} transactions!`);
    } catch (err) {
      console.error("PDF Parsing Error:", err);
      notify("error", "Failed to process PDF.");
    } finally {
      setBusyAction(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const parseTransactionsFromText = (text) => {
    const data = [];
    const regex = /(.+?)\s+(Canara[\s\w]*?\d{4})\s+([+-]?[\d,]+\.\d{2})\s+(\d{1,2}\s[A-Za-z]+\s\d{4})\s+(SUCCESS)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      let name = match[1].trim();
      const amount = parseFloat(match[3].replace(/,/g, ""));
      const dateStr = match[4].trim();
      
      const junkKeywords = ["SUCCESS", "Name", "Bank", "Amount", "Date", "Status"];
      junkKeywords.forEach(kw => {
        const idx = name.lastIndexOf(kw);
        if (idx !== -1) name = name.substring(idx + kw.length).trim();
      });

      data.push({
        name: name,
        amount: amount,
        category: "Other",
        date: dateStr,
      });
    }
    return data;
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const matchesSearch = txn.description.toLowerCase().includes(searchText.trim().toLowerCase());
      const matchesType = typeFilter === "all" || txn.type === typeFilter;
      const matchesSample =
        sampleFilter === "all" || (sampleFilter === "sample" && txn.isSample) || (sampleFilter === "manual" && !txn.isSample);
      return matchesSearch && matchesType && matchesSample;
    });
  }, [transactions, searchText, typeFilter, sampleFilter]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach(txn => {
      const dateStr = toInputDate(txn.transactionDate || txn.createdAt);
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(txn);
    });
    return Object.keys(groups)
      .sort((a, b) => new Date(b) - new Date(a))
      .map(date => ({
        date,
        transactions: groups[date]
      }));
  }, [filteredTransactions]);

  const startEditing = (txn) => {
    setEditingId(txn._id);
    setEditForm({
      description: txn.description,
      amount: String(txn.amount),
      type: txn.type || "expense",
      category: txn.category || "Other",
      paymentMode: txn.paymentMode || "upi",
      transactionDate: toInputDate(txn.transactionDate || txn.createdAt),
      note: txn.note || "",
    });
  };

  const cancelEditing = () => setEditingId(null);

  const saveEdit = async (transactionId) => {
    const parsedAmount = Number(editForm.amount);
    if (!editForm.description.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      notify("error", "Please add valid description and amount.");
      return;
    }
    try {
      setBusyAction(true);
      await api.put(`/api/transactions/${transactionId}`, { ...editForm, amount: parsedAmount });
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
      if (editingId === transactionId) cancelEditing();
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
      <div className="flex flex-col sm:flex-row items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-white font-medium">Bank Statement Import</h3>
          <p className="text-xs text-slate-400">Extract transactions automatically from PDF</p>
        </div>
        <input type="file" ref={fileInputRef} onChange={handlePdfUpload} accept=".pdf" className="hidden" />
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={busyAction}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
        >
          {busyAction ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          {busyAction ? "Processing..." : "Upload Statement"}
        </button>
      </div>

      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
        Sample rows loaded: <b>{sampleCount}</b>.
      </div>

      <SmartInput onTransactionAdded={refreshData} entryMode={entryMode} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <p className="font-bold text-white text-sm sm:text-base">Transactions</p>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search..."
                className="bg-slate-950 border border-slate-700 rounded-xl py-2 pl-8 pr-3 text-xs sm:text-sm w-full sm:w-44 outline-none focus:border-cyan-500/50"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-xs sm:text-sm text-white outline-none focus:border-cyan-500/50"
            >
              {typeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-6 max-h-[620px] overflow-y-auto pr-1">
          {groupedTransactions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
              <div className="flex justify-center mb-3">
                <Filter className="text-slate-600" size={32} />
              </div>
              No transactions matching your criteria.
            </div>
          ) : (
            groupedTransactions.map((group) => (
              <div key={group.date}>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 pl-2 flex items-center gap-2">
                  <span>{new Date(group.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                  <div className="h-px bg-slate-800 flex-1"></div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-sm overflow-hidden">
                  {group.transactions.map((txn, idx) => {
                    const { bg, color, Icon } = getCategoryStyle(txn.category);
                    return (
                      <div key={txn._id} className={`group relative p-4 transition-colors hover:bg-slate-800/50 ${idx !== group.transactions.length - 1 ? 'border-b border-slate-800/60' : ''}`}>
                        {editingId === txn._id ? (
                          <div className="grid grid-cols-1 lg:grid-cols-8 gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                            <select
                              value={editForm.type}
                              onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value, category: categoriesByType[e.target.value][0] }))}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                            >
                              <option value="expense">expense</option>
                              <option value="income">income</option>
                            </select>
                            <input
                              value={editForm.description}
                              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                              className="lg:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                            />
                            <input
                              type="number"
                              value={editForm.amount}
                              onChange={(e) => setEditForm((p) => ({ ...p, amount: e.target.value }))}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                            />
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                            >
                              {(categoriesByType[editForm.type] || ["Other"]).map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            <select
                              value={editForm.paymentMode}
                              onChange={(e) => setEditForm((p) => ({ ...p, paymentMode: e.target.value }))}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                            >
                              <option value="upi">UPI</option>
                              <option value="cash">Cash</option>
                              <option value="savings">Savings</option>
                            </select>
                            <input
                              type="date"
                              value={editForm.transactionDate}
                              onChange={(e) => setEditForm((p) => ({ ...p, transactionDate: e.target.value }))}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                            />
                            <input
                              value={editForm.note}
                              onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))}
                              placeholder="Note"
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                            />
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => saveEdit(txn._id)} className="px-3 py-2 rounded-lg bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 text-xs font-medium transition-colors">Save</button>
                              <button onClick={cancelEditing} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-xs font-medium transition-colors">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${bg} ${color}`}>
                                <Icon size={20} className="stroke-[1.5]" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-100 truncate text-sm mb-0.5">{txn.description}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <span>{txn.category}</span>
                                  {txn.note && (
                                    <>
                                      <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                      <span className="truncate max-w-[120px]">{txn.note}</span>
                                    </>
                                  )}
                                  <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    txn.paymentMode === 'cash' ? 'bg-amber-500/10 text-amber-400' : 
                                    txn.paymentMode === 'savings' ? 'bg-indigo-500/10 text-indigo-400' : 
                                    'bg-cyan-500/10 text-cyan-400'
                                  }`}>
                                    {txn.paymentMode || 'UPI'}
                                  </span>
                                  <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                  <span>{txn.isSample ? "Sample" : "Valid"}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <p className={`font-semibold text-base tracking-tight ${txn.type === "income" ? "text-emerald-400" : "text-slate-100"}`}>
                                  {txn.type === "expense" ? "-" : "+"}{money(txn.amount)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <button onClick={() => startEditing(txn)} className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                                  <Pencil size={15} />
                                </button>
                                <button onClick={() => deleteTransaction(txn._id)} className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default BudgetTransactionsPage;