/**
 * ==========================================================================
 * COMMON JAVASCRIPT (common.js)
 * Chứa logic dùng chung cho cả 3 trang: Toast notification, điều hướng,
 * format thời gian và tiện ích hệ thống.
 * ==========================================================================
 */

var SmartBin = (function () {
  'use strict';

  var toastTimer = null;

  /**
   * Hiển thị thông báo Toast nổi dưới chân màn hình
   * @param {string} message - Nội dung cần thông báo
   * @param {number} duration - Thời gian hiển thị tính bằng milliseconds (mặc định 2400ms)
   */
  function showToast(message, duration) {
    var toastEl = document.getElementById('toast');
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'toast';
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }

    toastEl.textContent = message;
    toastEl.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, duration || 2400);
  }

  /**
   * Lấy chuỗi thời gian hiện tại theo định dạng HH:mm:ss
   * @returns {string}
   */
  function getCurrentTimeString() {
    var d = new Date();
    var h = ('0' + d.getHours()).slice(-2);
    var m = ('0' + d.getMinutes()).slice(-2);
    var s = ('0' + d.getSeconds()).slice(-2);
    return h + ':' + m + ':' + s;
  }

  /**
   * Tự động nhận diện trang hiện tại và gán class="on" cho nav tương ứng
   */
  function highlightCurrentNav() {
    var path = window.location.pathname.toLowerCase();
    var navLinks = document.querySelectorAll('aside nav a');

    navLinks.forEach(function (link) {
      var href = (link.getAttribute('href') || '').toLowerCase();
      // Bỏ đuôi hash hoặc param nếu có
      href = href.split('#')[0].split('?')[0];

      var isCurrent = false;
      if (path.endsWith(href) || ((href.includes('tong-quan') || href.includes('tongquan')) && (path.endsWith('/') || path.endsWith('index.html')))) {
        isCurrent = true;
      }

      if (isCurrent) {
        link.classList.add('on');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  // Chạy khi DOM sẵn sàng
  document.addEventListener('DOMContentLoaded', function () {
    highlightCurrentNav();
  });

  return {
    toast: showToast,
    now: getCurrentTimeString,
    initNav: highlightCurrentNav
  };
})();
