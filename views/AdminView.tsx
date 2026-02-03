
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
  const [tempTableCount, setTempTableCount] = useState(store.tables.length - 1); // Trừ bàn khách lẻ
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
    const history: HistoryEntry[] = store.history || [];
    const reviews: Review[] = store.reviews || [];

    return staffList.map((s: User) => {
      const staffOrders = history.filter(h => h.staffId === s.id);
      const totalSales = staffOrders.reduce((sum, o) => sum + o.total, 0);
      
      let avgRating = 0;
      let reviewCount = 0;

      if (s.role === UserRole.STAFF) {
        // STAFF hưởng điểm Service (Phục vụ)
        const staffReviews = reviews.filter(r => r.staffId === s.id);
        reviewCount = staffReviews.length;
        avgRating = reviewCount > 0 
          ? staffReviews.reduce((sum, r) => sum + r.ratingService, 0) / reviewCount 
          : 5;
      } else if (s.role === UserRole.KITCHEN) {
        // KITCHEN hưởng điểm Food (Món ăn)
        reviewCount = reviews.length;
        avgRating = reviewCount > 0 
          ? reviews.reduce((sum, r) => sum + r.ratingFood, 0) / reviewCount 
          : 5;
      }

      return { 
        ...s, 
        orderCount: staffOrders.length, 
        totalSales, 
        avgRating: Number(avgRating).toFixed(1),
        reviewCount
      };
    }).sort((a, b) => b.totalSales - a.totalSales || Number(b.avgRating) - Number(a.avgRating));
  }, [store.users, store.history, store.reviews]);

  const saveMenuItem = () => {
    if (!menuForm?.name || !menuForm?.price) return alert("Vui lòng điền đủ tên và giá!");
    store.upsertMenuItem({ 
      ...menuForm, 
      id: menuForm.id || `m-${Date.now()}`, 
      isAvailable: menuForm.isAvailable ?? true, 
      image: menuForm.image || 'https://picsum.photos/seed/food/400/300', 
      category: menuForm.category || 'Tất cả',
      description: menuForm.description || ''
    } as MenuItem);
    setMenuForm(null);
  };

  const saveUser = () => {
    if (!userForm?.username || !userForm?.password || !userForm?.fullName) return alert("Thiếu thông tin!");
    store.upsertUser({ 
      ...userForm, 
      id: userForm.id || `u-${Date.now()}`, 
      role: userForm.role || UserRole.STAFF 
    } as User);
    setUserForm(null);
  };

  const handleUpdateBank = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    store.updateBankConfig({
      bankId: formData.get('bankId') as string,
      accountNo: formData.get('accountNo') as string,
      accountName: formData.get('accountName') as string,
    });
    alert("Đã cập nhật cấu hình ngân hàng!");
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Navigation Tabs */}
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
        {/* DASHBOARD TAB */}
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <TrendingUp className="mx-auto mb-2 text-green-500" size={24} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Doanh thu hôm nay</p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800 italic">{stats.todayRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <ShoppingBag className="mx-auto mb-2 text-blue-500" size={24} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đơn hàng</p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800 italic">{stats.count} đơn</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <Utensils className="mx-auto mb-2 text-orange-500" size={24} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Phục vụ tại chỗ</p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800 italic">{stats.dineInCount} bàn</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <TrendingUp className="mx-auto mb-2 text-indigo-500" size={24} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mang về</p>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800 italic">{stats.takeawayCount} đơn</h3>
                 </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2"><Award className="text-orange-500" size={18}/> Top 5 món bán chạy</h4>
                 <div className="space-y-4">
                    {stats.topItems.map(([name, qty], idx) => (
                      <div key={name} className="flex items-center gap-4">
                         <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-xs italic">{idx + 1}</span>
                         <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                               <span className="text-xs font-black text-slate-700 uppercase">{name}</span>
                               <span className="text-[10px] font-black text-orange-600 italic">{qty} lượt</span>
                            </div>
                            <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                               <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(qty / stats.topItems[0][1]) * 100}%` }}></div>
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <button 
                onClick={() => setDeleteTarget({ type: 'history', name: 'Toàn bộ lịch sử doanh thu' })}
                className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-[10px] border-2 border-dashed border-red-200 flex items-center justify-center gap-2"
              >
                <Trash2 size={16}/> Xoá lịch sử doanh thu
              </button>
           </div>
        )}

        {/* KPI TAB */}
        {activeTab === 'KPI' && (
           <div className="space-y-6">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <div>
                        <h4 className="font-black text-sm uppercase italic flex items-center gap-2"><Users className="text-blue-500" size={18}/> Hiệu suất nhân sự</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase italic mt-1">Kết quả được tính theo tháng hiện tại</p>
                    </div>
                    <button 
                        onClick={() => setDeleteTarget({ type: 'kpi', name: 'Reset toàn bộ KPI tháng này' })}
                        className="p-3 bg-slate-900 text-white rounded-xl shadow-lg flex items-center gap-2 text-[9px] font-black uppercase italic"
                    >
                        <RefreshCcw size={14}/> Reset KPI tháng mới
                    </button>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="border-b border-slate-50">
                             <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhân sự</th>
                             <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Vai trò</th>
                             <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Lượt phục vụ</th>
                             <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Đánh giá KPI</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {staffKPI.map((s: any) => (
                             <tr key={s.id}>
                                <td className="py-4">
                                   <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.role === UserRole.KITCHEN ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                          {s.role === UserRole.KITCHEN ? <ChefHat size={16}/> : <Users size={16}/>}
                                      </div>
                                      <div>
                                         <p className="text-xs font-black text-slate-800 uppercase">{s.fullName}</p>
                                         <p className="text-[8px] text-slate-300 font-bold">@{s.username}</p>
                                      </div>
                                   </div>
                                </td>
                                <td className="py-4 text-center">
                                   <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${s.role === UserRole.KITCHEN ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>{s.role}</span>
                                </td>
                                <td className="py-4 text-center">
                                   <span className="text-[10px] font-black text-slate-700 italic">{s.role === UserRole.KITCHEN ? stats.count : s.orderCount}</span>
                                </td>
                                <td className="py-4">
                                   <div className="flex flex-col items-center">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                         <span className={`text-sm font-black italic ${Number(s.avgRating) >= 4.5 ? 'text-green-600' : Number(s.avgRating) >= 3.5 ? 'text-orange-500' : 'text-red-500'}`}>{s.avgRating}</span>
                                         <div className="flex">
                                            {[1,2,3,4,5].map(star => (
                                                <Star key={star} size={8} fill={star <= Math.round(Number(s.avgRating)) ? (s.role === UserRole.KITCHEN ? '#3b82f6' : '#f97316') : 'none'} className={star <= Math.round(Number(s.avgRating)) ? (s.role === UserRole.KITCHEN ? 'text-blue-500' : 'text-orange-500') : 'text-slate-200'} />
                                            ))}
                                         </div>
                                      </div>
                                      <p className="text-[7px] font-black text-slate-300 uppercase italic">Dựa trên {s.reviewCount} đánh giá {s.role === UserRole.KITCHEN ? 'món ăn' : 'phục vụ'}</p>
                                   </div>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'REQUESTS' && (
           <div className="space-y-6">
              {moveRequests.length > 0 && (
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                   <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2 text-blue-500"><ArrowRightLeft size={18}/> Yêu cầu Chuyển bàn</h4>
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
                   </div>
                </div>
              )}

              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2 text-indigo-500"><Shield size={18}/> Mở bàn QR ({qrRequests.length})</h4>
                 <div className="space-y-3">
                    {qrRequests.map((n:any) => (
                       <div key={n.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-white">
                          <p className="text-xs font-black uppercase italic">Bàn {n.payload?.tableId} - NV: {n.payload?.staffId}</p>
                          <button onClick={() => store.approveTableQr(n.id)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase">Phê duyệt</button>
                       </div>
                    ))}
                    {qrRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu mở bàn</p>}
                 </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2 text-amber-500"><CreditCard size={18}/> Thu tiền ({paymentRequests.length})</h4>
                 <div className="space-y-3">
                    {paymentRequests.map((t:any) => (
                       <div key={t.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                          <p className="text-xs font-black uppercase italic">{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id} - {t.currentOrders.reduce((s:number,o:any)=>s+(o.price*o.quantity),0).toLocaleString()}đ</p>
                          <button onClick={() => store.confirmPayment(t.id)} className="bg-amber-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Xác nhận đã thu</button>
                       </div>
                    ))}
                    {paymentRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu thanh toán</p>}
                 </div>
              </div>
           </div>
        )}

        {/* MONITOR TAB */}
        {activeTab === 'MONITOR' && (
          <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {store.tables.map((t: Table) => (
              <div key={t.id} className={`bg-white p-5 rounded-[2rem] border shadow-sm flex flex-col justify-between min-h-[140px] ${t.id === 0 ? 'border-orange-200 bg-orange-50/10' : 'border-slate-100'}`}>
                <div className="text-center">
                  <h3 className="font-black text-base italic text-slate-800">{t.id === 0 ? 'Lẻ' : 'Bàn ' + t.id}</h3>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${t.status === TableStatus.AVAILABLE ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-600'}`}>{t.status}</span>
                </div>
                <button onClick={() => setResetTableId(t.id)} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all">
                   <PowerOff size={10} /> Reset bàn
                </button>
              </div>
            ))}
          </div>
        )}

        {/* MENU MANAGEMENT TAB */}
        {activeTab === 'MENU' && (
           <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                 <div className="flex-1 bg-white p-1 rounded-2xl flex items-center border border-slate-200 shadow-sm">
                    <Search className="ml-4 text-slate-300" size={20} />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm kiếm món ăn..." className="w-full px-4 py-3 outline-none font-bold text-sm bg-transparent" />
                 </div>
                 <button onClick={() => setMenuForm({})} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2 italic">
                    <Plus size={18}/> Thêm món mới
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {store.menu.filter((m: MenuItem) => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item: MenuItem) => (
                    <div key={item.id} className="bg-white p-4 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4">
                       <img src={item.image} className="w-20 h-20 rounded-[1.5rem] object-cover shrink-0 shadow-sm" />
                       <div className="flex-1 min-w-0">
                          <h4 className="font-black text-slate-800 text-xs uppercase truncate mb-0.5 italic">{item.name}</h4>
                          <p className="text-[10px] font-black text-orange-600 italic mb-2">{item.price.toLocaleString()}đ</p>
                          <div className="flex gap-2">
                             <button onClick={() => setMenuForm(item)} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100"><Edit3 size={14}/></button>
                             <button onClick={() => setDeleteTarget({ type: 'menu', id: item.id, name: item.name })} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><Trash2 size={14}/></button>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'USERS' && (
           <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic ml-4">Quản lý nhân sự</h4>
                 <button onClick={() => setUserForm({})} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 italic">
                    <UserPlus size={18}/> Thêm nhân sự
                 </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {store.users.map((u: User) => (
                    <div key={u.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
                       <div>
                          <p className="text-xs font-black text-slate-800 uppercase italic">{u.fullName}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{u.role}</p>
                          <p className="text-[8px] text-slate-300 font-bold mt-1">@{u.username}</p>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => setUserForm(u)} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl"><Edit3 size={14}/></button>
                          {u.role !== UserRole.ADMIN && (
                             <button onClick={() => setDeleteTarget({ type: 'user', id: u.id, name: u.fullName })} className="p-2.5 bg-red-50 text-red-500 rounded-xl"><Trash2 size={14}/></button>
                          )}
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {/* BANK CONFIG TAB */}
        {activeTab === 'BANK' && (
           <div className="max-w-md mx-auto">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                 <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8"><CreditCard size={32} /></div>
                 <h4 className="text-center font-black text-lg uppercase italic mb-8">Cấu hình VietQR</h4>
                 <form onSubmit={handleUpdateBank} className="space-y-5">
                    <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Mã ngân hàng (VietQR)</label>
                       <input name="bankId" defaultValue={store.bankConfig.bankId} placeholder="Vd: ICB, VCB..." className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none focus:border-blue-500 transition-all" />
                    </div>
                    <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Số tài khoản</label>
                       <input name="accountNo" defaultValue={store.bankConfig.accountNo} placeholder="123456789..." className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none focus:border-blue-500 transition-all" />
                    </div>
                    <div>
                       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Tên chủ tài khoản</label>
                       <input name="accountName" defaultValue={store.bankConfig.accountName} placeholder="NGUYEN VAN A" className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-sm outline-none focus:border-blue-500 transition-all uppercase" />
                    </div>
                    <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all mt-4">Lưu cấu hình</button>
                 </form>
              </div>
           </div>
        )}

        {/* SYSTEM CLOUD TAB */}
        {activeTab === 'CLOUD' && (
           <div className="max-w-md mx-auto space-y-6">
              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                 <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8"><Hash size={32} /></div>
                 <h4 className="text-center font-black text-lg uppercase italic mb-8">Số lượng bàn ăn</h4>
                 <div className="space-y-6">
                    <div className="flex items-center justify-between px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <button onClick={() => setTempTableCount(Math.max(1, tempTableCount - 1))} className="w-10 h-10 bg-white rounded-xl shadow-sm font-black text-lg">-</button>
                       <span className="text-2xl font-black text-slate-800 italic">{tempTableCount}</span>
                       <button onClick={() => setTempTableCount(tempTableCount + 1)} className="w-10 h-10 bg-white rounded-xl shadow-sm font-black text-lg">+</button>
                    </div>
                    <button onClick={() => store.updateTableCount(tempTableCount)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Cập nhật số bàn</button>
                 </div>
              </div>

              <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                 <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8"><Settings size={32} /></div>
                 <h4 className="text-center font-black text-lg uppercase italic mb-8">Firebase Cloud URL</h4>
                 <div className="space-y-4">
                    <input id="newCloudUrl" defaultValue={store.cloudUrl} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-xs outline-none" />
                    <button onClick={() => {
                       const u = (document.getElementById('newCloudUrl') as HTMLInputElement).value;
                       if(u.startsWith('http')) store.updateCloudUrl(u);
                    }} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Kết nối Database mới</button>
                 </div>
              </div>

              <div className="bg-red-50 p-10 rounded-[3rem] border-2 border-dashed border-red-100">
                 <div className="w-16 h-16 bg-white text-red-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 shadow-sm"><Database size={32} /></div>
                 <h4 className="text-center font-black text-lg uppercase italic mb-8 text-red-600">Bảo trì dữ liệu</h4>
                 <div className="space-y-3">
                    <button 
                        onClick={() => setDeleteTarget({ type: 'history', name: 'Toàn bộ doanh thu' })}
                        className="w-full py-4 bg-white text-red-500 border border-red-100 rounded-2xl font-black uppercase text-[10px] shadow-sm hover:bg-red-50 transition-all"
                    >
                        Xoá toàn bộ lịch sử doanh thu
                    </button>
                    <button 
                        onClick={() => setDeleteTarget({ type: 'kpi', name: 'Toàn bộ đánh giá KPI' })}
                        className="w-full py-4 bg-white text-red-500 border border-red-100 rounded-2xl font-black uppercase text-[10px] shadow-sm hover:bg-red-50 transition-all"
                    >
                        Xoá toàn bộ đánh giá (Reset KPI)
                    </button>
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* Menu Edit Modal */}
      {menuForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-4 animate-scaleIn border border-slate-100">
            <h3 className="font-black uppercase italic text-lg text-slate-800 mb-6">{menuForm.id ? 'Sửa món ăn' : 'Thêm món mới'}</h3>
            <div className="space-y-4">
               <input type="text" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} placeholder="Tên món" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none focus:border-orange-500" />
               <input type="number" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: Number(e.target.value)})} placeholder="Giá bán (VND)" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none focus:border-orange-500" />
               <select value={menuForm.category || 'Tất cả'} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none">
                  {INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <input type="text" value={menuForm.image || ''} onChange={e => setMenuForm({...menuForm, image: e.target.value})} placeholder="Link hình ảnh (URL)" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none" />
               <textarea value={menuForm.description || ''} onChange={e => setMenuForm({...menuForm, description: e.target.value})} placeholder="Mô tả món ăn..." className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none h-24" />
            </div>
            <div className="flex gap-3 pt-4">
               <button onClick={() => setMenuForm(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs text-slate-400">Huỷ</button>
               <button onClick={saveMenuItem} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg">Lưu lại</button>
            </div>
          </div>
        </div>
      )}

      {/* User Edit Modal */}
      {userForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-4 animate-scaleIn border border-slate-100">
            <h3 className="font-black uppercase italic text-lg text-slate-800 mb-6">{userForm.id ? 'Sửa nhân viên' : 'Thêm nhân viên'}</h3>
            <div className="space-y-4">
               <input type="text" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} placeholder="Họ và tên" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none" />
               <input type="text" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} placeholder="Username" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none" />
               <input type="password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="Mật khẩu" className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none" />
               <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl font-bold border border-slate-100 outline-none">
                  <option value={UserRole.STAFF}>Phục vụ</option>
                  <option value={UserRole.KITCHEN}>Bếp</option>
                  <option value={UserRole.ADMIN}>Quản lý</option>
               </select>
            </div>
            <div className="flex gap-3 pt-4">
               <button onClick={() => setUserForm(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs text-slate-400">Huỷ</button>
               <button onClick={saveUser} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg">Lưu nhân sự</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal 
        isOpen={resetTableId !== null} 
        type="danger" 
        title="Dọn sạch bàn?" 
        message={`Dữ liệu bàn ${resetTableId} sẽ bị xóa sạch, bàn sẽ trở về trạng thái Trống.`} 
        onConfirm={() => resetTableId !== null && store.adminForceClose(resetTableId)} 
        onCancel={() => setResetTableId(null)} 
      />

      <ConfirmModal 
        isOpen={deleteTarget !== null} 
        type="danger" 
        title="Xác nhận xóa?" 
        message={`Bạn có chắc chắn muốn xóa "${deleteTarget?.name}" không? Thao tác này không thể hoàn tác.`} 
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
