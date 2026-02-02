
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, Table, UserRole, AppNotification, User, HistoryEntry } from '../types';
import { CATEGORIES } from '../constants';
import { ArrowRightLeft, Monitor, Settings, Plus, UserPlus, Pizza, Shield, Trash2, X, Edit3, Database, Cloud, LayoutDashboard, TrendingUp, ShoppingBag, DollarSign, Calendar, QrCode, Share2, Copy } from 'lucide-react';

interface AdminViewProps { store: any; }

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'MONITOR' | 'MENU' | 'USERS' | 'REQUESTS' | 'CLOUD'>('DASHBOARD');
  const [tableCount, setTableCount] = useState(store.tables.length);
  const [tempCloudUrl, setTempCloudUrl] = useState(store.cloudUrl);
  const [menuForm, setMenuForm] = useState<Partial<MenuItem> | null>(null);
  const [userForm, setUserForm] = useState<Partial<User> | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

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

  return (
    <div className="h-full flex flex-col animate-fadeIn">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
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
          </div>
        )}

        {activeTab === 'MONITOR' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {store.tables.map((t: Table) => (
              <div key={t.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:border-orange-200 transition-all">
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-black text-lg italic">Bàn {t.id}</h3>
                    <div className={`w-2 h-2 rounded-full ${t.status === TableStatus.AVAILABLE ? 'bg-slate-200' : 'bg-orange-500 animate-pulse'}`}></div>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter truncate">{t.claimedBy ? `NV: ${t.claimedBy}` : 'Trống'}</p>
                  {t.sessionToken && <p className="text-[8px] text-green-500 font-black mt-1">QR ACTIVE</p>}
                </div>
                <button onClick={() => store.adminForceClose(t.id)} className="w-full py-2 bg-red-50 text-red-500 rounded-xl font-black text-[9px] uppercase hover:bg-red-500 hover:text-white transition-all">Xoá Bill</button>
              </div>
            ))}
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
            
            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
               <h5 className="text-[10px] font-black text-blue-900 uppercase mb-2">Mẹo setup nhanh:</h5>
               <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                 Admin hãy nhấn "Chia sẻ cho NV" và đưa mã QR cho các nhân viên khác quét. Họ sẽ không cần phải nhập URL thủ công nữa!
               </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminView;
