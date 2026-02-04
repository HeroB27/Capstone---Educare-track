/**
 * Educare Track Premium UI Module
 * Premium UI components for world-class SaaS experience
 */

// Utility functions
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

// Skeleton loader factory
export const Skeleton = {
  text: function(lines, width) {
    lines = lines || 3;
    var container = document.createElement('div');
    container.className = 'skeleton-container';
    container.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    for (var i = 0; i < lines; i++) {
      var line = document.createElement('div');
      line.className = 'skeleton-line';
      line.style.cssText = 'height: 16px; border-radius: 4px; background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;';
      if (i === lines - 1 && width && width !== 'full') line.style.width = width;
      container.appendChild(line);
    }
    return container;
  },
  
  title: function(width) {
    var el = document.createElement('div');
    el.className = 'skeleton-title';
    el.style.cssText = 'height: 24px; border-radius: 4px; width: ' + (width || '60%') + '; margin-bottom: 12px; background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;';
    return el;
  },
  
  avatar: function(size) {
    var el = document.createElement('div');
    el.className = 'skeleton-avatar';
    el.style.cssText = 'width: ' + (size || 40) + 'px; height: ' + (size || 40) + 'px; border-radius: 50%; background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;';
    return el;
  },
  
  card: function() {
    var card = document.createElement('div');
    card.className = 'skeleton-card';
    card.style.cssText = 'background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);';
    card.appendChild(this.title('70%'));
    card.appendChild(this.text(2, '90%'));
    card.appendChild(this.text(1, '50%'));
    return card;
  },
  
  chart: function(height) {
    var container = document.createElement('div');
    container.className = 'skeleton-chart';
    container.style.cssText = 'height: ' + (height || '200px') + '; border-radius: 12px; background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite;';
    return container;
  },
  
  kpiCard: function() {
    var card = document.createElement('div');
    card.className = 'skeleton-kpi';
    card.style.cssText = 'background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%); border-radius: 24px; padding: 24px; color: white; position: relative; overflow: hidden;';
    card.innerHTML = '<div style="display: flex; justify-content: space-between; margin-bottom: 16px;"><div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(255,255,255,0.2);"></div><div style="width: 60px; height: 24px; border-radius: 9999px; background: rgba(255,255,255,0.2);"></div></div><div style="width: 120px; height: 14px; border-radius: 4px; background: rgba(255,255,255,0.3); margin-bottom: 8px;"></div><div style="width: 80px; height: 36px; border-radius: 4px; background: rgba(255,255,255,0.4); font-size: 32px; font-weight: bold;"></div><div style="margin-top: 16px;"><div style="width: 100%; height: 4px; border-radius: 9999px; background: rgba(255,255,255,0.2); overflow: hidden;"><div style="width: 50%; height: 100%; border-radius: 9999px; background: rgba(255,255,255,0.3);"></div></div></div>';
    return card;
  },
  
  grid: function(count, type) {
    count = count || 4;
    var grid = document.createElement('div');
    grid.className = 'skeleton-grid';
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px;';
    for (var i = 0; i < count; i++) {
      var item = document.createElement('div');
      item.style.cssText = 'animation: fadeInUp 0.5s ease-out; animation-delay: ' + (i * 0.1) + 's; opacity: 0; animation-fill-mode: forwards;';
      type = type || 'card';
      if (type === 'card') item.appendChild(this.card());
      else if (type === 'kpi') item.appendChild(this.kpiCard());
      else if (type === 'chart') item.appendChild(this.chart('250px'));
      grid.appendChild(item);
    }
    return grid;
  }
};

// Toast notification system
export const Toast = {
  container: null,
  
  init: function() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.style.cssText = 'position: fixed; top: 16px; right: 16px; z-index: 9999; display: flex; flex-direction: column; gap: 12px; pointer-events: none;';
      document.body.appendChild(this.container);
    }
    return this.container;
  },
  
  show: function(message, type, duration) {
    type = type || 'info';
    duration = duration || 5000;
    var colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#0ea5e9' };
    var container = this.init();
    var toast = document.createElement('div');
    toast.style.cssText = 'display: flex; align-items: flex-start; gap: 12px; padding: 16px 20px; background: white; border-radius: 16px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1); border-left: 4px solid ' + colors[type] + '; pointer-events: auto; max-width: 400px; animation: slideInRight 0.3s ease-out;';
    toast.innerHTML = '<div style="flex-shrink: 0; margin-top: 2px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + colors[type] + '" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div><div style="flex: 1;"><p style="font-size: 14px; color: #1e293b; line-height: 1.5;">' + message + '</p></div><button style="background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px; color: #94a3b8;" onclick="this.parentElement.remove()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    container.appendChild(toast);
    if (duration > 0) {
      setTimeout(function() { toast.style.animation = 'fadeOut 0.3s ease-out forwards'; setTimeout(function() { toast.remove(); }, 300); }, duration);
    }
    return toast;
  },
  
  success: function(m, d) { return this.show(m, 'success', d); },
  error: function(m, d) { return this.show(m, 'error', d); },
  warning: function(m, d) { return this.show(m, 'warning', d); },
  info: function(m, d) { return this.show(m, 'info', d); }
};

