import React from 'react';

export default function MailIcon({ name, size = 18 }) {
  const paths = {
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    upload: <><path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4" /></>,
    download: <><path d="M12 4v12m-4-4 4 4 4-4M4 17v4h16v-4" /></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
    building: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h1M14 7h1M9 11h1M14 11h1M10 21v-6h4v6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><circle cx="9" cy="7" r="4" /></>,
    profile: <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="12" cy="9" r="3" /><path d="M6.5 20v-1a5.5 5.5 0 0 1 11 0v1" /></>,
    template: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M3 9h18M9 9v12M13 13h4M13 17h4" /></>,
    settings: <><path d="M4 7h16M4 17h16" /><rect x="7" y="4" width="4" height="6" rx="1" /><rect x="14" y="14" width="4" height="6" rx="1" /></>,
    folder: <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 2h18" />,
    addressBook: <><rect x="5" y="3" width="16" height="18" rx="3" /><path d="M3 7h4M3 12h4M3 17h4M10 17a3 3 0 0 1 6 0" /><circle cx="13" cy="10" r="2" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    send: <><path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    reset: <><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    inbox: <><path d="M4 4h16l2 12v4H2v-4L4 4ZM2 16h6l2 3h4l2-3h6M8 8h8M9 12h6" /></>,
  };
  return <svg className="mail-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
