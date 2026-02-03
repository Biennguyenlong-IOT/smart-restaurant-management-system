
import React, { memo, useState, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useParams, Link, useNavigate, useSearchParams, useLocation } = ReactRouterDOM;

import { CATEGORIES } from '../constants';
import { OrderItem, OrderItemStatus, MenuItem, TableStatus, UserRole, Table, OrderType, Review } from '../types';
import { ConfirmModal } from '../App';
import { ShoppingCart, History, ChefHat, Loader2, FileText, CreditCard, Star, AlertTriangle, PlusCircle, Bell, MessageCircle } from 'lucide-react';

const MenuCard = memo(({ item, quantity, onAdd, onRemove }: { item: MenuItem, quantity: number, onAdd: () => void, onRemove: () => void }) => {
    const isOut = !item.isAvailable;
    return (
        <div className={`bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 flex gap-4 animate-fadeIn h-fit relative transition-all active:scale-[0.98] ${isOut ? 'opacity-60 grayscale' : ''}`}>
          {isOut && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 rounded-[2rem]"><span className="bg-red-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-lg">Hết món</span></div>}
          <img src={item.image} alt={item.name} className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shrink-0 shadow-sm" loading="lazy" />
          <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
            <div>
                <h3 className="font-black text-slate-800 text-sm mb-0.5 truncate">{item.name}</h3>
                <p className="text-[9px] md:text-[10px] text-slate-400 line-clamp-2 leading-tight">{item.description}</p>
            </div>
            <div className="flex justify-between items-center mt-2">
                <span className="font-black text-orange-600 text-sm italic">{item.price.toLocaleString()}đ</span>
                <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-100">
                    {quantity > 0 && (
                        <button onClick={onRemove} className="w-7 h-7 bg-white rounded-lg shadow-sm font-black active:scale-90 transition-transform">-</button>
                    )}
                    {quantity > 0 && <span className="text-xs font-black w-4 text-center text-slate-800">{quantity}</span>}
                    <button disabled={isOut} onClick={onAdd} className={`w-7 h-7 rounded-lg shadow-lg font-black active:scale-90 transition-transform ${isOut ? 'bg-slate-300' : 'bg-orange-500 text-white'}`}>+</button>
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
  const navigate = useNavigate();
  const idNum = parseInt(tableId || '0');
  
  const isPublicView = location.pathname === '/' || location.pathname === '/view-menu';
  const table = useMemo(() => (store.tables || []).find((t: Table) => t.id === idNum), [store.tables, idNum]);
  const tokenFromUrl = tokenFromPath || searchParams.get('token');
  
  const [activeTab, setActiveTab] = useState('Tất cả');
  const [cart, setCart] = useState<Record<string, { qty: number, note: string }>>({});
  const [orderType, setOrderType] = useState<OrderType>(OrderType.DINE_IN);
  const [view, setView] = useState<'MENU' | 'CART' | 'HISTORY'>('MENU');
  
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{id: string, name: string} | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);

  const [reviewForm, setReviewForm] = useState({ ratingFood: 5, ratingService: 5, comment: '' });

  const cartTotal = useMemo(() => (Object.entries(cart) as [string, { qty: number }][]).reduce((sum, [id, data]) => {
      const item = (store.menu || []).find((m: MenuItem) => m.id === id);
      return sum + (item?.price || 0) * data.qty;
  }, 0), [cart, store.menu]);

  const hasUnavailableItems = useMemo(() => {
    return Object.keys(cart).some(itemId => {
      const item = store.menu.find((m: MenuItem) => m.id === itemId);
      return !item || !item.isAvailable;
    });
  }, [cart, store.menu]);

  const handleAddToCart = useCallback((id: string) => {
    const item = store.menu.find((m: MenuItem) => m.id === id);
    if (!item?.isAvailable) return;
    setCart(prev => ({ ...prev, [id]: { qty: (prev[id]?.qty || 0) + 1, note: prev[id]?.note || '' } }));
  }, [store.menu]);

  const handleRemoveFromCart = useCallback((id: string) => {
    setCart(prev => {
      if (!prev[id]) return prev;
      const newCart = { ...prev };
      if (newCart[id].qty > 1) {
        newCart[id] = { ...newCart[id], qty: newCart[id].qty - 1 };
      } else {
        delete newCart[id];
      }
      return newCart;
    });
  }, []);

  const updateCartNote = (id: string, note: string) => {
    setCart(prev => ({
        ...prev,
        [id]: { ...prev[id], note }
    }));
  };

  const activeOrders = useMemo(() => (table?.currentOrders || []).filter((i: OrderItem) => i.status !== OrderItemStatus.CANCELLED), [table?.currentOrders]);
  const totalCurrentOrder = useMemo((): number => activeOrders.reduce((sum: number, item: OrderItem) => sum + (item.price * item.quantity), 0), [activeOrders]);
  const allServed = useMemo(() => activeOrders.length > 0 && activeOrders.every((item: OrderItem) => item.status === OrderItemStatus.SERVED || item.status === OrderItemStatus.CANCELLED), [activeOrders]);

  const handlePlaceOrder = async () => {
    if (Object.keys(cart).length === 0 || isOrdering || hasUnavailableItems) {
      if (hasUnavailableItems) alert("Có món đã hết trong giỏ hàng! Vui lòng xoá món đó.");
      return;
    }
    setIsOrdering(true);
    try {
        const newOrders: OrderItem[] = (Object.entries(cart) as [string, { qty: number, note: string }][]).map(([itemId, data]) => {
          const menuItem = (store.menu || []).find((m: MenuItem) => m.id === itemId);
          return { 
            id: `O-${Date.now()}-${itemId}`, menuItemId: itemId, 
            name: menuItem?.name || '', price: menuItem?.price || 0, 
            quantity: data.qty, status: OrderItemStatus.PENDING, 
            timestamp: Date.now(), note: data.note
          };
        });
        await store.placeOrder(idNum, newOrders, orderType);
        setCart({}); setView('HISTORY'); 
    } catch (e) { alert("Lỗi gửi đơn!"); } finally { setIsOrdering(false); }
  };

  const handleCallStaff = async () => {
    try {
        await store.callStaff(idNum);
        alert("Đã gọi nhân viên. Vui lòng chờ trong giây lát!");
    } catch (e) {
        alert("Không thể gọi nhân viên lúc này.");
    }
  };

  const submitReview = () => {
    const review: Review = {
      id: `R-${Date.now()}`,
      tableId: idNum,
      staffId: table?.claimedBy || 'direct_customer',
      ratingFood: reviewForm.ratingFood,
      ratingService: reviewForm.ratingService,
      comment: reviewForm.comment,
      timestamp: Date.now()
    };
    store.submitReview(review);
    alert("Cảm ơn ý kiến của bạn! Chúc bạn một ngày tốt lành.");
    navigate('/', { replace: true });
  };

  if (isPublicView) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn max-w-2xl mx-auto w-full pb-20">
        <div className="w-24 h-24 bg-orange-500 text-white rounded-[2.5rem] flex items-center justify-center mb-8 text-4xl font-black italic shadow-2xl animate-bounce">S</div>
        <h1 className="text-4xl font-black text-slate-800 uppercase italic mb-4 tracking-tighter">Smart Resto</h1>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mb-12">Hệ thống quản lý nhà hàng thông minh</p>
        
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 w-full mb-10">
           <h2 className="text-xl font-black text-slate-800 uppercase italic mb-4">Xin chào!</h2>
           <p className="text-slate-500 text-sm leading-relaxed mb-6">Vui lòng liên hệ nhân viên phục vụ để được hỗ trợ mở bàn và nhận thực đơn.</p>
           <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center gap-4 text-left">
              <Bell className="text-orange-500 shrink-0" size={24} />
              <div>
                 <p className="font-black text-slate-800 text-xs uppercase">Hỗ trợ khách hàng</p>
                 <p className="text-slate-400 text-[10px] font-bold uppercase italic">Nhân viên sẽ có mặt ngay khi bạn cần</p>
              </div>
           </div>
        </div>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
           <Link to="/login" className="bg-slate-900 text-white px-8 py-5 rounded-2xl font-black text-[10px] uppercase shadow-2xl flex items-center justify-center gap-2 active:scale-95 transition-all">
             Đăng nhập Hệ thống
           </Link>
        </div>
      </div>
    );
  }

  if (table?.status === TableStatus.REVIEWING) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn max-w-md mx-auto">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 w-full">
           <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8"><Star size={40} fill="currentColor" /></div>
           <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-2">Đánh giá trải nghiệm</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase italic mb-8">Ý kiến của bạn là động lực để chúng tôi phát triển</p>
           
           <div className="space-y-8 mb-10 text-center">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase mb-4">Chất lượng phục vụ</p>
                <div className="flex justify-center gap-3">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setReviewForm({...reviewForm, ratingService: s})} className={`transition-all active:scale-90 ${reviewForm.ratingService >= s ? 'text-orange-500 scale-110' : 'text-slate-200'}`}><Star size={32} fill={reviewForm.ratingService >= s ? 'currentColor' : 'none'}/></button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase mb-4">Chất lượng món ăn</p>
                <div className="flex justify-center gap-3">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setReviewForm({...reviewForm, ratingFood: s})} className={`transition-all active:scale-90 ${reviewForm.ratingFood >= s ? 'text-orange-500 scale-110' : 'text-slate-200'}`}><Star size={32} fill={reviewForm.ratingFood >= s ? 'currentColor' : 'none'}/></button>
                  ))}
                </div>
              </div>
              <textarea value={reviewForm.comment} onChange={e => setReviewForm({...reviewForm, comment: e.target.value})} placeholder="Bạn có góp ý gì thêm không?..." className="w-full p-5 bg-slate-50 rounded-2xl text-xs font-bold border border-slate-100 h-24 outline-none" />
           </div>
           <button onClick={submitReview} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Gửi đánh giá & Hoàn tất</button>
        </div>
      </div>
    );
  }

  const isTokenValid = tableId && table && table.sessionToken && table.sessionToken === tokenFromUrl;
  if (!tableId || !isTokenValid) return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn">
        <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mb-8 text-5xl shadow-lg">⚠️</div>
        <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase italic">Hết phiên làm việc</h2>
        <p className="text-slate-400 text-sm mb-8 max-w-xs">Vui lòng quét lại mã QR tại bàn để tiếp tục sử dụng dịch vụ.</p>
        <Link to="/" className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase shadow-2xl">Quay lại trang chủ</Link>
    </div>
  );

  if (table?.status === TableStatus.PAYING || table?.status === TableStatus.BILLING) {
    const qrUrl = `https://img.vietqr.io/image/${store.bankConfig.bankId}-${store.bankConfig.accountNo}-compact.png?amount=${totalCurrentOrder}&addInfo=Thanh+Toan+Ban+${idNum}&accountName=${encodeURIComponent(store.bankConfig.accountName)}`;
    return (
      <div className="flex flex-col h-full animate-fadeIn max-w-md mx-auto w-full pb-10">
        <div className="flex-1 overflow-y-auto no-scrollbar pt-6 px-4">
           <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><FileText size={32} /></div>
              <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-2">Hóa đơn bàn {idNum}</h2>
              <div className="space-y-3 mb-10 text-left border-y border-slate-50 py-8 mt-6">
                {activeOrders.map(o => (
                  <div key={o.id} className={`flex justify-between items-center text-xs ${o.status === OrderItemStatus.CANCELLED ? 'opacity-30 line-through' : ''}`}>
                    <span className="font-bold text-slate-600">{o.name} x{o.quantity}</span>
                    <span className="font-black text-slate-800">{(o.price * o.quantity).toLocaleString()}đ</span>
                  </div>
                ))}
                <div className="pt-6 border-t border-slate-100 flex justify-between items-center font-black mt-4">
                   <span className="text-sm text-slate-900 uppercase italic tracking-tighter">Tổng tiền:</span>
                   <span className="text-2xl text-orange-600 italic">{totalCurrentOrder.toLocaleString()}đ</span>
                </div>
              </div>
              {store.bankConfig.accountNo && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-blue-500 uppercase flex items-center justify-center gap-2 tracking-widest bg-blue-50 py-2 rounded-xl"><CreditCard size={14}/> Thanh toán chuyển khoản</p>
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <img src={qrUrl} alt="VietQR" className="w-56 h-56 mx-auto rounded-3xl shadow-lg border-4 border-white" />
                  </div>
                </div>
              )}
           </div>
           
           <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl text-center flex flex-col items-center gap-3">
             <div className="flex items-center justify-center gap-3">
                <Loader2 size={20} className="animate-spin text-orange-500"/>
                <span className="font-black italic uppercase text-sm tracking-tight">
                  {table.status === TableStatus.PAYING ? 'Chờ phục vụ xác nhận thu tiền...' : 'Đang xử lý hóa đơn...'}
                </span>
             </div>
           </div>
           
           {table.status === TableStatus.BILLING && (
              <button onClick={() => store.completeBilling(idNum)} className="w-full mt-6 py-5 bg-orange-500 text-white rounded-2xl font-black uppercase text-xs shadow-xl animate-bounce">Tôi đã thanh toán xong!</button>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-md mx-auto w-full relative">
      <ConfirmModal isOpen={showPaymentConfirm} title="Yêu cầu thanh toán?" message={`Xác nhận yêu cầu tính tiền cho bàn ${idNum}?`} onConfirm={() => store.requestPayment(idNum)} onCancel={() => setShowPaymentConfirm(false)} />
      <ConfirmModal isOpen={cancelTarget !== null} type="danger" title="Xác nhận huỷ món" message={`Bạn muốn huỷ món "${cancelTarget?.name}"?`} onConfirm={() => { if (cancelTarget) store.cancelOrderItem(idNum, cancelTarget.id); setCancelTarget(null); }} onCancel={() => setCancelTarget(null)} />

      <div className="bg-white rounded-[1.8rem] p-3 mb-4 shadow-sm border border-slate-100 flex justify-between items-center shrink-0 mt-2">
        <div className="flex items-center gap-2.5 ml-1">
          <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center font-black text-lg italic shadow-md">B{idNum}</div>
          <div>
            <h2 className="text-slate-800 font-black text-xs uppercase leading-none">Bàn số {idNum}</h2>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Đang sử dụng</span>
          </div>
        </div>
        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.2rem]">
            <button onClick={() => setView('MENU')} className={`p-3 rounded-xl transition-all shadow-sm ${view === 'MENU' ? 'bg-white text-orange-500' : 'text-slate-400'}`}><ShoppingCart size={18}/></button>
            <button onClick={() => setView('HISTORY')} className={`p-3 rounded-xl transition-all shadow-sm ${view === 'HISTORY' ? 'bg-white text-orange-500' : 'text-slate-400'}`}><History size={18}/></button>
            <button onClick={handleCallStaff} className="p-3 rounded-xl bg-orange-50 text-orange-600 shadow-sm active:scale-90 transition-all" title="Gọi nhân viên"><Bell size={18}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 px-1">
        {view === 'MENU' && (
            <>
                <div className="flex gap-1.5 overflow-x-auto pb-4 no-scrollbar sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 pt-1">
                    {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setActiveTab(cat)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all uppercase whitespace-nowrap shadow-sm ${activeTab === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>{cat}</button>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {store.menu.filter((m: MenuItem) => activeTab === 'Tất cả' ? true : m.category === activeTab).map((item: MenuItem) => (
                        <MenuCard key={item.id} item={item} quantity={cart[item.id]?.qty || 0} onAdd={() => handleAddToCart(item.id)} onRemove={() => handleRemoveFromCart(item.id)} />
                    ))}
                </div>
            </>
        )}

        {view === 'CART' && (
            <div className="animate-fadeIn space-y-4 pb-20 px-2">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100">
                    <h3 className="font-black text-slate-800 text-xl italic uppercase mb-8 flex items-center gap-3"><ShoppingCart size={22} className="text-orange-500"/> Giỏ hàng</h3>
                    
                    <div className="space-y-6">
                        {Object.keys(cart).length === 0 ? (
                          <div className="py-20 text-center">
                            <p className="text-slate-300 font-black uppercase text-[10px] italic">Giỏ hàng đang trống</p>
                          </div>
                        ) : 
                            (Object.entries(cart) as [string, { qty: number, note: string }][]).map(([itemId, data]) => {
                                const item = store.menu.find((m: MenuItem) => m.id === itemId);
                                return (
                                    <div key={itemId} className="space-y-4 border-b border-slate-50 pb-6 last:border-0">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <img src={item?.image} className="w-14 h-14 rounded-2xl object-cover" />
                                                <div className="min-w-0">
                                                    <h4 className="font-black text-slate-800 text-sm truncate uppercase">{item?.name}</h4>
                                                    <p className="text-[10px] font-bold text-orange-600 italic">{item?.price.toLocaleString()}đ</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                                <button onClick={() => handleRemoveFromCart(itemId)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-black text-sm">-</button>
                                                <span className="font-black text-sm w-5 text-center text-slate-800">{data.qty}</span>
                                                <button onClick={() => handleAddToCart(itemId)} className="w-8 h-8 rounded-lg font-black text-sm shadow-md bg-orange-500 text-white">+</button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                                            <MessageCircle size={14} className="text-slate-300" />
                                            <input 
                                                type="text" 
                                                placeholder="Ghi chú (vị, ít cay...)" 
                                                value={data.note} 
                                                onChange={(e) => updateCartNote(itemId, e.target.value)}
                                                className="bg-transparent text-[10px] font-bold w-full outline-none" 
                                            />
                                        </div>
                                    </div>
                                )
                            })
                        }
                    </div>
                    {Object.keys(cart).length > 0 && (
                        <div className="mt-10 pt-8 border-t border-slate-100 space-y-6">
                            <div className="flex justify-between items-center mb-4">
                               <p className="text-[10px] font-black uppercase text-slate-400 italic">Chọn hình thức:</p>
                               <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                                  <button onClick={() => setOrderType(OrderType.DINE_IN)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${orderType === OrderType.DINE_IN ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>Tại chỗ</button>
                                  <button onClick={() => setOrderType(OrderType.TAKEAWAY)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${orderType === OrderType.TAKEAWAY ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>Mang về</button>
                               </div>
                            </div>
                            <div className="flex justify-between items-center bg-slate-50 p-5 rounded-2xl">
                               <span className="text-[11px] font-black text-slate-400 uppercase italic">Thành tiền:</span>
                               <span className="text-2xl font-black text-slate-900 italic">{cartTotal.toLocaleString()}đ</span>
                            </div>
                            <button onClick={handlePlaceOrder} disabled={isOrdering} className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 shadow-xl">
                                {isOrdering ? <Loader2 size={20} className="animate-spin" /> : <>Xác nhận gọi món <PlusCircle size={18} /></>}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {view === 'HISTORY' && (
            <div className="animate-fadeIn space-y-4 px-2">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 min-h-[400px]">
                    <h3 className="font-black text-slate-800 text-xl mb-8 flex items-center gap-3 italic uppercase"><ChefHat size={22} className="text-orange-500"/> Món đã gọi</h3>
                    <div className="space-y-4">
                        {table?.currentOrders.map((item: OrderItem) => (
                            <div key={item.id} className={`p-5 rounded-2xl border-2 transition-all ${item.status === OrderItemStatus.CANCELLED ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-slate-50 shadow-sm'}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-black text-slate-800 text-xs uppercase truncate max-w-[180px]">{item.name} <span className="text-orange-500 ml-1.5 italic">x{item.quantity}</span></h4>
                                    <span className="font-black text-slate-900 text-xs">{(item.price * item.quantity).toLocaleString()}đ</span>
                                </div>
                                {item.note && <p className="text-[9px] font-bold text-red-400 italic mb-2">📝 {item.note}</p>}
                                <div className="flex justify-between items-center mt-3">
                                   <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${item.status === OrderItemStatus.SERVED ? 'bg-green-500' : item.status === OrderItemStatus.CANCELLED ? 'bg-red-300' : 'bg-orange-400 animate-pulse'}`}></div>
                                      <span className="text-[9px] font-black uppercase tracking-tight italic text-slate-500">{item.status}</span>
                                   </div>
                                   {(item.status === OrderItemStatus.PENDING || item.status === OrderItemStatus.CONFIRMED) && (
                                     <button onClick={() => setCancelTarget({ id: item.id, name: item.name })} className="text-red-500 text-[9px] font-black uppercase italic underline">Huỷ món</button>
                                   )}
                                </div>
                            </div>
                        ))}
                    </div>
                    {totalCurrentOrder > 0 && (
                        <div className="mt-10 pt-8 border-t border-slate-100">
                            <div className="bg-slate-900 rounded-[2rem] p-8 text-white text-center shadow-2xl">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block italic">Tổng cộng</span>
                                <h3 className="text-3xl font-black mb-10 italic tracking-tighter">{totalCurrentOrder.toLocaleString()}đ</h3>
                                <button disabled={!allServed} onClick={() => setShowPaymentConfirm(true)} className={`w-full py-5 rounded-2xl font-black uppercase text-xs shadow-xl ${allServed ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}>
                                    {allServed ? 'Gửi yêu cầu thanh toán' : 'Chờ phục vụ hết món...'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>

      <button onClick={() => setView(view === 'CART' ? 'MENU' : 'CART')} className={`fixed bottom-24 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-[60] border-4 border-white transition-all active:scale-90 ${cartTotal > 0 ? 'bg-orange-500 text-white animate-bounce' : 'bg-slate-900 text-white'}`}>
        <ShoppingCart size={28} />
        {Object.keys(cart).length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg">{(Object.values(cart) as { qty: number }[]).reduce((s, d) => s + d.qty, 0)}</span>
        )}
      </button>
    </div>
  );
};

export default CustomerMenu;
