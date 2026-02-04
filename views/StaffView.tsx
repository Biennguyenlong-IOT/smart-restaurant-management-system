
import React, { useState, useMemo } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, Table, OrderType, MenuItem, AppNotification, User } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { CATEGORIES } from '../constants';
import { PlusCircle, Utensils, Search, X, Bell, Trash2, ChevronRight, QrCode, LogOut, CheckCheck, MoveHorizontal, Merge, Sparkles, Eraser, Loader2, AlertCircle, ShoppingBag, User as UserIcon, Check } from 'lucide-react';
import { ensureArray } from '../store.ts';

interface StaffViewProps { store: any; currentUser: User; }

const StaffView: React.FC<StaffViewProps> = ({ store, currentUser }) => {
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, { qty: number, note: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'TABLES' | 'ORDER' | 'PAYMENTS'>('TABLES');
  const [showBillTableId, setShowBillTableId] = useState<number | null>(null);
  const [quickActionTable, setQuickActionTable] = useState<Table | null>(null);
  const [showQrModal, setShowQrModal] = useState<Table | null>(null);
  const [moveRequest, setMoveRequest] = useState<{fromId: number, mode: 'MOVE' | 'MERGE'} | null>(null);

  const visibleTables = useMemo(() => {
    return ensureArray<Table>(store.tables).filter((t: Table) => {
      if (t.id === 0) return true;
      if (t.status === TableStatus.AVAILABLE || t.qrRequested) return true;
      return t.claimedBy === currentUser.id;
    });
  }, [store.tables, currentUser.id]);

  const activeTableCount = useMemo(() => 
    ensureArray<Table>(store.tables).filter((t: Table) => 
      t.claimedBy === currentUser.id && 
      t.id !== 0 && 
      (t.status === TableStatus.OCCUPIED || t.status === TableStatus.PAYING || t.status === TableStatus.BILLING)
    ).length
  , [store.tables, currentUser.id]);

  const limitReached = activeTableCount >= 3;

  const myNotifications = useMemo(() => {
    return ensureArray<AppNotification>(store.notifications).filter((n: AppNotification) => 
        !n.read && 
        n.targetRole === UserRole.STAFF && 
        (!n.payload || n.payload.claimedBy === currentUser.id || n.payload.tableId === 0)
    );
  }, [store.notifications, currentUser.id]);

  const handleConfirmOrder = async (tid: number, nid: string) => {
    await store.confirmTableOrders(tid, nid);
  };

  const handleServeItem = async (tid: number, oid: string, nid: string) => {
    await store.serveOrderItem(tid, oid, nid);
  };

  const handlePlaceStaffOrder = async (targetId?: number) => {
    const tid = targetId !== undefined ? targetId : selectedTableId;
    if (tid === null) return alert("Vui lòng chọn bàn!");
    if (Object.keys(cart).length === 0) return alert("Vui lòng chọn món!");
    
    const newItems: OrderItem[] = (Object.entries(cart) as [string, { qty: number, note: string }][])
      .map(([id, data]) => {
        const m = store.menu.find((x: MenuItem) => x.id === id);
        return {
          id: `ST-${Date.now()}-${id}`, menuItemId: id, name: m?.name || '',
          price: m?.price || 0, quantity: data.qty, status: OrderItemStatus.CONFIRMED,
          timestamp: Date.now(), note: data.note
        };
      });

    try {
      await store.placeOrder(tid, newItems, tid === 0 ? OrderType.TAKEAWAY : OrderType.DINE_IN);
      setCart({}); setSelectedTableId(null); setActiveTab('TABLES');
    } catch (e: any) { alert(e.message || "Lỗi đặt đơn!"); }
  };

  const updateCartItem = (id: string, qty: number) => {
    setCart(prev => {
        const newCart = { ...prev };
        if (qty <= 0) delete newCart[id];
        else {
            const existing = prev[id] as { qty: number, note: string } | undefined;
            newCart[id] = { qty, note: existing?.note || '' };
        }
        return newCart;
    });
  };

  const getTableLink = (t: Table) => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#/table/${t.id}/${t.sessionToken}`;
  };

  const getQrUrl = (t: Table) => {
    const link = getTableLink(t);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;
  };

  const cartTotalAmount = useMemo(() => (Object.entries(cart) as [string, { qty: number, note: string }][]).reduce((sum, [id, data]) => {
    const item = store.menu.find((m: MenuItem) => m.id === id);
    return sum + (item?.price || 0) * data.qty;
  }, 0), [cart, store.menu]);

  return (
    <div className="flex flex-col h-full max-w-full overflow-hidden animate-fadeIn pb-12">
      <ConfirmModal isOpen={showBillTableId !== null} title={`Tính tiền Bàn ${showBillTableId}`} message="Xác nhận gửi thông tin hóa đơn cho khách?" onConfirm={() => { if(showBillTableId !== null) store.confirmPayment(showBillTableId); setShowBillTableId(null); }} onCancel={() => setShowBillTableId(null)} />

      <div className="bg-white px-5 py-3 border-b border-slate-100 flex justify-between items-center shrink-0">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic shadow-lg">S</div>
           <div>
             <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Nhân viên</p>
             <p className="text-xs font-black text-slate-800 uppercase italic leading-none">{currentUser.fullName}</p>
           </div>
         </div>
         <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${limitReached ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
            {limitReached ? <AlertCircle size={12}/> : <div className={`w-2 h-2 rounded-full ${activeTableCount >= 3 ? 'bg-red-500' : 'bg-green-500'}`}></div>}
            <span className="text-[9px] font-black uppercase">{activeTableCount}/3 bàn</span>
         </div>
      </div>

      <div className="bg-white p-2 border-b border-slate-200 shrink-0">
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setActiveTab('TABLES')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'TABLES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Utensils size={14}/> Sơ đồ</button>
          <button onClick={() => setActiveTab('ORDER')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'ORDER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><PlusCircle size={14}/> Gọi món</button>
          <button onClick={() => setActiveTab('PAYMENTS')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><CheckCheck size={14}/> Bill</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
        {activeTab === 'TABLES' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {limitReached && (
              <div className="bg-red-500 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg animate-slideUp">
                <AlertCircle size={20}/>
                <p className="text-[10px] font-black uppercase italic">Đã đạt giới hạn 3 bàn. Vui lòng thanh toán hoặc gộp bàn để mở bàn mới.</p>
              </div>
            )}

            {myNotifications.length > 0 && (
                <section className="bg-slate-900 text-white rounded-[2rem] p-5 shadow-xl border border-white/5 animate-slideUp">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell size={16} className="text-orange-500 animate-bounce" />
                        <h4 className="text-[10px] font-black uppercase italic tracking-widest text-slate-400">Cần xử lý ({myNotifications.length})</h4>
                    </div>
                    <div className="space-y-2.5">
                        {myNotifications.map((n: AppNotification) => (
                            <div key={n.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="truncate">
                                        <p className="text-[10px] font-black uppercase truncate mb-0.5">{n.title}</p>
                                        <p className="text-[8px] text-slate-400 italic truncate">{n.message}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    {n.type === 'order' && <button onClick={() => handleConfirmOrder(n.payload?.tableId, n.id)} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-[8px] font-black uppercase italic">Duyệt</button>}
                                    {n.type === 'kitchen' && n.payload?.itemId && (
                                       <button onClick={() => handleServeItem(n.payload?.tableId, n.payload?.itemId, n.id)} className="px-3 py-2 bg-green-500 text-white rounded-lg text-[8px] font-black uppercase italic">Bưng</button>
                                    )}
                                    <button onClick={() => store.deleteNotification(n.id)} className="p-2 bg-white/10 rounded-lg"><X size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className="grid grid-cols-3 gap-3">
                {visibleTables.map((t: Table) => (
                    <div key={t.id} onClick={() => { 
                        if (t.qrRequested) return;
                        if (t.status === TableStatus.AVAILABLE) {
                            if (limitReached && t.id !== 0) return;
                            store.requestTableQr(t.id, currentUser.id).catch((e: Error) => alert(e.message === 'LIMIT_REACHED' ? "Bạn đã phục vụ tối đa 3 bàn!" : "Lỗi hệ thống"));
                        }
                        else if (t.status === TableStatus.CLEANING) store.setTableEmpty(t.id);
                        else setQuickActionTable(t);
                    }} className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative h-28 ${
                      t.qrRequested 
                      ? 'border-orange-500 bg-orange-50 text-orange-600 animate-pulse'
                      : t.status === TableStatus.AVAILABLE 
                      ? `border-dashed border-slate-200 bg-white ${limitReached && t.id !== 0 ? 'opacity-30 cursor-not-allowed grayscale' : ''}` 
                      : t.status === TableStatus.CLEANING 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-600' 
                      : 'border-slate-800 bg-slate-900 text-white shadow-md'
                    }`}>
                        <span className="text-[10px] font-black uppercase italic">{t.id === 0 ? 'LẺ' : 'BÀN '+t.id}</span>
                        {t.qrRequested ? <Loader2 size={20} className="animate-spin" /> :
                         t.status === TableStatus.AVAILABLE ? <PlusCircle size={20} className={limitReached && t.id !== 0 ? 'text-slate-200' : 'text-slate-300'}/> : 
                         t.status === TableStatus.CLEANING ? <Sparkles size={20} className="text-emerald-500"/> :
                         <Utensils size={20} className="text-orange-500"/>}
                        
                        <span className="text-[8px] font-black uppercase tracking-tighter absolute bottom-2">
                            {t.qrRequested ? 'Đang chờ...' : t.status === TableStatus.CLEANING ? 'Bấm để dọn' : (t.status === TableStatus.AVAILABLE && limitReached && t.id !== 0) ? 'Hết lượt' : ''}
                        </span>
                    </div>
                ))}
            </div>
          </div>
        )}

        {quickActionTable && (
           <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white w-full max-sm:max-w-[90%] max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn">
                 <h3 className="text-lg font-black uppercase italic mb-6 text-center">Bàn số {quickActionTable.id}</h3>
                 <div className="grid grid-cols-1 gap-3">
                    <button onClick={() => { setShowQrModal(quickActionTable); setQuickActionTable(null); }} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"><QrCode size={16}/> Xem mã QR</button>
                    <button onClick={() => { setSelectedTableId(quickActionTable.id); setActiveTab('ORDER'); setQuickActionTable(null); }} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"><PlusCircle size={16}/> Thêm món mới</button>
                    <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => { setMoveRequest({fromId: quickActionTable.id, mode: 'MOVE'}); setQuickActionTable(null); }} className="py-4 bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"><MoveHorizontal size={16}/> Chuyển bàn</button>
                       <button onClick={() => { setMoveRequest({fromId: quickActionTable.id, mode: 'MERGE'}); setQuickActionTable(null); }} className="py-4 bg-purple-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"><Merge size={16}/> Gộp bàn</button>
                    </div>
                    {quickActionTable.status === TableStatus.PAYING && (
                       <button onClick={() => { setShowBillTableId(quickActionTable.id); setQuickActionTable(null); }} className="w-full py-4 bg-green-500 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"><CheckCheck size={16}/> Xác nhận tính tiền</button>
                    )}
                    <button onClick={() => setQuickActionTable(null)} className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Đóng</button>
                 </div>
              </div>
           </div>
        )}

        {moveRequest && (
           <div className="fixed inset-0 z-[400] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-scaleIn">
                  <h3 className="text-xl font-black uppercase italic text-slate-800 mb-2 text-center">{moveRequest.mode === 'MOVE' ? 'Chọn bàn trống' : 'Chọn bàn muốn gộp'}</h3>
                  <div className="grid grid-cols-3 gap-3 mb-8 max-h-60 overflow-y-auto p-2 no-scrollbar">
                     {ensureArray<Table>(store.tables).filter(t => {
                        if(t.id === 0 || t.id === moveRequest.fromId) return false;
                        if(moveRequest.mode === 'MOVE') return t.status === TableStatus.AVAILABLE;
                        return t.status === TableStatus.OCCUPIED || t.status === TableStatus.PAYING;
                     }).map(t => (
                        <button key={t.id} onClick={() => { store.requestTableMove(moveRequest.fromId, t.id, currentUser.id); setMoveRequest(null); alert("Đã gửi yêu cầu tới Quản lý!"); }} className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 font-black text-xs hover:border-slate-800 transition-all">Bàn {t.id}</button>
                     ))}
                  </div>
                  <button onClick={() => setMoveRequest(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Hủy bỏ</button>
              </div>
           </div>
        )}

        {showQrModal && (
          <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn">
            <div className="bg-white w-full max-sm:max-w-[95%] max-w-sm rounded-[3rem] p-10 text-center shadow-2xl animate-scaleIn">
               <h3 className="text-xl font-black uppercase italic text-slate-800 mb-6">Mã QR Bàn {showQrModal.id}</h3>
               <div className="bg-white p-4 rounded-3xl mb-8 flex flex-col items-center gap-4 border-4 border-slate-100 shadow-inner">
                  <img src={getQrUrl(showQrModal)} alt="Table QR" className="w-64 h-64 rounded-xl" />
                  <p className="text-[8px] font-bold text-slate-300 break-all p-3 bg-slate-50 rounded-xl w-full">{getTableLink(showQrModal)}</p>
               </div>
               <div className="flex flex-col gap-3">
                 <button onClick={() => { navigator.clipboard.writeText(getTableLink(showQrModal)); alert("Đã copy link!"); }} className="py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] italic">Copy Link Bàn</button>
                 <button onClick={() => setShowQrModal(null)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Đóng</button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'ORDER' && (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="px-4 pt-4 shrink-0">
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200 flex items-center gap-3 mb-3 shadow-sm">
                        <Search size={14} className="text-slate-400 ml-2"/>
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="TÌM MÓN NHANH..." className="bg-transparent border-none outline-none font-black text-[10px] uppercase w-full py-1"/>
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="p-1"><X size={14} className="text-slate-300"/></button>}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-48 no-scrollbar">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {ensureArray<MenuItem>(store.menu).filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item: MenuItem) => (
                            <div key={item.id} className={`bg-white p-2 rounded-2xl border transition-all flex flex-col gap-1.5 active:scale-[0.97] ${cart[item.id] ? 'border-orange-500 shadow-md shadow-orange-50' : 'border-slate-100 shadow-sm'}`}>
                                <div className="relative">
                                    <img src={item.image} className="w-full h-20 rounded-xl object-cover" />
                                    {cart[item.id] && (
                                        <div className="absolute top-1.5 right-1.5 bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-lg">{cart[item.id].qty}</div>
                                    )}
                                </div>
                                <div className="px-1">
                                    <h4 className="text-[9px] font-black uppercase truncate leading-tight text-slate-800">{item.name}</h4>
                                    <p className="text-[9px] font-bold text-orange-600 italic">{item.price.toLocaleString()}đ</p>
                                </div>
                                <div className="flex items-center justify-between gap-1.5 mt-0.5">
                                    <button onClick={() => updateCartItem(item.id, (cart[item.id]?.qty || 0) - 1)} className="flex-1 h-7 bg-slate-50 rounded-lg font-black text-slate-400 hover:bg-slate-100 transition-colors">-</button>
                                    <button onClick={() => updateCartItem(item.id, (cart[item.id]?.qty || 0) + 1)} className="flex-1 h-7 bg-slate-900 text-white rounded-lg font-black hover:bg-orange-600 transition-colors">+</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Floating Cart & Action Area */}
                <div className="fixed bottom-16 left-4 right-4 bg-white/80 backdrop-blur-xl border-2 border-slate-100 p-4 rounded-[2.5rem] shadow-2xl z-50 flex flex-col gap-3 animate-slideUp">
                    {Object.keys(cart).length > 0 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                            {/* Fix: Added explicit type casting to Object.entries(cart) to prevent 'unknown' type errors for 'data' */}
                            {(Object.entries(cart) as [string, { qty: number, note: string }][]).map(([id, data]) => {
                                const m = store.menu.find((x: MenuItem) => x.id === id);
                                return (
                                    <div key={id} className="bg-slate-900 text-white px-3 py-2 rounded-xl flex items-center gap-2 shrink-0 animate-scaleIn">
                                        <span className="text-[9px] font-black uppercase italic whitespace-nowrap">{m?.name} x{data.qty}</span>
                                        <button onClick={() => updateCartItem(id, 0)} className="hover:text-red-400"><X size={12}/></button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <div className="flex-1">
                            <select value={selectedTableId ?? ''} onChange={e => setSelectedTableId(e.target.value === '' ? null : parseInt(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 outline-none font-black text-[10px] uppercase p-3.5 rounded-2xl appearance-none text-slate-800">
                                <option value="">Chọn Bàn...</option>
                                {store.tables.filter((t: any) => t.status !== TableStatus.AVAILABLE).map((t: any) => (
                                    <option key={t.id} value={t.id}>{t.id === 0 ? 'KHÁCH LẺ' : 'BÀN ' + t.id}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={() => setCart({})} className="p-3.5 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-colors"><Eraser size={18}/></button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handlePlaceStaffOrder(0)} disabled={Object.keys(cart).length === 0} className={`py-4 rounded-2xl font-black uppercase text-[10px] italic shadow-lg flex items-center justify-center gap-2 transition-all ${Object.keys(cart).length > 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}>
                            <ShoppingBag size={14}/> Khách Lẻ (Bill)
                        </button>
                        <button onClick={() => handlePlaceStaffOrder()} disabled={Object.keys(cart).length === 0 || selectedTableId === null} className={`py-4 rounded-2xl font-black uppercase text-[10px] italic shadow-lg flex items-center justify-center gap-2 transition-all ${Object.keys(cart).length > 0 && selectedTableId !== null ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                            <Check size={14}/> Đặt theo Bàn
                        </button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'PAYMENTS' && (
            <div className="p-4 space-y-4 overflow-y-auto no-scrollbar">
                {visibleTables.filter(t => t.status !== TableStatus.AVAILABLE && t.status !== TableStatus.CLEANING).map(t => (
                    <div key={t.id} onClick={() => setShowBillTableId(t.id)} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center cursor-pointer">
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-800 italic">Bàn {t.id === 0 ? 'Lẻ' : t.id}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">{t.status}</p>
                        </div>
                        <div className="flex items-center gap-3">
                             <span className="text-[11px] font-black text-slate-900">{ensureArray<OrderItem>(t.currentOrders).filter(o=>o.status!==OrderItemStatus.CANCELLED).reduce((s,o)=>s+(o.price*o.quantity),0).toLocaleString()}đ</span>
                             <ChevronRight size={16} className="text-slate-300"/>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default StaffView;
