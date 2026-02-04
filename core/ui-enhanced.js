/* Enhanced UI Components for Educare Track */

// Enhanced UI component library with modern design patterns
export class EnhancedUI {
  
  // Create a modern card component
  static createCard({ title, subtitle, content, actions, variant = 'default', icon } = {}) {
    const card = document.createElement('div');
    card.className = `card ${variant !== 'default' ? 'card-' + variant : ''}`;
    
    if (title || subtitle || icon) {
      const header = document.createElement('div');
      header.className = 'card-header';
      
      if (icon) {
        const iconEl = document.createElement('div');
        iconEl.className = 'card-icon';
        iconEl.innerHTML = icon;
        header.appendChild(iconEl);
      }
      
      const titleGroup = document.createElement('div');
      if (title) {
        const titleEl = document.createElement('h3');
        titleEl.className = 'card-title';
        titleEl.textContent = title;
        titleGroup.appendChild(titleEl);
      }
      
      if (subtitle) {
        const subtitleEl = document.createElement('p');
        subtitleEl.className = 'card-subtitle';
        subtitleEl.textContent = subtitle;
        titleGroup.appendChild(subtitleEl);
      }
      
      header.appendChild(titleGroup);
      card.appendChild(header);
    }
    
    if (content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'card-content';
      if (typeof content === 'string') {
        contentEl.innerHTML = content;
      } else {
        contentEl.appendChild(content);
      }
      card.appendChild(contentEl);
    }
    
    if (actions && actions.length > 0) {
      const actionsEl = document.createElement('div');
      actionsEl.className = 'card-actions';
      actions.forEach(action => {
        actionsEl.appendChild(action);
      });
      card.appendChild(actionsEl);
    }
    
    return card;
  }
  
  // Create a modern button with icons
  static createButton({ 
    text, 
    variant = 'primary', 
    size = 'medium', 
    icon, 
    onClick, 
    disabled = false 
  } = {}) {
    const button = document.createElement('button');
    button.className = `btn btn-${variant} btn-${size}`;
    button.disabled = disabled;
    
    if (icon) {
      const iconEl = document.createElement('span');
      iconEl.className = 'btn-icon';
      iconEl.innerHTML = icon;
      button.appendChild(iconEl);
    }
    
    if (text) {
      const textEl = document.createElement('span');
      textEl.className = 'btn-text';
      textEl.textContent = text;
      button.appendChild(textEl);
    }
    
    if (onClick) {
      button.addEventListener('click', onClick);
    }
    
    return button;
  }
  
