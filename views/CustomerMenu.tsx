
import React, { memo, useState, useMemo, useCallback } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useParams, Link, useNavigate, useSearchParams, useLocation } = ReactRouterDOM;

import { CATEGORIES } from '../constants';
import { OrderItem, OrderItemStatus, MenuItem, TableStatus, UserRole, Table, OrderType, Review } from '../types';
import { ConfirmModal } from '../App';
import { ShoppingCart, History, ChefHat, Loader2, FileText, CreditCard, Star, AlertTriangle, PlusCircle, QrCode } from 'lucide-react';

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

  // Review state
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
    } catch (e) { alert("Lỗi gọi món! Vui lòng thử lại."); } finally { setIsOrdering(false); }
  };

  const submitReview = () => {
    const review: Review = {
      id: `R-${Date.now()}`,
      tableId: idNum,
      staffId: table?.claimedBy || 'system',
      ratingFood: reviewForm.ratingFood,
      ratingService: reviewForm.ratingService,
      comment: reviewForm.comment,
      timestamp: Date.now()
    };
    store.submitReview(review);
    alert("Cảm ơn bạn đã đánh giá!");
    navigate('/', { replace: true });
  };

  // Trang chủ vãng lai - Giao diện chào mừng thay vì thực đơn
  if (isPublicView) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn max-w-2xl mx-auto w-full pb-20">
        <div className="w-24 h-24 bg-orange-500 text-white rounded-[2.5rem] flex items-center justify-center mb-8 text-4xl font-black italic shadow-2xl animate-bounce">S</div>
        <h1 className="text-4xl font-black text-slate-800 uppercase italic mb-4 tracking-tighter">Smart Resto</h1>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mb-12">Hệ thống gọi món thông minh</p>
        
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 w-full mb-10">
           <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><QrCode size={32} /></div>
           <h2 className="text-xl font-black text-slate-800 uppercase italic mb-3">Vui lòng quét mã QR</h2>
           <p className="text-slate-400 text-sm leading-relaxed mb-8">Quý khách vui lòng quét mã QR đặt tại bàn để xem thực đơn và gọi món trực tiếp.</p>
           <div className="flex flex-col gap-3">
             <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black italic">1</span>
                <p className="text-[10px] font-black uppercase text-slate-600">Mở camera điện thoại</p>
             </div>
             <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black italic">2</span>
                <p className="text-[10px] font-black uppercase text-slate-600">Quét mã tại bàn của bạn</p>
             </div>
             <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-black italic">3</span>
                <p className="text-[10px] font-black uppercase text-slate-600">Chọn món & Gửi yêu cầu</p>
             </div>
           </div>
        </div>
        
        <div className="flex gap-4">
           <Link to="/login" className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-2xl flex items-center gap-2 active:scale-95 transition-all">Đăng nhập Nhân viên</Link>
        </div>
      </div>
    );
  }

  if (table?.status === TableStatus.REVIEWING) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn max-w-md mx-auto">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-50 w-full">
           <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><Star size={40} fill="currentColor" /></div>
           <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-2">Đánh giá dịch vụ</h2>
           <p className="text-[10px] font-bold text-slate-400 uppercase italic mb-8">Ý kiến của bạn giúp chúng tôi hoàn thiện hơn</p>
           
           <div className="space-y-8 mb-10 text-center">
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase mb-4">Chất lượng món ăn</p>
                <div className="flex justify-center gap-3">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setReviewForm({...reviewForm, ratingFood: s})} className={`transition-all active:scale-90 ${reviewForm.ratingFood >= s ? 'text-orange-500 scale-110' : 'text-slate-200'}`}><Star size={32} fill={reviewForm.ratingFood >= s ? 'currentColor' : 'none'}/></button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-400 uppercase mb-4">Thái độ phục vụ</p>
                <div className="flex justify-center gap-3">
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setReviewForm({...reviewForm, ratingService: s})} className={`transition-all active:scale-90 ${reviewForm.ratingService >= s ? 'text-blue-500 scale-110' : 'text-slate-200'}`}><Star size={32} fill={reviewForm.ratingService >= s ? 'currentColor' : 'none'}/></button>
                  ))}
                </div>
              </div>
              <textarea value={reviewForm.comment} onChange={e => setReviewForm({...reviewForm, comment: e.target.value})} placeholder="Bạn có góp ý gì thêm không?..." className="w-full p-5 bg-slate-50 rounded-2xl text-xs font-bold border border-slate-100 h-32 outline-none focus:border-orange-500 transition-all shadow-inner" />
           </div>
           <button onClick={submitReview} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Gửi đánh giá & Kết thúc</button>
        </div>
      </div>
    );
  }

  const isTokenValid = tableId && table && table.sessionToken && table.sessionToken === tokenFromUrl;
  if (!tableId || !isTokenValid) return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn">
        <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mb-8 text-5xl shadow-lg">⚠️</div>
        <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase italic">Phiên làm việc hết hạn</h2>
        <p className="text-slate-400 text-sm mb-8 max-w-xs">Vui lòng quét mã QR mới tại bàn để tiếp tục sử dụng dịch vụ.</p>
        <Link to="/" className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase shadow-2xl active:scale-95 transition-all">Quay lại trang chủ</Link>
    </div>
  );

  if (table?.status === TableStatus.PAYING || table?.status === TableStatus.BILLING) {
    const qrUrl = `https://img.vietqr.io/image/${store.bankConfig.bankId}-${store.bankConfig.accountNo}-compact.png?amount=${totalCurrentOrder}&addInfo=Thanh+Toan+Ban+${idNum}&accountName=${encodeURIComponent(store.bankConfig.accountName)}`;
    return (
      <div className="flex flex-col h-full animate-fadeIn max-w-md mx-auto w-full pb-10">
        <div className="flex-1 overflow-y-auto no-scrollbar pt-6 px-4">
           <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner"><FileText size={32} /></div>
              <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-2">Hóa đơn bàn {idNum}</h2>
              <div className="space-y-3 mb-10 text-left border-y border-slate-50 py-8 mt-6">
                {activeOrders.map(o => (
                  <div key={o.id} className={`flex justify-between items-center text-xs ${o.status === OrderItemStatus.CANCELLED ? 'opacity-30 line-through' : ''}`}>
                    <span className="font-bold text-slate-600">{o.name} <span className="text-slate-400 ml-1">x{o.quantity}</span></span>
                    <span className="font-black text-slate-800">{(o.price * o.quantity).toLocaleString()}đ</span>
                  </div>
                ))}
                <div className="pt-6 border-t border-slate-100 flex justify-between items-center font-black mt-4">
                   <span className="text-sm text-slate-900 uppercase italic tracking-tighter">Tổng cộng</span>
                   <span className="text-2xl text-orange-600 italic">{totalCurrentOrder.toLocaleString()}đ</span>
                </div>
              </div>
              {store.bankConfig.accountNo && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-blue-500 uppercase flex items-center justify-center gap-2 tracking-widest bg-blue-50 py-2 rounded-xl"><CreditCard size={14}/> Thanh toán chuyển khoản</p>
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <img src={qrUrl} alt="VietQR" className="w-56 h-56 mx-auto rounded-3xl shadow-lg border-4 border-white" />
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase italic">Vui lòng kiểm tra lại số tiền trước khi chuyển</p>
                </div>
              )}
           </div>
           <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl text-center flex flex-col items-center gap-3">
             <div className="flex items-center justify-center gap-3">
                <Loader2 size={20} className="animate-spin text-orange-500"/>
                <span className="font-black italic uppercase text-sm tracking-tight">
                  {table.status === TableStatus.PAYING ? 'Chờ nhân viên xác nhận...' : 'Đang xử lý hoá đơn...'}
                </span>
             </div>
             <p className="text-[10px] font-black text-slate-500 uppercase">Hệ thống sẽ tự động cập nhật sau vài giây</p>
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
      <ConfirmModal isOpen={showPaymentConfirm} title="Xác nhận thanh toán" message={`Bạn muốn yêu cầu thanh toán tổng cộng ${totalCurrentOrder.toLocaleString()}đ?`} onConfirm={() => store.requestPayment(idNum)} onCancel={() => setShowPaymentConfirm(false)} />
      <ConfirmModal isOpen={cancelTarget !== null} type="danger" title="Huỷ món" message={`Xác nhận huỷ món "${cancelTarget?.name}"?`} onConfirm={() => { if (cancelTarget) store.cancelOrderItem(idNum, cancelTarget.id); setCancelTarget(null); }} onCancel={() => setCancelTarget(null)} />

      <div className="bg-white rounded-[1.8rem] p-3 mb-4 shadow-sm border border-slate-100 flex justify-between items-center shrink-0 mt-2">
        <div className="flex items-center gap-2.5 ml-1">
          <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center font-black text-lg italic shadow-md">B{idNum}</div>
          <div>
            <h2 className="text-slate-800 font-black text-xs uppercase leading-none">Bàn số {idNum}</h2>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Đang phục vụ</span>
          </div>
        </div>
        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.2rem]">
            <button onClick={() => setView('MENU')} className={`p-3 rounded-xl transition-all shadow-sm ${view === 'MENU' ? 'bg-white text-orange-500' : 'text-slate-400'}`}><ShoppingCart size={18}/></button>
            <button onClick={() => setView('HISTORY')} className={`p-3 rounded-xl transition-all shadow-sm ${view === 'HISTORY' ? 'bg-white text-orange-500' : 'text-slate-400'}`}><History size={18}/></button>
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
                    {store.menu.filter((m: MenuItem) => activeTab === 'Tất cả' ? true : m.category === activeTab).length === 0 && (
                        <p className="text-center py-20 text-slate-300 font-black uppercase text-[10px] italic">Hiện không có món trong danh mục này</p>
                    )}
                </div>
            </>
        )}

        {view === 'CART' && (
            <div className="animate-fadeIn space-y-4 pb-20 px-2">
                <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-slate-100">
                    <h3 className="font-black text-slate-800 text-xl italic uppercase mb-8 flex items-center gap-3"><ShoppingCart size={22} className="text-orange-500"/> Giỏ hàng của bạn</h3>
                    
                    {hasUnavailableItems && (
                      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-600 animate-pulse">
                        <AlertTriangle size={20} />
                        <p className="text-[10px] font-black uppercase tracking-tight italic">Rất tiếc, một số món đã hết! Vui lòng bỏ khỏi giỏ hàng.</p>
                      </div>
                    )}

                    <div className="space-y-6">
                        {Object.keys(cart).length === 0 ? (
                          <div className="py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4"><ShoppingCart size={32} className="text-slate-200" /></div>
                            <p className="text-slate-300 font-black uppercase text-[10px] italic">Giỏ hàng đang trống</p>
                          </div>
                        ) : 
                            (Object.entries(cart) as [string, { qty: number, note: string }][]).map(([itemId, data]) => {
                                const item = store.menu.find((m: MenuItem) => m.id === itemId);
                                const isOut = item && !item.isAvailable;
                                return (
                                    <div key={itemId} className={`space-y-4 border-b border-slate-50 pb-6 last:border-0 ${isOut ? 'opacity-70 grayscale' : ''}`}>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="relative shrink-0">
                                                  <img src={item?.image} className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-slate-100" />
                                                  {isOut && <div className="absolute inset-0 bg-red-500/60 rounded-2xl flex items-center justify-center font-black text-[8px] text-white italic">HẾT</div>}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-black text-slate-800 text-sm truncate uppercase">{item?.name}</h4>
                                                    <p className={`text-[10px] font-bold italic ${isOut ? 'text-red-500' : 'text-orange-600'}`}>{isOut ? 'Tạm thời hết món' : `${item?.price.toLocaleString()}đ`}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                                <button onClick={() => handleRemoveFromCart(itemId)} className="w-8 h-8 bg-white rounded-lg shadow-sm font-black text-sm active:scale-90 transition-all">-</button>
                                                <span className="font-black text-sm w-5 text-center text-slate-800">{data.qty}</span>
                                                <button disabled={isOut} onClick={() => handleAddToCart(itemId)} className={`w-8 h-8 rounded-lg font-black text-sm shadow-md active:scale-90 transition-all ${isOut ? 'bg-slate-300 text-slate-400 cursor-not-allowed' : 'bg-orange-500 text-white'}`}>+</button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        }
                    </div>
                    {Object.keys(cart).length > 0 && (
                        <div className="mt-10 pt-8 border-t border-slate-100 space-y-6">
                            <div className="flex justify-between items-center bg-slate-50 p-5 rounded-2xl">
                               <span className="text-[11px] font-black text-slate-400 uppercase italic">Thành tiền:</span>
                               <span className="text-2xl font-black text-slate-900 italic">{cartTotal.toLocaleString()}đ</span>
                            </div>
                            <button 
                              onClick={handlePlaceOrder} 
                              disabled={isOrdering || hasUnavailableItems} 
                              className={`w-full py-6 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 ${hasUnavailableItems ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white shadow-slate-200'}`}
                            >
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
                        {(!table?.currentOrders || table.currentOrders.length === 0) ? (
                          <div className="flex flex-col items-center justify-center py-20">
                             <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><ChefHat size={32} className="text-slate-200" /></div>
                             <p className="text-slate-300 text-[10px] font-black uppercase italic">Chưa có đơn hàng nào được đặt</p>
                          </div>
                        ) : 
                            table.currentOrders.map((item: OrderItem) => (
                                <div key={item.id} className={`p-5 rounded-2xl border-2 transition-all ${item.status === OrderItemStatus.CANCELLED ? 'bg-slate-50 border-slate-100 opacity-50' : 'bg-white border-slate-50 shadow-sm'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-black text-slate-800 text-xs uppercase truncate max-w-[180px]">{item.name} <span className="text-orange-500 ml-1.5 italic">x{item.quantity}</span></h4>
                                        <span className="font-black text-slate-900 text-xs">{(item.price * item.quantity).toLocaleString()}đ</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-3">
                                       <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full ${
                                            item.status === OrderItemStatus.SERVED ? 'bg-green-500' : 
                                            item.status === OrderItemStatus.CANCELLED ? 'bg-red-300' : 'bg-orange-400 animate-pulse'
                                          }`}></div>
                                          <span className={`text-[9px] font-black uppercase tracking-tight italic ${
                                            item.status === OrderItemStatus.SERVED ? 'text-green-600' : 
                                            item.status === OrderItemStatus.CANCELLED ? 'text-red-400' : 'text-orange-500'
                                          }`}>{item.status}</span>
                                       </div>
                                       {(item.status === OrderItemStatus.PENDING || item.status === OrderItemStatus.CONFIRMED) && (
                                         <button onClick={() => setCancelTarget({ id: item.id, name: item.name })} className="text-red-500 text-[9px] font-black uppercase italic underline hover:text-red-600 transition-colors">Huỷ món</button>
                                       )}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                    {totalCurrentOrder > 0 && (
                        <div className="mt-10 pt-8 border-t border-slate-100">
                            <div className="bg-slate-900 rounded-[2rem] p-8 text-white text-center shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-110"></div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block italic">Tổng tiền hiện tại</span>
                                <h3 className="text-4xl font-black mb-10 italic tracking-tighter">{totalCurrentOrder.toLocaleString()}đ</h3>
                                <button disabled={!allServed} onClick={() => setShowPaymentConfirm(true)} className={`w-full py-5 rounded-2xl font-black uppercase text-xs transition-all shadow-xl active:scale-95 ${allServed ? 'bg-orange-500 text-white shadow-orange-500/20' : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}>
                                    {allServed ? 'Gửi yêu cầu thanh toán' : 'Đang chờ phục vụ...'}
                                </button>
                                {!allServed && <p className="text-[8px] font-bold text-slate-500 mt-4 uppercase italic">Vui lòng chờ phục vụ xong các món còn lại để thanh toán</p>}
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
