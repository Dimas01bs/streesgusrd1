import { startTransition, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  BookOpen,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import {
  createPrediction,
  getDashboardSummary,
  getCurrentUser,
  getFormMeta,
  getPredictionHistory,
  healthCheck,
  normalizeApiError,
} from "./lib/api";
import {
  createInitialFormValues,
  fallbackFormMeta,
  mergeFormMeta,
  normalizePayload,
  validateForm,
} from "./lib/form";
import { DashboardSummary } from "./components/DashboardSummary";
import { HeroSection } from "./components/HeroSection";
import { HistoryPanel } from "./components/HistoryPanel";
import { PredictionResult } from "./components/PredictionResult";
import { SleepForm } from "./components/SleepForm";
import { LandingPage } from "./components/LandingPage";
import { AppNavbar } from "./components/AppNavbar";
import { LoginPage } from "./pages/LoginPage";
import { auth } from "./firebase";
const defaultHistoryMeta = {
  page: 1,
  limit: 6,
  total: 0,
  totalPages: 1,
};

const googleRedirectPendingKey = "stressguard-google-redirect-pending";

const dashboardNavItems = [
  {
    label: "Home",
    href: "#top",
    icon: Home,
  },
  {
    label: "Asesmen",
    href: "#assessment",
    icon: ClipboardList,
  },
  {
    label: "Dashboard",
    href: "#dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Journal",
    href: "#history",
    icon: BookOpen,
  },
];

function DashboardSidebar({ onAssessment, onLogout }) {
  return (
    <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
      <div className="dashboard-sidebar-brand">
        <div className="dashboard-sidebar-logo">SG</div>
        <div>
          <strong>StressGuard</strong>
          <span>AI wellness companion</span>
        </div>
      </div>

      <nav className="dashboard-sidebar-nav">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;

          return (
            <a href={item.href} key={item.label}>
              <Icon size={18} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="dashboard-sidebar-actions">
        <button type="button" className="dashboard-sidebar-primary" onClick={onAssessment}>
          Cek Stres
        </button>

        <button type="button" className="dashboard-sidebar-logout" onClick={onLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [showApp, setShowApp] = useState(false);

  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem("token");
    return token ? { authenticated: true } : null;
  });
  const [health, setHealth] = useState({
    online: false,
    message: "Memeriksa koneksi backend...",
  });
  const [formMeta, setFormMeta] = useState(fallbackFormMeta);
  const [formValues, setFormValues] = useState(() =>
    createInitialFormValues(fallbackFormMeta.fields),
  );
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestPrediction, setLatestPrediction] = useState(null);

  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyMeta, setHistoryMeta] = useState(defaultHistoryMeta);
  const [historyFilter, setHistoryFilter] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyPending, setHistoryPending] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      await Promise.allSettled([
        loadCurrentUser(),
        loadHealth(),
        loadFormMetadata(),
        loadDashboard(),
        loadHistory(""),
      ]);
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (currentUser && localStorage.getItem("token")) {
      resetUserScopedData();
      Promise.all([
        loadDashboard(),
        loadHistory("")
      ]);
      setHistoryFilter("");
    }
  }, [currentUser?.id]); // Watch ID user, bukan object reference

  async function loadCurrentUser() {
    if (!localStorage.getItem("token")) {
      return;
    }

    try {
      const response = await getCurrentUser();
      setCurrentUser(response.data);
    } catch (error) {
      localStorage.removeItem("token");
      setCurrentUser(null);
      setShowApp(false);
    }
  }

  function resetUserScopedData() {
    setDashboard(null);
    setDashboardLoading(true);
    setDashboardError("");
    setLatestPrediction(null);

    setHistoryEntries([]);
    setHistoryMeta(defaultHistoryMeta);
    setHistoryFilter("");
    setHistoryLoading(true);
    setHistoryError("");
    setHistoryPending(false);
  }

  function resetAllData() {
    resetUserScopedData();
    setFormValues(createInitialFormValues(formMeta.fields));
    setFormErrors({});
    setSubmitError("");
    setSuccessMessage("");
  }

  async function loadHealth() {
    try {
      const response = await healthCheck();
      setHealth({
        online: true,
        message: response.message || "Backend siap menerima request.",
      });
    } catch (error) {
      setHealth({
        online: false,
        message:
          "Backend belum terhubung. Jalankan server Express untuk mengaktifkan analisis real-time.",
      });
    }
  }

  async function loadFormMetadata() {
    try {
      const response = await getFormMeta();
      const nextMeta = mergeFormMeta(response.data || fallbackFormMeta);
      setFormMeta(nextMeta);
      setFormValues(createInitialFormValues(nextMeta.fields));
    } catch (error) {
      setSubmitError(
        "Metadata form dari backend belum bisa dimuat. Frontend memakai fallback agar tetap bisa dipakai.",
      );
    }
  }

  async function loadDashboard() {
    setDashboardLoading(true);
    setDashboardError("");

    try {
      const response = await getDashboardSummary();
      setDashboard(response.data || null);
      setLatestPrediction(response.data?.latestPrediction || null);
    } catch (error) {
      // Jika error saat fetch, set dashboard to null tapi jangan show error message
      // karena ini normal untuk akun baru
      setDashboard(null);
      console.error("Dashboard load error:", error);
    } finally {
      setDashboardLoading(false);
    }
  }

  async function loadHistory(filterValue = "") {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await getPredictionHistory({
        page: 1,
        limit: 6,
        ...(filterValue ? { stressLevel: filterValue } : {}),
      });
      setHistoryEntries(response.data || []);
      setHistoryMeta(response.meta || defaultHistoryMeta);
    } catch (error) {
      // Jika error saat fetch, set entries kosong
      setHistoryEntries([]);
      setHistoryMeta(defaultHistoryMeta);
      console.error("History load error:", error);
    } finally {
      setHistoryPending(false);
      setHistoryLoading(false);
    }
  }

  function handleFieldChange(name, rawValue, type) {
    const nextValue =
      type === "number" || type === "range"
        ? rawValue === ""
          ? ""
          : Number(rawValue)
        : rawValue;

    setFormValues((current) => ({
      ...current,
      [name]: nextValue,
    }));

    setFormErrors((current) => {
      if (!current[name]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[name];
      return nextErrors;
    });

    setSubmitError("");
    setSuccessMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const errors = validateForm(formValues, formMeta.fields);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      setSubmitError("Periksa kembali beberapa field yang masih belum valid.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSuccessMessage("");

    try {
      const payload = normalizePayload(formValues, formMeta.fields);
      const response = await createPrediction(payload);
      const prediction = response.data;

      setLatestPrediction(prediction);
      setSuccessMessage(
        "Analisis berhasil. Dashboard dan riwayat sedang diperbarui.",
      );

      await Promise.all([
        loadDashboard(),
        loadHistory(historyFilter),
        loadHealth(),
      ]);
    } catch (error) {
      setSubmitError(
        normalizeApiError(error, "Analisis gagal dikirim ke backend."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFilterChange(nextFilter) {
    setHistoryPending(true);
    startTransition(() => {
      setHistoryFilter(nextFilter);
    });
    loadHistory(nextFilter);
  }

  function handleStartAssessment() {
    if (!currentUser) {
      setShowLogin(true);
      return;
    }

    setShowApp(true);

    setTimeout(() => {
      document.getElementById("assessment")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase logout error:", error);
    }

    localStorage.removeItem("token");
    setCurrentUser(null);
    setShowApp(false);
    setShowLogin(false);
    resetAllData();
    window.history.replaceState(null, "", window.location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLoginSuccess(user) {
    resetAllData();
    setCurrentUser(user);
    setShowLogin(false);
    setShowApp(true);

    setTimeout(() => {
      document.getElementById("assessment")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  }

  function scrollToAssessment() {
  if (!currentUser) {
    setShowLogin(true);
    return;
  }

  setShowApp(true);

  setTimeout(() => {
    document.getElementById("assessment")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 100);
}

  return (
    <div
      className={`app-shell${showLogin ? " login-shell" : ""}${showApp ? " dashboard-shell" : ""}`}
      id="top"
    >
      {!showLogin && (
        <>
          <div className="ambient-line ambient-line-one" aria-hidden="true" />
          <div className="ambient-line ambient-line-two" aria-hidden="true" />
          <div className="ambient-glow ambient-glow-one" aria-hidden="true" />
          <div className="ambient-glow ambient-glow-two" aria-hidden="true" />
        </>
      )}
      <div className={`page-shell${showApp ? " dashboard-layout" : ""}`}>
        {!showLogin && !showApp && (
          <AppNavbar
            health={health}
            showApp={showApp}
            onStart={scrollToAssessment}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        )}

        {showApp && (
          <DashboardSidebar
            onAssessment={scrollToAssessment}
            onLogout={handleLogout}
          />
        )}

        <main className={showApp ? "content-stack" : "landing-only"}>
          {!showApp ? (
  showLogin ? (
    <LoginPage
      onBack={() => setShowLogin(false)}
      onLoginSuccess={handleLoginSuccess}
    />
  ) : (
    <LandingPage health={health} onStart={scrollToAssessment} />
  )
) : (
            <>
              <HeroSection
                health={health}
                user={currentUser}
                latestPrediction={
                  dashboard?.latestPrediction || latestPrediction
                }
                onPrimaryClick={scrollToAssessment}
              />

              <SleepForm
                fields={formMeta.fields}
                values={formValues}
                errors={formErrors}
                isSubmitting={isSubmitting}
                submitError={submitError}
                successMessage={successMessage}
                onChange={handleFieldChange}
                onSubmit={handleSubmit}
              />

              <PredictionResult result={latestPrediction} />

              <DashboardSummary
                summary={dashboard}
                isLoading={dashboardLoading}
                error={dashboardError}
              />

              <HistoryPanel
                entries={historyEntries}
                meta={historyMeta}
                filter={historyFilter}
                isLoading={historyLoading}
                isPending={historyPending}
                error={historyError}
                onFilterChange={handleFilterChange}
                onRefresh={() => loadHistory(historyFilter)}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
