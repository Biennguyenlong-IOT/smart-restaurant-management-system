
import React, { useState, useMemo, useEffect } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, Table, OrderType, MenuItem, AppNotification } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { CATEGORIES } from '../constants';
import { QrCode, PlusCircle, Loader2, Coffee, Clock, ShoppingBag, Utensils, Search, FileText, CreditCard, MessageCircle, X, ArrowRightLeft, Bell, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';

interface StaffViewProps { store: any; }

// Helper function to generate full URL for table QR code
const getFullQrUrl = (tid: number, token?: string | null) => {
  const baseUrl = window.location.origin + window.location.pathname;
  // Format for HashRouter: #/table/:tableId/:token
  const url = `${baseUrl}#/table/${tid}${token ? '/' + token : ''}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
};

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
    if (selectedTable === null || Object.keys(cart).length === 0) return alert("Chọn bàn & món!");
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

  return (
    <div className="space-y-4 animate-fadeIn pb-24 h-full flex flex-col max-w-full">
      <div className="flex justify-between items-center bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm shrink-0">
         <p className="text-[10px] font-black uppercase text-slate-400">Trực: <span className={activeTableCount >= 3 ? 'text-red-500' : 'text-slate-900'}>{activeTableCount}/3</span></p>
         <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${activeTableCount >= 3 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[9px] font-black uppercase text-slate-400">Trạng thái</span>
         </div>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 w-full overflow-x-auto no-scrollbar shrink-0">
        <button onClick={() => setActiveTab('TABLES')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 whitespace-nowrap ${activeTab === 'TABLES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Utensils size={14}/> Bàn</button>
        <button onClick={() => setActiveTab('ORDER')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 whitespace-nowrap ${activeTab === 'ORDER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><PlusCircle size={14}/> Order</button>
        <button onClick={() => setActiveTab('PAYMENTS')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1 whitespace-nowrap ${activeTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Clock size={14}/> Bill</button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'TABLES' && (
          <div className="space-y-4">
            {myNotifications.length > 0 && (
                <section className="bg-slate-900 text-white rounded-[2rem] p-4 shadow-xl">
                    <div className="flex items-center gap-2 mb-3">
                        <Bell size={14} className="text-orange-500 animate-bounce" />
                        <h4 className="text-[9px] font-black uppercase italic tracking-widest text-slate-400">Yêu cầu ({myNotifications.length})</h4>
                    </div>
                    <div className="space-y-2">
                        {myNotifications.map((n: AppNotification) => (
                            <div key={n.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${n.type === 'kitchen' ? 'bg-green-500' : 'bg-orange-500'}`}>
                                        {n.payload?.tableId === 0 ? 'L' : n.payload?.tableId}
                                    </div>
                                    <div className="truncate">
                                        <p className="text-[10px] font-black uppercase truncate">{n.title}</p>
                                        <p className="text-[8px] text-slate-400 italic truncate">{n.message}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    {n.type === 'order' && (
                                        <button onClick={() => handleConfirmOrder(n.payload?.tableId, n.id)} className="px-2.5 py-1.5 bg-blue-500 text-white rounded-lg text-[8px] font-black uppercase shadow-lg flex items-center gap-1 italic">Duyệt</button>
                                    )}
                                    {n.type === 'kitchen' && (
                                        <button onClick={() => handleServeItem(n.payload?.tableId, n.payload?.itemId, n.id)} className="px-2.5 py-1.5 bg-green-500 text-white rounded-lg text-[8px] font-black uppercase shadow-lg flex items-center gap-1 italic">Bưng</button>
                                    )}
                                    <button onClick={() => store.deleteNotification(n.id)} className="p-1.5 bg-white/10 rounded-lg"><X size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <section className="bg-white rounded-[2rem] p-3 border border-slate-100 shadow-sm">
                <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {store.tables.map((t: Table) => {
                        const isMine = t.claimedBy === currentUser.id || t.id === 0;
                        const isAvailable = t.status === TableStatus.AVAILABLE;
                        const isCleaning = t.status === TableStatus.CLEANING;
                        const isBilling = t.status === TableStatus.BILLING;
                        const isRequested = t.qrRequested;
                        const hasOrders = (t.currentOrders || []).length > 0;
                        
                        return (
                            <div key={t.id} className={`p-3 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 relative min-h-[95px] transition-all ${
                                isCleaning ? 'border-red-500 bg-red-50/20' :
                                isBilling ? 'border-indigo-500 bg-indigo-50/20 animate-pulse' :
                                isMine && !isAvailable ? 'border-orange-500 bg-orange-50/10' : 
                                isAvailable ? 'border-dashed border-slate-200 opacity-60' : 'border-slate-100 bg-slate-50 opacity-40'
                            }`}>
                                <span className="font-black text-[10px] uppercase italic text-slate-700">{t.id === 0 ? 'Lẻ' : 'B' + t.id}</span>
                                {isAvailable && !isRequested && t.id !== 0 && (
                                    <button onClick={() => handleRequestTableQr(t.id)} className="text-[8px] font-black bg-slate-900 text-white px-2 py-1.5 rounded-lg uppercase italic">Mở</button>
                                )}
                                {isCleaning && <button onClick={() => setConfirmTableId(t.id)} className="text-[8px] font-black bg-red-600 text-white px-2 py-1.5 rounded-lg uppercase shadow-md animate-bounce">Dọn</button>}
                                {isMine && !isAvailable && !isCleaning && (
                                  <div className="flex flex-wrap justify-center gap-1">
                                    {t.sessionToken && <button onClick={() => setShowQrModalId(t.id)} className="p-1.5 bg-slate-900 text-white rounded-lg"><QrCode size={12} /></button>}
                                    {hasOrders && <button onClick={() => setShowBillTableId(t.id)} className="p-1.5 rounded-lg bg-indigo-500 text-white"><FileText size={12} /></button>}
                                  </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </section>
          </div>
        )}

        {activeTab === 'ORDER' && (
           <div className="flex flex-col h-full bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 space-y-3">
                  <div className="flex bg-slate-50 rounded-xl flex items-center px-3 py-2 border border-slate-100">
                     <Search size={14} className="text-slate-300 mr-2 shrink-0"/>
                     <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm món..." className="bg-transparent w-full outline-none font-bold text-xs" />
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      <button onClick={() => setSelectedTable(0)} className={`px-4 py-2 rounded-lg text-[9px] font-black whitespace-nowrap border-2 ${selectedTable === 0 ? 'bg-orange-500 text-white border-orange-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>Lẻ</button>
                      {store.tables.filter((t:any) => t.id !== 0).map((t:Table) => (
                        <button key={t.id} onClick={() => setSelectedTable(t.id)} className={`px-4 py-2 rounded-lg text-[9px] font-black whitespace-nowrap border-2 ${selectedTable === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>B{t.id}</button>
                      ))}
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
                  {store.menu.filter((m:MenuItem) => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((m:MenuItem) => {
                    const cartItem = cart[m.id];
                    return (
                        <div key={m.id} className="p-3 bg-slate-50 rounded-xl border border-white flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <img src={m.image} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                <div className="truncate">
                                    <h4 className="text-[10px] font-black text-slate-800 uppercase truncate italic">{m.name}</h4>
                                    <p className="text-[9px] font-bold text-orange-600 italic">{m.price.toLocaleString()}đ</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {cartItem && cartItem.qty > 0 && <button onClick={() => updateCartItem(m.id, cartItem.qty - 1)} className="w-7 h-7 bg-white rounded-lg shadow-sm font-black text-slate-400">-</button>}
                                {cartItem && cartItem.qty > 0 && <span className="text-[11px] font-black text-slate-800 w-3 text-center">{cartItem.qty}</span>}
                                <button disabled={!m.isAvailable} onClick={() => updateCartItem(m.id, (cartItem?.qty || 0) + 1)} className={`w-7 h-7 rounded-lg shadow-lg font-black ${m.isAvailable ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-400'}`}>+</button>
                            </div>
                        </div>
                    );
                  })}
              </div>
              {Object.keys(cart).length > 0 && (
                <div className="p-4 bg-slate-900 text-white rounded-t-[1.5rem] shadow-2xl animate-slideUp">
                   <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-black italic">{cartTotal.toLocaleString()}đ</span>
                      <span className="text-[9px] font-black uppercase italic text-orange-500">{selectedTable === 0 ? 'Khách lẻ' : `Bàn ${selectedTable}`}</span>
                   </div>
                   <button onClick={handlePlaceStaffOrder} className="w-full py-3 bg-orange-500 rounded-xl font-black uppercase text-[10px] shadow-xl italic">Gửi đơn</button>
                </div>
              )}
           </div>
        )}

        {activeTab === 'PAYMENTS' && (
           <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm space-y-4">
              <h2 className="text-xs font-black italic text-slate-800 uppercase">💰 Thanh toán</h2>
              <div className="space-y-2">
                 {store.tables.filter((t:Table) => (t.currentOrders || []).length > 0).map((t:Table) => (
                   <div key={t.id} className={`p-3 rounded-xl flex items-center justify-between gap-3 ${t.status === TableStatus.PAYING || t.status === TableStatus.BILLING ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-100'}`}>
                      <div className="min-w-0">
                         <p className="text-[8px] font-black uppercase text-slate-400 italic mb-1">{t.id === 0 ? 'Lẻ' : 'Bàn ' + t.id}</p>
                         <h4 className="font-black text-slate-800 text-[9px] uppercase truncate italic">{t.status === TableStatus.PAYING ? '🔴 Chờ thu' : t.status === TableStatus.BILLING ? '🔵 Đã gán hóa đơn' : 'Đang dùng'}</h4>
                      </div>
                      <button onClick={() => setShowBillTableId(t.id)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm">Hóa đơn</button>
                   </div>
                 ))}
              </div>
           </div>
        )}
      </div>

      {showBillTableId !== null && currentBillTable && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl animate-scaleIn border border-slate-100 max-h-[90dvh] flex flex-col">
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <h3 className="text-xs font-black italic uppercase">Hóa đơn bàn {showBillTableId === 0 ? 'Lẻ' : showBillTableId}</h3>
                    <button onClick={() => setShowBillTableId(null)} className="p-1 bg-slate-100 rounded-full"><X size={14}/></button>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4 border-y border-slate-50 py-3">
                    {currentBillTable.currentOrders.filter((o:any)=>o.status !== OrderItemStatus.CANCELLED).map((o:any) => (
                        <div key={o.id} className="flex justify-between items-center text-[10px]">
                            <span className="font-bold truncate pr-2 text-slate-800 italic">{o.name} x{o.quantity}</span>
                            <span className="font-black text-slate-600">{(o.price * o.quantity).toLocaleString()}đ</span>
                        </div>
                    ))}
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-black text-orange-600">
                        <span className="text-[9px] uppercase italic">Tổng bill:</span>
                        <span className="text-sm">{billTotal.toLocaleString()}đ</span>
                    </div>
                </div>
                <div className="space-y-3 shrink-0">
                    {currentBillTable.status === TableStatus.BILLING ? (
                        <button onClick={() => { store.completeBilling(showBillTableId); setShowBillTableId(null); }} className="w-full py-4 bg-green-600 text-white rounded-xl font-black uppercase text-[10px] shadow-xl italic">Hoàn tất & Gửi đánh giá</button>
                    ) : (
                        <button onClick={() => { store.confirmPayment(showBillTableId); setShowBillTableId(null); }} className="w-full py-4 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] shadow-xl italic">Xác nhận & In bill</button>
                    )}
                    <img src={getVietQrUrl(billTotal, showBillTableId)} className="w-24 h-24 mx-auto object-contain rounded-xl shadow-sm border-2 border-white" />
                </div>
            </div>
        </div>
      )}

      {showQrModalId !== null && (
        <div className="fixed inset-0 z-[250] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full text-center shadow-2xl animate-scaleIn">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-black italic uppercase">Bàn {showQrModalId}</h3>
                    <button onClick={() => setShowQrModalId(null)} className="p-1 bg-slate-100 rounded-full"><X size={14}/></button>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 mb-6">
                    <img src={getFullQrUrl(showQrModalId, store.tables.find((t:any)=>t.id === showQrModalId).sessionToken)} className="w-48 h-48 object-contain rounded-xl shadow-md border-4 border-white mx-auto" />
                </div>
                <button onClick={() => setShowQrModalId(null)} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] shadow-xl italic">Đóng</button>
            </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmTableId !== null} title="Dọn bàn xong?" message={`Bàn ${confirmTableId} đã sẵn sàng phục vụ?`} onConfirm={() => { if(confirmTableId !== null) store.setTableEmpty(confirmTableId); setConfirmTableId(null); }} onCancel={() => setConfirmTableId(null)} />
    </div>
  );
};

export default StaffView;
