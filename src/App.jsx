// src/App.jsx: hash-route shell
import React from 'react';
import SearchPage from './view/features/search/pages/SearchPage.jsx';
import AgreementsPage from './view/features/agreements/pages/AgreementsPage.jsx';
import AgreementBoardPage from './view/features/agreements/pages/AgreementBoardPage.jsx';
import RegionSearchPage from './view/features/agreements/pages/RegionSearchPage.jsx';
import SettingsPage from './view/features/settings/pages/SettingsPage.jsx';
import RecordsPage from './view/features/records/pages/RecordsPage.jsx';
import RecordsEditorPage from './view/features/records/pages/RecordsEditorPage.jsx';
import MailAutomationPage from './view/features/mail/pages/MailAutomationPage.jsx';
import AutoAgreementPage from './view/features/auto/pages/AutoAgreementPage.jsx';
import KakaoSendPage from './view/features/kakao/pages/KakaoSendPage.jsx';
import LHUnder50Page from './view/features/agreements/pages/LHUnder50Page.jsx';
import LH50To100Page from './view/features/agreements/pages/LH50To100Page.jsx';
import PPSUnder50Page from './view/features/agreements/pages/PPSUnder50Page.jsx';
import PPS50To100Page from './view/features/agreements/pages/PPS50To100Page.jsx';
import MOISUnder30Page from './view/features/agreements/pages/MOISUnder30Page.jsx';
import MOIS30To50Page from './view/features/agreements/pages/MOIS30To50Page.jsx';
import MOIS50To100Page from './view/features/agreements/pages/MOIS50To100Page.jsx';
import { AgreementBoardProvider } from './view/features/agreements/context/AgreementBoardContext.jsx';
import ExcelHelperPage from './view/features/excel-helper/pages/ExcelHelperPage.jsx';
import BidResultPage from './view/features/bid-helper/pages/BidResultPage.jsx';
import RegionSearchWindowHost from './view/features/agreements/components/RegionSearchWindowHost.jsx';
import FeedbackProvider from './components/FeedbackProvider.jsx';
import CompanyNotesPage from './view/features/notes/pages/CompanyNotesPage.jsx';
import TempCompaniesPage from './view/features/temp-companies/pages/TempCompaniesPage.jsx';
import LoginPage from './view/features/auth/pages/LoginPage.jsx';
import ExcelWebEditPage from './view/features/excel-web/pages/ExcelWebEditPage.jsx';
import authClient from './shared/authClient.js';

export default function App() {
  const [route, setRoute] = React.useState(window.location.hash || '#/search');
  const [authState, setAuthState] = React.useState({
    checking: true,
    authenticated: false,
    user: null,
  });

  React.useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash || '#/search');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  React.useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const payload = await authClient.getSession();
        if (canceled) return;
        setAuthState({
          checking: false,
          authenticated: Boolean(payload?.authenticated),
          user: payload?.user || null,
        });
      } catch (error) {
        if (canceled) return;
        setAuthState({
          checking: false,
          authenticated: false,
          user: null,
        });
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  const normalizedRoute = route.replace('#', '') || '/search';
  const [path] = normalizedRoute.split('?');

  React.useEffect(() => {
    if (authState.checking) return;
    if (!authState.authenticated && path !== '/login') {
      if (window.location.hash !== '#/login') window.location.hash = '#/login';
      return;
    }
    if (authState.authenticated && path === '/login') {
      window.location.hash = '#/search';
    }
  }, [authState.checking, authState.authenticated, path]);

  const handleLogout = React.useCallback(async () => {
    try {
      await authClient.logout();
    } catch (error) {
      // Ignore logout API errors and force local logout.
    }
    setAuthState({
      checking: false,
      authenticated: false,
      user: null,
    });
    window.location.hash = '#/login';
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.__companySearchAuth = {
      user: authState.user || null,
      logout: handleLogout,
    };
    window.dispatchEvent(new CustomEvent('company-search-auth-changed'));
    return undefined;
  }, [authState.user, handleLogout]);

  React.useEffect(() => {
    if (path !== '/excel-helper') {
      document.title = '협정보조';
    }
  }, [path]);

  let Screen = SearchPage;
  switch (path) {
    case '/lh/under50':
      Screen = LHUnder50Page;
      break;
    case '/lh/50to100':
      Screen = LH50To100Page;
      break;
    case '/pps/under50':
      Screen = PPSUnder50Page;
      break;
    case '/pps/50to100':
      Screen = PPS50To100Page;
      break;
    case '/mois/under30':
      Screen = MOISUnder30Page;
      break;
    case '/mois/30to50':
      Screen = MOIS30To50Page;
      break;
    case '/mois/50to100':
      Screen = MOIS50To100Page;
      break;
    case '/agreement-board':
      Screen = AgreementBoardPage;
      break;
    case '/region-search':
      Screen = RegionSearchPage;
      break;
    case '/agreements':
      Screen = AgreementsPage;
      break;
    case '/settings':
      Screen = SettingsPage;
      break;
    case '/records':
      Screen = RecordsPage;
      break;
    case '/records-editor':
      Screen = RecordsEditorPage;
      break;
    case '/mail':
      Screen = MailAutomationPage;
      break;
    case '/excel-helper':
      Screen = ExcelHelperPage;
      break;
    case '/bid-result':
      Screen = BidResultPage;
      break;
    case '/auto-agreement':
      Screen = AutoAgreementPage;
      break;
    case '/company-notes':
      Screen = CompanyNotesPage;
      break;
    case '/kakao-send':
      Screen = KakaoSendPage;
      break;
    case '/temp-companies':
      Screen = TempCompaniesPage;
      break;
    case '/excel-web-edit':
      Screen = ExcelWebEditPage;
      break;
    case '/login':
      Screen = LoginPage;
      break;
    case '/search':
    default:
      Screen = SearchPage;
      break;
  }

  if (authState.checking) {
    return (
      <main className="login-page">
        <section className="login-card">
          <h1>세션 확인 중...</h1>
        </section>
      </main>
    );
  }

  if (!authState.authenticated) {
    return (
      <LoginPage
        onLoginSuccess={(payload) => {
          setAuthState({
            checking: false,
            authenticated: true,
            user: payload?.user || null,
          });
          if (window.location.hash === '#/login' || !window.location.hash) {
            window.location.hash = '#/search';
          }
        }}
      />
    );
  }

  return (
    <FeedbackProvider>
      <AgreementBoardProvider>
        <Screen />
        <RegionSearchWindowHost />
      </AgreementBoardProvider>
    </FeedbackProvider>
  );
}
