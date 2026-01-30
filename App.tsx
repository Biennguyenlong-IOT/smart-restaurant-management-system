
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole, AppNotification, User, TableStatus } from './types';
import { useRestaurantStore } from './store';
import CustomerMenu from './views/CustomerMenu';
import StaffView from './views/StaffView';
import KitchenView from './views/KitchenView';
import AdminView from './views/AdminView';

export const ConfirmModal: React.FC<{
  isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void;
  confirmText?: string; cancelText?: string; type?: 'danger' | 'info' | 'success';
}> = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Xác nhận', cancelText = 'Hủy', type = 'info' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-scaleIn border border-slate-100 text-center">
        <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">{message}</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="py-4 rounded-2xl font-bold text-slate-400 bg-slate-50 hover:bg-slate-100 transition-all text-sm">{cancelText}</button>
          <button onClick={() => { onConfirm(); onCancel(); }} className={`py-4 rounded-2xl font-bold text-white shadow-lg transition-all text-sm ${
              type === 'danger' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-slate-900'
            }`}>{confirmText}</button>
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
    const userList = users && users.length > 0 ? users : [{ id: 'u-admin', username: 'admin', password: '123', role: UserRole.ADMIN, fullName: 'Quản lý Tổng' }];
    const user = userList.find(u => u.username === username && u.password === password);
    
    if (user) {
      if (user.role === UserRole.ADMIN || user.role === role) {
        onSuccess(user);
      } else {
        setError('Tài khoản không thuộc bộ phận này');
      }
    } else {
      setError('Sai tên đăng nhập hoặc mật khẩu');
    }
  };

  const roleInfo = {
    [UserRole.STAFF]: { name: 'BỘ PHẬN PHỤC VỤ', icon: '🧑‍🍳' },
    [UserRole.KITCHEN]: { name: 'BỘ PHẬN NHÀ BẾP', icon: '🍳' },
    [UserRole.ADMIN]: { name: 'QUẢN TRỊ VIÊN', icon: '⚙️' },
  }[role as UserRole.STAFF | UserRole.KITCHEN | UserRole.ADMIN];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl animate-scaleIn border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-slate-50 text-4xl rounded-3xl flex items-center justify-center mx-auto mb-4">{roleInfo.icon}</div>
          <h2 className="text-2xl font-black text-slate-800">Đăng nhập</h2>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">{roleInfo.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Tên đăng nhập"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 outline-none font-bold text-sm"
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-slate-900 outline-none font-bold text-sm"
          />
          {error && <p className="text-red-500 text-[10px] font-bold text-center animate-shake uppercase">{error}</p>}
          <button type="submit" className="w-full py-5 rounded-2xl font-black text-white bg-slate-900 hover:bg-black shadow-xl transition-all text-sm uppercase tracking-wider">Vào hệ thống</button>
          <button type="button" onClick={onCancel} className="w-full py-3 text-slate-400 font-bold text-xs uppercase">Quay lại</button>
        </form>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ role: UserRole, users: User[], heartbeat: (id: string) => void, children: React.ReactNode }> = ({ role, users, heartbeat, children }) => {
    const [user, setUser] = useState<User | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            heartbeat(user.id);
            const interval = setInterval(() => heartbeat(user.id), 15000);
            return () => clearInterval(interval);
        }
    }, [user, heartbeat]);

    if (!user) {
        return <LoginOverlay role={role} users={users} onSuccess={setUser} onCancel={() => navigate('/')} />;
    }
    return <>{children}</>;
};

