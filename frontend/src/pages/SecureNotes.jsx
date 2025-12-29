import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function SecureNotes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    category: 'general',
    color: '#ffffff'
  });

  const categories = [
    { id: 'all', name: '全部', icon: '📋' },
    { id: 'general', name: '通用', icon: '📝' },
    { id: 'personal', name: '个人', icon: '👤' },
    { id: 'work', name: '工作', icon: '💼' },
    { id: 'finance', name: '财务', icon: '💰' },
    { id: 'medical', name: '医疗', icon: '🏥' },
    { id: 'legal', name: '法律', icon: '⚖️' }
  ];

  const colors = [
    '#ffffff', '#fef3c7', '#fce7f3', '#dbeafe',
    '#d1fae5', '#e9d5ff', '#fed7aa', '#e5e7eb'
  ];

  useEffect(() => {
    loadNotes();
  }, [searchQuery, selectedCategory]);

  const loadNotes = async () => {
    try {
      let url = '/notes';
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (params.toString()) url += '?' + params.toString();

      const res = await api.get(url);
      setNotes(res.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = () => {
    setSelectedNote(null);
    setEditForm({
      title: '',
      content: '',
      category: 'general',
      color: '#ffffff'
    });
    setIsEditing(true);
  };

  const handleEditNote = (note) => {
    setSelectedNote(note);
    setEditForm({
      title: note.title,
      content: note.content,
      category: note.category,
      color: note.color
    });
    setIsEditing(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    try {
      if (selectedNote) {
        await api.put(`/notes/${selectedNote.id}`, editForm);
      } else {
        await api.post('/notes', editForm);
      }
      setIsEditing(false);
      setSelectedNote(null);
      await loadNotes();
    } catch (error) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const handleDeleteNote = async (id) => {
    if (!confirm('确定删除此笔记？')) return;
    try {
      await api.delete(`/notes/${id}`);
      setSelectedNote(null);
      await loadNotes();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleTogglePin = async (id) => {
    try {
      await api.post(`/notes/${id}/pin`);
      await loadNotes();
    } catch (error) {
      alert(error.response?.data?.error || '操作失败');
    }
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
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
                ← 返回
              </button>
              <h1 className="text-xl font-bold">安全笔记</h1>
            </div>
            <button
              onClick={handleCreateNote}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              新建笔记
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* 侧边栏 */}
          <div className="w-48 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索笔记..."
                className="w-full px-3 py-2 border rounded-lg mb-4"
              />
              <div className="space-y-1">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-2 ${
                      selectedCategory === cat.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 笔记列表 */}
          <div className="flex-1">
            {notes.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-gray-500">暂无笔记</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition"
                    style={{ backgroundColor: note.color }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium truncate flex-1">
                        {note.is_pinned && <span className="mr-1">📌</span>}
                        {note.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {note.content}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span>{categories.find(c => c.id === note.category)?.icon} {categories.find(c => c.id === note.category)?.name}</span>
                      <span>{new Date(note.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 查看/编辑笔记弹窗 */}
      {(selectedNote || isEditing) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {isEditing ? (
              <form onSubmit={handleSaveNote} className="flex flex-col h-full">
                <div className="p-4 border-b flex items-center justify-between">
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="笔记标题"
                    className="text-lg font-semibold flex-1 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedNote(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 ml-4"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    placeholder="输入笔记内容..."
                    className="w-full h-64 p-3 border rounded-lg resize-none"
                    required
                  />
                  <div className="mt-4 flex items-center space-x-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">分类</label>
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                      >
                        {categories.filter(c => c.id !== 'all').map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">颜色</label>
                      <div className="flex space-x-2">
                        {colors.map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setEditForm({ ...editForm, color })}
                            className={`w-6 h-6 rounded-full border-2 ${
                              editForm.color === color ? 'border-blue-500' : 'border-gray-300'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 border-t flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedNote(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
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
            ) : (
              <>
                <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: selectedNote.color }}>
                  <h2 className="text-lg font-semibold">
                    {selectedNote.is_pinned && <span className="mr-1">📌</span>}
                    {selectedNote.title}
                  </h2>
                  <button
                    onClick={() => setSelectedNote(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  <p className="whitespace-pre-wrap">{selectedNote.content}</p>
                </div>
                <div className="p-4 border-t flex justify-between">
                  <div className="text-sm text-gray-500">
                    更新于 {new Date(selectedNote.updated_at).toLocaleString()}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleTogglePin(selectedNote.id)}
                      className="px-3 py-1 text-gray-600 hover:text-gray-800"
                    >
                      {selectedNote.is_pinned ? '取消置顶' : '置顶'}
                    </button>
                    <button
                      onClick={() => handleDeleteNote(selectedNote.id)}
                      className="px-3 py-1 text-red-600 hover:text-red-800"
                    >
                      删除
                    </button>
                    <button
                      onClick={() => handleEditNote(selectedNote)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      编辑
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
