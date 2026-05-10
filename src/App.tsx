import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Mail, 
  Clock, 
  Layout, 
  Send, 
  Plus, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Pause,
  BarChart3,
  Calendar,
  Settings,
  Activity,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './lib/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

// --- Components ---

const Card = ({ children, title, icon: Icon, className = "" }: any) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    {title && (
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-slate-500" />}
          <h2 className="font-semibold text-slate-800">{title}</h2>
        </div>
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

const StatCard = ({ label, value, icon: Icon, colorClass }: any) => (
  <motion.div 
    whileHover={{ y: -2 }}
    className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4"
  >
    <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
      <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </motion.div>
);

const Button = ({ children, onClick, variant = 'primary', icon: Icon, iconClassName = "", size = 'md', className = "", disabled = false, type = 'button' }: any) => {
  const base = "inline-flex items-center justify-center gap-2 font-medium transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    outline: "border border-slate-200 text-slate-600 hover:bg-slate-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };
  const sizes: any = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {Icon && <Icon className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${iconClassName}`} />}
      {children}
    </button>
  );
};

// --- App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>({ sent: 0, failed: 0, pending: 0, total_contacts: 0 });
  const [contacts, setContacts] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Form states
  const [showAddContact, setShowAddContact] = useState(false);
  const [showEditContact, setShowEditContact] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  
  const [newContact, setNewContact] = useState({ name: '', email: '' });
  const [editingContact, setEditingContact] = useState<any>(null);
  const [newTemplate, setNewTemplate] = useState({ name: '', subject: '', body_md: '' });
  const [newCampaign, setNewCampaign] = useState({ name: '', template_id: '', sender_name: 'Ayan', sender_email: 'ayan@example.com' });
  const [newReminder, setNewReminder] = useState({ 
    title: '', 
    contact_id: '', 
    campaign_id: '', 
    start_at_utc: new Date().toISOString().slice(0, 16),
    rrule: '' 
  });

  const [config, setConfig] = useState<any>({ dry_run: true, smtp_user: '', smtp_host: '' });
  const [logs, setLogs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchData = async (isInitial = false) => {
    if (!isInitial) setSyncing(true);
    try {
      if (isInitial) {
        const [data, conf, l] = await Promise.all([
          api.getInitData(),
          api.getConfig(),
          api.getLogs()
        ]);
        setStats(data.stats || { sent: 0, failed: 0, pending: 0, total_contacts: 0 });
        setContacts(data.contacts || []);
        setReminders(data.reminders || []);
        setMessages(data.messages || []);
        setConfig(conf);
        setLogs(l);
        
        const [cams, tmpls] = await Promise.all([
          api.getCampaigns(),
          api.getTemplates()
        ]);
        setCampaigns(cams || []);
        setTemplates(tmpls || []);

        setLoading(false);
      } else {
        const [data, l] = await Promise.all([api.sync(), api.getLogs()]);
        if (data && data.stats) {
          setStats(data.stats);
          setContacts(data.contacts || []);
          setReminders(data.reminders || []);
          setMessages(data.messages || []);
        }
        setLogs(l);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
      if (isInitial) setLoading(false);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    // Safety timeout to ensure loading screen eventually disappears
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    fetchData(true);
    const interval = setInterval(() => fetchData(false), 30000); 
    return () => {
      clearInterval(interval);
      clearTimeout(safetyTimeout);
    };
  }, []);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createContact(newContact);
    setNewContact({ name: '', email: '' });
    setShowAddContact(false);
    await fetchData();
  };

  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    await api.updateContact(editingContact.id, editingContact);
    setEditingContact(null);
    setShowEditContact(false);
    await fetchData();
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createReminder({
      ...newReminder,
      start_at_utc: new Date(newReminder.start_at_utc).toISOString()
    });
    setNewReminder({ 
      title: '', 
      contact_id: '', 
      campaign_id: '', 
      start_at_utc: new Date().toISOString().slice(0, 16),
      rrule: '' 
    });
    setShowAddReminder(false);
    await fetchData();
  };

  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createTemplate(newTemplate);
    setNewTemplate({ name: '', subject: '', body_md: '' });
    setShowAddTemplate(false);
    await fetchData();
  };

  const handleAddCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createCampaign(newCampaign);
    setNewCampaign({ name: '', template_id: '', sender_name: 'Ayan', sender_email: 'ayan@example.com' });
    setShowAddCampaign(false);
    await fetchData();
  };

  const handleToggleReminder = async (id: string) => {
    await api.toggleReminder(id);
    await fetchData();
  };

  const handleToggleDryRun = async () => {
    const res = await api.toggleDryRun();
    setConfig({ ...config, dry_run: res.dry_run });
    fetchData();
  };

  const handleCsvUpload = async (type: 'contacts' | 'reminders', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadCSV(type, file);
      alert(`Imported ${res.count} ${type}`);
      fetchData();
    } catch (err) {
      alert("Import failed");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'templates', label: 'Templates', icon: Mail },
    { id: 'campaigns', label: 'Campaigns', icon: Layout },
    { id: 'reminders', label: 'Reminders', icon: Clock },
    { id: 'system', label: 'System', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans uppercase-none">
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center"
          >
            <motion.div
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                scale: { duration: 1, repeat: Infinity }
              }}
              className="text-blue-600 mb-4"
            >
              <Send className="w-12 h-12" />
            </motion.div>
            <h2 className="text-xl font-bold text-slate-800">Initializing Remindly...</h2>
            <p className="text-slate-500 text-sm mt-2">Setting up your automation engine</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar / Header */}
      <header className="bg-white border-b border-slate-200 fixed top-0 w-full z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600">
            <Send className="w-6 h-6" />
            <span className="font-bold text-xl tracking-tight text-slate-900">Remindly</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <Button 
            variant="outline" 
            icon={RefreshCw} 
            onClick={() => fetchData(false)} 
            size="sm"
            iconClassName={syncing ? "animate-spin" : ""}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
        </div>
      </header>

      <main className="mt-16 p-4 md:p-8 max-w-7xl mx-auto w-full flex-grow">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Emails Sent" value={stats.sent || 0} icon={CheckCircle2} colorClass="bg-emerald-500" />
                <StatCard label="Pending" value={stats.pending || 0} icon={Clock} colorClass="bg-blue-500" />
                <StatCard label="Failed" value={stats.failed || 0} icon={AlertCircle} colorClass="bg-red-500" />
                <StatCard label="Total Contacts" value={stats.total_contacts || 0} icon={Users} colorClass="bg-indigo-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Quick Actions" icon={Plus}>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="secondary" icon={Users} onClick={() => setActiveTab('contacts')}>Add Contact</Button>
                    <Button variant="secondary" icon={Clock} onClick={() => setActiveTab('reminders')}>New Reminder</Button>
                    <Button 
                      variant="secondary" 
                      icon={Mail} 
                      onClick={() => {
                        setNewTemplate({
                          name: 'Welcome Template',
                          subject: 'Welcome to our platform, {{name}}!',
                          body_md: 'Hi {{name}},\n\nWelcome! We are excited to have you on board.'
                        });
                        setActiveTab('templates');
                        setShowAddTemplate(true);
                      }}
                    >
                      Welcome Template
                    </Button>
                    <Button 
                      variant="secondary" 
                      icon={Layout} 
                      onClick={() => {
                        setNewCampaign({
                          name: 'Welcome Campaign',
                          template_id: templates[0]?.id || '',
                          sender_name: 'Ayan',
                          sender_email: 'ayan@example.com'
                        });
                        setActiveTab('campaigns');
                        setShowAddCampaign(true);
                      }}
                    >
                      Welcome Campaign
                    </Button>
                  </div>
                </Card>

                <Card title="Email Performance" icon={Activity}>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Sent', value: stats.sent || 0, color: '#10b981' },
                        { name: 'Pending', value: stats.pending || 0, color: '#3b82f6' },
                        { name: 'Failed', value: stats.failed || 0, color: '#ef4444' },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {[0, 1, 2].map(( entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#10b981', '#3b82f6', '#ef4444'][index]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card title="Recent Activity" icon={History} className="lg:col-span-2">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <p className="text-center py-8 text-slate-400 text-sm">No recent activity detected.</p>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {messages.slice(0, 8).map(m => (
                          <div key={m.id} className="py-3 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${
                                m.status === 'sent' ? 'bg-emerald-50' : 
                                m.status === 'failed' ? 'bg-red-50' : 'bg-blue-50'
                              }`}>
                                {m.status === 'sent' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                                 m.status === 'failed' ? <AlertCircle className="w-4 h-4 text-red-500" /> : <Clock className="w-4 h-4 text-blue-500" />}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-700">{m.subject}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">To: {m.contact_name} • {m.campaign_name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium text-slate-600">
                                {new Date(m.sent_at_utc || m.scheduled_at_utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {new Date(m.sent_at_utc || m.scheduled_at_utc).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'contacts' && (
            <motion.div 
              key="contacts"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
                  <p className="text-slate-500 text-sm">Manage your notification recipients</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Button variant="outline" icon={Plus} disabled={uploading}>Import CSV</Button>
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={(e) => handleCsvUpload('contacts', e)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <Button icon={Plus} onClick={() => setShowAddContact(true)}>Add New</Button>
                </div>
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-100">
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Timezone</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {contacts.map(c => (
                        <tr key={c.id} className="text-sm hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-4 font-medium text-slate-900">{c.name}</td>
                          <td className="px-4 py-4 text-slate-500">{c.email}</td>
                          <td className="px-4 py-4"><span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">{c.timezone}</span></td>
                          <td className="px-4 py-4 text-right">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setEditingContact(c);
                                setShowEditContact(true);
                              }}
                            >
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {showAddContact && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="font-bold text-slate-900">New Contact</h2>
                      <button onClick={() => setShowAddContact(false)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    <form onSubmit={handleAddContact} className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                        <input 
                          type="text" 
                          required 
                          value={newContact.name}
                          onChange={e => setNewContact({...newContact, name: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                        <input 
                          type="email" 
                          required 
                          value={newContact.email}
                          onChange={e => setNewContact({...newContact, email: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="pt-4 flex gap-3">
                        <Button variant="outline" className="w-full" onClick={() => setShowAddContact(false)}>Cancel</Button>
                        <Button type="submit" className="w-full">Create</Button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {showEditContact && editingContact && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="font-bold text-slate-900">Edit Contact</h2>
                      <button onClick={() => setShowEditContact(false)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    <form onSubmit={handleEditContact} className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                        <input 
                          type="text" 
                          required 
                          value={editingContact.name}
                          onChange={e => setEditingContact({...editingContact, name: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                        <input 
                          type="email" 
                          required 
                          value={editingContact.email}
                          onChange={e => setEditingContact({...editingContact, email: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div className="pt-4 flex gap-3">
                        <Button variant="outline" className="w-full" onClick={() => setShowEditContact(false)}>Cancel</Button>
                        <Button type="submit" className="w-full">Update</Button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'templates' && (
            <motion.div 
              key="templates"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Email Templates</h1>
                  <p className="text-slate-500 text-sm">Reusable content for your campaigns</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" icon={Mail} onClick={() => {
                    setNewTemplate({
                      name: 'Welcome Template',
                      subject: 'Welcome to our platform, {{name}}!',
                      body_md: 'Hi {{name}},\n\nWelcome! We are excited to have you on board.'
                    });
                    setShowAddTemplate(true);
                  }}>Welcome Template</Button>
                  <Button icon={Plus} onClick={() => setShowAddTemplate(true)}>New Template</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {templates.map(t => (
                  <Card key={t.id} title={t.name} icon={Mail}>
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Subject</span>
                        <p className="text-sm text-slate-700 font-medium">{t.subject}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block mb-1">Body Preview</span>
                        <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed whitespace-pre-wrap">{t.body_md}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {showAddTemplate && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="font-bold text-slate-900">New Template</h2>
                      <button onClick={() => setShowAddTemplate(false)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    <form onSubmit={handleAddTemplate} className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Name</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="e.g. Onboarding Welcome"
                          value={newTemplate.name}
                          onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Subject Line</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="Hi {{name}}, welcome!"
                          value={newTemplate.subject}
                          onChange={e => setNewTemplate({...newTemplate, subject: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Body (Markdown or HTML)</label>
                        <textarea 
                          required 
                          rows={6}
                          placeholder="Welcome to our service..."
                          value={newTemplate.body_md}
                          onChange={e => setNewTemplate({...newTemplate, body_md: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono text-sm"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Use {"{{name}}"} for personalization.</p>
                      </div>
                      <div className="pt-4 flex gap-3">
                        <Button variant="outline" className="w-full" onClick={() => setShowAddTemplate(false)}>Cancel</Button>
                        <Button type="submit" className="w-full">Save Template</Button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'campaigns' && (
            <motion.div 
              key="campaigns"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
                  <p className="text-slate-500 text-sm">Manage your email sequences and settings</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" icon={Layout} onClick={() => {
                    setNewCampaign({
                      name: 'Welcome Campaign',
                      template_id: templates[0]?.id || '',
                      sender_name: 'Ayan',
                      sender_email: 'ayan@example.com'
                    });
                    setShowAddCampaign(true);
                  }}>Welcome Campaign</Button>
                  <Button icon={Plus} onClick={() => setShowAddCampaign(true)}>New Campaign</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map(c => (
                  <Card key={c.id} title={c.name} icon={Layout}>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-slate-400">Sender</span>
                        <span className="font-medium text-slate-700">{c.sender_name}</span>
                      </div>
                      <div className="flex justify-between text-xs items-center">
                        <span className="text-slate-400">Email</span>
                        <span className="font-medium text-slate-700">{c.sender_email}</span>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Template</div>
                        <div className="text-xs font-bold text-blue-600 truncate max-w-[150px]">
                          {templates.find(t => t.id === c.template_id)?.name || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {showAddCampaign && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="font-bold text-slate-900">New Campaign</h2>
                      <button onClick={() => setShowAddCampaign(false)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    <form onSubmit={handleAddCampaign} className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Campaign Name</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="e.g. Monthly Newsletter"
                          value={newCampaign.name}
                          onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Base Template</label>
                        <select 
                          required 
                          value={newCampaign.template_id}
                          onChange={e => setNewCampaign({...newCampaign, template_id: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="">Select Template</option>
                          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sender Name</label>
                          <input 
                            type="text" 
                            required 
                            value={newCampaign.sender_name}
                            onChange={e => setNewCampaign({...newCampaign, sender_name: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sender Email</label>
                          <input 
                            type="email" 
                            required 
                            value={newCampaign.sender_email}
                            onChange={e => setNewCampaign({...newCampaign, sender_email: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                      <div className="pt-4 flex gap-3">
                        <Button variant="outline" className="w-full" onClick={() => setShowAddCampaign(false)}>Cancel</Button>
                        <Button type="submit" className="w-full">Create Campaign</Button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'reminders' && (
            <motion.div 
              key="reminders" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Reminders</h1>
                  <p className="text-slate-500 text-sm">Active notifications and firing schedules</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Button variant="outline" icon={Plus} disabled={uploading}>Import CSV</Button>
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={(e) => handleCsvUpload('reminders', e)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <Button icon={Calendar} onClick={() => setShowAddReminder(true)}>Add Reminder</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reminders.map(r => (
                  <Card key={r.id} className={`relative group ${!r.active ? 'opacity-60 grayscale' : ''}`}>
                    <div className="absolute top-4 right-4 group-hover:block hidden">
                      <Button 
                        variant={r.active ? "danger" : "primary"} 
                        size="sm" 
                        icon={r.active ? Pause : Send}
                        onClick={() => handleToggleReminder(r.id)}
                      >
                        {r.active ? 'Stop' : 'Start'}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <div className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] uppercase font-bold rounded inline-block">
                        {r.campaign_name}
                      </div>
                      <h3 className="font-bold text-slate-900 line-clamp-1">{r.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Users className="w-3 h-3" />
                        <span>Recipient: {r.contact_name}</span>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Next Run</div>
                        <div className="text-xs font-bold text-slate-700">
                          {r.start_at_utc ? new Date(r.start_at_utc).toLocaleDateString() : 'Manual'}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {showAddReminder && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <h2 className="font-bold text-slate-900">New Reminder</h2>
                      <button onClick={() => setShowAddReminder(false)} className="text-slate-400 hover:text-slate-600">×</button>
                    </div>
                    <form onSubmit={handleAddReminder} className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Title</label>
                        <input 
                          type="text" 
                          required 
                          value={newReminder.title}
                          onChange={e => setNewReminder({...newReminder, title: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="e.g. Weekly Follow-up"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Contact</label>
                          <select 
                            required 
                            value={newReminder.contact_id}
                            onChange={e => setNewReminder({...newReminder, contact_id: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="">Select Contact</option>
                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Campaign</label>
                          <select 
                            required 
                            value={newReminder.campaign_id}
                            onChange={e => setNewReminder({...newReminder, campaign_id: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="">Select Campaign</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Start Time (UTC)</label>
                        <input 
                          type="datetime-local" 
                          required 
                          value={newReminder.start_at_utc}
                          onChange={e => setNewReminder({...newReminder, start_at_utc: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Recurrence Rule (Optional)</label>
                        <input 
                          type="text" 
                          value={newReminder.rrule}
                          onChange={e => setNewReminder({...newReminder, rrule: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="e.g. FREQ=WEEKLY;BYDAY=MO"
                        />
                      </div>
                      <div className="pt-4 flex gap-3">
                        <Button variant="outline" className="w-full" onClick={() => setShowAddReminder(false)}>Cancel</Button>
                        <Button type="submit" className="w-full">Schedule</Button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'messages' && (
            <motion.div 
              key="messages" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
               <div>
                  <h1 className="text-2xl font-bold text-slate-900">Delivery Logs</h1>
                  <p className="text-slate-500 text-sm">Audit trail of all sent and scheduled emails</p>
                </div>

                <Card>
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-400 text-xs uppercase border-b border-slate-100">
                        <th className="px-4 py-3 font-semibold">Subject</th>
                        <th className="px-4 py-3 font-semibold">Recipient</th>
                        <th className="px-4 py-3 font-semibold text-center">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">Scheduled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {messages.map(m => (
                        <tr key={m.id} className="text-sm hover:bg-slate-50/50">
                          <td className="px-4 py-4 font-medium text-slate-900">{m.subject}</td>
                          <td className="px-4 py-4 text-slate-500">{m.contact_name}</td>
                          <td className="px-4 py-4">
                            <div className="flex justify-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                m.status === 'sent' ? 'bg-emerald-50 text-emerald-600' : 
                                m.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {m.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-slate-400 text-xs">
                            {new Date(m.scheduled_at_utc).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
            </motion.div>
          )}
          {activeTab === 'system' && (
            <motion.div 
              key="system" 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
                <p className="text-slate-500 text-sm">Configure worker and automation engine</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Automation Engine" icon={Settings} className="lg:col-span-2">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">Dry Run Mode</p>
                        <p className="text-sm text-slate-500">When enabled, no real emails are sent via SMTP.</p>
                      </div>
                      <button 
                        onClick={handleToggleDryRun}
                        className={`w-12 h-6 rounded-full transition-colors relative ${config.dry_run ? 'bg-blue-600' : 'bg-slate-300'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.dry_run ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Worker Status</span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          Running (Python)
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">SMTP Host</span>
                        <span className="text-slate-700 font-medium">{config.smtp_host}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">SMTP Identity</span>
                        <span className="text-slate-700 font-medium">{config.smtp_user}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Export Reports</p>
                      <div className="flex flex-wrap gap-2">
                        {logs.map(log => (
                          <a 
                            key={log}
                            href={`/api/logs/${log}`}
                            download
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Calendar className="w-3 h-3" />
                            {log}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>

                <Card title="Quick Docs" icon={Activity}>
                  <div className="space-y-3 text-sm text-slate-600">
                    <p>To use real SMTP:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Set <code className="bg-slate-100 px-1 rounded text-blue-600">DRY_RUN=false</code></li>
                      <li>Configure <code className="bg-slate-100 px-1 rounded text-blue-600">SMTP_USER</code> and <code className="bg-slate-100 px-1 rounded text-blue-600">SMTP_PASS</code></li>
                      <li>Update <code className="bg-slate-100 px-1 rounded text-blue-600">SMTP_HOST</code> for Gmail or Outlook</li>
                    </ol>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">CSV Formats</p>
                      <p className="text-[10px] text-slate-500"><span className="font-bold">Contacts:</span> name, email, timezone</p>
                      <p className="text-[10px] text-slate-500 mt-1"><span className="font-bold">Reminders:</span> title, contact_id, campaign_id, date, time</p>
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-8 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-sm">
          <p>© 2026 Remindly Email Automation. Built for Ayan.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Mode: Simulated</span>
            <span className="flex items-center gap-1 text-emerald-500 font-medium whitespace-nowrap"><CheckCircle2 className="w-4 h-4" /> System Online</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
