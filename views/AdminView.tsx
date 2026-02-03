
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

    const itemCounts: Record<string, number> = {};
    history.forEach(h => {
      (h.items || []).forEach(item => { 
        if (item.status !== OrderItemStatus.CANCELLED) {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity; 
        }
      });
    });
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
    return { todayRevenue, totalRevenue, totalLoss, count: history.length, topItems, history: filteredHistory };
  }, [store.history, historySearch]);

  const staffKPI = useMemo(() => {
    const staffList = (store.users || []).filter((u: User) => u.role !== UserRole.ADMIN);
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
    }).sort((a:any, b:any) => b.totalSales - a.totalSales);
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
                    {(selectedHistory.items || []).map((o: OrderItem) => (
                        <div key={o.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-black uppercase italic text-slate-800">{o.name} x{o.quantity}</p>
                            <span className="text-[10px] font-black text-slate-900">{(o.price * o.quantity).toLocaleString()}đ</span>
                        </div>
                    ))}
                </div>
                <div className="mt-6 bg-slate-900 p-5 rounded-2xl text-white text-center">
                    <span className="text-[10px] font-black uppercase italic">Tổng thực thu:</span>
                    <h3 className="text-xl font-black italic">{selectedHistory.total.toLocaleString()}đ</h3>
                </div>
            </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex bg-white p-1 rounded-2xl mb-4 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Đối soát', icon: <LayoutDashboard size={16}/> },
          { id: 'KPI', label: 'KPI', icon: <Award size={16}/> },
          { id: 'REQUESTS', label: 'Duyệt', icon: <CheckCircle size={16}/>, count: qrRequests.length + moveRequests.length + paymentRequests.length },
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Doanh thu hôm nay</p>
                    <h3 className="text-xl font-black text-slate-800 italic">{stats.todayRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border-red-100 border-2 shadow-sm">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Thất thoát (Món hủy)</p>
                    <h3 className="text-xl font-black text-red-600 italic">{stats.totalLoss.toLocaleString()}đ</h3>
                 </div>
              </div>
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-xs uppercase italic mb-6">Lịch sử hóa đơn</h4>
                 <div className="space-y-3">
                    {stats.history.map((h: HistoryEntry) => (
                        <div key={h.id} onClick={() => setSelectedHistory(h)} className="p-4 rounded-2xl bg-slate-50 border border-white hover:border-slate-300 cursor-pointer flex justify-between items-center transition-all">
                            <div>
                                <p className="text-[11px] font-black text-slate-800 uppercase italic">Bill {h.id.slice(-6)} - Bàn {h.tableId}</p>
                                <p className="text-[8px] font-bold text-slate-400">{new Date(h.date).toLocaleString()}</p>
                            </div>
                            <span className="text-[11px] font-black text-slate-900">{h.total.toLocaleString()}đ</span>
                        </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'KPI' && (
            <div className="space-y-6 animate-slideUp">
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <h4 className="font-black text-xs uppercase italic mb-6 flex items-center gap-2"><Award className="text-orange-500" size={18}/> Hiệu suất nhân sự</h4>
                    <div className="space-y-4">
                        {staffKPI.map((s: any) => (
                            <div key={s.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic">{s.fullName.charAt(0)}</div>
                                    <div>
                                        <p className="text-[11px] font-black uppercase text-slate-800">{s.fullName}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase italic tracking-widest">{s.role}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[11px] font-black text-orange-600 italic">{s.totalSales.toLocaleString()}đ</p>
                                    <div className="flex items-center gap-1 justify-end mt-1 text-amber-500">
                                        <Star size={10} fill="currentColor"/>
                                        <span className="text-[10px] font-black">{s.avgRating}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'REQUESTS' && (
           <div className="space-y-6 animate-slideUp">
              <section className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                 <h4 className="font-black text-xs uppercase italic mb-6">Yêu cầu từ nhân viên</h4>
                 <div className="space-y-4">
                    {qrRequests.map((n: AppNotification) => (
                        <div key={n.id} className="p-5 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-800 italic">Mở QR Bàn {n.payload.tableId}</p>
                                <p className="text-[8px] font-bold text-slate-400 mt-0.5">Yêu cầu bởi: @{n.payload.staffId}</p>
                            </div>
                            <button onClick={() => store.approveTableQr(n.id)} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic shadow-lg">Duyệt mở</button>
                        </div>
                    ))}
                    {moveRequests.map((n: AppNotification) => (
                        <div key={n.id} className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-black uppercase text-slate-800 italic">Bàn {n.payload.fromId} → {n.payload.toId}</p>
                                <p className="text-[8px] font-bold text-slate-400 mt-0.5">Yêu cầu bởi: @{n.payload.staffId}</p>
                            </div>
                            <button onClick={() => store.approveTableMove(n.id)} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic shadow-lg">Duyệt chuyển</button>
                        </div>
                    ))}
                    {qrRequests.length === 0 && moveRequests.length === 0 && <p className="text-center py-10 text-slate-300 font-black uppercase text-[10px] italic">Không có yêu cầu nào</p>}
                 </div>
              </section>
           </div>
        )}

        {activeTab === 'MONITOR' && (
           <div className="space-y-6 animate-slideUp">
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                    <h4 className="font-black text-xs uppercase italic">Quản trị sơ đồ bàn</h4>
                    <div className="flex items-center gap-3">
                        <input type="number" value={tempTableCount} onChange={e => setTempTableCount(parseInt(e.target.value))} className="w-16 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black outline-none" />
                        <button onClick={() => store.updateTableCount(tempTableCount)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase italic">Cập nhật số bàn</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                     {store.tables.map((t: Table) => (
                        <div key={t.id} className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${t.status === TableStatus.AVAILABLE ? 'border-dashed border-slate-100 bg-white' : 'border-slate-800 bg-slate-900 text-white shadow-xl'}`}>
                            <span className="text-[11px] font-black uppercase italic">{t.id === 0 ? 'LẺ' : 'BÀN '+t.id}</span>
                            {t.status !== TableStatus.AVAILABLE && (
                                <button onClick={() => setResetTableId(t.id)} className="bg-red-500 text-white p-2 rounded-xl active:scale-90"><RotateCcw size={12}/></button>
                            )}
                        </div>
                     ))}
                  </div>
              </div>
           </div>
        )}

        {activeTab === 'MENU' && (
            <div className="space-y-6 animate-slideUp">
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-xs uppercase italic">Danh mục thực đơn</h4>
                        <button onClick={() => setMenuForm({})} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 italic"><Plus size={14}/> Thêm món mới</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(store.menu || []).map((m: MenuItem) => (
                            <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={m.image} className="w-12 h-12 rounded-xl object-cover shadow-sm"/>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-800">{m.name}</p>
                                        <p className="text-[9px] font-bold text-orange-600">{m.price.toLocaleString()}đ</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setMenuForm(m)} className="p-2 bg-white text-slate-400 rounded-xl shadow-sm"><Edit3 size={14}/></button>
                                    <button onClick={() => store.deleteMenuItem(m.id)} className="p-2 bg-white text-red-500 rounded-xl shadow-sm"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'USERS' && (
            <div className="space-y-6 animate-slideUp">
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-xs uppercase italic">Quản lý nhân sự</h4>
                        <button onClick={() => setUserForm({})} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 italic"><UserPlus size={14}/> Thêm nhân sự</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(store.users || []).map((u: User) => (
                            <div key={u.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-800">{u.fullName}</p>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase italic">@{u.username} • {u.role}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setUserForm(u)} className="p-2 bg-white text-slate-400 rounded-xl shadow-sm"><Edit3 size={14}/></button>
                                    <button onClick={() => store.deleteUser(u.id)} className="p-2 bg-white text-red-500 rounded-xl shadow-sm" disabled={u.username === 'admin'}><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'BANK' && (
            <div className="space-y-6 animate-slideUp">
                <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm max-w-lg mx-auto w-full">
                    <h4 className="font-black text-xs uppercase italic mb-8 text-center flex items-center justify-center gap-2"><CreditCard size={18}/> Cấu hình thanh toán QR</h4>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 italic px-1">Ngân hàng (VietQR ID):</label>
                            <input type="text" value={store.bankConfig.bankId} onChange={e => store.updateBankConfig({...store.bankConfig, bankId: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" placeholder="Ví dụ: VCB, ICB, ACB..."/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 italic px-1">Số tài khoản thụ hưởng:</label>
                            <input type="text" value={store.bankConfig.accountNo} onChange={e => store.updateBankConfig({...store.bankConfig, accountNo: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" placeholder="Số tài khoản ngân hàng..."/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black uppercase text-slate-400 italic px-1">Tên chủ tài khoản:</label>
                            <input type="text" value={store.bankConfig.accountName} onChange={e => store.updateBankConfig({...store.bankConfig, accountName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" placeholder="Tên in trên thẻ (không dấu)..."/>
                        </div>
                        <div className="pt-4">
                            <p className="text-[8px] text-slate-400 italic text-center font-bold uppercase">Hệ thống sử dụng VietQR để tự động tạo mã thanh toán kèm số tiền</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'CLOUD' && (
            <div className="space-y-6 animate-slideUp">
                <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm max-w-lg mx-auto w-full text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><Database size={32}/></div>
                    <h4 className="font-black text-xs uppercase italic mb-2">Đồng bộ dữ liệu Cloud</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase italic mb-8">Firebase Realtime Database URL</p>
                    <div className="space-y-4">
                        <input type="text" value={store.cloudUrl} onChange={e => store.updateCloudUrl(e.target.value)} className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm transition-all" placeholder="https://your-project.firebaseio.com/"/>
                        <p className="text-[8px] text-slate-400 font-bold italic leading-relaxed px-4">THAY ĐỔI URL SẼ LÀM MỚI LẠI TOÀN BỘ DỮ LIỆU. HÃY CẨN THẬN!</p>
                    </div>
                </div>
            </div>
        )}
      </div>

      <ConfirmModal isOpen={resetTableId !== null} title="Cưỡng chế đóng bàn?" message={`Dữ liệu Bàn ${resetTableId} sẽ bị xóa và reset. Xác nhận?`} onConfirm={() => { if(resetTableId !== null) store.adminForceClose(resetTableId); setResetTableId(null); }} onCancel={() => setResetTableId(null)} type="danger" />
      
      {/* Menu Edit Modal */}
      {menuForm && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-scaleIn">
                <h3 className="text-xl font-black uppercase italic mb-8">Chỉnh sửa thực đơn</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Tên món ăn" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    <input type="number" placeholder="Giá tiền" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: parseInt(e.target.value)})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    <select value={menuForm.category || 'Tất cả'} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm">
                        {INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setMenuForm(null)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Hủy</button>
                    <button onClick={saveMenuItem} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Lưu</button>
                </div>
            </div>
        </div>
      )}

      {/* User Edit Modal */}
      {userForm && (
        <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-scaleIn">
                <h3 className="text-xl font-black uppercase italic mb-8">Quản lý nhân sự</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Họ và tên" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    <input type="text" placeholder="Username" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    <input type="text" placeholder="Password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" />
                    <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm">
                        <option value={UserRole.STAFF}>Phục vụ</option>
                        <option value={UserRole.KITCHEN}>Bếp</option>
                        <option value={UserRole.ADMIN}>Quản lý</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-8">
                    <button onClick={() => setUserForm(null)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Hủy</button>
                    <button onClick={saveUser} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Lưu</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
