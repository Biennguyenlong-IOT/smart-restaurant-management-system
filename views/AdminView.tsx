
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus, Review, OrderType } from '../types';
import { CATEGORIES } from '../constants';
import { 
  ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, LayoutDashboard, Calendar, PowerOff, 
  Search, Save, CreditCard, Star, UserCheck, TrendingUp, ShoppingBag, Utensils, Award
} from 'lucide-react';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'BANK' | 'KPI' | 'CLOUD'>('DASHBOARD');
  const [tempTableCount, setTempTableCount] = useState(store.tables.length);
  
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [bankForm, setBankForm] = useState<BankConfig>(store.bankConfig || { bankId: 'ICB', accountNo: '', accountName: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const qrRequests = useMemo(() => (store.notifications || []).filter((n: AppNotification) => n.type === 'qr_request'), [store.notifications]);
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
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { 
      todayRevenue, 
      totalRevenue, 
      count: history.length,
      dineInCount,
      takeawayCount,
      topItems
    };
  }, [store.history]);

  const staffKPI = useMemo(() => {
    const staffList = store.users.filter((u: User) => u.role === UserRole.STAFF);
    const history: HistoryEntry[] = store.history || [];
    const reviews: Review[] = store.reviews || [];

    return staffList.map((s: User) => {
      const staffOrders = history.filter(h => h.staffId === s.id);
      const totalSales = staffOrders.reduce((sum, o) => sum + o.total, 0);
      const staffReviews = reviews.filter(r => r.staffId === s.id);
      const avgRating = staffReviews.length > 0 
        ? staffReviews.reduce((sum, r) => sum + r.ratingService, 0) / staffReviews.length 
        : 5;

      return {
        ...s,
        orderCount: staffOrders.length,
        totalSales,
        avgRating: Number(avgRating).toFixed(1)
      };
    }).sort((a, b) => b.totalSales - a.totalSales);
  }, [store.users, store.history, store.reviews]);

  const saveMenuItem = () => {
    if (!menuForm?.name || !menuForm?.price) return alert("Vui lòng nhập đủ thông tin!");
    store.upsertMenuItem({
      ...menuForm,
      id: menuForm.id || `m-${Date.now()}`,
      isAvailable: menuForm.isAvailable ?? true,
      image: menuForm.image || 'https://picsum.photos/seed/food/400/300',
      category: menuForm.category || 'Tất cả'
    } as MenuItem);
    setMenuForm(null);
  };

  const saveUser = () => {
    if (!userForm?.username || !userForm?.password) return alert("Thiếu thông tin!");
    store.upsertUser({ 
      ...userForm, 
      id: userForm.id || `u-${Date.now()}`, 
      role: userForm.role || UserRole.STAFF 
    } as User);
    setUserForm(null);
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      <div className="flex bg-white p-1.5 rounded-2xl mb-6 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Báo cáo', icon: <LayoutDashboard size={18}/> },
          { id: 'KPI', label: 'KPI Nhân viên', icon: <Award size={18}/> },
          { id: 'MONITOR', label: 'Bàn ăn', icon: <Monitor size={18}/> },
          { id: 'REQUESTS', label: 'Duyệt y/c', icon: <ArrowRightLeft size={18}/>, count: qrRequests.length + paymentRequests.length },
          { id: 'MENU', label: 'Thực đơn', icon: <Pizza size={18}/> },
          { id: 'BANK', label: 'VietQR', icon: <CreditCard size={18}/> },
          { id: 'USERS', label: 'Nhân sự', icon: <Shield size={18}/> },
          { id: 'CLOUD', label: 'Hệ thống', icon: <Settings size={18}/> }
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
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng doanh thu</p>
                    <h3 className="text-2xl font-black text-orange-600">{stats.totalRevenue.toLocaleString()}đ</h3>
                 </div>
                 <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng số đơn hàng</p>
                    <h3 className="text-2xl font-black text-slate-800">{stats.count}</h3>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-orange-500"/> Hiệu suất đơn hàng</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                          <div className="flex items-center gap-3">
                             <Utensils size={16} className="text-blue-500" />
                             <span className="text-xs font-black uppercase text-slate-600">Ăn tại chỗ</span>
                          </div>
                          <span className="font-black text-slate-900">{stats.dineInCount} đơn</span>
                       </div>
                       <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                          <div className="flex items-center gap-3">
                             <ShoppingBag size={16} className="text-orange-500" />
                             <span className="text-xs font-black uppercase text-slate-600">Mang về</span>
                          </div>
                          <span className="font-black text-slate-900">{stats.takeawayCount} đơn</span>
                       </div>
                    </div>
                 </div>

                 <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                    <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2"><Award size={18} className="text-amber-500"/> Top 3 món ăn bán chạy</h4>
                    <div className="space-y-3">
                       {stats.topItems.map(([name, qty], idx) => (
                          <div key={name} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                             <div className="flex items-center gap-3">
                                <span className="w-6 h-6 bg-amber-200 text-amber-700 rounded-full flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                                <span className="text-xs font-black uppercase text-slate-800">{name}</span>
                             </div>
                             <span className="font-black text-amber-700">x{qty}</span>
                          </div>
                       ))}
                       {stats.topItems.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Chưa có dữ liệu món ăn</p>}
                    </div>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'KPI' && (
           <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
              <div className="flex justify-between items-center border-b border-slate-50 pb-6">
                <h2 className="text-xl font-black italic uppercase text-slate-800">Bảng theo dõi KPI Nhân viên</h2>
                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Toàn thời gian</div>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="text-[10px] font-black uppercase text-slate-400 border-b border-slate-50">
                          <th className="py-4 pl-4">Nhân viên</th>
                          <th className="py-4">Số đơn</th>
                          <th className="py-4 text-right">Doanh thu</th>
                          <th className="py-4 text-center">Đánh giá</th>
                          <th className="py-4 text-right pr-4">Xếp hạng</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {staffKPI.map((s, idx) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="py-5 pl-4">
                                <p className="text-sm font-black text-slate-800 uppercase italic">{s.fullName}</p>
                                <p className="text-[9px] font-bold text-slate-400">@{s.username}</p>
                             </td>
                             <td className="py-5">
                                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black">{s.orderCount}</span>
                             </td>
                             <td className="py-5 text-right font-black text-slate-800">
                                {s.totalSales.toLocaleString()}đ
                             </td>
                             <td className="py-5">
                                <div className="flex justify-center items-center gap-1.5">
                                   <Star size={12} fill="currentColor" className="text-amber-500" />
                                   <span className="text-xs font-black">{s.avgRating}</span>
                                </div>
                             </td>
                             <td className="py-5 text-right pr-4">
                                {idx === 0 ? <Award size={20} className="text-amber-500 ml-auto" /> : <span className="text-xs font-black text-slate-300">#{idx+1}</span>}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 {staffKPI.length === 0 && <div className="py-20 text-center text-slate-300 font-black uppercase italic text-xs">Chưa có dữ liệu nhân sự</div>}
              </div>
           </div>
        )}

        {activeTab === 'MONITOR' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {store.tables.map((t: Table) => (
              <div key={t.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[160px]">
                <div className="text-center">
                  <h3 className="font-black text-lg italic text-slate-800">Bàn {t.id}</h3>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${t.status === TableStatus.AVAILABLE ? 'bg-slate-100 text-slate-400' : 'bg-orange-100 text-orange-600'}`}>{t.status}</span>
                </div>
                <button onClick={() => { if(window.confirm(`Reset bàn ${t.id}? Toàn bộ đơn hàng hiện tại sẽ bị xoá.`)) store.adminForceClose(t.id); }} className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all">
                   <PowerOff size={10} /> Reset bàn
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'REQUESTS' && (
           <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2"><ArrowRightLeft size={18} className="text-blue-500"/> Mở bàn QR ({qrRequests.length})</h4>
                 <div className="space-y-3">
                    {qrRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu mở bàn</p>}
                    {qrRequests.map((n:any) => (
                       <div key={n.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-white">
                          <p className="text-xs font-black uppercase">Bàn {n.payload?.tableId} - NV: {n.payload?.staffId}</p>
                          <button onClick={() => store.approveTableQr(n.id)} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Phê duyệt</button>
                       </div>
                    ))}
                 </div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                 <h4 className="font-black text-sm uppercase italic mb-6 flex items-center gap-2"><CreditCard size={18} className="text-amber-500"/> Yêu cầu thanh toán ({paymentRequests.length})</h4>
                 <div className="space-y-3">
                    {paymentRequests.length === 0 && <p className="text-center py-6 text-slate-300 text-[10px] font-black uppercase italic">Không có yêu cầu thanh toán</p>}
                    {paymentRequests.map((t:any) => (
                       <div key={t.id} className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                          <p className="text-xs font-black uppercase">Bàn {t.id} - {t.currentOrders.reduce((s,o)=>s+(o.price*o.quantity),0).toLocaleString()}đ</p>
                          <button onClick={() => store.confirmPayment(t.id)} className="bg-amber-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Xác nhận Bill</button>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'MENU' && (
           <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <div className="relative">
                   <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                   <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm món..." className="pl-9 pr-4 py-2 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-100" />
                 </div>
                 <button onClick={() => setMenuForm({})} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 shadow-lg"><Plus size={14}/> Thêm món mới</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {store.menu.filter((m:MenuItem)=>m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((m:MenuItem)=>(
                    <div key={m.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-white">
                       <div className="flex items-center gap-3">
                          <img src={m.image} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                          <h5 className="text-[11px] font-black uppercase truncate w-32">{m.name}</h5>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => setMenuForm(m)} className="p-2 bg-white text-blue-500 rounded-lg shadow-sm"><Edit3 size={14}/></button>
                          <button onClick={() => { if(window.confirm(`Xoá món ${m.name}?`)) store.deleteMenuItem(m.id); }} className="p-2 bg-white text-red-500 rounded-lg shadow-sm"><Trash2 size={14}/></button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'USERS' && (
           <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <h4 className="font-black text-sm uppercase italic">Quản lý Nhân sự</h4>
                 <button onClick={() => setUserForm({})} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 shadow-lg"><UserPlus size={14}/> Thêm nhân viên</button>
              </div>
              <div className="space-y-3">
                 {store.users.map((u:User) => (
                   <div key={u.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-white">
                      <div>
                         <p className="text-xs font-black uppercase text-slate-800">{u.fullName}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase">{u.role} | @{u.username}</p>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => setUserForm(u)} className="p-2 bg-white text-blue-500 rounded-lg shadow-sm"><Edit3 size={14}/></button>
                         <button onClick={() => { if(window.confirm(`Xoá nhân viên ${u.fullName}?`)) store.deleteUser(u.id); }} className="p-2 bg-white text-red-500 rounded-lg shadow-sm"><Trash2 size={14}/></button>
                      </div>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'BANK' && (
           <div className="max-w-md mx-auto bg-white p-10 rounded-[3rem] border border-slate-100 shadow-2xl space-y-5">
              <div className="text-center mb-4">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4"><CreditCard size={32}/></div>
                <h4 className="font-black uppercase italic text-lg">Cấu hình VietQR</h4>
                <p className="text-[10px] font-black text-slate-400 uppercase italic">Dùng để sinh mã thanh toán QR</p>
              </div>
              <div className="space-y-4">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Mã ngân hàng (ICB, VCB...)</p>
                   <input type="text" value={bankForm.bankId} onChange={e => setBankForm({...bankForm, bankId: e.target.value})} placeholder="VD: ICB" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-amber-500 transition-all" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Số tài khoản</p>
                   <input type="text" value={bankForm.accountNo} onChange={e => setBankForm({...bankForm, accountNo: e.target.value})} placeholder="VD: 1012345678" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-amber-500 transition-all" />
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-1.5 ml-1">Tên chủ tài khoản</p>
                   <input type="text" value={bankForm.accountName} onChange={e => setBankForm({...bankForm, accountName: e.target.value})} placeholder="VD: NGUYEN VAN A" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-amber-500 transition-all" />
                </div>
                <button onClick={() => { store.updateBankConfig(bankForm); alert('Đã lưu cấu hình ngân hàng!'); }} className="w-full py-5 bg-amber-500 text-white rounded-[1.5rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
                   <Save size={18}/> Lưu cấu hình VietQR
                </button>
              </div>
           </div>
        )}

        {activeTab === 'CLOUD' && (
          <div className="max-w-md mx-auto space-y-4">
             <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <h4 className="font-black uppercase italic mb-4">Quy mô nhà hàng</h4>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Số lượng bàn ăn</p>
                <input type="number" value={tempTableCount} onChange={e => setTempTableCount(parseInt(e.target.value) || 1)} className="w-full px-5 py-3 bg-slate-50 rounded-xl font-black text-lg outline-none border border-slate-100" />
                <button onClick={() => store.updateTableCount(tempTableCount)} className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs shadow-lg">Cập nhật số bàn</button>
             </div>
          </div>
        )}
      </div>

      {menuForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-4 animate-scaleIn">
            <h3 className="font-black uppercase italic text-lg text-slate-800">Thông tin món ăn</h3>
            <div className="space-y-4">
               <input type="text" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} placeholder="Tên món" className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none" />
               <input type="number" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: Number(e.target.value)})} placeholder="Giá bán" className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none" />
               <select value={menuForm.category || 'Tất cả'} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <input type="text" value={menuForm.image || ''} onChange={e => setMenuForm({...menuForm, image: e.target.value})} placeholder="URL Hình ảnh" className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none" />
            </div>
            <div className="flex gap-3 pt-2">
               <button onClick={() => setMenuForm(null)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black uppercase text-xs text-slate-400">Huỷ</button>
               <button onClick={saveMenuItem} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs shadow-lg">Lưu món</button>
            </div>
          </div>
        </div>
      )}

      {userForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl space-y-4 animate-scaleIn">
            <h3 className="font-black uppercase italic text-lg text-slate-800">Tài khoản nhân sự</h3>
            <div className="space-y-4">
               <input type="text" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} placeholder="Họ và tên" className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none" />
               <input type="text" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} placeholder="Tên đăng nhập" className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none" />
               <input type="text" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="Mật khẩu" className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none" />
               <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-5 py-3 bg-slate-50 rounded-xl font-bold border border-slate-100 outline-none uppercase text-xs">
                  <option value={UserRole.ADMIN}>ADMIN</option>
                  <option value={UserRole.STAFF}>STAFF</option>
                  <option value={UserRole.KITCHEN}>KITCHEN</option>
               </select>
            </div>
            <div className="flex gap-3 pt-2">
               <button onClick={() => setUserForm(null)} className="flex-1 py-4 bg-slate-100 rounded-xl font-black uppercase text-xs text-slate-400">Huỷ</button>
               <button onClick={saveUser} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs shadow-lg">Lưu nhân sự</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
