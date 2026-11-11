/**
 * ==========================================================================
 * THIẾT BỊ & PHÂN LOẠI JAVASCRIPT (thiet-bi.js)
 * Nạp trạng thái 3 ngăn rác, cấu hình ngưỡng cảnh báo và thông tin phần cứng
 * trực tiếp từ Spring Boot REST API.
 * ==========================================================================
 */

(function () {
  'use strict';

  var compartments = [];
  var cfg = { full: 80, conf: 60 };

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value;
  }

  /* =========================================================================
     1. COMPARTMENTS
     ========================================================================= */
  function renderCompartments() {
    var cpsEl = $('cps');
    if (!cpsEl) return;

    var warningItems = [];
    var html = '';

    compartments.forEach(function (c) {
      var level = c.level == null ? 0 : c.level;
      var count = c.count == null ? 0 : c.count;
      var dist = c.dist == null ? 0 : c.dist;
      var statusClass = c.statusClass || 'ok';
      var statusText = c.statusText || 'BÌNH THƯỜNG';
      var name = c.name || '';

      if (c.id === 3) {
        name = name.replace('HỮU CƠ', 'GIẤY').replace('Hữu cơ', 'Giấy');
        if (!name) name = 'NGĂN SỐ 3 · GIẤY';
      }

      if (statusClass !== 'ok') {
        warningItems.push('Ngăn ' + c.id + ' ' + statusText.toLowerCase() + ' (' + level + '%)');
      }

      html += '<article id="ngan-' + c.id + '" class="card cp ' + c.key + '">' +
        '<h3>' + name + '</h3>' +
        '<div class="big mono">' + level + '<small>%</small></div>' +
        '<span class="pill s-' + statusClass + '">' + statusText + '</span>' +
        '<div class="bar ' + (statusClass === 'ok' ? '' : statusClass) + '" role="progressbar" aria-valuenow="' + level + '" aria-valuemin="0" aria-valuemax="100">' +
          '<span style="width:' + level + '%"></span>' +
        '</div>' +
        '<div class="scale"><span>0%</span><span>' + cfg.full + '%</span><span>100%</span></div>' +
        '<div class="meta"><span>Số vật thể</span><b>' + count + '</b></div>' +
        '<div class="meta" style="margin-top:-6px;border:0;padding:0"><span>Cách miệng thùng</span><b>' + dist.toFixed(1) + ' cm</b></div>' +
        '<button class="btn" style="margin-top:16px" data-id="' + c.id + '">Đã đổ rác</button>' +
      '</article>';
    });

    cpsEl.innerHTML = html;

    var banner = $('banner');
    var bannerTx = $('bannerTx');
    if (banner && bannerTx) {
      banner.classList.toggle('show', warningItems.length > 0);
      bannerTx.textContent = warningItems.join(' · ') + (warningItems.length > 0 ? '. Cần đổ rác sớm.' : '');
    }
  }

  function loadCompartments() {
    return window.SmartBin.request('/devices/compartments')
      .then(function (data) {
        compartments = data || [];
        renderCompartments();
      });
  }

  function setupResetTrash() {
    var cpsEl = $('cps');
    if (!cpsEl) return;

    cpsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-id]');
      if (!btn) return;

      var id = parseInt(btn.dataset.id, 10);
      var compartment = compartments.find(function (c) { return c.id === id; });
      if (!compartment) return;

      if (!confirm('Xác nhận đã đổ rác ngăn ' + id + '? Bộ đếm vật thể của ngăn sẽ về 0 (lịch sử vẫn giữ nguyên).')) {
        return;
      }

      btn.disabled = true;
      window.SmartBin.request('/devices/compartments/' + id + '/reset', { method: 'POST' })
        .then(function () { return loadCompartments(); })
        .then(function () { notify('Đã đặt lại ngăn ' + id); })
        .catch(function (err) { notify('Không thể đặt lại ngăn: ' + err.message); })
        .finally(function () { btn.disabled = false; });
    });
  }

  /* =========================================================================
     2. CONFIGURATION SLIDERS
     ========================================================================= */
  function applyConfigToUi() {
    var thFull = $('thFull');
    var thConf = $('thConf');

    if (thFull) thFull.value = cfg.full;
    if (thConf) thConf.value = cfg.conf;
    setText('thFullV', cfg.full + '%');
    setText('thConfV', cfg.conf + '%');
  }

  function loadConfigs() {
    return window.SmartBin.request('/devices/configs')
      .then(function (data) {
        if (!data) return;
        cfg.full = data.thFull != null ? data.thFull : 80;
        cfg.conf = data.thConf != null ? data.thConf : 60;
        applyConfigToUi();
        renderCompartments();
      });
  }

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
        var thFull = $('thFull');
        var thConf = $('thConf');
        var payload = {
          thFull: thFull ? parseInt(thFull.value, 10) : cfg.full,
          thConf: thConf ? parseInt(thConf.value, 10) : cfg.conf
        };

        saveBtn.disabled = true;
        window.SmartBin.sendJson('/devices/configs', 'PUT', payload)
          .then(function (data) {
            cfg.full = data.thFull;
            cfg.conf = data.thConf;
            applyConfigToUi();
            renderCompartments();
            notify('Đã lưu cấu hình thành công');
          })
          .catch(function (err) { notify('Không thể lưu cấu hình: ' + err.message); })
          .finally(function () { saveBtn.disabled = false; });
      });
    }

    var resetBtn = $('resetCfg');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetBtn.disabled = true;
        window.SmartBin.sendJson('/devices/configs', 'PUT', { thFull: 80, thConf: 60 })
          .then(function (data) {
            cfg.full = data.thFull;
            cfg.conf = data.thConf;
            applyConfigToUi();
            renderCompartments();
            notify('Đã đặt lại cấu hình mặc định');
          })
          .catch(function (err) { notify('Không thể đặt lại cấu hình: ' + err.message); })
          .finally(function () { resetBtn.disabled = false; });
      });
    }
  }

  /* =========================================================================
     3. HARDWARE TELEMETRY
     ========================================================================= */
  function loadHardwareInfo() {
    return window.SmartBin.request('/devices/hardware-info')
      .then(function (data) {
        if (!data) return;

        setText('uptime', data.uptime || '--');
        setText('lastSeen', data.lastSeen || '--');
        setText('wifiRssi', (data.wifiRssi != null ? data.wifiRssi : '--') + ' dBm');

        var devOn = $('devOn');
        if (devOn) {
          var online = data.status === 'ONLINE';
          devOn.textContent = data.status || (online ? 'ONLINE' : 'OFFLINE');
          devOn.style.color = online ? 'var(--ok, #059669)' : 'var(--bad, #dc2626)';
        }
      });
  }

  /* =========================================================================
     4. INITIALISATION
     ========================================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    setupResetTrash();
    setupConfigSliders();

    Promise.all([loadConfigs(), loadCompartments(), loadHardwareInfo()])
      .catch(function (err) {
        notify('Không thể tải dữ liệu thiết bị: ' + err.message);
      });
  });
})();