// Command palette
export const CommandPalette = {
  isOpen: false,
  dialog: null,
  input: null,
  results: null,
  actions: [],
  
  init: function(actions) {
    this.actions = actions || [];
    this.createDialog();
    this.bindKeyboard();
  },
  
  createDialog: function() {
    if (this.dialog) return;
    this.dialog = document.createElement('div');
    this.dialog.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); z-index: 9998; display: none; align-items: flex-start; justify-content: center; padding-top: 10vh;';
    this.dialog.innerHTML = '<div style="width: 100%; max-width: 640px; background: white; border-radius: 16px; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25); overflow: hidden;"><div style="display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid #e2e8f0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input type="text" class="command-input" placeholder="Type a command or search..." style="flex: 1; border: none; outline: none; font-size: 16px; color: #1e293b; background: transparent;" /><kbd style="padding: 4px 8px; background: #f1f5f9; border-radius: 6px; font-size: 12px; color: #64748b;">ESC</kbd></div><div class="command-results" style="max-height: 400px; overflow-y: auto; padding: 8px;"></div><div style="padding: 12px 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; display: flex; gap: 16px;"><span>Navigate with arrow keys</span><span>Press Enter to select</span></div></div>';
    this.input = this.dialog.querySelector('.command-input');
    this.results = this.dialog.querySelector('.command-results');
    document.body.appendChild(this.dialog);
  },
  
  bindKeyboard: function() {
    var self = this;
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); self.toggle(); }
      if (e.key === 'Escape' && self.isOpen) self.close();
    });
    if (this.input) { this.input.addEventListener('input', function(e) { self.filter(e.target.value); }); }
  },
  
  toggle: function() { this.isOpen ? this.close() : this.open(); },
  
  open: function() {
    if (!this.dialog) this.createDialog();
    this.isOpen = true;
    this.dialog.style.display = 'flex';
    this.input.value = '';
    this.renderResults(this.actions);
    this.input.focus();
    document.body.style.overflow = 'hidden';
  },
  
  close: function() {
    this.isOpen = false;
    this.dialog.style.display = 'none';
    document.body.style.overflow = '';
  },
  
  filter: function(query) {
    var q = query.toLowerCase().trim();
    if (!q) { this.renderResults(this.actions); return; }
    var filtered = this.actions.filter(function(a) { return a.label.toLowerCase().includes(q) || (a.category && a.category.toLowerCase().includes(q)); });
    this.renderResults(filtered);
  },
  
  renderResults: function(items) {
    var self = this;
    if (!items.length) { this.results.innerHTML = '<div style="padding: 32px; text-align: center; color: #94a3b8;">No results found</div>'; return; }
    var grouped = {};
    items.forEach(function(item) { var cat = item.category || 'Actions'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(item); });
    var html = '';
    for (var cat in grouped) {
      html += '<div style="padding: 8px 12px; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">' + cat + '</div>';
      grouped[cat].forEach(function(item) {
        html += '<div class="command-item" data-action="' + item.action + '" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background=\'#f1f5f9\'" onmouseout="this.style.background=\'transparent\'"><div style="width: 32px; height: 32px; border-radius: 8px; background: #f1f5f9; display: flex; align-items: center; justify-content: center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg></div><div style="flex: 1;"><div style="font-size: 14px; color: #1e293b; font-weight: 500;">' + item.label + '</div></div>' + (item.shortcut ? '<kbd style="padding: 4px 8px; background: #f1f5f9; border-radius: 6px; font-size: 12px; color: #64748b;">' + item.shortcut + '</kbd>' : '') + '</div>';
      });
    }
    this.results.innerHTML = html;
    this.results.querySelectorAll('.command-item').forEach(function(item) { item.addEventListener('click', function() { self.execute(item.dataset.action); }); });
  },
  
  execute: function(action) {
    var handler = this.actions.find(function(a) { return a.action === action; });
    if (handler && handler.execute) handler.execute();
    this.close();
  }
};

// Progressive loading
export async function progressiveLoad(container, skeletonFn, dataFetcher) {
  container.innerHTML = '';
  container.appendChild(skeletonFn());
  try {
    var data = await dataFetcher();
    container.innerHTML = '';
    return data;
  } catch (error) {
    container.innerHTML = '<div style="padding: 32px; text-align: center; color: #ef4444;">Failed to load content</div>';
    throw error;
  }
}

// Staggered list animation
export function staggeredList(container, items, renderFn) {
  container.innerHTML = '';
  items.forEach(function(item, index) {
    var el = renderFn(item, index);
    el.style.cssText = 'animation: fadeInUp 0.4s ease-out; animation-delay: ' + (index * 0.05) + 's; opacity: 0; animation-fill-mode: forwards;';
    container.appendChild(el);
  });
}

export default {
  escapeHtml: escapeHtml,
  generateId: generateId,
  Skeleton: Skeleton,
  Toast: Toast,
  CommandPalette: CommandPalette,
  progressiveLoad: progressiveLoad,
  staggeredList: staggeredList
};
