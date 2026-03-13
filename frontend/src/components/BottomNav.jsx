import { NavLink } from "react-router-dom";
import { LayoutDashboard, ReceiptText, Zap, Bot, Sparkles } from "lucide-react";

const BottomNav = () => {
  const items = [
    { to: "/dashboard/overview", label: "Home", icon: LayoutDashboard },
    { to: "/dashboard/transactions", label: "History", icon: ReceiptText },
    { to: "/dashboard/smart-spend", label: "Scout", icon: Zap },
    { to: "/dashboard/moneybuddy", label: "Buddy", icon: Bot },
    { to: "/dashboard/affordability", label: "AI", icon: Sparkles },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 lg:hidden px-4 pb-safe">
      <div className="flex justify-between items-center h-16 max-w-md mx-auto">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 min-w-[64px] transition-all ${
                isActive ? "text-indigo-400" : "text-slate-500"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1 rounded-xl transition-all ${isActive ? "bg-indigo-500/10 scale-110" : ""}`}>
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
