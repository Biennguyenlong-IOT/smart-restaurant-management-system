
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry } from '../types';
import { CATEGORIES, INITIAL_MENU } from '../constants';
import { 
  ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, 
  Trash2, X, Edit3, Database, Cloud, LayoutDashboard, TrendingUp, 
  ShoppingBag, DollarSign, Calendar, QrCode, Share2, Copy, PowerOff, 
  Search, Image as ImageIcon, Save
} from 'lucide-react';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'CLOUD'>('DASHBOARD');
  const [tempCloudUrl, setTempCloudUrl] = useState(store.cloudUrl);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // States cho Form Quản lý
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const activeRequests = useMemo(() => 
    (store.notifications || []).filter((n: AppNotification) => n.type === 'move_request' || n.type === 'qr_request')
  , [store.notifications]);

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

  const handleUpdateCloudUrl = () => {
    if (!tempCloudUrl.startsWith('http')) {
      alert("URL không hợp lệ! URL phải bắt đầu bằng http:// hoặc https://");
      return;
    }
    store.updateCloudUrl(tempCloudUrl);
    alert("Đã cập nhật Database thành công.");
  };

  const getSetupLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    const encodedUrl = btoa(store.cloudUrl);
    return `${baseUrl}?config=${encodedUrl}`;
  };

  const getSetupQrUrl = () => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getSetupLink())}`;
  };

  // Logic thực đơn
  const filteredMenu = useMemo(() => 
    store.menu.filter((m: MenuItem) => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
  , [store.menu, searchTerm]);

  const saveMenuItem = () => {
    if (!menuForm?.name || !menuForm?.price) return alert("Vui lòng điền tên và giá món!");
    const finalItem = {
      ...menuForm,
      id: menuForm.id || `m-${Date.now()}`,
      image: menuForm.image || 'https://picsum.photos/seed/food/400/300',
      category: menuForm.category || 'Tất cả'
    } as MenuItem;
    store.upsertMenuItem(finalItem);
    setMenuForm(null);
  };

  // Logic người dùng
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
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8 px-4">Đưa nhân viên quét mã này để tự động kết nối hệ thống</p>
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-8">
              <img src={getSetupQrUrl()} alt="Setup QR" className="w-full h-auto rounded-xl" />
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => { navigator.clipboard.writeText(getSetupLink()); alert("Đã copy link!"); }}
                className="w-full py-4 bg-slate-100 text-slate-800 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2"
              >
                <Copy size={14}/> Copy Link gửi Zalo
              </button>
              <button onClick={() => setShowShareModal(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Món ăn */}
      {menuForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 italic uppercase">{menuForm.id ? 'Sửa món ăn' : 'Thêm món mới'}</h3>
              <button onClick={() => setMenuForm(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Tên món</label>
                <input type="text" value={menuForm.name || ''} onChange={e => setMenuForm({...menuForm, name: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-orange-500" placeholder="Nhập tên món..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Giá (VNĐ)</label>
                  <input type="number" value={menuForm.price || ''} onChange={e => setMenuForm({...menuForm, price: Number(e.target.value)})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-orange-500" placeholder="VD: 50000" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Danh mục</label>
                  <select value={menuForm.category || 'Tất cả'} onChange={e => setMenuForm({...menuForm, category: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 appearance-none">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">URL Hình ảnh</label>
                <input type="text" value={menuForm.image || ''} onChange={e => setMenuForm({...menuForm, image: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-orange-500" placeholder="https://..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Mô tả ngắn</label>
                <textarea value={menuForm.description || ''} onChange={e => setMenuForm({...menuForm, description: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-orange-500 h-24" placeholder="Nguyên liệu, cách chế biến..." />
              </div>
              <button onClick={saveMenuItem} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 mt-4 active:scale-95 transition-all">
                <Save size={16}/> Lưu món ăn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form Người dùng */}
      {userForm && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 italic uppercase">{userForm.id ? 'Sửa nhân sự' : 'Thêm nhân sự'}</h3>
              <button onClick={() => setUserForm(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Họ và tên</label>
                <input type="text" value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" placeholder="VD: Nguyễn Văn A" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Tên đăng nhập</label>
                <input type="text" value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" placeholder="VD: nhanvien01" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Mật khẩu</label>
                <input type="password" value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" placeholder="Nhập pass..." />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Vai trò</label>
                <select value={userForm.role || UserRole.STAFF} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none appearance-none">
                  {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button onClick={saveUser} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-2 mt-4 active:scale-95 transition-all">
                <UserPlus size={16}/> Lưu thông tin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex bg-white p-1.5 rounded-2xl mb-6 w-full overflow-x-auto no-scrollbar border border-slate-200 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'DASHBOARD', label: 'Báo cáo', icon: <LayoutDashboard size={18}/> },
          { id: 'MONITOR', label: 'Bàn ăn', icon: <Monitor size={18}/> },
          { id: 'REQUESTS', label: 'Yêu cầu', icon: <ArrowRightLeft size={18}/>, count: activeRequests.length },
          { id: 'MENU', label: 'Thực đơn', icon: <Pizza size={18}/> },
          { id: 'USERS', label: 'Nhân sự', icon: <Shield size={18}/> },
          { id: 'CLOUD', label: 'Cấu hình', icon: <Settings size={18}/> }
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

      {/* Main Content Areas */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-4"><DollarSign size={24}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Doanh thu hôm nay</p>
                <h3 className="text-2xl font-black text-slate-800">{stats.todayRevenue.toLocaleString()}đ</h3>
                <p className="text-[10px] font-bold text-green-500 mt-2 flex items-center gap-1"><TrendingUp size={12}/> {stats.todayOrdersCount} đơn hàng</p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-4"><ShoppingBag size={24}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng đơn hàng</p>
                <h3 className="text-2xl font-black text-slate-800">{stats.totalOrders}</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-2">Dữ liệu từ lúc bắt đầu</p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center mb-4"><TrendingUp size={24}/></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Giá trị trung bình</p>
                <h3 className="text-2xl font-black text-slate-800">{Math.round(stats.avgOrder).toLocaleString()}đ</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-2">Mỗi hóa đơn</p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mb-4 font-black">Σ</div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tổng doanh thu</p>
                <h3 className="text-2xl font-black text-slate-800">{stats.totalRevenue.toLocaleString()}đ</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-2">Toàn bộ thời gian</p>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
              <h4 className="font-black text-slate-800 uppercase italic mb-8 flex items-center gap-2 text-sm">
                <Calendar size={18} className="text-orange-500" /> Hoạt động gần đây
              </h4>
              <div className="space-y-4">
                {store.history.length === 0 ? (
                  <div className="py-20 text-center text-slate-300 font-bold italic border-2 border-dashed border-slate-50 rounded-3xl">Chưa có giao dịch nào</div>
                ) : (
                  store.history.slice(0, 10).map((h: HistoryEntry) => (
                    <div key={h.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-white hover:border-slate-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-xs shadow-sm italic">B{h.tableId}</div>
                        <div>
                          <p className="text-[11px] font-black text-slate-800">Thanh toán Bàn {h.tableId}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{h.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-800">+{h.total.toLocaleString()}đ</p>
                        <p className="text-[9px] font-bold text-green-500 uppercase">Hoàn tất</p>
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
              <div key={t.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-orange-200 transition-all min-h-[160px]">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-black text-lg italic text-slate-800">Bàn {t.id}</h3>
                    <div className={`w-2.5 h-2.5 rounded-full ${t.status === TableStatus.AVAILABLE ? 'bg-slate-200' : 'bg-orange-500 animate-pulse'}`}></div>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter truncate">{t.claimedBy ? `NV: ${t.claimedBy}` : 'Trống'}</p>
                </div>
                <button 
                  onClick={() => { if(window.confirm(`Đóng bàn cưỡng chế? Dữ liệu đơn hàng bàn ${t.id} sẽ mất.`)) store.adminForceClose(t.id); }}
                  className="w-full py-2.5 mt-4 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase flex items-center justify-center gap-1.5 hover:bg-black transition-all"
                >
                  <PowerOff size={10} /> Đóng bàn
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'MENU' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm kiếm món ăn..." className="w-full pl-12 pr-6 py-3.5 bg-slate-50 rounded-2xl font-bold text-sm outline-none border border-transparent focus:border-slate-200 transition-all" />
              </div>
              <button onClick={() => setMenuForm({})} className="bg-orange-500 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                <Plus size={16}/> Thêm món
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMenu.map((item: MenuItem) => (
                <div key={item.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 flex gap-4 shadow-sm hover:shadow-md transition-shadow">
                  <img src={item.image} className="w-20 h-20 rounded-2xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.category}</span>
                      <h4 className="font-black text-slate-800 text-sm truncate">{item.name}</h4>
                      <p className="font-black text-orange-600 text-xs mt-1">{item.price.toLocaleString()}đ</p>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setMenuForm(item)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100"><Edit3 size={14}/></button>
                      <button onClick={() => { if(window.confirm(`Xoá món ${item.name}?`)) store.deleteMenuItem(item.id); }} className="p-2 bg-red-50 text-red-400 rounded-xl hover:bg-red-100"><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'USERS' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100">
              <div>
                <h4 className="font-black text-slate-800 uppercase italic">Danh sách nhân sự</h4>
                <p className="text-[10px] font-bold text-slate-400">Quản lý tài khoản truy cập hệ thống</p>
              </div>
              <button onClick={() => setUserForm({})} className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl font-black uppercase text-[10px] flex items-center gap-2 shadow-lg active:scale-95 transition-all">
                <UserPlus size={18}/> Thêm mới
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {store.users.map((u: User) => (
                <div key={u.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                      <Shield size={24}/>
                    </div>
                    <div>
                      <h5 className="font-black text-slate-800 text-sm">{u.fullName}</h5>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${u.role === UserRole.ADMIN ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>{u.role}</span>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">@{u.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setUserForm(u)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100"><Edit3 size={16}/></button>
                    <button onClick={() => { if(window.confirm(`Xoá tài khoản ${u.username}?`)) store.deleteUser(u.id); }} className="p-2.5 bg-red-50 text-red-400 rounded-xl hover:bg-red-100"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'REQUESTS' && (
          <div className="space-y-4">
            {activeRequests.length === 0 ? (
              <div className="py-20 text-center text-slate-300 font-bold italic border-2 border-dashed border-slate-100 rounded-3xl">Chưa có yêu cầu mới</div>
            ) : (
              activeRequests.map((r: AppNotification) => (
                <div key={r.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between animate-scaleIn">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${r.type === 'qr_request' ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>
                       {r.type === 'qr_request' ? <QrCode size={24} /> : <ArrowRightLeft size={24} />}
                    </div>
                    <div>
                      <h4 className="font-black uppercase text-slate-800 italic">{r.type === 'qr_request' ? 'Mở bàn mới (QR)' : (r.payload?.type === 'SWAP' ? 'Đổi bàn' : 'Gộp bàn')}</h4>
                      <p className="text-[11px] font-bold text-slate-500">
                        {r.type === 'qr_request' ? `Bàn ${r.payload?.tableId} - NV ${r.payload?.staffId}` : `Bàn ${r.payload?.fromId} → ${r.payload?.toId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => store.deleteNotification(r.id)} className="px-4 py-2 bg-slate-100 rounded-xl font-black text-[9px] uppercase">Hủy</button>
                    <button 
                      onClick={() => r.type === 'qr_request' ? store.approveTableQr(r.id) : store.approveMoveRequest(r.id)} 
                      className={`px-4 py-2 text-white rounded-xl font-black text-[9px] uppercase shadow-lg transition-all active:scale-95 ${r.type === 'qr_request' ? 'bg-orange-500 shadow-orange-500/20' : 'bg-slate-900 shadow-slate-900/20'}`}
                    >
                      {r.type === 'qr_request' ? 'Cấp QR' : 'Duyệt'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        {activeTab === 'CLOUD' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h4 className="font-black italic mb-4 flex items-center gap-2 uppercase text-slate-800"><Cloud size={18} className="text-blue-500" /> Cloud DB</h4>
              <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase">Đường dẫn Firebase Realtime Database của bạn:</p>
              <input 
                type="text" 
                value={tempCloudUrl} 
                onChange={e => setTempCloudUrl(e.target.value)} 
                placeholder="https://your-db.firebaseio.com"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl mb-4 font-bold text-xs" 
              />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleUpdateCloudUrl} className="bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] shadow-xl shadow-slate-900/10 active:scale-95 transition-all">Lưu Cấu Hình</button>
                <button onClick={() => setShowShareModal(true)} className="bg-orange-500 text-white py-4 rounded-xl font-black uppercase text-[10px] shadow-xl shadow-orange-500/10 flex items-center justify-center gap-2 active:scale-95 transition-all">
                  <Share2 size={16}/> Chia sẻ cho NV
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminView;
