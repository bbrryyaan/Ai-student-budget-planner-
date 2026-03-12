import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail, User, Wallet, Zap, IndianRupee } from "lucide-react";
import { useAuth } from "../context/useAuth";

const initialForm = {
  name: "",
  email: "",
  password: "",
  monthlyBudget: "",
  currency: "INR",
};

const Login = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [formData, setFormData] = useState(initialForm);

  const onFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");
    setIsLoading(true);

    try {
      if (isLogin) {
        await login({ email: formData.email, password: formData.password });
        navigate("/dashboard/overview");
      } else {
        await register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          monthlyBudget: Number(formData.monthlyBudget),
          currency: formData.currency,
        });
        setInfoMessage("Account created. Sign in to continue.");
        setIsLogin(true);
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-800/30 border border-slate-700/50 p-10 rounded-[2.5rem] backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center mb-10">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20 mb-4">
            <Zap className="text-white w-8 h-8 fill-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to EcoSpend</h1>
          <p className="text-slate-400 text-sm mt-2">Secure AI-powered expense tracking.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Full Name"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3 px-12 outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                value={formData.name}
                required={!isLogin}
                onChange={(e) => onFieldChange("name", e.target.value)}
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="email"
              placeholder="Email Address"
              required
              className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3 px-12 outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
              value={formData.email}
              onChange={(e) => onFieldChange("email", e.target.value)}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="password"
              placeholder="Password (min 8 chars)"
              required
              minLength={8}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3 px-12 outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
              value={formData.password}
              onChange={(e) => onFieldChange("password", e.target.value)}
            />
          </div>
          

          {!isLogin && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Monthly Budget"
                  required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                  value={formData.monthlyBudget}
                  onChange={(e) => onFieldChange("monthlyBudget", e.target.value)}
                />
              </div>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <select
                  required
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/50 text-white appearance-none"
                  value={formData.currency}
                  onChange={(e) => onFieldChange("currency", e.target.value)}
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
            </div>
          )}

          {errorMessage && (
            <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-xl px-3 py-2">
              {errorMessage}
            </p>
          )}

          {infoMessage && (
            <p className="text-sm text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 rounded-xl px-3 py-2">
              {infoMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl mt-4 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            {isLoading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-8">
          {isLogin ? "New here?" : "Already have an account?"}
          <button
            onClick={() => {
              setIsLogin((prev) => !prev);
              setErrorMessage("");
              setInfoMessage("");
            }}
            className="text-indigo-400 font-bold ml-2 hover:underline"
          >
            {isLogin ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
