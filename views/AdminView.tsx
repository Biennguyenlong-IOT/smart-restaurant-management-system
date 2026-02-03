
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType, OrderItem } from '../types';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';
import { ConfirmModal } from '../App';
import { 
  ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, Calendar, PowerOff, 
  Search, Save, CreditCard, Star, Award, TrendingUp, ShoppingBag, Utensils,
  ChevronRight, Users, Hash, ChefHat, RefreshCcw, Database, CheckCircle, 
  Clock, Filter, Download, Info, Package, User as UserIcon, QrCode, AlertTriangle, ChevronDown, RotateCcw, Loader2
} from 'lucide-react';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'KPI' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'BANK' | 'CLOUD'>('DASHBOARD');
  const [tempTableCount, setTempTableCount] = useState(store.tables.length - 1);
  const [resetTableId, setResetTableId] = useState<number | null>(null);
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'menu' | 'user' | 'history' | 'kpi' | 'notif', id?: string, name: string } | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<HistoryEntry | null>(null);

  const qrRequests = useMemo(() => (store.notifications || []).filter((n: AppNotification) => n.type === 'qr_request'), [store.notifications]);
  const moveRequests = useMemo(() => (store.notifications || []).filter((n: AppNotification) => n.type === 'move_request'), [store.notifications]);
  const paymentRequests = useMemo(() => (store.tables || []).filter((t: Table) => t.status === TableStatus.PAYING), [store.tables]);
  const billingTables = useMemo(() => (store.tables || []).filter((t: Table) => t.status === TableStatus.BILLING), [store.tables]);

  const stats = useMemo(() => {
    const history: HistoryEntry[] = store.history || [];
    const todayStr = new Date().toLocaleDateString();
    
    const filteredHistory = history.filter(h => 
        h.id.toLowerCase().includes(historySearch.toLowerCase()) ||
        h.tableId.toString() === historySearch ||
        h.staffId?.toLowerCase().includes(historySearch.toLowerCase())
    );

    const todayOrders = history.filter(h => new Date(h.date).toLocaleDateString() === todayStr);
    const todayRevenue = todayOrders.reduce((sum, h) => sum + h.total, 0);
    const totalRevenue = history.reduce((sum, h) => sum + h.total, 0);
    
    const totalLoss = history.reduce((sum, h) => {
        const cancelledSum = (h.items || []).filter(i => i.status === OrderItemStatus.CANCELLED).reduce((s, i) => s + (i.price * i.quantity), 0);
        return sum + cancelledSum;
    }, 0);

    const dineInCount = history.filter(h => h.orderType === OrderType.DINE_IN).length;
    const takeawayCount = history.filter(h => h.orderType === OrderType.TAKEAWAY).length;

    const itemCounts: Record<string, number> = {};
    history.forEach(h => {
      (h.items || []).forEach(item => { 
        if (item.status !== OrderItemStatus.CANCELLED) {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity; 
        }
      });
    });
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    return { todayRevenue, totalRevenue, totalLoss, count: history.length, dineInCount, takeawayCount, topItems, history: filteredHistory };
  }, [store.history, historySearch]);

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
    <div className="h-full flex flex-col animate-fadeIn overflow-hidden relative">
      {/* Detail History Modal */}
      {selectedHistory && (
        <div className="fixed inset-0 z-[400] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn border border-slate-100 flex flex-col max-h-[85dvh]">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h3 className="text-xl font-black uppercase italic">Chi tiết hóa đơn</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(selectedHistory.date).toLocaleString()}</p>
                    </div>
                    <button onClick={() => setSelectedHistory(null)} className="p-2 bg-slate-50 text-slate-400 rounded-xl"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar border-y border-slate-50 py-5">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Bàn phục vụ</p>
                            <p className="text-xs font-black text-slate-800 italic">{selectedHistory.tableId === 0 ? 'Khách lẻ mang đi' : 'Bàn số ' + selectedHistory.tableId}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Nhân viên trực</p>
                            <p className="text-xs font-black text-slate-800 italic uppercase">@{selectedHistory.staffId}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase text-slate-500 italic px-1">Danh sách món (Audit):</p>
                        {(selectedHistory.items || []).map((o: OrderItem) => (
                            <div key={o.id} className={`flex justify-between items-center p-3 rounded-xl border ${o.status === OrderItemStatus.CANCELLED ? 'bg-red-50/50 border-red-100 opacity-60' : 'bg-white border-slate-100'}`}>
                                <div className="min-w-0 pr-4">
                                    <p className={`text-[10px] font-black uppercase truncate italic ${o.status === OrderItemStatus.CANCELLED ? 'line-through text-red-400' : 'text-slate-800'}`}>{o.name} <span className="text-orange-500">x{o.quantity}</span></p>
                                    <span className={`text-[8px] font-black uppercase italic ${o.status === OrderItemStatus.CANCELLED ? 'text-red-500' : 'text-slate-400'}`}>
                                        {o.status === OrderItemStatus.CANCELLED ? 'Đã huỷ' : 'Đã thanh toán'}
                                    </span>
                                </div>
                                <span className="text-[10px] font-black text-slate-900 shrink-0">{(o.price * o.quantity).toLocaleString()}đ</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-6 space-y-3 shrink-0">
                    <div className="flex justify-between items-center bg-slate-900 p-5 rounded-2xl text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-20 h-20 bg-white/5 rounded-br-full"></div>
                        <span className="text-[10px] font-black uppercase italic relative z-10">Thực thu (Đã thanh toán):</span>
                        <span className="text-xl font-black italic relative z-10">{selectedHistory.total.toLocaleString()}đ</span>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex bg-white p-1 rounded-2xl mb-4 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Đối soát', icon: <LayoutDashboard size={16}/> },
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
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-6 animate-slideUp">
              {/* Dashboard Content - Same as before */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp size={48}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Thực thu hôm nay</p>
                    <h3 className="text-xl font-black text-slate-800 italic">{stats.todayRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border-red-100 border-2 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform text-red-500"><AlertTriangle size={48}/></div>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 leading-none">Tiền thất thoát (Món huỷ)</p>
                    <h3 className="text-xl font-black text-red-600 italic">{stats.totalLoss.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><ShoppingBag size={48}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Tổng bill thành công</p>
                    <h3 className="text-xl font-black text-slate-800 italic">{stats.count} đơn</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Filter size={48}/></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Tỉ lệ món huỷ/bán</p>
                    <h3 className="text-xl font-black text-slate-800 italic">{stats.totalLoss > 0 ? ((stats.totalLoss / (stats.totalRevenue + stats.totalLoss)) * 100).toFixed(1) : 0}%</h3>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col min-h-[500px]">
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <h4 className="font-black text-xs uppercase italic flex items-center gap-2 shrink-0"><Clock className="text-slate-400" size={18}/> Đối soát hóa đơn</h4>
                      <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                        <Search size={14} className="text-slate-300 mx-2 self-center"/>
                        <input type="text" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Tìm kiếm..." className="bg-transparent text-[10px] font-bold outline-none uppercase w-full" />
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-1">
                      {stats.history.map((h: HistoryEntry) => {
                          const hasCancelled = (h.items || []).some(i => i.status === OrderItemStatus.CANCELLED);
                          return (
                              <div key={h.id} onClick={() => setSelectedHistory(h)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all hover:border-slate-300 group flex flex-col md:flex-row justify-between gap-3 ${hasCancelled ? 'bg-red-50/20 border-red-100 shadow-sm' : 'bg-slate-50 border-white'}`}>
                                  <div className="flex items-center gap-4">
                                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-[10px] shadow-md shrink-0 ${h.orderType === OrderType.TAKEAWAY ? 'bg-indigo-600' : 'bg-slate-900'}`}>
                                          <span className="opacity-50 text-[7px] mb-0.5">{h.orderType === OrderType.TAKEAWAY ? 'MANG VỀ' : 'BÀN'}</span>
                                          {h.tableId === 0 ? 'LẺ' : h.tableId}
                                      </div>
                                      <div>
                                          <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-1.5">{h.total.toLocaleString()}đ</p>
                                          <div className="flex items-center gap-2">
                                              <span className="text-[8px] font-bold text-slate-400 uppercase italic leading-none">{new Date(h.date).toLocaleTimeString()} - {new Date(h.date).toLocaleDateString()}</span>
                                              <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                              <span className="text-[8px] font-black text-slate-500 uppercase leading-none">NV: @{h.staffId}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-0 pt-2 md:pt-0">
                                      {hasCancelled && <div className="flex items-center gap-1.5 text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-100"><AlertTriangle size={10}/><span className="text-[8px] font-black uppercase">Món bị hủy</span></div>}
                                      <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-slate-500 transition-colors"><span className="text-[8px] font-black uppercase">Xem bill</span><ChevronRight size={14}/></div>
                                  </div>
                              </div>
                          );
                      })}
                   </div>
                </div>

                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col">
                   <h4 className="font-black text-xs uppercase italic mb-6 flex items-center gap-2"><TrendingUp className="text-orange-500" size={18}/> Hiệu suất món ăn</h4>
                   <div className="space-y-6 flex-1">
                      {stats.topItems.map(([name, qty], idx) => (
                        <div key={name} className="flex items-center gap-4">
                           <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-[12px] italic shrink-0 shadow-md">{idx + 1}</span>
                           <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center mb-1">
                                 <span className="text-[10px] font-black text-slate-700 uppercase truncate pr-2">{name}</span>
                                 <span className="text-[9px] font-black text-orange-600 italic whitespace-nowrap">{qty} đơn</span>
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

        {activeTab === 'REQUESTS' && (
           <div className="space-y-6 animate-slideUp">
              <section className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-xs uppercase italic mb-6 flex items-center gap-2"><CheckCircle className="text-green-500" size={18}/> Duyệt mở bàn & Chuyển bàn</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {qrRequests.length === 0 && moveRequests.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                            <CheckCircle size={48} className="text-slate-100 mx-auto mb-4" />
                            <p className="text-slate-300 font-black uppercase text-[10px] italic">Tất cả yêu cầu đã được xử lý</p>
                        </div>
                    )}
                    {qrRequests.map((n: AppNotification) => (
                        <div key={n.id} className="p-5 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600"><QrCode size={20}/></div>
                                <div>
                                    <p className="text-[11px] font-black uppercase text-slate-800 italic">Mở QR Bàn {n.payload.tableId}</p>
                                    <p className="text-[8px] font-bold text-slate-400 mt-0.5 italic">Phục vụ: @{n.payload.staffId}</p>
                                </div>
                            </div>
                            <button onClick={() => store.approveTableQr(n.id)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic shadow-lg active:scale-95 transition-all">Duyệt mở</button>
                        </div>
                    ))}
                    {moveRequests.map((n: AppNotification) => (
                        <div key={n.id} className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600"><ArrowRightLeft size={20}/></div>
                                <div>
                                    <p className="text-[11px] font-black uppercase text-slate-800 italic">Bàn {n.payload.fromId} → {n.payload.toId}</p>
                                    <p className="text-[8px] font-bold text-slate-400 mt-0.5 italic">Phục vụ: @{n.payload.staffId}</p>
                                </div>
                            </div>
                            <button onClick={() => store.approveTableMove(n.id)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic shadow-lg active:scale-95 transition-all">Duyệt chuyển</button>
                        </div>
                    ))}
                 </div>
              </section>
           </div>
        )}

        {activeTab === 'MONITOR' && (
           <div className="space-y-6 animate-slideUp">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div>
                        <h4 className="font-black text-xs uppercase italic flex items-center gap-2 mb-1"><Monitor size={18} className="text-slate-400"/> Quản trị sơ đồ bàn</h4>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">Admin có quyền cưỡng chế giải phóng bàn bằng nút Reset</p>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                        <label className="text-[9px] font-black uppercase text-slate-400 italic px-2">Số bàn:</label>
                        <input type="number" value={tempTableCount} onChange={e => setTempTableCount(parseInt(e.target.value))} className="w-16 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-black outline-none" />
                        <button onClick={() => store.updateTableCount(tempTableCount)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase italic shadow-lg active:scale-95 transition-all">Lưu</button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                     {store.tables.map((t: Table) => (
                        <div key={t.id} className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center gap-3 transition-all relative group ${
                            t.status === TableStatus.AVAILABLE ? 'border-dashed border-slate-100 bg-white' :
                            t.qrRequested ? 'border-amber-400 bg-amber-50 animate-pulse' :
                            'border-slate-800 bg-slate-900 shadow-xl'
                        }`}>
                            <span className={`text-[11px] font-black uppercase italic ${t.status === TableStatus.AVAILABLE ? 'text-slate-800' : 'text-white'}`}>{t.id === 0 ? 'LẺ' : 'BÀN '+t.id}</span>
                            
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${t.status === TableStatus.AVAILABLE ? 'bg-slate-200' : 'bg-green-400'}`}></div>
                                <span className={`text-[7px] font-black uppercase ${t.status === TableStatus.AVAILABLE ? 'text-slate-400' : 'text-slate-500'}`}>{t.status}</span>
                            </div>

                            {/* Reset Button - Luôn hiển thị trừ khi bàn đang trống */}
                            {t.status !== TableStatus.AVAILABLE && (
                                <button 
                                    onClick={() => setResetTableId(t.id)} 
                                    className="mt-1 bg-red-500 hover:bg-red-600 text-white p-2.5 rounded-xl shadow-lg transition-all active:scale-90"
                                    title="Reset bàn này"
                                >
                                    <RotateCcw size={14}/>
                                </button>
                            )}
                        </div>
                     ))}
                  </div>
              </div>
           </div>
        )}
      </div>

      <ConfirmModal isOpen={resetTableId !== null} title="Cưỡng chế đóng bàn?" message={`Mọi dữ liệu Bàn ${resetTableId} sẽ bị xóa và reset về trạng thái trống. Xác nhận?`} onConfirm={() => { if(resetTableId !== null) store.adminForceClose(resetTableId); setResetTableId(null); }} onCancel={() => setResetTableId(null)} type="danger" />
      
      {/* Other Modals - Same as before */}
      {menuForm && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-scaleIn border border-slate-100">
                <h3 className="text-xl font-black uppercase italic mb-8">Chỉnh sửa thực đơn</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Tên món ăn" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="number" placeholder="Giá tiền" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: parseInt(e.target.value)})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                        <select value={menuForm.category || 'Tất cả'} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm">
                            {INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setMenuForm(null)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] italic">Hủy bỏ</button>
                    <button onClick={saveMenuItem} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl italic">Lưu thay đổi</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
