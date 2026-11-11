/**
 * ==========================================================================
 * COMMON JAVASCRIPT (common.js)
 * Chứa cấu hình API/WebSocket toàn cục, tiện ích gọi REST API, Toast
 * notification, điều hướng và format thời gian.
 * ==========================================================================
 */

window.API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL)
  || 'http://localhost:8080/api/v1';
window.WS_BASE = (window.APP_CONFIG && window.APP_CONFIG.WS_URL)
  || 'ws://localhost:8080/ws/iot';

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
   * Gọi REST API Spring Boot và trả về trường `data` của envelope chuẩn.
   *
   * @param {string} path - Đường dẫn tương đối, ví dụ: /dashboard/kpi
   * @param {object} [options] - Tuỳ chọn fetch (method, headers, body...)
   * @returns {Promise<*>} giá trị json.data
   */
  function request(path, options) {
    var opts = options || {};
    var url = /^https?:\/\//i.test(path) ? path : (window.API_BASE + path);

    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        var json = null;
        if (text) {
          try {
            json = JSON.parse(text);
          } catch (e) {
            json = null;
          }
        }

        if (!res.ok) {
          var errMsg = (json && json.message) || ('Lỗi HTTP ' + res.status);
          throw new Error(errMsg);
        }

        if (json && json.success === false) {
          throw new Error(json.message || 'Yêu cầu thất bại');
        }

        return json ? json.data : null;
      });
    });
  }

  /**
   * Gửi request JSON (POST/PUT/PATCH) tới REST API.
   */
  function sendJson(path, method, payload) {
    return request(path, {
      method: method || 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
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
    initNav: highlightCurrentNav,
    request: request,
    sendJson: sendJson
  };
})();
