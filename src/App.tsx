import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  createWorkspace,
  subscribePeople,
  subscribeResults,
  subscribeWorkspaces,
} from './services/firestoreService';
import type { AppUser, Person, TestResult, ViewName, Workspace } from './types/psychometrics';

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

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoaded, setWsLoaded] = useState(false);
  const [activeWsId, setActiveWsId] = useState<string>(
    () => localStorage.getItem('rsi_ws_id') || ''
  );

  const [people, setPeople] = useState<Person[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [view, setView] = useState<ViewName>(() => (currentUser?.hasResultAccess ? 'home' : 'run'));
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

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

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('rsi_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const handleLoginSuccess = (usr: AppUser) => {
    setCurrentUser(usr);
    localStorage.setItem('rsi_logged_session', JSON.stringify(usr));
    if (!usr.hasResultAccess) {
      setView('run');
    } else {
      setView('home');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('rsi_logged_session');
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

  // Subscribe to workspaces
  useEffect(() => {
    if (!currentUser) return;
    setWsLoaded(false);
    const email = currentUser.role === 'admin' ? 'admin@ravansanj.local' : 'user@ravansanj.local';
    const unsub = subscribeWorkspaces(
      email,
      (list) => {
        setWorkspaces(list);
        setWsLoaded(true);
        if (list.length === 0 && !creatingDefaultRef.current) {
          creatingDefaultRef.current = true;
          // Create default workspace using mock user object
          void createWorkspace(
            { uid: currentUser.id, email } as any,
            'مجتمع صنعتی — واحد ارزیابی',
            currentUser.name
          ).then((id) => {
            handleSelectWorkspace(id);
          });
        }
      },
      () => {
        setWsLoaded(true);
      }
    );
    return unsub;
  }, [currentUser]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWsId) || workspaces[0] || null;

  // Subscribe to people and results
  useEffect(() => {
    if (!currentUser || !activeWorkspace) {
      setPeople([]);
      setResults([]);
      return;
    }
    setDataLoading(true);
    let pDone = false;
    let rDone = false;
    const checkDone = () => {
      if (pDone && rDone) setDataLoading(false);
    };

    const email = currentUser.role === 'admin' ? 'admin@ravansanj.local' : 'user@ravansanj.local';
    const unsubPeople = subscribePeople(
      activeWorkspace.id,
      email,
      (list) => {
        setPeople(list);
        pDone = true;
        checkDone();
      },
      () => {
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
  }, [activeWorkspace?.id, currentUser]);

  if (!currentUser) {
    return <AuthGate onLoginSuccess={handleLoginSuccess} onToast={showToast} />;
  }

  if (!wsLoaded || !activeWorkspace) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-[#5a6a78] dark:text-[#9aabb8]">
        در حال آماده‌سازی پایگاه داده مشترک…
      </div>
    );
  }

  const navigate = (nextView: ViewName) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

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
        { id: 'results' as ViewName, label: 'سوابق من', Icon: FileBarChart2 },
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

            <span className="hidden sm:inline text-xs text-[#5a6a78] dark:text-[#9aabb8] whitespace-nowrap truncate max-w-[220px]">
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
              <div className="num-ltr truncate text-[11px]">
                {currentUser.role === 'admin' ? 'مدیر ارشد' : currentUser.role === 'evaluator' ? 'ارزیاب / طب کار' : 'پرسنل گرامی'}
              </div>
            </div>
          </nav>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0">
          {dataLoading && people.length === 0 ? (
            <div className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c] p-8 text-center text-sm text-[#5a6a78] dark:text-[#9aabb8]">
              در حال همگام‌سازی داده‌ها از پایگاه داده مشترک…
            </div>
          ) : (
            <>
              {view === 'home' && currentUser.hasResultAccess && (
                <DashboardView
                  people={people}
                  results={results}
                  computerLabel={computerLabel}
                  onNavigate={navigate}
                  onOpenPersonResults={(pid) => {
                    setSelectedPersonId(pid);
                    navigate('results');
                  }}
                />
              )}

              {view === 'people' && currentUser.hasResultAccess && (
                <PeopleView
                  user={{ uid: currentUser.id, email: 'admin@ravansanj.local' } as any}
                  workspace={activeWorkspace}
                  people={people}
                  results={results}
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
                  user={{ uid: currentUser.id, email: 'user@ravansanj.local' } as any}
                  workspace={activeWorkspace}
                  computerLabel={computerLabel}
                  people={people}
                  selectedPersonId={
                    selectedPersonId ||
                    (currentUser.hasResultAccess
                      ? null
                      : people.find((p) => p.code === currentUser.nationalCode || p.code === currentUser.personnelId)?.id ||
                        people[0]?.id ||
                        null)
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
                  workspace={activeWorkspace}
                  people={
                    currentUser.hasResultAccess
                      ? people
                      : people.filter(
                          (p) =>
                            p.code === currentUser.nationalCode ||
                            p.code === currentUser.personnelId ||
                            p.name === currentUser.name
                        )
                  }
                  results={results}
                  selectedPersonId={
                    selectedPersonId ||
                    (currentUser.hasResultAccess
                      ? null
                      : people.find(
                          (p) =>
                            p.code === currentUser.nationalCode ||
                            p.code === currentUser.personnelId ||
                            p.name === currentUser.name
                        )?.id || null)
                  }
                  onSelectPerson={setSelectedPersonId}
                  onRunNewTest={() => navigate('run')}
                  onToast={showToast}
                />
              )}

              {view === 'help' && <HelpView />}

              {view === 'settings' && currentUser.hasResultAccess && (
                <SettingsView
                  user={{ uid: currentUser.id, email: 'admin@ravansanj.local' } as any}
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
