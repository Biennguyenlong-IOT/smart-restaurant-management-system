
import React, { useState, useMemo } from 'react';
import { OrderItem, OrderItemStatus, TableStatus, UserRole, AppNotification, Table } from '../types.ts';
import { ConfirmModal } from '../App.tsx';
import { ArrowRightLeft, Combine, QrCode, CheckCircle2, ChefHat, Trash2, X, PlusCircle, Loader2, Banknote, Coffee } from 'lucide-react';

interface StaffViewProps {
  store: any;
}

const StaffView: React.FC<StaffViewProps> = ({ store }) => {
  const [confirmTableId, setConfirmTableId] = useState<number | null>(null);
  const [confirmPayTableId, setConfirmPayTableId] = useState<number | null>(null);
  const [showQrModalId, setShowQrModalId] = useState<number | null>(null);
  const [moveModal, setMoveModal] = useState<{ fromId: number; type: 'SWAP' | 'MERGE' } | null>(null);
  
  const currentUser = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('current_user');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  }, []);

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

  const paymentRequests = useMemo(() => myTables.filter((t: Table) => 
    t.status === TableStatus.PAYING
  ), [myTables]);

  const billingTables = useMemo(() => myTables.filter((t: Table) => 
    t.status === TableStatus.BILLING
  ), [myTables]);

  const getFullQrUrl = (id: number, token: string) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const configParam = btoa(store.cloudUrl);
    const tableUrl = `${baseUrl}#/table/${id}/${token}?config=${configParam}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tableUrl)}`;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Modal Xác nhận Dọn bàn */}
      <ConfirmModal 
        isOpen={confirmTableId !== null}
        title={`Đã dọn sạch bàn ${confirmTableId}?`}
        message="Bàn sẽ trở lại trạng thái sẵn sàng để đón khách mới."
        confirmText="Hoàn tất"
        onConfirm={() => { 
            if (confirmTableId) store.setTableEmpty(confirmTableId);
            setConfirmTableId(null); 
        }}
        onCancel={() => setConfirmTableId(null)}
      />

      {/* Modal Xác nhận Thu tiền */}
      <ConfirmModal 
        isOpen={confirmPayTableId !== null}
        title={`Xác nhận thanh toán Bàn ${confirmPayTableId}`}
        message="Bạn đã nhận đủ tiền (mặt hoặc chuyển khoản) từ khách?"
        confirmText="Đã nhận tiền"
        type="success"
        onConfirm={() => { 
            if (confirmPayTableId) store.confirmPayment(confirmPayTableId);
            setConfirmPayTableId(null); 
        }}
        onCancel={() => setConfirmPayTableId(null)}
      />

      {showQrModalId && (
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] p-10 max-sm w-full text-center shadow-2xl animate-scaleIn">
                <h3 className="text-2xl font-black text-slate-800 mb-2">QR Bàn {showQrModalId}</h3>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">Dành cho khách gọi món</p>
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-8">
                    <img src={getFullQrUrl(showQrModalId, store.tables.find((t:any)=>t.id === showQrModalId).sessionToken)} alt="QR" className="w-full h-auto rounded-xl" />
                </div>
                <button onClick={() => setShowQrModalId(null)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Đóng</button>
            </div>
        </div>
      )}

      {moveModal && (
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] p-8 max-w-md w-full shadow-2xl animate-scaleIn text-center">
                <h3 className="text-xl font-black text-slate-800 mb-4">{moveModal.type === 'SWAP' ? 'Đổi Bàn' : 'Gộp Bàn'} {moveModal.fromId}</h3>
                <p className="text-slate-500 text-sm mb-6 italic">Chọn bàn đích:</p>
                <div className="grid grid-cols-4 gap-2 mb-8">
                    {store.tables.filter((t: Table) => t.status === TableStatus.AVAILABLE && !t.qrRequested).map((t: Table) => (
                        <button 
                            key={t.id} 
                            onClick={() => { store.requestMoveTable(moveModal.fromId, t.id, moveModal.type, currentUser.id); setMoveModal(null); }}
                            className="w-full aspect-square bg-slate-50 hover:bg-orange-500 hover:text-white rounded-xl font-black transition-all border border-slate-200 shadow-sm"
                        >
                            {t.id}
                        </button>
                    ))}
                </div>
                <button onClick={() => setMoveModal(null)} className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-[10px]">Huỷ</button>
            </div>
        </div>
      )}

      <section className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-lg font-black flex items-center gap-3">🛋️ Bàn của bạn ({myTables.length}/3)</h2>
          <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-3 py-1 rounded-full uppercase italic">{currentUser.fullName}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {store.tables.map((t: Table) => {
                const isMine = t.claimedBy === currentUser.id;
                const isRequested = t.qrRequested;
                
                return (
                    <div key={t.id} className={`p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center justify-center gap-2 relative ${
                        isMine ? 'border-orange-500 bg-orange-50/20' : 
                        t.status === TableStatus.AVAILABLE ? 'border-dashed border-slate-200 opacity-60' : 
                        'border-slate-100 bg-slate-50 opacity-30 grayscale pointer-events-none'
                    }`}>
                        <span className="font-black text-lg">Bàn {t.id}</span>
                        
                        {t.status === TableStatus.AVAILABLE && !isRequested && (
                            <button onClick={() => store.requestTableQr(t.id, currentUser.id)} className="text-[9px] font-black bg-slate-900 text-white px-3 py-2 rounded-xl uppercase flex items-center gap-1 shadow-md">
                                <PlusCircle size={12} /> Mở bàn
                            </button>
                        )}

                        {isRequested && (
                            <div className="flex flex-col items-center gap-1 text-[8px] font-black text-orange-500 uppercase italic">
                                <Loader2 size={12} className="animate-spin" /> Chờ duyệt...
                            </div>
                        )}

                        {isMine && !isRequested && (
                          <div className="flex gap-1.5 mt-1">
                            <button onClick={() => setMoveModal({ fromId: t.id, type: 'SWAP' })} className="p-1.5 bg-blue-500 text-white rounded-lg shadow-sm"><ArrowRightLeft size={14} /></button>
                            {t.sessionToken && <button onClick={() => setShowQrModalId(t.id)} className="p-1.5 bg-slate-900 text-white rounded-lg shadow-sm"><QrCode size={14} /></button>}
                            {t.status === TableStatus.BILLING && <button onClick={() => setConfirmTableId(t.id)} className="p-1.5 bg-green-500 text-white rounded-lg shadow-sm animate-pulse"><Coffee size={14} /></button>}
                          </div>
                        )}
                        
                        {isMine && t.status === TableStatus.PAYING && (
                           <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-md">THU TIỀN</span>
                        )}
                    </div>
                )
            })}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-black mb-6 flex items-center gap-3">💰 Thanh toán & Dọn bàn</h2>
          <div className="space-y-4">
              {/* Danh sách yêu cầu thanh toán */}
              {paymentRequests.map((t: Table) => (
                <div key={t.id} className="flex items-center justify-between p-6 bg-amber-50 border border-amber-200 rounded-[2rem] animate-pulse">
                    <div>
                        <span className="text-[9px] font-black text-amber-700 uppercase">YÊU CẦU THANH TOÁN</span>
                        <h4 className="font-black text-amber-900 text-base">BÀN {t.id}</h4>
                    </div>
                    <button onClick={() => setConfirmPayTableId(t.id)} className="bg-amber-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2">
                      <Banknote size={14}/> Xác nhận đã thu
                    </button>
                </div>
              ))}
              
              {/* Danh sách bàn chờ dọn */}
              {billingTables.map((t: Table) => (
                <div key={t.id} className="flex items-center justify-between p-6 bg-blue-50 border border-blue-200 rounded-[2rem]">
                    <div>
                        <span className="text-[9px] font-black text-blue-700 uppercase">ĐÃ THANH TOÁN</span>
                        <h4 className="font-black text-blue-900 text-base">BÀN {t.id} - CHỜ DỌN</h4>
                    </div>
                    <button onClick={() => setConfirmTableId(t.id)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2">
                      <Coffee size={14}/> Đã dọn xong
                    </button>
                </div>
              ))}
              
              {paymentRequests.length === 0 && billingTables.length === 0 && (
                <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">Chưa có yêu cầu mới</p>
              )}
          </div>
        </section>

        <section className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-8">
          <h2 className="text-lg font-black mb-6 flex items-center gap-3">📝 Duyệt & Bưng món</h2>
          <div className="space-y-4">
              {/* Đơn hàng chờ duyệt */}
              {pendingOrders.map((table: Table) => (
                <div key={table.id} className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-slate-900 text-lg italic">Bàn {table.id}</h3>
                    <button onClick={() => store.confirmBulkOrders(table.id)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase">Duyệt Đơn</button>
                  </div>
                  <div className="space-y-1">
                    {table.currentOrders.filter(o => o.status === OrderItemStatus.PENDING).map(o => (
                        <div key={o.id} className="flex justify-between text-[11px] font-bold text-slate-600">
                            <span>{o.name}</span>
                            <span>x{o.quantity}</span>
                        </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Món sẵn sàng bưng */}
              {readyItems.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-5 bg-green-50 border border-green-200 rounded-[2rem]">
                    <div>
                        <span className="text-[8px] font-black text-green-700 uppercase">MÓN ĐÃ XONG</span>
                        <h4 className="font-black text-green-900 text-sm">BÀN {item.tableId}: {item.name} x{item.quantity}</h4>
                    </div>
                    <button onClick={() => store.updateOrderItemStatus(item.tableId, item.id, OrderItemStatus.SERVED)} className="bg-green-600 text-white px-5 py-2 rounded-xl text-[9px] font-black uppercase shadow-sm">Đã bưng</button>
                </div>
              ))}
              
              {pendingOrders.length === 0 && readyItems.length === 0 && <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">Trống</p>}
          </div>
        </section>
      </div>
    </div>
  );
};

export default StaffView;
