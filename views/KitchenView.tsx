
import React, { useMemo } from 'react';
import { OrderItem, OrderItemStatus, AppNotification, UserRole } from '../types';

interface KitchenViewProps {
  store: any;
}

const KitchenView: React.FC<KitchenViewProps> = ({ store }) => {
  // Lọc thông báo dành riêng cho KITCHEN
  const kitchenCommands = useMemo(() => 
    (store.notifications || []).filter((n: AppNotification) => n.targetRole === UserRole.KITCHEN && n.type === 'system')
  , [store.notifications]);

  // Món chờ làm
  const incoming = (store.tables || []).flatMap((t: any) => 
    (t.currentOrders || [])
      .filter((o: OrderItem) => o.status === OrderItemStatus.CONFIRMED)
      .map((o: OrderItem) => ({ ...o, tableId: t.id }))
  );

  // Món đang làm
  const inProgress = (store.tables || []).flatMap((t: any) => 
    (t.currentOrders || [])
      .filter((o: OrderItem) => o.status === OrderItemStatus.COOKING)
      .map((o: OrderItem) => ({ ...o, tableId: t.id }))
  );

  return (
    <div className="space-y-10 animate-fadeIn">
      {/* Chỉ thị từ Quản lý cho Bếp */}
      {kitchenCommands.length > 0 && (
        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16"></div>
            <h2 className="text-xs font-black text-blue-400 uppercase tracking-[0.3em] mb-4">Chỉ thị từ Quản lý</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {kitchenCommands.map((cmd: AppNotification) => (
                    <div key={cmd.id} className="flex items-start justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/10 border-l-4 border-l-blue-500">
                        <div className="flex items-start gap-4">
                            <span className="text-2xl">👨‍💼</span>
                            <div>
                                <p className="font-black text-sm italic">"{cmd.message}"</p>
                                <span className="text-[9px] text-white/20 font-bold uppercase mt-1 block">Nhận lúc {new Date(cmd.timestamp).toLocaleTimeString()}</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => store.deleteNotification(cmd.id)}
                            className="bg-blue-500/20 hover:bg-blue-500/40 text-[9px] font-black px-3 py-1.5 rounded-lg uppercase transition-all text-blue-300"
                        >
                            Đã nhận
                        </button>
                    </div>
                ))}
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
            <h2 className="text-xl font-black flex items-center gap-3 text-slate-800">
                <span className="bg-slate-900 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">1</span>
                Món mới nhận
            </h2>
            {incoming.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-300 font-bold italic uppercase text-xs">Chưa có món mới</div>
            ) : (
                <div className="space-y-3">
                    {incoming.map((item: any) => (
                        <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">Bàn {item.tableId}</span>
                                    <h3 className="text-lg font-black text-slate-800">{item.name}</h3>
                                </div>
                                <span className="text-3xl font-black text-slate-900 bg-slate-50 px-3 py-1 rounded-xl">x{item.quantity}</span>
                            </div>
                            <button onClick={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.COOKING)} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">Bắt đầu chế biến</button>
                        </div>
                    ))}
                </div>
            )}
        </section>

        <section className="space-y-4">
            <h2 className="text-xl font-black flex items-center gap-3 text-orange-600">
                <span className="bg-orange-500 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">2</span>
                Đang chế biến
            </h2>
            {inProgress.length === 0 ? (
                <div className="bg-orange-50 border-2 border-dashed border-orange-100 rounded-3xl p-12 text-center text-orange-200 font-bold italic uppercase text-xs">Bếp đang trống</div>
            ) : (
                <div className="space-y-3">
                    {inProgress.map((item: any) => (
                        <div key={item.id} className="bg-white p-5 rounded-2xl border-2 border-orange-500 shadow-xl shadow-orange-50">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[10px] font-black tracking-widest text-orange-400 uppercase">Bàn {item.tableId}</span>
                                    <h3 className="text-lg font-black text-slate-800">{item.name}</h3>
                                    <div className="flex gap-1 mt-2">
                                        {[1,2,3].map(i => <div key={i} className="w-4 h-1 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>)}
                                    </div>
                                </div>
                                <span className="text-3xl font-black text-orange-600 bg-orange-50 px-3 py-1 rounded-xl">x{item.quantity}</span>
                            </div>
                            <button onClick={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.READY)} className="w-full bg-orange-500 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg">Xong - Gọi phục vụ</button>
                        </div>
                    ))}
                </div>
            )}
        </section>
      </div>
    </div>
  );
};

export default KitchenView;
