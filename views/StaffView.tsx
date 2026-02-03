
import React, { useState, useMemo, useCallback } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, Table, OrderType, MenuItem, AppNotification } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { CATEGORIES } from '../constants';
import { QrCode, PlusCircle, Loader2, Coffee, Clock, ShoppingBag, Utensils, Search, FileText, CreditCard, MessageCircle, X, ArrowRightLeft, Bell, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StaffViewProps { store: any; }

const StaffView: React.FC<StaffViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'TABLES' | 'ORDER' | 'PAYMENTS'>('TABLES');
  const [confirmTableId, setConfirmTableId] = useState<number | null>(null);
  const [showQrModalId, setShowQrModalId] = useState<number | null>(null);
  const [showBillTableId, setShowBillTableId] = useState<number | null>(null);
  
  const [moveFromId, setMoveFromId] = useState<number | null>(null);
  const [moveToId, setMoveToId] = useState<number | null>(null);

  const [orderType, setOrderType] = useState<OrderType>(OrderType.TAKEAWAY);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, { qty: number, note: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const currentUser = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('current_user');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  }, []);

  const myTables = useMemo(() => 
    (store.tables || []).filter((t: Table) => t.claimedBy === currentUser.id || t.id === 0)
  , [store.tables, currentUser.id]);

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

  const handleRequestTableQr = async (tid: number) => {
    try {
        await store.requestTableQr(tid, currentUser.id);
    } catch (e: any) {
        if (e.message === "LIMIT_REACHED") {
            alert("Bạn chỉ được mở tối đa 3 bàn! Hãy thanh toán bàn cũ.");
        }
    }
  };

  const handlePlaceStaffOrder = async () => {
    if (selectedTable === null || Object.keys(cart).length === 0) return alert("Chọn đối tượng và món!");
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
      await store.placeOrder(selectedTable, newItems, orderType);
      setCart({}); setSelectedTable(null); setActiveTab('TABLES');
    } catch (e) { alert("Lỗi đặt đơn!"); }
  };

  const handleMoveRequest = async () => {
    if (moveFromId !== null && moveToId !== null) {
        await store.requestTableMove(moveFromId, moveToId, currentUser.id);
        setMoveFromId(null); setMoveToId(null);
    }
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
        const existing = prev[id] as { qty: number, note: string } | undefined;
        return { ...prev, [id]: { qty: existing?.qty || 0, note } };
    });
  };

  const currentBillTable = useMemo(() => 
    store.tables.find((t:any) => t.id === showBillTableId)
  , [store.tables, showBillTableId]);

  const billTotal = useMemo(() => 
    currentBillTable?.currentOrders.reduce((s:number,o:any)=>s+(o.price*o.quantity), 0) || 0
  , [currentBillTable]);

  const getFullQrUrl = (id: number, token: string) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const configParam = btoa(store.cloudUrl);
    const tableUrl = `${baseUrl}#/table/${id}/${token}?config=${configParam}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(tableUrl)}`;
  };

  const getVietQrUrl = (amount: number, tid: number) => {
    return `https://img.vietqr.io/image/${store.bankConfig.bankId}-${store.bankConfig.accountNo}-compact.png?amount=${amount}&addInfo=Thanh+Toan+${tid === 0 ? 'Khach+Le' : 'Ban+' + tid}&accountName=${encodeURIComponent(store.bankConfig.accountName)}`;
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fadeIn pb-24 h-full flex flex-col">
      <div className="flex justify-between items-center bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
         <p className="text-[10px] font-black uppercase text-slate-400">Đang trực: <span className={activeTableCount >= 3 ? 'text-red-500' : 'text-slate-900'}>{activeTableCount}/3</span></p>
         <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${activeTableCount >= 3 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[9px] font-black uppercase text-slate-400">{activeTableCount >= 3 ? 'Đầy bàn' : 'Sẵn sàng'}</span>
         </div>
      </div>

      <div className="flex gap-2 p-1 bg-white rounded-2xl border border-slate-200 w-full overflow-x-auto no-scrollbar shrink-0">
        <button onClick={() => setActiveTab('TABLES')} className={`flex-1 px-4 py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'TABLES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Utensils size={14}/> Bàn</button>
        <button onClick={() => setActiveTab('ORDER')} className={`flex-1 px-4 py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'ORDER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><PlusCircle size={14}/> Gọi món</button>
        <button onClick={() => setActiveTab('PAYMENTS')} className={`flex-1 px-4 py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap ${activeTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Clock size={14}/> Hóa đơn</button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'TABLES' && (
          <div className="space-y-4 md:space-y-6">
            {/* Live Notifications Panel for Staff */}
            {myNotifications.length > 0 && (
                <section className="bg-slate-900 text-white rounded-[2rem] p-6 shadow-xl animate-slideUp">
                    <div className="flex items-center gap-2 mb-4">
                        <Bell size={16} className="text-orange-500 animate-bounce" />
                        <h4 className="text-[10px] font-black uppercase italic tracking-widest text-slate-400">Yêu cầu mới ({myNotifications.length})</h4>
                    </div>
                    <div className="space-y-3">
                        {myNotifications.map((n: AppNotification) => (
                            <div key={n.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-[10px] font-black italic">
                                        {n.payload?.tableId === 0 ? 'L' : n.payload?.tableId}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase">{n.title}</p>
                                        <p className="text-[9px] text-slate-400 italic">{n.message}</p>
                                    </div>
                                </div>
                                <button onClick={() => store.deleteNotification(n.id)} className="p-2 bg-white/10 rounded-lg hover:bg-white/20">
                                    <CheckCircle2 size={16} className="text-green-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-8 border border-slate-100 shadow-sm">
                <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                    {store.tables.map((t: Table) => {
                        const isMine = t.claimedBy === currentUser.id || t.id === 0;
                        const isAvailable = t.status === TableStatus.AVAILABLE;
                        const isOccupied = t.status === TableStatus.OCCUPIED || t.status === TableStatus.PAYING;
                        const isRequested = t.qrRequested;
                        const hasOrders = (t.currentOrders || []).length > 0;
                        const hasCall = myNotifications.some(n => n.payload?.tableId === t.id && n.type === 'call_staff');
                        const hasNewOrder = myNotifications.some(n => n.payload?.tableId === t.id && (n.type === 'order' || n.type === 'kitchen'));
                        
                        return (
                            <div key={t.id} className={`p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border-2 flex flex-col items-center justify-center gap-2 md:gap-3 relative min-h-[120px] md:min-h-[150px] transition-all ${
                                hasCall ? 'ring-4 ring-orange-500/50 animate-pulse' : ''
                            } ${
                                moveFromId === t.id ? 'ring-4 ring-blue-500 border-blue-500 bg-blue-50' :
                                moveToId === t.id ? 'ring-4 ring-green-500 border-green-500 bg-green-50' :
                                t.id === 0 ? 'border-orange-200 bg-orange-50/20' :
                                isMine ? 'border-orange-500 bg-orange-50/10' : 
                                isAvailable ? 'border-dashed border-slate-200 opacity-60' : 'border-slate-100 bg-slate-50 opacity-20'
                            }`}>
                                <div className="absolute -top-2 -right-1 flex gap-1">
                                    {hasCall && <div className="bg-orange-500 text-white p-1 rounded-full shadow-lg"><Bell size={10} /></div>}
                                    {hasNewOrder && <div className="bg-blue-500 text-white p-1 rounded-full shadow-lg"><PlusCircle size={10} /></div>}
                                </div>
                                
                                <span className="font-black text-[10px] md:text-xs uppercase italic text-slate-700">{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id}</span>
                                {isAvailable && !isRequested && t.id !== 0 && (
                                    moveFromId !== null ? (
                                        <button onClick={() => setMoveToId(t.id)} className="bg-blue-600 text-white p-2 rounded-xl shadow-lg"><ArrowRightLeft size={16}/></button>
                                    ) : (
                                        <button onClick={() => handleRequestTableQr(t.id)} className="text-[9px] font-black bg-slate-900 text-white px-3 py-2 rounded-xl uppercase shadow-md">Mở bàn</button>
                                    )
                                )}
                                {isRequested && <Loader2 size={12} className="animate-spin text-orange-500" />}
                                {isMine && !isRequested && !isAvailable && (
                                  <div className="flex flex-wrap justify-center gap-1.5">
                                    {t.sessionToken && <button onClick={() => setShowQrModalId(t.id)} className="p-2 bg-slate-900 text-white rounded-xl shadow-sm" title="Hiện QR Code"><QrCode size={14} /></button>}
                                    {hasOrders && <button onClick={() => setShowBillTableId(t.id)} className={`p-2 rounded-xl text-white ${t.status === TableStatus.PAYING ? 'bg-amber-500 shadow-amber-200/50 shadow-lg' : 'bg-blue-500'}`} title="Xem Bill / Thu tiền"><FileText size={14} /></button>}
                                    {isOccupied && t.id !== 0 && <button onClick={() => setMoveFromId(t.id)} className="p-2 bg-indigo-500 text-white rounded-xl" title="Chuyển bàn"><ArrowRightLeft size={14} /></button>}
                                    {t.status === TableStatus.BILLING && <button onClick={() => setConfirmTableId(t.id)} className="p-2 bg-green-500 text-white rounded-xl" title="Dọn bàn"><Coffee size={14} /></button>}
                                  </div>
                                )}
                            </div>
                        )
                    })}
                </div>
                {moveFromId !== null && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3">
                        <p className="text-[10px] font-black text-blue-800 uppercase italic">
                            {moveToId === null ? `Chuyển Bàn ${moveFromId} -> Chọn bàn trống...` : `Chuyển Bàn ${moveFromId} sang Bàn ${moveToId}?`}
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => {setMoveFromId(null); setMoveToId(null);}} className="text-[10px] font-black uppercase text-slate-400">Hủy</button>
                            {moveToId !== null && <button onClick={handleMoveRequest} className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg">Xác nhận</button>}
                        </div>
                    </div>
                )}
            </section>
          </div>
        )}

        {activeTab === 'ORDER' && (
           <div className="flex flex-col h-full bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-4 md:p-6 border-b border-slate-100 space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="flex-1 bg-slate-50 rounded-2xl flex items-center px-4 py-2 border border-slate-100">
                        <Search size={16} className="text-slate-300 mr-2"/>
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm món..." className="bg-transparent w-full outline-none font-bold text-xs" />
                     </div>
                     <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                        <button onClick={() => setOrderType(OrderType.DINE_IN)} className={`p-2 rounded-lg transition-all ${orderType === OrderType.DINE_IN ? 'bg-white shadow-sm' : 'text-slate-400'}`}><Utensils size={14}/></button>
                        <button onClick={() => setOrderType(OrderType.TAKEAWAY)} className={`p-2 rounded-lg transition-all ${orderType === OrderType.TAKEAWAY ? 'bg-white shadow-sm' : 'text-slate-400'}`}><ShoppingBag size={14}/></button>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                      <button onClick={() => setSelectedTable(0)} className={`px-4 py-2 rounded-xl text-[9px] font-black whitespace-nowrap border-2 ${selectedTable === 0 ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Khách lẻ</button>
                      {store.tables.filter((t:any) => t.id !== 0).map((t:Table) => (
                        <button key={t.id} onClick={() => setSelectedTable(t.id)} className={`px-4 py-2 rounded-xl text-[9px] font-black whitespace-nowrap border-2 ${selectedTable === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Bàn {t.id}</button>
                      ))}
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 no-scrollbar">
                  {store.menu.filter((m:MenuItem) => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((m:MenuItem) => {
                    const cartItem = cart[m.id];
                    return (
                        <div key={m.id} className={`p-3 bg-slate-50 rounded-2xl border border-white transition-all ${!m.isAvailable ? 'opacity-40 grayscale' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <img src={m.image} className="w-12 h-12 rounded-xl object-cover" />
                                    <div>
                                        <h4 className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase truncate max-w-[120px]">{m.name}</h4>
                                        <p className="text-[10px] font-bold text-orange-600">{m.price.toLocaleString()}đ</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 md:gap-3">
                                    {cartItem && cartItem.qty > 0 && <button onClick={() => updateCartItem(m.id, cartItem.qty - 1)} className="w-8 h-8 bg-white rounded-xl shadow-sm font-black text-slate-400">-</button>}
                                    {cartItem && cartItem.qty > 0 && <span className="text-xs font-black text-slate-800">{cartItem.qty}</span>}
                                    <button disabled={!m.isAvailable} onClick={() => updateCartItem(m.id, (cartItem?.qty || 0) + 1)} className="w-8 h-8 bg-orange-500 text-white rounded-xl shadow-lg font-black">+</button>
                                </div>
                            </div>
                            {cartItem && cartItem.qty > 0 && (
                                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100 mt-2">
                                    <MessageCircle size={14} className="text-slate-300" />
                                    <input type="text" placeholder="Ghi chú..." value={cartItem.note} onChange={(e) => updateCartNote(m.id, e.target.value)} className="bg-transparent text-[10px] font-bold w-full outline-none" />
                                </div>
                            )}
                        </div>
                    );
                  })}
              </div>
              {Object.keys(cart).length > 0 && (
                <div className="p-4 md:p-6 bg-slate-900 text-white rounded-t-[2rem] md:rounded-t-[2.5rem] shadow-2xl animate-slideUp">
                   <div className="flex justify-between items-center mb-4">
                      <span className="text-base md:text-lg font-black italic">{cartTotal.toLocaleString()}đ</span>
                      <span className="text-[10px] font-black uppercase italic text-orange-500">{orderType === OrderType.TAKEAWAY ? 'Mang về' : 'Tại chỗ'}</span>
                   </div>
                   <button onClick={handlePlaceStaffOrder} className="w-full py-4 bg-orange-500 rounded-xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all">Gửi đơn hàng</button>
                </div>
              )}
           </div>
        )}

        {activeTab === 'PAYMENTS' && (
           <div className="bg-white rounded-[2rem] p-4 md:p-8 border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-lg font-black italic text-slate-800 uppercase">💰 Hóa đơn</h2>
              <div className="space-y-3">
                 {myTables.filter((t:Table) => (t.currentOrders || []).length > 0).map((t:Table) => (
                   <div key={t.id} className={`p-4 md:p-6 rounded-2xl flex items-center justify-between transition-all ${t.status === TableStatus.PAYING ? 'bg-amber-50 border border-amber-200' : t.status === TableStatus.BILLING ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-100'}`}>
                      <div>
                         <p className="text-[9px] font-black uppercase text-slate-400 italic">{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id}</p>
                         <h4 className="font-black text-slate-800 text-[11px] uppercase truncate max-w-[150px]">
                            {t.status === TableStatus.PAYING ? 'Chờ duyệt' : t.status === TableStatus.BILLING ? 'Đã thanh toán' : 'Đang phục vụ'}
                         </h4>
                      </div>
                      <button onClick={() => setShowBillTableId(t.id)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase">Xem Bill</button>
                   </div>
                 ))}
              </div>
           </div>
        )}
      </div>

      {/* Bill & VietQR Modal */}
      {showBillTableId !== null && currentBillTable && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-sm w-full shadow-2xl animate-scaleIn border border-slate-100 max-h-[90dvh] overflow-y-auto no-scrollbar text-center">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-black italic uppercase">{showBillTableId === 0 ? 'Khách lẻ' : 'Bàn ' + showBillTableId}</h3>
                    <button onClick={() => setShowBillTableId(null)} className="p-2 bg-slate-100 rounded-full"><X size={16}/></button>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 mb-6 flex flex-col items-center">
                    <p className="text-[10px] font-black text-blue-500 uppercase mb-3">QR Thanh toán</p>
                    <img src={getVietQrUrl(billTotal, showBillTableId)} className="w-48 h-48 md:w-56 md:h-56 object-contain rounded-2xl shadow-sm border-4 border-white" />
                </div>
                <div className="text-left space-y-2 mb-6 border-y border-slate-50 py-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Chi tiết đơn</p>
                    {currentBillTable.currentOrders.map((o:any) => (
                        <div key={o.id} className="flex justify-between text-[10px] font-bold text-slate-600">
                            <span>{o.name} x{o.quantity}</span>
                            <span>{(o.price * o.quantity).toLocaleString()}đ</span>
                        </div>
                    ))}
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-black text-orange-600">
                        <span className="text-[10px] uppercase">Tổng:</span>
                        <span className="text-sm">{billTotal.toLocaleString()}đ</span>
                    </div>
                </div>
                {currentBillTable.status !== TableStatus.PAYING && currentBillTable.status !== TableStatus.BILLING && (
                    <button onClick={() => { store.requestPayment(showBillTableId); setShowBillTableId(null); }} className="w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] shadow-xl">Gửi yêu cầu thanh toán</button>
                )}
            </div>
        </div>
      )}

      {/* QR Code Modal for Customer to Scan */}
      {showQrModalId !== null && (
        <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] p-8 md:p-10 max-w-sm w-full text-center shadow-2xl animate-scaleIn border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 italic uppercase">Quét Menu Bàn {showQrModalId}</h3>
                    <button onClick={() => setShowQrModalId(null)} className="p-2 bg-slate-100 rounded-full"><X size={16}/></button>
                </div>
                <div className="bg-slate-50 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 mb-8 flex flex-col items-center justify-center">
                    <img src={getFullQrUrl(showQrModalId, store.tables.find((t:any)=>t.id === showQrModalId).sessionToken)} className="w-full aspect-square object-contain rounded-2xl shadow-md border-8 border-white" />
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-4 italic">Khách quét để bắt đầu gọi món</p>
                </div>
                <button onClick={() => setShowQrModalId(null)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl active:scale-95 transition-all">Đã xong</button>
            </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmTableId !== null} title="Hoàn tất dọn bàn?" message={`Xác nhận bàn/khách ${confirmTableId === 0 ? 'Khách lẻ' : confirmTableId} đã xong?`} onConfirm={() => { if(confirmTableId !== null) store.setTableEmpty(confirmTableId); setConfirmTableId(null); }} onCancel={() => setConfirmTableId(null)} />
    </div>
  );
};

export default StaffView;
