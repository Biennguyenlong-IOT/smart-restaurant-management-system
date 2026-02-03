
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType } from '../types';
import { CATEGORIES } from '../constants';
import { ConfirmModal } from '../App';
import { 
  ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, Calendar, PowerOff, 
  Search, Save, CreditCard, Star, Award, TrendingUp, ShoppingBag, Utensils
} from 'lucide-react';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'KPI' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'BANK' | 'CLOUD'>('DASHBOARD');
  const [tempTableCount, setTempTableCount] = useState(store.tables.length);
  const [resetTableId, setResetTableId] = useState<number | null>(null);
  
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [bankForm, setBankForm] = useState<BankConfig>(store.bankConfig || { bankId: 'ICB', accountNo: '', accountName: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const qrRequests = useMemo(() => (store.notifications || []).filter((n: AppNotification) => n.type === 'qr_request'), [store.notifications]);
  const moveRequests = useMemo(() => (store.notifications || []).filter((n: AppNotification) => n.type === 'move_request'), [store.notifications]);
  const paymentRequests = useMemo(() => (store.tables || []).filter((t: Table) => t.status === TableStatus.PAYING), [store.tables]);

  const stats = useMemo(() => {
    const history: HistoryEntry[] = store.history || [];
    const todayStr = new Date().toLocaleDateString();
    const todayOrders = history.filter(h => new Date(h.date).toLocaleDateString() === todayStr);
    const todayRevenue = todayOrders.reduce((sum, h) => sum + h.total, 0);
    const totalRevenue = history.reduce((sum, h) => sum + h.total, 0);
    const dineInCount = history.filter(h => h.orderType === OrderType.DINE_IN).length;
    const takeawayCount = history.filter(h => h.orderType === OrderType.TAKEAWAY).length;

    const itemCounts: Record<string, number> = {};
    history.forEach(h => {
      h.items.forEach(item => { if (item.status !== OrderItemStatus.CANCELLED) itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity; });
    });
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { todayRevenue, totalRevenue, count: history.length, dineInCount, takeawayCount, topItems };
  }, [store.history]);

  const staffKPI = useMemo(() => {
    const staffList = store.users.filter((u: User) => u.role === UserRole.STAFF);
    const history: HistoryEntry[] = store.history || [];
    const reviews: Review[] = store.reviews || [];

    return staffList.map((s: User) => {
      const staffOrders = history.filter(h => h.staffId === s.id);
      const totalSales = staffOrders.reduce((sum, o) => sum + o.total, 0);
      const staffReviews = reviews.filter(r => r.staffId === s.id);
      const avgRating = staffReviews.length > 0 ? staffReviews.reduce((sum, r) => sum + r.ratingService, 0) / staffReviews.length : 5;
      return { ...s, orderCount: staffOrders.length, totalSales, avgRating: Number(avgRating).toFixed(1) };
    }).sort((a, b) => b.totalSales - a.totalSales);
  }, [store.users, store.history, store.reviews]);

  const saveMenuItem = () => {
    if (!menuForm?.name || !menuForm?.price) return alert("Thiếu thông tin!");
    store.upsertMenuItem({ ...menuForm, id: menuForm.id || `m-${Date.now()}`, isAvailable: menuForm.isAvailable ?? true, image: menuForm.image || 'https://picsum.photos/seed/food/400/300', category: menuForm.category || 'Tất cả' } as MenuItem);
    setMenuForm(null);
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <div className="flex bg-white p-1 rounded-2xl mb-4 md:mb-6 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Báo cáo', icon: <LayoutDashboard size={16}/> },
          { id: 'KPI', label: 'KPI', icon: <Award size={16}/> },
          { id: 'REQUESTS', label: 'Yêu cầu', icon: <ArrowRightLeft size={16}/>, count: qrRequests.length + moveRequests.length + paymentRequests.length },
          { id: 'MONITOR', label: 'Bàn ăn', icon: <Monitor size={16}/> },
          { id: 'MENU', label: 'Món', icon: <Pizza size={16}/> },
          { id: 'USERS', label: 'Sự', icon: <Shield size={16}/> },
          { id: 'BANK', label: 'Bank', icon: <CreditCard size={16}/> },
          { id: 'CLOUD', label: 'Cài đặt', icon: <Settings size={16}/> }
        ].map((tab: any) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 md:px-5 py-3 rounded-xl text-[9px] md:text-[10px] font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.icon} <span className="hidden sm:inline">{tab.label}</span> {tab.count > 0 && <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] animate-pulse">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-4 px-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Doanh thu ngày</p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800">{stats.todayRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đơn hàng</p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800">{stats.count}</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ăn tại chỗ</p>
                    <h3 className="text-xl md:text-2xl font-black text-orange-600">{stats.dineInCount}</h3>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'REQUESTS' && (
           <div className="space-y-4 px-1">
              {moveRequests.length > 0 && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <h4 className="font-black text-xs uppercase italic mb-4 flex items-center gap-2 text-blue-500"><ArrowRightLeft size={16}/> Chuyển bàn</h4>
                   <div className="space-y-3">
                      {moveRequests.map((n:any) => (
                         <div key={n.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-white">
                            <p className="text-[10px] md:text-xs font-black uppercase">{n.message}</p>
                            <button onClick={() => store.approveTableMove(n.id)} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">Duyệt</button>
                         </div>
                      ))}
                   </div>
                </div>
              )}

              {qrRequests.length > 0 && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <h4 className="font-black text-xs uppercase italic mb-4 flex items-center gap-2 text-indigo-500"><Shield size={16}/> Mở bàn QR</h4>
                   <div className="space-y-3">
                      {qrRequests.map((n:any) => (
                         <div key={n.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-white">
                            <p className="text-[10px] md:text-xs font-black uppercase">Bàn {n.payload?.tableId} (NV: {n.payload?.staffId})</p>
                            <button onClick={() => store.approveTableQr(n.id)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase">Duyệt</button>
                         </div>
                      ))}
                   </div>
                </div>
              )}

              {paymentRequests.length > 0 && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <h4 className="font-black text-xs uppercase italic mb-4 flex items-center gap-2 text-amber-500"><CreditCard size={16}/> Thanh toán</h4>
                   <div className="space-y-3">
                      {paymentRequests.map((t:any) => (
                         <div key={t.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                            <p className="text-[10px] md:text-xs font-black uppercase">{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id}</p>
                            <button onClick={() => store.confirmPayment(t.id)} className="bg-amber-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-lg">Thu tiền</button>
                         </div>
                      ))}
                   </div>
                </div>
              )}
              {qrRequests.length === 0 && moveRequests.length === 0 && paymentRequests.length === 0 && (
                 <div className="py-20 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                    <p className="text-slate-300 font-black uppercase text-[10px] italic">Không có yêu cầu nào</p>
                 </div>
              )}
           </div>
        )}

        {activeTab === 'MONITOR' && (
          <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 px-1">
            {store.tables.map((t: Table) => (
              <div key={t.id} className={`bg-white p-5 rounded-[2rem] border shadow-sm flex flex-col justify-between min-h-[140px] ${t.id === 0 ? 'border-orange-200' : 'border-slate-100'}`}>
                <div className="text-center">
                  <h3 className="font-black text-base italic text-slate-800">{t.id === 0 ? 'Lẻ' : 'Bàn ' + t.id}</h3>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${t.status === TableStatus.AVAILABLE ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-600'}`}>{t.status}</span>
                </div>
                <button onClick={() => setResetTableId(t.id)} className="w-full py-2 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase shadow-md active:scale-95 transition-all flex items-center justify-center gap-1">
                   <PowerOff size={10} /> Reset
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={resetTableId !== null} 
        type="danger" 
        title="Reset bàn?" 
        message={`Dữ liệu bàn ${resetTableId} sẽ bị xóa sạch.`} 
        onConfirm={() => resetTableId !== null && store.adminForceClose(resetTableId)} 
        onCancel={() => setResetTableId(null)} 
      />
    </div>
  );
};

export default AdminView;
