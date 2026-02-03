
import React, { useMemo, useState } from 'react';
import { OrderItem, OrderItemStatus, AppNotification, UserRole, MenuItem, OrderType } from '../types.ts';
import { Package, Utensils, MessageSquare, Pizza, ChevronRight, XCircle, CheckCircle } from 'lucide-react';

interface KitchenViewProps {
  store: any;
}

const KitchenView: React.FC<KitchenViewProps> = ({ store }) => {
  const [tab, setTab] = useState<'ORDERS' | 'MENU_MGMT'>('ORDERS');
  const [searchTerm, setSearchTerm] = useState('');

  const kitchenCommands = useMemo(() => 
    (store.notifications || []).filter((n: AppNotification) => n.targetRole === UserRole.KITCHEN)
  , [store.notifications]);

  const incoming = (store.tables || []).flatMap((t: any) => 
    (t.currentOrders || [])
      .filter((o: OrderItem) => o.status === OrderItemStatus.CONFIRMED)
      .map((o: OrderItem) => ({ ...o, tableId: t.id, orderType: t.orderType }))
  );

  const inProgress = (store.tables || []).flatMap((t: any) => 
    (t.currentOrders || [])
      .filter((o: OrderItem) => o.status === OrderItemStatus.COOKING)
      .map((o: OrderItem) => ({ ...o, tableId: t.id, orderType: t.orderType }))
  );

  return (
    <div className="space-y-8 animate-fadeIn h-full flex flex-col">
      <div className="flex gap-4 p-1.5 bg-white rounded-2xl border border-slate-200 w-fit shrink-0">
         <button onClick={() => setTab('ORDERS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tab === 'ORDERS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Đơn Chế Biến</button>
         <button onClick={() => setTab('MENU_MGMT')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${tab === 'MENU_MGMT' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Quản Lý Món</button>
      </div>

      {tab === 'ORDERS' ? (
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-10">
          {kitchenCommands.length > 0 && (
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                <h2 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em] mb-4">Lệnh từ Phục Vụ</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {kitchenCommands.map((cmd: AppNotification) => (
                        <div key={cmd.id} className="flex items-start justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 border-l-4 border-l-blue-500">
                            <div><p className="font-black text-sm italic">"{cmd.message}"</p><span className="text-[9px] text-white/20 font-bold mt-1 block">{new Date(cmd.timestamp).toLocaleTimeString()}</span></div>
                            <button onClick={() => store.deleteNotification(cmd.id)} className="text-[9px] font-black px-3 py-1.5 rounded-lg uppercase text-blue-300">Đã đọc</button>
                        </div>
                    ))}
                </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="space-y-4">
                <h2 className="text-xl font-black flex items-center gap-3 text-slate-800 italic uppercase tracking-tighter"><span className="bg-slate-900 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">1</span> Món mới nhận</h2>
                {incoming.length === 0 ? <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-300 font-black uppercase text-xs italic">Trống</div> : 
                    incoming.map((item: any) => (
                        <div key={item.id} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                            {item.orderType === OrderType.TAKEAWAY && <div className="absolute top-0 right-0 bg-red-500 text-white px-4 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase italic animate-pulse">Mang về</div>}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">{item.tableId === 0 ? 'Khách lẻ' : 'Bàn ' + item.tableId}</span>
                                    <h3 className="text-lg font-black text-slate-800">{item.name}</h3>
                                    {item.note && (
                                        <div className="mt-2 flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200 shadow-sm">
                                            <MessageSquare size={14} className="shrink-0" />
                                            <p className="text-[11px] font-black uppercase italic leading-tight">{item.note}</p>
                                        </div>
                                    )}
                                </div>
                                <span className="text-3xl font-black text-slate-900 bg-slate-50 px-3 py-1 rounded-xl">x{item.quantity}</span>
                            </div>
                            <button onClick={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.COOKING)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all">Chế biến</button>
                        </div>
                    ))
                }
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-black flex items-center gap-3 text-orange-600 italic uppercase tracking-tighter"><span className="bg-orange-500 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">2</span> Đang nấu</h2>
                {inProgress.length === 0 ? <div className="bg-orange-50 border-2 border-dashed border-orange-100 rounded-3xl p-12 text-center text-orange-200 font-black uppercase text-xs italic">Trống</div> : 
                    inProgress.map((item: any) => (
                        <div key={item.id} className="bg-white p-5 rounded-[2rem] border-2 border-orange-500 shadow-xl shadow-orange-50 relative overflow-hidden">
                            {item.orderType === OrderType.TAKEAWAY && <div className="absolute top-0 right-0 bg-red-500 text-white px-4 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase italic">Mang về</div>}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[9px] font-black tracking-widest text-orange-400 uppercase">{item.tableId === 0 ? 'Khách lẻ' : 'Bàn ' + item.tableId}</span>
                                    <h3 className="text-lg font-black text-slate-800">{item.name}</h3>
                                    {item.note && (
                                        <div className="mt-2 flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200 shadow-sm">
                                            <MessageSquare size={14} className="shrink-0" />
                                            <p className="text-[11px] font-black uppercase italic leading-tight">{item.note}</p>
                                        </div>
                                    )}
                                </div>
                                <span className="text-3xl font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-xl">x{item.quantity}</span>
                            </div>
                            <button onClick={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.READY)} className="w-full bg-orange-500 text-white py-4 rounded-xl font-black text-xs uppercase shadow-lg active:scale-95 transition-all">Hoàn tất & Gọi bưng</button>
                        </div>
                    ))
                }
            </section>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-center gap-4 mb-8 bg-slate-50 p-4 rounded-2xl shrink-0">
               <Pizza className="text-orange-500" />
               <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm kiếm món để cập nhật tình trạng..." className="bg-transparent border-none outline-none font-bold text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {store.menu.filter((m: MenuItem) => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item: MenuItem) => (
                  <div key={item.id} className={`p-4 rounded-3xl border-2 transition-all flex items-center justify-between ${item.isAvailable ? 'border-green-100 bg-green-50/20' : 'border-red-100 bg-red-50/20 grayscale'}`}>
                     <div className="flex items-center gap-3">
                        <img src={item.image} className="w-12 h-12 rounded-xl object-cover" />
                        <div>
                           <h4 className="font-black text-slate-800 text-xs truncate uppercase">{item.name}</h4>
                           <span className={`text-[8px] font-black uppercase ${item.isAvailable ? 'text-green-500' : 'text-red-500'}`}>{item.isAvailable ? 'Sẵn sàng' : 'Hết món'}</span>
                        </div>
                     </div>
                     <button onClick={() => store.toggleMenuItemAvailability(item.id)} className={`p-2.5 rounded-xl shadow-sm transition-all ${item.isAvailable ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                        {item.isAvailable ? <XCircle size={18}/> : <CheckCircle size={18}/>}
                     </button>
                  </div>
               ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default KitchenView;
