/**
 * ==========================================================================
 * SIDEBAR COMPONENT LOADER & CONTROLLER (sidebar.js)
 * Tự động nạp components/sidebar.html vào #sidebar-container,
 * đồng bộ trạng thái active của menu theo trang hiện tại.
 * ==========================================================================
 */

(function () {
  'use strict';

  // Fallback HTML giống 100% components/sidebar.html, dùng khi chạy offline
  // hoặc mở trực tiếp qua giao thức file:// bị CORS trình duyệt chặn fetch.
  var FALLBACK_SIDEBAR_HTML =
    '<div class="brand">\n' +
    '  <div class="logo">\n' +
    '    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round">\n' +
    '      <rect x="4" y="4" width="16" height="16" rx="2" />\n' +
    '      <path d="M9 9h6v6H9zM2 9h2M2 15h2M20 9h2M20 15h2" />\n' +
    '    </svg>\n' +
    '  </div>\n' +
    '  <div><b>IoT System</b><span>Smart Waste Bin</span></div>\n' +
    '</div>\n' +
    '<div class="navlabel">ĐIỀU HƯỚNG</div>\n' +
    '<nav>\n' +
    '  <a href="tong-quan.html" data-page="tong-quan">\n' +
    '    <span class="nav-icon-wrap">\n' +
    '      <svg viewBox="0 0 24 24">\n' +
    '        <rect x="3" y="3" width="7" height="7" rx="1.5" />\n' +
    '        <rect x="14" y="3" width="7" height="7" rx="1.5" />\n' +
    '        <rect x="14" y="14" width="7" height="7" rx="1.5" />\n' +
    '        <rect x="3" y="14" width="7" height="7" rx="1.5" />\n' +
    '      </svg>\n' +
    '    </span>\n' +
    '    <span class="nav-text">Tổng quan</span>\n' +
    '  </a>\n' +
    '  <a href="thiet-bi.html" data-page="thiet-bi">\n' +
    '    <span class="nav-icon-wrap">\n' +
    '      <svg viewBox="0 0 24 24">\n' +
    '        <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />\n' +
    '        <path d="M11 19h8.2a1.8 1.8 0 0 0 1.565-.914 1.78 1.78 0 0 0 .009-1.771L17.2 10" />\n' +
    '        <path d="m14 16 3 3-3 3" />\n' +
    '        <path d="M8.2 5.5h7.6" />\n' +
    '        <path d="m18 3-2 3.5 2 3.5" />\n' +
    '        <path d="m6.5 9-2-3.5 3.5-2" />\n' +
    '      </svg>\n' +
    '    </span>\n' +
    '    <span class="nav-text">\n' +
    '      <span class="desktop-label">Thiết bị</span>\n' +
    '      <span class="mobile-label">Phân loại</span>\n' +
    '    </span>\n' +
    '  </a>\n' +
    '  <a href="lich-su.html" data-page="lich-su">\n' +
    '    <span class="nav-icon-wrap">\n' +
    '      <svg viewBox="0 0 24 24">\n' +
    '        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />\n' +
    '        <path d="M3 3v5h5M12 7v5l3 2" />\n' +
    '      </svg>\n' +
    '    </span>\n' +
    '    <span class="nav-text">Lịch sử</span>\n' +
    '  </a>\n' +
    '</nav>\n' +
    '<div class="hw">\n' +
    '  <div><span>PHẦN CỨNG</span><span class="chip">ESP32-S3</span></div>\n' +
    '  <div><span>TRẠNG THÁI</span><span class="on-t" id="sideOn">ONLINE</span></div>\n' +
    '</div>';

  /**
   * Tự động nhận diện trang hiện tại và kích hoạt class="on"
   * @param {HTMLElement} container
   */
  function highlightActiveMenu(container) {
    if (!container) return;
    var navLinks = container.querySelectorAll('nav a');
    if (!navLinks || !navLinks.length) return;

    var currentPath = window.location.pathname.toLowerCase();
    var currentFile = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'tong-quan.html';
    if (currentFile === '' || currentFile === 'index.html') {
      currentFile = 'tong-quan.html';
    }

    navLinks.forEach(function (link) {
      var href = (link.getAttribute('href') || '').toLowerCase().split('#')[0].split('?')[0];
      var pageKey = (link.getAttribute('data-page') || '').toLowerCase();
      var isActive = false;

      if (href === currentFile) {
        isActive = true;
      } else if (pageKey && currentFile.indexOf(pageKey) !== -1) {
        isActive = true;
      }

      if (isActive) {
        link.classList.add('on');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('on');
        link.removeAttribute('aria-current');
      }
    });
  }

  /**
   * Khởi tạo và nạp nội dung cho Sidebar
   */
  function initSidebar() {
    var container = document.getElementById('sidebar-container') || document.querySelector('aside');
    if (!container) return;

    // Nếu đã có cấu trúc nav sẵn bên trong (pre-rendered), chỉ cập nhật active
    if (container.querySelector('nav a')) {
      highlightActiveMenu(container);
      document.dispatchEvent(new CustomEvent('sidebarLoaded', { detail: { container: container } }));
      return;
    }

    // Tải động bằng fetch từ components/sidebar.html
    fetch('components/sidebar.html')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP status ' + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        container.innerHTML = html;
        highlightActiveMenu(container);
        document.dispatchEvent(new CustomEvent('sidebarLoaded', { detail: { container: container } }));
      })
      .catch(function (err) {
        // Fallback khi chạy file:// hoặc offline
        container.innerHTML = FALLBACK_SIDEBAR_HTML;
        highlightActiveMenu(container);
        document.dispatchEvent(new CustomEvent('sidebarLoaded', { detail: { container: container } }));
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
  } else {
    initSidebar();
  }
})();

