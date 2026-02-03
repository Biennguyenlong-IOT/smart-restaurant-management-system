
import React, { useState, useMemo, useCallback } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, Table, OrderType, MenuItem } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { CATEGORIES } from '../constants';
import { QrCode, PlusCircle, Loader2, Coffee, Clock, ShoppingBag, Utensils, Search, FileText, CreditCard } from 'lucide-react';

interface StaffViewProps {
  store: any;
}

const StaffView: React.FC<StaffViewProps> = ({ store }) => {
  const [activeTab, setActiveTab] = useState<'TABLES' | 'ORDER' | 'PAYMENTS'>('TABLES');
  const [confirmTableId, setConfirmTableId] = useState<number | null>(null);
  const [showQrModalId, setShowQrModalId] = useState<number | null>(null);
  const [showBillTableId, setShowBillTableId] = useState<number | null>(null);
  const [orderType, setOrderType] = useState<OrderType>(OrderType.TAKEAWAY);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
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

  const readyItems = useMemo(() => myTables.flatMap((t: Table) => 
    (t.currentOrders || [])
      .filter((o: OrderItem) => o.status === OrderItemStatus.READY)
      .map((o: OrderItem) => ({ ...o, tableId: t.id }))
  ), [myTables]);

  const pendingOrders = useMemo(() => myTables.filter((t: Table) => 
    (t.currentOrders || []).some((o: OrderItem) => o.status === OrderItemStatus.PENDING)
  ), [myTables]);

  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((sum, [id, qty]) => {
      const item = store.menu.find((m: MenuItem) => m.id === id);
      return sum + (item?.price || 0) * (qty as number);
    }, 0);
  }, [cart, store.menu]);

  const handlePlaceStaffOrder = async () => {
    if (selectedTable === null || Object.keys(cart).length === 0) return alert("Vui lòng chọn bàn/khách và chọn món!");
    
    const newItems: OrderItem[] = Object.entries(cart)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([id, qty]) => {
        const m = store.menu.find((x: MenuItem) => x.id === id);
        return {
          id: `ST-${Date.now()}-${id}`,
          menuItemId: id,
          name: m?.name || '',
          price: m?.price || 0,
          quantity: qty as number,
          status: OrderItemStatus.CONFIRMED,
          timestamp: Date.now()
        };
      });

    try {
      await store.placeOrder(selectedTable, newItems, orderType);
      alert("Đã gửi đơn hàng thành công!");
      setCart({}); setSelectedTable(null); setActiveTab('TABLES');
    } catch (e) { alert("Lỗi đặt đơn!"); }
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
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableUrl)}`;
  };

  const getVietQrUrl = (amount: number, tid: number) => {
    return `https://img.vietqr.io/image/${store.bankConfig.bankId}-${store.bankConfig.accountNo}-compact.png?amount=${amount}&addInfo=Thanh+Toan+${tid === 0 ? 'Khach+Le' : 'Ban+' + tid}&accountName=${encodeURIComponent(store.bankConfig.accountName)}`;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-24 h-full flex flex-col">
      <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 w-full overflow-x-auto no-scrollbar shrink-0">
        <button onClick={() => setActiveTab('TABLES')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'TABLES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Utensils size={14}/> Bàn & Khách lẻ</button>
        <button onClick={() => setActiveTab('ORDER')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'ORDER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><PlusCircle size={14}/> Gọi món</button>
        <button onClick={() => setActiveTab('PAYMENTS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Clock size={14}/> Thanh toán {readyItems.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse ml-1"></span>}</button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {activeTab === 'TABLES' && (
          <div className="space-y-8">
            <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-lg font-black flex items-center gap-3 italic">🪑 Khu vực quản lý</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {store.tables.map((t: Table) => {
                        const isMine = t.claimedBy === currentUser.id || t.id === 0;
                        const isRequested = t.qrRequested;
                        const hasOrders = (t.currentOrders || []).length > 0;
                        
                        return (
                            <div key={t.id} className={`p-5 rounded-[2rem] border-2 flex flex-col items-center justify-center gap-3 relative min-h-[140px] transition-all ${
                                t.id === 0 ? 'border-orange-200 bg-orange-50/20' :
                                isMine ? 'border-orange-500 bg-orange-50/10' : 
                                t.status === TableStatus.AVAILABLE ? 'border-dashed border-slate-200 opacity-60' : 'border-slate-100 bg-slate-50 opacity-20 grayscale'
                            }`}>
                                <span className="font-black text-xs uppercase italic text-slate-700">{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id}</span>
                                {t.status === TableStatus.AVAILABLE && !isRequested && t.id !== 0 && (
                                    <button onClick={() => store.requestTableQr(t.id, currentUser.id)} className="text-[9px] font-black bg-slate-900 text-white px-3 py-2.5 rounded-xl uppercase shadow-md">Mở bàn</button>
                                )}
                                {isRequested && <Loader2 size={12} className="animate-spin text-orange-500" />}
                                {isMine && !isRequested && (
                                  <div className="flex gap-1.5">
                                    {t.sessionToken && <button onClick={() => setShowQrModalId(t.id)} className="p-2 bg-slate-900 text-white rounded-xl shadow-lg" title="Mở QR Code"><QrCode size={14} /></button>}
                                    {hasOrders && (
                                        <button onClick={() => setShowBillTableId(t.id)} className={`p-2 rounded-xl shadow-lg text-white ${t.status === TableStatus.PAYING ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'}`} title="Xem Bill/Thanh toán">
                                            <FileText size={14} />
                                        </button>
                                    )}
                                    {t.status === TableStatus.BILLING && <button onClick={() => setConfirmTableId(t.id)} className="p-2 bg-green-500 text-white rounded-xl animate-pulse shadow-lg"><Coffee size={14} /></button>}
                                  </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </section>
            
            <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
               <h2 className="text-lg font-black mb-6 italic">🔔 Đã xong (Chờ bưng)</h2>
               <div className="space-y-4">
                  {readyItems.length === 0 && <p className="text-center py-10 text-slate-300 font-black uppercase text-[10px] italic">Hiện không có món nào chờ bưng</p>}
                  {readyItems.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-5 bg-green-50 border border-green-200 rounded-[2rem]">
                        <div>
                            <span className="text-[8px] font-black text-green-700 uppercase">Đã chế biến xong</span>
                            <h4 className="font-black text-green-900 text-sm italic">{item.tableId === 0 ? 'Khách lẻ' : 'Bàn ' + item.tableId}: {item.name} x{item.quantity}</h4>
                        </div>
                        <button onClick={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.SERVED)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-[9px] font-black uppercase shadow-lg">Xác nhận bưng</button>
                    </div>
                  ))}
               </div>
            </section>
          </div>
        )}

        {activeTab === 'ORDER' && (
           <div className="flex flex-col h-full bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="flex-1 bg-slate-50 rounded-2xl flex items-center px-4 py-2 border border-slate-100">
                        <Search size={16} className="text-slate-300 mr-2"/>
                        <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm món ăn..." className="bg-transparent w-full outline-none font-bold text-xs" />
                     </div>
                     <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setOrderType(OrderType.DINE_IN)} className={`p-2 rounded-lg transition-all ${orderType === OrderType.DINE_IN ? 'bg-white shadow-sm' : 'text-slate-400'}`}><Utensils size={14}/></button>
                        <button onClick={() => setOrderType(OrderType.TAKEAWAY)} className={`p-2 rounded-lg transition-all ${orderType === OrderType.TAKEAWAY ? 'bg-white shadow-sm' : 'text-slate-400'}`}><ShoppingBag size={14}/></button>
                     </div>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 border-y border-slate-50">
                      <p className="text-[10px] font-black text-slate-400 uppercase mr-2 shrink-0">Chọn đối tượng:</p>
                      <button onClick={() => setSelectedTable(0)} className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap border-2 transition-all ${selectedTable === 0 ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>Khách lẻ</button>
                      {store.tables.filter((t:any) => t.id !== 0).map((t:Table) => (
                        <button key={t.id} onClick={() => setSelectedTable(t.id)} className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap border-2 transition-all ${selectedTable === t.id ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-100 text-slate-400 bg-slate-50'}`}>Bàn {t.id}</button>
                      ))}
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                  {store.menu.filter((m:MenuItem) => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((m:MenuItem) => (
                    <div key={m.id} className={`p-3 bg-slate-50 rounded-2xl flex items-center justify-between border border-white transition-all ${!m.isAvailable ? 'opacity-40 grayscale' : ''}`}>
                       <div className="flex items-center gap-3">
                          <img src={m.image} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                          <div>
                             <h4 className="text-[11px] font-black text-slate-800 uppercase truncate w-32 md:w-auto">{m.name}</h4>
                             <p className="text-[10px] font-bold text-orange-600">{m.price.toLocaleString()}đ</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          {(cart[m.id] || 0) > 0 && (
                            <button onClick={() => setCart({...cart, [m.id]: (cart[m.id] || 0)-1})} className="w-8 h-8 bg-white rounded-xl shadow-sm font-black text-slate-400">-</button>
                          )}
                          {(cart[m.id] || 0) > 0 && <span className="text-xs font-black text-slate-800">{cart[m.id]}</span>}
                          <button disabled={!m.isAvailable} onClick={() => setCart({...cart, [m.id]: (cart[m.id]||0)+1})} className="w-8 h-8 bg-orange-500 text-white rounded-xl shadow-lg font-black">+</button>
                       </div>
                    </div>
                  ))}
              </div>
              {Object.keys(cart).some(k => (cart[k] || 0) > 0) && (
                <div className="p-6 bg-slate-900 text-white rounded-t-[2.5rem] shadow-2xl animate-slideUp">
                   <div className="flex justify-between items-center mb-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tổng cộng:</span>
                        <span className="text-lg font-black italic">{cartTotal.toLocaleString()}đ</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase text-orange-500 block mb-1">Loại hình:</span>
                        <span className="text-[11px] font-black uppercase italic">{orderType === OrderType.TAKEAWAY ? 'Mang về' : 'Tại chỗ'}</span>
                      </div>
                   </div>
                   <button onClick={handlePlaceStaffOrder} className="w-full py-5 bg-orange-500 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Gửi yêu cầu đơn hàng</button>
                </div>
              )}
           </div>
        )}

        {activeTab === 'PAYMENTS' && (
           <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
              <h2 className="text-lg font-black italic text-slate-800">💰 Thanh toán hóa đơn</h2>
              <div className="space-y-4">
                 {myTables.filter((t:Table) => (t.currentOrders || []).length > 0 && (t.status === TableStatus.PAYING || t.status === TableStatus.BILLING || t.status === TableStatus.OCCUPIED)).map((t:Table) => (
                   <div key={t.id} className={`p-6 rounded-[2rem] flex items-center justify-between transition-all ${t.status === TableStatus.PAYING ? 'bg-amber-50 border border-amber-200' : t.status === TableStatus.BILLING ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-100'}`}>
                      <div>
                         <p className="text-[9px] font-black uppercase text-slate-400 italic">{t.id === 0 ? 'Đơn khách lẻ' : 'Bàn ' + t.id}</p>
                         <h4 className="font-black text-slate-800 text-sm uppercase">
                            {t.status === TableStatus.PAYING ? 'Chờ Admin duyệt bill' : 
                             t.status === TableStatus.BILLING ? 'Đã thu tiền xong' : 'Đang phục vụ'}
                         </h4>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowBillTableId(t.id)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-1.5 shadow-md">
                            <FileText size={12}/> Xem Bill
                        </button>
                      </div>
                   </div>
                 ))}
                 {myTables.filter((t:Table) => (t.currentOrders || []).length > 0).length === 0 && (
                   <div className="py-20 text-center text-slate-300 font-black uppercase italic text-xs">Hiện tại chưa có hóa đơn nào.</div>
                 )}
              </div>
           </div>
        )}
      </div>

      {/* Modal hiển thị Bill & VietQR cho nhân viên xem và đưa khách scan */}
      {showBillTableId !== null && currentBillTable && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] p-8 max-w-sm w-full shadow-2xl animate-scaleIn border border-slate-100 max-h-[90dvh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black italic uppercase">Hóa đơn: {showBillTableId === 0 ? 'Khách lẻ' : 'Bàn ' + showBillTableId}</h3>
                    <button onClick={() => setShowBillTableId(null)} className="p-2 bg-slate-100 rounded-full"><X size={16}/></button>
                </div>
                
                <div className="space-y-3 mb-6 border-y border-slate-50 py-4">
                    {currentBillTable.currentOrders.map((o:any) => (
                        <div key={o.id} className={`flex justify-between text-xs font-bold ${o.status === OrderItemStatus.CANCELLED ? 'opacity-30 line-through' : 'text-slate-600'}`}>
                            <span>{o.name} x{o.quantity}</span>
                            <span>{(o.price * o.quantity).toLocaleString()}đ</span>
                        </div>
                    ))}
                    <div className="pt-4 flex justify-between items-center border-t border-slate-100 font-black text-orange-600 italic">
                        <span className="text-sm uppercase tracking-tighter">Tổng cộng:</span>
                        <span className="text-lg">{billTotal.toLocaleString()}đ</span>
                    </div>
                </div>

                <div className="space-y-4 text-center">
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-blue-500 uppercase mb-3 flex items-center justify-center gap-2"><CreditCard size={14}/> Mã QR Chuyển khoản</p>
                        <img src={getVietQrUrl(billTotal, showBillTableId)} className="w-48 h-48 mx-auto rounded-2xl shadow-sm border-4 border-white" />
                        <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase italic">{store.bankConfig.accountName}</p>
                    </div>
                    
                    {currentBillTable.status !== TableStatus.PAYING && currentBillTable.status !== TableStatus.BILLING && (
                        <button onClick={() => { store.requestPayment(showBillTableId); setShowBillTableId(null); }} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Gửi yêu cầu thanh toán tới Admin</button>
                    )}
                    
                    {currentBillTable.status === TableStatus.PAYING && (
                        <div className="py-4 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200 text-[10px] font-black uppercase flex items-center justify-center gap-2 animate-pulse">
                            <Clock size={14}/> Đang chờ Admin duyệt Bill...
                        </div>
                    )}

                    {currentBillTable.status === TableStatus.BILLING && (
                        <button onClick={() => { store.setTableEmpty(showBillTableId); setShowBillTableId(null); }} className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl animate-bounce">Đã thu tiền xong (Dọn bàn)</button>
                    )}
                </div>
            </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmTableId !== null} title="Hoàn tất dọn bàn?" message={`Xác nhận bàn/khách ${confirmTableId === 0 ? 'Khách lẻ' : confirmTableId} đã xong?`} onConfirm={() => { if(confirmTableId !== null) store.setTableEmpty(confirmTableId); setConfirmTableId(null); }} onCancel={() => setConfirmTableId(null)} />
      {showQrModalId !== null && (
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] p-8 max-w-sm w-full text-center shadow-2xl animate-scaleIn border border-slate-100">
                <h3 className="text-2xl font-black text-slate-800 mb-6 italic uppercase">Quét QR Bàn {showQrModalId}</h3>
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 mb-8 flex items-center justify-center">
                    <img src={getFullQrUrl(showQrModalId, store.tables.find((t:any)=>t.id === showQrModalId).sessionToken)} className="w-56 h-56 object-contain rounded-2xl shadow-sm" />
                </div>
                <button onClick={() => setShowQrModalId(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl">Đóng QR</button>
            </div>
        </div>
      )}
    </div>
  );
};

// Component con cho biểu tượng X
const X = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);

export default StaffView;
