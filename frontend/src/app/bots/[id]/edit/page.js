'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '../../../../lib/api';
import DashboardLayout from '../../../../components/DashboardLayout';
import { Bot, Save, ArrowLeft, PlusCircle, Trash2, FileText, Layers, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';

export default function EditBotPage() {
  const router = useRouter();
  const params = useParams();
  const botId = params?.id;

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    welcome_message: '',
    color_theme: '#4f46e5',
    use_ai: true,
    faqs: [],
    prompt: ''
  });

  // PDF Management State
  const [pdfs, setPdfs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Guided Menu Management State
  const [categories, setCategories] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatOrder, setNewCatOrder] = useState('0');
  const [showAddCat, setShowAddCat] = useState(false);
  const [savingCat, setSavingCat] = useState(false);

  // New item form state for each category
  const [newItemData, setNewItemData] = useState({});
  const [showAddItem, setShowAddItem] = useState({});
  const [savingItem, setSavingItem] = useState(false);

  const fetchPdfs = async () => {
    try {
      const res = await api.get(`/pdfs/bot/${botId}`);
      setPdfs(res.data || []);
    } catch (err) {
      console.error('Failed to load PDFs:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get(`/admin/bots/${botId}/categories`);
      setCategories(res.data || []);
      if (res.data && res.data.length > 0 && !expandedCategory) {
        setExpandedCategory(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  useEffect(() => {
    if (!botId) return;

    const fetchBot = async () => {
      try {
        const res = await api.get(`/bots/${botId}`);
        const bot = res.data;
        let parsedFaqs = [];
        try {
          parsedFaqs = typeof bot.faqs === 'string' ? JSON.parse(bot.faqs) : (bot.faqs || []);
        } catch (e) {
          parsedFaqs = [];
        }

        setFormData({
          name: bot.name || '',
          welcome_message: bot.welcome_message || '',
          color_theme: bot.color_theme || '#4f46e5',
          use_ai: bot.use_ai !== undefined ? bot.use_ai : true,
          faqs: parsedFaqs,
          prompt: bot.prompt || ''
        });
      } catch (err) {
        console.error('Failed to load bot:', err);
        alert('Could not load bot data');
        router.push('/bots');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchBot();
    fetchPdfs();
    fetchCategories();
  }, [botId, router]);

  const handlePdfUpload = async () => {
    if (!selectedFile) return;
    setUploadingPdf(true);

    const data = new FormData();
    data.append('pdf', selectedFile);
    data.append('botId', botId);

    try {
      await api.post('/pdfs/upload', data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setSelectedFile(null);
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      await fetchPdfs();
      alert('PDF uploaded successfully! Processing started.');
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload PDF: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleDeletePdf = async (pdfId) => {
    if (!confirm('Are you sure you want to delete this PDF and its learned knowledge?')) return;
    try {
      await api.delete(`/pdfs/${pdfId}`);
      await fetchPdfs();
      await fetchCategories();
    } catch (err) {
      console.error('Failed to delete PDF:', err);
      alert('Failed to delete PDF');
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      await api.post(`/admin/bots/${botId}/categories`, {
        name: newCatName.trim(),
        display_order: parseInt(newCatOrder) || 0,
        status: 'active'
      });
      setNewCatName('');
      setNewCatOrder('0');
      setShowAddCat(false);
      await fetchCategories();
    } catch (err) {
      console.error('Failed to create category:', err);
      alert(err.response?.data?.error || 'Failed to create category');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!confirm('Are you sure you want to delete this category and all its items?')) return;
    try {
      await api.delete(`/admin/bots/${botId}/categories/${catId}`);
      await fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category');
    }
  };

  const handleToggleCategoryStatus = async (category) => {
    const nextStatus = category.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/admin/bots/${botId}/categories/${category.id}`, { status: nextStatus });
      await fetchCategories();
    } catch (err) {
      console.error('Failed to update category status:', err);
    }
  };

  const handleAddItem = async (catId, e) => {
    e.preventDefault();
    const data = newItemData[catId] || {};
    if (!data.name || !data.name.trim()) return;
    setSavingItem(true);
    try {
      await api.post(`/admin/categories/${catId}/items`, {
        name: data.name.trim(),
        type: data.type || 'brand',
        display_order: parseInt(data.order) || 0,
        status: 'active',
        pdf_id: data.pdf_id || null
      });
      setNewItemData(prev => ({ ...prev, [catId]: { name: '', type: 'brand', order: 0, pdf_id: '' } }));
      setShowAddItem(prev => ({ ...prev, [catId]: false }));
      await fetchCategories();
    } catch (err) {
      console.error('Failed to add item:', err);
      alert(err.response?.data?.error || 'Failed to add item');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Are you sure you want to delete this brand/service?')) return;
    try {
      await api.delete(`/admin/items/${itemId}`);
      await fetchCategories();
    } catch (err) {
      console.error('Failed to delete item:', err);
      alert('Failed to delete item');
    }
  };

  const handleToggleItemStatus = async (item) => {
    const nextStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/admin/items/${item.id}`, { status: nextStatus });
      await fetchCategories();
    } catch (err) {
      console.error('Failed to update item status:', err);
    }
  };

  const handleMapItemPdf = async (itemId, pdfId) => {
    try {
      await api.post(`/admin/items/${itemId}/pdf`, {
        pdf_id: pdfId || null,
        download_enabled: true
      });
      await fetchCategories();
    } catch (err) {
      console.error('Failed to map PDF to item:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const addFaq = () => {
    setFormData(prev => ({
      ...prev,
      faqs: [...(prev.faqs || []), { question: '', answer: '' }]
    }));
  };

  const updateFaq = (index, field, value) => {
    const newFaqs = [...(formData.faqs || [])];
    newFaqs[index][field] = value;
    setFormData(prev => ({ ...prev, faqs: newFaqs }));
  };

  const removeFaq = (index) => {
    const newFaqs = (formData.faqs || []).filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, faqs: newFaqs }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/bots/${botId}`, formData);
      router.push('/bots');
    } catch (err) {
      console.error(err);
      alert('Failed to update bot');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/bots" className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Chatbot</h1>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <Save className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Update Bot
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-8 space-y-8">
            {/* General Info */}
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center">
                <Bot className="mr-2 h-5 w-5 text-indigo-500" /> General Appearance
              </h3>
              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bot Name</label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="name"
                      id="name"
                      value={formData.name || ''}
                      onChange={handleChange}
                      className="shadow-sm focus:ring-indigo-500 py-3 px-3 border border-gray-300 dark:border-gray-600 bg-transparent dark:text-white focus:border-indigo-500 block w-full sm:text-sm rounded-md"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="color_theme" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Theme Color</label>
                  <div className="mt-1 flex items-center space-x-3">
                    <input
                      type="color"
                      name="color_theme"
                      id="color_theme"
                      value={formData.color_theme || '#4f46e5'}
                      onChange={handleChange}
                      className="h-10 w-10 p-0 border-0 rounded-md cursor-pointer"
                    />
                    <span className="text-sm text-gray-500">{formData.color_theme}</span>
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="welcome_message" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Welcome Message</label>
                  <div className="mt-1">
                    <textarea
                      id="welcome_message"
                      name="welcome_message"
                      rows={3}
                      value={formData.welcome_message || ''}
                      onChange={handleChange}
                      className="shadow-sm focus:ring-indigo-500 bg-transparent dark:text-white border p-3 border-gray-300 dark:border-gray-600 focus:border-indigo-500 block w-full sm:text-sm rounded-md"
                    />
                  </div>
                </div>
                <div className="sm:col-span-6">
                  <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Agent Prompt (Instructions)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Define how the AI should behave (e.g. &quot;You are a helpful support agent for DCS Techno Services Pvt. Ltd. Answer politely.&quot;)
                  </p>
                  <div className="mt-1">
                    <textarea
                      id="prompt"
                      name="prompt"
                      rows={4}
                      placeholder="You are a helpful customer support assistant. Answer clearly and politely."
                      value={formData.prompt || ''}
                      onChange={handleChange}
                      className="shadow-sm focus:ring-indigo-500 bg-transparent dark:text-white border p-3 border-gray-300 dark:border-gray-600 focus:border-indigo-500 block w-full sm:text-sm rounded-md"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">AI Capabilities</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enable AI to automatically answer complex questions using your FAQs and uploaded documents as context.</p>
                </div>
                <div className="flex items-center">
                  <input
                    id="use_ai"
                    name="use_ai"
                    type="checkbox"
                    checked={formData.use_ai}
                    onChange={handleChange}
                    className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="use_ai" className="ml-2 block text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                    Enable AI Automation
                  </label>
                </div>
              </div>
            </div>

            {/* Knowledge Base (PDF Docs) */}
            <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-indigo-500" /> Knowledge Base (PDF Docs)
                </h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Upload PDF documents containing company brochures and knowledge. The AI reads these to answer user questions, and they can be mapped to menu brands for visitor download.
              </p>

              {/* PDF Upload Area */}
              <div className="flex items-center space-x-4 mb-6">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-50 file:text-indigo-700
                    hover:file:bg-indigo-100 dark:file:bg-indigo-900 dark:file:text-indigo-300"
                />
                <button
                  type="button"
                  onClick={handlePdfUpload}
                  disabled={uploadingPdf || !selectedFile}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploadingPdf ? 'Uploading...' : 'Upload PDF'}
                </button>
              </div>

              {/* PDF List */}
              <div className="space-y-3">
                {pdfs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">No PDFs uploaded yet. Try uploading your manual or brochure.</p>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-md">
                    {pdfs.map((pdf) => (
                      <li key={pdf.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-red-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{pdf.file_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Status: <span className={pdf.status === 'completed' ? 'text-green-500' : 'text-yellow-500'}>{pdf.status}</span>
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeletePdf(pdf.id)}
                          className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                          title="Delete PDF"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Guided Chatbot Menu (Categories & Brands/Services) */}
            <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white flex items-center">
                    <Layers className="mr-2 h-5 w-5 text-indigo-500" /> Guided Chatbot Menu (Categories & Brands/Services)
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Configure dynamic categories, brands, and services that appear in the chatbot welcome flow.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCat(true)}
                  className="inline-flex items-center px-3.5 py-2 border border-transparent text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add Category
                </button>
              </div>

              {/* Add Category Form */}
              {showAddCat && (
                <div className="p-4 mb-5 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-3">
                  <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">
                    Create New Category
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Category Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Hydraulic Attachments & Breakers"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={newCatOrder}
                        onChange={(e) => setNewCatOrder(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCat(false);
                        setNewCatName('');
                      }}
                      className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      disabled={savingCat || !newCatName.trim()}
                      className="px-3.5 py-1.5 text-xs bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingCat ? 'Saving...' : 'Save Category'}
                    </button>
                  </div>
                </div>
              )}

              {/* Categories List */}
              <div className="space-y-3">
                {categories.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    No categories created yet. Click &quot;Add Category&quot; or run the seed script to initialize categories.
                  </p>
                ) : (
                  categories.map((cat) => {
                    const isExpanded = expandedCategory === cat.id;
                    const itemsCount = cat.ChatbotItems ? cat.ChatbotItems.length : 0;
                    return (
                      <div
                        key={cat.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-2xs"
                      >
                        {/* Category Header */}
                        <div className="p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100/60 dark:hover:bg-gray-700/40 transition-colors">
                          <div
                            className="flex items-center space-x-3 cursor-pointer flex-1"
                            onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                          >
                            <span className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                              {cat.display_order}
                            </span>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                                {cat.name}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {/* Status Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleCategoryStatus(cat)}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                                cat.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                                  : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                              }`}
                            >
                              {cat.status === 'active' ? 'Active' : 'Inactive'}
                            </button>

                            {/* Delete Category */}
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 size={16} />
                            </button>

                            {/* Expand / Collapse Icon */}
                            <button
                              type="button"
                              onClick={() => setExpandedCategory(isExpanded ? null : cat.id)}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                          </div>
                        </div>

                        {/* Expanded Items Section */}
                        {isExpanded && (
                          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                Brands & Services in &quot;{cat.name}&quot;
                              </h5>
                              <button
                                type="button"
                                onClick={() => setShowAddItem(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                                className="inline-flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                              >
                                <Plus size={14} className="mr-1" /> Add Brand / Service
                              </button>
                            </div>

                            {/* Add Item Form */}
                            {showAddItem[cat.id] && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                  <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                                      Name
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Kennametal or STP"
                                      value={newItemData[cat.id]?.name || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setNewItemData(prev => ({
                                          ...prev,
                                          [cat.id]: { ...(prev[cat.id] || {}), name: val }
                                        }));
                                      }}
                                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                                      Type
                                    </label>
                                    <select
                                      value={newItemData[cat.id]?.type || 'brand'}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setNewItemData(prev => ({
                                          ...prev,
                                          [cat.id]: { ...(prev[cat.id] || {}), type: val }
                                        }));
                                      }}
                                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                    >
                                      <option value="brand">Brand</option>
                                      <option value="service">Service</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                                      Display Order
                                    </label>
                                    <input
                                      type="number"
                                      value={newItemData[cat.id]?.order || 0}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setNewItemData(prev => ({
                                          ...prev,
                                          [cat.id]: { ...(prev[cat.id] || {}), order: val }
                                        }));
                                      }}
                                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                    />
                                  </div>

                                  <div className="sm:col-span-4">
                                    <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                                      Map PDF (Downloadable Brochure)
                                    </label>
                                    <select
                                      value={newItemData[cat.id]?.pdf_id || ''}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setNewItemData(prev => ({
                                          ...prev,
                                          [cat.id]: { ...(prev[cat.id] || {}), pdf_id: val }
                                        }));
                                      }}
                                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                                    >
                                      <option value="">-- No PDF Mapped --</option>
                                      {pdfs.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          📄 {p.file_name} ({p.status})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="flex justify-end space-x-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setShowAddItem(prev => ({ ...prev, [cat.id]: false }))}
                                    className="px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleAddItem(cat.id, e)}
                                    disabled={savingItem || !newItemData[cat.id]?.name?.trim()}
                                    className="px-3 py-1 text-xs bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    {savingItem ? 'Adding...' : 'Add Item'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Items List */}
                            {!cat.ChatbotItems || cat.ChatbotItems.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-3">
                                No brands or services added yet under this category.
                              </p>
                            ) : (
                              <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                                {cat.ChatbotItems.map((item) => {
                                  const mappedPdf = item.PdfDocuments && item.PdfDocuments.length > 0 ? item.PdfDocuments[0] : null;
                                  return (
                                    <div
                                      key={item.id}
                                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50/50 dark:hover:bg-gray-900/20 text-xs"
                                    >
                                      <div className="flex items-center space-x-2.5">
                                        <span className="text-[11px] font-bold text-gray-400 w-5 text-center">
                                          #{item.display_order}
                                        </span>
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                          {item.name}
                                        </span>
                                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                          {item.type}
                                        </span>
                                      </div>

                                      <div className="flex items-center space-x-3">
                                        {/* PDF Dropdown Mapping */}
                                        <div className="flex items-center space-x-1">
                                          <FileText size={13} className="text-gray-400" />
                                          <select
                                            value={mappedPdf?.id || ''}
                                            onChange={(e) => handleMapItemPdf(item.id, e.target.value)}
                                            className="text-[11px] py-1 px-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 max-w-[170px] truncate"
                                          >
                                            <option value="">No PDF</option>
                                            {pdfs.map((p) => (
                                              <option key={p.id} value={p.id}>
                                                {p.file_name}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Status Toggle */}
                                        <button
                                          type="button"
                                          onClick={() => handleToggleItemStatus(item)}
                                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                                            item.status === 'active'
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400'
                                              : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400'
                                          }`}
                                        >
                                          {item.status === 'active' ? 'Active' : 'Inactive'}
                                        </button>

                                        {/* Delete Item */}
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteItem(item.id)}
                                          className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                          title="Delete Item"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Knowledge Base (FAQs) */}
            <div className="pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Knowledge Base (FAQs)</h3>
                <button
                  type="button"
                  onClick={addFaq}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                >
                  <PlusCircle className="mr-1 h-4 w-4" /> Add FAQ
                </button>
              </div>

              <div className="space-y-4">
                {!formData.faqs || formData.faqs.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">No FAQs added yet. Add simple questions and answers directly.</p>
                ) : (
                  formData.faqs.map((faq, index) => (
                    <div key={index} className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 relative group">
                      <div className="flex-1 space-y-4">
                        <input
                          type="text"
                          placeholder="Question (e.g. What are your hours?)"
                          value={faq.question || ''}
                          onChange={(e) => updateFaq(index, 'question', e.target.value)}
                          className="block px-3 py-2 w-full sm:text-sm border-gray-300 dark:border-gray-600 border dark:bg-gray-700 dark:text-white rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <textarea
                          placeholder="Answer (e.g. We are open from 9am to 5pm, Monday to Friday.)"
                          value={faq.answer || ''}
                          rows={2}
                          onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                          className="block px-3 py-2 w-full sm:text-sm border-gray-300 dark:border-gray-600 border dark:bg-gray-700 dark:text-white rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFaq(index)}
                        className="text-gray-400 hover:text-red-500 self-start p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
