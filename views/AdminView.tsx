
import React, { useState, useMemo } from 'react'; 
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType, OrderItem } from '../types';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';
import { ConfirmModal } from '../App';
import { 
  Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, CreditCard, Star, Award, TrendingUp,
  Database, CheckCircle, RotateCcw, DollarSign, Search, FileText, 
  ArrowUpRight, ArrowDownRight, UserCheck, AlertTriangle, QrCode, MoveHorizontal, Merge, Sparkles, ChevronRight, MessageSquare, Target, ChefHat
} from 'lucide-react';
import { ensureArray } from '../store.ts';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'BILLING' | 'REQUESTS' | 'MONITOR' | 'MENU' | 'USERS' | 'BANK' | 'CLOUD' | 'KPI'>('DASHBOARD');
  const [tempTableCount, setTempTableCount] = useState(store.tables.length - 1);
  const [resetTableId, setResetTableId] = useState<number | null>(null);
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [historySearch, setHistorySearch] = useState('');

  const qrRequests = useMemo(() => ensureArray<AppNotification>(store.notifications).filter((n: AppNotification) => n.type === 'qr_request'), [store.notifications]);
  const moveRequests = useMemo(() => ensureArray<AppNotification>(store.notifications).filter((n: AppNotification) => n.type === 'move_request'), [store.notifications]);
  const paymentRequests = useMemo(() => (store.tables || []).filter((t: Table) => t.status === TableStatus.PAYING), [store.tables]);

  const stats = useMemo(() => {
    const history = ensureArray<HistoryEntry>(store.history);
    const reviews = ensureArray<Review>(store.reviews);
    const todayStr = new Date().toLocaleDateString();
    
    const todayBills = history.filter(h => new Date(h.date).toLocaleDateString() === todayStr);
    const todayRevenue = todayBills.reduce((sum, h) => sum + (h.total || 0), 0);
    
    let totalLoss = history.reduce((sum, h) => {
        const cancelledSum = ensureArray<OrderItem>(h.items).filter(i => i.status === OrderItemStatus.CANCELLED).reduce((s, i) => s + (i.price * i.quantity), 0);
        return sum + cancelledSum;
    }, 0);

    store.tables.forEach((t: Table) => {
      const cancelledInProgress = ensureArray<OrderItem>(t.currentOrders)
        .filter(i => i.status === OrderItemStatus.CANCELLED)
        .reduce((s, i) => s + (i.price * i.quantity), 0);
      totalLoss += cancelledInProgress;
    });

    const itemMap: Record<string, {name: string, qty: number}> = {};
    history.forEach(h => {
      ensureArray<OrderItem>(h.items).filter(i => i && i.status !== OrderItemStatus.CANCELLED).forEach(i => {
        if (!itemMap[i.menuItemId]) itemMap[i.menuItemId] = { name: i.name, qty: 0 };
        itemMap[i.menuItemId].qty += i.quantity;
      });
    });
    const topItems = Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 5);

    const staffKPI = ensureArray<User>(store.users).filter(u => u.role === UserRole.STAFF).map(u => {
       const userBills = history.filter(h => h.staffId === u.id);
       const revenue = userBills.reduce((s, h) => s + h.total, 0);
       const userReviews = reviews.filter(r => r.staffId === u.id);
       const avgRating = userReviews.length > 0 ? (userReviews.reduce((s, r) => s + (r.ratingFood + r.ratingService)/2, 0) / userReviews.length).toFixed(1) : 'N/A';
       return { ...u, revenue, billCount: userBills.length, avgRating };
    });

    const kitchenKPI = ensureArray<User>(store.users).filter(u => u.role === UserRole.KITCHEN).map(u => {
        let totalItems = 0;
        history.forEach(h => {
            totalItems += ensureArray<OrderItem>(h.items).filter(i => i.kitchenStaffId === u.id && i.status !== OrderItemStatus.CANCELLED).length;
        });
        return { ...u, totalItems };
    });

    return { todayRevenue, totalLoss, topItems, totalBills: history.length, todayBillsCount: todayBills.length, staffKPI, kitchenKPI };
  }, [store.history, store.tables, store.users, store.reviews]);

  const filteredHistory = useMemo(() => {
    const history = ensureArray<HistoryEntry>(store.history);
    return history.filter(h => 
      (h.id && h.id.toLowerCase().includes(historySearch.toLowerCase())) || 
      (h.tableId !== undefined && h.tableId.toString() === historySearch) ||
      (h.staffId && h.staffId.toLowerCase().includes(historySearch.toLowerCase()))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [store.history, historySearch]);

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
    <div className="h-full flex flex-col animate-fadeIn overflow-hidden relative pb-16 md:pb-0">
      <ConfirmModal isOpen={resetTableId !== null} type="danger" title="Reset bàn?" message={`Xác nhận xóa dữ liệu và giải phóng bàn ${resetTableId}?`} onConfirm={() => { if(resetTableId !== null) store.adminForceClose(resetTableId); setResetTableId(null); }} onCancel={() => setResetTableId(null)} />
      
      <div className="flex bg-white p-1.5 rounded-2xl mb-6 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Báo cáo', icon: <LayoutDashboard size={16}/> },
          { id: 'BILLING', label: 'Bill', icon: <FileText size={16}/> },
          { id: 'REQUESTS', label: 'Duyệt', icon: <CheckCircle size={16}/>, count: qrRequests.length + moveRequests.length + paymentRequests.length },
          { id: 'KPI', label: 'KPI', icon: <Target size={16}/> },
          { id: 'MONITOR', label: 'Sơ đồ', icon: <Monitor size={16}/> },
          { id: 'MENU', label: 'Món ăn', icon: <Pizza size={16}/> },
          { id: 'USERS', label: 'Nhân sự', icon: <Shield size={16}/> },
          { id: 'BANK', label: 'Bank', icon: <CreditCard size={16}/> },
          { id: 'CLOUD', label: 'Hệ thống', icon: <Settings size={16}/> }
        ].map((tab: any) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.icon} <span className="hidden sm:inline">{tab.label}</span> 
            {tab.count > 0 && <span className="bg-red-500 text-white min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] px-1 animate-pulse border-2 border-white">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-6 animate-slideUp px-1 pb-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                    <TrendingUp className="absolute top-4 right-4 text-slate-100" size={48}/>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Doanh thu hôm nay</p>
                    <h3 className="text-2xl font-black text-slate-800 italic">{stats.todayRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2.5rem] border-rose-50 border-2 shadow-sm relative overflow-hidden">
                    <AlertTriangle className="absolute top-4 right-4 text-rose-50" size={48}/>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 italic">Thất thoát (Hủy món)</p>
                    <h3 className="text-2xl font-black text-rose-600 italic">{stats.totalLoss.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden text-white">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 italic">Tổng đơn (Hệ thống)</p>
                    <h3 className="text-2xl font-black italic">{stats.totalBills.toLocaleString()} đơn</h3>
                 </div>
                 <div className="bg-orange-500 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden text-white">
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-2 italic">Bàn đang mở</p>
                    <h3 className="text-2xl font-black italic">{store.tables.filter((t:Table)=>t.status !== TableStatus.AVAILABLE).length} bàn</h3>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    <h4 className="font-black text-[11px] uppercase italic mb-8 flex items-center gap-2 tracking-widest text-slate-800"><Award className="text-orange-500" size={18}/> Top món bán chạy</h4>
                    <div className="space-y-4">
                        {stats.topItems.map((item, idx) => (
                           <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                              <p className="text-[11px] font-black uppercase text-slate-800 italic">{item.name}</p>
                              <span className="text-[11px] font-black text-orange-600">{item.qty} suất</span>
                           </div>
                        ))}
                    </div>
                 </div>
                 <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                    <h4 className="font-black text-[11px] uppercase italic mb-8 flex items-center gap-2 tracking-widest text-slate-800"><UserCheck className="text-blue-500" size={18}/> Sơ lược phục vụ</h4>
                    <div className="space-y-4">
                        {stats.staffKPI.slice(0, 3).map((u, idx) => (
                           <div key={idx} className="p-4 bg-slate-50 rounded-2xl flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                 <p className="text-[11px] font-black uppercase text-slate-800">{u.fullName}</p>
                                 <span className="text-[11px] font-black text-blue-600 italic">{u.revenue.toLocaleString()}đ</span>
                              </div>
                           </div>
                        ))}
                        <button onClick={() => setActiveTab('KPI')} className="w-full py-3 text-[9px] font-black uppercase text-slate-400 hover:text-slate-900 transition-colors italic">Xem chi tiết KPI →</button>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'KPI' && (
           <div className="space-y-8 animate-slideUp px-1 pb-10">
              <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-[11px] uppercase italic mb-8 flex items-center gap-2 tracking-widest text-slate-800"><Target className="text-blue-500" size={18}/> Hiệu quả nhân viên Phục vụ</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.staffKPI.map((u, idx) => (
                       <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                             <div>
                                <p className="text-[12px] font-black text-slate-800 uppercase italic">{u.fullName}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: {u.username}</p>
                             </div>
                             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm"><UserCheck size={20}/></div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                             <div className="bg-white p-3 rounded-xl">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Doanh thu</p>
                                <p className="text-[11px] font-black text-slate-900">{u.revenue.toLocaleString()}đ</p>
                             </div>
                             <div className="bg-white p-3 rounded-xl">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Số đơn</p>
                                <p className="text-[11px] font-black text-slate-900">{u.billCount} đơn</p>
                             </div>
                          </div>
                          <div className="bg-orange-500 text-white p-3 rounded-xl flex justify-between items-center">
                             <span className="text-[9px] font-black uppercase">Điểm trung bình</span>
                             <span className="text-sm font-black flex items-center gap-1 italic"><Star size={14} fill="currentColor"/> {u.avgRating}</span>
                          </div>
                       </div>
                    ))}
                 </div>
              </section>

              <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-[11px] uppercase italic mb-8 flex items-center gap-2 tracking-widest text-slate-800"><ChefHat className="text-orange-500" size={18}/> Hiệu quả nhân viên Bếp</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.kitchenKPI.map((u, idx) => (
                       <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                             <div>
                                <p className="text-[12px] font-black text-slate-800 uppercase italic">{u.fullName}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID: {u.username}</p>
                             </div>
                             <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-500 shadow-sm"><ChefHat size={20}/></div>
                          </div>
                          <div className="bg-white p-4 rounded-xl text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase italic mb-1">Tổng món đã hoàn thành</p>
                                <p className="text-3xl font-black text-slate-900 italic">{u.totalItems} món</p>
                          </div>
                       </div>
                    ))}
                 </div>
              </section>

              <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-[11px] uppercase italic mb-8 flex items-center gap-2 tracking-widest text-slate-800"><MessageSquare className="text-orange-500" size={18}/> Phản hồi chi tiết từ khách hàng</h4>
                 <div className="space-y-4">
                    {ensureArray<Review>(store.reviews).length === 0 ? (
                       <div className="py-20 text-center">
                          <MessageSquare className="mx-auto text-slate-100 mb-4" size={48}/>
                          <p className="text-[10px] font-black uppercase text-slate-300 italic">Chưa có đánh giá nào từ khách hàng</p>
                       </div>
                    ) : (
                       ensureArray<Review>(store.reviews).map((r: Review) => (
                          <div key={r.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-4">
                             <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                   <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic text-xs">B{r.tableId}</div>
                                   <div>
                                      <p className="text-[10px] font-black uppercase text-slate-800 italic">Bàn số {r.tableId}</p>
                                      <p className="text-[8px] font-bold text-slate-400">{new Date(r.timestamp).toLocaleString()}</p>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Nhân viên phục vụ</p>
                                   <p className="text-[10px] font-black text-slate-800 uppercase italic">{ensureArray<User>(store.users).find(u=>u.id===r.staffId)?.fullName || 'Hệ thống'}</p>
                                </div>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-white rounded-2xl flex flex-col gap-1">
                                   <p className="text-[8px] font-black uppercase text-slate-400">Món ăn</p>
                                   <div className="flex gap-0.5 text-orange-500">
                                      {Array.from({length: 5}).map((_, i) => <Star key={i} size={10} fill={i < r.ratingFood ? "currentColor" : "none"} className={i < r.ratingFood ? "" : "text-slate-200"}/>)}
                                   </div>
                                </div>
                                <div className="p-3 bg-white rounded-2xl flex flex-col gap-1">
                                   <p className="text-[8px] font-black uppercase text-slate-400">Dịch vụ</p>
                                   <div className="flex gap-0.5 text-blue-500">
                                      {Array.from({length: 5}).map((_, i) => <Star key={i} size={10} fill={i < r.ratingService ? "currentColor" : "none"} className={i < r.ratingService ? "" : "text-slate-200"}/>)}
                                   </div>
                                </div>
                             </div>
                             {r.comment && (
                                <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                                   <p className="text-[11px] font-bold text-slate-700 italic">"{r.comment}"</p>
                                </div>
                             )}
                          </div>
                       ))
                    )}
                 </div>
              </section>
           </div>
        )}

        {activeTab === 'BILLING' && (
           <div className="space-y-6 animate-slideUp px-1 pb-10">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <h4 className="font-black text-[11px] uppercase italic tracking-widest text-slate-800">Kiểm soát hóa đơn</h4>
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input type="text" placeholder="Tìm ID bill, bàn..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="w-full sm:w-80 pl-12 pr-6 py-3.5 bg-slate-50 rounded-2xl text-xs font-bold outline-none border border-slate-100" />
                    </div>
                 </div>
                 <div className="space-y-4 overflow-x-auto no-scrollbar">
                    <table className="w-full text-left min-w-[500px]">
                       <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                          <tr><th className="pb-4 pl-4">Hóa Đơn</th><th className="pb-4">Bàn</th><th className="pb-4">Phục vụ</th><th className="pb-4 text-right pr-4">Tổng tiền</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {filteredHistory.map((h: HistoryEntry) => (
                             <tr key={h.id} className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                                <td className="py-4 pl-4 font-black text-[10px] uppercase italic">#{h.id.slice(-6)}</td>
                                <td className="py-4 font-black text-[10px]">{h.tableId === 0 ? 'Lẻ' : h.tableId}</td>
                                <td className="py-4 text-[10px] uppercase font-bold text-slate-400">{ensureArray<User>(store.users).find(u=>u.id===h.staffId)?.fullName || 'System'}</td>
                                <td className="py-4 text-right pr-4 font-black text-[11px] text-slate-900">{h.total.toLocaleString()}đ</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'REQUESTS' && (
           <div className="space-y-8 animate-slideUp px-1 pb-10">
              <section>
                 <h4 className="font-black text-[10px] uppercase italic tracking-widest text-slate-400 mb-4 flex items-center gap-2"><QrCode size={14}/> Yêu cầu mở bàn ({qrRequests.length})</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {qrRequests.map(n => (
                       <div key={n.id} className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                             <div className="w-12 h-12 bg-orange-500 text-white rounded-2xl flex items-center justify-center font-black text-xl italic shadow-lg">B{n.payload.tableId}</div>
                             <div className="text-right">
                                <p className="text-[10px] font-black uppercase text-slate-800">Nhân viên:</p>
                                <p className="text-[9px] font-bold text-slate-400">{ensureArray<User>(store.users).find(u=>u.id===n.payload.staffId)?.fullName}</p>
                             </div>
                          </div>
                          <button onClick={() => store.approveTableQr(n.id)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg italic">Cấp mã QR</button>
                       </div>
                    ))}
                    {qrRequests.length === 0 && <p className="text-[10px] font-black uppercase italic text-slate-300 py-6">Không có yêu cầu mở bàn</p>}
                 </div>
              </section>

              <section>
                 <h4 className="font-black text-[10px] uppercase italic tracking-widest text-slate-400 mb-4 flex items-center gap-2"><MoveHorizontal size={14}/> Chuyển/Gộp bàn ({moveRequests.length})</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {moveRequests.map(n => (
                       <div key={n.id} className="bg-white p-5 rounded-3xl border-2 border-slate-100 shadow-sm flex flex-col gap-4">
                          <div className="flex items-center gap-4">
                             <div className="flex-1 p-3 bg-slate-50 rounded-xl text-center">
                                <span className="text-[8px] font-black uppercase text-slate-400">Từ</span>
                                <p className="text-sm font-black text-slate-800">Bàn {n.payload.fromId}</p>
                             </div>
                             <ChevronRight className="text-slate-300"/>
                             <div className="flex-1 p-3 bg-slate-900 rounded-xl text-center text-white">
                                <span className="text-[8px] font-black uppercase text-white/40">Tới</span>
                                <p className="text-sm font-black">Bàn {n.payload.toId}</p>
                             </div>
                          </div>
                          <button onClick={() => store.approveTableMove(n.id)} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg italic">Xác nhận chuyển/gộp</button>
                       </div>
                    ))}
                    {moveRequests.length === 0 && <p className="text-[10px] font-black uppercase italic text-slate-300 py-6">Không có yêu cầu chuyển bàn</p>}
                 </div>
              </section>

              <section>
                 <h4 className="font-black text-[10px] uppercase italic tracking-widest text-slate-400 mb-4 flex items-center gap-2"><DollarSign size={14}/> Chờ thu tiền ({paymentRequests.length})</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {paymentRequests.map(t => (
                       <div key={t.id} className="bg-white p-5 rounded-3xl border-2 border-emerald-100 bg-emerald-50/20 flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                             <p className="text-sm font-black text-slate-800 italic uppercase">Bàn {t.id}</p>
                             <p className="text-sm font-black text-emerald-600">{ensureArray<OrderItem>(t.currentOrders).reduce((s,o)=>s+(o.price*o.quantity),0).toLocaleString()}đ</p>
                          </div>
                          <button onClick={() => store.confirmPayment(t.id)} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg italic">Đã nhận đủ tiền</button>
                       </div>
                    ))}
                    {paymentRequests.length === 0 && <p className="text-[10px] font-black uppercase italic text-slate-300 py-6">Không có yêu cầu thanh toán</p>}
                 </div>
              </section>
           </div>
        )}

        {activeTab === 'MONITOR' && (
           <div className="space-y-6 animate-slideUp px-1 pb-10">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                 {store.tables.map((t: Table) => (
                    <div key={t.id} className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center gap-1 transition-all relative min-h-[100px] ${
                      t.status === TableStatus.AVAILABLE ? 'border-dashed border-slate-200 bg-white opacity-50' : 
                      t.status === TableStatus.PAYING ? 'border-emerald-500 bg-emerald-50 text-emerald-600 animate-pulse' :
                      t.status === TableStatus.CLEANING ? 'border-amber-400 bg-amber-50 text-amber-600' :
                      'border-slate-800 bg-slate-900 text-white shadow-md'
                    }`}>
                        <span className="text-[10px] font-black uppercase italic">{t.id === 0 ? 'Lẻ' : 'Bàn '+t.id}</span>
                        {t.status === TableStatus.AVAILABLE ? <RotateCcw size={16} className="text-slate-300"/> : <CheckCircle size={16} className="text-orange-500"/>}
                        <p className="text-[8px] font-bold uppercase opacity-60 truncate max-w-full">{ensureArray<User>(store.users).find(u=>u.id===t.claimedBy)?.fullName || (t.status === TableStatus.AVAILABLE ? '' : '...')}</p>
                        
                        {! (t.status === TableStatus.AVAILABLE) && (
                           <button onClick={(e) => { e.stopPropagation(); setResetTableId(t.id); }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg"><X size={12}/></button>
                        )}
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'MENU' && (
           <div className="space-y-6 animate-slideUp px-1 pb-10">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <h4 className="font-black text-[11px] uppercase italic tracking-widest text-slate-800">Quản lý thực đơn</h4>
                    <button onClick={() => setMenuForm({})} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg"><Plus size={16}/> Thêm món</button>
                 </div>

                 {menuForm && (
                    <div className="bg-slate-50 p-6 rounded-3xl mb-8 space-y-4 border border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input type="text" placeholder="Tên món" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} className="px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none font-bold text-xs" />
                            <input type="number" placeholder="Giá tiền" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: parseInt(e.target.value)})} className="px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none font-bold text-xs" />
                        </div>
                        <select value={menuForm.category || 'Tất cả'} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none font-bold text-xs uppercase">
                            {INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="flex gap-3">
                            <button onClick={saveMenuItem} className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-black uppercase text-[10px]">Lưu món</button>
                            <button onClick={() => setMenuForm(null)} className="px-8 py-4 bg-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Hủy</button>
                        </div>
                    </div>
                 )}

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {store.menu.map((m: MenuItem) => (
                       <div key={m.id} className="p-4 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-3">
                             <img src={m.image} className="w-12 h-12 rounded-xl object-cover" />
                             <div>
                                <h5 className="text-[11px] font-black uppercase text-slate-800">{m.name}</h5>
                                <p className="text-[9px] font-bold text-orange-600 italic">{m.price.toLocaleString()}đ</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <button onClick={() => setMenuForm(m)} className="p-2 text-blue-500 bg-blue-50 rounded-xl"><Edit3 size={14}/></button>
                             <button onClick={() => store.deleteMenuItem(m.id)} className="p-2 text-red-500 bg-red-50 rounded-xl"><Trash2 size={14}/></button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'USERS' && (
           <div className="space-y-6 animate-slideUp px-1 pb-10">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <h4 className="font-black text-[11px] uppercase italic tracking-widest text-slate-800">Quản lý nhân sự</h4>
                    <button onClick={() => setUserForm({})} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg"><UserPlus size={16}/> Thêm NV</button>
                 </div>

                 {userForm && (
                    <div className="bg-slate-50 p-6 rounded-3xl mb-8 space-y-4 border border-slate-200">
                        <input type="text" placeholder="Họ và tên" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none font-bold text-xs" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input type="text" placeholder="Username" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} className="px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none font-bold text-xs" />
                            <input type="password" placeholder="Password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} className="px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none font-bold text-xs" />
                        </div>
                        <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none font-bold text-xs uppercase">
                            <option value={UserRole.STAFF}>Phục vụ</option>
                            <option value={UserRole.KITCHEN}>Bếp</option>
                            <option value={UserRole.ADMIN}>Quản lý</option>
                        </select>
                        <div className="flex gap-3">
                            <button onClick={saveUser} className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px]">Tạo tài khoản</button>
                            <button onClick={() => setUserForm(null)} className="px-8 py-4 bg-slate-200 text-slate-500 rounded-2xl font-black uppercase text-[10px]">Hủy</button>
                        </div>
                    </div>
                 )}

                 <div className="space-y-4">
                    {store.users.map((u: User) => (
                       <div key={u.id} className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-black">#</div>
                             <div>
                                <h5 className="text-[11px] font-black uppercase text-slate-800">{u.fullName}</h5>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{u.role} - ID: {u.username}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <button onClick={() => setUserForm(u)} className="p-2 text-blue-500 bg-blue-50 rounded-xl"><Edit3 size={14}/></button>
                             <button onClick={() => store.deleteUser(u.id)} className="p-2 text-red-500 bg-red-50 rounded-xl"><Trash2 size={14}/></button>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'BANK' && (
           <div className="space-y-6 animate-slideUp px-1 pb-10">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm max-w-xl">
                 <h4 className="font-black text-[11px] uppercase italic tracking-widest text-slate-800 mb-8">Cấu hình VietQR</h4>
                 <div className="space-y-6">
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 italic mb-2 block">Tên ngân hàng (VietQR ID)</label>
                        <input type="text" value={store.bankConfig.bankId} onChange={e => store.updateBankConfig({...store.bankConfig, bankId: e.target.value})} placeholder="VD: ICB, VCB..." className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm uppercase" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 italic mb-2 block">Số tài khoản</label>
                        <input type="text" value={store.bankConfig.accountNo} onChange={e => store.updateBankConfig({...store.bankConfig, accountNo: e.target.value})} className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 italic mb-2 block">Tên chủ tài khoản</label>
                        <input type="text" value={store.bankConfig.accountName} onChange={e => store.updateBankConfig({...store.bankConfig, accountName: e.target.value})} className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm uppercase" />
                    </div>
                    <div className="p-6 bg-blue-50 rounded-2xl flex items-start gap-4">
                        <CreditCard className="text-blue-500 shrink-0" size={24}/>
                        <p className="text-[10px] text-blue-800 font-bold leading-relaxed uppercase italic">Mã QR thanh toán sẽ được tạo tự động cho khách hàng dựa trên hóa đơn hiện tại của họ.</p>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'CLOUD' && (
           <div className="space-y-6 animate-slideUp px-1 pb-10">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm max-w-xl">
                 <h4 className="font-black text-[11px] uppercase italic tracking-widest text-slate-800 mb-8">Cấu hình hệ thống</h4>
                 <div className="space-y-8">
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 italic mb-4 block">Số lượng bàn ({tempTableCount})</label>
                        <div className="flex items-center gap-4">
                            <input type="range" min="1" max="50" value={tempTableCount} onChange={e => setTempTableCount(parseInt(e.target.value))} className="flex-1 accent-slate-900" />
                            <button onClick={() => store.updateTableCount(tempTableCount)} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">Áp dụng</button>
                        </div>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 italic mb-2 block">Database URL (Firebase)</label>
                        <input type="text" value={store.cloudUrl} onChange={e => store.updateCloudUrl(e.target.value)} className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-[10px] text-blue-600 italic" />
                    </div>
                    <div className="pt-8 border-t border-slate-100 flex gap-4">
                        <button onClick={() => store.clearHistory()} className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-[10px] italic border border-red-100">Xóa sạch History</button>
                        <button onClick={() => store.clearReviews()} className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px] italic border border-slate-100">Xóa sạch Review</button>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default AdminView;
