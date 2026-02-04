
import React, { useState, useMemo } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, Table, OrderType, MenuItem, AppNotification, User } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { CATEGORIES } from '../constants';
import { PlusCircle, Utensils, Search, X, Bell, Trash2, ChevronRight, QrCode, LogOut, CheckCheck, MoveHorizontal, Merge, Sparkles, Eraser, Loader2, AlertCircle, ShoppingBag, User as UserIcon, Check, ShoppingCart, Filter, StickyNote, Clock, Link as LinkIcon, CheckCircle2 } from 'lucide-react';
import { ensureArray } from '../store.ts';

interface StaffViewProps { store: any; currentUser: User; }

const StaffView: React.FC<StaffViewProps> = ({ store, currentUser }) => {
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, { qty: number, note: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [activeTab, setActiveTab] = useState<'TABLES' | 'ORDER' | 'PAYMENTS'>('TABLES');
  const [showBillTableId, setShowBillTableId] = useState<number | null>(null);
  const [quickActionTable, setQuickActionTable] = useState<Table | null>(null);
  const [showQrModal, setShowQrModal] = useState<Table | null>(null);
  const [moveRequest, setMoveRequest] = useState<{fromId: number, mode: 'MOVE' | 'MERGE'} | null>(null);

  const visibleTables = useMemo(() => {
    const allTables = ensureArray<Table>(store.tables);
    return allTables.filter((t: Table) => {
      if (t.id === 0) {
          // Chỉ hiện Bill lẻ của chính mình nếu nó đang phục vụ, chờ duyệt hoặc chờ đánh giá
          return t.claimedBy === currentUser.id && (ensureArray(t.currentOrders).length > 0 || t.status === TableStatus.BILLING || t.status === TableStatus.REVIEWING);
      }
      if (t.status === TableStatus.AVAILABLE || t.qrRequested || t.status === TableStatus.CLEANING) return true;
      if (t.parentTableId) {
          const parent = allTables.find(p => p.id === t.parentTableId);
          return parent?.claimedBy === currentUser.id;
      }
      return t.claimedBy === currentUser.id;
    });
  }, [store.tables, currentUser.id]);

  const activeTableCount = useMemo(() => 
    ensureArray<Table>(store.tables).filter((t: Table) => 
      t.claimedBy === currentUser.id && 
      t.id !== 0 && 
      !t.parentTableId && 
      (t.status === TableStatus.OCCUPIED || t.status === TableStatus.PAYING || t.status === TableStatus.BILLING)
    ).length
  , [store.tables, currentUser.id]);

  const limitReached = activeTableCount >= 3;

  const myNotifications = useMemo(() => {
    return ensureArray<AppNotification>(store.notifications).filter((n: AppNotification) => 
        !n.read && 
        n.targetRole === UserRole.STAFF && 
        n.payload?.claimedBy === currentUser.id
    );
  }, [store.notifications, currentUser.id]);

  const handleConfirmOrder = async (tid: number, nid: string) => {
    await store.confirmTableOrders(tid, nid);
  };

  const handleServeItem = async (tid: number, oid: string, nid: string) => {
    await store.serveOrderItem(tid, oid, nid);
  };

  const checkIfAllServed = (tableId: number) => {
    const table = store.tables.find((t: Table) => t.id === tableId);
    if (!table) return false;
    const orders = ensureArray<OrderItem>(table.currentOrders).filter(o => o.status !== OrderItemStatus.CANCELLED);
    if (orders.length === 0) return true;
    return orders.every(o => o.status === OrderItemStatus.SERVED);
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
      await store.placeOrder(tid, newItems, tid === 0 ? OrderType.TAKEAWAY : OrderType.DINE_IN, currentUser.id);
      setCart({}); setSelectedTableId(null); 
      if (tid === 0) setActiveTab('PAYMENTS');
      else setActiveTab('TABLES');
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

  const updateCartNote = (id: string, note: string) => {
    setCart(prev => {
        if (!prev[id]) return prev;
        return { ...prev, [id]: { ...prev[id], note } };
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

  const cartItemsCount = useMemo(() => (Object.values(cart) as {qty: number}[]).reduce((s, d) => s + d.qty, 0), [cart]);

  const filteredMenuItems = useMemo(() => {
    return ensureArray<MenuItem>(store.menu).filter(m => {
        const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = activeCategory === 'Tất cả' || m.category === activeCategory;
        return matchSearch && matchCategory;
    });
  }, [store.menu, searchTerm, activeCategory]);

  const handleTableClick = (t: Table) => {
    if (t.qrRequested) return;
    if (t.status === TableStatus.AVAILABLE) {
        if (limitReached && t.id !== 0) return;
        store.requestTableQr(t.id, currentUser.id).catch((e: Error) => alert(e.message === 'LIMIT_REACHED' ? "Bạn đã phục vụ tối đa 3 bàn!" : "Lỗi hệ thống"));
    }
    else if (t.status === TableStatus.CLEANING || t.status === TableStatus.REVIEWING) {
        store.setTableEmpty(t.id);
    }
    else {
        if (t.parentTableId) {
            const parent = store.tables.find((p: Table) => p.id === t.parentTableId);
            if (parent) setQuickActionTable(parent);
            else setQuickActionTable(t);
        } else {
            setQuickActionTable(t);
        }
    }
  };

  return (
    <div className="flex flex-col h-full max-w-full overflow-hidden animate-fadeIn">
      <ConfirmModal 
        isOpen={showBillTableId !== null} 
        title={`Chốt Bill Bàn ${showBillTableId === 0 ? 'Khách lẻ' : showBillTableId}`} 
        message="Xác nhận gửi bill tới Quản lý để thu tiền? Sau khi gửi, khách sẽ thấy màn hình chờ Admin phê duyệt." 
        onConfirm={() => { if(showBillTableId !== null) store.staffConfirmPayment(showBillTableId); setShowBillTableId(null); }} 
        onCancel={() => setShowBillTableId(null)} 
      />

      <div className="bg-white px-4 py-2 border-b border-slate-100 flex justify-between items-center shrink-0">
         <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black italic shadow-md text-xs">S</div>
           <div>
             <p className="text-[10px] font-black text-slate-800 uppercase italic leading-tight">{currentUser.fullName}</p>
           </div>
         </div>
         <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all ${limitReached ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${limitReached ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[9px] font-black uppercase">{activeTableCount}/3</span>
         </div>
      </div>

      <div className="bg-white p-2 border-b border-slate-200 shrink-0">
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button onClick={() => setActiveTab('TABLES')} className={`flex-1 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'TABLES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}><Utensils size={14}/> Sơ đồ</button>
          <button onClick={() => setActiveTab('ORDER')} className={`flex-1 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'ORDER' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}><PlusCircle size={14}/> Gọi món</button>
          <button onClick={() => setActiveTab('PAYMENTS')} className={`flex-1 px-3 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'PAYMENTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}><CheckCheck size={14}/> Bill</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
        {activeTab === 'TABLES' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {limitReached && (
              <div className="bg-red-500 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg animate-slideUp">
                <AlertCircle size={20}/>
                <p className="text-[10px] font-black uppercase italic leading-tight">Đã đạt giới hạn 3 bàn. Thanh toán để nhận bàn mới.</p>
              </div>
            )}

            {myNotifications.length > 0 && (
                <section className="bg-slate-900 text-white rounded-[1.5rem] p-4 shadow-xl border border-white/5 animate-slideUp">
                    <div className="flex items-center gap-2 mb-3">
                        <Bell size={14} className="text-orange-500" />
                        <h4 className="text-[9px] font-black uppercase italic tracking-widest text-slate-400">Thông báo ({myNotifications.length})</h4>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                        {myNotifications.map((n: AppNotification) => (
                            <div key={n.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase truncate">{n.title}</p>
                                    <p className="text-[8px] text-slate-400 italic truncate">{n.message}</p>
                                </div>
                                <div className="flex gap-1">
                                    {n.type === 'order' && <button onClick={() => handleConfirmOrder(n.payload?.tableId, n.id)} className="px-2 py-1.5 bg-blue-500 text-white rounded-lg text-[8px] font-black uppercase">Duyệt</button>}
                                    {n.type === 'kitchen' && n.payload?.itemId && (
                                       <button onClick={() => handleServeItem(n.payload?.tableId, n.payload?.itemId, n.id)} className="px-2 py-1.5 bg-green-500 text-white rounded-lg text-[8px] font-black uppercase">Bưng</button>
                                    )}
                                    <button onClick={() => store.deleteNotification(n.id)} className="p-1.5 bg-white/10 rounded-lg"><X size={12} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {visibleTables.map((t: Table) => {
                    const isChild = !!t.parentTableId;
                    return (
                    <div key={t.id} onClick={() => handleTableClick(t)} className={`aspect-square p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all relative group cursor-pointer active:scale-95 ${
                      t.qrRequested 
                      ? 'border-orange-500 bg-orange-50 text-orange-600 animate-pulse'
                      : t.status === TableStatus.AVAILABLE 
                      ? `border-dashed border-slate-200 bg-white ${limitReached && t.id !== 0 ? 'opacity-30' : 'hover:border-slate-400'}` 
                      : t.status === TableStatus.CLEANING 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-600' 
                      : t.status === TableStatus.REVIEWING
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : isChild 
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700' 
                      : (t.status === TableStatus.BILLING ? 'border-orange-500 bg-slate-900 text-white animate-pulse' : 'border-slate-800 bg-slate-900 text-white shadow-md')
                    }`}>
                        <span className="text-[10px] font-black uppercase italic">{t.id === 0 ? 'Lẻ' : 'Bàn '+t.id}</span>
                        {t.qrRequested ? <Loader2 size={18} className="animate-spin" /> :
                         t.status === TableStatus.AVAILABLE ? <PlusCircle size={18} className="text-slate-300"/> : 
                         (t.status === TableStatus.CLEANING || t.status === TableStatus.REVIEWING) ? <CheckCircle2 size={18}/> :
                         isChild ? <LinkIcon size={18} className="animate-pulse" /> : <Utensils size={18} className="text-orange-500"/>}
                        
                        <span className="text-[7px] font-black uppercase tracking-tighter mt-1 opacity-60 text-center leading-tight">
                            {t.qrRequested ? 'Đợi duyệt' : 
                             t.status === TableStatus.CLEANING ? 'Bấm để dọn' : 
                             t.status === TableStatus.REVIEWING ? 'Đã xong - Đóng' :
                             t.status === TableStatus.BILLING ? 'Đợi Admin duyệt' :
                             isChild ? `Ghép vào Bàn ${t.parentTableId}` : ''}
                        </span>
                    </div>
                )})}
            </div>
          </div>
        )}

        {quickActionTable && (
           <div className="fixed inset-0 z-[250] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-slideUp">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase italic">Bàn số {quickActionTable.id === 0 ? 'Khách lẻ' : quickActionTable.id}</h3>
                    <button onClick={() => setQuickActionTable(null)} className="p-2 bg-slate-50 rounded-xl text-slate-400"><X size={20}/></button>
                 </div>
                 <div className="grid grid-cols-1 gap-2.5">
                    {quickActionTable.id !== 0 && <button onClick={() => { setShowQrModal(quickActionTable); setQuickActionTable(null); }} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"><QrCode size={16}/> Xem mã QR</button>}
                    
                    {quickActionTable.status !== TableStatus.BILLING && (
                        <button onClick={() => { setSelectedTableId(quickActionTable.id); setActiveTab('ORDER'); setQuickActionTable(null); }} className="w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"><PlusCircle size={16}/> Thêm món mới</button>
                    )}

                    {quickActionTable.id !== 0 && quickActionTable.status !== TableStatus.BILLING && (
                      <div className="grid grid-cols-2 gap-2.5">
                         <button onClick={() => { setMoveRequest({fromId: quickActionTable.id, mode: 'MOVE'}); setQuickActionTable(null); }} className="py-4 bg-blue-500 text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"><MoveHorizontal size={16}/> Chuyển</button>
                         <button onClick={() => { setMoveRequest({fromId: quickActionTable.id, mode: 'MERGE'}); setQuickActionTable(null); }} className="py-4 bg-purple-500 text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"><Merge size={16}/> Gộp bàn</button>
                      </div>
                    )}
                    {(quickActionTable.status === TableStatus.PAYING || (quickActionTable.id === 0 && quickActionTable.status !== TableStatus.BILLING)) && (
                       <button 
                         onClick={() => { 
                            if(!checkIfAllServed(quickActionTable.id)) {
                                alert("⚠️ KHÔNG THỂ THANH TOÁN: Đơn vẫn còn món chưa bưng ra hết!");
                                return;
                            }
                            setShowBillTableId(quickActionTable.id); 
                            setQuickActionTable(null); 
                         }} 
                         className="w-full py-4 bg-green-500 text-white rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 italic"
                       >
                         <CheckCheck size={16}/> Chốt Bill (Gửi Admin duyệt)
                       </button>
                    )}
                    {quickActionTable.status === TableStatus.BILLING && (
                        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                            <Loader2 className="mx-auto text-orange-500 animate-spin mb-3" size={24}/>
                            <p className="text-[10px] font-black uppercase italic text-slate-500">Đang đợi Admin thu tiền và duyệt kết thúc</p>
                        </div>
                    )}
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'ORDER' && (
            <div className="flex flex-col h-full overflow-hidden bg-white">
                <div className="px-4 py-3 border-b border-slate-100 shrink-0 space-y-3">
                    <div className="bg-slate-50 p-2 rounded-xl flex items-center gap-3 border border-slate-200">
                        <Search size={16} className="text-slate-400 ml-1"/>
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="TÌM MÓN NHANH..." className="bg-transparent border-none outline-none font-black text-[11px] uppercase w-full py-1 text-slate-800"/>
                        {searchTerm && <button onClick={() => setSearchTerm('')}><X size={16} className="text-slate-400"/></button>}
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {CATEGORIES.map(cat => (
                            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all border ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}>{cat}</button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 no-scrollbar">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {filteredMenuItems.map((item: MenuItem) => (
                            <div key={item.id} className={`bg-white rounded-2xl border transition-all flex flex-col relative overflow-hidden group ${cart[item.id] ? 'border-orange-500 shadow-lg shadow-orange-50' : 'border-slate-100 hover:border-slate-300'}`}>
                                <div className="relative aspect-[4/3] overflow-hidden">
                                    <img src={item.image} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    {cart[item.id] && (
                                        <div className="absolute top-2 right-2 bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-lg animate-scaleIn">{cart[item.id].qty}</div>
                                    )}
                                    {!item.isAvailable && <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center font-black text-red-500 text-[10px] uppercase italic">Hết món</div>}
                                </div>
                                <div className="p-2.5 flex flex-col flex-1 gap-2">
                                    <div>
                                      <h4 className="text-[10px] font-black uppercase truncate leading-tight text-slate-800 mb-1">{item.name}</h4>
                                      <p className="text-[10px] font-black text-orange-600 italic">{item.price.toLocaleString()}đ</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {cart[item.id] ? (
                                            <div className="flex-1 flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1">
                                                  <button onClick={() => updateCartItem(item.id, cart[item.id].qty - 1)} className="flex-1 h-8 bg-slate-50 rounded-lg font-black text-slate-800 border border-slate-100 active:scale-90 transition-all">-</button>
                                                  <button onClick={() => updateCartItem(item.id, cart[item.id].qty + 1)} className="flex-1 h-8 bg-slate-900 text-white rounded-lg font-black active:scale-90 transition-all">+</button>
                                                </div>
                                                <div className="relative">
                                                  <StickyNote size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"/>
                                                  <input type="text" placeholder="Ghi chú..." value={cart[item.id].note} onChange={(e) => updateCartNote(item.id, e.target.value)} className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[8px] font-bold outline-none focus:border-orange-500"/>
                                                </div>
                                            </div>
                                        ) : (
                                            <button disabled={!item.isAvailable} onClick={() => updateCartItem(item.id, 1)} className="w-full h-8 bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white rounded-lg font-black text-[9px] uppercase italic transition-all disabled:opacity-30">Chọn món</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-xl p-4 z-[100] animate-slideUp">
                    <div className="max-w-7xl mx-auto flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-slate-900 text-white rounded-xl relative">
                                    <ShoppingCart size={18}/>
                                    {cartItemsCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{cartItemsCount}</span>}
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1 italic">Tổng tạm tính</p>
                                    <p className="text-sm font-black text-slate-900 italic leading-none">{cartTotalAmount.toLocaleString()}đ</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <select value={selectedTableId ?? ''} onChange={e => setSelectedTableId(e.target.value === '' ? null : parseInt(e.target.value))} className="bg-slate-50 border border-slate-200 outline-none font-black text-[10px] uppercase pl-3 pr-8 py-2.5 rounded-xl appearance-none text-slate-800 min-w-[100px]">
                                        <option value="">CHỌN BÀN</option>
                                        {store.tables.filter((t: any) => t.id !== 0 && t.status !== TableStatus.AVAILABLE && t.claimedBy === currentUser.id && !t.parentTableId && t.status !== TableStatus.BILLING && t.status !== TableStatus.REVIEWING).map((t: any) => (
                                            <option key={t.id} value={t.id}>BÀN {t.id}</option>
                                        ))}
                                    </select>
                                    <ChevronRight size={14} className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none"/>
                                </div>
                                <button onClick={() => setCart({})} className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white"><Eraser size={18}/></button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => handlePlaceStaffOrder(0)} disabled={cartItemsCount === 0} className={`py-4 rounded-xl font-black uppercase text-[10px] italic shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 ${cartItemsCount > 0 ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                                <ShoppingBag size={14}/> Khách Lẻ (Bill)
                            </button>
                            <button onClick={() => handlePlaceStaffOrder()} disabled={cartItemsCount === 0 || selectedTableId === null} className={`py-4 rounded-xl font-black uppercase text-[10px] italic shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 ${cartItemsCount > 0 && selectedTableId !== null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}>
                                <Check size={14}/> Đặt vào Bàn
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'PAYMENTS' && (
            <div className="p-4 space-y-3 overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <CheckCheck size={18} className="text-emerald-500"/>
                        <h3 className="text-xs font-black uppercase italic text-slate-800">Hóa đơn chờ của bạn</h3>
                    </div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded">Chỉ hiện bill bạn phục vụ</span>
                </div>
                {visibleTables.filter(t => !t.parentTableId && (t.status === TableStatus.PAYING || t.status === TableStatus.OCCUPIED || t.status === TableStatus.BILLING)).length === 0 ? (
                    <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] italic">Không có hóa đơn chờ</div>
                ) : (
                    visibleTables.filter(t => !t.parentTableId && (t.status === TableStatus.PAYING || t.status === TableStatus.OCCUPIED || t.status === TableStatus.BILLING)).map(t => {
                        const amount = ensureArray<OrderItem>(t.currentOrders).filter(o=>o.status!==OrderItemStatus.CANCELLED).reduce((s,o)=>s+(o.price*o.quantity),0);
                        if (amount === 0 && t.id === 0 && t.status !== TableStatus.BILLING) return null;
                        
                        const isReady = checkIfAllServed(t.id);
                        const isBilling = t.status === TableStatus.BILLING;
                        
                        return (
                          <div key={t.id} onClick={() => {
                              if (isBilling) {
                                  alert("Hóa đơn đã được gửi, đang chờ Admin duyệt thu tiền.");
                                  return;
                              }
                              if (!isReady) {
                                  alert("⚠️ KHÔNG THỂ THANH TOÁN: Đơn vẫn còn món chưa bưng ra hết!");
                                  return;
                              }
                              setShowBillTableId(t.id);
                          }} className={`p-4 rounded-2xl border transition-all flex justify-between items-center cursor-pointer group ${isBilling ? 'bg-slate-900 border-orange-500' : (t.id === 0 ? 'bg-orange-50 border-orange-200 hover:border-orange-500' : 'bg-white border-slate-200 hover:border-emerald-500')} ${(!isReady && !isBilling) ? 'border-dashed opacity-80' : ''}`}>
                              <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black italic text-[10px] shadow-sm ${isBilling ? 'bg-orange-500 text-white' : (t.id === 0 ? 'bg-orange-500 text-white' : (t.status === TableStatus.PAYING ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500'))}`}>
                                      <span>B{t.id === 0 ? 'Lẻ' : t.id}</span>
                                      {(t.id === 0 || isBilling) && <ShoppingBag size={10} className="mt-0.5"/>}
                                  </div>
                                  <div>
                                      <p className={`text-[11px] font-black uppercase leading-tight mb-0.5 ${isBilling ? 'text-white' : 'text-slate-800'}`}>{t.id === 0 ? 'Khách lẻ' : `Bàn số ${t.id}`}</p>
                                      <div className="flex items-center gap-1.5">
                                        <p className={`text-[8px] font-bold uppercase tracking-widest ${isBilling ? 'text-orange-400' : (t.id === 0 ? 'text-orange-600' : 'text-slate-400')}`}>
                                            {isBilling ? 'ĐANG CHỜ ADMIN' : (t.id === 0 ? 'CHỜ RA MÓN' : t.status)}
                                        </p>
                                        {!isReady && !isBilling && (
                                            <span className="flex items-center gap-0.5 text-[7px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-black uppercase animate-pulse">
                                                <Clock size={8}/> Đang nấu...
                                            </span>
                                        )}
                                      </div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4 text-right">
                                  <div>
                                      <p className={`text-sm font-black leading-tight mb-0.5 ${isBilling ? 'text-orange-400' : (t.id === 0 ? 'text-orange-600' : 'text-slate-900')}`}>{amount.toLocaleString()}đ</p>
                                      <p className={`text-[8px] font-bold uppercase leading-tight italic ${isBilling ? 'text-slate-500' : 'text-slate-400'}`}>
                                          {isBilling ? 'Chờ duyệt' : (isReady ? 'Sẵn sàng chốt' : 'Đợi bưng hết món')}
                                      </p>
                                  </div>
                                  <ChevronRight size={16} className={`transition-colors ${isBilling ? 'text-orange-500' : (t.id === 0 ? 'text-orange-300 group-hover:text-orange-500' : 'text-slate-300 group-hover:text-emerald-500')}`}/>
                              </div>
                          </div>
                        );
                    })
                )}
            </div>
        )}

        {showQrModal && (
          <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 text-center shadow-2xl animate-scaleIn">
               <h3 className="text-lg font-black uppercase italic text-slate-800 mb-6">Mã QR Bàn {showQrModal.id}</h3>
               <div className="bg-white p-3 rounded-2xl mb-6 flex flex-col items-center gap-3 border-2 border-slate-50">
                  <img src={getQrUrl(showQrModal)} alt="Table QR" className="w-full h-auto rounded-lg shadow-sm" />
               </div>
               <div className="flex flex-col gap-2">
                 <button onClick={() => { navigator.clipboard.writeText(getTableLink(showQrModal)); alert("Đã copy link!"); }} className="py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] italic">Copy Link</button>
                 <button onClick={() => setShowQrModal(null)} className="py-4 bg-slate-100 text-slate-400 rounded-xl font-black uppercase text-[10px]">Đóng</button>
               </div>
            </div>
          </div>
        )}

        {moveRequest && (
           <div className="fixed inset-0 z-[400] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
              <div className="bg-white w-full max-sm:max-w-[90%] max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scaleIn">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black uppercase italic text-slate-800">{moveRequest.mode === 'MOVE' ? 'Chọn bàn trống để chuyển' : 'Chọn bàn đích để gộp'}</h3>
                    <button onClick={() => setMoveRequest(null)} className="p-2 bg-slate-50 rounded-xl text-slate-400"><X size={20}/></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1 no-scrollbar mb-6">
                     {ensureArray<Table>(store.tables).filter(t => {
                        if(t.id === 0 || t.id === moveRequest.fromId) return false;
                        if(moveRequest.mode === 'MOVE') {
                            return t.status === TableStatus.AVAILABLE;
                        }
                        return true;
                     }).map(t => (
                        <button key={t.id} onClick={() => { store.requestTableMove(moveRequest.fromId, t.id, currentUser.id); setMoveRequest(null); alert("Đã gửi yêu cầu tới Quản lý!"); }} className="p-3.5 bg-slate-50 rounded-xl border-2 border-slate-100 font-black text-xs hover:border-slate-800 transition-all uppercase italic">Bàn {t.id}</button>
                     ))}
                  </div>
                  <button onClick={() => setMoveRequest(null)} className="w-full py-4 bg-slate-100 text-slate-400 rounded-xl font-black uppercase text-[10px]">Hủy bỏ</button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default StaffView;
