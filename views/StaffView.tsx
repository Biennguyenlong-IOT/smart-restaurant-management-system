
import React, { useState, useMemo } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, AppNotification } from '../types';
import { ConfirmModal } from '../App';

interface StaffViewProps {
  store: any;
}

const StaffView: React.FC<StaffViewProps> = ({ store }) => {
  const [confirmTableId, setConfirmTableId] = useState<number | null>(null);

  // Thông báo từ hệ thống/admin
  const systemTasks = useMemo(() => 
    (store.notifications || [])
      .filter((n: AppNotification) => (n.targetRole === UserRole.STAFF || n.targetRole === UserRole.ADMIN) && n.type === 'system')
  , [store.notifications]);

  // Món chờ phục vụ
  const readyItems = useMemo(() => (store.tables || []).flatMap((t: any) => 
    (t.currentOrders || [])
      .filter((o: OrderItem) => o.status === OrderItemStatus.READY)
      .map((o: OrderItem) => ({ ...o, tableId: t.id }))
  ), [store.tables]);

  // Món chờ xác nhận
  const pendingOrders = useMemo(() => (store.tables || []).filter((t: any) => 
    (t.currentOrders || []).some((o: OrderItem) => o.status === OrderItemStatus.PENDING)
  ), [store.tables]);

  // Bàn cần dọn dẹp hoặc chờ thanh toán
  const tablesActionNeeded = useMemo(() => (store.tables || []).filter((t: any) => 
    t.status === TableStatus.PAYING || t.status === TableStatus.BILLING || t.needsCleaning
  ), [store.tables]);

  return (
    <div className="space-y-8 animate-fadeIn">
      <ConfirmModal 
        isOpen={confirmTableId !== null}
        title={`Xác nhận dọn bàn ${confirmTableId}`}
        message="Bàn đã được thu tiền và dọn sạch sẵn sàng đón khách mới?"
        confirmText="Xác nhận"
        onConfirm={() => { 
            if (confirmTableId) {
                const table = store.tables.find((t: any) => t.id === confirmTableId);
                if (table && (table.status === TableStatus.BILLING || table.status === TableStatus.AVAILABLE)) {
                    store.setTableEmpty(confirmTableId); 
                } else if (table) {
                    store.markAsCleaned(confirmTableId);
                }
            }
            setConfirmTableId(null); 
        }}
        onCancel={() => setConfirmTableId(null)}
      />

      {/* Thông báo từ Quản lý */}
      {systemTasks.length > 0 && (
        <div className="bg-orange-500 text-white p-6 rounded-[2rem] shadow-xl animate-slideDown">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-orange-200">Yêu cầu từ Quản lý</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {systemTasks.map((task: AppNotification) => (
                    <div key={task.id} className="bg-white/10 p-4 rounded-xl border border-white/20 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">⚡</span>
                            <p className="text-sm font-black">{task.message}</p>
                        </div>
                        <button 
                            onClick={() => store.deleteNotification(task.id)}
                            className="bg-white/20 hover:bg-white/40 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase transition-all"
                        >
                            Xong
                        </button>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Thanh điều khiển phụ */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giám sát Realtime</span>
        </div>
        <button onClick={() => store.pullFromCloud()} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase transition-all">Làm mới dữ liệu</button>
      </div>

      {/* Các bàn cần tác động */}
      {tablesActionNeeded.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tablesActionNeeded.map((t: any) => (
                <div key={t.id} className={`p-8 rounded-[2.5rem] border-2 shadow-xl flex flex-col justify-between ${
                    t.status === TableStatus.PAYING ? 'bg-amber-50 border-amber-400 animate-pulse' : 'bg-orange-50 border-orange-300'
                }`}>
                    <div>
                        <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest bg-white mb-4 inline-block">
                            {t.status === TableStatus.PAYING ? 'Khách gọi thanh toán' : 'Cần dọn dẹp'}
                        </span>
                        <h3 className="text-3xl font-black text-slate-800 mb-2">BÀN {t.id}</h3>
                    </div>
                    {t.status !== TableStatus.PAYING && (
                        <button onClick={() => setConfirmTableId(t.id)} className="mt-6 w-full bg-orange-500 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg shadow-orange-200">Dọn xong - Trả bàn</button>
                    )}
                </div>
            ))}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-black mb-6 flex items-center gap-3">📝 Đơn hàng chờ xác nhận</h2>
          <div className="space-y-4">
              {pendingOrders.map((table: any) => (
                <div key={table.id} className="bg-blue-50/50 border border-blue-100 rounded-[2rem] p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-blue-900 text-xl">Bàn {table.id}</h3>
                    <button onClick={() => store.confirmBulkOrders(table.id)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200">Duyệt & Gửi Bếp</button>
                  </div>
                  <div className="space-y-2">
                    {(table.currentOrders || []).filter((o: any) => o.status === OrderItemStatus.PENDING).map((o: any) => (
                        <div key={o.id} className="flex justify-between text-xs text-blue-900 font-bold bg-white p-3 rounded-xl border border-blue-50">
                            <span>{o.name}</span>
                            <span className="text-blue-600">x{o.quantity}</span>
                        </div>
                    ))}
                  </div>
                </div>
              ))}
              {pendingOrders.length === 0 && <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">Trống</p>}
          </div>
        </section>

        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-black mb-6 flex items-center gap-3">🚀 Món sẵn sàng phục vụ</h2>
          <div className="space-y-4">
              {readyItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-6 bg-green-50 border border-green-100 rounded-[2rem] animate-slideDown">
                    <div>
                        <span className="text-[9px] font-black text-green-700 bg-white px-3 py-1 rounded-full mb-2 inline-block uppercase tracking-tight">BÀN {item.tableId}</span>
                        <h4 className="font-black text-green-900 text-base">{item.name} <span className="text-green-600 ml-1">x{item.quantity}</span></h4>
                    </div>
                    <button onClick={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.SERVED)} className="bg-green-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black hover:bg-green-700 shadow-lg shadow-green-200 uppercase">Đã bưng</button>
                </div>
              ))}
              {readyItems.length === 0 && <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">Trống</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default StaffView;
