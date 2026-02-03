
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType, OrderItem } from '../types';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';
import { ConfirmModal } from '../App';
import { 
  Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, CreditCard, Star, Award, TrendingUp,
  ChefHat, Database, CheckCircle, RotateCcw, Save
} from 'lucide-react';
import { ensureArray } from '../store.ts';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'KPI' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'BANK' | 'CLOUD'>('DASHBOARD');
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
    const filteredHistory = history.filter(h => h.id.toLowerCase().includes(historySearch.toLowerCase()) || h.tableId.toString() === historySearch);
    const todayRevenue = history.filter(h => new Date(h.date).toLocaleDateString() === todayStr).reduce((sum, h) => sum + h.total, 0);
    const totalLoss = history.reduce((sum, h) => {
        const cancelledSum = ensureArray<OrderItem>(h.items).filter(i => i.status === OrderItemStatus.CANCELLED).reduce((s, i) => s + (i.price * i.quantity), 0);
        return sum + cancelledSum;
    }, 0);
    return { todayRevenue, totalLoss, history: filteredHistory };
  }, [store.history, historySearch]);

  const staffKPI = useMemo(() => {
    const staffList = ensureArray<User>(store.users).filter((u: User) => u.role !== UserRole.ADMIN);
    const reviews = ensureArray<Review>(store.reviews);
    const history = ensureArray<HistoryEntry>(store.history);

    return staffList.map((s: User) => {
      const staffOrders = history.filter(h => h.staffId === s.id);
      const totalSales = staffOrders.reduce((sum, o) => sum + o.total, 0);
      let avgRating = 5;
      if (s.role === UserRole.STAFF) {
        const staffReviews = reviews.filter(r => r.staffId === s.id);
        avgRating = staffReviews.length > 0 ? staffReviews.reduce((sum, r) => sum + r.ratingService, 0) / staffReviews.length : 5;
      }
      return { ...s, totalSales, avgRating: Number(avgRating).toFixed(1) };
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
      <div className="flex bg-white p-1 rounded-2xl mb-4 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Đối soát', icon: <LayoutDashboard size={14}/> },
          { id: 'KPI', label: 'KPI', icon: <Award size={14}/> },
          { id: 'REQUESTS', label: 'Duyệt', icon: <CheckCircle size={14}/>, count: qrRequests.length + moveRequests.length + paymentRequests.length },
          { id: 'MONITOR', label: 'Sơ đồ', icon: <Monitor size={14}/> },
          { id: 'MENU', label: 'Thực đơn', icon: <Pizza size={14}/> },
          { id: 'USERS', label: 'Nhân sự', icon: <Shield size={14}/> },
          { id: 'BANK', label: 'Ngân hàng', icon: <CreditCard size={14}/> },
          { id: 'CLOUD', label: 'Hệ thống', icon: <Settings size={14}/> }
        ].map((tab: any) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.icon} <span>{tab.label}</span> 
            {tab.count > 0 && <span className="bg-red-500 text-white min-w-[16px] h-4 rounded-full flex items-center justify-center text-[8px] px-1 animate-pulse">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 px-1 space-y-6">
        {activeTab === 'DASHBOARD' && (
           <div className="space-y-6 animate-slideUp">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Doanh thu hôm nay</p>
                    <h3 className="text-xl font-black text-slate-800 italic">{stats.todayRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border-red-100 border-2 shadow-sm">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 italic">Thất thoát (Món hủy)</p>
                    <h3 className="text-xl font-black text-red-600 italic">{stats.totalLoss.toLocaleString()}đ</h3>
                 </div>
              </div>
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm min-h-[200px]">
                 <h4 className="font-black text-[10px] uppercase italic mb-6">Lịch sử hóa đơn</h4>
                 <div className="mb-4">
                    <input type="text" placeholder="Tìm ID hóa đơn hoặc số bàn..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl text-xs outline-none border border-slate-100" />
                 </div>
                 {stats.history.length === 0 ? <p className="text-center py-10 text-slate-300 font-black uppercase text-[10px] italic">Chưa có dữ liệu hôm nay</p> : 
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
                 }
              </div>
           </div>
        )}

        {activeTab === 'KPI' && (
            <div className="space-y-6 animate-slideUp">
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <h4 className="font-black text-[10px] uppercase italic mb-6 flex items-center gap-2"><Award className="text-orange-500" size={18}/> Hiệu suất nhân sự</h4>
                    <div className="space-y-4">
                        {staffKPI.length === 0 ? <p className="text-center py-10 text-slate-300 font-black uppercase text-[10px] italic">Chưa có nhân sự nào</p> : 
                            staffKPI.map((s: any) => (
                                <div key={s.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic">{s.fullName.charAt(0)}</div>
                                        <div>
                                            <p className="text-[11px] font-black uppercase text-slate-800 leading-none mb-1">{s.fullName}</p>
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
                            ))
                        }
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'MONITOR' && (
          <div className="space-y-6 animate-slideUp">
             <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                <h4 className="font-black text-[10px] uppercase italic mb-6">Cài đặt số lượng bàn</h4>
                <div className="flex gap-4 mb-8">
                   <input type="number" value={tempTableCount} onChange={e => setTempTableCount(parseInt(e.target.value))} className="flex-1 px-4 py-3 bg-slate-50 rounded-xl font-bold outline-none border border-slate-100" />
                   <button onClick={() => store.updateTableCount(tempTableCount)} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase italic shadow-lg">Cập nhật</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                   {ensureArray<Table>(store.tables).map(t => (
                      <div key={t.id} className={`p-4 rounded-2xl border flex flex-col items-center gap-1 relative ${t.status === TableStatus.AVAILABLE ? 'bg-slate-50 border-slate-100' : 'bg-slate-900 text-white border-slate-800 shadow-lg'}`}>
                         <span className="text-[10px] font-black uppercase italic">{t.id === 0 ? 'Khách lẻ' : 'Bàn '+t.id}</span>
                         <span className="text-[8px] font-bold uppercase opacity-50">{t.status}</span>
                         {t.status !== TableStatus.AVAILABLE && (
                            <button onClick={() => setResetTableId(t.id)} className="absolute -top-1 -right-1 bg-red-500 text-white p-1 rounded-full shadow-lg"><RotateCcw size={10}/></button>
                         )}
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
                    <h4 className="font-black text-[10px] uppercase italic">Danh sách nhân sự</h4>
                    <button onClick={() => setUserForm({})} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 italic"><UserPlus size={14}/> Thêm mới</button>
                 </div>
                 <div className="space-y-3">
                    {ensureArray<User>(store.users).map((u: User) => (
                       <div key={u.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center font-black">{u.fullName.charAt(0)}</div>
                             <div>
                                <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-1">{u.fullName} <span className="text-[8px] text-slate-400 font-bold ml-2">@{u.username}</span></p>
                                <p className="text-[8px] font-black text-slate-400 uppercase italic tracking-widest">{u.role}</p>
                             </div>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => setUserForm(u)} className="p-2 bg-white text-slate-400 rounded-xl shadow-sm"><Edit3 size={14}/></button>
                             {u.role !== UserRole.ADMIN && <button onClick={() => store.deleteUser(u.id)} className="p-2 bg-white text-red-500 rounded-xl shadow-sm"><Trash2 size={14}/></button>}
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
                 <h4 className="font-black text-[10px] uppercase italic mb-6">Yêu cầu từ nhân viên</h4>
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
                                <p className="text-[11px] font-black uppercase text-slate-800 italic">Gộp bàn: {n.payload.fromId} -> {n.payload.toId}</p>
                            </div>
                            <button onClick={() => store.approveTableMove(n.id)} className="bg-blue-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic shadow-lg">Duyệt gộp</button>
                        </div>
                    ))}
                    {qrRequests.length === 0 && moveRequests.length === 0 && <p className="text-center py-10 text-slate-300 font-black uppercase text-[10px] italic">Không có yêu cầu nào</p>}
                 </div>
              </section>
           </div>
        )}

        {activeTab === 'MENU' && (
            <div className="space-y-6 animate-slideUp">
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-black text-[10px] uppercase italic">Danh mục thực đơn</h4>
                        <button onClick={() => setMenuForm({})} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 italic"><Plus size={14}/> Thêm món</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ensureArray<MenuItem>(store.menu).map((m: MenuItem) => (
                            <div key={m.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <img src={m.image} className="w-10 h-10 rounded-xl object-cover shadow-sm"/>
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

        {activeTab === 'BANK' && (
            <div className="space-y-6 animate-slideUp">
                <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm max-w-lg mx-auto w-full">
                    <h4 className="font-black text-[10px] uppercase italic mb-8 text-center flex items-center justify-center gap-2"><CreditCard size={18}/> Cấu hình thanh toán QR</h4>
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
                            <input type="text" value={store.bankConfig.accountName} onChange={e => store.updateBankConfig({...store.bankConfig, accountName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm uppercase" placeholder="Tên chủ tài khoản..."/>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'CLOUD' && (
            <div className="space-y-6 animate-slideUp">
                <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-sm max-w-lg mx-auto w-full text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><Database size={32}/></div>
                    <h4 className="font-black text-[10px] uppercase italic mb-2">Đồng bộ dữ liệu Cloud</h4>
                    <div className="space-y-4">
                        <input type="text" value={store.cloudUrl} onChange={e => store.updateCloudUrl(e.target.value)} className="w-full px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm transition-all" placeholder="https://your-project.firebaseio.com/"/>
                        <p className="text-[8px] text-slate-400 font-black italic leading-relaxed px-4 uppercase tracking-tighter">⚠️ Lưu ý: Thay đổi URL sẽ làm mới lại toàn bộ dữ liệu hiện tại.</p>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Forms Modals */}
      {userForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn">
              <h3 className="text-lg font-black uppercase italic mb-6">Thông tin nhân sự</h3>
              <div className="space-y-4">
                 <input type="text" placeholder="Họ và tên" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <input type="text" placeholder="Username" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <input type="text" placeholder="Password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm uppercase">
                    <option value={UserRole.STAFF}>Phục vụ (Staff)</option>
                    <option value={UserRole.KITCHEN}>Bếp (Kitchen)</option>
                    <option value={UserRole.ADMIN}>Quản lý (Admin)</option>
                 </select>
                 <div className="grid grid-cols-2 gap-3 mt-4">
                    <button onClick={() => setUserForm(null)} className="py-4 bg-slate-50 rounded-2xl font-black uppercase text-[10px]">Hủy</button>
                    <button onClick={saveUser} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Lưu lại</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {menuForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn">
              <h3 className="text-lg font-black uppercase italic mb-6">Thông tin món ăn</h3>
              <div className="space-y-4 h-[60vh] overflow-y-auto no-scrollbar pr-1">
                 <input type="text" placeholder="Tên món" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <input type="number" placeholder="Giá tiền" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: parseInt(e.target.value)})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <input type="text" placeholder="URL hình ảnh" value={menuForm.image || ''} onChange={e => setMenuForm({...menuForm, image: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm" />
                 <select value={menuForm.category || 'Tất cả'} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm uppercase">
                    {INITIAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
                 <textarea placeholder="Mô tả món ăn" value={menuForm.description || ''} onChange={e => setMenuForm({...menuForm, description: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl outline-none font-bold text-sm h-24" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button onClick={() => setMenuForm(null)} className="py-4 bg-slate-50 rounded-2xl font-black uppercase text-[10px]">Hủy</button>
                <button onClick={saveMenuItem} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Lưu món</button>
              </div>
           </div>
        </div>
      )}

      <ConfirmModal isOpen={resetTableId !== null} title="Cưỡng chế đóng bàn?" message={`Dữ liệu Bàn ${resetTableId} sẽ bị xóa và reset. Xác nhận?`} onConfirm={() => { if(resetTableId !== null) store.adminForceClose(resetTableId); setResetTableId(null); }} onCancel={() => setResetTableId(null)} type="danger" />
    </div>
  );
};

export default AdminView;
