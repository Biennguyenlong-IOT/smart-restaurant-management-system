
import React, { useState, useMemo, useEffect } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, AppNotification, Table } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { ArrowRightLeft, Combine, QrCode, CheckCircle2, ChefHat, Trash2, X, PlusCircle, Loader2 } from 'lucide-react';

interface StaffViewProps {
  store: any;
}

const StaffView: React.FC<StaffViewProps> = ({ store }) => {
  const [confirmTableId, setConfirmTableId] = useState<number | null>(null);
  const [showQrModalId, setShowQrModalId] = useState<number | null>(null);
  const [moveModal, setMoveModal] = useState<{ fromId: number; type: 'SWAP' | 'MERGE' } | null>(null);
  
  const currentUser = JSON.parse(localStorage.getItem('current_user') || '{}');

  const myTables = useMemo(() => 
    (store.tables || []).filter((t: Table) => t.claimedBy === currentUser.id)
  , [store.tables, currentUser.id]);

  const readyItems = useMemo(() => myTables.flatMap((t: Table) => 
    (t.currentOrders || [])
      .filter((o: OrderItem) => o.status === OrderItemStatus.READY)
      .map((o: OrderItem) => ({ ...o, tableId: t.id }))
  ), [myTables]);

  const pendingOrders = useMemo(() => myTables.filter((t: Table) => 
    (t.currentOrders || []).some((o: OrderItem) => o.status === OrderItemStatus.PENDING)
  ), [myTables]);

  const getFullQrUrl = (id: number, token: string) => {
    // Tự động đính kèm URL Database vào mã QR cho khách
    const baseUrl = window.location.origin + window.location.pathname;
    const configParam = btoa(store.cloudUrl);
    const tableUrl = `${baseUrl}#/table/${id}/${token}?config=${configParam}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableUrl)}`;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <ConfirmModal 
        isOpen={confirmTableId !== null}
        title={`Xác nhận dọn bàn ${confirmTableId}`}
        message="Bàn đã được thu tiền và dọn sạch sẵn sàng đón khách mới?"
        confirmText="Xác nhận"
        onConfirm={() => { 
            if (confirmTableId) store.setTableEmpty(confirmTableId);
            setConfirmTableId(null); 
        }}
        onCancel={() => setConfirmTableId(null)}
      />

      {showQrModalId && (
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl animate-scaleIn">
                <h3 className="text-2xl font-black text-slate-800 mb-2">Mã QR Bàn {showQrModalId}</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8 px-4">Đưa khách quét - Họ sẽ tự động kết nối hệ thống</p>
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-8">
                    <img src={getFullQrUrl(showQrModalId, store.tables.find((t:any)=>t.id === showQrModalId).sessionToken)} alt="QR" className="w-full h-auto rounded-xl" />
                </div>
                <button onClick={() => setShowQrModalId(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Đóng</button>
            </div>
        </div>
      )}

      {moveModal && (
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] p-8 max-w-md w-full shadow-2xl animate-scaleIn">
                <h3 className="text-xl font-black text-slate-800 mb-4">{moveModal.type === 'SWAP' ? 'Đổi Bàn' : 'Gộp Bàn'} Bàn {moveModal.fromId}</h3>
                <p className="text-slate-500 text-sm mb-6">Chọn bàn trống để chuyển/gộp:</p>
                <div className="grid grid-cols-4 gap-2 mb-8">
                    {store.tables.filter((t: Table) => t.status === TableStatus.AVAILABLE && !t.qrRequested).map((t: Table) => (
                        <button 
                            key={t.id} 
                            onClick={() => { store.requestMoveTable(moveModal.fromId, t.id, moveModal.type, currentUser.id); setMoveModal(null); }}
                            className="w-full aspect-square bg-slate-50 hover:bg-orange-500 hover:text-white rounded-xl font-black transition-all border border-slate-200"
                        >
                            {t.id}
                        </button>
                    ))}
                </div>
                <button onClick={() => setMoveModal(null)} className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Huỷ bỏ</button>
            </div>
        </div>
      )}

      <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-lg font-black flex items-center gap-3">🛋️ Bàn đang phục vụ ({myTables.length}/3)</h2>
          <span className="text-[10px] font-black text-slate-400 uppercase">NV: {currentUser.fullName}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {store.tables.map((t: Table) => {
                const isMine = t.claimedBy === currentUser.id;
                const isRequested = t.qrRequested;
                
                return (
                    <div key={t.id} className={`p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center gap-2 relative ${
                        isMine ? 'border-orange-500 bg-orange-50/20' : 
                        t.status === TableStatus.AVAILABLE ? 'border-dashed border-slate-200 hover:border-orange-500 opacity-60' : 
                        'border-slate-100 bg-slate-50 opacity-40 grayscale pointer-events-none'
                    }`}>
                        <span className="font-black text-lg">Bàn {t.id}</span>
                        
                        {t.status === TableStatus.AVAILABLE && !isRequested && (
                            <button onClick={() => store.requestTableQr(t.id, currentUser.id)} className="text-[9px] font-black bg-slate-900 text-white px-3 py-2 rounded-xl uppercase flex items-center gap-1 shadow-md">
                                <PlusCircle size={12} /> Mở bàn
                            </button>
                        )}

                        {isRequested && (
                            <div className="flex flex-col items-center gap-1 text-[8px] font-black text-orange-500 uppercase italic">
                                <Loader2 size={12} className="animate-spin" /> Chờ Admin...
                            </div>
                        )}

                        {isMine && !isRequested && (
                          <div className="flex gap-1.5 mt-1">
                            <button onClick={() => setMoveModal({ fromId: t.id, type: 'SWAP' })} className="p-1.5 bg-blue-500 text-white rounded-lg" title="Đổi bàn"><ArrowRightLeft size={14} /></button>
                            <button onClick={() => setMoveModal({ fromId: t.id, type: 'MERGE' })} className="p-1.5 bg-purple-500 text-white rounded-lg" title="Gộp bàn"><Combine size={14} /></button>
                            {t.sessionToken && <button onClick={() => setShowQrModalId(t.id)} className="p-1.5 bg-slate-900 text-white rounded-lg" title="Xem QR"><QrCode size={14} /></button>}
                            {t.status === TableStatus.BILLING && <button onClick={() => setConfirmTableId(t.id)} className="p-1.5 bg-green-500 text-white rounded-lg" title="Xác nhận dọn bàn"><CheckCircle2 size={14} /></button>}
                          </div>
                        )}
                        
                        {t.claimedBy && !isMine && <span className="text-[8px] font-bold text-slate-400 italic">Bởi {t.claimedBy}</span>}
                    </div>
                )
            })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-black mb-6 flex items-center gap-3">📝 Đơn hàng chờ (Của bạn)</h2>
          <div className="space-y-4">
              {pendingOrders.map((table: Table) => (
                <div key={table.id} className="bg-blue-50/50 border border-blue-100 rounded-[2rem] p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-blue-900 text-xl">Bàn {table.id}</h3>
                    <button onClick={() => store.confirmBulkOrders(table.id)} className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">Duyệt Đơn</button>
                  </div>
                  <div className="space-y-2">
                    {table.currentOrders.filter(o => o.status === OrderItemStatus.PENDING).map(o => (
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
          <h2 className="text-lg font-black mb-6 flex items-center gap-3">🚀 Sẵn sàng bưng (Của bạn)</h2>
          <div className="space-y-4">
              {readyItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-6 bg-green-50 border border-green-100 rounded-[2rem] animate-slideDown">
                    <div>
                        <span className="text-[9px] font-black text-green-700 bg-white px-3 py-1 rounded-full mb-2 inline-block uppercase tracking-tight">BÀN {item.tableId}</span>
                        <h4 className="font-black text-green-900 text-base">{item.name} <span className="text-green-600 ml-1">x{item.quantity}</span></h4>
                    </div>
                    <button onClick={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.SERVED)} className="bg-green-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black hover:bg-green-700 uppercase">Đã bưng</button>
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
