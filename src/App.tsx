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
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
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

  if (!currentUser) {
    return <AuthGate onLoginSuccess={handleLoginSuccess} onToast={showToast} />;
  }

  if (!authReady || !wsLoaded || !activeWorkspace) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-[#5a6a78] dark:text-[#9aabb8]">
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

  return (
    <div className="min-h-screen flex flex-col bg-[#edf0f2] dark:bg-[#12181e]">
      {/* Top Bar */}
      <header className="no-print sticky top-0 z-30 bg-white dark:bg-[#1b242c] border-b border-[#d5dce1] dark:border-[#33414d]">
        <div className="max-w-[1380px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-8 h-8 rounded-lg bg-[#0e6a88] text-white grid place-items-center font-extrabold text-base">
              ر
            </span>
            <span className="font-extrabold text-base whitespace-nowrap">روان‌سنج صنعتی</span>
          </div>

          <div className="flex items-center gap-2.5 min-w-0">
            {currentUser.hasResultAccess && workspaces.length > 1 && (
              <select
                aria-label="پایگاه داده فعال"
                value={activeWorkspace.id}
                onChange={(e) => handleSelectWorkspace(e.target.value)}
                className="max-w-[180px] px-2.5 py-1 rounded-md border border-[#d5dce1] dark:border-[#33414d] bg-[#f4f6f7] dark:bg-[#222d36] text-xs font-medium truncate"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.org || 'پایگاه داده'}
                  </option>
                ))}
              </select>
            )}

            <span className="hidden sm:inline text-xs text-[#5a6a78] dark:text-[#9aabb8] whitespace-nowrap truncate max-w-[260px]">
              {currentUser.name} ({currentUser.role === 'admin' ? 'مدیر سیستم' : currentUser.role === 'evaluator' ? 'ارزیاب' : 'پرسنل'}) · {computerLabel}
            </span>

            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              title="تغییر پوسته"
              className="p-2 rounded-lg border border-[#d5dce1] dark:border-[#33414d] hover:border-[#0e6a88] cursor-pointer shrink-0"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="خروج"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#d5dce1] dark:border-[#33414d] hover:border-[#b83232] text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <nav className="no-print lg:hidden border-t border-[#d5dce1] dark:border-[#33414d] px-2 py-1.5 flex gap-1 overflow-x-auto">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => navigate(id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                view === id
                  ? 'bg-[#0e6a88] text-white font-bold'
                  : 'text-[#5a6a78] dark:text-[#9aabb8]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 max-w-[1380px] w-full mx-auto px-4 py-5 flex gap-6">
        {/* Desktop Sidebar */}
        <aside className="no-print hidden lg:flex flex-col w-60 shrink-0">
          <nav className="sticky top-20 space-y-1">
            {navItems.map(({ id, label, Icon }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm text-right cursor-pointer transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#0e6a88] text-white font-bold'
                      : 'text-[#1b2733] dark:text-[#e6ecf0] hover:bg-white dark:hover:bg-[#1b242c]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}

            <div className="pt-4 mt-4 border-t border-[#d5dce1] dark:border-[#33414d] px-2 text-xs text-[#5a6a78] dark:text-[#9aabb8] space-y-1">
              <div className="truncate font-medium text-[#1b2733] dark:text-[#e6ecf0]">
                {currentUser.name}
              </div>
              <div className="truncate text-[11px]">
                {currentUser.role === 'admin'
                  ? 'مدیر ارشد'
                  : currentUser.role === 'evaluator'
                  ? 'ارزیاب / طب کار'
                  : `واحد: ${currentUser.dept || 'عمومی'}`}
              </div>
              <div className="text-[11px] text-[#0e6a88] dark:text-[#4fb4d4]">
                {useCloud ? 'اتصال ابری فعال' : 'ذخیره‌سازی محلی / آفلاین'}
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0">
          {dataLoading && people.length === 0 ? (
            <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-8 text-center text-sm text-[#5a6a78] dark:text-[#9aabb8]">
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
        </main>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="no-print fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#1b2733] text-white dark:bg-[#e6ecf0] dark:text-[#12181e] px-5 py-2.5 rounded-full font-bold text-sm shadow-lg whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
