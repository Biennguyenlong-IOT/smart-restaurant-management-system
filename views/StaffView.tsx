
import React, { useState, useMemo, useEffect } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, Table, OrderType, MenuItem, AppNotification, User } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { CATEGORIES } from '../constants';
import { QrCode, PlusCircle, Loader2, Coffee, Clock, ShoppingBag, Utensils, Search, FileText, CreditCard, MessageCircle, X, ArrowRightLeft, Bell, AlertCircle, CheckCircle, Trash2, Tag, ChevronRight, User as UserIcon, ArrowLeft, MoveHorizontal, RotateCcw } from 'lucide-react';

interface StaffViewProps { store: any; currentUser: User; }

const getFullQrUrl = (tid: number, token?: string | null) => {
  const baseUrl = window.location.origin + window.location.pathname;
  const url = `${baseUrl}#/table/${tid}${token ? '/' + token : ''}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
};

const StaffView: React.FC<StaffViewProps> = ({ store, currentUser }) => {
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, { qty: number, note: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'TABLES' | 'ORDER' | 'PAYMENTS'>('TABLES');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [confirmTableId, setConfirmTableId] = useState<number | null>(null);
  const [showQrModalId, setShowQrModalId] = useState<number | null>(null);
  const [showBillTableId, setShowBillTableId] = useState<number | null>(null);
  const [moveSourceId, setMoveSourceId] = useState<number | null>(null);

  const activeTableCount = useMemo(() => 
    (store.tables || []).filter((t: Table) => t.claimedBy === currentUser.id && t.id !== 0 && t.status !== TableStatus.AVAILABLE).length
  , [store.tables, currentUser.id]);

  const myNotifications = useMemo(() => {
    return (store.notifications || []).filter((n: AppNotification) => 
        !n.read && 
        n.targetRole === UserRole.STAFF && 
        (!n.payload || n.payload.claimedBy === currentUser.id || n.payload.tableId === 0)
    );
  }, [store.notifications, currentUser.id]);

  const cartTotal = useMemo(() => {
    return (Object.entries(cart) as [string, { qty: number, note: string }][]).reduce((sum, [id, data]) => {
      const item = store.menu.find((m: MenuItem) => m.id === id);
      return sum + (item?.price || 0) * data.qty;
    }, 0);
  }, [cart, store.menu]);

  const handleConfirmOrder = async (tid: number, nid: string) => {
    await store.confirmTableOrders(tid);
    await store.deleteNotification(nid);
  };

  const handleCancelOrderNotif = async (tid: number, nid: string) => {
    const table = store.tables.find((t: any) => t.id === tid);
    if (table) {
        const pendingOids = table.currentOrders.filter((o: any) => o.status === OrderItemStatus.PENDING).map((o: any) => o.id);
        for (const oid of pendingOids) {
            await store.cancelOrderItem(tid, oid);
        }
    }
    await store.deleteNotification(nid);
  };

  const handleServeItem = async (tid: number, oid: string, nid: string) => {
    await store.updateOrderItemStatus(tid, oid, OrderItemStatus.SERVED);
    store.deleteNotification(nid);
  };

  const handleRequestTableQr = async (tid: number) => {
    try { 
      await store.requestTableQr(tid, currentUser.id); 
    } catch (e: any) { 
      if (e.message === "LIMIT_REACHED") alert("Tối đa 3 bàn!");
      else alert("Lỗi gửi yêu cầu!");
    }
  };

  const handleMoveOrMerge = async (targetId: number) => {
    if (moveSourceId === null) return;
    if (moveSourceId === targetId) {
        setMoveSourceId(null);
        return;
    }
    try {
        await store.requestTableMove(moveSourceId, targetId, currentUser.id);
        alert(`Đã gửi yêu cầu Chuyển/Gộp Bàn ${moveSourceId} -> ${targetId}. Chờ Admin duyệt!`);
    } catch (e) {
        alert("Lỗi khi gửi yêu cầu chuyển bàn!");
    } finally {
        setMoveSourceId(null);
    }
  };

  const handlePlaceStaffOrder = async () => {
    if (selectedTable === null) return alert("Vui lòng chọn bàn/khách lẻ trước!");
    if (Object.keys(cart).length === 0) return alert("Vui lòng chọn món ăn!");
    
    const newItems: OrderItem[] = (Object.entries(cart) as [string, { qty: number, note: string }][])
      .filter(([_, data]) => data.qty > 0)
      .map(([id, data]) => {
        const m = store.menu.find((x: MenuItem) => x.id === id);
        return {
          id: `ST-${Date.now()}-${id}`, menuItemId: id, name: m?.name || '',
          price: m?.price || 0, quantity: data.qty, status: OrderItemStatus.CONFIRMED,
          timestamp: Date.now(), note: data.note
        };
      });

    try {
      await store.placeOrder(selectedTable, newItems, selectedTable === 0 ? OrderType.TAKEAWAY : OrderType.DINE_IN);
      setCart({}); setSelectedTable(null); setActiveTab('TABLES');
    } catch (e) { alert("Lỗi đặt đơn!"); }
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

  const currentBillTable = useMemo(() => store.tables.find((t:any) => t.id === showBillTableId), [store.tables, showBillTableId]);
  const billTotal = useMemo(() => currentBillTable?.currentOrders.filter((o:any) => o.status !== OrderItemStatus.CANCELLED).reduce((s:number,o:any)=>s+(o.price*o.quantity), 0) || 0, [currentBillTable]);

  const filteredMenu = useMemo(() => {
    return store.menu.filter((m: MenuItem) => {
        const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = activeCategory === 'Tất cả' || m.category === activeCategory;
        return matchSearch && matchCategory;
    });
  }, [store.menu, searchTerm, activeCategory]);

  const qrModalTable = useMemo(() => store.tables.find((t: any) => t.id === showQrModalId), [store.tables, showQrModalId]);

  return (
    <div className="flex flex-col h-full max-w-full overflow-hidden animate-fadeIn">
      {/* Header Info */}
      <div className="bg-white px-5 py-3 border-b border-slate-100 flex justify-between items-center shrink-0">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic shadow-lg">S</div>
           <div>
             <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Ca trực của bạn</p>
             <p className="text-xs font-black text-slate-800 uppercase italic leading-none">{currentUser.fullName}</p>
           </div>
         </div>
         <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <div className={`w-2 h-2 rounded-full ${activeTableCount >= 3 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[9px] font-black uppercase text-slate-600">Trực {activeTableCount}/3 bàn</span>
         </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white p-2 border-b border-slate-200 shrink-0">
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200 shadow-inner">
          <button onClick={() => { setActiveTab('TABLES'); setMoveSourceId(null); }} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'TABLES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Utensils size={14}/> Sơ đồ</button>
          <button onClick={() => { setActiveTab('ORDER'); setMoveSourceId(null); }} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'ORDER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><PlusCircle size={14}/> Order</button>
          <button onClick={() => { setActiveTab('PAYMENTS'); setMoveSourceId(null); }} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Clock size={14}/> Bill</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
        {activeTab === 'TABLES' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {/* Move/Merge Mode Active Banner */}
            {moveSourceId !== null && (
              <div className="bg-orange-500 text-white p-4 rounded-2xl shadow-xl flex items-center justify-between animate-slideUp border-2 border-orange-400 mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse"><MoveHorizontal size={20}/></div>
                  <div>
                    <p className="text-[10px] font-black uppercase italic leading-none mb-1">Chế độ chuyển/gộp bàn</p>
                    <p className="text-xs font-black uppercase">Chuyển Bàn {moveSourceId} tới đâu?</p>
                  </div>
                </div>
                <button onClick={() => setMoveSourceId(null)} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><X size={18}/></button>
              </div>
            )}

            {/* Notifications Section */}
            {myNotifications.length > 0 && (
                <section className="bg-slate-900 text-white rounded-[2rem] p-5 shadow-xl border border-white/5 animate-slideUp">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell size={16} className="text-orange-500 animate-bounce" />
                        <h4 className="text-[10px] font-black uppercase italic tracking-widest text-slate-400">Yêu cầu cần xử lý ({myNotifications.length})</h4>
                    </div>
                    <div className="space-y-2.5">
                        {myNotifications.map((n: AppNotification) => (
                            <div key={n.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${n.type === 'kitchen' ? 'bg-green-500' : 'bg-orange-500'}`}>
                                        {n.payload?.tableId === 0 ? 'Lẻ' : n.payload?.tableId}
                                    </div>
                                    <div className="truncate">
                                        <p className="text-[10px] font-black uppercase truncate mb-0.5">{n.title}</p>
                                        <p className="text-[8px] text-slate-400 italic truncate opacity-80">{n.message}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    {n.type === 'order' && (
                                        <>
                                            <button onClick={() => handleConfirmOrder(n.payload?.tableId, n.id)} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-[8px] font-black uppercase shadow-lg italic">Duyệt</button>
                                            <button onClick={() => handleCancelOrderNotif(n.payload?.tableId, n.id)} className="px-3 py-2 bg-red-500 text-white rounded-lg text-[8px] font-black uppercase shadow-lg italic">Huỷ đơn</button>
                                        </>
                                    )}
                                    {n.type === 'kitchen' && (
                                        <button onClick={() => handleServeItem(n.payload?.tableId, n.payload?.itemId, n.id)} className="px-3 py-2 bg-green-500 text-white rounded-lg text-[8px] font-black uppercase shadow-lg italic">Bưng lên</button>
                                    )}
                                    <button onClick={() => store.deleteNotification(n.id)} className="p-2 bg-white/10 rounded-lg text-white/40"><X size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Tables Grid */}
            <section className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm">
                <div className="grid grid-cols-3 xs:grid-cols-4 md:grid-cols-6 gap-3">
                    {store.tables.map((t: Table) => {
                        const isMine = t.claimedBy === currentUser.id || t.id === 0;
                        const isAvailable = t.status === TableStatus.AVAILABLE;
                        const isCleaning = t.status === TableStatus.CLEANING;
                        const isBilling = t.status === TableStatus.BILLING || t.status === TableStatus.PAYING;
                        const isRequested = t.qrRequested;
                        const hasOrders = (t.currentOrders || []).filter(o => o.status !== OrderItemStatus.CANCELLED).length > 0;
                        const isBeingMoved = moveSourceId === t.id;
                        
                        return (
                            <div key={t.id} 
                                onClick={() => moveSourceId !== null ? handleMoveOrMerge(t.id) : null}
                                className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 relative min-h-[125px] transition-all duration-300 ${
                                isBeingMoved ? 'border-orange-500 bg-orange-100 ring-4 ring-orange-200 scale-105 z-20' :
                                moveSourceId !== null ? 'border-indigo-400 bg-indigo-50/50 cursor-pointer hover:bg-indigo-100' :
                                isCleaning ? 'border-red-500 bg-red-50/20' :
                                isRequested ? 'border-amber-300 bg-amber-50/50' :
                                isBilling ? 'border-indigo-500 bg-indigo-50/30 animate-pulse' :
                                isMine && !isAvailable ? 'border-orange-500 bg-orange-50/10' : 
                                isAvailable ? 'border-dashed border-slate-100 opacity-60' : 'border-slate-50 bg-slate-50/30 opacity-40'
                            }`}>
                                <span className={`font-black text-[12px] uppercase italic ${isMine ? 'text-slate-800' : 'text-slate-300'}`}>{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id}</span>
                                
                                {/* 1. Status: Available - Show "Open Table" button */}
                                {isAvailable && !isRequested && t.id !== 0 && moveSourceId === null && (
                                    <button onClick={(e) => { e.stopPropagation(); handleRequestTableQr(t.id); }} className="text-[9px] font-black bg-slate-900 text-white px-3 py-2 rounded-xl uppercase italic shadow-md active:scale-95 transition-all">Mở bàn</button>
                                )}
                                
                                {/* 2. Status: Requested - Show "Waiting for Admin" */}
                                {isRequested && moveSourceId === null && (
                                    <div className="flex flex-col items-center gap-1 text-amber-600 animate-pulse">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span className="text-[7px] font-black uppercase text-center leading-none">Chờ Admin<br/>duyệt mở</span>
                                    </div>
                                )}
                                
                                {/* 3. Status: Cleaning - Show "Clear Table" button */}
                                {isCleaning && moveSourceId === null && (
                                    <button onClick={(e) => { e.stopPropagation(); setConfirmTableId(t.id); }} className="text-[9px] font-black bg-red-600 text-white px-3 py-2 rounded-xl uppercase shadow-xl animate-bounce italic flex items-center gap-1"><RotateCcw size={10}/> Dọn xong</button>
                                )}
                                
                                {/* 4. Status: Occupied/Mine - Show Action Buttons (QR, Move, Bill) */}
                                {isMine && !isAvailable && !isCleaning && !isRequested && moveSourceId === null && (
                                  <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                                    <button title="Xem QR Code" onClick={(e) => { e.stopPropagation(); setShowQrModalId(t.id); }} className="p-2 bg-slate-900 text-white rounded-xl shadow-lg hover:bg-slate-700 transition-colors"><QrCode size={12} /></button>
                                    {t.id !== 0 && <button title="Chuyển/Gộp bàn" onClick={(e) => { e.stopPropagation(); setMoveSourceId(t.id); }} className="p-2 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-colors"><ArrowRightLeft size={12} /></button>}
                                    {hasOrders && <button title="Xem Hóa đơn" onClick={(e) => { e.stopPropagation(); setShowBillTableId(t.id); }} className="p-2 rounded-xl bg-indigo-500 text-white shadow-lg hover:bg-indigo-700 transition-colors"><FileText size={12} /></button>}
                                  </div>
                                )}

                                {/* Overlay in Move Mode */}
                                {moveSourceId !== null && t.id !== moveSourceId && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/20 rounded-2xl backdrop-blur-[1px]">
                                        <span className="text-[8px] font-black uppercase text-indigo-600 bg-white px-2 py-1 rounded-lg shadow-sm border border-indigo-100">Click để Gộp/Chuyển</span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </section>
          </div>
        )}

        {/* ORDER TAB */}
        {activeTab === 'ORDER' && (
           <div className="flex flex-col h-full overflow-hidden animate-slideUp">
              <div className="bg-white p-4 border-b border-slate-100 space-y-3 shrink-0 shadow-sm z-10">
                  <div className="flex bg-slate-50 rounded-2xl flex items-center px-4 py-3 border border-slate-100">
                     <Search size={16} className="text-slate-300 mr-3 shrink-0"/>
                     <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm món ăn nhanh..." className="bg-transparent w-full outline-none font-black text-[11px] uppercase placeholder:text-slate-300" />
                  </div>
                  
                  <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-slate-400 uppercase italic ml-1 leading-none">Đang Order cho:</p>
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                          <button onClick={() => setSelectedTable(0)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black whitespace-nowrap border-2 transition-all shadow-sm shrink-0 ${selectedTable === 0 ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border-slate-100 text-slate-400'}`}>Lẻ (Mang đi)</button>
                          {store.tables.filter((t:any) => t.id !== 0 && t.status === TableStatus.OCCUPIED && t.claimedBy === currentUser.id).map((t:Table) => (
                            <button key={t.id} onClick={() => setSelectedTable(t.id)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black whitespace-nowrap border-2 transition-all shadow-sm shrink-0 ${selectedTable === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-100 text-slate-400'}`}>Bàn {t.id}</button>
                          ))}
                      </div>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                      {CATEGORIES.map(cat => (
                          <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border-2 shrink-0 ${activeCategory === cat ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                              {cat}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-32">
                  {filteredMenu.map((m:MenuItem) => {
                    const cartItem = cart[m.id];
                    const isOut = !m.isAvailable;
                    return (
                        <div key={m.id} className={`p-3 bg-white rounded-2xl border border-slate-100 flex items-center justify-between gap-4 shadow-sm transition-all relative ${isOut ? 'opacity-50 grayscale' : ''}`}>
                            <div className="flex items-center gap-4 min-w-0">
                                <img src={m.image} className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-sm" />
                                <div className="truncate">
                                    <h4 className="text-[11px] font-black text-slate-800 uppercase italic truncate leading-tight mb-1">{m.name}</h4>
                                    <p className="text-[10px] font-bold text-orange-600 italic leading-none">{m.price.toLocaleString()}đ</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
                                {cartItem && cartItem.qty > 0 && (
                                    <button onClick={() => updateCartItem(m.id, cartItem.qty - 1)} className="w-8 h-8 bg-white text-slate-400 rounded-xl shadow-sm flex items-center justify-center font-black active:scale-90 transition-all">-</button>
                                )}
                                {cartItem && cartItem.qty > 0 && (
                                    <span className="text-[12px] font-black text-slate-800 w-5 text-center">{cartItem.qty}</span>
                                )}
                                <button disabled={isOut} onClick={() => updateCartItem(m.id, (cartItem?.qty || 0) + 1)} className={`w-8 h-8 rounded-xl shadow-lg flex items-center justify-center font-black active:scale-90 transition-all ${isOut ? 'bg-slate-200 text-slate-400' : 'bg-orange-500 text-white'}`}>+</button>
                            </div>
                        </div>
                    );
                  })}
              </div>

              {Object.keys(cart).length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 bg-slate-900/95 backdrop-blur-md text-white rounded-[2rem] p-5 shadow-2xl animate-slideUp border border-white/10 z-[50]">
                   <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-[9px] font-black uppercase text-orange-500 tracking-widest mb-1 italic">
                            {selectedTable === null ? '⚠️ Hãy chọn bàn trước' : selectedTable === 0 ? '🔵 Đơn khách lẻ' : `🔴 Bàn số ${selectedTable}`}
                        </p>
                        <h3 className="text-xl font-black italic leading-none">{cartTotal.toLocaleString()}đ</h3>
                      </div>
                   </div>
                   <button onClick={handlePlaceStaffOrder} disabled={selectedTable === null} className={`w-full py-4 rounded-2xl font-black uppercase text-[11px] shadow-xl italic flex items-center justify-center gap-2 transition-all active:scale-95 ${selectedTable !== null ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                      {selectedTable === null ? 'Chọn bàn để gửi đơn' : 'Gửi đơn xuống bếp'} <ChevronRight size={16}/>
                   </button>
                </div>
              )}
           </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'PAYMENTS' && (
           <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              <h2 className="text-xs font-black italic text-slate-800 uppercase flex items-center gap-2"><CreditCard size={18} className="text-orange-500"/> Danh sách thanh toán</h2>
              <div className="space-y-3">
                 {store.tables.filter((t:Table) => (t.currentOrders || []).filter(o => o.status !== OrderItemStatus.CANCELLED).length > 0).map((t:Table) => (
                   <div key={t.id} className={`p-4 rounded-2xl flex items-center justify-between gap-4 transition-all duration-300 ${t.status === TableStatus.PAYING || t.status === TableStatus.BILLING ? 'bg-amber-50 border-2 border-amber-200 shadow-md' : 'bg-white border border-slate-100 shadow-sm opacity-80'}`}>
                      <div className="min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${t.status === TableStatus.PAYING ? 'bg-red-500 animate-ping' : t.status === TableStatus.BILLING ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                            <p className="text-[10px] font-black uppercase text-slate-800 italic">{t.id === 0 ? 'Khách lẻ mang đi' : 'Bàn số ' + t.id}</p>
                         </div>
                      </div>
                      <button onClick={() => setShowBillTableId(t.id)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg italic transition-all active:scale-95">Xem bill</button>
                   </div>
                 ))}
              </div>
           </div>
        )}
      </div>

      {/* Bill Modal */}
      {showBillTableId !== null && currentBillTable && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-7 max-w-sm w-full shadow-2xl animate-scaleIn border border-slate-100 max-h-[90dvh] flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h3 className="text-xl font-black italic uppercase leading-none">Hóa đơn</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{showBillTableId === 0 ? 'Khách lẻ mang đi' : 'Bàn số ' + showBillTableId}</p>
                    </div>
                    <button onClick={() => setShowBillTableId(null)} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all"><X size={18}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 mb-6 border-y border-slate-50 py-5">
                    {currentBillTable.currentOrders.filter((o:any)=>o.status !== OrderItemStatus.CANCELLED).map((o:any) => (
                        <div key={o.id} className="flex justify-between items-center text-[11px] animate-fadeIn group">
                            <span className="font-bold truncate pr-3 text-slate-800 italic uppercase leading-none flex-1">{o.name} <span className="text-orange-500">x{o.quantity}</span></span>
                            <div className="flex items-center gap-3">
                                <span className="font-black text-slate-900 shrink-0">{(o.price * o.quantity).toLocaleString()}đ</span>
                                <button onClick={() => store.cancelOrderItem(showBillTableId, o.id)} className="text-red-500 p-1 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="space-y-4 shrink-0">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-black uppercase text-slate-400 italic">Tổng thanh toán:</span>
                        <span className="text-xl font-black text-orange-600 italic leading-none">{billTotal.toLocaleString()}đ</span>
                    </div>
                    
                    {currentBillTable.status === TableStatus.BILLING ? (
                        <button onClick={() => { store.completeBilling(showBillTableId); setShowBillTableId(null); }} className={`w-full py-5 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl italic active:scale-95 transition-all ${showBillTableId === 0 ? 'bg-indigo-600' : 'bg-green-600'}`}>
                            {showBillTableId === 0 ? 'Hoàn tất đơn' : 'Hoàn tất & Gửi đánh giá'}
                        </button>
                    ) : (
                        <button onClick={() => { store.confirmPayment(showBillTableId); setShowBillTableId(null); }} className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl italic active:scale-95 transition-all">
                            Xác nhận đã nhận tiền
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModalId !== null && qrModalTable && (
        <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl animate-scaleIn border border-white/10 relative">
                <div className="flex justify-between items-center mb-6">
                    <div className="text-left">
                        <h3 className="text-xl font-black italic uppercase leading-none">Mã QR truy cập</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Bàn số {showQrModalId}</p>
                    </div>
                    <button onClick={() => setShowQrModalId(null)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all"><X size={18}/></button>
                </div>
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 mb-8 shadow-inner">
                    {qrModalTable.sessionToken ? (
                        <img src={getFullQrUrl(showQrModalId, qrModalTable.sessionToken)} className="w-56 h-56 object-contain rounded-2xl shadow-md border-4 border-white mx-auto" />
                    ) : (
                        <div className="w-56 h-56 flex flex-col items-center justify-center text-slate-300 gap-2">
                            <AlertCircle size={32} />
                            <span className="text-[10px] font-black uppercase">Chưa có session</span>
                        </div>
                    )}
                </div>
                <button onClick={() => setShowQrModalId(null)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl italic transition-all active:scale-95">Đóng cửa sổ</button>
            </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmTableId !== null} title="Bàn đã dọn xong?" message={`Xác nhận Bàn ${confirmTableId} đã được dọn sạch và sẵn sàng cho khách mới?`} onConfirm={() => { if(confirmTableId !== null) store.setTableEmpty(confirmTableId); setConfirmTableId(null); }} onCancel={() => setConfirmTableId(null)} />
    </div>
  );
};

export default StaffView;
