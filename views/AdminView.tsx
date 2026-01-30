
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, OrderItemStatus, Table, UserRole, AppNotification, HistoryEntry, User, BankConfig, OrderItem } from '../types';
import { ConfirmModal } from '../App';
import { CATEGORIES } from '../constants';
import { Link } from 'react-router-dom';

interface AdminViewProps {
  store: any;
}

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'MONITOR' | 'REPORTS' | 'PAYMENTS' | 'MENU' | 'CLOUD' | 'USERS' | 'QR'>('MONITOR');
  const [confirmTableId, setConfirmTableId] = useState<number | null>(null);
  const [tempUrl, setTempUrl] = useState(store.cloudUrl);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  
  const [editingBank, setEditingBank] = useState<BankConfig>({ ...store.bankConfig });
  const [newUser, setNewUser] = useState<Partial<User>>({ role: UserRole.STAFF });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [newMenuItem, setNewMenuItem] = useState<Partial<MenuItem>>({
    category: CATEGORIES[1] || 'Bò',
    image: 'https://picsum.photos/seed/food/400/300'
  });

  const [customTask, setCustomTask] = useState('');
  const [taskTarget, setTaskTarget] = useState<UserRole>(UserRole.STAFF);

  const tableGroups = useMemo(() => {
    const tables: Table[] = store.tables || [];
    const groups = {
      qrRequests: tables.filter(t => t.qrRequested),
      pendingStaff: [] as number[],
      pendingKitchen: [] as number[],
      cooking: [] as number[],
      ready: [] as number[],
      paying: [] as number[]
    };
    tables.forEach(t => {
      const orders = t.currentOrders || [];
      if (t.status === TableStatus.PAYING) groups.paying.push(t.id);
      if (orders.some(o => o.status === OrderItemStatus.PENDING)) groups.pendingStaff.push(t.id);
      if (orders.some(o => o.status === OrderItemStatus.CONFIRMED)) groups.pendingKitchen.push(t.id);
      if (orders.some(o => o.status === OrderItemStatus.COOKING)) groups.cooking.push(t.id);
      if (orders.some(o => o.status === OrderItemStatus.READY)) groups.ready.push(t.id);
    });
    return groups;
  }, [store.tables]);

  const reportData = useMemo(() => {
    const history: HistoryEntry[] = store.history || [];
    const totalRevenue = history.reduce((sum, entry) => sum + entry.total, 0);
    const totalOrders = history.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    
    const categoryStats: Record<string, { revenue: number, count: number }> = {};
    const itemStats: Record<string, { count: number, revenue: number, category: string }> = {};
    let totalItemsSold = 0;

    history.forEach(entry => {
      entry.items.forEach(item => {
        const menuItem = store.menu.find((m: MenuItem) => m.id === item.menuItemId);
        const cat = menuItem?.category || 'Khác';
        
        if (!categoryStats[cat]) categoryStats[cat] = { revenue: 0, count: 0 };
        categoryStats[cat].revenue += (item.price * item.quantity);
        categoryStats[cat].count += item.quantity;

        if (!itemStats[item.name]) {
          itemStats[item.name] = { count: 0, revenue: 0, category: cat };
        }
        itemStats[item.name].count += item.quantity;
        itemStats[item.name].revenue += (item.price * item.quantity);
        totalItemsSold += item.quantity;
      });
    });

    const sortedItems = Object.entries(itemStats).sort((a, b) => b[1].revenue - a[1].revenue);

    return { totalRevenue, totalOrders, avgOrderValue, categoryStats, sortedItems, totalItemsSold };
  }, [store.history, store.menu]);

  const handleSaveBank = () => {
    store.updateBankConfig(editingBank);
    alert('Đã cập nhật cấu hình VietQR!');
  };

  const getTableQrUrl = (id: number, token?: string) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const tableUrl = token ? `${baseUrl}#/table/${id}/${token}` : `${baseUrl}#/table/${id}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableUrl)}`;
  };

  const handleSaveMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuItem.name || !newMenuItem.price || !newMenuItem.category) return;

    const menuItem: MenuItem = {
      id: editingMenuItemId || `m-${Date.now()}`,
      name: newMenuItem.name!,
      price: Number(newMenuItem.price),
      category: newMenuItem.category!,
      image: newMenuItem.image || 'https://picsum.photos/seed/food/400/300',
      description: newMenuItem.description || ''
    };

    const updatedMenu = editingMenuItemId
      ? store.menu.map((m: MenuItem) => m.id === editingMenuItemId ? menuItem : m)
      : [...store.menu, menuItem];

    store.saveAndPush(
      store.tables,
      updatedMenu,
      store.history,
      store.notifications,
      store.users,
      store.bankConfig
    );

    setNewMenuItem({
      category: CATEGORIES[1] || 'Bò',
      image: 'https://picsum.photos/seed/food/400/300'
    });
    setEditingMenuItemId(null);
  };

  return (
    <div className="animate-fadeIn pb-24">
      <ConfirmModal 
        isOpen={confirmTableId !== null}
        title="Xác nhận thanh toán"
        message={`Hoàn tất thu tiền Bàn ${confirmTableId}?`}
        onConfirm={() => { if(confirmTableId) store.confirmPayment(confirmTableId); setConfirmTableId(null); }}
        onCancel={() => setConfirmTableId(null)}
        type="success"
      />

      <div className="flex bg-white p-2 rounded-[2.5rem] mb-10 w-fit overflow-x-auto no-scrollbar max-w-full border border-slate-100 shadow-sm sticky top-20 z-30">
        {[
          { id: 'MONITOR', label: 'Điều hành', icon: '📡' },
          { id: 'REPORTS', label: 'Báo cáo', icon: '📊' },
          { id: 'PAYMENTS', label: 'Thu ngân', count: (store.tables || []).filter((t: Table) => t.status === TableStatus.PAYING).length, icon: '💰' },
          { id: 'QR', label: 'Mã QR Bàn', icon: '📱' },
          { id: 'MENU', label: 'Món ăn', icon: '🍽️' },
          { id: 'USERS', label: 'Nhân sự', icon: '👥' },
          { id: 'CLOUD', label: 'Cấu hình', icon: '⚙️' }
        ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveAdminTab(tab.id as any)} className={`px-6 py-4 rounded-[1.8rem] text-[11px] font-black transition-all flex items-center gap-2.5 whitespace-nowrap ${activeAdminTab === tab.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>
                <span className="text-xl">{tab.icon}</span>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && <span className="bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{tab.count}</span>}
            </button>
        ))}
      </div>

      {activeAdminTab === 'MONITOR' && (
        <div className="space-y-8">
            {tableGroups.qrRequests.length > 0 && (
                <div className="bg-orange-100 border border-orange-200 p-8 rounded-[3rem] animate-slideDown">
                    <h2 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-6">🔔 Yêu cầu cấp mã QR mới</h2>
                    <div className="flex flex-wrap gap-4">
                        {tableGroups.qrRequests.map(t => (
                            <div key={t.id} className="bg-white p-6 rounded-[2rem] flex items-center gap-6 shadow-sm">
                                <span className="font-black text-slate-800">Bàn {t.id}</span>
                                <button onClick={() => store.approveTableQr(t.id)} className="bg-orange-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-200">Cấp QR ngay</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-slate-900 text-white p-10 rounded-[4rem] shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-10">
                        <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Trung tâm điều phối</h2>
                        <div className="flex gap-3">
                           <Link to="/staff" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[9px] font-black uppercase transition-all">Sảnh Phục vụ</Link>
                           <Link to="/kitchen" className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[9px] font-black uppercase transition-all">Khu Nhà bếp</Link>
                        </div>
                    </div>
                    <div className="flex w-full gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 mb-8">
                         <input type="text" placeholder="Nhập yêu cầu nhanh cho nhân viên..." value={customTask} onChange={(e) => setCustomTask(e.target.value)} className="bg-transparent border-none outline-none px-4 py-2 text-xs font-bold flex-1 text-white placeholder:text-white/20" />
                         <select value={taskTarget} onChange={(e) => setTaskTarget(e.target.value as UserRole)} className="bg-white/10 border-none outline-none px-3 py-2 rounded-xl text-[9px] font-black uppercase text-white cursor-pointer">
                            <option value={UserRole.STAFF}>Phục vụ</option>
                            <option value={UserRole.KITCHEN}>Nhà bếp</option>
                         </select>
                         <button onClick={() => { if(!customTask.trim()) return; const notif: AppNotification = { id: `TASK-${Date.now()}`, targetRole: taskTarget, title: 'Lệnh từ Admin', message: customTask, timestamp: Date.now(), read: false, type: 'system' }; store.saveAndPush(store.tables, store.menu, store.history, [notif, ...store.notifications], store.users, store.bankConfig); setCustomTask(''); }} className="bg-blue-500 text-white px-8 py-2 rounded-xl font-black text-[10px] uppercase shadow-lg transition-all active:scale-95">Gửi lệnh</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: 'Bàn mới', list: tableGroups.pendingStaff },
                            { label: 'Chờ Bếp', list: tableGroups.pendingKitchen },
                            { label: 'Đang nấu', list: tableGroups.cooking },
                            { label: 'Chờ bưng', list: tableGroups.ready },
                            { label: 'Chờ tiền', list: tableGroups.paying }
                        ].map((group, idx) => (
                            <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-3xl">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-3">{group.label}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {group.list.length > 0 ? group.list.map(id => (
                                        <div key={id} className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] bg-white text-slate-900">{id}</div>
                                    )) : <span className="text-[8px] text-white/10 font-bold">---</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeAdminTab === 'REPORTS' && (
        <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900 p-8 rounded-[3rem] text-white col-span-1 md:col-span-2 shadow-xl">
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.3em] mb-4">Doanh thu tích lũy</p>
                    <h2 className="text-6xl font-black tracking-tighter">{reportData.totalRevenue.toLocaleString()}đ</h2>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Giá trị đơn TB</p>
                    <h2 className="text-4xl font-black text-slate-800">{reportData.avgOrderValue.toLocaleString()}đ</h2>
                </div>
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Món đã bán</p>
                    <h2 className="text-4xl font-black text-slate-800">{reportData.totalItemsSold}</h2>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
                    <h3 className="text-xl font-black text-slate-800 mb-10">📁 Theo Danh mục</h3>
                    <div className="space-y-8">
                        {(Object.entries(reportData.categoryStats) as [string, { revenue: number, count: number }][])
                            .sort((a, b) => b[1].revenue - a[1].revenue)
                            .map(([cat, stat]) => (
                            <div key={cat}>
                                <div className="flex justify-between items-end mb-3">
                                    <div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{cat}</div>
                                        <div className="text-base font-black text-slate-800">{stat.revenue.toLocaleString()}đ</div>
                                    </div>
                                    <div className="text-sm font-black text-orange-500">{Math.round((stat.revenue / (reportData.totalRevenue || 1)) * 100)}%</div>
                                </div>
                                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-900 rounded-full transition-all duration-1000" style={{ width: `${(stat.revenue / (reportData.totalRevenue || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
                    <h3 className="text-xl font-black text-slate-800 mb-10">🏆 Xếp hạng sản phẩm</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase">Sản phẩm</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase text-center">Đã bán</th>
                                    <th className="pb-4 text-[10px] font-black text-slate-400 uppercase text-right">Doanh thu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {reportData.sortedItems.slice(0, 10).map(([name, data]: [string, any], idx) => (
                                    <tr key={name} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 flex items-center gap-3">
                                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${idx < 3 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</span>
                                            <span className="text-sm font-bold text-slate-800">{name}</span>
                                        </td>
                                        <td className="py-4 text-center font-black text-slate-600">{data.count}</td>
                                        <td className="py-4 text-right font-black text-slate-800">{data.revenue.toLocaleString()}đ</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-10">
                    <h3 className="text-xl font-black text-slate-800">📜 Nhật ký giao dịch</h3>
                    <button onClick={() => setShowClearHistoryConfirm(true)} className="text-[10px] font-black text-red-500 uppercase">Xóa lịch sử</button>
                </div>
                <div className="space-y-4">
                    {store.history.slice(0, 10).map((h: HistoryEntry) => (
                        <div key={h.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 gap-4">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-200 font-black text-xl text-slate-800 shadow-sm">{h.tableId}</div>
                                <div>
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{h.date}</div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {h.items.map((it, i) => (
                                            <span key={i} className="text-[9px] font-black bg-white px-2 py-1 rounded-md border border-slate-100">{it.name} x{it.quantity}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black text-slate-900">{h.total.toLocaleString()}đ</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {activeAdminTab === 'QR' && (
        <div className="space-y-8 animate-fadeIn">
            <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm">
                <h3 className="text-2xl font-black text-slate-800 mb-2">Quản lý mã QR</h3>
                <p className="text-slate-400 text-sm mb-12">Lưu ý: Sử dụng định dạng URL tương thích với mọi thiết bị (iOS/Android).</p>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
                    {store.tables.map((t: Table) => (
                        <div key={t.id} className="flex flex-col items-center bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 group hover:border-orange-500 transition-all">
                            <div className="w-full aspect-square bg-white rounded-2xl p-4 mb-4 shadow-sm flex items-center justify-center overflow-hidden">
                                {t.sessionToken ? (
                                    <img src={getTableQrUrl(t.id, t.sessionToken)} alt={`QR Bàn ${t.id}`} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-full aspect-square opacity-20 filter grayscale">
                                            <img src={getTableQrUrl(t.id)} className="w-full h-full object-contain" />
                                        </div>
                                        <span className="text-[8px] text-slate-300 font-black uppercase text-center">Bàn trống</span>
                                    </div>
                                )}
                            </div>
                            <span className="font-black text-slate-800">BÀN {t.id}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {activeAdminTab === 'PAYMENTS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fadeIn">
            {(store.tables || []).filter((t:Table) => t.status === TableStatus.PAYING).map(t => (
                <div key={t.id} className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-900 shadow-2xl">
                    <h3 className="text-4xl font-black text-slate-800 mb-6">Bàn {t.id}</h3>
                    <div className="text-3xl font-black text-slate-900 mb-10 text-right">
                        {(t.currentOrders || []).reduce((s: number, o: OrderItem) => s + (o.price * o.quantity), 0).toLocaleString()}đ
                    </div>
                    <button onClick={() => setConfirmTableId(t.id)} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase shadow-xl transition-all active:scale-95">Xác nhận thanh toán</button>
                </div>
            ))}
            {(store.tables || []).filter((t:Table) => t.status === TableStatus.PAYING).length === 0 && (
                <div className="col-span-full py-32 text-center text-slate-300 font-bold uppercase border-2 border-dashed border-slate-100 rounded-[3rem]">Chưa có yêu cầu thanh toán</div>
            )}
        </div>
      )}

      {activeAdminTab === 'MENU' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm h-fit sticky top-40">
                <h3 className="text-lg font-black text-slate-800 mb-8">{editingMenuItemId ? '📝 Sửa món ăn' : '🍽️ Thêm món mới'}</h3>
                <form onSubmit={handleSaveMenuItem} className="space-y-4">
                    <input type="text" placeholder="Tên món" value={newMenuItem.name || ''} onChange={e => setNewMenuItem({...newMenuItem, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-50 focus:border-slate-900 outline-none text-xs font-bold" />
                    <input type="number" placeholder="Giá bán" value={newMenuItem.price || ''} onChange={e => setNewMenuItem({...newMenuItem, price: Number(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-50 focus:border-slate-900 outline-none text-xs font-bold" />
                    <select value={newMenuItem.category} onChange={e => setNewMenuItem({...newMenuItem, category: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-50 focus:border-slate-900 outline-none text-xs font-bold">
                        {CATEGORIES.filter(c => c !== 'Tất cả').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <textarea placeholder="Mô tả món ăn" value={newMenuItem.description || ''} onChange={e => setNewMenuItem({...newMenuItem, description: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-50 focus:border-slate-900 outline-none text-xs font-bold" rows={3}></textarea>
                    <div className="flex gap-2">
                       {editingMenuItemId && <button type="button" onClick={() => {setEditingMenuItemId(null); setNewMenuItem({category: CATEGORIES[1]});}} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl font-black text-[11px] uppercase">Hủy</button>}
                       <button type="submit" className="flex-[2] py-5 bg-orange-500 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl">Lưu món ăn</button>
                    </div>
                </form>
            </div>
            <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-sm p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {store.menu.map((item: MenuItem) => (
                    <div key={item.id} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-3xl hover:border-orange-500 transition-all">
                        <img src={item.image} className="w-20 h-20 rounded-2xl object-cover" alt={item.name} />
                        <div className="flex-1 min-w-0">
                            <h4 className="font-black text-sm text-slate-800 truncate">{item.name}</h4>
                            <p className="text-sm font-black text-orange-600">{item.price.toLocaleString()}đ</p>
                            <div className="mt-3 flex gap-4">
                                <button onClick={() => {setEditingMenuItemId(item.id); setNewMenuItem(item);}} className="text-[10px] font-black text-blue-500 uppercase">Sửa</button>
                                <button onClick={() => {if(confirm('Xóa món này?')) store.saveAndPush(store.tables, store.menu.filter((m:any)=>m.id!==item.id), store.history, store.notifications, store.users, store.bankConfig)}} className="text-[10px] font-black text-red-400 uppercase">Xóa</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {activeAdminTab === 'USERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm h-fit sticky top-40">
                <h3 className="text-lg font-black text-slate-800 mb-8">{editingUserId ? '📝 Sửa nhân sự' : '👥 Thêm nhân sự'}</h3>
                <form onSubmit={(e) => { e.preventDefault(); if(!newUser.username || !newUser.password || !newUser.fullName) return; const userObj: User = { id: editingUserId || `u-${Date.now()}`, username: newUser.username!, password: newUser.password!, role: newUser.role as UserRole, fullName: newUser.fullName! }; const updatedUsers = editingUserId ? store.users.map((u: User) => u.id === editingUserId ? userObj : u) : [...store.users, userObj]; store.manageUsers(updatedUsers); setNewUser({ role: UserRole.STAFF }); setEditingUserId(null); }} className="space-y-4">
                    <input type="text" placeholder="Họ và tên" value={newUser.fullName || ''} onChange={e => setNewUser({...newUser, fullName: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-slate-900 outline-none text-xs font-bold" />
                    <input type="text" placeholder="Tên đăng nhập" value={newUser.username || ''} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-slate-900 outline-none text-xs font-bold" />
                    <input type="password" placeholder="Mật khẩu" value={newUser.password || ''} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-slate-900 outline-none text-xs font-bold" />
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-slate-900 outline-none text-xs font-bold">
                        <option value={UserRole.STAFF}>Phục vụ</option>
                        <option value={UserRole.KITCHEN}>Nhà bếp</option>
                        <option value={UserRole.ADMIN}>Admin</option>
                    </select>
                    <div className="flex gap-2">
                       {editingUserId && <button type="button" onClick={() => {setEditingUserId(null); setNewUser({role: UserRole.STAFF});}} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl font-black text-[11px] uppercase">Hủy</button>}
                       <button type="submit" className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl">Lưu nhân sự</button>
                    </div>
                </form>
            </div>
            <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead><tr className="bg-slate-50/50"><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase">Nhân viên</th><th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase">Quyền</th><th className="px-10 py-6 text-right">Thao tác</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                        {(store.users || []).map((u: User) => (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-10 py-6">
                                    <div className="font-black text-sm text-slate-800">{u.fullName}</div>
                                    <div className="text-[10px] text-slate-400 font-bold">@{u.username}</div>
                                </td>
                                <td className="px-10 py-6">
                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${u.role === UserRole.ADMIN ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{u.role}</span>
                                </td>
                                <td className="px-10 py-6 text-right space-x-4">
                                    <button onClick={() => {setEditingUserId(u.id); setNewUser(u);}} className="text-blue-500 font-black text-[10px] uppercase">Sửa</button>
                                    {u.id !== 'u-admin' && <button onClick={() => {if(confirm('Xóa nhân viên này?')) store.manageUsers(store.users.filter((usr:any)=>usr.id!==u.id))}} className="text-red-400 font-black text-[10px] uppercase">Xóa</button>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {activeAdminTab === 'CLOUD' && (
        <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
            <div className="bg-white rounded-[3.5rem] p-12 shadow-sm border border-slate-100">
                <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">🔗 Đồng bộ Đám mây</h2>
                <div className="flex gap-3">
                    <input type="text" value={tempUrl} onChange={e => setTempUrl(e.target.value)} className="flex-1 px-8 py-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-xs" placeholder="Nhập URL Firebase (.json)" />
                    <button onClick={() => store.updateCloudUrl(tempUrl)} className="bg-slate-900 text-white px-10 rounded-[2rem] font-black text-[11px] uppercase shadow-lg">Lưu URL</button>
                </div>
            </div>

            <div className="bg-white rounded-[3.5rem] p-12 shadow-sm border border-slate-100">
                <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase tracking-tight">🏦 QR Thanh toán (VietQR)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">Ngân hàng</label>
                        <select value={editingBank.bankId} onChange={e => setEditingBank({...editingBank, bankId: e.target.value})} className="w-full px-8 py-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-xs">
                            <option value="ICB">VietinBank</option><option value="VCB">Vietcombank</option><option value="MB">MBBank</option><option value="TCB">Techcombank</option>
                        </select>
                    </div>
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">Số tài khoản</label>
                        <input type="text" value={editingBank.accountNo} onChange={e => setEditingBank({...editingBank, accountNo: e.target.value})} className="w-full px-8 py-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-xs" />
                    </div>
                </div>
                <div className="space-y-3 mb-8">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">Tên chủ tài khoản (Không dấu)</label>
                    <input type="text" value={editingBank.accountName} onChange={e => setEditingBank({...editingBank, accountName: e.target.value.toUpperCase()})} placeholder="NGUYEN VAN A" className="w-full px-8 py-6 bg-slate-50 rounded-[2rem] outline-none font-bold text-xs" />
                </div>
                <button onClick={handleSaveBank} className="w-full bg-orange-500 text-white py-6 rounded-[2rem] font-black text-[11px] uppercase shadow-xl hover:bg-orange-600 transition-all">Lưu thông tin VietQR</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
