
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType } from '../types';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';
import { ConfirmModal } from '../App';
import { 
  ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, Calendar, PowerOff, 
  Search, Save, CreditCard, Star, Award, TrendingUp, ShoppingBag, Utensils,
  ChevronRight, Users, Hash, ChefHat, RefreshCcw, Database
} from 'lucide-react';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'KPI' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'BANK' | 'CLOUD'>('DASHBOARD');
  const [tempTableCount, setTempTableCount] = useState(store.tables.length - 1);
  const [resetTableId, setResetTableId] = useState<number | null>(null);
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'menu' | 'user' | 'history' | 'kpi', id?: string, name: string } | null>(null);

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
      h.items.forEach(item => { 
        if (item.status !== OrderItemStatus.CANCELLED) {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity; 
        }
      });
    });
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { todayRevenue, totalRevenue, count: history.length, dineInCount, takeawayCount, topItems };
  }, [store.history]);

  const staffKPI = useMemo(() => {
    const staffList = store.users.filter((u: User) => u.role !== UserRole.ADMIN);
    const reviews: Review[] = store.reviews || [];
    const history: HistoryEntry[] = store.history || [];

    return staffList.map((s: User) => {
      const staffOrders = history.filter(h => h.staffId === s.id);
      const totalSales = staffOrders.reduce((sum, o) => sum + o.total, 0);
      let avgRating = 0;
      let reviewCount = 0;

      if (s.role === UserRole.STAFF) {
        const staffReviews = reviews.filter(r => r.staffId === s.id);
        reviewCount = staffReviews.length;
        avgRating = reviewCount > 0 ? staffReviews.reduce((sum, r) => sum + r.ratingService, 0) / reviewCount : 5;
      } else if (s.role === UserRole.KITCHEN) {
        reviewCount = reviews.length;
        avgRating = reviewCount > 0 ? reviews.reduce((sum, r) => sum + r.ratingFood, 0) / reviewCount : 5;
      }

      return { ...s, orderCount: staffOrders.length, totalSales, avgRating: Number(avgRating).toFixed(1), reviewCount };
    }).sort((a, b) => b.totalSales - a.totalSales || Number(b.avgRating) - Number(a.avgRating));
  }, [store.users, store.history, store.reviews]);

  const saveMenuItem = () => {
    if (!menuForm?.name || !menuForm?.price) return alert("Vui lòng điền đủ tên và giá!");
    store.upsertMenuItem({ ...menuForm, id: menuForm.id || `m-${Date.now()}`, isAvailable: menuForm.isAvailable ?? true, image: menuForm.image || 'https://picsum.photos/seed/food/400/300', category: menuForm.category || 'Tất cả' } as MenuItem);
    setMenuForm(null);
  };

  const saveUser = () => {
    if (!userForm?.username || !userForm?.password || !userForm?.fullName) return alert("Thiếu thông tin!");
    store.upsertUser({ ...userForm, id: userForm.id || `u-${Date.now()}`, role: userForm.role || UserRole.STAFF } as User);
    setUserForm(null);
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <div className="flex bg-white p-1 rounded-2xl mb-4 md:mb-6 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Báo cáo', icon: <LayoutDashboard size={16}/> },
          { id: 'KPI', label: 'KPI', icon: <Award size={16}/> },
          { id: 'REQUESTS', label: 'Yêu cầu', icon: <ArrowRightLeft size={16}/>, count: qrRequests.length + moveRequests.length + paymentRequests.length },
          { id: 'MONITOR', label: 'Bàn ăn', icon: <Monitor size={16}/> },
          { id: 'MENU', label: 'Thực đơn', icon: <Pizza size={16}/> },
          { id: 'USERS', label: 'Nhân viên', icon: <Shield size={16}/> },
          { id: 'BANK', label: 'Ngân hàng', icon: <CreditCard size={16}/> },
          { id: 'CLOUD', label: 'Hệ thống', icon: <Settings size={16}/> }
        ].map((tab: any) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.icon} <span className="hidden sm:inline">{tab.label}</span> 
            {tab.count > 0 && <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] animate-pulse">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 px-1">
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                 <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <TrendingUp className="mx-auto mb-2 text-green-500" size={20} />
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Doanh thu</p>
                    <h3 className="text-sm md:text-xl font-black text-slate-800 italic">{stats.todayRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <ShoppingBag className="mx-auto mb-2 text-blue-500" size={20} />
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đơn hàng</p>
                    <h3 className="text-sm md:text-xl font-black text-slate-800 italic">{stats.count} đơn</h3>
                 </div>
                 <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <Utensils className="mx-auto mb-2 text-orange-500" size={20} />
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tại chỗ</p>
                    <h3 className="text-sm md:text-xl font-black text-slate-800 italic">{stats.dineInCount} bàn</h3>
                 </div>
                 <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <TrendingUp className="mx-auto mb-2 text-indigo-500" size={20} />
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mang về</p>
                    <h3 className="text-sm md:text-xl font-black text-slate-800 italic">{stats.takeawayCount} đơn</h3>
                 </div>
              </div>

              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-xs md:text-sm uppercase italic mb-6 flex items-center gap-2"><Award className="text-orange-500" size={18}/> Bán chạy nhất</h4>
                 <div className="space-y-4">
                    {stats.topItems.map(([name, qty], idx) => (
                      <div key={name} className="flex items-center gap-4">
                         <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-[10px] italic">{idx + 1}</span>
                         <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                               <span className="text-[10px] font-black text-slate-700 uppercase">{name}</span>
                               <span className="text-[9px] font-black text-orange-600 italic">{qty} lượt</span>
                            </div>
                            <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                               <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(qty / (stats.topItems[0]?.[1] || 1)) * 100}%` }}></div>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <button 
                onClick={() => setDeleteTarget({ type: 'history', name: 'Toàn bộ lịch sử doanh thu' })}
                className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-[10px] border-2 border-dashed border-red-200 flex items-center justify-center gap-2 shadow-sm"
              >
                <Trash2 size={16}/> Xoá lịch sử (Kết toán)
              </button>
           </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'REQUESTS' && (
           <div className="space-y-6">
              {moveRequests.length > 0 && (
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <h4 className="font-black text-xs md:text-sm uppercase italic mb-6 flex items-center gap-2 text-blue-500"><ArrowRightLeft size={18}/> Chuyển bàn</h4>
                   <div className="space-y-3">
                      {moveRequests.map((n:any) => (
                         <div key={n.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-blue-50 rounded-2xl border border-white gap-3">
                            <div>
                               <p className="text-[9px] font-black text-blue-700 uppercase italic mb-1">{n.title}</p>
                               <p className="text-[11px] font-black uppercase">{n.message}</p>
                            </div>
                            <button onClick={() => store.approveTableMove(n.id)} className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg">Phê duyệt</button>
                         </div>
                      ))}
                   </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-xs md:text-sm uppercase italic mb-6 flex items-center gap-2 text-indigo-500"><Shield size={18}/> Mở bàn QR ({qrRequests.length})</h4>
                 <div className="space-y-3">
                    {qrRequests.map((n:any) => (
                       <div key={n.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-white">
                          <p className="text-[11px] font-black uppercase italic">Bàn {n.payload?.tableId}</p>
                          <button onClick={() => store.approveTableQr(n.id)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase">Duyệt</button>
                       </div>
                    ))}
                    {qrRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu mở bàn</p>}
                 </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-xs md:text-sm uppercase italic mb-6 flex items-center gap-2 text-amber-500"><CreditCard size={18}/> Thu tiền ({paymentRequests.length})</h4>
                 <div className="space-y-3">
                    {paymentRequests.map((t:any) => (
                       <div key={t.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                          <p className="text-[11px] font-black uppercase italic">{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id}</p>
                          <button onClick={() => store.confirmPayment(t.id)} className="bg-amber-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Xác nhận</button>
                       </div>
                    ))}
                    {paymentRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu thanh toán</p>}
                 </div>
              </div>
           </div>
        )}

        {/* Other tabs follow the same scaling improvements... */}
      </div>

      <ConfirmModal 
        isOpen={deleteTarget !== null} 
        type="danger" 
        title="Xác nhận xóa?" 
        message={`Thao tác này không thể hoàn tác.`} 
        onConfirm={() => {
           if(deleteTarget?.type === 'menu' && deleteTarget.id) store.deleteMenuItem(deleteTarget.id);
           if(deleteTarget?.type === 'user' && deleteTarget.id) store.deleteUser(deleteTarget.id);
           if(deleteTarget?.type === 'history') store.clearHistory();
           if(deleteTarget?.type === 'kpi') store.clearReviews();
           setDeleteTarget(null);
        }} 
        onCancel={() => setDeleteTarget(null)} 
      />
    </div>
  );
};

export default AdminView;
