
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType, OrderItem } from '../types';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';
import { ConfirmModal } from '../App';
import { 
  ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, Calendar, PowerOff, 
  Search, Save, CreditCard, Star, Award, TrendingUp, ShoppingBag, Utensils,
  ChevronRight, Users, Hash, ChefHat, RefreshCcw, Database, CheckCircle, 
  Clock, Filter, Download, Info, Package, User as UserIcon, QrCode, AlertTriangle, ChevronDown
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
    
    // Lọc lịch sử theo tìm kiếm (ID, Bàn, NV)
    const filteredHistory = history.filter(h => 
        h.id.toLowerCase().includes(historySearch.toLowerCase()) ||
        h.tableId.toString() === historySearch ||
        h.staffId?.toLowerCase().includes(historySearch.toLowerCase())
    );

    const todayOrders = history.filter(h => new Date(h.date).toLocaleDateString() === todayStr);
    
    const todayRevenue = todayOrders.reduce((sum, h) => sum + h.total, 0);
    const totalRevenue = history.reduce((sum, h) => sum + h.total, 0);
    
    // Thống kê thất thoát do huỷ món (Audit Trail)
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
                    {selectedHistory.items?.some(i => i.status === OrderItemStatus.CANCELLED) && (
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex items-center gap-3">
                            <AlertTriangle size={16} className="text-red-500" />
                            <p className="text-[9px] font-bold text-red-600 uppercase italic leading-tight">Phát hiện món bị huỷ trong đơn này - Kiểm tra lý do huỷ món để tránh thất thoát.</p>
                        </div>
                    )}
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
        {/* DASHBOARD TAB - Focus on Audit and Leakage Prevention */}
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-6 animate-slideUp">
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
                      <h4 className="font-black text-xs uppercase italic flex items-center gap-2 shrink-0"><Clock className="text-slate-400" size={18}/> Đối soát đơn hàng & Chống thất thoát</h4>
                      
                      <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
                        <Search size={14} className="text-slate-300 mx-2 self-center"/>
                        <input type="text" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Tìm theo ID, Bàn, Nhân viên..." className="bg-transparent text-[10px] font-bold outline-none uppercase w-full" />
                      </div>
                   </div>

                   <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-1">
                      {stats.history.length === 0 ? (
                        <div className="py-24 text-center">
                            <Database size={48} className="text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-300 font-black uppercase text-[10px] italic tracking-widest">Không có dữ liệu đối soát phù hợp</p>
                        </div>
                      ) : (
                        stats.history.map((h: HistoryEntry) => {
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
                                        {hasCancelled && (
                                            <div className="flex items-center gap-1.5 text-red-500 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                                                <AlertTriangle size={10}/>
                                                <span className="text-[8px] font-black uppercase">Món bị hủy</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 text-slate-300 group-hover:text-slate-500 transition-colors">
                                            <span className="text-[8px] font-black uppercase">Xem bill</span>
                                            <ChevronRight size={14}/>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                      )}
                   </div>
                   
                   <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase italic">Hiển thị {stats.history.length} hóa đơn lọc được</p>
                      <button onClick={() => setDeleteTarget({ type: 'history', name: 'Kết toán & Xoá lịch sử (Admin Only)' })} className="text-[9px] font-black text-red-500 uppercase italic hover:underline">Reset toàn bộ dữ liệu</button>
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
                      {stats.topItems.length === 0 && <p className="text-center py-20 text-slate-300 font-black uppercase text-[10px] italic">Chưa có dữ liệu thống kê</p>}
                   </div>
                   
                   <div className="mt-8 space-y-3">
                        <div className="p-5 bg-slate-900 text-white rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-bl-full"></div>
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-2 relative z-10">Cơ cấu doanh thu</p>
                            <div className="flex justify-between text-[11px] font-black italic relative z-10">
                                <span className="flex items-center gap-2"><Utensils size={12} className="text-orange-500"/> Tại bàn: {stats.dineInCount}</span>
                                <span className="flex items-center gap-2"><ShoppingBag size={12} className="text-indigo-500"/> Mang về: {stats.takeawayCount}</span>
                            </div>
                        </div>
                   </div>
                </div>
              </div>
           </div>
        )}

        {/* REQUESTS TAB - Centralized Approval */}
        {activeTab === 'REQUESTS' && (
           <div className="space-y-6 animate-slideUp">
              <section className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-xs uppercase italic mb-6 flex items-center gap-2"><CheckCircle className="text-green-500" size={18}/> Duyệt mở bàn & Chuyển bàn</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {qrRequests.length === 0 && moveRequests.length === 0 && (
                        <div className="col-span-full py-20 text-center">
                            {/* Fixed CheckCircle2 typo to CheckCircle */}
                            <CheckCircle size={48} className="text-slate-100 mx-auto mb-4" />
                            <p className="text-slate-300 font-black uppercase text-[10px] italic">Tất cả yêu cầu đã được xử lý</p>
                        </div>
                    )}
                    {qrRequests.map((n: AppNotification) => (
                        <div key={n.id} className="p-4 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black uppercase text-orange-600 italic">Mở QR Bàn {n.payload.tableId}</p>
                                <p className="text-[8px] font-bold text-slate-400 mt-0.5 italic">Yêu cầu từ @{n.payload.staffId}</p>
                            </div>
                            <button onClick={() => store.approveTableQr(n.id)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase italic shadow-md active:scale-95 transition-all">Duyệt mở</button>
                        </div>
                    ))}
                    {moveRequests.map((n: AppNotification) => (
                        <div key={n.id} className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <ArrowRightLeft size={16} className="text-blue-500"/>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-blue-600 italic">Bàn {n.payload.fromId} → {n.payload.toId}</p>
                                    <p className="text-[8px] font-bold text-slate-400 mt-0.5 italic">Yêu cầu từ @{n.payload.staffId}</p>
                                </div>
                            </div>
                            <button onClick={() => store.approveTableMove(n.id)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase italic shadow-md active:scale-95 transition-all">Duyệt chuyển</button>
                        </div>
                    ))}
                 </div>
              </section>
              
              <section className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-xs uppercase italic mb-6 flex items-center gap-2"><CreditCard className="text-indigo-500" size={18}/> Bill đang thanh toán</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paymentRequests.length === 0 && billingTables.length === 0 && (
                        <div className="col-span-full py-20 text-center">
                            <CreditCard size={48} className="text-slate-100 mx-auto mb-4 opacity-50" />
                            <p className="text-slate-300 font-black uppercase text-[10px] italic">Hiện không có bàn nào đang tính tiền</p>
                        </div>
                    )}
                    {paymentRequests.map((t: Table) => (
                        <div key={t.id} className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-between shadow-sm animate-pulse">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md">B{t.id}</div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-indigo-800 italic">Đang chuyển khoản</p>
                                    <p className="text-[8px] font-bold text-slate-400 mt-0.5">Mã: {t.sessionToken}</p>
                                </div>
                            </div>
                            <button onClick={() => { setSelectedHistory(store.history.find((h:any) => h.tableId === t.id)); setActiveTab('DASHBOARD'); }} className="p-2.5 bg-white text-indigo-600 rounded-xl shadow-sm"><Info size={16}/></button>
                        </div>
                    ))}
                    {billingTables.map((t: Table) => (
                        <div key={t.id} className="p-4 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-600 text-white rounded-xl flex items-center justify-center font-black text-xs shadow-md">B{t.id}</div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-green-800 italic">Đã in bill - Chờ xong</p>
                                    <p className="text-[8px] font-bold text-slate-400 mt-0.5">NV: @{t.claimedBy}</p>
                                </div>
                            </div>
                            <button onClick={() => store.adminForceClose(t.id)} className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase shadow-md italic">Cưỡng chế đóng</button>
                        </div>
                    ))}
                 </div>
              </section>
           </div>
        )}

        {/* KPI TAB */}
        {activeTab === 'KPI' && (
           <div className="space-y-6 animate-slideUp">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm overflow-x-auto">
                 <div className="flex justify-between items-center mb-8">
                    <h4 className="font-black text-xs uppercase italic flex items-center gap-2"><Users className="text-blue-500" size={18}/> Bảng đánh giá hiệu suất nhân sự</h4>
                    <button onClick={() => setDeleteTarget({ type: 'kpi', name: 'Làm mới toàn bộ KPI nhân viên' })} className="p-2 bg-slate-900 text-white rounded-xl shadow-lg active:scale-95 transition-all"><RefreshCcw size={14}/></button>
                 </div>
                 <table className="w-full text-left min-w-[600px]">
                    <thead className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase">
                       <tr>
                          <th className="pb-4">Họ và Tên</th>
                          <th className="pb-4 text-center">Vai trò</th>
                          <th className="pb-4 text-center">Đơn phục vụ</th>
                          <th className="pb-4 text-center">Doanh số đạt</th>
                          <th className="pb-4 text-center">Rating</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {staffKPI.map((s: any) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="py-4">
                                <p className="text-xs font-black text-slate-800 uppercase italic leading-none">{s.fullName}</p>
                                <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">@{s.username}</p>
                             </td>
                             <td className="py-4 text-center">
                                <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase italic ${s.role === UserRole.STAFF ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'}`}>
                                    {s.role}
                                </span>
                             </td>
                             <td className="py-4 text-center font-black text-xs italic">{s.orderCount}</td>
                             <td className="py-4 text-center font-black text-xs italic">{s.totalSales.toLocaleString()}đ</td>
                             <td className="py-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                   <Star size={12} fill="currentColor" className="text-orange-500" />
                                   <span className="font-black text-xs italic">{s.avgRating}</span>
                                   <span className="text-[8px] text-slate-400 font-bold italic">({s.reviewCount})</span>
                                </div>
                             </td>
                          </tr>
                       ))}
                       {staffKPI.length === 0 && <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-black uppercase text-[10px] italic">Chưa có dữ liệu nhân sự</td></tr>}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {/* MONITOR TAB - Simplified for Admin */}
        {activeTab === 'MONITOR' && (
           <div className="space-y-6 animate-slideUp">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="font-black text-xs uppercase italic flex items-center gap-2"><Monitor size={18} className="text-slate-400"/> Tổng quát sơ đồ bàn</h4>
                    <div className="flex items-center gap-3">
                        <label className="text-[9px] font-black uppercase text-slate-400 italic">Số lượng bàn:</label>
                        <input type="number" value={tempTableCount} onChange={e => setTempTableCount(parseInt(e.target.value))} className="w-16 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black outline-none" />
                        <button onClick={() => store.updateTableCount(tempTableCount)} className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-[9px] font-black uppercase italic shadow-md">Lưu</button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                     {store.tables.map((t: Table) => (
                        <div key={t.id} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${
                            t.status === TableStatus.AVAILABLE ? 'border-dashed border-slate-100 bg-white opacity-40' :
                            t.status === TableStatus.OCCUPIED ? 'border-orange-200 bg-orange-50/20' :
                            t.status === TableStatus.PAYING || t.status === TableStatus.BILLING ? 'border-indigo-200 bg-indigo-50/20 animate-pulse' : 'border-slate-50 bg-slate-50/50'
                        }`}>
                           <span className="text-[10px] font-black uppercase italic text-slate-800">{t.id === 0 ? 'LẺ' : 'B'+t.id}</span>
                           <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${t.status === TableStatus.AVAILABLE ? 'bg-slate-200' : t.status === TableStatus.OCCUPIED ? 'bg-orange-500' : 'bg-indigo-500'}`}></div>
                              <span className="text-[7px] font-black uppercase text-slate-400 truncate max-w-[50px]">{t.status}</span>
                           </div>
                           {t.status !== TableStatus.AVAILABLE && (
                             <button onClick={() => setResetTableId(t.id)} className="mt-1 text-red-500 bg-white border border-red-50 p-1.5 rounded-lg shadow-sm hover:bg-red-50 transition-all"><PowerOff size={10}/></button>
                           )}
                        </div>
                     ))}
                  </div>
              </div>
           </div>
        )}

        {/* MENU MGMT TAB */}
        {activeTab === 'MENU' && (
           <div className="space-y-6 animate-slideUp">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                     <h4 className="font-black text-xs uppercase italic flex items-center gap-2"><Pizza size={18} className="text-orange-500"/> Quản lý thực đơn</h4>
                     <button onClick={() => setMenuForm({})} className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase italic shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"><Plus size={16}/> Thêm món mới</button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {store.menu.map((item: MenuItem) => (
                        <div key={item.id} className={`p-4 rounded-3xl border flex items-center justify-between gap-4 transition-all ${item.isAvailable ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-slate-50 opacity-60 grayscale'}`}>
                           <div className="flex items-center gap-4 min-w-0">
                              <img src={item.image} className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-sm" />
                              <div className="truncate">
                                 <h5 className="text-[10px] font-black text-slate-800 uppercase italic truncate leading-tight mb-1">{item.name}</h5>
                                 <p className="text-[9px] font-bold text-orange-600 italic leading-none">{item.price.toLocaleString()}đ</p>
                                 <span className="text-[7px] font-black uppercase text-slate-400 mt-1 block">{item.category}</span>
                              </div>
                           </div>
                           <div className="flex flex-col gap-1.5">
                              <button onClick={() => setMenuForm(item)} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100"><Edit3 size={14}/></button>
                              <button onClick={() => setDeleteTarget({ type: 'menu', id: item.id, name: item.name })} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><Trash2 size={14}/></button>
                           </div>
                        </div>
                     ))}
                  </div>
              </div>
           </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'USERS' && (
           <div className="space-y-6 animate-slideUp">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                     <h4 className="font-black text-xs uppercase italic flex items-center gap-2"><Shield size={18} className="text-blue-500"/> Quản trị nhân sự</h4>
                     <button onClick={() => setUserForm({})} className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase italic shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"><UserPlus size={16}/> Thêm nhân sự</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {store.users.map((u: User) => (
                        <div key={u.id} className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100 flex items-center justify-between shadow-sm transition-all hover:bg-white hover:border-slate-300 group">
                           <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm italic shadow-lg ${u.role === UserRole.ADMIN ? 'bg-slate-900' : u.role === UserRole.KITCHEN ? 'bg-green-600' : 'bg-orange-500'}`}>
                                 {u.role[0]}
                              </div>
                              <div>
                                 <h5 className="text-[11px] font-black text-slate-800 uppercase italic leading-none mb-1.5">{u.fullName}</h5>
                                 <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black uppercase text-slate-400 italic">@{u.username}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className="text-[8px] font-black text-slate-400 uppercase italic">{u.role}</span>
                                 </div>
                              </div>
                           </div>
                           <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => setUserForm(u)} className="p-2.5 bg-white text-slate-600 rounded-xl shadow-sm border border-slate-100"><Edit3 size={14}/></button>
                              {u.role !== UserRole.ADMIN && (
                                <button onClick={() => setDeleteTarget({ type: 'user', id: u.id, name: u.fullName })} className="p-2.5 bg-white text-red-500 rounded-xl shadow-sm border border-red-50"><Trash2 size={14}/></button>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
              </div>
           </div>
        )}

        {/* BANK TAB */}
        {activeTab === 'BANK' && (
           <div className="space-y-6 animate-slideUp">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm max-w-xl mx-auto">
                 <h4 className="font-black text-xs uppercase italic mb-8 flex items-center gap-2"><CreditCard size={18} className="text-indigo-500"/> Thiết lập VietQR Đối soát</h4>
                 <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1 italic">Mã Ngân hàng (BIN)</label>
                            <input type="text" placeholder="ICB, VCB, MB..." value={store.bankConfig.bankId} onChange={e => store.updateBankConfig({ ...store.bankConfig, bankId: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 ml-1 italic">Số tài khoản</label>
                            <input type="text" placeholder="102xxx" value={store.bankConfig.accountNo} onChange={e => store.updateBankConfig({ ...store.bankConfig, accountNo: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1 italic">Tên chủ tài khoản</label>
                        <input type="text" placeholder="NGUYEN VAN A" value={store.bankConfig.accountName} onChange={e => store.updateBankConfig({ ...store.bankConfig, accountName: e.target.value })} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    </div>
                    <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex items-center gap-5">
                       <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-indigo-200">
                          <QrCode size={32} className="text-indigo-600" />
                       </div>
                       <p className="text-[10px] font-bold text-indigo-700 uppercase italic leading-relaxed">
                          Thông tin này sẽ được dùng để tạo mã QR tự động cho khách hàng. Vui lòng đảm bảo thông tin chính xác để khách chuyển khoản đúng tài khoản.
                       </p>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* CLOUD TAB */}
        {activeTab === 'CLOUD' && (
           <div className="space-y-6 animate-slideUp">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm max-w-xl mx-auto text-center">
                 <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><Database size={40} /></div>
                 <h4 className="font-black text-xs uppercase italic mb-8">Firebase Cloud Backend</h4>
                 <div className="space-y-4">
                    <p className="text-[11px] font-black uppercase text-slate-400 italic mb-2 leading-none">Database URL hiện tại:</p>
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 break-all font-mono text-[10px] text-slate-600 shadow-inner mb-8 italic">
                       {store.cloudUrl}
                    </div>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-5 bg-red-500 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all italic">Xoá thiết lập & Reset URL</button>
                    <p className="text-[9px] font-bold text-slate-300 mt-4 uppercase italic leading-relaxed">Smart Resto v5.2 - Bảo mật đa tầng - Đối soát thời gian thực</p>
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* Forms and Modals */}
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
                    <input type="text" placeholder="Link ảnh (Tùy chọn)" value={menuForm.image || ''} onChange={e => setMenuForm({...menuForm, image: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    <textarea placeholder="Mô tả món ăn" value={menuForm.description || ''} onChange={e => setMenuForm({...menuForm, description: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm h-24" />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setMenuForm(null)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] italic">Hủy bỏ</button>
                    <button onClick={saveMenuItem} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl italic">Lưu thay đổi</button>
                </div>
            </div>
        </div>
      )}

      {userForm && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-scaleIn border border-slate-100">
                <h3 className="text-xl font-black uppercase italic mb-8">Thông tin nhân sự</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Họ và Tên" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    <div className="grid grid-cols-2 gap-4">
                        <input type="text" placeholder="Tên đăng nhập" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                        <input type="text" placeholder="Mật khẩu" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    </div>
                    <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm">
                        <option value={UserRole.STAFF}>Phục vụ (Staff)</option>
                        <option value={UserRole.KITCHEN}>Bếp (Kitchen)</option>
                        <option value={UserRole.ADMIN}>Quản lý (Admin)</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setUserForm(null)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] italic">Hủy bỏ</button>
                    <button onClick={saveUser} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl italic">Lưu thông tin</button>
                </div>
            </div>
        </div>
      )}

      <ConfirmModal isOpen={resetTableId !== null} title="Cưỡng chế đóng bàn?" message={`Mọi dữ liệu Bàn ${resetTableId} sẽ bị xóa và reset về trạng thái trống. Xác nhận?`} onConfirm={() => { if(resetTableId !== null) store.adminForceClose(resetTableId); setResetTableId(null); }} onCancel={() => setResetTableId(null)} type="danger" />
      
      <ConfirmModal isOpen={deleteTarget !== null} title="Xác nhận yêu cầu?" message={`Bạn có chắc chắn muốn thực hiện: ${deleteTarget?.name}? Hành động này không thể hoàn tác.`} 
        onConfirm={() => {
            if (deleteTarget?.type === 'menu' && deleteTarget.id) store.deleteMenuItem(deleteTarget.id);
            if (deleteTarget?.type === 'user' && deleteTarget.id) store.deleteUser(deleteTarget.id);
            if (deleteTarget?.type === 'history') store.clearHistory();
            if (deleteTarget?.type === 'kpi') store.clearReviews();
            setDeleteTarget(null);
        }} onCancel={() => setDeleteTarget(null)} type="danger" />
    </div>
  );
};

export default AdminView;