  // Create a modern navigation item
  static createNavItem({ 
    text, 
    href, 
    icon, 
    active = false, 
    onClick 
  } = {}) {
    const link = document.createElement('a');
    link.className = `nav-item ${active ? 'active' : ''}`;
    link.href = href || '#';
    
    if (icon) {
      const iconEl = document.createElement('span');
      iconEl.className = 'nav-icon';
      iconEl.innerHTML = icon;
      link.appendChild(iconEl);
    }
    
    const textEl = document.createElement('span');
    textEl.className = 'nav-text';
    textEl.textContent = text;
    link.appendChild(textEl);
    
    if (onClick) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        onClick();
      });
    }
    
    return link;
  }
  
  // Create a modern data table
  static createDataTable({ 
    columns, 
    data, 
    emptyMessage = 'No data available',
    onRowClick 
  } = {}) {
    const table = document.createElement('div');
    table.className = 'data-table';
    
    if (!data || data.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'table-empty';
      emptyState.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--secondary-500);">
          <svg style="width: 3rem; height: 3rem; margin-bottom: 1rem; opacity: 0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-16"></path>
          </svg>
          <p>${emptyMessage}</p>
        </div>
      `;
      table.appendChild(emptyState);
      return table;
    }
    
    const header = document.createElement('div');
    header.className = 'table-header';
    columns.forEach(col => {
      const cell = document.createElement('div');
      cell.className = 'table-header-cell';
      cell.textContent = col.header;
      if (col.width) {
        cell.style.flex = `0 0 ${col.width}`;
      }
      header.appendChild(cell);
    });
    table.appendChild(header);
    
    data.forEach((row, index) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'table-row';
      if (onRowClick) {
        rowEl.style.cursor = 'pointer';
        rowEl.addEventListener('click', () => onRowClick(row, index));
      }
      
      columns.forEach(col => {
        const cell = document.createElement('div');
        cell.className = 'table-cell';
        
        let content = row[col.key];
        if (col.render) {
          content = col.render(row[col.key], row, index);
        }
        
        if (typeof content === 'string') {
          cell.textContent = content;
        } else {
          cell.appendChild(content);
        }
        
        if (col.width) {
          cell.style.flex = `0 0 ${col.width}`;
        }
        
        rowEl.appendChild(cell);
      });
      
      table.appendChild(rowEl);
    });
    
    return table;
  }
  
  // Create a modern modal/dialog
  static createModal({ 
    title, 
    content, 
    actions, 
    onClose 
  } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
      background: white;
      border-radius: var(--radius-lg);
      padding: 0;
      max-width: 500px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      box-shadow: var(--shadow-xl);
    `;
    
    if (title) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      header.style.cssText = `
        padding: 1.5rem 1.5rem 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      `;
      
      const titleEl = document.createElement('h3');
      titleEl.className = 'modal-title';
      titleEl.textContent = title;
      titleEl.style.cssText = `
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--secondary-900);
      `;
      
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: var(--secondary-500);
        padding: 0;
        width: 2rem;
        height: 2rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius);
      `;
      closeBtn.addEventListener('click', () => {
        overlay.remove();
        if (onClose) onClose();
      });
      
      header.appendChild(titleEl);
      header.appendChild(closeBtn);
      modal.appendChild(header);
    }
    
    if (content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'modal-content';
      contentEl.style.cssText = `
        padding: 1.5rem;
        max-height: 60vh;
        overflow-y: auto;
      `;
      
      if (typeof content === 'string') {
        contentEl.innerHTML = content;
      } else {
        contentEl.appendChild(content);
      }
      
      modal.appendChild(contentEl);
    }
    
    if (actions && actions.length > 0) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      footer.style.cssText = `
        padding: 0 1.5rem 1.5rem;
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      `;
      
      actions.forEach(action => {
        footer.appendChild(action);
      });
      
      modal.appendChild(footer);
    }
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    return overlay;
  }
  
  // Create a loading spinner
  static createLoadingSpinner({ size = 'medium', variant = 'primary' } = {}) {
    const spinner = document.createElement('div');
    spinner.className = `loading-spinner spinner-${size} spinner-${variant}`;
    spinner.innerHTML = `
      <svg class="spinner" viewBox="0 0 50 50" style="width: 100%; height: 100%;">
        <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
      </svg>
    `;
    return spinner;
  }
  
  // Create a toast notification
  static showToast({ 
    message, 
    type = 'info', 
    duration = 3000 
  } = {}) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: white;
      border: 1px solid var(--secondary-200);
      border-radius: var(--radius);
      padding: 1rem 1.5rem;
      box-shadow: var(--shadow-lg);
      z-index: 1001;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      max-width: 350px;
      animation: slideInRight 0.3s ease-out;
    `;
    
    const iconMap = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    
    const icon = document.createElement('span');
    icon.style.cssText = `
      font-size: 1.25rem;
      color: var(--${type}-500);
    `;
    icon.textContent = iconMap[type] || 'ℹ';
    
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      flex: 1;
      color: var(--secondary-700);
      font-size: 0.875rem;
    `;
    
    toast.appendChild(icon);
    toast.appendChild(messageEl);
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
    
    return toast;
  }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .loading-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  
  .spinner {
    animation: rotate 2s linear infinite;
  }
  
  .spinner.path {
    stroke: currentColor;
    stroke-linecap: round;
    animation: dash 1.5s ease-in-out infinite;
  }
  
  @keyframes rotate {
    100% {
      transform: rotate(360deg);
    }
  }
  
  @keyframes dash {
    0% {
      stroke-dasharray: 1, 150;
      stroke-dashoffset: 0;
    }
    50% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -35;
    }
    100% {
      stroke-dasharray: 90, 150;
      stroke-dashoffset: -124;
    }
  }
  
  .data-table {
    background: white;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--secondary-200);
  }
  
  .table-header {
    display: flex;
    background: var(--secondary-50);
    border-bottom: 1px solid var(--secondary-200);
    font-weight: 600;
    color: var(--secondary-700);
  }
  
  .table-header-cell,
  .table-cell {
    padding: 1rem;
    flex: 1;
    min-width: 0;
  }
  
  .table-row {
    display: flex;
    border-bottom: 1px solid var(--secondary-100);
    transition: var(--transition);
  }
  
  .table-row:hover {
    background: var(--secondary-50);
  }
  
  .table-row:last-child {
    border-bottom: none;
  }
`;
document.head.appendChild(style);