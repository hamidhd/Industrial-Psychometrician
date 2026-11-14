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
import { auth, signOutUser } from './firebase';
import {
  createWorkspace,
  subscribePeople,
  subscribeResults,
  subscribeWorkspaces,
} from './services/firestoreService';
import type { Person, TestResult, ViewName, Workspace } from './types/psychometrics';

const NAV_ITEMS: Array<{ id: ViewName; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'داشبورد', Icon: LayoutDashboard },
  { id: 'people', label: 'پرسنل و داوطلبان', Icon: Users },
  { id: 'run', label: 'اجرای آزمون', Icon: ClipboardCheck },
  { id: 'results', label: 'نتایج و گزارش', Icon: FileBarChart2 },
  { id: 'help', label: 'راهنما و تفسیر', Icon: BookOpen },
  { id: 'settings', label: 'تنظیمات و اشتراک‌گذاری', Icon: Settings },
];

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [wsLoaded, setWsLoaded] = useState(false);
  const [activeWsId, setActiveWsId] = useState<string>(
    () => localStorage.getItem('rsi_ws_id') || ''
  );

  const [people, setPeople] = useState<Person[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [view, setView] = useState<ViewName>('home');
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

  const handleComputerLabelChange = (label: string) => {
    setComputerLabel(label);
    localStorage.setItem('rsi_computer_label', label);
  };

  const handleSelectWorkspace = (id: string) => {
    setActiveWsId(id);
    localStorage.setItem('rsi_ws_id', id);
    setSelectedPersonId(null);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setWorkspaces([]);
        setWsLoaded(false);
        setPeople([]);
        setResults([]);
        creatingDefaultRef.current = false;
      }
    });
    return unsub;
  }, []);

  // Subscribe to workspaces accessible by this user
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !user.email) return;
    setWsLoaded(false);
    const unsub = subscribeWorkspaces(
      user.email,
      (list) => {
        setWorkspaces(list);
        setWsLoaded(true);
        if (list.length === 0 && !creatingDefaultRef.current) {
          creatingDefaultRef.current = true;
          void createWorkspace(user, 'سازمان / کارخانه من', user.displayName || '').then((id) => {
            handleSelectWorkspace(id);
          });
        }
      },
      () => {
        setWsLoaded(true);
        showToast('خطا در دریافت پایگاه‌های داده');
      }
    );
    return unsub;
  }, [authReady, user, showToast]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWsId) || workspaces[0] || null;

  // Subscribe to people and results of active workspace
  useEffect(() => {
    if (!user?.email || !user.emailVerified || !activeWorkspace) {
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

    const unsubPeople = subscribePeople(
      activeWorkspace.id,
      user.email,
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
      user.email,
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
  }, [activeWorkspace?.id, user?.email, user?.emailVerified]);

  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-[#5a6a78] dark:text-[#9aabb8]">
        در حال بارگذاری…
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  if (!user.emailVerified) {
    return <AuthGate unverifiedEmail={user.email} onSignOut={() => void signOutUser()} />;
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
            {workspaces.length > 1 && (
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

            <span className="hidden sm:inline text-xs text-[#5a6a78] dark:text-[#9aabb8] whitespace-nowrap truncate max-w-[200px]">
              {activeWorkspace.org || 'پایگاه داده مشترک'} · {computerLabel}
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
              onClick={() => void signOutUser()}
              title={`خروج (${user.email || ''})`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#d5dce1] dark:border-[#33414d] hover:border-[#b83232] text-xs font-medium cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <nav className="no-print lg:hidden border-t border-[#d5dce1] dark:border-[#33414d] px-2 py-1.5 flex gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ id, label }) => (
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
            {NAV_ITEMS.map(({ id, label, Icon }) => {
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
                {user.displayName || 'کارشناس ارزیابی'}
              </div>
              <div className="num-ltr truncate text-[11px]">{user.email}</div>
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
              {view === 'home' && (
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

              {view === 'people' && (
                <PeopleView
                  user={user}
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
                  user={user}
                  workspace={activeWorkspace}
                  computerLabel={computerLabel}
                  people={people}
                  selectedPersonId={selectedPersonId}
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
                  people={people}
                  results={results}
                  selectedPersonId={selectedPersonId}
                  onSelectPerson={setSelectedPersonId}
                  onRunNewTest={() => navigate('run')}
                  onToast={showToast}
                />
              )}

              {view === 'help' && <HelpView />}

              {view === 'settings' && (
                <SettingsView
                  user={user}
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
