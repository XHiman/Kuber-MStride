import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import BillsTab from './features/bills/BillsTab';
import BudgetTab from './features/budget/BudgetTab';
import TransfersTab from './features/transfers/TransfersTab';
import { AppSettingsContext, translate, type Language, type Theme } from './lib/appSettings';

type Tab = 'bills' | 'budget' | 'transfers';

const tabs: { id: Tab; label: string; detail: string }[] = [
  { id: 'bills', label: 'Bills pipeline', detail: 'Clearance, exceptions & register' },
  { id: 'budget', label: 'Budget by FY', detail: 'Provisions, expenditure & balance' },
  { id: 'transfers', label: 'Fund transfers', detail: 'Recipients, utilization & districts' },
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

  return (
    <AppSettingsContext.Provider value={{ language, t }}>
    <div className="wrap">
      <header>
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
            <span className="creator-credit">{t('A project by SaJo & XHiman')}</span>
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
            {tab.id === 'bills' && <BillsTab />}
            {tab.id === 'budget' && <BudgetTab />}
            {tab.id === 'transfers' && <TransfersTab />}
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
    </AppSettingsContext.Provider>
  );
}
