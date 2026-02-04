
import React, { useMemo, useState } from 'react';
import { OrderItem, OrderItemStatus, AppNotification, UserRole, MenuItem, OrderType, User, HistoryEntry } from '../types.ts';
import { Pizza, XCircle, CheckCircle, AlertTriangle, ChefHat, Clock, BellRing, Target, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { ensureArray } from '../store.ts';

interface KitchenViewProps {
  store: any;
  currentUser: User;
}

const KitchenItemCard = ({ item, onAction, actionLabel, colorClass, store, currentUserId }: { 
  item: any, 
  onAction: () => void, 
  actionLabel: string, 
  colorClass: string,
  store: any,
  currentUserId: string
}) => {
  const isTakeaway = item.orderType === OrderType.TAKEAWAY;
  
  return (
    <div className={`bg-white p-5 rounded-[2rem] border-2 shadow-sm relative overflow-hidden group transition-all ${isTakeaway ? 'border-red-200 bg-red-50/10' : 'border-slate-100'}`}>
      {/* Badge phân biệt loại đơn hàng */}
      <div className={`absolute top-0 right-0 px-4 py-1.5 rounded-bl-2xl text-[9px] font-black uppercase italic flex items-center gap-1.5 shadow-sm ${
        isTakeaway ? 'bg-red-500 text-white' : 'bg-slate-800 text-white'
      }`}>
        {isTakeaway ? <ShoppingBag size={10}/> : <UtensilsCrossed size={10}/>}
        {isTakeaway ? 'Mang về' : 'Tại bàn'}
      </div>

      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-black tracking-widest uppercase ${isTakeaway ? 'text-red-500' : 'text-slate-400'}`}>
              {item.tableId === 0 ? 'KHÁCH LẺ' : `BÀN ${item.tableId}`}
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-800 uppercase leading-tight">{item.name}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <Clock size={10} className="text-slate-300"/>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
              {new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          {item.note && (
            <div className="mt-2 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-lg">
              <p className="text-[10px] font-bold text-orange-600 italic">Ghi chú: {item.note}</p>
            </div>
          )}
        </div>
        <div className={`text-3xl font-black px-4 py-2 rounded-2xl ${isTakeaway ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-900'}`}>
          x{item.quantity}
        </div>
      </div>

      <button 
        onClick={onAction} 
        className={`w-full py-4 rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all italic ${colorClass}`}
      >
        {actionLabel}
      </button>
    </div>
  );
};

const KitchenView: React.FC<KitchenViewProps> = ({ store, currentUser }) => {
  const [tab, setTab] = useState<'ORDERS' | 'MENU_MGMT' | 'MY_KPI'>('ORDERS');
  const [searchTerm, setSearchTerm] = useState('');

  const kitchenCommands = useMemo(() => 
    ensureArray<AppNotification>(store.notifications).filter((n: AppNotification) => n.targetRole === UserRole.KITCHEN)
  , [store.notifications]);

  const incoming = useMemo(() => (store.tables || []).flatMap((t: any) => 
    ensureArray<OrderItem>(t.currentOrders)
      .filter((o: OrderItem) => o.status === OrderItemStatus.CONFIRMED)
      .map((o: OrderItem) => ({ ...o, tableId: t.id, orderType: t.orderType || (t.id === 0 ? OrderType.TAKEAWAY : OrderType.DINE_IN) }))
  ).sort((a,b) => a.timestamp - b.timestamp), [store.tables]); // Sắp xếp theo thời gian cũ nhất lên trước

  const inProgress = useMemo(() => (store.tables || []).flatMap((t: any) => 
    ensureArray<OrderItem>(t.currentOrders)
      .filter((o: OrderItem) => o.status === OrderItemStatus.COOKING)
      .map((o: OrderItem) => ({ ...o, tableId: t.id, orderType: t.orderType || (t.id === 0 ? OrderType.TAKEAWAY : OrderType.DINE_IN) }))
  ).sort((a,b) => a.timestamp - b.timestamp), [store.tables]);

  const myKpiStats = useMemo(() => {
    const history = ensureArray<HistoryEntry>(store.history);
    let dishesCount = 0;
    history.forEach(h => {
        dishesCount += ensureArray<OrderItem>(h.items).filter(i => i.kitchenStaffId === currentUser.id && i.status !== OrderItemStatus.CANCELLED).length;
    });
    return { dishesCount };
  }, [store.history, currentUser.id]);

  return (
    <div className="space-y-6 animate-fadeIn h-full flex flex-col pb-10">
      <div className="flex gap-3 p-1.5 bg-white rounded-2xl border border-slate-200 w-fit shrink-0 overflow-x-auto no-scrollbar">
         <button onClick={() => setTab('ORDERS')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${tab === 'ORDERS' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Đơn Chế Biến</button>
         <button onClick={() => setTab('MENU_MGMT')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${tab === 'MENU_MGMT' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Quản Lý Món</button>
         <button onClick={() => setTab('MY_KPI')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${tab === 'MY_KPI' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Hiệu Suất</button>
      </div>

      {tab === 'ORDERS' ? (
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-8">
          {kitchenCommands.length > 0 && (
            <div className="bg-red-600 text-white p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden animate-slideUp">
                <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle size={18} className="animate-pulse" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] italic">Yêu cầu từ hệ thống</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {kitchenCommands.map((cmd: AppNotification) => (
                        <div key={cmd.id} className="flex items-center justify-between gap-4 bg-white/20 p-4 rounded-2xl border border-white/30 backdrop-blur-sm">
                            <p className="font-black text-[11px] italic leading-tight truncate">{cmd.message}</p>
                            <button onClick={() => store.deleteNotification(cmd.id)} className="bg-white text-red-600 text-[8px] font-black px-3 py-2 rounded-lg uppercase shadow-lg shrink-0">Xong</button>
                        </div>
                    ))}
                </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Cột 1: Món mới */}
            <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg"><ChefHat size={20}/></div>
                        <div>
                            <h2 className="text-sm font-black text-slate-800 uppercase italic leading-none mb-1">1. Đợi chế biến</h2>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Nấu theo thứ tự thời gian</p>
                        </div>
                    </div>
                    <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-3 py-1.5 rounded-xl border border-slate-200">{incoming.length}</span>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                    {incoming.length === 0 ? (
                        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] py-16 text-center">
                            <Pizza className="mx-auto text-slate-100 mb-4" size={48}/>
                            <p className="text-[10px] font-black uppercase text-slate-300 italic">Hết đơn chờ. Nghỉ tay thôi!</p>
                        </div>
                    ) : incoming.map((item: any) => (
                        <KitchenItemCard 
                            key={item.id} 
                            item={item} 
                            onAction={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.COOKING, currentUser.id)}
                            actionLabel="Bắt đầu nấu ngay"
                            colorClass="bg-slate-900 text-white"
                            store={store}
                            currentUserId={currentUser.id}
                        />
                    ))}
                </div>
            </section>

            {/* Cột 2: Đang nấu */}
            <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center shadow-lg"><Clock size={20}/></div>
                        <div>
                            <h2 className="text-sm font-black text-slate-800 uppercase italic leading-none mb-1">2. Đang trên bếp</h2>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Hoàn thiện món ăn</p>
                        </div>
                    </div>
                    <span className="bg-orange-50 text-orange-600 text-[10px] font-black px-3 py-1.5 rounded-xl border border-orange-100">{inProgress.length}</span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {inProgress.length === 0 ? (
                        <div className="bg-orange-50/30 border-2 border-dashed border-orange-100 rounded-[2.5rem] py-16 text-center">
                            <Clock className="mx-auto text-orange-100 mb-4" size={48}/>
                            <p className="text-[10px] font-black uppercase text-orange-200 italic">Bếp đang trống...</p>
                        </div>
                    ) : inProgress.map((item: any) => (
                        <KitchenItemCard 
                            key={item.id} 
                            item={item} 
                            onAction={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.READY, currentUser.id)}
                            actionLabel="Hoàn thành & Gọi bưng"
                            colorClass="bg-orange-500 text-white"
                            store={store}
                            currentUserId={currentUser.id}
                        />
                    ))}
                </div>
            </section>
          </div>
        </div>
      ) : tab === 'MENU_MGMT' ? (
        <div className="flex-1 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col overflow-hidden mb-10">
            <div className="flex items-center gap-4 mb-8 bg-slate-50 p-4 rounded-2xl shrink-0 border border-slate-100">
               <Search className="text-slate-400 ml-2" size={18} />
               <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="TÌM MÓN CẦN BÁO HẾT..." className="bg-transparent border-none outline-none font-black text-[11px] uppercase w-full py-1" />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {ensureArray<MenuItem>(store.menu).filter((m: MenuItem) => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map((item: MenuItem) => (
                  <div key={item.id} className={`p-4 rounded-3xl border-2 transition-all flex items-center justify-between ${item.isAvailable ? 'border-green-100 bg-green-50/20' : 'border-red-100 bg-red-50/20 grayscale'}`}>
                     <div className="flex items-center gap-3 min-w-0">
                        <img src={item.image} className="w-12 h-12 rounded-xl object-cover shadow-sm" />
                        <div className="truncate">
                           <h4 className="font-black text-slate-800 text-xs truncate uppercase leading-none mb-1">{item.name}</h4>
                           <span className={`text-[8px] font-black uppercase italic ${item.isAvailable ? 'text-green-500' : 'text-red-500'}`}>{item.isAvailable ? 'Còn món' : 'Hết món'}</span>
                        </div>
                     </div>
                     <button onClick={() => store.toggleMenuItemAvailability(item.id)} className={`p-2.5 rounded-xl shadow-md transition-all active:scale-90 ${item.isAvailable ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                        {item.isAvailable ? <XCircle size={20}/> : <CheckCircle size={20}/>}
                     </button>
                  </div>
               ))}
            </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
           <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100 text-center">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                    <Target size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-2">Thống kê cá nhân</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-10">Hiệu suất làm việc của bạn</p>
                
                <div className="grid grid-cols-1 gap-6 max-w-sm mx-auto">
                    <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden text-left">
                        <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest mb-2">Món ăn đã hoàn thành</p>
                        <h3 className="text-5xl font-black italic leading-none">{myKpiStats.dishesCount}</h3>
                        <div className="absolute -bottom-4 -right-4 text-white/5"><ChefHat size={120}/></div>
                    </div>
                    <div className="bg-emerald-500 rounded-[2.5rem] p-8 text-white relative overflow-hidden text-left">
                        <p className="text-[10px] font-black text-white/60 uppercase italic tracking-widest mb-2">Trạng thái Bếp</p>
                        <h3 className="text-xl font-black italic uppercase">Đang sẵn sàng</h3>
                    </div>
                </div>
           </div>
        </div>
      )}
    </div>
  );
};

// Re-importing missing icons for the search
const Search = ({ className, size }: { className?: string, size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

export default KitchenView;
