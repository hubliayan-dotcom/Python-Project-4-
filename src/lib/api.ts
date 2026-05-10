const API_URL = '/api';

export const api = {
  async getContacts() {
    const res = await fetch(`${API_URL}/contacts`);
    return res.json();
  },
  async createContact(data: { name: string; email: string; timezone?: string }) {
    const res = await fetch(`${API_URL}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async updateContact(id: string, data: { name: string; email: string; timezone?: string }) {
    const res = await fetch(`${API_URL}/contacts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async getTemplates() {
    const res = await fetch(`${API_URL}/templates`);
    return res.json();
  },
  async createTemplate(data: { name: string; subject: string; body_md: string }) {
    const res = await fetch(`${API_URL}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async getCampaigns() {
    const res = await fetch(`${API_URL}/campaigns`);
    return res.json();
  },
  async createCampaign(data: { name: string; template_id: string; sender_name: string; sender_email: string }) {
    const res = await fetch(`${API_URL}/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async getReminders() {
    const res = await fetch(`${API_URL}/reminders`);
    return res.json();
  },
  async createReminder(data: { title: string; contact_id: string; campaign_id: string; start_at_utc: string; rrule?: string }) {
    const res = await fetch(`${API_URL}/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async toggleReminder(id: string) {
    const res = await fetch(`${API_URL}/reminders/${id}/toggle`, {
      method: 'PATCH',
    });
    return res.json();
  },
  async getMessages() {
    const res = await fetch(`${API_URL}/messages`);
    return res.json();
  },
  async getStats() {
    const res = await fetch(`${API_URL}/stats`);
    return res.json();
  },
  async sync() {
    const res = await fetch(`${API_URL}/sync`, { method: 'POST' });
    return res.json();
  },
  async getInitData() {
    const res = await fetch(`${API_URL}/init`);
    return res.json();
  },
  async getConfig() {
    const res = await fetch(`${API_URL}/config`);
    return res.json();
  },
  async toggleDryRun() {
    const res = await fetch(`${API_URL}/config/toggle-dry-run`, { method: 'POST' });
    return res.json();
  },
  async getLogs() {
    const res = await fetch(`${API_URL}/logs`);
    return res.json();
  },
  async uploadCSV(type: 'contacts' | 'reminders', file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/upload/${type}`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  }
};
