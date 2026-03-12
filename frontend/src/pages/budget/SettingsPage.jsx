import { useState } from "react";
import { useAuth } from "../../context/useAuth";
import { useBudgetOutlet } from "./useBudgetOutlet";
import api from "../../lib/api";
import { Loader2 } from "lucide-react";

const SettingsPage = () => {
  const { user, setUser } = useAuth();
  const { notify } = useBudgetOutlet();

  const [currency, setCurrency] = useState(user?.currency || "INR");
  const [isBusy, setIsBusy] = useState(false);

  const handleUpdate = async (event) => {
    event.preventDefault();

    if (currency === user?.currency) {
      notify("info", "You have already selected this currency.");
      return;
    }

    if (!window.confirm(`Are you sure you want to change your currency to ${currency}? This will convert your monthly budget amount.`)) {
      return;
    }

    setIsBusy(true);
    try {
      const { data } = await api.post("/api/settings/convert-currency", { newCurrency: currency });
      setUser(data.user);
      notify("success", data.message || "Settings updated successfully.");
    } catch (error) {
      notify("error", error.response?.data?.message || "Failed to update settings.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5">
      <h2 className="text-xl font-bold text-white">Settings</h2>
      <p className="text-slate-400 mt-1">Manage your account settings.</p>

      <form onSubmit={handleUpdate} className="mt-6 max-w-sm">
        <div className="space-y-2">
          <label htmlFor="currency" className="text-sm font-medium text-slate-300">
            Display Currency
          </label>
          <select
            id="currency"
            required
            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="INR">Indian Rupee (INR)</option>
            <option value="USD">United States Dollar (USD)</option>
            <option value="EUR">Euro (EUR)</option>
            <option value="GBP">British Pound (GBP)</option>
            <option value="JPY">Japanese Yen (JPY)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isBusy}
          className="mt-6 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isBusy && <Loader2 size={16} className="animate-spin" />}
          Save Changes
        </button>
      </form>
    </article>
  );
};

export default SettingsPage;
