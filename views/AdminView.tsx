
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType, OrderItem } from '../types';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';
import { ConfirmModal } from '../App';
import { 
  Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, CreditCard, Star, Award, TrendingUp,
  Database, CheckCircle, RotateCcw, DollarSign, Search, FileText, 
  ArrowUpRight, ArrowDownRight, UserCheck, AlertTriangle, QrCode
} from 'lucide-react';
import { ensureArray } from '../store.ts';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'BILLING' | 'REQUESTS' | 'MONITOR' | 'MENU' | 'USERS' | 'BANK' | 'CLOUD'>('DASHBOARD');
  const [tempTableCount, setTempTableCount] = useState(store.tables.length - 1);
  const [resetTableId, setResetTableId] = useState<number | null>(null);
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<HistoryEntry | null>(null);

  const qrRequests = useMemo(() => ensureArray<AppNotification>(store.notifications).filter((n: AppNotification) => n.type === 'qr_request'), [store.notifications]);
  const moveRequests = useMemo(() => ensureArray<AppNotification>(store.notifications).filter((n: AppNotification) => n.type === 'move_request'), [store.notifications]);
  const paymentRequests = useMemo(() => (store.tables || []).filter((t: Table) => t.status === TableStatus.PAYING), [store.tables]);

  const stats = useMemo(() => {
    const history = ensureArray<HistoryEntry>(store.history);
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

    return { todayRevenue, totalLoss, topItems, totalBills: history.length, todayBillsCount: todayBills.length };
  }, [store.history, store.tables]);

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
      <div className="flex bg-white p-1.5 rounded-2xl mb-6 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Báo cáo', icon: <LayoutDashboard size={16}/> },
          { id: 'BILLING', label: 'Kiểm Bill', icon: <FileText size={16}/> },
          { id: 'REQUESTS', label: 'Duyệt', icon: <CheckCircle size={16}/>, count: qrRequests.length + moveRequests.length + paymentRequests.length },
          { id: 'MONITOR', label: 'Sơ đồ', icon: <Monitor size={16}/> },
          { id: 'MENU', label: 'Món ăn', icon: <Pizza size={16}/> },
          { id: 'USERS', label: 'Nhân sự', icon: <Shield size={16}/> },
          { id: 'BANK', label: 'Bank', icon: <CreditCard size={16}/> },
          { id: 'CLOUD', label: 'Cloud', icon: <Settings size={16}/> }
        ].map((tab: any) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.icon} <span className="hidden sm:inline">{tab.label}</span> 
            {tab.count > 0 && <span className="bg-red-500 text-white min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] px-1 animate-pulse border-2 border-white">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-6 animate-slideUp px-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={64}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 italic">Doanh thu hôm nay</p>
                    <h3 className="text-2xl font-black text-slate-800 italic flex items-center gap-2">
                        {stats.todayRevenue.toLocaleString()}đ
                        <span className="text-green-500 bg-green-50 p-1 rounded-full"><ArrowUpRight size={14}/></span>
                    </h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2.5rem] border-rose-50 border-2 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><AlertTriangle size={64} className="text-rose-500"/></div>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-2 italic">Thất thoát (Hủy món)</p>
                    <h3 className="text-2xl font-black text-rose-600 italic flex items-center gap-2">
                        {stats.totalLoss.toLocaleString()}đ
                        <span className="text-rose-500 bg-rose-50 p-1 rounded-full"><ArrowDownRight size={14}/></span>
                    </h3>
                 </div>
                 <div className="bg-slate-900 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden text-white group">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 italic">Tổng đơn chốt</p>
                    <h3 className="text-2xl font-black italic">{stats.totalBills.toLocaleString()} đơn</h3>
                 </div>
                 <div className="bg-orange-500 p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden text-white group">
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em] mb-2 italic">Bàn đang mở</p>
                    <h3 className="text-2xl font-black italic">{store.tables.filter((t:Table)=>t.status !== TableStatus.AVAILABLE).length} bàn</h3>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
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
                    <h4 className="font-black text-[11px] uppercase italic mb-8 flex items-center gap-2 tracking-widest text-slate-800"><UserCheck className="text-blue-500" size={18}/> Hiệu suất nhân viên</h4>
                    <div className="space-y-4">
                        {ensureArray<User>(store.users).filter(u => u.role === UserRole.STAFF).map((u, idx) => {
                           const sales = ensureArray<HistoryEntry>(store.history).filter(h => h.staffId === u.id).reduce((s, h) => s + h.total, 0);
                           return (
                              <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                 <p className="text-[11px] font-black uppercase text-slate-800">{u.fullName}</p>
                                 <span className="text-[11px] font-black text-blue-600 italic">{sales.toLocaleString()}đ</span>
                              </div>
                           );
                        })}
                    </div>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'BILLING' && (
           <div className="space-y-6 animate-slideUp px-1">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <h4 className="font-black text-[11px] uppercase italic tracking-widest text-slate-800">Kiểm soát hóa đơn</h4>
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                        <input type="text" placeholder="Tìm ID bill, bàn..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="w-full sm:w-80 pl-12 pr-6 py-3.5 bg-slate-50 rounded-2xl text-xs font-bold outline-none border border-slate-100" />
                    </div>
                 </div>
                 <div className="space-y-4 overflow-x-auto no-scrollbar">
                    <table className="w-full text-left">
                       <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                          <tr><th className="pb-4 pl-4">Hóa Đơn</th><th className="pb-4">Bàn</th><th className="pb-4">Nhân viên</th><th className="pb-4 text-right pr-4">Tổng tiền</th></tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {filteredHistory.map((h: HistoryEntry) => (
                             <tr key={h.id} onClick={() => setSelectedHistory(h)} className="hover:bg-slate-50/50 cursor-pointer transition-colors">
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
           <div className="space-y-6 animate-slideUp px-1 pb-10">
              <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-[11px] uppercase italic mb-8 tracking-widest text-slate-800 flex items-center gap-2"><CheckCircle className="text-emerald-500" size={18}/> Yêu cầu chờ xử lý</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paymentRequests.map((t: Table) => (
                        <div key={`pay-${t.id}`} className="p-6 rounded-[2rem] bg-emerald-50/50 border border-emerald-100 flex items-center justify-between group hover:bg-emerald-50 transition-all">
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-800 italic">Bàn {t.id === 0 ? 'Lẻ' : t.id} yêu cầu tính tiền</p>
                                <p className="text-[13px] font-black text-emerald-600 mt-0.5">Tạm tính: {ensureArray<OrderItem>(t.currentOrders).filter(o => o.status !== OrderItemStatus.CANCELLED).reduce((s,o) => s + (o.price * o.quantity), 0).toLocaleString()}đ</p>
                            </div>
                            <button onClick={() => store.confirmPayment(t.id)} className="bg-emerald-600 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase italic shadow-xl shadow-emerald-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"><DollarSign size={14}/> Chốt Bill</button>
                        </div>
                    ))}
                    {qrRequests.map((n: AppNotification) => (
                        <div key={n.id} className="p-6 rounded-[2rem] bg-orange-50/50 border border-orange-100 flex items-center justify-between group hover:bg-orange-50 transition-all">
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-800 italic">Mở QR Bàn {n.payload.tableId}</p>
                                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">NV: {ensureArray<User>(store.users).find(u=>u.id===n.payload.staffId)?.fullName || 'Staff'}</p>
                            </div>
                            <button onClick={() => store.approveTableQr(n.id)} className="bg-orange-500 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase italic shadow-xl shadow-orange-100 hover:scale-105 active:scale-95 transition-all">Duyệt mở</button>
                        </div>
                    ))}
                    {moveRequests.map((n: AppNotification) => (
                        <div key={n.id} className="p-6 rounded-[2rem] bg-blue-50/50 border border-blue-100 flex items-center justify-between group hover:bg-blue-50 transition-all">
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-800 italic">Lệnh: Bàn {n.payload.fromId} {'->'} {n.payload.toId}</p>
                                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Yêu cầu chuyển/gộp</p>
                            </div>
                            <button onClick={() => store.approveTableMove(n.id)} className="bg-blue-500 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase italic shadow-xl shadow-blue-100 hover:scale-105 active:scale-95 transition-all">Duyệt lệnh</button>
                        </div>
                    ))}
                 </div>
              </section>
           </div>
        )}

        {activeTab === 'MONITOR' && (
          <div className="space-y-6 animate-slideUp px-1 pb-10">
             <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
                   <h4 className="font-black text-[11px] uppercase italic tracking-widest text-slate-800">Quản lý sơ đồ bàn</h4>
                   <div className="flex gap-2 w-full sm:w-auto">
                      <input type="number" value={tempTableCount} onChange={e => setTempTableCount(parseInt(e.target.value))} className="w-20 px-4 py-3 bg-slate-50 rounded-xl font-bold outline-none border border-slate-100" />
                      <button onClick={() => store.updateTableCount(tempTableCount)} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase italic shadow-lg active:scale-95">Lưu số bàn</button>
                   </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                   {ensureArray<Table>(store.tables).map(t => (
                      <div key={t.id} className={`p-6 rounded-[2rem] border-2 flex flex-col items-center gap-2 relative transition-all ${t.status === TableStatus.AVAILABLE ? 'bg-slate-50 border-slate-100 border-dashed' : 'bg-slate-900 text-white border-slate-800 shadow-lg scale-[1.02]'}`}>
                         <span className="text-[11px] font-black uppercase italic">{t.id === 0 ? 'Khách lẻ' : 'Bàn '+t.id}</span>
                         <span className="text-[8px] font-bold uppercase opacity-50 px-2 py-0.5 rounded-full border border-current">{t.status}</span>
                         {t.status !== TableStatus.AVAILABLE && (
                            <button onClick={() => setResetTableId(t.id)} className="absolute -top-1 -right-1 bg-red-500 text-white p-2 rounded-xl shadow-xl hover:scale-110 active:scale-90 transition-transform"><RotateCcw size={12}/></button>
                         )}
                      </div>
                   ))}
                </div>
             </div>
          </div>
        )}

        {/* User and Menu Management omitted for brevity but should be restored similarly to Dashboard tabs */}
        {activeTab === 'MENU' && (
           <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm mx-1">
              <div className="flex justify-between items-center mb-8">
                 <h4 className="font-black text-[11px] uppercase italic tracking-widest text-slate-800">Thực đơn nhà hàng</h4>
                 <button onClick={() => setMenuForm({})} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 italic shadow-lg active:scale-95"><Plus size={16}/> Thêm món</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {ensureArray<MenuItem>(store.menu).map((m: MenuItem) => (
                      <div key={m.id} className="p-4 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col gap-4 relative group">
                          <img src={m.image} className="w-full h-32 rounded-2xl object-cover shadow-sm group-hover:scale-105 transition-transform duration-500"/>
                          <div className="flex-1 flex flex-col justify-between">
                              <div>
                                  <p className="text-[11px] font-black uppercase text-slate-800 truncate mb-1">{m.name}</p>
                                  <p className="text-[11px] font-black text-orange-600 italic">{m.price.toLocaleString()}đ</p>
                              </div>
                              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200/50">
                                  <button onClick={() => setMenuForm(m)} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-sm hover:text-slate-800"><Edit3 size={14}/></button>
                                  <button onClick={() => store.deleteMenuItem(m.id)} className="p-2.5 bg-white text-rose-500 rounded-xl shadow-sm hover:bg-rose-50"><Trash2 size={14}/></button>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
           </div>
        )}

        {activeTab === 'USERS' && (
           <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm mx-1">
              <div className="flex justify-between items-center mb-8">
                 <h4 className="font-black text-[11px] uppercase italic tracking-widest text-slate-800">Quản lý nhân sự</h4>
                 <button onClick={() => setUserForm({})} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 italic shadow-lg active:scale-95"><UserPlus size={16}/> Thêm mới</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ensureArray<User>(store.users).map((u: User) => (
                     <div key={u.id} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-between group hover:border-slate-300 transition-all">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center font-black text-lg italic shadow-sm">{u.fullName.charAt(0)}</div>
                           <div>
                              <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-1.5">{u.fullName}</p>
                              <p className="text-[9px] font-black text-slate-400 uppercase italic tracking-widest flex items-center gap-1.5"><Shield size={10}/> {u.role}</p>
                           </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => setUserForm(u)} className="p-2.5 bg-white text-slate-400 rounded-xl shadow-sm"><Edit3 size={14}/></button>
                           {u.role !== UserRole.ADMIN && <button onClick={() => store.deleteUser(u.id)} className="p-2.5 bg-white text-rose-500 rounded-xl shadow-sm"><Trash2 size={14}/></button>}
                        </div>
                     </div>
                  ))}
              </div>
           </div>
        )}

        {activeTab === 'BANK' && (
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm max-w-xl mx-auto w-full mx-1">
                <h4 className="font-black text-[11px] uppercase italic mb-10 text-center flex items-center justify-center gap-2 tracking-[0.2em]"><CreditCard size={20} className="text-blue-500"/> Cấu hình VietQR</h4>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 italic px-2">Mã ngân hàng (ID):</label>
                        <input type="text" value={store.bankConfig.bankId} onChange={e => store.updateBankConfig({...store.bankConfig, bankId: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" placeholder="Ví dụ: VCB, ICB, ACB..."/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 italic px-2">Số tài khoản:</label>
                        <input type="text" value={store.bankConfig.accountNo} onChange={e => store.updateBankConfig({...store.bankConfig, accountNo: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" placeholder="Nhập số tài khoản..."/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 italic px-2">Chủ tài khoản (Không dấu):</label>
                        <input type="text" value={store.bankConfig.accountName} onChange={e => store.updateBankConfig({...store.bankConfig, accountName: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm uppercase" placeholder="VD: NGUYEN VAN A"/>
                    </div>
                </div>
            </div>
        )}
      </div>

      {selectedHistory && (
         <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black uppercase italic text-slate-800">Chi tiết Bill #{selectedHistory.id.slice(-6)}</h3>
                   <button onClick={() => setSelectedHistory(null)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-800 transition-colors"><X size={20}/></button>
                </div>
                <div className="space-y-6">
                   <div className="space-y-3">
                      {ensureArray<OrderItem>(selectedHistory.items).map((item, idx) => (
                         <div key={idx} className={`p-4 rounded-2xl flex justify-between items-center ${item.status === OrderItemStatus.CANCELLED ? 'bg-rose-50 border border-rose-100 opacity-60' : 'bg-slate-50'}`}>
                            <div>
                               <p className="text-[11px] font-black uppercase text-slate-800 italic">{item.name} <span className="text-orange-500 ml-1">x{item.quantity}</span></p>
                               <span className="text-[8px] font-bold uppercase text-slate-400">{item.status}</span>
                            </div>
                            <span className="text-[11px] font-black text-slate-900">{(item.price * item.quantity).toLocaleString()}đ</span>
                         </div>
                      ))}
                   </div>
                   <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-slate-800 italic">Tổng thanh toán:</span>
                      <span className="text-xl font-black text-emerald-600 italic">{(selectedHistory.total || 0).toLocaleString()}đ</span>
                   </div>
                </div>
            </div>
         </div>
      )}

      {/* Modals for User/Menu Forms */}
      {userForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-scaleIn">
              <h3 className="text-xl font-black uppercase italic mb-8 text-center">Hồ sơ nhân sự</h3>
              <div className="space-y-4">
                 <input type="text" placeholder="Họ và tên" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <input type="text" placeholder="Username" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <input type="text" placeholder="Password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl outline-none font-black text-sm uppercase italic">
                    <option value={UserRole.STAFF}>Phục vụ (Staff)</option>
                    <option value={UserRole.KITCHEN}>Bếp (Kitchen)</option>
                    <option value={UserRole.ADMIN}>Quản lý (Admin)</option>
                 </select>
                 <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setUserForm(null)} className="py-4.5 bg-slate-50 rounded-2xl font-black uppercase text-[10px]">Đóng</button>
                    <button onClick={saveUser} className="py-4.5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl">Lưu nhân sự</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {menuForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-scaleIn">
              <h3 className="text-xl font-black uppercase italic mb-8 text-center">Quản lý món ăn</h3>
              <div className="space-y-4 h-[65vh] overflow-y-auto no-scrollbar pr-1">
                 <input type="text" placeholder="Tên món ăn" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <input type="number" placeholder="Giá niêm yết" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: parseInt(e.target.value)})} className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <input type="text" placeholder="URL hình ảnh" value={menuForm.image || ''} onChange={e => setMenuForm({...menuForm, image: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <select value={menuForm.category || 'Tất cả'} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl outline-none font-black text-sm uppercase italic">
                    {INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
                 <textarea placeholder="Mô tả món ăn..." value={menuForm.description || ''} onChange={e => setMenuForm({...menuForm, description: e.target.value})} className="w-full px-6 py-4.5 bg-slate-50 rounded-2xl outline-none font-bold text-sm h-32" />
                 <div className="flex items-center gap-3 p-2">
                    <input type="checkbox" checked={menuForm.isAvailable ?? true} onChange={e => setMenuForm({...menuForm, isAvailable: e.target.checked})} className="w-6 h-6 rounded-lg accent-slate-900" id="avail"/>
                    <label htmlFor="avail" className="text-[10px] font-black uppercase italic text-slate-500 cursor-pointer">Sẵn sàng phục vụ</label>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => setMenuForm(null)} className="py-4.5 bg-slate-50 rounded-2xl font-black uppercase text-[10px]">Đóng</button>
                <button onClick={saveMenuItem} className="py-4.5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl italic">Lưu thực đơn</button>
              </div>
           </div>
        </div>
      )}

      <ConfirmModal isOpen={resetTableId !== null} title="Cưỡng chế đóng bàn?" message={`Mọi dữ liệu phục vụ tại Bàn ${resetTableId} sẽ bị xóa. Xác nhận?`} onConfirm={() => { if(resetTableId !== null) store.adminForceClose(resetTableId); setResetTableId(null); }} onCancel={() => setResetTableId(null)} type="danger" />
    </div>
  );
};

export default AdminView;
