const fs = require('fs');

// Patch App.tsx
let appContent = fs.readFileSync('c:/projects/QGo/src/App.tsx', 'utf8');
appContent = appContent.replace(
  `  const [currentView, setCurrentView] = useState<'home' | 'salon_detail' | 'ticket' | 'bookings'>('home');\r\n  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);\r\n  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);`,
  `  const [currentView, setCurrentView] = useState<'home' | 'salon_detail' | 'ticket' | 'bookings'>(() => (sessionStorage.getItem('qgo_cv') as any) || 'home');\r\n  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);\r\n  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(() => sessionStorage.getItem('qgo_sbid') || null);\r\n\r\n  React.useEffect(() => { sessionStorage.setItem('qgo_cv', currentView); }, [currentView]);\r\n  React.useEffect(() => { if (selectedBookingId) sessionStorage.setItem('qgo_sbid', selectedBookingId); else sessionStorage.removeItem('qgo_sbid'); }, [selectedBookingId]);`
);
// In case of unix line endings
appContent = appContent.replace(
  `  const [currentView, setCurrentView] = useState<'home' | 'salon_detail' | 'ticket' | 'bookings'>('home');\n  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);\n  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);`,
  `  const [currentView, setCurrentView] = useState<'home' | 'salon_detail' | 'ticket' | 'bookings'>(() => (sessionStorage.getItem('qgo_cv') as any) || 'home');\n  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null);\n  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(() => sessionStorage.getItem('qgo_sbid') || null);\n\n  React.useEffect(() => { sessionStorage.setItem('qgo_cv', currentView); }, [currentView]);\n  React.useEffect(() => { if (selectedBookingId) sessionStorage.setItem('qgo_sbid', selectedBookingId); else sessionStorage.removeItem('qgo_sbid'); }, [selectedBookingId]);`
);
fs.writeFileSync('c:/projects/QGo/src/App.tsx', appContent);

// Patch CustomerPage.tsx
let cpContent = fs.readFileSync('c:/projects/QGo/src/features/customer/CustomerPage.tsx', 'utf8');
cpContent = cpContent.replace(
  `  const [bookingStep, setBookingStep] = useState<'detail' | 'slot' | 'summary' | 'payment' | 'paid' | 'ticket'>('detail');`,
  `  const [bookingStep, setBookingStep] = useState<'detail' | 'slot' | 'summary' | 'payment' | 'paid' | 'ticket'>(() => (sessionStorage.getItem('qgo_bs') as any) || 'detail');\n  useEffect(() => { sessionStorage.setItem('qgo_bs', bookingStep); }, [bookingStep]);`
);
fs.writeFileSync('c:/projects/QGo/src/features/customer/CustomerPage.tsx', cpContent);

console.log('Patched UI state persistence');