const NotificationToast: React.FC<{ notif: AppNotification; onClose: () => void }> = ({ notif, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const icons = { order: '📝', kitchen: '✅', payment: '💰', system: '⚡' };
  return (
    <div className="fixed top-24 right-4 z-[110] w-80 bg-slate-900 text-white rounded-[1.5rem] shadow-2xl p-5 flex gap-4 animate-slideDown border border-white/10">
      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl shrink-0">{icons[notif.type] || '🔔'}</div>
      <div className="flex-1 min-w-0">
        <h4 className="font-black text-sm truncate uppercase">{notif.title}</h4>
        <p className="text-white/60 text-[11px] line-clamp-2 mt-1">{notif.message}</p>
      </div>
      <button onClick={onClose} className="text-white/20 hover:text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
    </div>
  );
};

const AppContent: React.FC = () => {
  const store = useRestaurantStore();
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const seenNotifIds = useRef<Set<string>>(new Set());
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const lockedTableId = localStorage.getItem('locked_table_id');
    const path = location.pathname;
    const isStaffRoute = path.startsWith('/staff') || path.startsWith('/kitchen') || path.startsWith('/admin');

    if (lockedTableId && !isStaffRoute) {
      const table = store.tables.find(t => t.id === parseInt(lockedTableId));
      if (table && table.status === TableStatus.AVAILABLE) {
        localStorage.removeItem('locked_table_id');
      } 
      else if (path === '/' && table && table.status !== TableStatus.AVAILABLE) {
        navigate(`/table/${lockedTableId}`, { replace: true });
      }
    }
  }, [location.pathname, store.tables, navigate]);

  useEffect(() => {
    if (store.notifications && store.notifications.length > 0) {
      const path = location.pathname;
      let currentRole: UserRole | null = null;
      if (path.includes('/staff')) currentRole = UserRole.STAFF;
      if (path.includes('/kitchen')) currentRole = UserRole.KITCHEN;
      if (path.includes('/admin')) currentRole = UserRole.ADMIN;

      if (!currentRole) return;

      const unseenNotif = store.notifications.find(n => 
        !seenNotifIds.current.has(n.id) && 
        (n.targetRole === currentRole || n.targetRole === UserRole.ADMIN) &&
        (Date.now() - n.timestamp < 10000)
      );

      if (unseenNotif) {
        seenNotifIds.current.add(unseenNotif.id);
        setActiveToast(unseenNotif);
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch(e) {}
      }
    }
  }, [store.notifications, location.pathname]);

  const isAtTable = location.pathname.startsWith('/table/');

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-50 overflow-hidden">
        {activeToast && <NotificationToast notif={activeToast} onClose={() => setActiveToast(null)} />}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {isAtTable ? (
               <div className="flex items-center gap-3 cursor-default">
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black text-xl italic shadow-lg">S</div>
                  <h1 className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tight">Smart Resto</h1>
               </div>
            ) : (
              <Link to="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black text-xl italic shadow-lg">S</div>
                <h1 className="font-black text-slate-800 text-lg leading-tight uppercase tracking-tight">Smart Resto</h1>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end mr-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${store.syncStatus === 'SUCCESS' ? 'bg-green-500' : 'bg-red-400 animate-pulse'}`}></div>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                  {store.syncStatus === 'SUCCESS' ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
            
            <Routes>
              <Route path="/staff" element={<Link to="/" className="text-[10px] font-black text-red-500 px-4 py-2 bg-red-50 rounded-xl uppercase tracking-widest">Thoát</Link>} />
              <Route path="/kitchen" element={<Link to="/" className="text-[10px] font-black text-red-500 px-4 py-2 bg-red-50 rounded-xl uppercase tracking-widest">Thoát</Link>} />
              <Route path="/admin" element={<Link to="/" className="text-[10px] font-black text-red-500 px-4 py-2 bg-red-50 rounded-xl uppercase tracking-widest">Thoát</Link>} />
            </Routes>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto w-full p-4 md:p-6 no-scrollbar">
           <div className="max-w-7xl mx-auto h-full">
            <Routes>
                <Route path="/" element={<CustomerMenu store={store} currentRole={UserRole.CUSTOMER} />} />
                <Route path="/table/:tableId" element={<CustomerMenu store={store} currentRole={UserRole.CUSTOMER} />} />
                <Route path="/table/:tableId/:token" element={<CustomerMenu store={store} currentRole={UserRole.CUSTOMER} />} />
                <Route path="/staff" element={<ProtectedRoute role={UserRole.STAFF} users={store.users} heartbeat={store.userHeartbeat}><StaffView store={store} /></ProtectedRoute>} />
                <Route path="/kitchen" element={<ProtectedRoute role={UserRole.KITCHEN} users={store.users} heartbeat={store.userHeartbeat}><KitchenView store={store} /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute role={UserRole.ADMIN} users={store.users} heartbeat={store.userHeartbeat}><AdminView store={store} /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
           </div>
        </main>
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
