/**
 * ==========================================================================
 * QUẢN LÝ ĐỔI THƯỞNG & QUÀ TẶNG (doi-thuong.js)
 * Nạp cấu hình điểm, quản lý kho quà tặng và nhật ký đổi quà trực tiếp
 * từ Spring Boot REST API.
 * ==========================================================================
 */

(function () {
  'use strict';

  var editingGiftId = null;
  var giftsCache = [];

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
     1. CONVERSION RATES
     ========================================================================= */
  function renderRates(rates) {
    if (!rates) return;

    var ratePlastic = $('ratePlastic');
    var rateMetal = $('rateMetal');
    var rateOrganic = $('rateOrganic');

    if (ratePlastic) ratePlastic.value = rates.plastic;
    if (rateMetal) rateMetal.value = rates.metal;
    if (rateOrganic) rateOrganic.value = rates.organic;

    document.querySelectorAll('.btn-mult-choice').forEach(function (btn) {
      var val = parseFloat(btn.getAttribute('data-mult'));
      btn.classList.toggle('active', val === rates.multiplier);
    });

    setText('statActiveGifts', rates.activeGiftsCount != null ? rates.activeGiftsCount : 0);
    setText('statTotalRedemptions', rates.totalRedemptionsCount != null ? rates.totalRedemptionsCount : 0);
  }

  function loadRates() {
    return window.SmartBin.request('/rewards/rates').then(renderRates);
  }

  function handleSaveRates() {
    var plastic = parseInt($('ratePlastic').value, 10) || 10;
    var metal = parseInt($('rateMetal').value, 10) || 15;
    var organic = parseInt($('rateOrganic').value, 10) || 5;

    var activeMultBtn = document.querySelector('.btn-mult-choice.active');
    var multiplier = activeMultBtn ? parseFloat(activeMultBtn.getAttribute('data-mult')) : 1.0;

    var saveBtn = $('btnSaveRates');
    if (saveBtn) saveBtn.disabled = true;

    window.SmartBin.sendJson('/rewards/rates', 'PUT', {
      plastic: plastic,
      metal: metal,
      organic: organic,
      multiplier: multiplier
    })
      .then(function (rates) {
        renderRates(rates);
        notify('✓ Đã lưu cấu hình điểm quy đổi thành công!');
      })
      .catch(function (err) { notify('Không thể lưu cấu hình: ' + err.message); })
      .finally(function () { if (saveBtn) saveBtn.disabled = false; });
  }

  function handleResetRates() {
    var resetBtn = $('btnResetRates');
    if (resetBtn) resetBtn.disabled = true;

    window.SmartBin.sendJson('/rewards/rates', 'PUT', {
      plastic: 10,
      metal: 15,
      organic: 5,
      multiplier: 1.0
    })
      .then(function (rates) {
        renderRates(rates);
        notify('Đã đặt lại quy tắc điểm về mặc định.');
      })
      .catch(function (err) { notify('Không thể đặt lại cấu hình: ' + err.message); })
      .finally(function () { if (resetBtn) resetBtn.disabled = false; });
  }

  /* =========================================================================
     2. GIFT INVENTORY
     ========================================================================= */
  function renderGiftsTable() {
    var tbody = $('giftTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    giftsCache.forEach(function (gift, index) {
      var tr = document.createElement('tr');
      var isLow = gift.isLow != null ? gift.isLow : (gift.stock < 20);

      tr.innerHTML =
        '<td>' + (index + 1) + '</td>' +
        '<td>' +
          '<div class="gift-cell-info">' +
            '<div class="gift-emoji-avatar">' + (gift.icon || '🎁') + '</div>' +
            '<div>' +
              '<div class="gift-cell-name">' + gift.name + '</div>' +
              '<div class="gift-cell-desc">' + (gift.desc || '') + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td><span class="pill-pts-required">' + gift.points + ' đ</span></td>' +
        '<td><span class="pill-stock ' + (isLow ? 'low' : 'ok') + '">' + gift.stock + ' ' + (isLow ? '(Sắp hết)' : '') + '</span></td>' +
        '<td>' +
          '<span class="badge-gift-status ' + gift.status + '">' +
            (gift.status === 'active' ? '● Đang mở đổi' : '○ Tạm dừng') +
          '</span>' +
        '</td>' +
        '<td>' +
          '<div class="table-action-btns">' +
            '<button type="button" class="btn-row-action btn-edit-gift" data-id="' + gift.id + '">Sửa</button>' +
            '<button type="button" class="btn-row-action btn-toggle-gift" data-id="' + gift.id + '">' +
              (gift.status === 'active' ? 'Tắt' : 'Bật') +
            '</button>' +
            '<button type="button" class="btn-row-action delete btn-delete-gift" data-id="' + gift.id + '">Xóa</button>' +
          '</div>' +
        '</td>';
      tbody.appendChild(tr);
    });

    if (giftsCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--mut);">Chưa có phần quà nào.</td></tr>';
    }
  }

  function loadGifts() {
    return window.SmartBin.request('/rewards/gifts')
      .then(function (gifts) {
        giftsCache = gifts || [];
        renderGiftsTable();
      });
  }

  /* =========================================================================
     3. REDEMPTION LOG
     ========================================================================= */
  function renderRedemptionsTable(logs) {
    var tbody = $('redemptionTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    (logs || []).forEach(function (log) {
      var tr = document.createElement('tr');
      var isClaimed = log.status === 'claimed';

      tr.innerHTML =
        '<td class="mono font-bold" style="color:var(--pri);">' + log.code + '</td>' +
        '<td class="mono">' + log.mssv + '</td>' +
        '<td><b>' + log.name + '</b></td>' +
        '<td>' + log.giftName + '</td>' +
        '<td class="mono font-bold" style="color:var(--ok);">-' + log.points + ' đ</td>' +
        '<td class="mono" style="font-size:12px;color:var(--mut);">' + log.time + '</td>' +
        '<td>' +
          '<span class="badge-trans-status ' + log.status + '">' +
            (isClaimed ? '✓ Đã nhận tại quầy' : '⏳ Chờ nhận') +
          '</span>' +
        '</td>';
      tbody.appendChild(tr);
    });

    if ((logs || []).length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--mut);">Chưa có lượt đổi quà nào.</td></tr>';
    }
  }

  function loadRedemptions() {
    return window.SmartBin.request('/rewards/redemptions')
      .then(renderRedemptionsTable);
  }

  /* =========================================================================
     4. GIFT MODAL
     ========================================================================= */
  function openGiftModal(id) {
    editingGiftId = id || null;
    var modal = $('modalGift');
    if (!modal) return;

    var title = $('modalGiftTitle');
    var inName = $('giftName');
    var inIcon = $('giftIcon');
    var inPoints = $('giftPoints');
    var inStock = $('giftStock');
    var inDesc = $('giftDesc');

    if (id) {
      var found = giftsCache.find(function (g) { return g.id === id; });
      if (found) {
        if (title) title.textContent = 'Chỉnh sửa phần quà';
        if (inName) inName.value = found.name;
        if (inIcon) inIcon.value = found.icon;
        if (inPoints) inPoints.value = found.points;
        if (inStock) inStock.value = found.stock;
        if (inDesc) inDesc.value = found.desc || '';
      }
    } else {
      if (title) title.textContent = 'Thêm phần quà mới';
      if (inName) inName.value = '';
      if (inIcon) inIcon.value = '🎁';
      if (inPoints) inPoints.value = 50;
      if (inStock) inStock.value = 50;
      if (inDesc) inDesc.value = '';
    }

    modal.classList.add('open');
  }

  function closeGiftModal() {
    var modal = $('modalGift');
    if (modal) modal.classList.remove('open');
    editingGiftId = null;
  }

  function saveGiftModal() {
    var inName = $('giftName');
    var inIcon = $('giftIcon');
    var inPoints = $('giftPoints');
    var inStock = $('giftStock');
    var inDesc = $('giftDesc');

    var name = inName ? inName.value.trim() : '';
    var icon = (inIcon ? inIcon.value.trim() : '') || '🎁';
    var points = inPoints ? parseInt(inPoints.value, 10) : 50;
    var stock = inStock ? parseInt(inStock.value, 10) : 50;
    var desc = inDesc ? inDesc.value.trim() : '';

    if (!name) {
      notify('Vui lòng nhập tên phần quà!');
      return;
    }

    var existing = editingGiftId
      ? giftsCache.find(function (g) { return g.id === editingGiftId; })
      : null;

    var payload = {
      name: name,
      icon: icon,
      points: points,
      stock: stock,
      desc: desc,
      status: existing ? existing.status : 'active'
    };

    var saveBtn = $('btnSaveGiftModal');
    if (saveBtn) saveBtn.disabled = true;

    var operation;
    if (editingGiftId) {
      operation = window.SmartBin.sendJson('/rewards/gifts/' + editingGiftId, 'PUT', payload);
    } else {
      operation = window.SmartBin.sendJson('/rewards/gifts', 'POST', payload);
    }

    operation
      .then(function () {
        notify(editingGiftId ? ('✓ Đã cập nhật phần quà ' + name + '!') : ('✓ Đã thêm phần quà mới ' + name + '!'));
        closeGiftModal();
        return Promise.all([loadGifts(), loadRates()]);
      })
      .catch(function (err) { notify('Không thể lưu phần quà: ' + err.message); })
      .finally(function () { if (saveBtn) saveBtn.disabled = false; });
  }

  function deleteGift(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa phần quà này?')) return;

    window.SmartBin.request('/rewards/gifts/' + id, { method: 'DELETE' })
      .then(function () {
        notify('Đã xóa phần quà thành công.');
        return Promise.all([loadGifts(), loadRates()]);
      })
      .catch(function (err) { notify('Không thể xóa phần quà: ' + err.message); });
  }

  function toggleGiftStatus(id) {
    window.SmartBin.request('/rewards/gifts/' + id + '/toggle', { method: 'PATCH' })
      .then(function (gift) {
        notify('Đã thay đổi trạng thái phần quà sang: ' + (gift.status === 'active' ? 'Mở đổi' : 'Tạm dừng'));
        return Promise.all([loadGifts(), loadRates()]);
      })
      .catch(function (err) { notify('Không thể đổi trạng thái: ' + err.message); });
  }

  /* =========================================================================
     5. INITIALISATION
     ========================================================================= */
  function init() {
    Promise.all([loadRates(), loadGifts(), loadRedemptions()])
      .catch(function (err) { notify('Không thể tải dữ liệu đổi thưởng: ' + err.message); });

    if ($('btnSaveRates')) {
      $('btnSaveRates').addEventListener('click', handleSaveRates);
    }
    if ($('btnResetRates')) {
      $('btnResetRates').addEventListener('click', handleResetRates);
    }
    if ($('btnOpenAddGift')) {
      $('btnOpenAddGift').addEventListener('click', function () { openGiftModal(null); });
    }
    if ($('btnSaveGiftModal')) {
      $('btnSaveGiftModal').addEventListener('click', saveGiftModal);
    }

    document.querySelectorAll('#btnCloseGiftModal, #btnCancelGiftModal').forEach(function (b) {
      b.addEventListener('click', closeGiftModal);
    });

    var modalGift = $('modalGift');
    if (modalGift) {
      modalGift.addEventListener('click', function (e) {
        if (e.target === modalGift) closeGiftModal();
      });
    }

    document.querySelectorAll('.btn-mult-choice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.btn-mult-choice').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    document.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.btn-edit-gift');
      if (editBtn) {
        openGiftModal(parseInt(editBtn.getAttribute('data-id'), 10));
        return;
      }

      var toggleBtn = e.target.closest('.btn-toggle-gift');
      if (toggleBtn) {
        toggleGiftStatus(parseInt(toggleBtn.getAttribute('data-id'), 10));
        return;
      }

      var delBtn = e.target.closest('.btn-delete-gift');
      if (delBtn) {
        deleteGift(parseInt(delBtn.getAttribute('data-id'), 10));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DoiThuongAdmin = {
    refresh: loadGifts,
    renderRates: loadRates,
    renderGiftsTable: loadGifts
  };
})();
