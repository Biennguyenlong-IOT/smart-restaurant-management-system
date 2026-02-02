
import React, { useState, useEffect, useCallback, useRef } from 'react';
// Use namespace import to resolve missing named exports in some environments
import * as ReactRouterDOM from 'react-router-dom';
const { HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate, useSearchParams } = ReactRouterDOM;

import { UserRole, User, AppNotification } from './types.ts';
import { useRestaurantStore } from './store.ts';
import CustomerMenu from './views/CustomerMenu.tsx';
import StaffView from './views/StaffView.tsx';
import KitchenView from './views/KitchenView.tsx';
import AdminView from './views/AdminView.tsx';
import { Database, Link as LinkIcon, Volume2, VolumeX } from 'lucide-react';

export const ConfirmModal: React.FC<{
  isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void;
  confirmText?: string; cancelText?: string; type?: 'danger' | 'info' | 'success';
}> = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Xác nhận', cancelText = 'Hủy', type = 'info' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-scaleIn border border-slate-100 text-center">
        <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm mb-8">{message}</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="py-4 rounded-2xl font-bold text-slate-400 bg-slate-50 text-sm">{cancelText}</button>
          <button onClick={() => { onConfirm(); onCancel(); }} className={`py-4 rounded-2xl font-bold text-white shadow-lg text-sm ${
              type === 'danger' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-slate-900'
            }`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

const SetupOverlay: React.FC<{ onSave: (url: string) => void }> = ({ onSave }) => {
  const [url, setUrl] = useState('');
  return (
    <div className="fixed inset-0 z-[300] bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl text-center animate-scaleIn">
        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8">
          <Database size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-4 uppercase italic">Thiết lập hệ thống</h2>
        <p className="text-slate-400 text-xs font-bold mb-8 uppercase leading-relaxed px-4">
          Nhập đường dẫn Firebase Realtime Database của bạn để bắt đầu.
        </p>
        <div className="space-y-4">
          <div className="relative">
            <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="https://...firebaseio.com" 
              value={url} 
              onChange={e => setUrl(e.target.value)}
              className="w-full pl-12 pr-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm transition-all" 
            />
          </div>
          <button 
            onClick={() => url.startsWith('http') ? onSave(url) : alert('URL không hợp lệ!')}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all"
          >
            Lưu và Kết nối
          </button>
        </div>
      </div>
    </div>
  );
};

const LoginOverlay: React.FC<{ 
  role: UserRole; 
  users: User[];
  onSuccess: (user: User) => void; 
  onCancel: () => void 
}> = ({ role, users, onSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!users || users.length === 0) {
      setError('Đang tải dữ liệu...');
      return;
    }
    const foundUser = users.find(u => u.username === username && u.password === password);
    if (foundUser) {
      // Đảm bảo đúng role HOẶC là Admin
      if (foundUser.role === UserRole.ADMIN || foundUser.role === role || (role === UserRole.STAFF && foundUser.role === UserRole.STAFF) || (role === UserRole.KITCHEN && foundUser.role === UserRole.KITCHEN)) {
        onSuccess(foundUser);
      } else {
        setError(`Bạn không có quyền truy cập vai trò ${role}`);
      }
    } else {
      setError('Sai tên đăng nhập hoặc mật khẩu');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 animate-scaleIn">
        <h2 className="text-2xl font-black text-slate-800 text-center mb-8 uppercase italic italic">Đăng nhập {role}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 bg-slate-50 rounded-2xl outline-none font-bold" />
          {error && <p className="text-red-500 text-[10px] font-bold text-center uppercase italic">{error}</p>}
          <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Vào hệ thống</button>
          <button type="button" onClick={onCancel} className="w-full py-2 text-slate-400 font-bold text-xs uppercase italic">Hủy bỏ</button>
        </form>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const store = useRestaurantStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const hasConfigInUrl = searchParams.get('config');
  
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = sessionStorage.getItem('current_user');
    try { return saved ? JSON.parse(saved) : null; } catch { return null; }
  });

  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const lastNotifIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser || !isAudioEnabled) return;

    const relevantNotifs = store.notifications.filter(n => 
      !n.read && (n.targetRole === currentUser.role || currentUser.role === UserRole.ADMIN)
    );

    if (relevantNotifs.length > 0) {
      const latest = relevantNotifs[0];
      if (latest.id !== lastNotifIdRef.current) {
        lastNotifIdRef.current = latest.id;
        
        const speech = new SpeechSynthesisUtterance(latest.message);
        speech.lang = 'vi-VN';
        speech.rate = 1.1;
        window.speechSynthesis.speak(speech);

        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      }
    }
  }, [store.notifications, currentUser, isAudioEnabled]);

  const handleLoginSuccess = (user: User) => {
    sessionStorage.setItem('current_user', JSON.stringify(user));
    setCurrentUser(user);
    setIsAudioEnabled(true);
  };

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('current_user');
    setCurrentUser(null);
    navigate('/', { replace: true });
  }, [navigate]);

  const renderProtectedRoute = (role: UserRole, element: React.ReactNode) => {
    if (!currentUser) {
      return <LoginOverlay role={role} users={store.users} onSuccess={handleLoginSuccess} onCancel={() => navigate('/')} />;
    }
    if (currentUser.role !== role && currentUser.role !== UserRole.ADMIN) {
      return <Navigate to="/" replace />;
    }
    return <>{element}</>;
  };

  const shouldShowSetup = store.syncStatus === 'NEED_CONFIG' && !hasConfigInUrl;

  return (
    <div className="min-h-screen h-[100dvh] flex flex-col bg-slate-50 overflow-hidden">
        {shouldShowSetup && <SetupOverlay onSave={store.updateCloudUrl} />}
        
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 z-40">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black text-xl italic shadow-lg">S</div>
            <h1 className="font-black text-slate-800 text-lg uppercase tracking-tight">Smart Resto</h1>
          </Link>

          <div className="flex items-center gap-4">
            {currentUser && currentUser.role !== UserRole.CUSTOMER && (
              <button 
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                className={`p-2 rounded-xl transition-all ${isAudioEnabled ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}
              >
                {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
            )}
            <div title={store.syncStatus} className={`w-2 h-2 rounded-full ${store.syncStatus === 'SUCCESS' ? 'bg-green-500' : 'bg-red-400 animate-pulse'}`}></div>
            {currentUser && (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-400 uppercase hidden md:inline">{currentUser.fullName} ({currentUser.role})</span>
                <button onClick={handleLogout} className="text-[10px] font-black text-red-500 px-4 py-2 bg-red-50 rounded-xl uppercase hover:bg-red-100 transition-colors">Thoát</button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full no-scrollbar">
           <div className="max-w-7xl mx-auto h-full px-4 py-4 md:px-6 md:py-6">
            <Routes>
                <Route path="/" element={<CustomerMenu store={store} currentRole={UserRole.CUSTOMER} />} />
                <Route path="/table/:tableId" element={<CustomerMenu store={store} currentRole={UserRole.CUSTOMER} />} />
                <Route path="/table/:tableId/:token" element={<CustomerMenu store={store} currentRole={UserRole.CUSTOMER} />} />
                <Route path="/staff" element={renderProtectedRoute(UserRole.STAFF, <StaffView store={store} />)} />
                <Route path="/kitchen" element={renderProtectedRoute(UserRole.KITCHEN, <KitchenView store={store} />)} />
                <Route path="/admin" element={renderProtectedRoute(UserRole.ADMIN, <AdminView store={store} />)} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
           </div>
        </main>

        {currentUser && !isAudioEnabled && currentUser.role !== UserRole.CUSTOMER && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slideUp">
             <VolumeX className="text-orange-500" />
             <p className="text-xs font-bold uppercase tracking-tight">Bật loa để nhận thông báo</p>
             <button onClick={() => setIsAudioEnabled(true)} className="bg-orange-500 px-4 py-2 rounded-xl text-[10px] font-black uppercase">Bật ngay</button>
          </div>
        )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};
export default App;
