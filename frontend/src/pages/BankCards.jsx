import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function BankCards() {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFullCard, setShowFullCard] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    card_number: '',
    card_type: 'credit',
    holder_name: '',
    expiry_month: '',
    expiry_year: '',
    cvv: '',
    pin: '',
    billing_address: '',
    notes: '',
    color: '#1a1a2e'
  });

  const cardColors = [
    '#1a1a2e', '#16213e', '#0f3460', '#533483',
    '#1e5128', '#191919', '#2c3e50', '#8b0000'
  ];

  const brandLogos = {
    visa: '💳 Visa',
    mastercard: '💳 MasterCard',
    amex: '💳 American Express',
    discover: '💳 Discover',
    unionpay: '💳 银联',
    jcb: '💳 JCB',
    unknown: '💳'
  };

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const res = await api.get('/cards');
      setCards(res.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFullCard = async (id) => {
    try {
      const res = await api.get(`/cards/${id}`);
      setShowFullCard(res.data);
    } catch (error) {
      alert('加载失败');
    }
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    try {
      if (selectedCard) {
        await api.put(`/cards/${selectedCard.id}`, formData);
      } else {
        await api.post('/cards', formData);
      }
      setShowAddForm(false);
      setSelectedCard(null);
      resetForm();
      await loadCards();
    } catch (error) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const handleDeleteCard = async (id) => {
    if (!confirm('确定删除此银行卡？')) return;
    try {
      await api.delete(`/cards/${id}`);
      setShowFullCard(null);
      await loadCards();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleToggleFavorite = async (id) => {
    try {
      await api.post(`/cards/${id}/favorite`);
      await loadCards();
    } catch (error) {
      alert(error.response?.data?.error || '操作失败');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      card_number: '',
      card_type: 'credit',
      holder_name: '',
      expiry_month: '',
      expiry_year: '',
      cvv: '',
      pin: '',
      billing_address: '',
      notes: '',
      color: '#1a1a2e'
    });
  };

  const handleEditCard = (card) => {
    loadFullCard(card.id).then(() => {
      setSelectedCard(card);
      // Form will be populated when showFullCard is set
    });
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatCardNumber = (number) => {
    if (!number) return '';
    return number.replace(/(.{4})/g, '$1 ').trim();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
                ← 返回
              </button>
              <h1 className="text-xl font-bold">银行卡管理</h1>
            </div>
            <button
              onClick={() => {
                resetForm();
                setSelectedCard(null);
                setShowAddForm(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              添加银行卡
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {cards.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">💳</div>
            <h2 className="text-xl font-semibold mb-2">暂无银行卡</h2>
            <p className="text-gray-500 mb-6">安全存储您的银行卡信息</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              添加第一张卡
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cards.map(card => (
              <div
                key={card.id}
                onClick={() => loadFullCard(card.id)}
                className="relative rounded-2xl p-6 text-white cursor-pointer hover:scale-105 transition-transform shadow-lg"
                style={{ backgroundColor: card.color || '#1a1a2e', minHeight: '200px' }}
              >
                {/* 收藏标记 */}
                {card.is_favorite && (
                  <div className="absolute top-4 right-4">⭐</div>
                )}

                {/* 卡类型 */}
                <div className="text-sm opacity-75 mb-8">
                  {card.card_type === 'credit' ? '信用卡' : card.card_type === 'debit' ? '借记卡' : '其他'}
                </div>

                {/* 卡号 */}
                <div className="text-xl font-mono tracking-wider mb-6">
                  {card.card_number_masked}
                </div>

                {/* 持卡人和有效期 */}
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-xs opacity-75">持卡人</div>
                    <div className="font-medium">{card.holder_name || card.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs opacity-75">有效期</div>
                    <div className="font-medium">
                      {card.expiry_month}/{card.expiry_year}
                    </div>
                  </div>
                </div>

                {/* 品牌 */}
                <div className="absolute bottom-4 right-4 text-lg">
                  {brandLogos[card.brand] || brandLogos.unknown}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 查看卡片详情 */}
      {showFullCard && !showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">卡片详情</h3>
              <button onClick={() => setShowFullCard(null)} className="text-gray-400">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-gray-500">名称</label>
                <div className="font-medium">{showFullCard.name}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">卡号</label>
                <div className="flex items-center justify-between">
                  <span className="font-mono">{formatCardNumber(showFullCard.card_number)}</span>
                  <button
                    onClick={() => handleCopy(showFullCard.card_number)}
                    className="text-blue-600 text-sm"
                  >
                    复制
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">有效期</label>
                  <div>{showFullCard.expiry_month}/{showFullCard.expiry_year}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">CVV</label>
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{showFullCard.cvv || '***'}</span>
                    {showFullCard.cvv && (
                      <button
                        onClick={() => handleCopy(showFullCard.cvv)}
                        className="text-blue-600 text-sm"
                      >
                        复制
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {showFullCard.pin && (
                <div>
                  <label className="text-sm text-gray-500">PIN</label>
                  <div className="flex items-center justify-between">
                    <span className="font-mono">****</span>
                    <button
                      onClick={() => handleCopy(showFullCard.pin)}
                      className="text-blue-600 text-sm"
                    >
                      复制
                    </button>
                  </div>
                </div>
              )}
              {showFullCard.billing_address && (
                <div>
                  <label className="text-sm text-gray-500">账单地址</label>
                  <div>{showFullCard.billing_address}</div>
                </div>
              )}
              {showFullCard.notes && (
                <div>
                  <label className="text-sm text-gray-500">备注</label>
                  <div>{showFullCard.notes}</div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-between">
              <button
                onClick={() => handleToggleFavorite(showFullCard.id)}
                className="text-yellow-500"
              >
                {showFullCard.is_favorite ? '取消收藏' : '收藏'}
              </button>
              <div className="space-x-2">
                <button
                  onClick={() => handleDeleteCard(showFullCard.id)}
                  className="px-3 py-1 text-red-600"
                >
                  删除
                </button>
                <button
                  onClick={() => {
                    setFormData({
                      name: showFullCard.name,
                      card_number: showFullCard.card_number,
                      card_type: showFullCard.card_type,
                      holder_name: showFullCard.holder_name,
                      expiry_month: showFullCard.expiry_month,
                      expiry_year: showFullCard.expiry_year,
                      cvv: showFullCard.cvv,
                      pin: showFullCard.pin,
                      billing_address: showFullCard.billing_address,
                      notes: showFullCard.notes,
                      color: showFullCard.color
                    });
                    setSelectedCard(showFullCard);
                    setShowFullCard(null);
                    setShowAddForm(true);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  编辑
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加/编辑表单 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                {selectedCard ? '编辑银行卡' : '添加银行卡'}
              </h3>
              <button onClick={() => { setShowAddForm(false); setSelectedCard(null); }} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleAddCard} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">卡片名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="我的信用卡"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">卡号 *</label>
                <input
                  type="text"
                  value={formData.card_number}
                  onChange={(e) => setFormData({ ...formData, card_number: e.target.value.replace(/\s/g, '') })}
                  placeholder="1234 5678 9012 3456"
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">卡类型</label>
                  <select
                    value={formData.card_type}
                    onChange={(e) => setFormData({ ...formData, card_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="credit">信用卡</option>
                    <option value="debit">借记卡</option>
                    <option value="prepaid">预付卡</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">持卡人</label>
                  <input
                    type="text"
                    value={formData.holder_name}
                    onChange={(e) => setFormData({ ...formData, holder_name: e.target.value })}
                    placeholder="ZHANG SAN"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">月</label>
                  <select
                    value={formData.expiry_month}
                    onChange={(e) => setFormData({ ...formData, expiry_month: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                        {String(i + 1).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">年</label>
                  <select
                    value={formData.expiry_year}
                    onChange={(e) => setFormData({ ...formData, expiry_year: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 15 }, (_, i) => (
                      <option key={i} value={String(new Date().getFullYear() + i).slice(-2)}>
                        {new Date().getFullYear() + i}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">CVV</label>
                  <input
                    type="password"
                    value={formData.cvv}
                    onChange={(e) => setFormData({ ...formData, cvv: e.target.value })}
                    placeholder="***"
                    maxLength={4}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">PIN (可选)</label>
                <input
                  type="password"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  placeholder="****"
                  maxLength={6}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">卡片颜色</label>
                <div className="flex space-x-2">
                  {cardColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-blue-500' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="备注信息..."
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setSelectedCard(null); }}
                  className="px-4 py-2 text-gray-600"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
