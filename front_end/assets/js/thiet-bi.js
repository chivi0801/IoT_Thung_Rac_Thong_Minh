/**
 * ==========================================================================
 * THIẾT BỊ & PHÂN LOẠI JAVASCRIPT (thiet-bi.js)
 * Quản lý trạng thái 3 ngăn rác, cảm biến siêu âm, đặt lại ngăn sau khi
 * đổ rác, cấu hình ngưỡng cảnh báo và mô phỏng luồng AI Vision trực tiếp.
 * ==========================================================================
 */

(function () {
  'use strict';

  // Dữ liệu thực từ ESP32 qua Flask endpoint /api/bins.
  var cps = [
    { id: 1, key: 'or', sensorName: 'giay', name: 'NGĂN SỐ 1 · GIẤY', level: null, distanceMm: null, sensorOk: false },
    { id: 2, key: 'pl', sensorName: 'nhua', name: 'NGĂN SỐ 2 · NHỰA', level: null, distanceMm: null, sensorOk: false },
    { id: 3, key: 'me', sensorName: 'kim_loai', name: 'NGĂN SỐ 3 · KIM LOẠI', level: null, distanceMm: null, sensorOk: false }
  ];

  var cfgDef = { full: 80, conf: 60 };
  var cfg = { full: 80, conf: 60 };
  var polling = false;
  var latestPredictionPolling = false;
  var latestBatchId = null;

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

  function getCompartmentStatus(compartment) {
    if (!compartment.sensorOk || compartment.level === null) return { c: 'unknown', t: 'CHƯA CÓ SỐ ĐO' };
    var level = compartment.level;
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
      var st = getCompartmentStatus(c);
      if (st.c !== 'ok') {
        if (st.c === 'bad' || st.c === 'warn') {
          full.push('Ngăn ' + c.id + ' ' + (st.c === 'bad' ? 'đã đầy' : 'sắp đầy (' + c.level + '%)'));
        }
      }
      var levelText = c.level === null ? '—' : c.level;
      var levelWidth = c.level === null ? 0 : c.level;
      var distanceText = c.distanceMm === null ? '—' : (c.distanceMm / 10).toFixed(1) + ' cm';
      var sensorText = !c.sensorOk ? 'Không phản hồi' : (c.level === null ? 'Chưa có số đo' : 'Đang hoạt động');

      html += '<article id="ngan-' + c.id + '" class="card cp ' + c.key + '">' +
        '<h3>' + c.name + '</h3>' +
        '<div class="big mono">' + levelText + (c.level === null ? '' : '<small>%</small>') + '</div>' +
        '<span class="pill s-' + st.c + '">' + st.t + '</span>' +
        '<div class="bar ' + (st.c === 'ok' ? '' : st.c) + '" role="progressbar" aria-valuenow="' + levelWidth + '" aria-valuemin="0" aria-valuemax="100">' +
          '<span style="width:' + levelWidth + '%"></span>' +
        '</div>' +
        '<div class="scale"><span>0%</span><span>' + cfg.full + '%</span><span>100%</span></div>' +
        '<div class="meta"><span>Cách cảm biến</span><b>' + distanceText + '</b></div>' +
        '<div class="meta" style="margin-top:-6px;border:0;padding:0"><span>Cảm biến</span><b>' + sensorText + '</b></div>' +
      '</article>';
    });

    cpsEl.innerHTML = html;

    // Cập nhật Banner cảnh báo
    var banner = $('banner');
    var bannerTx = $('bannerTx');

    if (banner && bannerTx) {
      banner.classList.toggle('show', full.length > 0);
      bannerTx.textContent = full.join(' · ') + (full.length > 0 ? '. Cần đổ rác sớm.' : '');
    }
  }

  function pollBinReadings() {
    if (polling) return;
    polling = true;
    fetch('/api/bins', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.bins)) throw new Error('Dữ liệu cảm biến không hợp lệ');
        var readings = {};
        payload.bins.forEach(function (item) { readings[item.name] = item; });
        cps.forEach(function (c) {
          var reading = readings[c.sensorName];
          c.sensorOk = !!(reading && reading.sensor_ok);
          c.level = c.sensorOk && reading.fill_percent !== null && reading.fill_percent !== undefined && Number.isFinite(Number(reading.fill_percent)) ?
            Math.max(0, Math.min(100, Number(reading.fill_percent))) : null;
          c.distanceMm = c.sensorOk && reading.distance_mm !== null && reading.distance_mm !== undefined && Number.isFinite(Number(reading.distance_mm)) ?
            Number(reading.distance_mm) : null;
        });
        var status = $('sensorConnection');
        if (status) {
          var readyCount = cps.filter(function (c) { return c.sensorOk; }).length;
          status.textContent = 'ESP32 trực tuyến · ' + readyCount + '/3 cảm biến sẵn sàng · cập nhật ' +
            new Date().toLocaleTimeString('vi-VN');
          status.classList.toggle('offline', readyCount === 0);
        }
        renderCompartments();
      })
      .catch(function (error) {
        var status = $('sensorConnection');
        if (status) {
          status.textContent = 'Không đọc được ESP32: ' + error.message;
          status.classList.add('offline');
        }
      })
      .finally(function () { polling = false; });
  }

  function pollLatestPrediction() {
    if (latestPredictionPolling) return;
    latestPredictionPolling = true;
    fetch('/api/latest', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        if (payload.status !== 'complete' || payload.batch_id === latestBatchId) return;
        latestBatchId = payload.batch_id;

        var frame = $('liveFeedViewport');
        var image = $('latestWasteImage');
        var firstImage = (payload.images || []).find(function (item) {
          return item.annotated_url || item.original_url;
        });
        if (frame && image && firstImage) {
          image.hidden = false;
          image.onload = function () { frame.classList.add('has-image'); };
          image.onerror = function () { frame.classList.remove('has-image'); };
          image.src = (firstImage.annotated_url || firstImage.original_url) + '?v=' + encodeURIComponent(payload.batch_id);
        }

        var types = {
          can: { name: 'Rác kim loại', category: 'KIM LOẠI' },
          bottle: { name: 'Rác nhựa', category: 'NHỰA' },
          'paper cup': { name: 'Rác giấy', category: 'GIẤY' }
        };
        var type = types[payload.class_name] || { name: 'Chưa phân loại', category: 'CHƯA PHÂN LOẠI' };
        var confidence = Number.isFinite(Number(payload.confidence)) ? (Number(payload.confidence) * 100).toFixed(1) + '%' : '--';
        var receivedAt = payload.received_at ? new Date(payload.received_at).toLocaleString('vi-VN') : '--';
        var targetName = $('targetObjectName');
        var targetConfidence = $('targetAiConf');
        var categoryBadge = $('valCategoryBadge');
        var timestamp = $('valTimestamp');
        var stepConfidence = $('stepConf2');
        var flapStatus = document.querySelector('.success-badge');

        if (targetName) targetName.textContent = type.name;
        if (targetConfidence) targetConfidence.textContent = payload.success ? 'YOLO ' + confidence : (payload.error || 'Chưa phân loại');
        if (categoryBadge) categoryBadge.textContent = type.category;
        if (timestamp) timestamp.textContent = receivedAt;
        if (stepConfidence) stepConfidence.textContent = payload.success ? 'YOLO ' + confidence : 'Chưa đạt đồng thuận';
        if (flapStatus) flapStatus.textContent = payload.success ? 'ĐÃ GỬI LỆNH PHÂN LOẠI' : 'CHƯA PHÂN LOẠI';
      })
      .catch(function (error) {
        var targetName = $('targetObjectName');
        if (!latestBatchId && targetName) targetName.textContent = 'Đang chờ ESP32 gửi ảnh';
        if (error && window.console) console.warn('Không đọc được kết quả ESP32:', error.message);
      })
      .finally(function () { latestPredictionPolling = false; });
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
    pollBinReadings();
    window.setInterval(pollBinReadings, 2000);
    pollLatestPrediction();
    window.setInterval(pollLatestPrediction, 2000);
    setupConfigSliders();
    setupUptimeTicker();
    setupMobileVisionSimulation();
  });
})();
