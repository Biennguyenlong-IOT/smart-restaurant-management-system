
import React, { memo, useState, useEffect, useMemo, useCallback } from 'react';
// Use namespace import to resolve missing named exports in some environments
import * as ReactRouterDOM from 'react-router-dom';
const { useParams, Link, useNavigate, useSearchParams } = ReactRouterDOM;

import { GoogleGenAI } from "@google/genai";
import { CATEGORIES } from '../constants';
import { OrderItem, OrderItemStatus, MenuItem, TableStatus, UserRole, Table } from '../types';
import { ConfirmModal } from '../App';
import { X, ShoppingCart, History, ChefHat, Loader2, Sparkles, Send, Bot, FileText, CreditCard } from 'lucide-react';

const MenuCard = memo(({ item, quantity, onAdd, onRemove }: { item: MenuItem, quantity: number, onAdd: () => void, onRemove: () => void }) => {
    return (
        <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 flex gap-4 animate-scaleIn will-change-transform h-fit">
          <img src={item.image} alt={item.name} className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover shrink-0" loading="lazy" />
          <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
            <div>
                <h3 className="font-black text-slate-800 text-sm mb-0.5 truncate">{item.name}</h3>
                <p className="text-[9px] md:text-[10px] text-slate-400 line-clamp-2 leading-tight">{item.description}</p>
            </div>
            <div className="flex justify-between items-center mt-2">
                <span className="font-black text-orange-600 text-sm">{item.price.toLocaleString()}đ</span>
                <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl">
                    {quantity > 0 && (
                        <button onClick={onRemove} className="w-7 h-7 bg-white rounded-lg shadow-sm font-black active:scale-90 transition-transform">-</button>
                    )}
                    {quantity > 0 && <span className="text-xs font-black w-4 text-center">{quantity}</span>}
                    <button onClick={onAdd} className="w-7 h-7 bg-orange-500 text-white rounded-lg shadow-lg font-black active:scale-90 transition-transform">+</button>
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
  const navigate = useNavigate();
  const idNum = parseInt(tableId || '0');
  
  const table = useMemo(() => (store.tables || []).find((t: Table) => t.id === idNum), [store.tables, idNum]);
  const tokenFromUrl = tokenFromPath || searchParams.get('token');
  
  const [activeTab, setActiveTab] = useState('Tất cả');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [view, setView] = useState<'MENU' | 'CART' | 'HISTORY'>('MENU');
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{id: string, name: string} | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);

  // Add missing cart utility functions and derived state
  const cartCount = useMemo(() => 
    Object.values(cart).reduce((sum, qty) => sum + qty, 0)
  , [cart]);

  const cartTotal = useMemo(() => 
    Object.entries(cart).reduce((sum, [id, qty]) => {
      const item = (store.menu || []).find((m: MenuItem) => m.id === id);
      return sum + (item?.price || 0) * qty;
    }, 0)
  , [cart, store.menu]);

  const handleAddToCart = useCallback((id: string) => {
    setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }, []);

  const handleRemoveFromCart = useCallback((id: string) => {
    setCart(prev => {
      if (!prev[id]) return prev;
      const newCart = { ...prev };
      if (newCart[id] > 1) {
        newCart[id] -= 1;
      } else {
        delete newCart[id];
      }
      return newCart;
    });
  }, []);

  // AI Assistant State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  useEffect(() => {
    if (!tableId) {
      const lockedId = localStorage.getItem('locked_table_id');
      if (lockedId && store.tables.length > 0) {
        const lockedTable = store.tables.find((t: any) => t.id === parseInt(lockedId));
        if (lockedTable && lockedTable.status !== TableStatus.AVAILABLE) {
          navigate(`/table/${lockedId}`, { replace: true });
        }
      }
    }
  }, [tableId, store.tables, navigate]);

  useEffect(() => {
    if (tableId && table && table.status !== TableStatus.AVAILABLE) {
      localStorage.setItem('locked_table_id', tableId);
    }
  }, [tableId, table?.status]);

  const handleAiAsk = async () => {
    if (!aiQuery.trim() || isAiThinking) return;
    setIsAiThinking(true);
    setAiResponse('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: aiQuery,
        config: {
          systemInstruction: `Bạn là một trợ lý AI thông minh tại nhà hàng 'Smart Resto'. 
          Thực đơn hiện tại: ${JSON.stringify(store.menu)}.
          Hãy giúp khách hàng chọn món, giải thích nguyên liệu và đưa ra gợi ý dựa trên sở thích của họ.
          Hãy trả lời thân thiện, súc tích và hoàn toàn bằng tiếng Việt.`,
        }
      });
      setAiResponse(response.text || 'Xin lỗi, tôi không thể xử lý yêu cầu lúc này.');
    } catch (e) {
      setAiResponse('Có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại sau.');
      console.error(e);
    } finally {
      setIsAiThinking(false);
    }
  };

  const activeOrders = useMemo(() => 
    (table?.currentOrders || []).filter((i: OrderItem) => i.status !== OrderItemStatus.CANCELLED)
  , [table?.currentOrders]);

  const totalCurrentOrder = useMemo((): number => 
    activeOrders.reduce((sum: number, item: OrderItem) => sum + (item.price * item.quantity), 0)
  , [activeOrders]);

  const allServed = useMemo(() => {
    return activeOrders.length > 0 && activeOrders.every((item: OrderItem) => item.status === OrderItemStatus.SERVED);
  }, [activeOrders]);

  if (tableId && (store.tables.length === 0 || !table)) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-fadeIn">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter">Đang kết nối...</h2>
      </div>
    );
  }

  const isTokenValid = tableId && table && table.sessionToken && table.sessionToken === tokenFromUrl;

  const getStatusLabel = (status: OrderItemStatus) => {
    switch (status) {
      case OrderItemStatus.PENDING: return { label: 'Chờ duyệt', color: 'bg-slate-100 text-slate-500' };
      case OrderItemStatus.CONFIRMED: return { label: 'Đã nhận', color: 'bg-blue-100 text-blue-600' };
      case OrderItemStatus.COOKING: return { label: 'Đang nấu', color: 'bg-orange-100 text-orange-600' };
      case OrderItemStatus.READY: return { label: 'Xong - Chờ bưng', color: 'bg-amber-100 text-amber-600' };
      case OrderItemStatus.SERVED: return { label: 'Đã phục vụ', color: 'bg-green-100 text-green-600' };
      case OrderItemStatus.CANCELLED: return { label: 'Đã hủy', color: 'bg-red-100 text-red-600' };
      default: return { label: status, color: 'bg-slate-100' };
    }
  };

  const handlePlaceOrder = async () => {
    if (Object.keys(cart).length === 0 || isOrdering) return;
    setIsOrdering(true);
    try {
        const newOrders: OrderItem[] = (Object.entries(cart) as [string, number][]).map(([itemId, qty]) => {
          const menuItem = (store.menu || []).find((m: MenuItem) => m.id === itemId);
          return { 
            id: `O-${Date.now()}-${itemId}-${Math.random().toString(36).substr(2, 4)}`, 
            menuItemId: itemId, 
            name: menuItem?.name || '', 
            price: menuItem?.price || 0, 
            quantity: qty, 
            status: OrderItemStatus.PENDING, 
            timestamp: Date.now() 
          };
        });
        await store.placeOrder(idNum, newOrders);
        setCart({});
        setView('HISTORY'); 
    } catch (e) {
        alert("Có lỗi khi gọi món!");
    } finally {
        setIsOrdering(false);
    }
  };

  if (!tableId) {
    return (
        <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn">
            <div className="w-24 h-24 bg-orange-100 rounded-[2rem] flex items-center justify-center mb-8 text-4xl shadow-inner">🍴</div>
            <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight uppercase">Smart Restaurant</h2>
            <p className="text-slate-500 mb-10 text-sm font-medium">Vui lòng quét QR tại bàn để gọi món</p>
            <div className="w-full max-w-xs space-y-3">
                <Link to="/staff" className="flex items-center justify-center py-4 bg-slate-900 rounded-2xl shadow-xl text-[10px] font-black uppercase text-white tracking-widest active:scale-95 transition-transform">Vào Hệ Thống (Nhân Viên)</Link>
            </div>
        </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fadeIn">
        <div className="w-24 h-24 rounded-[2.5rem] bg-red-50 text-red-500 border-2 border-red-100 flex items-center justify-center mb-8 shadow-xl text-4xl">🚫</div>
        <h2 className="text-2xl font-black text-slate-800 mb-4 uppercase tracking-tighter">Mã QR không hợp lệ</h2>
        <p className="text-slate-500 text-xs mb-10 max-w-[240px]">Mã đã hết hạn hoặc chưa được kích hoạt. Hãy liên hệ nhân viên.</p>
        <Link to="/" className="inline-block px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Quay lại</Link>
      </div>
    );
  }

  // View Thanh toán (Hóa đơn và VietQR)
  if (table?.status === TableStatus.PAYING || table?.status === TableStatus.BILLING) {
    const qrUrl = `https://img.vietqr.io/image/${store.bankConfig.bankId}-${store.bankConfig.accountNo}-compact.png?amount=${totalCurrentOrder}&addInfo=Thanh+Toan+Ban+${idNum}&accountName=${encodeURIComponent(store.bankConfig.accountName)}`;
    
    return (
      <div className="flex flex-col h-full animate-fadeIn max-w-md mx-auto w-full pb-10">
        <div className="flex-1 overflow-y-auto no-scrollbar pt-6 px-4">
           <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                 <FileText size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-2">Hóa đơn bàn {idNum}</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Vui lòng kiểm tra và thanh toán</p>
              
              <div className="space-y-3 mb-10 text-left border-y border-slate-50 py-6">
                {activeOrders.map(o => (
                  <div key={o.id} className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 truncate flex-1">{o.name} <span className="text-slate-400 ml-1">x{o.quantity}</span></span>
                    <span className="text-xs font-black text-slate-800 ml-4">{(o.price * o.quantity).toLocaleString()}đ</span>
                  </div>
                ))}
                <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                   <span className="text-sm font-black text-slate-900 uppercase italic">Tổng cộng</span>
                   <span className="text-xl font-black text-orange-600">{totalCurrentOrder.toLocaleString()}đ</span>
                </div>
              </div>

              {store.bankConfig.accountNo ? (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-blue-500 uppercase flex items-center justify-center gap-2">
                    <CreditCard size={12}/> Quét mã VietQR để thanh toán
                  </p>
                  <img src={qrUrl} alt="VietQR" className="w-56 h-56 mx-auto rounded-3xl shadow-lg border-4 border-white" />
                  <div className="text-[10px] font-bold text-slate-400">
                    <p>{store.bankConfig.accountName}</p>
                    <p>{store.bankConfig.bankId} - {store.bankConfig.accountNo}</p>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-slate-50 rounded-2xl text-[11px] font-bold text-slate-500 italic">
                  Vui lòng chờ nhân viên thu tiền mặt tại quầy.
                </div>
              )}
           </div>
           
           <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl text-center">
             <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Trạng thái thanh toán</p>
             <div className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-blue-400"/>
                <span className="font-black italic uppercase text-sm">
                  {table.status === TableStatus.PAYING ? 'Đang chờ nhân viên xác nhận...' : 'Đang in hóa đơn...'}
                </span>
             </div>
           </div>
        </div>
      </div>
    );
  }

  const filteredMenu = (store.menu || []).filter((item: MenuItem) => activeTab === 'Tất cả' ? true : item.category === activeTab);

  return (
    <div className="flex flex-col h-full max-w-md mx-auto w-full relative">
      <ConfirmModal isOpen={showPaymentConfirm} title="Thanh toán" message={`Xác nhận yêu cầu thanh toán ${totalCurrentOrder.toLocaleString()}đ?`} onConfirm={() => store.requestPayment(idNum)} onCancel={() => setShowPaymentConfirm(false)} />
      <ConfirmModal 
        isOpen={cancelTarget !== null} 
        type="danger"
        title="Huỷ món" 
        message={`Huỷ món "${cancelTarget?.name}"?`} 
        onConfirm={() => {
            if (cancelTarget) store.cancelOrderItem(idNum, cancelTarget.id);
            setCancelTarget(null);
        }} 
        onCancel={() => setCancelTarget(null)} 
      />

      {/* AI Assistant Modal */}
      {isAiOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-end md:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-t-[3rem] md:rounded-[3rem] p-8 shadow-2xl animate-slideUp relative">
            <button onClick={() => setIsAiOpen(false)} className="absolute top-6 right-6 p-2 bg-slate-50 rounded-full text-slate-400"><X size={20}/></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                <Bot size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 italic">Smart Assistant</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tư vấn chọn món AI</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 min-h-[120px] max-h-[300px] overflow-y-auto mb-6 text-sm text-slate-700 leading-relaxed">
              {isAiThinking ? (
                <div className="flex items-center gap-2 text-slate-400 font-bold italic animate-pulse">
                  <Loader2 size={16} className="animate-spin" /> Gemini đang suy nghĩ...
                </div>
              ) : aiResponse ? (
                <div className="whitespace-pre-wrap">{aiResponse}</div>
              ) : (
                <div className="text-slate-300 italic">Chào bạn! Hãy đặt câu hỏi để tôi gợi ý món ăn nhé.</div>
              )}
            </div>

            <div className="relative">
              <input 
                type="text" 
                value={aiQuery} 
                onChange={e => setAiQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiAsk()}
                placeholder="Có món nào lạ không?..." 
                className="w-full pl-6 pr-14 py-4 bg-slate-100 rounded-2xl font-bold text-sm outline-none"
              />
              <button 
                onClick={handleAiAsk}
                disabled={isAiThinking}
                className="absolute right-2 top-2 w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg disabled:bg-slate-300"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[1.5rem] p-3 mb-4 shadow-sm border border-slate-100 flex justify-between items-center shrink-0 mt-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center font-black shadow-md text-sm italic">B{idNum}</div>
          <h2 className="text-slate-800 font-black text-sm uppercase">Bàn {idNum}</h2>
        </div>
        <div className="flex gap-1.5 p-1 bg-slate-50 rounded-xl">
            <button onClick={() => setView('MENU')} className={`p-2.5 rounded-lg transition-all ${view === 'MENU' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400'}`}><ShoppingCart size={16}/></button>
            <button onClick={() => setView('HISTORY')} className={`p-2.5 rounded-lg transition-all ${view === 'HISTORY' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400'}`}><History size={16}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {view === 'MENU' && (
            <>
                <div className="flex gap-1.5 overflow-x-auto pb-3 no-scrollbar sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 pt-1">
                    {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setActiveTab(cat)} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all uppercase whitespace-nowrap ${activeTab === cat ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}>{cat}</button>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-3">
                    {filteredMenu.map((item: MenuItem) => (
                        <MenuCard 
                            key={item.id} 
                            item={item} 
                            quantity={cart[item.id] || 0} 
                            onAdd={() => handleAddToCart(item.id)} 
                            onRemove={() => handleRemoveFromCart(item.id)} 
                        />
                    ))}
                </div>
            </>
        )}

        {view === 'CART' && (
            <div className="animate-fadeIn space-y-4 pb-20">
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-800 text-lg">Giỏ hàng</h3>
                        <button onClick={() => setView('MENU')} className="text-[10px] font-black text-orange-500 uppercase">Chọn thêm</button>
                    </div>
                    <div className="space-y-4">
                        {Object.keys(cart).length === 0 ? (
                            <div className="py-10 text-center text-slate-300 font-bold uppercase text-[10px]">Chưa chọn món</div>
                        ) : (
                            (Object.entries(cart) as [string, number][]).map(([itemId, qty]) => {
                                const item = (store.menu || []).find((m: any) => m.id === itemId);
                                return (
                                    <div key={itemId} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <img src={item?.image} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                                            <div className="min-w-0">
                                                <h4 className="font-black text-slate-800 text-[11px] leading-none truncate">{item?.name}</h4>
                                                <p className="text-[9px] text-orange-600 font-bold mt-1">{item?.price.toLocaleString()}đ</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <button onClick={() => handleRemoveFromCart(itemId)} className="w-6 h-6 bg-slate-100 rounded-lg font-black text-xs">-</button>
                                            <span className="font-black text-xs w-4 text-center">{qty}</span>
                                            <button onClick={() => handleAddToCart(itemId)} className="w-6 h-6 bg-orange-500 text-white rounded-lg font-black text-xs shadow-md shadow-orange-200">+</button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                    {Object.keys(cart).length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Tổng cộng:</span>
                                <span className="text-xl font-black text-slate-900">{cartTotal.toLocaleString()}đ</span>
                            </div>
                            <button 
                                onClick={handlePlaceOrder} 
                                disabled={isOrdering}
                                className={`w-full py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all ${
                                    isOrdering ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white'
                                }`}
                            >
                                {isOrdering ? <Loader2 size={16} className="animate-spin" /> : 'Xác nhận gọi món'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {view === 'HISTORY' && (
            <div className="animate-fadeIn space-y-4">
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 min-h-[300px]">
                    <h3 className="font-black text-slate-800 text-lg mb-6 flex items-center gap-2"><ChefHat size={18} className="text-orange-500"/> Món đã gọi</h3>
                    <div className="space-y-3">
                        {(!table?.currentOrders || table.currentOrders.length === 0) ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-200">
                                <span className="text-4xl mb-2">🍽️</span>
                                <p className="text-[10px] font-black uppercase tracking-widest italic">Chưa có món nào</p>
                            </div>
                        ) : (
                            table.currentOrders.map((item: OrderItem) => {
                                const statusInfo = getStatusLabel(item.status);
                                const canCancel = item.status === OrderItemStatus.PENDING || item.status === OrderItemStatus.CONFIRMED;
                                
                                return (
                                    <div key={item.id} className={`p-4 bg-slate-50 rounded-2xl flex items-center justify-between border-2 border-white transition-opacity ${item.status === OrderItemStatus.CANCELLED ? 'opacity-50' : ''}`}>
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h4 className="font-black text-slate-800 text-[11px] truncate uppercase">{item.name} <span className="text-orange-500 ml-1">x{item.quantity}</span></h4>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full mt-2 inline-block uppercase tracking-wider ${statusInfo.color}`}>
                                            {statusInfo.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <span className="font-black text-slate-800 text-xs">{(item.price * item.quantity).toLocaleString()}đ</span>
                                          {canCancel && (
                                            <button 
                                              onClick={() => setCancelTarget({ id: item.id, name: item.name })} 
                                              className="w-8 h-8 bg-white text-red-500 rounded-lg flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                                            >
                                              <X size={14} strokeWidth={3} />
                                            </button>
                                          )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
                
                {totalCurrentOrder > 0 && (
                    <div className="bg-slate-900 rounded-[2rem] p-6 text-white text-center shadow-xl relative overflow-hidden">
                        <div className="absolute -top-4 -right-4 w-20 h-20 bg-orange-500/20 rounded-full blur-2xl"></div>
                        <p className="text-white/40 text-[9px] mb-1 font-black uppercase tracking-widest">Tạm tính hóa đơn</p>
                        <h3 className="text-3xl font-black mb-6 italic">{totalCurrentOrder.toLocaleString()}đ</h3>
                        <button 
                            disabled={!allServed} 
                            onClick={() => setShowPaymentConfirm(true)} 
                            className={`w-full py-5 rounded-2xl font-black uppercase text-xs transition-all ${
                                allServed ? 'bg-orange-500 text-white active:scale-95 shadow-lg shadow-orange-500/20' : 'bg-white/10 text-white/20 cursor-not-allowed'
                            }`}
                        >
                            {allServed ? 'Yêu cầu thanh toán' : 'Vui lòng chờ phục vụ hết món'}
                        </button>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* AI Assistant Button */}
      <button 
        onClick={() => setIsAiOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-[60] hover:scale-110 active:scale-95 transition-all border-4 border-white"
      >
        <Sparkles size={24} />
      </button>

      {view === 'MENU' && cartCount > 0 && (
        <div className="fixed bottom-6 inset-x-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-slate-900 rounded-[1.8rem] p-4 shadow-2xl flex items-center justify-between animate-slideUp z-50 border border-white/10">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-orange-500/20">{cartCount}</div>
                <div className="min-w-0">
                    <p className="text-white/40 text-[8px] font-black uppercase">Giỏ hàng</p>
                    <p className="text-sm font-black text-white truncate">{cartTotal.toLocaleString()}đ</p>
                </div>
            </div>
            <button onClick={() => setView('CART')} className="bg-orange-500 text-white px-6 py-3.5 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-orange-500/30 active:scale-95 transition-transform whitespace-nowrap">Xem & Gọi món</button>
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
