
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry, BankConfig, OrderItemStatus } from '../types';
import { CATEGORIES, INITIAL_MENU } from '../constants';
import { 
  ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, Database, Cloud, LayoutDashboard, TrendingUp, 
  ShoppingBag, DollarSign, Calendar, QrCode, Share2, Copy, PowerOff, 
  Search, Image as ImageIcon, Save, CreditCard, Banknote, CheckCircle2,
  FileText, Clock
} from 'lucide-react';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'BANK' | 'CLOUD'>('DASHBOARD');
  const [tempCloudUrl, setTempCloudUrl] = useState(store.cloudUrl);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [bankForm, setBankForm] = useState<BankConfig>(store.bankConfig || { bankId: 'ICB', accountNo: '', accountName: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const activeRequests = useMemo(() => 
    (store.notifications || []).filter((n: AppNotification) => 
      n.type === 'move_request' || n.type === 'qr_request'
    )
  , [store.notifications]);

  const paymentRequests = useMemo(() => 
    (store.tables || []).filter((t: Table) => t.status === TableStatus.PAYING)
  , [store.tables]);

  const stats = useMemo(() => {
    const history: HistoryEntry[] = store.history || [];
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    
    const todayOrders = history.filter(h => new Date(h.date).toLocaleDateString() === todayStr);
    const todayRevenue = todayOrders.reduce((sum, h) => sum + h.total, 0);
    const totalRevenue = history.reduce((sum, h) => sum + h.total, 0);
    const totalOrders = history.length;
    const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return { todayRevenue, totalRevenue, totalOrders, avgOrder, todayOrdersCount: todayOrders.length };
  }, [store.history]);

  const handleUpdateBank = () => {
    if (!bankForm.accountNo || !bankForm.accountName) return alert("Vui lòng điền đủ thông tin ngân hàng!");
    store.updateBankConfig(bankForm);
    alert("Đã cập nhật thành công!");
  };

  const handleUpdateCloudUrl = () => {
    if (!tempCloudUrl.startsWith('http')) return alert("URL không hợp lệ!");
    store.updateCloudUrl(tempCloudUrl);
    alert("Cập nhật Database thành công.");
  };

  const getSetupLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const encodedUrl = btoa(store.cloudUrl);
    return `${baseUrl}?config=${encodedUrl}`;
  };

  const saveMenuItem = () => {
    if (!menuForm?.name || !menuForm?.price) return alert("Vui lòng điền đủ thông tin!");
    const finalItem = {
      ...menuForm,
      id: menuForm.id || `m-${Date.now()}`,
      image: menuForm.image || 'https://picsum.photos/seed/food/400/300',
      category: menuForm.category || 'Tất cả'
    } as MenuItem;
    store.upsertMenuItem(finalItem);
    setMenuForm(null);
  };

  const saveUser = () => {
    if (!userForm?.username || !userForm?.password || !userForm?.fullName) return alert("Vui lòng điền đủ thông tin!");
    const finalUser = {
      ...userForm,
      id: userForm.id || `u-${Date.now()}`,
      role: userForm.role || UserRole.STAFF
    } as User;
    store.upsertUser(finalUser);
    setUserForm(null);
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn">
      {/* Modal Chia sẻ cấu hình */}
      {showShareModal && (
        <div className="fixed inset-0 z-[250] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl animate-scaleIn">
            <h3 className="text-2xl font-black text-slate-800 mb-2">Cấu hình nhanh</h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8 px-4">Nhân viên quét mã này để kết nối hệ thống</p>
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-8 flex items-center justify-center">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getSetupLink())}`} alt="Setup QR" className="w-48 h-48 rounded-xl bg-white p-2" />
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => { navigator.clipboard.writeText(getSetupLink()); alert("Đã copy link!"); }}
                className="w-full py-4 bg-slate-100 text-slate-800 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
              >
                <Copy size={14}/> Copy Link cài đặt
              </button>
              <button onClick={() => setShowShareModal(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex bg-white p-1.5 rounded-2xl mb-6 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Báo cáo', icon: <LayoutDashboard size={18}/> },
          { id: 'MONITOR', label: 'Bàn ăn', icon: <Monitor size={18}/> },
          { id: 'REQUESTS', label: 'Yêu cầu', icon: <ArrowRightLeft size={18}/>, count: activeRequests.length + paymentRequests.length },
          { id: 'MENU', label: 'Món ăn', icon: <Pizza size={18}/> },
          { id: 'BANK', label: 'VietQR', icon: <CreditCard size={18}/> },
          { id: 'USERS', label: 'Nhân sự', icon: <Shield size={18}/> },
          { id: 'CLOUD', label: 'Hệ thống', icon: <Settings size={18}/> }
        ].map((tab: any) => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-3 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count > 0 && <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] animate-pulse">{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-4"><DollarSign size={24}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hôm nay</p>
                <h3 className="text-2xl font-black text-slate-800">{stats.todayRevenue.toLocaleString()}đ</h3>
                <p className="text-[10px] font-bold text-green-500 mt-2 flex items-center gap-1"><TrendingUp size={12}/> {stats.todayOrdersCount} đơn hàng</p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4"><ShoppingBag size={24}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng đơn</p>
                <h3 className="text-2xl font-black text-slate-800">{stats.totalOrders}</h3>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mb-4 font-black">Σ</div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng doanh thu</p>
                <h3 className="text-2xl font-black text-slate-800">{stats.totalRevenue.toLocaleString()}đ</h3>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mb-4"><TrendingUp size={24}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bình quân</p>
                <h3 className="text-2xl font-black text-slate-800">{Math.round(stats.avgOrder).toLocaleString()}đ</h3>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h4 className="font-black text-slate-800 uppercase italic mb-8 flex items-center gap-2 text-sm">
                <Calendar size={18} className="text-orange-500" /> Giao dịch gần đây
              </h4>
              <div className="space-y-4">
                {store.history.length === 0 ? (
                  <div className="py-20 text-center text-slate-300 font-bold italic">Chưa có giao dịch</div>
                ) : (
                  store.history.slice(0, 15).map((h: HistoryEntry) => (
                    <div key={h.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-white">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-xs shadow-sm italic">B{h.tableId}</div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800">Thanh toán Bàn {h.tableId}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{h.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-800">+{h.total.toLocaleString()}đ</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'MONITOR' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {store.tables.map((t: Table) => (
              <div key={t.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[160px]">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-black text-lg italic text-slate-800">Bàn {t.id}</h3>
                    <div className={`w-2.5 h-2.5 rounded-full ${t.status === TableStatus.AVAILABLE ? 'bg-slate-200' : 'bg-orange-500 animate-pulse'}`}></div>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase truncate">{t.claimedBy ? `NV: ${t.claimedBy}` : 'Sẵn sàng'}</p>
                </div>
                <div className="space-y-2 mt-4">
                   {t.status === TableStatus.PAYING && (
                     <button onClick={() => store.confirmPayment(t.id)} className="w-full py-2 bg-amber-500 text-white rounded-xl font-black text-[9px] uppercase shadow-lg shadow-amber-100">Xác nhận Bill</button>
                   )}
                   <button 
                    onClick={() => { if(window.confirm(`Đóng bàn ${t.id}?`)) store.adminForceClose(t.id); }}
                    className="w-full py-2 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase flex items-center justify-center gap-1.5"
                   >
                    <PowerOff size={10} /> Reset
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'REQUESTS' && (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Mục xác nhận thanh toán quan trọng cho Admin */}
            {paymentRequests.length > 0 && (
              <div className="space-y-4 mb-10">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Chờ duyệt thanh toán ({paymentRequests.length})</h3>
                {paymentRequests.map((t: Table) => {
                  const total = t.currentOrders.filter(o => o.status !== OrderItemStatus.CANCELLED).reduce((sum, o) => sum + (o.price * o.quantity), 0);
                  return (
                    <div key={t.id} className="bg-amber-50 p-6 rounded-3xl border border-amber-200 shadow-md flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
                          <Banknote size={24}/>
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 text-sm">BÀN {t.id} - YÊU CẦU BILL</h4>
                          <p className="text-xl font-black text-amber-700">{total.toLocaleString()}đ</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => { if(window.confirm(`Xác nhận thu tiền Bàn ${t.id}?`)) store.confirmPayment(t.id); }}
                        className="px-6 py-3.5 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg"
                      >
                        Thu Tiền & In Bill
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Yêu cầu hệ thống ({activeRequests.length})</h3>
            {activeRequests.length === 0 && paymentRequests.length === 0 ? (
              <div className="bg-white p-20 rounded-[3rem] text-center border border-dashed border-slate-200">
                <CheckCircle2 size={32} className="mx-auto mb-4 text-slate-200"/>
                <p className="text-xs font-black text-slate-300 uppercase italic">Tất cả đã xử lý xong</p>
              </div>
            ) : (
              activeRequests.map((req: AppNotification) => (
                <div key={req.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${req.type === 'qr_request' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                      {req.type === 'qr_request' ? <QrCode size={24}/> : <ArrowRightLeft size={24}/>}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">{req.title}</h4>
                      <p className="text-[10px] font-bold text-slate-400">{req.message}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => store.deleteNotification(req.id)} className="px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase">Huỷ</button>
                    <button 
                      onClick={() => req.type === 'qr_request' ? store.approveTableQr(req.id) : store.approveMoveTable(req.id)}
                      className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase"
                    >
                      Duyệt
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'BANK' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                  <CreditCard size={24}/>
                </div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase italic">Cấu hình VietQR</h4>
                  <p className="text-[10px] font-bold text-slate-400">Khách sẽ quét mã này để trả tiền</p>
                </div>
              </div>
              <div className="space-y-5">
                <input type="text" value={bankForm.bankId} onChange={e => setBankForm({...bankForm, bankId: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="Mã Ngân hàng (ICB, VCB...)" />
                <input type="text" value={bankForm.accountNo} onChange={e => setBankForm({...bankForm, accountNo: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="Số tài khoản" />
                <input type="text" value={bankForm.accountName} onChange={e => setBankForm({...bankForm, accountName: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="Tên chủ tài khoản (KHONG DAU)" />
                <button onClick={handleUpdateBank} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">
                  Lưu cấu hình
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'CLOUD' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center"><Database size={24}/></div>
                <div>
                  <h4 className="font-black text-slate-800 uppercase italic">Database</h4>
                  <p className="text-[10px] font-bold text-slate-400">Firebase Realtime Database</p>
                </div>
              </div>
              <div className="space-y-4">
                <input type="text" value={tempCloudUrl} onChange={e => setTempCloudUrl(e.target.value)} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs" />
                <button onClick={handleUpdateCloudUrl} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl">Cập nhật Database</button>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl">
              <h4 className="text-xl font-black italic mb-2">Chia sẻ cấu hình</h4>
              <p className="text-white/40 text-[10px] font-black uppercase mb-8">QR này chứa sẵn URL Database bên trên</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowShareModal(true)} className="py-4 bg-orange-500 rounded-2xl font-black uppercase text-[10px]">Hiện QR</button>
                <button onClick={() => { navigator.clipboard.writeText(getSetupLink()); alert("Đã copy!"); }} className="py-4 bg-white/10 rounded-2xl font-black uppercase text-[10px]">Copy Link</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'MENU' && (
           <div className="space-y-6">
             <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4 shadow-sm">
               <div className="relative flex-1">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                 <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm món..." className="w-full pl-12 pr-6 py-3.5 bg-slate-50 rounded-2xl font-bold text-sm outline-none" />
               </div>
               <button onClick={() => setMenuForm({})} className="bg-orange-500 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2">
                 <Plus size={16}/> Thêm món
               </button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {store.menu.filter((m: any) => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item: MenuItem) => (
                 <div key={item.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 flex gap-4 shadow-sm group">
                   <img src={item.image} className="w-20 h-20 rounded-2xl object-cover shrink-0" />
                   <div className="flex-1 min-w-0 flex flex-col justify-between">
                     <div>
                       <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.category}</span>
                       <h4 className="font-black text-slate-800 text-sm truncate">{item.name}</h4>
                       <p className="font-black text-orange-600 text-xs mt-1">{item.price.toLocaleString()}đ</p>
                     </div>
                     <div className="flex gap-2 mt-2">
                       <button onClick={() => setMenuForm(item)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><Edit3 size={14}/></button>
                       <button onClick={() => { if(window.confirm(`Xoá món ${item.name}?`)) store.deleteMenuItem(item.id); }} className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={14}/></button>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           </div>
        )}

        {activeTab === 'USERS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {store.users.map((u: User) => (
              <div key={u.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${u.role === UserRole.ADMIN ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    <Shield size={24}/>
                  </div>
                  <div>
                    <h5 className="font-black text-slate-800 text-sm">{u.fullName}</h5>
                    <span className="text-[8px] font-black uppercase text-slate-400">{u.role}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setUserForm(u)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white"><Edit3 size={16}/></button>
                  <button onClick={() => { if(window.confirm(`Xoá NV ${u.fullName}?`)) store.deleteUser(u.id); }} className="p-2.5 bg-red-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
            <button onClick={() => setUserForm({})} className="bg-slate-50 border-2 border-dashed border-slate-200 p-6 rounded-3xl flex flex-col items-center justify-center gap-2 text-slate-300">
              <UserPlus size={32}/>
              <span className="text-[10px] font-black uppercase">Thêm nhân sự</span>
            </button>
          </div>
        )}
      </div>

      {/* Form Modals */}
      {menuForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase italic">{menuForm.id ? 'Sửa món' : 'Thêm món'}</h3>
              <button onClick={() => setMenuForm(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="Tên món" />
              <input type="number" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: Number(e.target.value)})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="Giá tiền" />
              <select value={menuForm.category || 'Tất cả'} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <button onClick={saveMenuItem} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">Lưu món</button>
            </div>
          </div>
        </div>
      )}

      {userForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase italic">{userForm.id ? 'Sửa NV' : 'Thêm NV'}</h3>
              <button onClick={() => setUserForm(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <input type="text" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="Họ tên" />
              <input type="text" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="Tên đăng nhập" />
              <input type="password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold" placeholder="Mật khẩu" />
              <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold">
                  {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={saveUser} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">Lưu NV</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
