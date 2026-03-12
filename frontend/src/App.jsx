import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import BudgetLayout from "./pages/budget/BudgetLayout";
import BudgetOverviewPage from "./pages/budget/BudgetOverviewPage";
import BudgetCalendarPage from "./pages/budget/BudgetCalendarPage";
import BudgetTransactionsPage from "./pages/budget/BudgetTransactionsPage";
import BudgetAffordabilityPage from "./pages/budget/BudgetAffordabilityPage";
import AnalysisPage from "./pages/budget/AnalysisPage"; //$$$$$$
import SettingsPage from "./pages/budget/SettingsPage";
import { useAuth } from "./context/useAuth";

const FullScreenLoader = () => (
  <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-4 border-indigo-500/40 border-t-indigo-400 animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <FullScreenLoader />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <FullScreenLoader />;
  }

  return isAuthenticated ? <Navigate to="/dashboard/overview" replace /> : children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <BudgetLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<BudgetOverviewPage />} />
          <Route path="analysis" element={<AnalysisPage />} /> 
          <Route path="affordability" element={<BudgetAffordabilityPage />} />
          <Route path="calendar" element={<BudgetCalendarPage />} />
          <Route path="transactions" element={<BudgetTransactionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
