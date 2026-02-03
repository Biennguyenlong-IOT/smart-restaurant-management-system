
import React, { useState, useMemo, useEffect } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, Table, OrderType, MenuItem, AppNotification } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { CATEGORIES } from '../constants';
import { QrCode, PlusCircle, Loader2, Coffee, Clock, ShoppingBag, Utensils, Search, FileText, CreditCard, MessageCircle, X, ArrowRightLeft, Bell, AlertCircle, CheckCircle2, Trash2, Tag, ChevronRight, ArrowLeft, User as UserIcon } from 'lucide-react';

interface StaffViewProps { store: any; }

const getFullQrUrl = (tid: number, token?: string | null) => {
  const baseUrl = window.location.origin + window.location.pathname;
  const url = `${baseUrl}#/table/${tid}${token ? '/' + token : ''}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
};

const StaffView: React.FC<StaffViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'TABLES' | 'ORDER' | 'PAYMENTS'>('TABLES');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [confirmTableId, setConfirmTableId] = useState<number | null>(null);
  const [showQrModalId, setShowQrModalId] = useState<number | null>(null);
  const [showBillTableId, setShowBillTableId] = useState<number | null>(null);
  
  const [moveFromId, setMoveFromId] = useState<number | null>(null);
  const [moveToId, setMoveToId] = useState<number | null>(null);

  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, { qty: number, note: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const currentUser = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('current_user');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  }, []);

  useEffect(() => {
    if (moveFromId !== null && moveToId !== null) {
      const execMove = async () => {
        try {
          await store.requestTableMove(moveFromId, moveToId, currentUser.id);
          alert(`Yêu cầu chuyển bàn chờ duyệt!`);
        } catch (e) { console.error(e); }
        finally { setMoveFromId(null); setMoveToId(null); }
      };
      execMove();
    }
  }, [moveFromId, moveToId, currentUser.id, store]);

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

  const handleServeItem = async (tid: number, oid: string, nid: string) => {
    await store.updateOrderItemStatus(tid, oid, OrderItemStatus.SERVED);
    store.deleteNotification(nid);
  };

  const handleRequestTableQr = async (tid: number) => {
    try { await store.requestTableQr(tid, currentUser.id); } catch (e: any) { alert("Tối đa 3 bàn!"); }
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

  const getVietQrUrl = (amount: number, tid: number) => {
    return `https://img.vietqr.io/image/${store.bankConfig.bankId}-${store.bankConfig.accountNo}-compact.png?amount=${amount}&addInfo=Thanh+Toan+Ban+${tid === 0 ? 'Khach+Le' : tid}&accountName=${encodeURIComponent(store.bankConfig.accountName)}`;
  };

  const filteredMenu = useMemo(() => {
    return store.menu.filter((m: MenuItem) => {
        const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = activeCategory === 'Tất cả' || m.category === activeCategory;
        return matchSearch && matchCategory;
    });
  }, [store.menu, searchTerm, activeCategory]);

  return (
    <div className="space-y-4 animate-fadeIn pb-24 h-full flex flex-col max-w-full overflow-hidden">
      {/* Header Status Bar */}
      <div className="flex justify-between items-center bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm shrink-0">
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

      {/* Main Tab Navigation */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 w-full shrink-0 shadow-sm">
        <button onClick={() => setActiveTab('TABLES')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'TABLES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><Utensils size={14}/> Sơ đồ</button>
        <button onClick={() => { setActiveTab('ORDER'); if(selectedTable === null && cartTotal === 0) setSelectedTable(null); }} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'ORDER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><PlusCircle size={14}/> Order</button>
        <button onClick={() => setActiveTab('PAYMENTS')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}><Clock size={14}/> Bill</button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* TAB 1: TABLES */}
        {activeTab === 'TABLES' && (
          <div className="space-y-4 animate-slideUp">
            {myNotifications.length > 0 && (
                <section className="bg-slate-900 text-white rounded-[2rem] p-5 shadow-xl border border-white/5">
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
                                        <button onClick={() => handleConfirmOrder(n.payload?.tableId, n.id)} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-[8px] font-black uppercase shadow-lg italic">Duyệt món</button>
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

            <section className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm">
                <div className="grid grid-cols-3 xs:grid-cols-4 md:grid-cols-6 gap-3">
                    {store.tables.map((t: Table) => {
                        const isMine = t.claimedBy === currentUser.id || t.id === 0;
                        const isAvailable = t.status === TableStatus.AVAILABLE;
                        const isCleaning = t.status === TableStatus.CLEANING;
                        const isBilling = t.status === TableStatus.BILLING;
                        const isRequested = t.qrRequested;
                        const hasOrders = (t.currentOrders || []).length > 0;
                        
                        return (
                            <div key={t.id} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 relative min-h-[105px] transition-all duration-300 ${
                                isCleaning ? 'border-red-500 bg-red-50/20' :
                                isBilling ? 'border-indigo-500 bg-indigo-50/30 animate-pulse' :
                                isMine && !isAvailable ? 'border-orange-500 bg-orange-50/10' : 
                                isAvailable ? 'border-dashed border-slate-100 opacity-60' : 'border-slate-50 bg-slate-50/30 opacity-40'
                            }`}>
                                <span className={`font-black text-[12px] uppercase italic ${isMine ? 'text-slate-800' : 'text-slate-300'}`}>{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id}</span>
                                {isAvailable && !isRequested && t.id !== 0 && (
                                    <button onClick={() => handleRequestTableQr(t.id)} className="text-[9px] font-black bg-slate-900 text-white px-3 py-2 rounded-xl uppercase italic shadow-md active:scale-95 transition-all">Mở bàn</button>
                                )}
                                {isCleaning && <button onClick={() => setConfirmTableId(t.id)} className="text-[9px] font-black bg-red-600 text-white px-3 py-2 rounded-xl uppercase shadow-xl animate-bounce italic">Dọn bàn</button>}
                                {isMine && !isAvailable && !isCleaning && (
                                  <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                                    {t.sessionToken && <button onClick={() => setShowQrModalId(t.id)} className="p-2 bg-slate-900 text-white rounded-xl shadow-lg"><QrCode size={12} /></button>}
                                    {hasOrders && <button onClick={() => setShowBillTableId(t.id)} className="p-2 rounded-xl bg-indigo-500 text-white shadow-lg"><FileText size={12} /></button>}
                                  </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </section>
          </div>
        )}

        {/* TAB 2: ORDER (REFINED FLOW) */}
        {activeTab === 'ORDER' && (
           <div className="flex flex-col h-full bg-slate-50 rounded-[2rem] overflow-hidden animate-slideUp">
              {selectedTable === null ? (
                /* STEP 1: SELECT TABLE OR GUEST */
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 animate-fadeIn">
                   <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-[2.5rem] flex items-center justify-center shadow-inner"><PlusCircle size={40}/></div>
                   <div>
                      <h2 className="text-xl font-black text-slate-800 uppercase italic mb-2">Bắt đầu gọi món</h2>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chọn khách lẻ hoặc bàn đang phục vụ</p>
                   </div>
                   
                   <div className="w-full space-y-4 max-w-xs">
                      <button onClick={() => setSelectedTable(0)} className="w-full p-6 bg-white border-2 border-orange-500 rounded-[2rem] flex items-center justify-between group active:scale-95 transition-all shadow-xl shadow-orange-50">
                         <div className="text-left">
                            <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest block mb-1">Dành cho</span>
                            <span className="text-lg font-black text-slate-800 uppercase italic">Khách lẻ mang đi</span>
                         </div>
                         <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform"><ShoppingBag size={20}/></div>
                      </button>

                      <div className="pt-4 space-y-3">
                         <p className="text-[9px] font-black text-slate-300 uppercase italic text-left ml-4">Hoặc chọn bàn đang trực:</p>
                         <div className="grid grid-cols-2 gap-3">
                            {store.tables.filter((t:any) => t.id !== 0 && t.status === TableStatus.OCCUPIED && t.claimedBy === currentUser.id).map((t:Table) => (
                               <button key={t.id} onClick={() => setSelectedTable(t.id)} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase italic text-slate-600 hover:border-slate-900 transition-all active:scale-90">
                                  Bàn {t.id}
                               </button>
                            ))}
                         </div>
                         {store.tables.filter((t:any) => t.id !== 0 && t.status === TableStatus.OCCUPIED && t.claimedBy === currentUser.id).length === 0 && (
                            <p className="text-[9px] font-bold text-slate-400 uppercase italic py-4">Bạn chưa nhận bàn trực tiếp nào</p>
                         )}
                      </div>
                   </div>
                </div>
              ) : (
                /* STEP 2: SHOW MENU FOR SELECTED TABLE */
                <>
                  {/* Top Control Bar */}
                  <div className="bg-white p-4 border-b border-slate-100 space-y-4 shrink-0 shadow-sm">
                      <div className="flex items-center justify-between">
                         <button onClick={() => setSelectedTable(null)} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all">
                            <ArrowLeft size={16}/> <span className="text-[10px] font-black uppercase italic">Đổi bàn</span>
                         </button>
                         <div className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase italic shadow-lg">
                            {selectedTable === 0 ? '🔵 Đơn khách lẻ' : `🔴 Bàn số ${selectedTable}`}
                         </div>
                      </div>

                      {/* Search */}
                      <div className="flex bg-slate-50 rounded-2xl flex items-center px-4 py-3 border border-slate-100">
                         <Search size={16} className="text-slate-300 mr-3 shrink-0"/>
                         <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm món ăn nhanh..." className="bg-transparent w-full outline-none font-black text-[11px] uppercase placeholder:text-slate-300" />
                      </div>

                      {/* Category Filter */}
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
                          {CATEGORIES.map(cat => (
                              <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase whitespace-nowrap transition-all border-2 ${activeCategory === cat ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                                  {cat}
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Menu List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-32">
                      {filteredMenu.length === 0 ? (
                        <div className="py-20 text-center space-y-4">
                            <Tag className="mx-auto text-slate-200" size={48}/>
                            <p className="text-[10px] font-black text-slate-300 uppercase italic">Không tìm thấy món ăn phù hợp</p>
                        </div>
                      ) : filteredMenu.map((m:MenuItem) => {
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

                  {/* Floating Summary Cart Bar */}
                  {Object.keys(cart).length > 0 && (
                    <div className="fixed bottom-24 left-4 right-4 bg-slate-900/90 backdrop-blur-md text-white rounded-[2rem] p-5 shadow-2xl animate-slideUp border border-white/10 z-[100]">
                       <div className="flex justify-between items-end mb-4">
                          <div>
                            <p className="text-[9px] font-black uppercase text-orange-500 tracking-widest mb-1 italic">
                                {selectedTable === 0 ? '🔵 Đơn khách lẻ' : `🔴 Bàn số ${selectedTable}`}
                            </p>
                            <h3 className="text-xl font-black italic leading-none">{cartTotal.toLocaleString()}đ</h3>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase italic">Tổng {(Object.values(cart) as { qty: number }[]).reduce((a, b) => a + b.qty, 0)} món</span>
                            <div className="flex -space-x-2">
                                 {Object.keys(cart).slice(0, 3).map(id => (
                                     <img key={id} src={store.menu.find((m:any)=>m.id === id)?.image} className="w-6 h-6 rounded-full border-2 border-slate-900 object-cover" />
                                 ))}
                                 {Object.keys(cart).length > 3 && <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold">+{Object.keys(cart).length - 3}</div>}
                            </div>
                          </div>
                       </div>
                       <button onClick={handlePlaceStaffOrder} className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl italic flex items-center justify-center gap-2 transition-all active:scale-95">
                          Gửi đơn xuống bếp <ChevronRight size={16}/>
                       </button>
                    </div>
                  )}
                </>
              )}
           </div>
        )}

        {/* TAB 3: PAYMENTS */}
        {activeTab === 'PAYMENTS' && (
           <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm space-y-6 animate-slideUp">
              <h2 className="text-xs font-black italic text-slate-800 uppercase flex items-center gap-2"><CreditCard size={18} className="text-orange-500"/> Danh sách thanh toán</h2>
              <div className="space-y-3">
                 {store.tables.filter((t:Table) => (t.currentOrders || []).length > 0).map((t:Table) => (
                   <div key={t.id} className={`p-4 rounded-2xl flex items-center justify-between gap-4 transition-all duration-300 ${t.status === TableStatus.PAYING || t.status === TableStatus.BILLING ? 'bg-amber-50 border-2 border-amber-200 shadow-md' : 'bg-slate-50 border border-slate-100 opacity-80'}`}>
                      <div className="min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${t.status === TableStatus.PAYING ? 'bg-red-500 animate-ping' : t.status === TableStatus.BILLING ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
                            <p className="text-[10px] font-black uppercase text-slate-800 italic">{t.id === 0 ? 'Khách lẻ mang đi' : 'Bàn số ' + t.id}</p>
                         </div>
                         <h4 className="font-black text-slate-400 text-[9px] uppercase tracking-wider italic">{t.status === TableStatus.PAYING ? 'Chờ kiểm tiền' : t.status === TableStatus.BILLING ? 'Đã gán hóa đơn' : 'Đang phục vụ'}</h4>
                      </div>
                      <button onClick={() => setShowBillTableId(t.id)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg italic transition-all active:scale-95">Xem bill</button>
                   </div>
                 ))}
                 {store.tables.filter((t:Table) => (t.currentOrders || []).length > 0).length === 0 && (
                    <div className="py-20 text-center opacity-20 italic font-black uppercase text-[10px]">Chưa có hóa đơn nào</div>
                 )}
              </div>
           </div>
        )}
      </div>

      {/* Bill Modal */}
      {showBillTableId !== null && currentBillTable && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-7 max-w-sm w-full shadow-2xl animate-scaleIn border border-slate-100 max-h-[90dvh] flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-[4rem] -z-10 opacity-50"></div>
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div>
                        <h3 className="text-xl font-black italic uppercase leading-none">Hóa đơn</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{showBillTableId === 0 ? 'Khách lẻ mang đi' : 'Bàn số ' + showBillTableId}</p>
                    </div>
                    <button onClick={() => setShowBillTableId(null)} className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all"><X size={18}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 mb-6 border-y border-slate-50 py-5">
                    {currentBillTable.currentOrders.filter((o:any)=>o.status !== OrderItemStatus.CANCELLED).map((o:any) => (
                        <div key={o.id} className="flex justify-between items-center text-[11px] animate-fadeIn">
                            <span className="font-bold truncate pr-3 text-slate-800 italic uppercase leading-none">{o.name} <span className="text-orange-500">x{o.quantity}</span></span>
                            <span className="font-black text-slate-900 shrink-0">{(o.price * o.quantity).toLocaleString()}đ</span>
                        </div>
                    ))}
                    {currentBillTable.currentOrders.filter((o:any)=>o.status !== OrderItemStatus.CANCELLED).length === 0 && (
                        <p className="text-center py-4 text-[10px] font-bold text-slate-300 uppercase">Hóa đơn rỗng</p>
                    )}
                </div>
                
                <div className="space-y-4 shrink-0">
                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <span className="text-[10px] font-black uppercase text-slate-400 italic">Tổng thanh toán:</span>
                        <span className="text-xl font-black text-orange-600 italic leading-none">{billTotal.toLocaleString()}đ</span>
                    </div>
                    
                    {currentBillTable.status === TableStatus.BILLING ? (
                        <button onClick={() => { store.completeBilling(showBillTableId); setShowBillTableId(null); }} className={`w-full py-5 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl italic active:scale-95 transition-all ${showBillTableId === 0 ? 'bg-indigo-600' : 'bg-green-600'}`}>
                            {showBillTableId === 0 ? 'Hoàn tất & Kết thúc đơn' : 'Hoàn tất & Gửi đánh giá'}
                        </button>
                    ) : (
                        <button onClick={() => { store.confirmPayment(showBillTableId); setShowBillTableId(null); }} className="w-full py-5 bg-orange-500 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl italic active:scale-95 transition-all">
                            Xác nhận đã nhận tiền
                        </button>
                    )}
                    
                    <div className="flex flex-col items-center gap-2 pt-2">
                        <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest italic">Quét mã chuyển khoản</p>
                        <img src={getVietQrUrl(billTotal, showBillTableId)} className="w-28 h-28 object-contain rounded-2xl shadow-sm border-2 border-slate-50 bg-white p-2" />
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* QR Modal */}
      {showQrModalId !== null && (
        <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl animate-scaleIn border border-white/10 relative">
                <div className="flex justify-between items-center mb-6">
                    <div className="text-left">
                        <h3 className="text-xl font-black italic uppercase leading-none">QR Truy cập</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Bàn số {showQrModalId}</p>
                    </div>
                    <button onClick={() => setShowQrModalId(null)} className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all"><X size={18}/></button>
                </div>
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 mb-8 shadow-inner">
                    <img src={getFullQrUrl(showQrModalId, store.tables.find((t:any)=>t.id === showQrModalId).sessionToken)} className="w-56 h-56 object-contain rounded-2xl shadow-md border-4 border-white mx-auto" />
                </div>
                <button onClick={() => setShowQrModalId(null)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] shadow-2xl italic transition-all active:scale-95">Đóng cửa sổ</button>
            </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmTableId !== null} title="Bàn đã dọn xong?" message={`Xác nhận Bàn ${confirmTableId} đã được dọn sạch và sẵn sàng đón khách mới?`} onConfirm={() => { if(confirmTableId !== null) store.setTableEmpty(confirmTableId); setConfirmTableId(null); }} onCancel={() => setConfirmTableId(null)} />
    </div>
  );
};

export default StaffView;
