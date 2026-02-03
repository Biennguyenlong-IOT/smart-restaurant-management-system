
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType } from '../types';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';
import { ConfirmModal } from '../App';
import { 
  ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, Calendar, PowerOff, 
  Search, Save, CreditCard, Star, Award, TrendingUp, ShoppingBag, Utensils,
  ChevronRight, Users, Hash, ChefHat, RefreshCcw, Database, CheckCircle, 
  Clock, Filter, Download, Info, Package, User as UserIcon
} from 'lucide-react';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'KPI' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'BANK' | 'CLOUD'>('DASHBOARD');
  const [tempTableCount, setTempTableCount] = useState(store.tables.length - 1);
  const [resetTableId, setResetTableId] = useState<number | null>(null);
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'menu' | 'user' | 'history' | 'kpi' | 'notif', id?: string, name: string } | null>(null);

  const qrRequests = useMemo(() => (store.notifications || []).filter((n: AppNotification) => n.type === 'qr_request'), [store.notifications]);
  const moveRequests = useMemo(() => (store.notifications || []).filter((n: AppNotification) => n.type === 'move_request'), [store.notifications]);
  const paymentRequests = useMemo(() => (store.tables || []).filter((t: Table) => t.status === TableStatus.PAYING), [store.tables]);
  const billingTables = useMemo(() => (store.tables || []).filter((t: Table) => t.status === TableStatus.BILLING), [store.tables]);

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
    
    return { todayRevenue, totalRevenue, count: history.length, dineInCount, takeawayCount, topItems, history };
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
    <div className="h-full flex flex-col animate-fadeIn overflow-hidden">
      {/* Tab Navigation - Professional Sidebar style for desktop, horizontal for mobile */}
      <div className="flex bg-white p-1 rounded-2xl mb-4 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Báo cáo', icon: <LayoutDashboard size={16}/> },
          { id: 'KPI', label: 'KPI', icon: <Award size={16}/> },
          { id: 'REQUESTS', label: 'Duyệt', icon: <CheckCircle size={16}/>, count: qrRequests.length + moveRequests.length + paymentRequests.length + billingTables.length },
          { id: 'MONITOR', label: 'Sơ đồ', icon: <Monitor size={16}/> },
          { id: 'MENU', label: 'Thực đơn', icon: <Pizza size={16}/> },
          { id: 'USERS', label: 'Nhân sự', icon: <Shield size={16}/> },
          { id: 'BANK', label: 'Ngân hàng', icon: <CreditCard size={16}/> },
          { id: 'CLOUD', label: 'Hệ thống', icon: <Settings size={16}/> }
        ].map((tab: any) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.icon} <span className="hidden sm:inline">{tab.label}</span> 
            {tab.count > 0 && <span className="bg-red-500 text-white min-w-[16px] h-4 rounded-full flex items-center justify-center text-[8px] px-1 animate-pulse">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 px-1 space-y-6">
        {/* DASHBOARD TAB - DETAILED REVENUE */}
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-6 animate-slideUp">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center mb-4"><TrendingUp size={20}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Doanh thu hôm nay</p>
                    <h3 className="text-xl font-black text-slate-800 italic">{stats.todayRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-4"><ShoppingBag size={20}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng đơn hàng</p>
                    <h3 className="text-xl font-black text-slate-800 italic">{stats.count} đơn</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center mb-4"><Utensils size={20}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Khách tại bàn</p>
                    <h3 className="text-xl font-black text-slate-800 italic">{stats.dineInCount} lượt</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center mb-4"><Package size={20}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mang về</p>
                    <h3 className="text-xl font-black text-slate-800 italic">{stats.takeawayCount} đơn</h3>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                      <h4 className="font-black text-xs uppercase italic flex items-center gap-2"><Clock className="text-slate-400" size={18}/> Lịch sử đơn hàng gần đây</h4>
                      <button onClick={() => setDeleteTarget({ type: 'history', name: 'Xoá toàn bộ lịch sử' })} className="text-[8px] font-black text-red-500 uppercase italic border border-red-100 px-3 py-1 rounded-lg hover:bg-red-50 transition-all">Kết toán & Reset</button>
                   </div>
                   <div className="space-y-3 overflow-y-auto max-h-[400px] no-scrollbar">
                      {stats.history.length === 0 ? <p className="text-center py-20 text-slate-300 font-black uppercase text-[10px] italic">Chưa có dữ liệu</p> : 
                        stats.history.map((h: HistoryEntry) => (
                           <div key={h.id} className="p-4 bg-slate-50 rounded-2xl border border-white flex flex-col md:flex-row justify-between gap-3">
                              <div className="flex items-center gap-4">
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs ${h.orderType === OrderType.TAKEAWAY ? 'bg-red-500' : 'bg-slate-900'}`}>
                                    {h.tableId === 0 ? 'L' : 'B'+h.tableId}
                                 </div>
                                 <div>
                                    <p className="text-[10px] font-black text-slate-800 uppercase leading-none mb-1">{h.items.filter(o => o.status !== OrderItemStatus.CANCELLED).length} món - {h.total.toLocaleString()}đ</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase italic">{new Date(h.date).toLocaleString()}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2">
                                 <span className="text-[8px] font-black px-2 py-1 bg-white border border-slate-100 rounded-lg text-slate-400 uppercase">NV: {h.staffId}</span>
                              </div>
                           </div>
                        ))
                      }
                   </div>
                </div>

                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                   <h4 className="font-black text-xs uppercase italic mb-6 flex items-center gap-2"><TrendingUp className="text-orange-500" size={18}/> Top 5 món chạy nhất</h4>
                   <div className="space-y-6">
                      {stats.topItems.map(([name, qty], idx) => (
                        <div key={name} className="flex items-center gap-4">
                           <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-[12px] italic shrink-0 shadow-md">{idx + 1}</span>
                           <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                 <span className="text-[10px] font-black text-slate-700 uppercase truncate pr-2">{name}</span>
                                 <span className="text-[9px] font-black text-orange-600 italic whitespace-nowrap">{qty} lượt</span>
                              </div>
                              <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                                 <div className="h-full bg-orange-500 rounded-full transition-all duration-1000" style={{ width: `${(qty / (stats.topItems[0]?.[1] || 1)) * 100}%` }}></div>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
           </div>
        )}

        {/* KPI TAB - STAFF PERFORMANCE */}
        {activeTab === 'KPI' && (
           <div className="space-y-6 animate-slideUp">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm overflow-x-auto">
                 <div className="flex justify-between items-center mb-8">
                    <h4 className="font-black text-xs uppercase italic flex items-center gap-2"><Users className="text-blue-500" size={18}/> Bảng xếp hạng hiệu suất</h4>
                    <button onClick={() => setDeleteTarget({ type: 'kpi', name: 'Làm mới toàn bộ KPI & Đánh giá' })} className="p-2 bg-slate-900 text-white rounded-xl shadow-lg active:scale-95 transition-all"><RefreshCcw size={14}/></button>
                 </div>
                 <table className="w-full text-left min-w-[600px]">
                    <thead className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase">
                       <tr>
                          <th className="pb-4">Họ và Tên</th>
                          <th className="pb-4 text-center">Vai trò</th>
                          <th className="pb-4 text-center">Số đơn</th>
                          <th className="pb-4 text-center">Doanh số</th>
                          <th className="pb-4 text-center">Đánh giá</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {staffKPI.map((s: any) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="py-4">
                                <p className="text-xs font-black text-slate-800 uppercase italic">{s.fullName}</p>
                                <p className="text-[8px] text-slate-300 font-bold uppercase tracking-widest">@{s.username}</p>
                             </td>
                             <td className="py-4 text-center">
                                <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-lg ${s.role === UserRole.KITCHEN ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>{s.role}</span>
                             </td>
                             <td className="py-4 text-center font-black text-[10px] text-slate-700">{s.orderCount} đơn</td>
                             <td className="py-4 text-center font-black text-[10px] text-slate-800">{s.totalSales.toLocaleString()}đ</td>
                             <td className="py-4 text-center">
                                <div className="flex flex-col items-center">
                                   <div className="flex items-center gap-1 text-orange-500">
                                      <Star size={10} fill="currentColor"/>
                                      <span className="font-black text-sm italic">{s.avgRating}</span>
                                   </div>
                                   <span className="text-[7px] text-slate-300 font-black uppercase italic">{s.reviewCount} lượt</span>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'REQUESTS' && (
           <div className="space-y-6 animate-slideUp">
              {billingTables.length > 0 && (
                <div className="bg-white p-6 rounded-[2rem] border border-indigo-100 shadow-sm">
                   <h4 className="font-black text-xs uppercase italic mb-6 flex items-center gap-2 text-indigo-600"><CheckCircle size={18}/> Chờ hoàn tất Bill ({billingTables.length})</h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {billingTables.map((t:any) => (
                         <div key={t.id} className="flex items-center justify-between p-4 bg-indigo-50/50 rounded-2xl border border-white">
                            <p className="text-[11px] font-black uppercase italic leading-none">Bàn {t.id === 0 ? 'Khách lẻ' : t.id}</p>
                            <button onClick={() => store.completeBilling(t.id)} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase italic shadow-lg active:scale-95 transition-all">Hoàn tất & Đánh giá</button>
                         </div>
                      ))}
                   </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <h4 className="font-black text-xs uppercase italic mb-6 flex items-center gap-2 text-blue-500"><ArrowRightLeft size={18}/> Chuyển bàn</h4>
                   <div className="space-y-3">
                      {moveRequests.map((n:any) => (
                         <div key={n.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-white gap-3">
                            <div><p className="text-[10px] font-black uppercase italic leading-tight">{n.message}</p></div>
                            <button onClick={() => store.approveTableMove(n.id)} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase italic shadow-lg">Duyệt</button>
                         </div>
                      ))}
                      {moveRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu</p>}
                   </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                   <h4 className="font-black text-xs uppercase italic mb-6 flex items-center gap-2 text-amber-500"><CreditCard size={18}/> Xác nhận thu tiền ({paymentRequests.length})</h4>
                   <div className="space-y-3">
                      {paymentRequests.map((t:any) => (
                         <div key={t.id} className="flex items-center justify-between p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                            <p className="text-[11px] font-black uppercase italic">Bàn {t.id === 0 ? 'Khách lẻ' : t.id}</p>
                            <button onClick={() => store.confirmPayment(t.id)} className="bg-amber-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase italic shadow-lg">Đã nhận tiền</button>
                         </div>
                      ))}
                      {paymentRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Trống</p>}
                 </div>
                </div>
              </div>
           </div>
        )}

        {/* MONITOR TAB - TABLE GRAPH */}
        {activeTab === 'MONITOR' && (
           <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-slideUp">
            {store.tables.map((t: Table) => (
              <div key={t.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[160px] relative overflow-hidden group hover:border-slate-300 transition-all">
                <div className="text-center">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em] block mb-1">Status</span>
                  <h3 className="font-black text-2xl italic text-slate-800 mb-2">{t.id === 0 ? 'Lẻ' : 'B'+t.id}</h3>
                  <div className={`text-[8px] font-black px-3 py-1 rounded-full uppercase inline-block ${
                    t.status === TableStatus.AVAILABLE ? 'bg-slate-50 text-slate-400' : 
                    t.status === TableStatus.OCCUPIED ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'
                  }`}>{t.status}</div>
                </div>
                <button onClick={() => setResetTableId(t.id)} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase italic shadow-lg active:scale-95 transition-all">Reset bàn</button>
              </div>
            ))}
          </div>
        )}

        {/* MENU TAB */}
        {activeTab === 'MENU' && (
           <div className="space-y-6 animate-slideUp">
              <div className="flex flex-col md:flex-row gap-4">
                 <div className="flex-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex items-center">
                    <Search className="ml-4 text-slate-300" size={18}/>
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm món ăn..." className="w-full px-4 py-4 outline-none font-bold text-sm bg-transparent" />
                 </div>
                 <button onClick={() => setMenuForm({})} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase italic shadow-xl flex items-center justify-center gap-2"><Plus size={18}/> Thêm món</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 {store.menu.filter((m: MenuItem) => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item: MenuItem) => (
                    <div key={item.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 group">
                       <img src={item.image} className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-sm group-hover:scale-105 transition-all" />
                       <div className="flex-1 min-w-0">
                          <h4 className="font-black text-slate-800 text-xs truncate uppercase italic mb-0.5">{item.name}</h4>
                          <p className="text-[10px] font-black text-orange-600 italic mb-2">{item.price.toLocaleString()}đ</p>
                          <div className="flex gap-2">
                             <button onClick={() => setMenuForm(item)} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100"><Edit3 size={14}/></button>
                             <button onClick={() => setDeleteTarget({ type: 'menu', id: item.id, name: item.name })} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={14}/></button>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'USERS' && (
           <div className="space-y-6 animate-slideUp">
              <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic flex items-center gap-3"><Shield className="text-indigo-500"/> Quản lý nhân viên</h4>
                 <button onClick={() => setUserForm({})} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase italic shadow-lg flex items-center gap-2"><UserPlus size={18}/> Thêm mới</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {store.users.map((u: User) => (
                    <div key={u.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400"><UserIcon size={20}/></div>
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase italic leading-none mb-1">{u.fullName}</p>
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{u.role}</span>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => setUserForm(u)} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-indigo-50"><Edit3 size={14}/></button>
                          {u.role !== UserRole.ADMIN && <button onClick={() => setDeleteTarget({ type: 'user', id: u.id, name: u.fullName })} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={14}/></button>}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {/* BANK TAB - REFINED */}
        {activeTab === 'BANK' && (
           <div className="max-w-xl mx-auto animate-slideUp">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 text-slate-900"><CreditCard size={120}/></div>
                <h4 className="text-center font-black text-xl uppercase italic mb-10 flex items-center justify-center gap-3"><CreditCard className="text-orange-500" /> QR Ngân hàng</h4>
                <form onSubmit={(e) => {
                   e.preventDefault();
                   const fd = new FormData(e.currentTarget);
                   store.updateBankConfig({ bankId: fd.get('bankId'), accountNo: fd.get('accountNo'), accountName: fd.get('accountName') });
                   alert("Đã cập nhật cấu hình ngân hàng thành công!");
                }} className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic">Mã Ngân hàng (ICB, VCB...)</label>
                      <input name="bankId" defaultValue={store.bankConfig.bankId} placeholder="Vd: ICB" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none focus:border-orange-500 transition-all" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic">Số tài khoản</label>
                      <input name="accountNo" defaultValue={store.bankConfig.accountNo} placeholder="Nhập số tài khoản" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none focus:border-orange-500 transition-all" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic">Tên chủ tài khoản</label>
                      <input name="accountName" defaultValue={store.bankConfig.accountName} placeholder="Vd: NGUYEN VAN A" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none focus:border-orange-500 transition-all uppercase" />
                   </div>
                   <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-2 italic active:scale-95 transition-all mt-4"><Save size={18}/> Lưu cấu hình</button>
                </form>
              </div>
           </div>
        )}

        {/* CLOUD TAB - SYSTEM CONFIG */}
        {activeTab === 'CLOUD' && (
           <div className="max-w-2xl mx-auto space-y-6 animate-slideUp">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl text-center relative overflow-hidden">
                 <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-50 rounded-full opacity-50 blur-3xl"></div>
                 <h4 className="font-black text-xl uppercase italic mb-8 flex items-center justify-center gap-3"><Database className="text-indigo-500"/> Thiết lập hệ thống</h4>
                 <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-left mb-10">
                    <p className="text-[9px] font-black text-slate-400 uppercase italic mb-2">Kết nối hiện tại</p>
                    <code className="text-[10px] font-bold text-indigo-600 break-all bg-white p-3 rounded-xl border border-slate-100 block">{store.cloudUrl}</code>
                    <div className="mt-4 flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                       <span className="text-[9px] font-black uppercase text-green-600 italic">Database Online</span>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase italic">Số lượng bàn ăn hiển thị</p>
                    <div className="flex items-center justify-center gap-8">
                       <button onClick={() => setTempTableCount(Math.max(1, tempTableCount - 1))} className="w-14 h-14 bg-slate-50 text-slate-800 rounded-2xl font-black text-2xl shadow-sm hover:bg-slate-100 active:scale-90 transition-all">-</button>
                       <span className="text-4xl font-black text-slate-900 italic">{tempTableCount}</span>
                       <button onClick={() => setTempTableCount(tempTableCount + 1)} className="w-14 h-14 bg-slate-50 text-slate-800 rounded-2xl font-black text-2xl shadow-sm hover:bg-slate-100 active:scale-90 transition-all">+</button>
                    </div>
                    <button onClick={() => store.updateTableCount(tempTableCount)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all italic">Cập nhật quy mô nhà hàng</button>
                 </div>
              </div>

              <div className="bg-red-50 p-8 rounded-[2rem] border border-red-100 text-center">
                 <h5 className="text-red-600 font-black text-xs uppercase italic mb-4 flex items-center justify-center gap-2"><Info size={16}/> Vùng nguy hiểm</h5>
                 <button onClick={() => setDeleteTarget({ type: 'notif', name: 'Xoá tất cả thông báo hệ thống' })} className="w-full py-4 border-2 border-dashed border-red-200 text-red-500 font-black text-[10px] uppercase italic rounded-xl hover:bg-red-100/50 transition-all">Dọn dẹp thông báo</button>
              </div>
           </div>
        )}
      </div>

      {/* Forms & Modals */}
      {menuForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl space-y-5 animate-scaleIn">
            <h3 className="font-black uppercase italic text-lg text-slate-800 mb-2">{menuForm.id ? 'Cập nhật món' : 'Thêm món mới'}</h3>
            <div className="space-y-4">
              <input type="text" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} placeholder="Tên món" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none focus:border-slate-900" />
              <input type="number" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: Number(e.target.value)})} placeholder="Giá bán (VNĐ)" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none focus:border-slate-900" />
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
                 <div className={`w-3 h-3 rounded-full ${menuForm.isAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                 <span className="text-[10px] font-black uppercase italic flex-1">{menuForm.isAvailable ? 'Đang phục vụ' : 'Đã hết'}</span>
                 <button onClick={() => setMenuForm({...menuForm, isAvailable: !menuForm.isAvailable})} className="text-[9px] font-black text-indigo-600 uppercase italic">Thay đổi</button>
              </div>
            </div>
            <div className="flex gap-4 mt-6">
               <button onClick={() => setMenuForm(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-xl font-black uppercase text-[10px] italic">Huỷ bỏ</button>
               <button onClick={saveMenuItem} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] shadow-xl italic">Lưu lại</button>
            </div>
          </div>
        </div>
      )}

      {userForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl space-y-5 animate-scaleIn">
            <h3 className="font-black uppercase italic text-lg text-slate-800 mb-2">Thông tin nhân sự</h3>
            <div className="space-y-4">
               <input type="text" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} placeholder="Họ và tên" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none" />
               <input type="text" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} placeholder="Tên đăng nhập" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none" />
               <input type="password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="Mật khẩu" className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none" />
               <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none appearance-none">
                  <option value={UserRole.STAFF}>Phục vụ (Staff)</option>
                  <option value={UserRole.KITCHEN}>Bếp (Kitchen)</option>
                  <option value={UserRole.ADMIN}>Quản trị (Admin)</option>
               </select>
            </div>
            <div className="flex gap-4 mt-6">
               <button onClick={() => setUserForm(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-xl font-black uppercase text-[10px] italic">Đóng</button>
               <button onClick={saveUser} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] shadow-xl italic">Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={deleteTarget !== null || resetTableId !== null} 
        type="danger" 
        title="Xác nhận thao tác?" 
        message={`Hành động này sẽ thay đổi vĩnh viễn dữ liệu hệ thống. Bạn có chắc chắn muốn tiếp tục?`} 
        onConfirm={() => {
           if(deleteTarget?.type === 'menu' && deleteTarget.id) store.deleteMenuItem(deleteTarget.id);
           if(deleteTarget?.type === 'user' && deleteTarget.id) store.deleteUser(deleteTarget.id);
           if(deleteTarget?.type === 'history') store.clearHistory();
           if(deleteTarget?.type === 'kpi') { store.clearReviews(); alert("Đã reset KPI!"); }
           if(deleteTarget?.type === 'notif') { store.deleteNotification('all'); alert("Đã dọn dẹp!"); }
           if(resetTableId !== null) store.adminForceClose(resetTableId);
           setDeleteTarget(null); setResetTableId(null);
        }} 
        onCancel={() => { setDeleteTarget(null); setResetTableId(null); }} 
      />
    </div>
  );
};

export default AdminView;
