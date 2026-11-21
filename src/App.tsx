import React, { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
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
import { AuthBridgeView } from './components/AuthBridgeView';
import { AuthGate } from './components/AuthGate';
import { DashboardView } from './components/DashboardView';
import { HelpView } from './components/HelpView';
import { PeopleView } from './components/PeopleView';
import { ResultsView } from './components/ResultsView';
import { RunTestView } from './components/RunTestView';
import { SettingsView } from './components/SettingsView';
import { normalizeFa } from './data/workUnits';
import { auth, signOutUser } from './firebase';
import {
  createPerson,
  createWorkspace,
  subscribePeople,
  subscribeResults,
  subscribeWorkspaces,
} from './services/firestoreService';
import {
  localCreatePerson,
  subscribeLocalPeople,
  subscribeLocalResults,
  subscribeLocalWorkspaces,
} from './services/localStoreService';
import type {
  AppUser,
  OccupationalCategoryId,
  Person,
  TestResult,
  ViewName,
  Workspace,
} from './types/psychometrics';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const raw = localStorage.getItem('rsi_logged_session');
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return null;
  });

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoaded, setWsLoaded] = useState(false);
  const [activeWsId, setActiveWsId] = useState<string>(
    () => localStorage.getItem('rsi_ws_id') || ''
  );

  const [people, setPeople] = useState<Person[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [peopleReady, setPeopleReady] = useState(false);

  const [view, setView] = useState<ViewName>(() => (currentUser?.hasResultAccess ? 'home' : 'run'));
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
  const creatingDefaultRef = useRef(false);
  const autoCreatingEmployeeRef = useRef<string | null>(null);

  const useCloud = Boolean(firebaseUser && firebaseUser.email && firebaseUser.emailVerified);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('rsi_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleLoginSuccess = (usr: AppUser) => {
    setCurrentUser(usr);
    localStorage.setItem('rsi_logged_session', JSON.stringify(usr));
    creatingDefaultRef.current = false;
    autoCreatingEmployeeRef.current = null;
    if (!usr.hasResultAccess) {
      setView('run');
    } else {
      setView('home');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedPersonId(null);
    localStorage.removeItem('rsi_logged_session');
    if (firebaseUser) {
      void signOutUser().catch(() => {});
    }
  };

  const handleComputerLabelChange = (label: string) => {
    setComputerLabel(label);
    localStorage.setItem('rsi_computer_label', label);
  };

  const handleSelectWorkspace = (id: string) => {
    setActiveWsId(id);
    localStorage.setItem('rsi_ws_id', id);
    setSelectedPersonId(null);
  };

  // Subscribe to workspaces (Firestore when signed in with Google, Local Store otherwise)
  useEffect(() => {
    if (!currentUser || !authReady) return;
    setWsLoaded(false);

    if (useCloud && firebaseUser?.email) {
      const email = firebaseUser.email;
      const unsub = subscribeWorkspaces(
        email,
        (list) => {
          setWorkspaces(list);
          setWsLoaded(true);
          if (list.length === 0 && !creatingDefaultRef.current) {
            creatingDefaultRef.current = true;
            void createWorkspace(
              firebaseUser,
              'سازمان من — واحد ارزیابی و منابع انسانی',
              currentUser.name
            )
              .then((id) => {
                handleSelectWorkspace(id);
              })
              .catch(() => {
                creatingDefaultRef.current = false;
              });
          }
        },
        () => {
          setWsLoaded(true);
        }
      );
      return unsub;
    }

    const unsubLocal = subscribeLocalWorkspaces((list) => {
      setWorkspaces(list);
      setWsLoaded(true);
    });
    return unsubLocal;
  }, [currentUser, authReady, useCloud, firebaseUser]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWsId) || workspaces[0] || null;

  // Subscribe to people and results
  useEffect(() => {
    if (!currentUser || !activeWorkspace) {
      setPeople([]);
      setResults([]);
      setPeopleReady(false);
      return;
    }
    setDataLoading(true);
    setPeopleReady(false);
    let pDone = false;
    let rDone = false;
    const checkDone = () => {
      if (pDone && rDone) setDataLoading(false);
    };

    if (useCloud && firebaseUser?.email) {
      const email = firebaseUser.email;
      const unsubPeople = subscribePeople(
        activeWorkspace.id,
        email,
        (list) => {
          setPeople(list);
          setPeopleReady(true);
          pDone = true;
          checkDone();
        },
        () => {
          setPeopleReady(true);
          pDone = true;
          checkDone();
        }
      );

      const unsubResults = subscribeResults(
        activeWorkspace.id,
        email,
        (list) => {
          setResults(list);
          rDone = true;
          checkDone();
        },
        () => {
          rDone = true;
          checkDone();
        }
      );

      return () => {
        unsubPeople();
        unsubResults();
      };
    }

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
  }, [activeWorkspace?.id, currentUser, useCloud, firebaseUser]);

  // Auto-register logged-in employee in workspace people list if not already present
  useEffect(() => {
    if (!currentUser || currentUser.hasResultAccess || !activeWorkspace || !peopleReady) return;

    const matched = people.find(
      (p) =>
        (currentUser.personnelId && p.code === currentUser.personnelId) ||
        (currentUser.nationalCode && p.code === currentUser.nationalCode) ||
        normalizeFa(p.name) === normalizeFa(currentUser.name)
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

    if (useCloud && firebaseUser) {
      void createPerson(activeWorkspace, firebaseUser, payload).then((id) => {
        setSelectedPersonId(id);
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
    useCloud,
    firebaseUser,
  ]);

  const isAuthBridgeMode = Boolean(
    typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('authBridge')
  );

  if (isAuthBridgeMode) {
    return <AuthBridgeView />;
  }

  if (!currentUser) {
    return <AuthGate onLoginSuccess={handleLoginSuccess} onToast={showToast} />;
  }

  if (!authReady || !wsLoaded || !activeWorkspace) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg)] text-sm text-[var(--ink-muted)]">
        در حال آماده‌سازی پایگاه داده…
      </div>
    );
  }

  const navigate = (nextView: ViewName) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const ownPerson = !currentUser.hasResultAccess
    ? people.find(
        (p) =>
          (currentUser.personnelId && p.code === currentUser.personnelId) ||
          (currentUser.nationalCode && p.code === currentUser.nationalCode) ||
          normalizeFa(p.name) === normalizeFa(currentUser.name)
      ) || null
    : null;

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
        useCloud ? 'پایگاه داده ابری' : 'حالت محلی'
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
      subtitle: 'مدیریت پایگاه داده، همگام‌سازی چندرایانه‌ای و پشتیبان‌گیری اطلاعات',
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
              {computerLabel} / {useCloud ? 'ابری' : 'آفلاین'}
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
                      useCloud={useCloud}
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
                      useCloud={useCloud}
                      firebaseUser={firebaseUser}
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
                      onToast={showToast}
                    />
                  )}

                  {view === 'run' && (
                    <RunTestView
                      useCloud={useCloud}
                      firebaseUser={firebaseUser}
                      currentUserId={currentUser.id}
                      canSelectAnyPerson={currentUser.hasResultAccess}
                      workspace={activeWorkspace}
                      computerLabel={computerLabel}
                      people={currentUser.hasResultAccess ? people : ownPerson ? [ownPerson] : []}
                      selectedPersonId={
                        currentUser.hasResultAccess ? selectedPersonId : ownPerson?.id || null
                      }
                      onSelectPerson={setSelectedPersonId}
                      onGoPeople={() => navigate('people')}
                      onFinishAll={(pid) => {
                        setSelectedPersonId(pid);
                        navigate('results');
                      }}
                      onToast={showToast}
                    />
                  )}

                  {view === 'results' && (
                    <ResultsView
                      useCloud={useCloud}
                      canDelete={currentUser.hasResultAccess}
                      workspace={activeWorkspace}
                      people={currentUser.hasResultAccess ? people : ownPerson ? [ownPerson] : []}
                      results={results}
                      selectedPersonId={
                        currentUser.hasResultAccess ? selectedPersonId : ownPerson?.id || null
                      }
                      onSelectPerson={setSelectedPersonId}
                      onRunNewTest={() => navigate('run')}
                      onToast={showToast}
                    />
                  )}

                  {view === 'help' && <HelpView />}

                  {view === 'settings' && currentUser.hasResultAccess && (
                    <SettingsView
                      useCloud={useCloud}
                      firebaseUser={firebaseUser}
                      currentUserId={currentUser.id}
                      currentUserName={currentUser.name}
                      workspaces={workspaces}
                      activeWorkspace={activeWorkspace}
                      onSelectWorkspace={handleSelectWorkspace}
                      computerLabel={computerLabel}
                      onChangeComputerLabel={handleComputerLabelChange}
                      people={people}
                      results={results}
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
          {useCloud ? 'CLOUD-SYNC' : 'LOCAL-NODE'} · V{__APP_VERSION__}
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
