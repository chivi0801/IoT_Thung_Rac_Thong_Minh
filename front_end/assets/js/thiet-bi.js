/**
 * ==========================================================================
 * THIẾT BỊ & PHÂN LOẠI JAVASCRIPT (thiet-bi.js)
 * Quản lý trạng thái 3 ngăn rác, cảm biến siêu âm, đặt lại ngăn sau khi
 * đổ rác, cấu hình ngưỡng cảnh báo và mô phỏng luồng AI Vision trực tiếp.
 * ==========================================================================
 */

(function () {
  'use strict';

  // Dữ liệu mẫu mô phỏng từ vi điều khiển ESP32
  var cps = [
    { id: 1, key: 'pl', name: 'NGĂN SỐ 1 · NHỰA', level: 86, count: 38, dist: 5.6 },
    { id: 2, key: 'me', name: 'NGĂN SỐ 2 · KIM LOẠI', level: 42, count: 21, dist: 17.4 },
    { id: 3, key: 'or', name: 'NGĂN SỐ 3 · HỮU CƠ', level: 63, count: 27, dist: 11.1 }
  ];

  var CAP = 30; // Chiều sâu ngăn rác (cm) để quy đổi khoảng cách siêu âm -> %

  var alerts = [
    { t: '10:15', lv: 'warn', m: 'Ngăn 1 (Nhựa) đạt 80%', s: 'Vượt ngưỡng cảnh báo' },
    { t: '09:48', lv: 'info', m: 'Ngăn 2 (Kim loại) đã được đổ rác', s: 'Mức đầy về 5%' },
    { t: '09:12', lv: 'warn', m: 'Độ tin cậy thấp (52%)', s: 'Vật thể chưa được phân loại' }
  ];

  var cfgDef = { full: 80, conf: 60 };
  var cfg = { full: 80, conf: 60 };

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  function formatNowTime() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function getCompartmentStatus(level) {
    if (level >= 95) return { c: 'bad', t: 'ĐẦY' };
    if (level >= cfg.full) return { c: 'warn', t: 'SẮP ĐẦY' };
    return { c: 'ok', t: 'BÌNH THƯỜNG' };
  }

  /**
   * Render các thẻ ngăn rác trên Desktop
   */
  function renderCompartments() {
    var cpsEl = $('cps');
    if (!cpsEl) return;

    var full = [];
    var html = '';

    cps.forEach(function (c) {
      var st = getCompartmentStatus(c.level);
      if (st.c !== 'ok') {
        full.push('Ngăn ' + c.id + ' ' + (st.c === 'bad' ? 'đã đầy' : 'sắp đầy (' + c.level + '%)'));
      }

      html += '<article id="ngan-' + c.id + '" class="card cp ' + c.key + '">' +
        '<h3>' + c.name + '</h3>' +
        '<div class="big mono">' + c.level + '<small>%</small></div>' +
        '<span class="pill s-' + st.c + '">' + st.t + '</span>' +
        '<div class="bar ' + (st.c === 'ok' ? '' : st.c) + '" role="progressbar" aria-valuenow="' + c.level + '" aria-valuemin="0" aria-valuemax="100">' +
          '<span style="width:' + c.level + '%"></span>' +
        '</div>' +
        '<div class="scale"><span>0%</span><span>' + cfg.full + '%</span><span>100%</span></div>' +
        '<div class="meta"><span>Số vật thể</span><b>' + c.count + '</b></div>' +
        '<div class="meta" style="margin-top:-6px;border:0;padding:0"><span>Cách miệng thùng</span><b>' + c.dist.toFixed(1) + ' cm</b></div>' +
        '<button class="btn" style="margin-top:16px" data-id="' + c.id + '">Đã đổ rác</button>' +
      '</article>';
    });

    cpsEl.innerHTML = html;

    // Cập nhật Banner cảnh báo
    var banner = $('banner');
    var bannerTx = $('bannerTx');
    var navDot = $('navDot');

    if (banner && bannerTx) {
      banner.classList.toggle('show', full.length > 0);
      bannerTx.textContent = full.join(' · ') + (full.length > 0 ? '. Cần đổ rác sớm.' : '');
    }

    if (navDot) {
      navDot.classList.toggle('show', full.length > 0);
    }
  }

  /**
   * Đặt lại ngăn rác sau khi người dùng bấm Đã đổ rác
   */
  function setupResetTrash() {
    var cpsEl = $('cps');
    if (!cpsEl) return;

    cpsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-id]');
      if (!btn) return;

      var c = cps[btn.dataset.id - 1];
      if (!c) return;

      if (!confirm('Xác nhận đã đổ rác ngăn ' + c.id + '? Bộ đếm vật thể của ngăn sẽ về 0 (lịch sử vẫn giữ nguyên).')) {
        return;
      }

      c.level = 5;
      c.count = 0;
      c.dist = CAP * 0.95;

      alerts.unshift({
        t: formatNowTime(),
        lv: 'info',
        m: 'Ngăn ' + c.id + ' đã được đổ rác',
        s: 'Mức đầy về 5%'
      });

      renderCompartments();
      notify('Đã đặt lại ngăn ' + c.id);
    });
  }

  /**
   * Thiết lập sự kiện thanh trượt cấu hình
   */
  function setupConfigSliders() {
    function bindSlider(id, key) {
      var el = $(id);
      var label = $(id + 'V');
      if (!el || !label) return;

      el.addEventListener('input', function () {
        label.textContent = el.value + '%';
        cfg[key] = +el.value;
        renderCompartments();
      });
    }

    bindSlider('thFull', 'full');
    bindSlider('thConf', 'conf');

    var saveBtn = $('saveCfg');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        notify('Đã lưu cấu hình thành công');
      });
    }

    var resetBtn = $('resetCfg');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        cfg.full = cfgDef.full;
        cfg.conf = cfgDef.conf;

        var thFull = $('thFull');
        var thConf = $('thConf');
        var thFullV = $('thFullV');
        var thConfV = $('thConfV');

        if (thFull) thFull.value = cfg.full;
        if (thConf) thConf.value = cfg.conf;
        if (thFullV) thFullV.textContent = cfg.full + '%';
        if (thConfV) thConfV.textContent = cfg.conf + '%';

        renderCompartments();
        notify('Đã đặt lại cấu hình mặc định');
      });
    }
  }

  /**
   * Đồng hồ cập nhật thời gian uptime và thời điểm liên lạc gần nhất
   */
  function setupUptimeTicker() {
    var startTime = Date.now() - (3 * 3600 + 27 * 60) * 1000;

    function tick() {
      var s = Math.floor((Date.now() - startTime) / 1000);
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);

      var uptimeEl = $('uptime');
      if (uptimeEl) {
        uptimeEl.textContent = h + ' giờ ' + m + ' phút';
      }

      var lastSeenEl = $('lastSeen');
      if (lastSeenEl) {
        var d = new Date();
        lastSeenEl.textContent = d.toLocaleTimeString('vi-VN') + ' (vừa xong)';
      }
    }

    tick();
    setInterval(tick, 30000);
  }

  /**
   * Mô phỏng tín hiệu camera và cảm biến AI Vision trên Mobile
   */
  function setupMobileVisionSimulation() {
    var latencyPill = $('latencyPill');
    if (!latencyPill) return;

    // Giả lập độ trễ mạng dao động thực tế 110ms - 135ms
    setInterval(function () {
      var lat = 115 + Math.floor(Math.random() * 20);
      latencyPill.textContent = 'Độ trễ: ' + lat + 'ms';
    }, 4000);
  }

  // Khởi chạy khi DOM sẵn sàng
  document.addEventListener('DOMContentLoaded', function () {
    renderCompartments();
    setupResetTrash();
    setupConfigSliders();
    setupUptimeTicker();
    setupMobileVisionSimulation();
  });
})();
