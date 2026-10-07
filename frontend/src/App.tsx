import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import BillsTab from './features/bills/BillsTab';
import BudgetTab from './features/budget/BudgetTab';
import TransfersTab from './features/transfers/TransfersTab';
import DashboardTab from './features/dashboard/DashboardTab';
import { AppSettingsContext, translate, type Language, type Theme } from './lib/appSettings';
import { apiClient } from './lib/api';
import type { GlobalSearchResult, UserProfile } from './types';

type Tab = 'bills' | 'budget' | 'transfers' | 'dashboard';

const tabs: { id: Tab; label: string; detail: string }[] = [
  { id: 'bills', label: 'Bills pipeline', detail: 'Clearance, exceptions & register' },
  { id: 'budget', label: 'Budget by FY', detail: 'Provisions, expenditure & balance' },
  { id: 'transfers', label: 'Fund transfers', detail: 'Recipients, utilization & districts' },
  { id: 'dashboard', label: 'Dashboard', detail: 'Your assigned work & scope' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('bills');
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('mitra-theme');
    return savedTheme === 'dark' || savedTheme === 'light'
      ? savedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('mitra-language') === 'mr' ? 'mr' : 'en');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userSessionChecked, setUserSessionChecked] = useState(false);
  const [dismissReadOnlyNotice, setDismissReadOnlyNotice] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [budgetFiscalYear, setBudgetFiscalYear] = useState('FY 2026-27');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const t = (text: string) => translate(text, language);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mitra-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language === 'mr' ? 'mr' : 'en';
    localStorage.setItem('mitra-language', language);
  }, [language]);

  useEffect(() => {
    if (!sessionStorage.getItem('mitra-user-session')) {
      setUserSessionChecked(true);
      return;
    }
    apiClient.users.session()
      .then(setCurrentUser)
      .catch(() => {
        sessionStorage.removeItem('mitra-user-session');
        setCurrentUser(null);
      })
      .finally(() => setUserSessionChecked(true));
  }, []);

  useEffect(() => {
    const query = globalQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError('');
      return;
    }
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      apiClient.search(query)
        .then(results => { setSearchResults(results); setSearchError(''); })
        .catch(error => setSearchError(error instanceof Error ? error.message : t('Search failed.')))
        .finally(() => setSearchLoading(false));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [globalQuery]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    setActiveTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  async function loginUser(username: string, password: string) {
    const result = await apiClient.users.login(username, password);
    sessionStorage.setItem('mitra-user-session', result.sessionToken);
    setCurrentUser(result.user);
  }

  function logoutUser() {
    sessionStorage.removeItem('mitra-user-session');
    setCurrentUser(null);
    setDismissReadOnlyNotice(false);
  }

  function openSearchResult(result: GlobalSearchResult) {
    setGlobalQuery(globalQuery.trim());
    setActiveTab(result.tab);
    if (result.fiscalYear) setBudgetFiscalYear(result.fiscalYear);
    setSearchOpen(false);
  }

  const BASE_URL = import.meta.env.BASE_URL;

  return (
    <AppSettingsContext.Provider value={{ language, t }}>
    <div className="wrap">
      <header>
        <div className="logo">
          {/* <img src="/MITRALogo.svg" alt="MITRA logo" className="logo" /> */}
          <img src={`${BASE_URL}favicon3.png`} alt="XHiman logo" className="logo"/>
        </div>
        <div>
          <p className="eyebrow">
            MahaSTRIDE · MITRA{' '}
            <span className="sync-pill live">
              <span className="sdot" />
              <span>{t('live')}</span>
            </span>
          </p>
          <h1>{t('Bill & Budget Tracker')}</h1>
          <p className="header-meta">
            {t('MahaSTRIDE financial operations workspace')}
            <span className="creator-credit">{t('A project by Sandesh & XHiman')}</span>
          </p>
        </div>
        <div className="appearance-controls">
          <div className="setting-group" role="group" aria-label={t('Appearance')}>
            <span>{t('Appearance')}</span>
            <div className="setting-switch">
              <button type="button" className="btn setting-btn" aria-label={t(theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')} aria-pressed={theme === 'dark'} onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>
                <span aria-hidden="true">{theme === 'dark' ? '☾' : '☼'}</span> {t(theme === 'dark' ? 'Dark' : 'Light')}
              </button>
            </div>
          </div>
          <div className="setting-group" role="group" aria-label={t('Language')}>
            <span>{t('Language')}</span>
            <div className="setting-switch">
              <button type="button" className={`btn setting-btn ${language === 'en' ? 'selected' : ''}`} aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
              <button type="button" className={`btn setting-btn ${language === 'mr' ? 'selected' : ''}`} aria-pressed={language === 'mr'} onClick={() => setLanguage('mr')}>मराठी</button>
            </div>
          </div>
        </div>
      </header>

      <div className="global-search">
        <label htmlFor="global-search-input">{t('Search all records')}</label>
        <input
          id="global-search-input"
          type="search"
          value={globalQuery}
          onChange={event => setGlobalQuery(event.target.value)}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={event => {
            if (event.key === 'Escape') setSearchOpen(false);
            if (event.key === 'Enter' && searchResults[0]) openSearchResult(searchResults[0]);
          }}
          placeholder={t('Search bills, budgets, transfers, districts, people…')}
          aria-expanded={searchOpen}
          aria-controls="global-search-results"
        />
        {searchOpen && globalQuery.trim().length >= 2 && (
          <div className="global-search-results" id="global-search-results" role="listbox">
            {searchLoading && <div className="search-message">{t('Searching…')}</div>}
            {searchError && <div className="search-message form-error" role="alert">{searchError}</div>}
            {!searchLoading && !searchError && searchResults.map((result, index) => (
              <button
                key={`${result.entity}-${result.id}`}
                className="global-search-result"
                type="button"
                role="option"
                aria-selected={index === 0}
                onClick={() => openSearchResult(result)}
              >
                <span className="search-result-type">{t(result.entity)}</span>
                <span className="search-result-copy"><strong>{result.title}</strong><small>{result.subtitle}</small></span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
            {!searchLoading && !searchError && !searchResults.length && <div className="search-message">{t('No matching records.')}</div>}
          </div>
        )}
      </div>

      <nav className="tabs" role="tablist" aria-label={t('Financial workspaces')}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={element => { tabRefs.current[index] = element; }}
            id={`tab-${tab.id}-button`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={event => handleTabKeyDown(event, index)}
          >
            <span className="tab-index" aria-hidden="true">0{index + 1}</span>
            <span className="tab-copy">
              <span className="tab-label">{t(tab.label)}</span>
              <span className="tab-detail">{t(tab.detail)}</span>
            </span>
            <span className="tab-arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </nav>

      <main className="workspace-panel">
        {tabs.map(tab => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}-button`}
            tabIndex={0}
            hidden={activeTab !== tab.id}
          >
            {tab.id === 'bills' && <BillsTab globalQuery={globalQuery} readOnly={!userSessionChecked || !currentUser} />}
            {tab.id === 'budget' && <BudgetTab globalQuery={globalQuery} initialFiscalYear={budgetFiscalYear} readOnly={!userSessionChecked || !currentUser} />}
            {tab.id === 'transfers' && <TransfersTab globalQuery={globalQuery} readOnly={!userSessionChecked || !currentUser} />}
            {tab.id === 'dashboard' && (
              <DashboardTab
                user={currentUser}
                sessionLoading={!userSessionChecked}
                onLogin={loginUser}
                onLogout={logoutUser}
              />
            )}
          </div>
        ))}
      </main>

      <footer>
        <details className="help-details">
          <summary>{t('How figures and bill statuses are calculated')}</summary>
          <p>
          {t('Bill stage is inferred from the status entry; changing the status recomputes its pipeline stage. FY 2026-27 provisions originate from the STATUS workbook EXPEND sheet (6 Aug 2026); other fiscal years are populated from imported figures. Transferred amounts and cleared bills update budget expenditure, while bills linked to a transfer update its utilization without double-counting. Clearance FY is read from the clearance date in the status text. District release fields can be filled as approvals are recorded.')}
          </p>
        </details>
        <span className="footer-credit">{t('Made by XHiman')}</span>
      </footer>
    </div>
    {userSessionChecked && !currentUser && !dismissReadOnlyNotice && (
      <aside className="read-only-notice" role="status" aria-live="polite">
        <p>{t('You are not signed in. You can browse records, but must sign in to add or edit entries.')}</p>
        <button
          type="button"
          aria-label={t('Dismiss sign-in notice')}
          onClick={() => setDismissReadOnlyNotice(true)}
        >
          ×
        </button>
      </aside>
    )}
    </AppSettingsContext.Provider>
  );
}
