
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CATEGORIES } from '../constants';
import { OrderItem, OrderItemStatus, MenuItem, TableStatus, UserRole, Table } from '../types';
import { ConfirmModal } from '../App';

interface CustomerMenuProps {
  store: any;
  currentRole: UserRole;
}

const CustomerMenu: React.FC<CustomerMenuProps> = ({ store, currentRole }) => {
  const { tableId } = useParams<{ tableId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idNum = parseInt(tableId || '0');
  const table = (store.tables || []).find((t: Table) => t.id === idNum);
  
  const tokenFromUrl = searchParams.get('token');
  
  const [activeTab, setActiveTab] = useState('Tất cả');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [view, setView] = useState<'MENU' | 'CART' | 'HISTORY'>('MENU');
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  
  const prevStatusRef = useRef<TableStatus | undefined>(table?.status);

  // 1. Tự động redirect nếu khách đang ở trang chủ nhưng có bàn 'locked'
  useEffect(() => {
    if (!tableId) {
      const lockedId = localStorage.getItem('locked_table_id');
      if (lockedId) {
        const lockedTable = store.tables.find((t: any) => t.id === parseInt(lockedId));
        if (lockedTable && lockedTable.status !== TableStatus.AVAILABLE) {
          navigate(`/table/${lockedId}`, { replace: true });
        } else {
          localStorage.removeItem('locked_table_id');
        }
      }
    }
  }, [tableId, store.tables, navigate]);

  // 2. KHÓA BÀN: Khi khách đã vào bàn và bắt đầu hoạt động (hoặc bàn đang bị chiếm)
  useEffect(() => {
    if (tableId && table && table.status !== TableStatus.AVAILABLE) {
      localStorage.setItem('locked_table_id', tableId);
    }
  }, [tableId, table?.status]);

  // 3. GIẢI PHÓNG: Chỉ khi bàn về trạng thái Trống (AVAILABLE) mới cho khách thoát
  useEffect(() => {
    if (tableId && table) {
      if (prevStatusRef.current !== TableStatus.AVAILABLE && table.status === TableStatus.AVAILABLE) {
        localStorage.removeItem('locked_table_id'); 
        navigate('/', { replace: true });
      }
      prevStatusRef.current = table.status;
    }
  }, [table?.status, tableId, navigate]);

  // 4. KIỂM TRA TOKEN: Mã QR phải chứa token hợp lệ
  const isTokenValid = tableId && table && table.sessionToken && table.sessionToken === tokenFromUrl;

  const totalCurrentOrder = (table?.currentOrders || []).reduce((sum: number, item: OrderItem) => sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0;
  const allServed = (table?.currentOrders || []).length > 0 && (table?.currentOrders || []).every((item: OrderItem) => item.status === OrderItemStatus.SERVED);

  const getQrUrl = (amount: number) => {
    if (!store.bankConfig || !store.bankConfig.accountNo) return null;
    const { bankId, accountNo, accountName } = store.bankConfig;
    const info = `THANH TOAN BAN ${idNum}`;
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(info)}&accountName=${encodeURIComponent(accountName)}`;
  };

  // TRANG CHỌN BÀN (Dành cho khách vãng lai hoặc sau khi thanh toán xong)
  if (!tableId) {
    return (
        <div className="max-w-md mx-auto py-12 text-center animate-fadeIn px-6">
            <div className="w-32 h-32 bg-orange-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 text-5xl">🍴</div>
            <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight uppercase">Smart Restaurant</h2>
            <p className="text-slate-500 mb-10 text-sm font-medium">Vui lòng quét QR tại bàn để gọi món</p>
            
            <div className="space-y-3 mt-20">
                <div className="grid grid-cols-2 gap-3">
                    <Link to="/staff" className="flex items-center justify-center py-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-[10px] font-black uppercase text-slate-600">Phục vụ</Link>
                    <Link to="/kitchen" className="flex items-center justify-center py-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-[10px] font-black uppercase text-slate-600">Nhà bếp</Link>
                </div>
                <Link to="/admin" className="flex items-center justify-center py-4 bg-slate-900 rounded-2xl shadow-xl text-[10px] font-black uppercase text-white tracking-widest">Admin</Link>
            </div>
        </div>
    );
  }

  // TRƯỜNG HỢP MÃ QR HẾT HẠN HOẶC KHÔNG HỢP LỆ
  if (!isTokenValid) {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center animate-fadeIn">
        <div className="w-32 h-32 rounded-[3rem] bg-red-50 text-red-500 border-2 border-red-100 flex items-center justify-center mx-auto mb-10 shadow-xl text-6xl">🚫</div>
        <h2 className="text-3xl font-black text-slate-800 mb-4 uppercase tracking-tighter">Mã QR hết hạn</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-12">Mã QR này không còn hiệu lực hoặc phiên làm việc đã kết thúc. Vui lòng liên hệ nhân viên để nhận mã QR mới cho bàn {idNum}.</p>
        <Link to="/" className="inline-block px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Quay về Trang chủ</Link>
      </div>
    );
  }

  // TRẠNG THÁI ĐANG THANH TOÁN / CHỜ HÓA ĐƠN
  if (table?.status === TableStatus.PAYING || table?.status === TableStatus.BILLING) {
    return (
      <div className="max-w-md mx-auto py-12 px-6 text-center animate-fadeIn">
        <div className="w-28 h-28 rounded-[2.5rem] bg-amber-50 text-amber-500 border-2 border-amber-100 flex items-center justify-center mx-auto mb-8 shadow-xl animate-pulse text-5xl">⏳</div>
        <h2 className="text-3xl font-black text-slate-800 mb-4">
           {table.status === TableStatus.PAYING ? 'Đang kiểm bill...' : 'Đang in hóa đơn...'}
        </h2>
        <p className="text-slate-400 text-sm mb-10 italic">Hệ thống đã khóa Menu. Quý khách vui lòng chờ nhân viên xác nhận thanh toán để kết thúc.</p>

        {getQrUrl(totalCurrentOrder) && (
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 animate-scaleIn">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quét để chuyển khoản nhanh</p>
                <img src={getQrUrl(totalCurrentOrder)!} alt="QR" className="w-full h-auto rounded-2xl mb-6" />
                <div className="text-sm font-black text-slate-800">{store.bankConfig.accountName}</div>
                <div className="mt-4 text-2xl font-black text-orange-600">{totalCurrentOrder.toLocaleString()}đ</div>
                <p className="mt-4 text-[9px] text-slate-300 uppercase font-bold">Nội dung: THANH TOAN BAN {idNum}</p>
            </div>
        )}
      </div>
    );
  }

  // TRANG THỰC ĐƠN & GỌI MÓN
  const filteredMenu = (store.menu || []).filter((item: MenuItem) => activeTab === 'Tất cả' ? true : item.category === activeTab);
  
  const handleOrder = () => {
    const newOrders: OrderItem[] = Object.entries(cart).map(([itemId, qty]) => {
      const menuItem = (store.menu || []).find((m: MenuItem) => m.id === itemId);
      return { id: `ORDER-${Date.now()}-${itemId}`, menuItemId: itemId, name: menuItem?.name || '', price: menuItem?.price || 0, quantity: qty as number, status: OrderItemStatus.PENDING, timestamp: Date.now() };
    });
    store.placeOrder(idNum, newOrders);
    setCart({});
    setView('HISTORY'); 
  };

  return (
    <div className="max-w-md mx-auto animate-fadeIn pb-32">
      <ConfirmModal isOpen={showPaymentConfirm} title="Thanh toán" message={`Bạn yêu cầu thanh toán tổng cộng ${totalCurrentOrder.toLocaleString()}đ?`} onConfirm={() => store.requestPayment(idNum)} onCancel={() => setShowPaymentConfirm(false)} />

      <div className="bg-white rounded-3xl p-4 mb-6 shadow-sm border border-slate-100 flex justify-between items-center sticky top-20 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center font-black shadow-lg">B{idNum}</div>
          <h2 className="text-slate-800 font-black">Bàn {idNum}</h2>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setView('MENU')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${view === 'MENU' ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>MÓN ĂN</button>
            <button onClick={() => setView('HISTORY')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${view === 'HISTORY' ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>LỊCH SỬ</button>
        </div>
      </div>

      {view === 'MENU' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-4">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveTab(cat)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all uppercase whitespace-nowrap ${activeTab === cat ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>{cat}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 px-2">
            {filteredMenu.map((item: MenuItem) => (
                <div key={item.id} className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 flex gap-4 animate-scaleIn">
                  <img src={item.image} alt={item.name} className="w-24 h-24 rounded-2xl object-cover" />
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div><h3 className="font-black text-slate-800 text-sm mb-1">{item.name}</h3><p className="text-[10px] text-slate-400 line-clamp-2">{item.description}</p></div>
                    <div className="flex justify-between items-center">
                        <span className="font-black text-orange-600 text-sm">{item.price.toLocaleString()}đ</span>
                        <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl">
                            {cart[item.id] > 0 && <button onClick={() => setCart(p => {const n={...p}; if(n[item.id]>1) n[item.id]--; else delete n[item.id]; return n;})} className="w-7 h-7 bg-white rounded-lg shadow-sm font-black">-</button>}
                            {cart[item.id] > 0 && <span className="text-xs font-black">{cart[item.id]}</span>}
                            <button onClick={() => setCart(p => ({...p, [item.id]: (p[item.id]||0)+1}))} className="w-7 h-7 bg-orange-500 text-white rounded-lg shadow-lg font-black">+</button>
                        </div>
                    </div>
                  </div>
                </div>
            ))}
          </div>
          {Object.keys(cart).length > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl flex items-center justify-between animate-slideUp z-30">
                <div>
                    <p className="text-white/40 text-[9px] font-black uppercase mb-1">Tạm tính</p>
                    <p className="text-xl font-black text-white">{Object.entries(cart).reduce((s, [id, q]) => s + ((store.menu || []).find((m:any) => m.id === id)?.price || 0) * (q as number), 0).toLocaleString()}đ</p>
                </div>
                <button onClick={() => setView('CART')} className="bg-orange-500 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-xl shadow-orange-500/20">Xác nhận đơn</button>
            </div>
          )}
        </>
      )}

      {view === 'CART' && (
        <div className="animate-fadeIn px-4">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 mb-6">
            <h3 className="font-black text-slate-800 text-xl mb-6">Xác nhận gọi món</h3>
            <div className="space-y-6">
                {Object.entries(cart).map(([itemId, qty]) => {
                const item = (store.menu || []).find((m: any) => m.id === itemId);
                return (
                    <div key={itemId} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img src={item?.image} className="w-12 h-12 rounded-xl object-cover" />
                            <div><h4 className="font-black text-slate-800 text-xs">{item?.name}</h4><p className="text-[10px] text-orange-600 font-bold">{item?.price.toLocaleString()}đ</p></div>
                        </div>
                        <span className="font-black text-sm">x{qty}</span>
                    </div>
                )
                })}
            </div>
          </div>
          <button onClick={handleOrder} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase shadow-xl hover:bg-black transition-all">Gửi yêu cầu ngay</button>
          <button onClick={() => setView('MENU')} className="w-full mt-4 text-slate-400 font-black text-[10px] uppercase">Quay lại chọn thêm</button>
        </div>
      )}

      {view === 'HISTORY' && (
        <div className="animate-fadeIn px-4">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 mb-6">
            <h3 className="font-black text-slate-800 text-xl mb-6">Món đang yêu cầu</h3>
            <div className="space-y-4">
                {(!table?.currentOrders || table.currentOrders.length === 0) ? (
                    <div className="text-center py-20 text-slate-300 font-bold text-xs uppercase italic tracking-widest">Bàn chưa gọi món</div>
                ) : (
                    table.currentOrders.map((item: OrderItem) => (
                        <div key={item.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100">
                            <div>
                                <h4 className="font-black text-slate-800 text-xs">{item.name} <span className="text-orange-500 ml-1">x{item.quantity}</span></h4>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full mt-2 inline-block uppercase ${
                                   item.status === OrderItemStatus.SERVED ? 'bg-green-100 text-green-600' : 
                                   item.status === OrderItemStatus.PENDING ? 'bg-slate-200 text-slate-500' : 'bg-blue-100 text-blue-600'
                                }`}>
                                   {item.status === OrderItemStatus.PENDING ? 'Chờ xác nhận' : item.status}
                                </span>
                            </div>
                            <span className="font-black text-slate-800 text-xs">{(item.price * item.quantity).toLocaleString()}đ</span>
                        </div>
                    ))
                )}
            </div>
          </div>
          {totalCurrentOrder > 0 && (
            <div className="bg-slate-900 rounded-[3rem] p-8 text-white text-center shadow-2xl">
                <p className="text-white/40 text-[10px] mb-2 font-black uppercase tracking-widest">Tổng hóa đơn</p>
                <h3 className="text-4xl font-black mb-10">{totalCurrentOrder.toLocaleString()}đ</h3>
                <button 
                   disabled={!allServed} 
                   onClick={() => setShowPaymentConfirm(true)} 
                   className={`w-full py-6 rounded-3xl font-black uppercase transition-all shadow-xl ${
                      allServed ? 'bg-orange-500 text-white active:scale-95' : 'bg-white/10 text-white/30 cursor-not-allowed'
                   }`}
                >
                    {allServed ? 'Yêu cầu thanh toán' : 'Chờ bưng hết món'}
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
