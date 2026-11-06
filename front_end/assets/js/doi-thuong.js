/**
 * ==========================================================================
 * QUẢN LÝ ĐỔI THƯỞNG & QUÀ TẶNG (doi-thuong.js)
 * Điều khiển cấu hình điểm quy đổi, quản lý kho quà tặng và nhật ký đổi quà.
 * Đồng bộ hóa dữ liệu thời gian thực qua localStorage tới trang Cổng Sinh Viên.
 * ==========================================================================
 */

(function () {
  'use strict';

  var DEFAULT_RATES = {
    plastic: 10,
    metal: 15,
    organic: 5,
    multiplier: 1.0
  };

  var DEFAULT_GIFTS = [
    {
      id: 1,
      name: 'Voucher Căn tin 20.000đ',
      icon: '☕',
      points: 50,
      stock: 85,
      desc: 'Áp dụng cho mọi món ăn & đồ uống tại Căn tin trường',
      status: 'active'
    },
    {
      id: 2,
      name: 'Bình giữ nhiệt Eco Green 500ml',
      icon: '🍃',
      points: 200,
      stock: 18,
      desc: 'Inox 304 giữ nhiệt 12h, in logo Thùng Rác Thông Minh',
      status: 'active'
    },
    {
      id: 3,
      name: 'Túi vải Canvas bảo vệ môi trường',
      icon: '🛍️',
      points: 80,
      stock: 42,
      desc: 'Vải canvas sợi tự nhiên tái sử dụng nhiều lần',
      status: 'active'
    },
    {
      id: 4,
      name: '+5 Điểm rèn luyện học kỳ',
      icon: '🎖️',
      points: 150,
      stock: 999,
      desc: 'Cộng trực tiếp mục Hoạt động Tình nguyện vì Môi trường',
      status: 'active'
    },
    {
      id: 5,
      name: 'Hộp bút tre tái sinh (3 cây)',
      icon: '✏️',
      points: 30,
      stock: 120,
      desc: 'Vỏ tre tự nhiên phân hủy sinh học, mực gel êm ái',
      status: 'active'
    }
  ];

  var DEFAULT_REDEMPTIONS = [
    {
      code: 'RDM-8492',
      mssv: '21120489',
      name: 'Nguyễn Văn An',
      giftName: 'Voucher Căn tin 20.000đ',
      points: 50,
      time: '10:15 - Hôm nay',
      status: 'claimed'
    },
    {
      code: 'RDM-8490',
      mssv: '22118742',
      name: 'Trần Thị Mai Hương',
      giftName: 'Túi vải Canvas',
      points: 80,
      time: '09:20 - Hôm nay',
      status: 'pending'
    },
    {
      code: 'RDM-8475',
      mssv: '20119631',
      name: 'Lê Hoàng Long',
      giftName: '+5 Điểm rèn luyện',
      points: 150,
      time: '16:40 - Hôm qua',
      status: 'claimed'
    }
  ];

  var editingGiftId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (window.SmartBin && typeof window.SmartBin.toast === 'function') {
      window.SmartBin.toast(msg);
    }
  }

  function getRates() {
    try {
      var saved = localStorage.getItem('smartbin_point_rates');
      return saved ? Object.assign({}, DEFAULT_RATES, JSON.parse(saved)) : Object.assign({}, DEFAULT_RATES);
    } catch (e) {
      return Object.assign({}, DEFAULT_RATES);
    }
  }

  function saveRatesToStorage(rates) {
    localStorage.setItem('smartbin_point_rates', JSON.stringify(rates));
  }

  function getGifts() {
    try {
      var saved = localStorage.getItem('smartbin_gifts');
      return saved ? JSON.parse(saved) : DEFAULT_GIFTS.slice();
    } catch (e) {
      return DEFAULT_GIFTS.slice();
    }
  }

  function saveGiftsToStorage(gifts) {
    localStorage.setItem('smartbin_gifts', JSON.stringify(gifts));
  }

  function getRedemptions() {
    try {
      var saved = localStorage.getItem('smartbin_redemptions');
      return saved ? JSON.parse(saved) : DEFAULT_REDEMPTIONS.slice();
    } catch (e) {
      return DEFAULT_REDEMPTIONS.slice();
    }
  }

  function renderRates() {
    var rates = getRates();
    if ($('ratePlastic')) $('ratePlastic').value = rates.plastic;
    if ($('rateMetal')) $('rateMetal').value = rates.metal;
    if ($('rateOrganic')) $('rateOrganic').value = rates.organic;

    var multBtns = document.querySelectorAll('.btn-mult-choice');
    multBtns.forEach(function (btn) {
      var val = parseFloat(btn.getAttribute('data-mult'));
      if (val === rates.multiplier) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if ($('statActiveGifts')) {
      var gifts = getGifts().filter(function (g) { return g.status === 'active'; });
      $('statActiveGifts').textContent = gifts.length;
    }
    if ($('statTotalRedemptions')) {
      var redemptions = getRedemptions();
      $('statTotalRedemptions').textContent = redemptions.length;
    }
  }

  function handleSaveRates() {
    var plastic = parseInt($('ratePlastic').value, 10) || 10;
    var metal = parseInt($('rateMetal').value, 10) || 15;
    var organic = parseInt($('rateOrganic').value, 10) || 5;

    var activeMultBtn = document.querySelector('.btn-mult-choice.active');
    var mult = activeMultBtn ? parseFloat(activeMultBtn.getAttribute('data-mult')) : 1.0;

    var rates = {
      plastic: plastic,
      metal: metal,
      organic: organic,
      multiplier: mult
    };

    saveRatesToStorage(rates);
    notify('✓ Đã lưu cấu hình điểm quy đổi thành công!');
    renderRates();
  }

  function handleResetRates() {
    saveRatesToStorage(DEFAULT_RATES);
    renderRates();
    notify('Đã đặt lại quy tắc điểm về mặc định.');
  }

  function renderGiftsTable() {
    var gifts = getGifts();
    var tbody = $('giftTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    gifts.forEach(function (gift, index) {
      var tr = document.createElement('tr');
      var isLow = gift.stock < 20;

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

    if ($('statActiveGifts')) {
      var activeCount = gifts.filter(function (g) { return g.status === 'active'; }).length;
      $('statActiveGifts').textContent = activeCount;
    }
  }

  function renderRedemptionsTable() {
    var logs = getRedemptions();
    var tbody = $('redemptionTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';
    logs.forEach(function (log) {
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
  }

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
      var gifts = getGifts();
      var found = gifts.find(function (g) { return g.id === id; });
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

    var gifts = getGifts();

    if (editingGiftId) {
      var idx = gifts.findIndex(function (g) { return g.id === editingGiftId; });
      if (idx !== -1) {
        gifts[idx].name = name;
        gifts[idx].icon = icon;
        gifts[idx].points = points;
        gifts[idx].stock = stock;
        gifts[idx].desc = desc;
        notify('✓ Đã cập nhật phần quà ' + name + '!');
      }
    } else {
      var newGift = {
        id: Date.now(),
        name: name,
        icon: icon,
        points: points,
        stock: stock,
        desc: desc,
        status: 'active'
      };
      gifts.unshift(newGift);
      notify('✓ Đã thêm phần quà mới ' + name + '!');
    }

    saveGiftsToStorage(gifts);
    renderGiftsTable();
    closeGiftModal();
  }

  function deleteGift(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa phần quà này?')) return;
    var gifts = getGifts().filter(function (g) { return g.id !== id; });
    saveGiftsToStorage(gifts);
    renderGiftsTable();
    notify('Đã xóa phần quà thành công.');
  }

  function toggleGiftStatus(id) {
    var gifts = getGifts();
    var found = gifts.find(function (g) { return g.id === id; });
    if (found) {
      found.status = found.status === 'active' ? 'inactive' : 'active';
      saveGiftsToStorage(gifts);
      renderGiftsTable();
      notify('Đã thay đổi trạng thái phần quà sang: ' + (found.status === 'active' ? 'Mở đổi' : 'Tạm dừng'));
    }
  }

  function init() {
    renderRates();
    renderGiftsTable();
    renderRedemptionsTable();

    // Event listeners
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
    if ($('btnCloseGiftModal') || $('btnCancelGiftModal')) {
      var closeBtns = document.querySelectorAll('#btnCloseGiftModal, #btnCancelGiftModal');
      closeBtns.forEach(function (b) {
        b.addEventListener('click', closeGiftModal);
      });
    }

    // Modal background click
    var modalGift = $('modalGift');
    if (modalGift) {
      modalGift.addEventListener('click', function (e) {
        if (e.target === modalGift) closeGiftModal();
      });
    }

    // Multiplier choices click
    var multBtns = document.querySelectorAll('.btn-mult-choice');
    multBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        multBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    // Delegated actions on gift table
    document.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.btn-edit-gift');
      if (editBtn) {
        var id = parseInt(editBtn.getAttribute('data-id'), 10);
        openGiftModal(id);
      }

      var toggleBtn = e.target.closest('.btn-toggle-gift');
      if (toggleBtn) {
        var tId = parseInt(toggleBtn.getAttribute('data-id'), 10);
        toggleGiftStatus(tId);
      }

      var delBtn = e.target.closest('.btn-delete-gift');
      if (delBtn) {
        var dId = parseInt(delBtn.getAttribute('data-id'), 10);
        deleteGift(dId);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.DoiThuongAdmin = {
    getRates: getRates,
    getGifts: getGifts,
    getRedemptions: getRedemptions,
    renderRates: renderRates,
    renderGiftsTable: renderGiftsTable
  };
})();

