
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType } from '../types';
import { CATEGORIES } from '../constants';
import { 
  ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, Calendar, PowerOff, 
  Search, Save, CreditCard, Star, Award, TrendingUp, ShoppingBag, Utensils
} from 'lucide-react';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'KPI' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'BANK' | 'CLOUD'>('DASHBOARD');
  const [tempTableCount, setTempTableCount] = useState(store.tables.length);
  
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

  const saveUser = () => {
    if (!userForm?.username || !userForm?.password) return alert("Thiếu thông tin!");
    store.upsertUser({ ...userForm, id: userForm.id || `u-${Date.now()}`, role: userForm.role || UserRole.STAFF } as User);
    setUserForm(null);
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <div className="flex bg-white p-1.5 rounded-2xl mb-6 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Báo cáo', icon: <LayoutDashboard size={18}/> },
          { id: 'KPI', label: 'KPI', icon: <Award size={18}/> },
          { id: 'REQUESTS', label: 'Duyệt y/c', icon: <ArrowRightLeft size={18}/>, count: qrRequests.length + moveRequests.length + paymentRequests.length },
          { id: 'MONITOR', label: 'Bàn ăn', icon: <Monitor size={18}/> },
          { id: 'MENU', label: 'Thực đơn', icon: <Pizza size={18}/> },
          { id: 'USERS', label: 'Nhân sự', icon: <Shield size={18}/> },
          { id: 'BANK', label: 'VietQR', icon: <CreditCard size={18}/> },
          { id: 'CLOUD', label: 'Cài đặt', icon: <Settings size={18}/> }
        ].map((tab: any) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-5 py-3 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.icon} <span>{tab.label}</span> {tab.count > 0 && <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] animate-pulse">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 px-1">
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Doanh thu hôm nay</p>
                    <h3 className="text-2xl font-black text-slate-800">{stats.todayRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng đơn hàng</p>
                    <h3 className="text-2xl font-black text-slate-800">{stats.count}</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phục vụ tại chỗ</p>
                    <h3 className="text-2xl font-black text-orange-600">{stats.dineInCount}</h3>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'REQUESTS' && (
           <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2 text-blue-500"><ArrowRightLeft size={18}/> Yêu cầu Chuyển bàn ({moveRequests.length})</h4>
                 <div className="space-y-3">
                    {moveRequests.map((n:any) => (
                       <div key={n.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-white">
                          <div>
                             <p className="text-[10px] font-black text-blue-700 uppercase italic mb-1">{n.title}</p>
                             <p className="text-xs font-black uppercase">{n.message}</p>
                          </div>
                          <button onClick={() => store.approveTableMove(n.id)} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Phê duyệt</button>
                       </div>
                    ))}
                    {moveRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu chuyển bàn</p>}
                 </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2 text-indigo-500"><Shield size={18}/> Mở bàn QR ({qrRequests.length})</h4>
                 <div className="space-y-3">
                    {qrRequests.map((n:any) => (
                       <div key={n.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-white">
                          <p className="text-xs font-black uppercase">Bàn {n.payload?.tableId} - NV: {n.payload?.staffId}</p>
                          <button onClick={() => store.approveTableQr(n.id)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase">Phê duyệt</button>
                       </div>
                    ))}
                    {qrRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu mở bàn</p>}
                 </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2 text-amber-500"><CreditCard size={18}/> Thanh toán ({paymentRequests.length})</h4>
                 <div className="space-y-3">
                    {paymentRequests.map((t:any) => (
                       <div key={t.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                          <p className="text-xs font-black uppercase">{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id} - {t.currentOrders.reduce((s:number,o:any)=>s+(o.price*o.quantity),0).toLocaleString()}đ</p>
                          <button onClick={() => store.confirmPayment(t.id)} className="bg-amber-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Xác nhận thanh toán</button>
                       </div>
                    ))}
                    {paymentRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu thanh toán</p>}
                 </div>
              </div>
           </div>
        )}

        {/* Các tab khác được tinh giản giao diện... */}
        {activeTab === 'MONITOR' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {store.tables.map((t: Table) => (
              <div key={t.id} className={`bg-white p-5 rounded-[2.5rem] border shadow-sm flex flex-col justify-between min-h-[160px] ${t.id === 0 ? 'border-orange-200 bg-orange-50/10' : 'border-slate-100'}`}>
                <div className="text-center">
                  <h3 className="font-black text-lg italic text-slate-800">{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id}</h3>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${t.status === TableStatus.AVAILABLE ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-600'}`}>{t.status}</span>
                </div>
                <button onClick={() => { if(window.confirm(`Reset bàn ${t.id}?`)) store.adminForceClose(t.id); }} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all">
                   <PowerOff size={10} /> Reset bàn
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modals... */}
      {menuForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-4 animate-scaleIn">
            <h3 className="font-black uppercase italic text-lg text-slate-800">Thông tin món ăn</h3>
            <input type="text" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} placeholder="Tên món" className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none" />
            <input type="number" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: Number(e.target.value)})} placeholder="Giá bán" className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none" />
            <div className="flex gap-3 pt-2">
               <button onClick={() => setMenuForm(null)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black uppercase text-xs text-slate-400">Huỷ</button>
               <button onClick={saveMenuItem} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs shadow-lg">Lưu món</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
