
import React, { useState, useMemo } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, Table, OrderType, MenuItem, AppNotification, User } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { CATEGORIES } from '../constants';
import { PlusCircle, Coffee, Clock, Utensils, Search, X, Bell, Trash2, Tag, ChevronRight, User as UserIcon, MoveHorizontal, RotateCcw, QrCode } from 'lucide-react';
import { ensureArray } from '../store.ts';

interface StaffViewProps { store: any; currentUser: User; }

const StaffView: React.FC<StaffViewProps> = ({ store, currentUser }) => {
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cart, setCart] = useState<Record<string, { qty: number, note: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'TABLES' | 'ORDER' | 'PAYMENTS'>('TABLES');
  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [showBillTableId, setShowBillTableId] = useState<number | null>(null);
  const [viewQrTable, setViewQrTable] = useState<Table | null>(null);

  const activeTableCount = useMemo(() => 
    ensureArray<Table>(store.tables).filter((t: Table) => t.claimedBy === currentUser.id && t.id !== 0 && t.status !== TableStatus.AVAILABLE).length
  , [store.tables, currentUser.id]);

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

  const handlePlaceStaffOrder = async () => {
    if (selectedTable === null) return alert("Vui lòng chọn bàn/khách lẻ!");
    if (Object.keys(cart).length === 0) return alert("Vui lòng chọn món ăn!");
    
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

  const getTableLink = (t: Table) => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#/table/${t.id}/${t.sessionToken}`;
  };

  return (
    <div className="flex flex-col h-full max-w-full overflow-hidden animate-fadeIn pb-12">
      <div className="bg-white px-5 py-3 border-b border-slate-100 flex justify-between items-center shrink-0">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black italic shadow-lg">S</div>
           <div>
             <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Nhân viên</p>
             <p className="text-xs font-black text-slate-800 uppercase italic leading-none">{currentUser.fullName}</p>
           </div>
         </div>
         <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
            <div className={`w-2 h-2 rounded-full ${activeTableCount >= 3 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
            <span className="text-[9px] font-black uppercase text-slate-600">{activeTableCount}/3 bàn</span>
         </div>
      </div>

      <div className="bg-white p-2 border-b border-slate-200 shrink-0">
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
          <button onClick={() => setActiveTab('TABLES')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'TABLES' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Utensils size={14}/> Sơ đồ</button>
          <button onClick={() => setActiveTab('ORDER')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'ORDER' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><PlusCircle size={14}/> Gọi món</button>
          <button onClick={() => setActiveTab('PAYMENTS')} className={`flex-1 px-3 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${activeTab === 'PAYMENTS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}><Clock size={14}/> Bill</button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
        {activeTab === 'TABLES' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
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
                                    <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-[10px] font-black shrink-0">
                                        {n.payload?.tableId === 0 ? 'L' : n.payload?.tableId}
                                    </div>
                                    <div className="truncate">
                                        <p className="text-[10px] font-black uppercase truncate mb-0.5">{n.title}</p>
                                        <p className="text-[8px] text-slate-400 italic truncate">{n.message}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1.5">
                                    {n.type === 'order' && <button onClick={() => handleConfirmOrder(n.payload?.tableId, n.id)} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-[8px] font-black uppercase italic">Duyệt</button>}
                                    {n.type === 'kitchen' && <button onClick={() => handleServeItem(n.payload?.tableId, n.payload?.itemId, n.id)} className="px-3 py-2 bg-green-500 text-white rounded-lg text-[8px] font-black uppercase italic">Bưng</button>}
                                    <button onClick={() => store.deleteNotification(n.id)} className="p-2 bg-white/10 rounded-lg"><X size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <div className="grid grid-cols-3 gap-3">
                {ensureArray<Table>(store.tables).map((t: Table) => (
                    <div key={t.id} onClick={() => { 
                      if(t.status === TableStatus.AVAILABLE) store.requestTableQr(t.id, currentUser.id);
                      else if(t.status === TableStatus.OCCUPIED) setViewQrTable(t);
                    }} className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all relative h-28 ${t.status === TableStatus.AVAILABLE ? 'border-dashed border-slate-200 bg-white' : 'border-slate-800 bg-slate-900 text-white'}`}>
                        <span className="text-[10px] font-black uppercase italic">{t.id === 0 ? 'LẺ' : 'BÀN '+t.id}</span>
                        {t.status === TableStatus.AVAILABLE ? <PlusCircle size={20} className="text-slate-300"/> : <Utensils size={20} className="text-orange-500"/>}
                        {t.status === TableStatus.PAYING && <div className="absolute top-1 right-1"><Bell size={12} className="text-red-500 animate-bounce"/></div>}
                        {t.status === TableStatus.OCCUPIED && <div className="absolute bottom-1 right-1 opacity-40"><QrCode size={12}/></div>}
                    </div>
                ))}
            </div>
          </div>
        )}

        {/* Modal xem QR */}
        {viewQrTable && (
          <div className="fixed inset-0 z-[250] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
            <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl animate-scaleIn">
               <h3 className="text-xl font-black uppercase italic text-slate-800 mb-6">Mã QR Bàn {viewQrTable.id}</h3>
               <div className="bg-slate-100 p-6 rounded-3xl mb-8 flex flex-col items-center gap-4">
                  <QrCode size={120} className="text-slate-800" />
                  <p className="text-[10px] font-bold text-slate-400 break-all bg-white p-4 rounded-2xl border border-slate-200">{getTableLink(viewQrTable)}</p>
               </div>
               <div className="grid grid-cols-1 gap-3">
                 <button onClick={() => { navigator.clipboard.writeText(getTableLink(viewQrTable)); alert("Đã copy link bàn!"); }} className="py-4 bg-orange-500 text-white rounded-2xl font-black uppercase text-[10px] italic">Copy Link Bàn</button>
                 <button onClick={() => setViewQrTable(null)} className="py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px] italic">Đóng</button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'ORDER' && (
            <div className="flex flex-col h-full p-4">
                <div className="bg-white p-3 rounded-2xl mb-4 border border-slate-200 flex items-center gap-3">
                    <Search size={16} className="text-slate-400"/>
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm món ăn..." className="bg-transparent border-none outline-none font-bold text-xs uppercase w-full"/>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-2 gap-3 mb-24">
                    {ensureArray<MenuItem>(store.menu).filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item: MenuItem) => (
                        <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col gap-2">
                            <img src={item.image} className="w-full h-24 rounded-xl object-cover"/>
                            <h4 className="text-[10px] font-black uppercase truncate">{item.name}</h4>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-orange-600">{item.price.toLocaleString()}đ</span>
                                <div className="flex items-center gap-2">
                                    {cart[item.id] && <button onClick={() => updateCartItem(item.id, (cart[item.id].qty - 1))} className="w-6 h-6 bg-slate-100 rounded-md font-black">-</button>}
                                    {cart[item.id] && <span className="text-[10px] font-black">{cart[item.id].qty}</span>}
                                    <button onClick={() => updateCartItem(item.id, (cart[item.id]?.qty || 0) + 1)} className="w-6 h-6 bg-slate-900 text-white rounded-md font-black">+</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="fixed bottom-16 left-4 right-4 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl z-50">
                    <div className="flex justify-between items-center mb-4">
                        <select value={selectedTable ?? ''} onChange={e => setSelectedTable(parseInt(e.target.value))} className="bg-white/10 border-none outline-none font-black text-[10px] uppercase p-2 rounded-xl">
                            <option value="">Chọn bàn</option>
                            {ensureArray<Table>(store.tables).map(t => <option key={t.id} value={t.id}>{t.id === 0 ? 'Khách lẻ' : 'Bàn ' + t.id}</option>)}
                        </select>
                        <span className="text-xs font-black italic">{(Object.values(cart) as {qty:number}[]).reduce((s,d)=>s+d.qty,0)} món</span>
                    </div>
                    <button onClick={handlePlaceStaffOrder} className="w-full py-4 bg-orange-500 rounded-xl font-black uppercase text-[10px] italic shadow-lg active:scale-95 transition-all">Đặt món ngay</button>
                </div>
            </div>
        )}

        {activeTab === 'PAYMENTS' && (
            <div className="p-4 space-y-4 overflow-y-auto no-scrollbar">
                {ensureArray<Table>(store.tables).filter(t => t.status !== TableStatus.AVAILABLE).map(t => (
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

      <ConfirmModal isOpen={showBillTableId !== null} title={`Tính tiền Bàn ${showBillTableId}`} message="Xác nhận gửi thông tin hóa đơn cho khách?" onConfirm={() => { if(showBillTableId !== null) store.confirmPayment(showBillTableId); setShowBillTableId(null); }} onCancel={() => setShowBillTableId(null)} />
    </div>
  );
};

export default StaffView;
