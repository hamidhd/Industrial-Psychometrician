import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { AuthGate, type AuthenticatedSession } from './components/AuthGate';
import { DashboardView } from './components/DashboardView';
import { HelpView } from './components/HelpView';
import { PeopleView } from './components/PeopleView';
import { ResultsView } from './components/ResultsView';
import { RunTestView } from './components/RunTestView';
import { SettingsView } from './components/SettingsView';
import { normalizeFa } from './data/workUnits';
import {
  localCreatePerson,
  subscribeLocalPeople,
  subscribeLocalResults,
  subscribeLocalWorkspaces,
} from './services/localStoreService';
import {
  createServerPerson,
  fetchServerWorkspaceData,
  fetchServerWorkspaces,
  logoutServer,
} from './services/serverApiService';
import type {
  OccupationalCategoryId,
  Person,
  TestResult,
  ViewName,
  Workspace,
} from './types/psychometrics';

export default function App() {
  // Keep authenticated session strictly in JS memory (never persist privileged tokens in localStorage)
  const [session, setSession] = useState<AuthenticatedSession | null>(() => {
    try {
      // Clean up legacy insecure persisted session/credential keys if present from older versions
      localStorage.removeItem('rsi_logged_session');
      localStorage.removeItem('rsi_app_users');
      localStorage.removeItem('rsi_app_users_v2');
    } catch {
      // ignore
    }
    return null;
  });

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoaded, setWsLoaded] = useState(false);
  const [activeWsId, setActiveWsId] = useState<string>(
    () => localStorage.getItem('rsi_ws_id') || ''
  );

  const [people, setPeople] = useState<Person[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [peopleReady, setPeopleReady] = useState(false);

  const [view, setView] = useState<ViewName>('run');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'' | OccupationalCategoryId>('');

  const [computerLabel, setComputerLabel] = useState<string>(
    () => localStorage.getItem('rsi_computer_label') || 'رایانه ۱'
  );

  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('rsi_theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return true;
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const autoCreatingEmployeeRef = useRef<string | null>(null);

  const currentUser = session?.user ?? null;
  const useServer = Boolean(session?.useServer);
  const serverCtx = useMemo(
    () =>
      session?.useServer
        ? { baseUrl: session.serverBaseUrl, token: session.token }
        : null,
    [session]
  );

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('rsi_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleLoginSuccess = (nextSession: AuthenticatedSession) => {
    setSession(nextSession);
    setWorkspaces([]);
    setPeople([]);
    setResults([]);
    setSelectedPersonId(null);
    autoCreatingEmployeeRef.current = null;
    setView(nextSession.user.hasResultAccess ? 'home' : 'run');
  };

  const handleLogout = useCallback(() => {
    if (serverCtx) {
      void logoutServer(serverCtx);
    }
    setSession(null);
    setWorkspaces([]);
    setPeople([]);
    setResults([]);
    setSelectedPersonId(null);
    autoCreatingEmployeeRef.current = null;
  }, [serverCtx]);

  const handleComputerLabelChange = (label: string) => {
    setComputerLabel(label);
    localStorage.setItem('rsi_computer_label', label);
  };

  const handleSelectWorkspace = (id: string) => {
    setActiveWsId(id);
    localStorage.setItem('rsi_ws_id', id);
    setSelectedPersonId(null);
  };

  // Load workspaces
  const loadServerWorkspaces = useCallback(async () => {
    if (!serverCtx) return;
    try {
      const list = await fetchServerWorkspaces(serverCtx);
      setWorkspaces(list);
      setWsLoaded(true);
    } catch (err) {
      setWsLoaded(true);
      if (err instanceof Error && err.message.includes('منقضی')) {
        handleLogout();
        showToast('نشست کاربری شما منقضی شد؛ لطفاً دوباره وارد شوید.');
      }
    }
  }, [serverCtx, handleLogout, showToast]);

  useEffect(() => {
    if (!currentUser) return;
    setWsLoaded(false);

    if (useServer && serverCtx) {
      void loadServerWorkspaces();
      return;
    }

    const unsubLocal = subscribeLocalWorkspaces((list) => {
      setWorkspaces(list);
      setWsLoaded(true);
    });
    return unsubLocal;
  }, [currentUser, useServer, serverCtx, loadServerWorkspaces]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWsId) || workspaces[0] || null;

  // Load / refresh active workspace data
  const refreshServerWorkspaceData = useCallback(async () => {
    if (!serverCtx || !activeWorkspace) return;
    try {
      const data = await fetchServerWorkspaceData(serverCtx, activeWorkspace.id);
      setPeople(data.people);
      setResults(data.results);
      setPeopleReady(true);
      setDataLoading(false);
    } catch (err) {
      setPeopleReady(true);
      setDataLoading(false);
      if (err instanceof Error && (err.message.includes('منقضی') || err.message.includes('401'))) {
        handleLogout();
        showToast('نشست کاربری شما منقضی شد؛ لطفاً دوباره وارد شوید.');
      }
    }
  }, [serverCtx, activeWorkspace, handleLogout, showToast]);

  const refreshAll = useCallback(async () => {
    if (!useServer) return;
    await loadServerWorkspaces();
    await refreshServerWorkspaceData();
  }, [useServer, loadServerWorkspaces, refreshServerWorkspaceData]);

  useEffect(() => {
    if (!currentUser || !activeWorkspace) {
      setPeople([]);
      setResults([]);
      setPeopleReady(false);
      return;
    }
    setDataLoading(true);
    setPeopleReady(false);

    if (useServer && serverCtx) {
      void refreshServerWorkspaceData();
      const timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void refreshServerWorkspaceData();
        }
      }, 8000);
      return () => window.clearInterval(timer);
    }

    let pDone = false;
    let rDone = false;
    const checkDone = () => {
      if (pDone && rDone) setDataLoading(false);
    };

    const unsubLocalP = subscribeLocalPeople(activeWorkspace.id, (list) => {
      setPeople(list);
      setPeopleReady(true);
      pDone = true;
      checkDone();
    });

    const unsubLocalR = subscribeLocalResults(activeWorkspace.id, (list) => {
      setResults(list);
      rDone = true;
      checkDone();
    });

    return () => {
      unsubLocalP();
      unsubLocalR();
    };
  }, [activeWorkspace?.id, currentUser, useServer, serverCtx, refreshServerWorkspaceData]);

  // Auto-register logged-in employee in workspace people list if not already present
  useEffect(() => {
    if (!currentUser || currentUser.hasResultAccess || !activeWorkspace || !peopleReady) return;

    const matched = people.find(
      (p) =>
        (currentUser.personnelId && p.code === currentUser.personnelId) ||
        (currentUser.nationalCode &&
          currentUser.nationalCode !== '0000000000' &&
          p.code === currentUser.nationalCode) ||
        (currentUser.name !== 'پرسنل گرامی' && normalizeFa(p.name) === normalizeFa(currentUser.name))
    );

    if (matched) {
      if (!selectedPersonId) setSelectedPersonId(matched.id);
      return;
    }

    const guardKey = `${activeWorkspace.id}_${currentUser.id}`;
    if (autoCreatingEmployeeRef.current === guardKey) return;
    autoCreatingEmployeeRef.current = guardKey;

    const payload = {
      name: currentUser.name,
      code: currentUser.personnelId || currentUser.nationalCode || '',
      kind: 'employee' as const,
      dept: currentUser.dept || '',
      job: '',
      age: '',
      consent: true,
    };

    if (useServer && serverCtx) {
      void createServerPerson(serverCtx, activeWorkspace.id, payload).then((id) => {
        setSelectedPersonId(id);
        void refreshServerWorkspaceData();
      });
    } else {
      const id = localCreatePerson(activeWorkspace, currentUser.id, payload);
      setSelectedPersonId(id);
    }
  }, [
    currentUser,
    activeWorkspace,
    peopleReady,
    people,
    selectedPersonId,
    useServer,
    serverCtx,
    refreshServerWorkspaceData,
  ]);

  if (!session || !currentUser) {
    return <AuthGate onLoginSuccess={handleLoginSuccess} onToast={showToast} />;
  }

  if (!wsLoaded || !activeWorkspace) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-sm text-[var(--ink-muted)]">
        در حال آماده‌سازی پایگاه داده…
      </div>
    );
  }

  const navigate = (nextView: ViewName) => {
    if (!currentUser.hasResultAccess && (nextView === 'home' || nextView === 'people' || nextView === 'settings')) {
      return;
    }
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  // Strict privacy isolation: employees ONLY see their own profile & own test results
  const ownPerson = !currentUser.hasResultAccess
    ? people.find(
        (p) =>
          (currentUser.personnelId && p.code === currentUser.personnelId) ||
          (currentUser.nationalCode &&
            currentUser.nationalCode !== '0000000000' &&
            p.code === currentUser.nationalCode) ||
          p.createdByUid === currentUser.id
      ) || null
    : null;

  const visiblePeople = currentUser.hasResultAccess ? people : ownPerson ? [ownPerson] : [];
  const visibleResults = currentUser.hasResultAccess
    ? results
    : ownPerson
    ? results.filter((r) => r.personId === ownPerson.id)
    : [];

  const navItems = currentUser.hasResultAccess
    ? [
        { id: 'home' as ViewName, label: 'داشبورد', Icon: LayoutDashboard },
        { id: 'people' as ViewName, label: 'پرسنل و داوطلبان', Icon: Users },
        { id: 'run' as ViewName, label: 'اجرای آزمون', Icon: ClipboardCheck },
        { id: 'results' as ViewName, label: 'نتایج و گزارش', Icon: FileBarChart2 },
        { id: 'help' as ViewName, label: 'راهنما و تفسیر', Icon: BookOpen },
        { id: 'settings' as ViewName, label: 'تنظیمات و کاربران', Icon: Settings },
      ]
    : [
        { id: 'run' as ViewName, label: 'تکمیل آزمون', Icon: ClipboardCheck },
        { id: 'results' as ViewName, label: 'نتیجه و پیشنهاد شغلی من', Icon: FileBarChart2 },
        { id: 'help' as ViewName, label: 'راهنما', Icon: BookOpen },
      ];

  const viewMeta: Record<ViewName, { title: string; subtitle: string }> = {
    home: {
      title: 'داشبورد',
      subtitle: `سامانه روان‌سنجی استاندارد و جایابی شغلی · ${
        useServer ? 'سرور داخلی سازمان' : 'حالت محلی'
      } (${computerLabel})`,
    },
    people: {
      title: 'پرسنل و داوطلبان',
      subtitle: 'ثبت تکی یا گروهی افراد، دسته‌بندی واحدهای کاری و مدیریت واحدهای اختصاصی سازمان',
    },
    run: {
      title: currentUser.hasResultAccess ? 'اجرای آزمون' : 'تکمیل آزمون',
      subtitle: 'انتخاب بسته‌ی شغلی و اجرای پرسشنامه‌ها و آزمون‌های عملکردی استاندارد',
    },
    results: {
      title: currentUser.hasResultAccess ? 'نتایج و گزارش' : 'نتیجه و پیشنهاد شغلی من',
      subtitle: 'تحلیل علمی شاخص‌ها، تعیین واحد کاری مناسب و گزارش قابل چاپ',
    },
    help: {
      title: 'راهنما و تفسیر',
      subtitle: 'نحوه‌ی اجرا، نمره‌گذاری و تفسیر تخصصی آزمون‌های روان‌سنجی صنعتی',
    },
    settings: {
      title: 'تنظیمات و کاربران',
      subtitle: 'مدیریت امنیت حساب‌های مدیریتی، پایگاه داده، سرور داخلی و پشتیبان‌گیری',
    },
  };

  const activeMeta = viewMeta[view];

  const roleSummary =
    currentUser.role === 'admin'
      ? 'مدیر ارشد سیستم (HSE)'
      : currentUser.role === 'evaluator'
      ? 'ارزیاب / طب کار'
      : `واحد: ${currentUser.dept || 'عمومی'}`;

  return (
    <div className="ambient-shell min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[var(--bg)] text-[var(--ink)]">
      <div className="flex-1 min-h-0 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* Sidebar (Desktop) */}
        <aside className="no-print hidden lg:flex flex-col justify-between bg-[var(--surface)] border-l border-[var(--ink-faint)] p-8 overflow-y-auto">
          <div>
            <div className="flex items-center gap-3 mb-11">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center font-black text-xl shrink-0 shadow-[0_0_20px_var(--accent-soft)]">
                ر
              </div>
              <span className="font-black text-[1.2rem] tracking-tight whitespace-nowrap">
                روان‌سنج صنعتی
              </span>
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.map(({ id, label, Icon }) => {
                const active = view === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => navigate(id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-[10px] text-sm text-right cursor-pointer transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-bold'
                        : 'text-[var(--ink-muted)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] font-medium'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-[var(--ink-faint)] space-y-0.5">
            <div className="text-xs font-bold text-[var(--ink)] truncate">{currentUser.name}</div>
            <div className="text-[11px] text-[var(--ink-muted)] truncate">{roleSummary}</div>
            <div className="text-[11px] text-[var(--ink-muted)] truncate">
              {computerLabel} / {useServer ? 'سرور داخلی' : 'آفلاین'}
            </div>
          </div>
        </aside>

        {/* Main Column */}
        <div className="flex flex-col min-w-0 min-h-0">
          {/* Mobile Brand + Nav Strip */}
          <div className="no-print lg:hidden bg-[var(--surface)] border-b border-[var(--ink-faint)]">
            <div className="px-4 h-14 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center font-black text-base shrink-0 shadow-[0_0_14px_var(--accent-soft)]">
                  ر
                </div>
                <span className="font-black text-base whitespace-nowrap">روان‌سنج صنعتی</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDark((d) => !d)}
                  title="تغییر پوسته"
                  className="p-2 rounded-lg bg-[var(--ink-faint)] border border-[var(--ink-faint)] text-[var(--ink)] hover:border-[var(--accent)]/40 cursor-pointer shrink-0"
                >
                  {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="خروج از سیستم"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ink-faint)] border border-[var(--ink-faint)] text-[#dc2626] dark:text-[#f87171] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج</span>
                </button>
              </div>
            </div>

            <nav className="px-3 pb-2.5 flex gap-1.5 overflow-x-auto">
              {navItems.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    view === id
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-bold'
                      : 'text-[var(--ink-muted)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] font-medium'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Scrollable Dot-Matrix Content Area */}
          <main className="dot-grid-canvas flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10">
            <div className="max-w-[1140px] w-full space-y-8">
              {/* Header Meta inside Main */}
              <div className="no-print flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-3xl sm:text-[2.75rem] font-black tracking-tight leading-tight text-balance bg-gradient-to-b from-[#0f172a] to-[#475569] dark:from-white dark:to-[#94a3b8] bg-clip-text text-transparent">
                    {activeMeta.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-[var(--ink-muted)] mt-2">
                    {activeMeta.subtitle}
                  </p>
                </div>

                <div className="hidden lg:flex items-center gap-2.5 shrink-0">
                  {currentUser.hasResultAccess && workspaces.length > 1 && (
                    <select
                      aria-label="پایگاه داده فعال"
                      value={activeWorkspace.id}
                      onChange={(e) => handleSelectWorkspace(e.target.value)}
                      className="max-w-[190px] px-3 py-2.5 rounded-lg border border-[var(--ink-faint)] bg-[var(--surface)] text-xs font-bold truncate"
                    >
                      {workspaces.map((ws) => (
                        <option key={ws.id} value={ws.id}>
                          {ws.org || 'پایگاه داده'}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => setDark((d) => !d)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/40 text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  >
                    {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    <span>تغییر پوسته</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[#f87171]/40 text-[#dc2626] dark:text-[#f87171] text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>خروج</span>
                  </button>
                </div>
              </div>

              {dataLoading && people.length === 0 ? (
                <div className="rounded-2xl border border-[var(--ink-faint)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-muted)]">
                  در حال بارگذاری داده‌ها…
                </div>
              ) : (
                <>
                  {view === 'home' && currentUser.hasResultAccess && (
                    <DashboardView
                      people={people}
                      results={results}
                      computerLabel={computerLabel}
                      useServer={useServer}
                      onNavigate={navigate}
                      onOpenCategory={(catId) => {
                        setCategoryFilter(catId);
                        navigate('people');
                      }}
                      onOpenPersonResults={(pid) => {
                        setSelectedPersonId(pid);
                        navigate('results');
                      }}
                    />
                  )}

                  {view === 'people' && currentUser.hasResultAccess && (
                    <PeopleView
                      useServer={useServer}
                      serverCtx={serverCtx}
                      currentUserId={currentUser.id}
                      workspace={activeWorkspace}
                      people={people}
                      results={results}
                      categoryFilter={categoryFilter}
                      onChangeCategoryFilter={setCategoryFilter}
                      onStartTestFor={(pid) => {
                        setSelectedPersonId(pid);
                        navigate('run');
                      }}
                      onViewResultsFor={(pid) => {
                        setSelectedPersonId(pid);
                        navigate('results');
                      }}
                      onRefreshData={refreshServerWorkspaceData}
                      onToast={showToast}
                    />
                  )}

                  {view === 'run' && (
                    <RunTestView
                      useServer={useServer}
                      serverCtx={serverCtx}
                      currentUserId={currentUser.id}
                      canSelectAnyPerson={currentUser.hasResultAccess}
                      workspace={activeWorkspace}
                      computerLabel={computerLabel}
                      people={visiblePeople}
                      selectedPersonId={
                        currentUser.hasResultAccess ? selectedPersonId : ownPerson?.id || null
                      }
                      onSelectPerson={setSelectedPersonId}
                      onGoPeople={() => navigate('people')}
                      onRefreshData={refreshServerWorkspaceData}
                      onFinishAll={(pid) => {
                        setSelectedPersonId(pid);
                        navigate('results');
                      }}
                      onToast={showToast}
                    />
                  )}

                  {view === 'results' && (
                    <ResultsView
                      useServer={useServer}
                      serverCtx={serverCtx}
                      canDelete={currentUser.hasResultAccess}
                      workspace={activeWorkspace}
                      people={visiblePeople}
                      results={visibleResults}
                      selectedPersonId={
                        currentUser.hasResultAccess ? selectedPersonId : ownPerson?.id || null
                      }
                      onSelectPerson={setSelectedPersonId}
                      onRunNewTest={() => navigate('run')}
                      onRefreshData={refreshServerWorkspaceData}
                      onToast={showToast}
                    />
                  )}

                  {view === 'help' && <HelpView />}

                  {view === 'settings' && currentUser.hasResultAccess && (
                    <SettingsView
                      useServer={useServer}
                      serverCtx={serverCtx}
                      currentUser={currentUser}
                      workspaces={workspaces}
                      activeWorkspace={activeWorkspace}
                      onSelectWorkspace={handleSelectWorkspace}
                      computerLabel={computerLabel}
                      onChangeComputerLabel={handleComputerLabelChange}
                      people={people}
                      results={results}
                      onRefreshAll={refreshAll}
                      onToast={showToast}
                    />
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="no-print bg-[var(--surface)] border-t border-[var(--ink-faint)] px-4 sm:px-8 lg:px-12 py-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ink-muted)] shrink-0">
        <span>سامانه روان‌سنج صنعتی و جایابی شغلی</span>
        <span>
          ابزارهای علمی (RIASEC, Mini-IPIP, DASS-21, OLBI, Epworth, PVT, Stroop)
        </span>
        <span className="mono">
          {useServer ? 'SERVER-SYNC' : 'LOCAL-NODE'} · V{__APP_VERSION__}
        </span>
      </footer>

      {/* Toast */}
      {toastMsg && (
        <div className="no-print fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[var(--surface)] border border-[var(--accent)] text-[var(--ink)] px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
