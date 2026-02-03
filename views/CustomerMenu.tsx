
import React, { memo, useState, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useParams, Link, useNavigate, useSearchParams, useLocation } = ReactRouterDOM;

import { CATEGORIES } from '../constants';
import { OrderItem, OrderItemStatus, MenuItem, TableStatus, UserRole, Table, OrderType, Review } from '../types';
import { ConfirmModal } from '../App';
import { ShoppingCart, History, ChefHat, Loader2, CreditCard, Bell, X, Trash2, Send, ChevronRight } from 'lucide-react';

const MenuCard = memo(({ item, quantity, onAdd, onRemove }: { item: MenuItem, quantity: number, onAdd: () => void, onRemove: () => void }) => {
    const isOut = !item.isAvailable;
    return (
        <div className={`bg-white rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-4 shadow-sm border border-slate-100 flex gap-3 md:gap-4 animate-fadeIn h-fit relative transition-all active:scale-[0.98] ${isOut ? 'opacity-60 grayscale' : ''}`}>
          {isOut && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 rounded-[1.5rem]"><span className="bg-red-500 text-white px-2 py-1 rounded-full text-[8px] font-black uppercase shadow-lg">Hết</span></div>}
          <img src={item.image} alt={item.name} className="w-16 h-16 md:w-24 md:h-24 rounded-xl md:rounded-2xl object-cover shrink-0 shadow-sm" loading="lazy" />
          <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
            <div>
                <h3 className="font-black text-slate-800 text-[11px] md:text-sm mb-0.5 truncate uppercase">{item.name}</h3>
                <p className="text-[8px] md:text-[10px] text-slate-400 line-clamp-1 md:line-clamp-2 leading-tight">{item.description}</p>
            </div>
            <div className="flex justify-between items-center mt-1.5 md:mt-2">
                <span className="font-black text-orange-600 text-[11px] md:text-sm italic">{item.price.toLocaleString()}đ</span>
                <div className="flex items-center gap-2 md:gap-3 bg-slate-50 p-0.5 md:p-1 rounded-lg md:rounded-xl border border-slate-100">
                    {quantity > 0 && (
                        <button onClick={onRemove} className="w-6 h-6 md:w-7 md:h-7 bg-white rounded-md md:rounded-lg shadow-sm font-black text-xs active:scale-90">-</button>
                    )}
                    {quantity > 0 && <span className="text-[10px] md:text-xs font-black w-3 text-center text-slate-800">{quantity}</span>}
                    <button disabled={isOut} onClick={onAdd} className={`w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg shadow-md font-black text-xs active:scale-90 ${isOut ? 'bg-slate-300' : 'bg-orange-500 text-white'}`}>+</button>
                </div>
            </div>
          </div>
        </div>
    );
});

interface CustomerMenuProps {
  store: any;
  currentRole: UserRole;
}

const CustomerMenu: React.FC<CustomerMenuProps> = ({ store, currentRole }) => {
  const { tableId, token: tokenFromPath } = useParams<{ tableId: string; token?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const idNum = parseInt(tableId || '0');
  
  const isPublicView = location.pathname === '/' || location.pathname === '/view-menu';
  const table = useMemo(() => (store.tables || []).find((t: Table) => t.id === idNum), [store.tables, idNum]);
  const tokenFromUrl = tokenFromPath || searchParams.get('token');
  
  const [activeTab, setActiveTab] = useState('Tất cả');
  const [cart, setCart] = useState<Record<string, { qty: number, note: string }>>({});
  const [view, setView] = useState<'MENU' | 'CART' | 'HISTORY'>('MENU');
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{id: string, name: string} | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);

  // Fix: Explicitly cast Object.entries(cart) to avoid "unknown" type error in reduce
  const cartTotal = useMemo(() => (Object.entries(cart) as [string, { qty: number, note: string }][]).reduce((sum, [id, data]) => {
      const item = (store.menu || []).find((m: MenuItem) => m.id === id);
      return sum + (item?.price || 0) * data.qty;
  }, 0), [cart, store.menu]);

  const handleAddToCart = useCallback((id: string) => {
    const item = store.menu.find((m: MenuItem) => m.id === id);
    if (!item?.isAvailable) return;
    setCart(prev => ({ ...prev, [id]: { qty: (prev[id]?.qty || 0) + 1, note: prev[id]?.note || '' } }));
  }, [store.menu]);

  // Fix: Add explicit type casting for indexed access to cart state to avoid "unknown" property errors
  const handleRemoveFromCart = useCallback((id: string) => {
    setCart(prev => {
      const existing = prev[id] as { qty: number, note: string } | undefined;
      if (!existing) return prev;
      const newCart = { ...prev };
      if (existing.qty > 1) newCart[id] = { ...existing, qty: existing.qty - 1 };
      else delete newCart[id];
      return newCart;
    });
  }, []);

  const handlePlaceOrder = async () => {
    if (Object.keys(cart).length === 0 || isOrdering) return;
    setIsOrdering(true);
    try {
        const newOrders: OrderItem[] = (Object.entries(cart) as [string, { qty: number, note: string }][]).map(([itemId, data]) => {
          const menuItem = (store.menu || []).find((m: MenuItem) => m.id === itemId);
          return { 
            id: `O-${Date.now()}-${itemId}`, menuItemId: itemId, name: menuItem?.name || '', 
            price: menuItem?.price || 0, quantity: data.qty, status: OrderItemStatus.PENDING, 
            timestamp: Date.now(), note: data.note
          };
        });
        await store.placeOrder(idNum, newOrders, idNum === 0 ? OrderType.TAKEAWAY : OrderType.DINE_IN);
        setCart({}); setView('HISTORY'); 
    } catch (e) { alert("Lỗi gửi đơn!"); } finally { setIsOrdering(false); }
  };

  const activeOrders = useMemo(() => (table?.currentOrders || []).filter((i: OrderItem) => i.status !== OrderItemStatus.CANCELLED), [table?.currentOrders]);
  const totalAmount = useMemo(() => activeOrders.reduce((sum, item) => sum + (item.price * item.quantity), 0), [activeOrders]);
  const allServed = useMemo(() => activeOrders.length > 0 && activeOrders.every((item: OrderItem) => item.status === OrderItemStatus.SERVED), [activeOrders]);

  if (isPublicView) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn max-w-2xl mx-auto w-full pb-20">
        <div className="w-20 h-20 bg-orange-500 text-white rounded-[2rem] flex items-center justify-center mb-8 text-3xl font-black italic shadow-2xl">S</div>
        <h1 className="text-2xl font-black text-slate-800 uppercase italic mb-4">Smart Resto</h1>
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 w-full">
           <h2 className="text-lg font-black text-slate-800 uppercase italic mb-4">Chào mừng!</h2>
           <p className="text-slate-500 text-xs mb-6">Vui lòng quét mã QR tại bàn để bắt đầu.</p>
           <Link to="/login" className="block bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-2xl">Nhân viên</Link>
        </div>
      </div>
    );
  }

  const isTokenValid = tableId && table && table.sessionToken && table.sessionToken === tokenFromUrl;
  if (!tableId || !isTokenValid) return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mb-8 text-4xl">⚠️</div>
        <h2 className="text-lg font-black text-slate-800 mb-6 uppercase italic">Hết phiên làm việc</h2>
        <p className="text-slate-400 text-[10px] uppercase font-black mb-10">Vui lòng liên hệ nhân viên để nhận mã QR mới</p>
        <Link to="/" className="px-10 py-4 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-2xl italic">Quay lại</Link>
    </div>
  );

  return (
    <div className="flex flex-col h-full max-w-md mx-auto w-full relative">
      <ConfirmModal isOpen={showPaymentConfirm} title="Yêu cầu thanh toán?" message={`Xác nhận gửi yêu cầu tính tiền cho bàn ${idNum}?`} onConfirm={() => store.requestPayment(idNum)} onCancel={() => setShowPaymentConfirm(false)} />
      <ConfirmModal isOpen={cancelTarget !== null} type="danger" title="Huỷ món này?" message={`Xác nhận huỷ "${cancelTarget?.name}"? Hệ thống sẽ báo cho Bếp dừng làm món.`} onConfirm={() => { if (cancelTarget) store.cancelOrderItem(idNum, cancelTarget.id); setCancelTarget(null); }} onCancel={() => setCancelTarget(null)} />

      <div className="bg-white rounded-[1.5rem] p-2.5 mb-3 shadow-sm border border-slate-100 flex justify-between items-center shrink-0 mt-1">
        <div className="flex items-center gap-2.5 ml-1">
          <div className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center font-black text-sm italic shadow-md">B{idNum}</div>
          <div>
            <h2 className="text-slate-800 font-black text-[10px] uppercase leading-none">Bàn số {idNum}</h2>
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Đang phục vụ</span>
          </div>
        </div>
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setView('MENU')} className={`p-2.5 rounded-lg transition-all ${view === 'MENU' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400'}`}><ShoppingCart size={16}/></button>
            <button onClick={() => setView('CART')} className={`p-2.5 rounded-lg transition-all relative ${view === 'CART' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400'}`}>
                <Send size={16}/>
                {Object.keys(cart).length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black border border-white">!</span>}
            </button>
            <button onClick={() => setView('HISTORY')} className={`p-2.5 rounded-lg transition-all ${view === 'HISTORY' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400'}`}><History size={16}/></button>
            <button onClick={() => store.callStaff(idNum)} className="p-2.5 rounded-lg bg-orange-50 text-orange-600 active:scale-90 transition-all"><Bell size={16}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 px-0.5">
        {view === 'MENU' && (
            <>
                <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 pt-1">
                    {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setActiveTab(cat)} className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all uppercase whitespace-nowrap shadow-sm ${activeTab === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>{cat}</button>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {store.menu.filter((m: MenuItem) => activeTab === 'Tất cả' ? true : m.category === activeTab).map((item: MenuItem) => (
                        <MenuCard key={item.id} item={item} quantity={cart[item.id]?.qty || 0} onAdd={() => handleAddToCart(item.id)} onRemove={() => handleRemoveFromCart(item.id)} />
                    ))}
                </div>
            </>
        )}

        {view === 'CART' && (
            <div className="animate-fadeIn space-y-4 px-1">
                <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100 min-h-[300px] flex flex-col">
                    <h3 className="font-black text-slate-800 text-lg mb-6 flex items-center gap-2 italic uppercase"><ShoppingCart size={18} className="text-orange-500"/> Giỏ hàng của bạn</h3>
                    <div className="flex-1 space-y-3">
                        {Object.keys(cart).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                                <ShoppingCart size={48} className="opacity-20 mb-4"/>
                                <p className="font-black uppercase text-[10px] italic">Chưa có món nào được chọn</p>
                            </div>
                        ) : (
                            // Fix: Explicitly cast Object.entries(cart) to avoid "unknown" type error in map
                            (Object.entries(cart) as [string, { qty: number, note: string }][]).map(([id, data]) => {
                                const item = store.menu.find((m: MenuItem) => m.id === id);
                                return (
                                    <div key={id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <img src={item?.image} className="w-10 h-10 rounded-lg object-cover shadow-sm"/>
                                            <div className="truncate">
                                                <p className="text-[10px] font-black uppercase text-slate-800 truncate">{item?.name}</p>
                                                <p className="text-[9px] font-bold text-orange-600">{item?.price.toLocaleString()}đ x{data.qty}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleRemoveFromCart(id)} className="p-2 text-red-500 bg-white rounded-xl shadow-sm"><Trash2 size={14}/></button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    {cartTotal > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-6 px-2">
                                <span className="text-[10px] font-black uppercase text-slate-400 italic">Tổng đơn hàng:</span>
                                <span className="text-xl font-black text-slate-900 italic">{cartTotal.toLocaleString()}đ</span>
                            </div>
                            <button onClick={handlePlaceOrder} disabled={isOrdering} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-2xl italic active:scale-95 transition-all flex items-center justify-center gap-2">
                                {isOrdering ? <Loader2 size={16} className="animate-spin"/> : <><Send size={16}/> Gửi đơn ngay</>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {view === 'HISTORY' && (
            <div className="animate-fadeIn space-y-4 px-1">
                <div className="bg-white rounded-[2rem] p-6 shadow-2xl border border-slate-100 min-h-[300px]">
                    <h3 className="font-black text-slate-800 text-lg mb-6 flex items-center gap-2 italic uppercase"><ChefHat size={18} className="text-orange-500"/> Món đã gọi</h3>
                    <div className="space-y-3">
                        {table?.currentOrders.length === 0 && <p className="text-center py-12 text-slate-300 font-black uppercase text-[10px] italic">Bạn chưa gọi món nào</p>}
                        {table?.currentOrders.map((item: OrderItem) => (
                            <div key={item.id} className={`p-4 rounded-xl border-2 flex items-center justify-between ${item.status === OrderItemStatus.CANCELLED ? 'bg-slate-50 border-slate-100 opacity-40' : 'bg-white border-slate-50'}`}>
                                <div className="min-w-0 pr-4">
                                    <h4 className="font-black text-slate-800 text-[10px] uppercase truncate italic">{item.name} <span className="text-orange-500 ml-1">x{item.quantity}</span></h4>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <div className={`w-1.5 h-1.5 rounded-full ${item.status === OrderItemStatus.SERVED ? 'bg-green-500' : item.status === OrderItemStatus.CANCELLED ? 'bg-red-300' : 'bg-orange-400 animate-pulse'}`}></div>
                                      <span className="text-[8px] font-black uppercase italic text-slate-500">{item.status}</span>
                                   </div>
                                </div>
                                <div className="flex items-center gap-3">
                                   <span className="font-black text-slate-900 text-[10px]">{(item.price * item.quantity).toLocaleString()}đ</span>
                                   {(item.status === OrderItemStatus.PENDING || item.status === OrderItemStatus.CONFIRMED) && (
                                     <button onClick={() => setCancelTarget({ id: item.id, name: item.name })} className="p-1.5 bg-red-50 text-red-500 rounded-lg shadow-sm active:scale-90"><Trash2 size={14}/></button>
                                   )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {totalAmount > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <div className="bg-slate-900 rounded-2xl p-6 text-white text-center shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-20 h-20 bg-white/5 rounded-br-[3rem] -z-0"></div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 block relative z-10">Tạm tính:</span>
                                <h3 className="text-2xl font-black mb-6 italic relative z-10">{totalAmount.toLocaleString()}đ</h3>
                                <button disabled={!allServed} onClick={() => setShowPaymentConfirm(true)} className={`w-full py-5 rounded-xl font-black uppercase text-[10px] shadow-xl italic transition-all active:scale-95 relative z-10 flex items-center justify-center gap-2 ${allServed ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-600 cursor-not-allowed'}`}>
                                    {allServed ? <><CreditCard size={14}/> Yêu cầu thanh toán</> : <><Loader2 size={14} className="animate-spin"/> Chờ bưng món...</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      <button onClick={() => setView(v => v === 'CART' ? 'MENU' : 'CART')} className={`fixed bottom-6 right-4 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-[60] border-4 border-white transition-all active:scale-90 ${Object.keys(cart).length > 0 ? 'bg-orange-500 text-white animate-bounce' : 'bg-slate-900 text-white'}`}>
        <ShoppingCart size={24} />
        {Object.keys(cart).length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{(Object.values(cart) as { qty: number }[]).reduce((s, d) => s + d.qty, 0)}</span>
        )}
      </button>
    </div>
  );
};

export default CustomerMenu;
