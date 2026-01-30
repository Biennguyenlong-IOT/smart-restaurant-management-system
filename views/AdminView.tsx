
import React, { useState, useMemo } from 'react';
import { MenuItem, TableStatus, OrderItemStatus, Table, UserRole, AppNotification, HistoryEntry, User, BankConfig, OrderItem } from '../types';
import { ConfirmModal } from '../App';
import { CATEGORIES } from '../constants';
import { Link } from 'react-router-dom';

interface AdminViewProps {
  store: any;
}

const AdminView: React.FC<AdminViewProps> = ({ store }) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'MONITOR' | 'REPORTS' | 'PAYMENTS' | 'MENU' | 'CLOUD' | 'USERS'>('MONITOR');
  const [confirmTableId, setConfirmTableId] = useState<number | null>(null);
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

  return (
    <div className="animate-fadeIn h-full flex flex-col">
      <ConfirmModal 
        isOpen={confirmTableId !== null}
        title="Xác nhận thanh toán"
        message={`Hoàn tất thu tiền Bàn ${confirmTableId}?`}
        onConfirm={() => { if(confirmTableId) store.confirmPayment(confirmTableId); setConfirmTableId(null); }}
        onCancel={() => setConfirmTableId(null)}
        type="success"
      />

      <ConfirmModal 
        isOpen={showClearHistoryConfirm}
        title="Xóa lịch sử giao dịch"
        message="Bạn có chắc chắn muốn xóa toàn bộ lịch sử? Hành động này không thể hoàn tác."
        confirmText="Xóa tất cả"
        onConfirm={() => { store.clearHistory(); setShowClearHistoryConfirm(false); }}
        onCancel={() => setShowClearHistoryConfirm(false)}
        type="danger"
      />

      <div className="flex bg-white p-2 rounded-[1.8rem] mb-6 w-fit overflow-x-auto no-scrollbar max-w-full border border-slate-100 shadow-sm sticky top-0 z-30 shrink-0">
        {[
          { id: 'MONITOR', label: 'Điều hành', icon: '📡' },
          { id: 'REPORTS', label: 'Báo cáo', icon: '📊' },
          { id: 'PAYMENTS', label: 'Thu ngân', count: (store.tables || []).filter((t: Table) => t.status === TableStatus.PAYING).length, icon: '💰' },
          { id: 'MENU', label: 'Món ăn', icon: '🍽️' },
          { id: 'USERS', label: 'Nhân sự', icon: '👥' },
          { id: 'CLOUD', label: 'Cấu hình', icon: '⚙️' }
        ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveAdminTab(tab.id as any)} className={`px-4 py-3 md:px-6 md:py-4 rounded-[1.4rem] text-[10px] font-black transition-all flex items-center gap-2 whitespace-nowrap ${activeAdminTab === tab.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400'}`}>
                <span className="text-lg md:text-xl">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && <span className="bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px]">{tab.count}</span>}
            </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeAdminTab === 'MONITOR' && (
            <div className="space-y-6 pb-20">
                {tableGroups.qrRequests.length > 0 && (
                    <div className="bg-orange-500/10 border border-orange-500/20 p-6 rounded-[2.5rem] animate-slideDown">
                        <h2 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></span>
                            Yêu cầu cấp mã QR
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            {tableGroups.qrRequests.map(t => (
                                <div key={t.id} className="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-orange-100">
                                    <span className="font-black text-slate-800 text-sm italic">Bàn {t.id}</span>
                                    <button onClick={() => store.approveTableQr(t.id)} className="bg-orange-500 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-transform">Cấp ngay</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Trung tâm điều phối</h2>
                        </div>
                        <div className="flex w-full gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 mb-8">
                            <input type="text" placeholder="Gửi lệnh cho nhân viên..." value={customTask} onChange={(e) => setCustomTask(e.target.value)} className="bg-transparent border-none outline-none px-4 py-2 text-xs font-bold flex-1 text-white placeholder:text-white/20" />
                            <select value={taskTarget} onChange={(e) => setTaskTarget(e.target.value as UserRole)} className="bg-white/10 border-none outline-none px-3 py-2 rounded-xl text-[8px] font-black uppercase text-white cursor-pointer appearance-none">
                                <option value={UserRole.STAFF}>Phục vụ</option>
                                <option value={UserRole.KITCHEN}>Nhà bếp</option>
                            </select>
                            <button onClick={() => { if(!customTask.trim()) return; const notif: AppNotification = { id: `TASK-${Date.now()}`, targetRole: taskTarget, title: 'Lệnh từ Admin', message: customTask, timestamp: Date.now(), read: false, type: 'system' }; store.saveAndPush(store.tables, store.menu, store.history, [notif, ...store.notifications], store.users, store.bankConfig); setCustomTask(''); }} className="bg-blue-500 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg active:scale-95 transition-transform">Gửi</button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {[
                                { label: 'Bàn mới', list: tableGroups.pendingStaff },
                                { label: 'Chờ Bếp', list: tableGroups.pendingKitchen },
                                { label: 'Đang nấu', list: tableGroups.cooking },
                                { label: 'Chờ bưng', list: tableGroups.ready },
                                { label: 'Chờ tiền', list: tableGroups.paying }
                            ].map((group, idx) => (
                                <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                                    <h3 className="text-[8px] font-black uppercase tracking-widest text-white/30 mb-2">{group.label}</h3>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.list.length > 0 ? group.list.map(id => (
                                            <div key={id} className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[9px] bg-white text-slate-900 shadow-inner">{id}</div>
                                        )) : <span className="text-[8px] text-white/10 font-bold">---</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeAdminTab === 'USERS' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn pb-20">
                <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-fit">
                    <h3 className="text-lg font-black text-slate-800 mb-8">{editingUserId ? '📝 Sửa nhân sự' : '👥 Thêm nhân sự'}</h3>
                    <form onSubmit={(e) => { e.preventDefault(); if(!newUser.username || !newUser.password || !newUser.fullName) return; const userObj: User = { id: editingUserId || `u-${Date.now()}`, username: newUser.username!, password: newUser.password!, role: newUser.role as UserRole, fullName: newUser.fullName! }; const updatedUsers = editingUserId ? store.users.map((u: User) => u.id === editingUserId ? userObj : u) : [...store.users, userObj]; store.manageUsers(updatedUsers); setNewUser({ role: UserRole.STAFF }); setEditingUserId(null); }} className="space-y-4">
                        <input type="text" placeholder="Họ và tên" value={newUser.fullName || ''} onChange={e => setNewUser({...newUser, fullName: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-slate-900 outline-none text-[11px] font-bold" />
                        <input type="text" placeholder="Tên đăng nhập" value={newUser.username || ''} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-slate-900 outline-none text-[11px] font-bold" />
                        <input type="password" placeholder="Mật khẩu" value={newUser.password || ''} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-slate-900 outline-none text-[11px] font-bold" />
                        <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="w-full px-5 py-4 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-slate-900 outline-none text-[11px] font-bold appearance-none">
                            <option value={UserRole.STAFF}>Phục vụ</option>
                            <option value={UserRole.KITCHEN}>Nhà bếp</option>
                            <option value={UserRole.ADMIN}>Admin</option>
                        </select>
                        <div className="flex gap-2 pt-4">
                        {editingUserId && <button type="button" onClick={() => {setEditingUserId(null); setNewUser({role: UserRole.STAFF});}} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-xl font-black text-[10px] uppercase">Hủy</button>}
                        <button type="submit" className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-transform">Lưu nhân sự</button>
                        </div>
                    </form>
                </div>
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden h-fit">
                    <table className="w-full text-left">
                        <thead><tr className="bg-slate-50/50"><th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nhân viên</th><th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Quyền</th><th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Trạng thái / Thao tác</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                            {(store.users || []).map((u: User) => {
                                const isOnline = u.lastActive && (Date.now() - u.lastActive < 35000);
                                return (
                                    <tr key={u.id} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="px-8 py-5">
                                            <div className="font-black text-sm text-slate-800">{u.fullName}</div>
                                            <div className="text-[9px] text-slate-400 font-bold italic">@{u.username}</div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${u.role === UserRole.ADMIN ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{u.role}</span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-6">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-200'}`}></span>
                                                    <span className={`text-[9px] font-black uppercase ${isOnline ? 'text-green-600' : 'text-slate-300'}`}>{isOnline ? 'Online' : 'Offline'}</span>
                                                </div>
                                                <div className="space-x-4">
                                                    <button onClick={() => {setEditingUserId(u.id); setNewUser(u);}} className="text-blue-500 font-black text-[10px] uppercase hover:underline">Sửa</button>
                                                    {u.id !== 'u-admin' && <button onClick={() => {if(confirm('Xóa nhân viên này?')) store.manageUsers(store.users.filter((usr:any)=>usr.id!==u.id))}} className="text-red-400 font-black text-[10px] uppercase hover:underline">Xóa</button>}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeAdminTab === 'REPORTS' && <div className="animate-fadeIn pb-20"><ReportView reportData={reportData} history={store.history} clearHistory={() => setShowClearHistoryConfirm(true)} /></div>}
        {activeAdminTab === 'PAYMENTS' && <div className="animate-fadeIn pb-20"><PaymentMonitoring tables={store.tables} onConfirm={setConfirmTableId} /></div>}
        {activeAdminTab === 'MENU' && <div className="animate-fadeIn pb-20"><MenuManagement menu={store.menu} categories={CATEGORIES} onSave={store.saveAndPush} tables={store.tables} history={store.history} notifications={store.notifications} users={store.users} bankConfig={store.bankConfig} /></div>}
        {activeAdminTab === 'CLOUD' && <div className="animate-fadeIn pb-20"><CloudSettings cloudUrl={store.cloudUrl} updateCloudUrl={store.updateCloudUrl} bankConfig={store.bankConfig} updateBankConfig={store.updateBankConfig} /></div>}
      </div>
    </div>
  );
};

// Sub-components to keep AdminView readable
const ReportView = ({ reportData, history, clearHistory }: any) => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl">
                <p className="text-[9px] font-black text-orange-400 uppercase tracking-[0.2em] mb-2">Doanh thu</p>
                <h2 className="text-4xl font-black">{reportData.totalRevenue.toLocaleString()}đ</h2>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Đơn hàng</p>
                <h2 className="text-4xl font-black text-slate-800">{reportData.totalOrders}</h2>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Món đã bán</p>
                <h2 className="text-4xl font-black text-slate-800">{reportData.totalItemsSold}</h2>
            </div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black">Nhật ký giao dịch</h3>
                <button onClick={clearHistory} className="text-[11px] font-black text-red-500 uppercase tracking-widest px-4 py-2 bg-red-50 rounded-xl active:scale-95 transition-transform">Xóa toàn bộ lịch sử</button>
            </div>
            <div className="space-y-3">
                {history.length === 0 ? (
                    <div className="py-20 text-center text-slate-300 font-bold uppercase italic text-[10px]">Lịch sử trống</div>
                ) : (
                    history.slice(0, 50).map((h: any) => (
                        <div key={h.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-white">
                            <div>
                                <span className="text-[10px] font-black text-slate-800 mr-2 uppercase tracking-tight">Bàn {h.tableId}</span>
                                <span className="text-[9px] text-slate-400 font-medium">{h.date}</span>
                            </div>
                            <span className="font-black text-slate-900 text-sm">{h.total.toLocaleString()}đ</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
);

const PaymentMonitoring = ({ tables, onConfirm }: any) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tables.filter((t:any) => t.status === TableStatus.PAYING).map((t:any) => (
            <div key={t.id} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-900 shadow-xl">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-3xl font-black text-slate-800 italic">Bàn {t.id}</h3>
                    <span className="text-[9px] font-black px-2 py-1 bg-orange-100 text-orange-600 rounded-lg uppercase">Yêu cầu thu</span>
                </div>
                <div className="text-2xl font-black text-slate-900 mb-8">
                    {t.currentOrders.reduce((s:any, o:any) => s + (o.price * o.quantity), 0).toLocaleString()}đ
                </div>
                <button onClick={() => onConfirm(t.id)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform">Xác nhận thu tiền</button>
            </div>
        ))}
        {tables.filter((t:any) => t.status === TableStatus.PAYING).length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-300 font-bold uppercase italic border-2 border-dashed border-slate-100 rounded-[3rem] text-[10px]">Chưa có yêu cầu thanh toán</div>
        )}
    </div>
);

const MenuManagement = ({ menu, categories, onSave, tables, history, notifications, users, bankConfig }: any) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<any>({ category: categories[1] });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-fit">
                <h3 className="text-lg font-black text-slate-800 mb-6">{editingId ? 'Sửa món' : 'Thêm món'}</h3>
                <div className="space-y-3">
                    <input type="text" placeholder="Tên món" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border-2 border-slate-100 focus:border-slate-900 outline-none text-xs font-bold" />
                    <input type="number" placeholder="Giá" value={form.price || ''} onChange={e => setForm({...form, price: Number(e.target.value)})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border-2 border-slate-100 focus:border-slate-900 outline-none text-xs font-bold" />
                    <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-5 py-3.5 bg-slate-50 rounded-xl border-2 border-slate-100 focus:border-slate-900 outline-none text-xs font-bold appearance-none">
                        {categories.filter((c:any) => c !== 'Tất cả').map((c:any) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={() => {
                        const m = editingId ? menu.map((it:any) => it.id === editingId ? {...form, id: editingId} : it) : [...menu, {...form, id: `m-${Date.now()}`}];
                        onSave(tables, m, history, notifications, users, bankConfig);
                        setEditingId(null); setForm({category: categories[1]});
                    }} className="w-full bg-orange-500 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest mt-4 shadow-lg shadow-orange-100">Lưu món</button>
                </div>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {menu.map((m: any) => (
                    <div key={m.id} className="bg-white p-4 rounded-[2rem] border border-slate-100 flex gap-4 shadow-sm">
                        <img src={m.image} className="w-16 h-16 rounded-2xl object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                            <h4 className="font-black text-xs truncate">{m.name}</h4>
                            <p className="text-[10px] font-bold text-orange-600">{m.price.toLocaleString()}đ</p>
                            <div className="flex gap-4 mt-2">
                                <button onClick={() => {setEditingId(m.id); setForm(m);}} className="text-[9px] font-black text-blue-500 uppercase">Sửa</button>
                                <button onClick={() => onSave(tables, menu.filter((it:any)=>it.id!==m.id), history, notifications, users, bankConfig)} className="text-[9px] font-black text-red-400 uppercase">Xóa</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const CloudSettings = ({ cloudUrl, updateCloudUrl, bankConfig, updateBankConfig }: any) => {
    const [tempUrl, setTempUrl] = useState(cloudUrl);
    const [bank, setBank] = useState(bankConfig);

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                <h2 className="text-xl font-black mb-6 uppercase tracking-tight italic">Đám mây</h2>
                <div className="flex gap-2">
                    <input type="text" value={tempUrl} onChange={e => setTempUrl(e.target.value)} className="flex-1 px-6 py-4 bg-slate-50 rounded-xl outline-none font-bold text-xs" />
                    <button onClick={() => updateCloudUrl(tempUrl)} className="bg-slate-900 text-white px-8 rounded-xl font-black text-[10px] uppercase">Lưu</button>
                </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                <h2 className="text-xl font-black mb-6 uppercase tracking-tight italic">VietQR</h2>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <select value={bank.bankId} onChange={e => setBank({...bank, bankId: e.target.value})} className="px-6 py-4 bg-slate-50 rounded-xl font-bold text-xs appearance-none">
                            <option value="ICB">VietinBank</option><option value="VCB">Vietcombank</option><option value="MB">MBBank</option>
                        </select>
                        <input type="text" placeholder="Số tài khoản" value={bank.accountNo} onChange={e => setBank({...bank, accountNo: e.target.value})} className="px-6 py-4 bg-slate-50 rounded-xl font-bold text-xs" />
                    </div>
                    <input type="text" placeholder="Chủ tài khoản (Không dấu)" value={bank.accountName} onChange={e => setBank({...bank, accountName: e.target.value.toUpperCase()})} className="w-full px-6 py-4 bg-slate-50 rounded-xl font-bold text-xs uppercase" />
                    <button onClick={() => updateBankConfig(bank)} className="w-full bg-orange-500 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-100">Cập nhật QR</button>
                </div>
            </div>
        </div>
    );
};

export default AdminView;
