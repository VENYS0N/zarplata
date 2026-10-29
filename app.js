'use strict';

const STORAGE_KEY = 'payroll-calculator-v1';
const THEME_KEY = 'payroll-theme';

const moneyFmt = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const pctFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const qtyFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

const byId = (id) => document.getElementById(id);
const sum = (values) => values.reduce((total, value) => total + value, 0);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function parseNum(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (value == null) return fallback;
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function num(value, fallback = 0) {
  return parseNum(value, fallback);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function money(value) {
  const parsed = Number(value);
  return moneyFmt.format(Number.isFinite(parsed) ? Math.round(parsed) : 0);
}

function pct(value) {
  const parsed = Number(value);
  return `${pctFmt.format(Number.isFinite(parsed) ? parsed : 0)}%`;
}

function qty(value) {
  const parsed = Number(value);
  return qtyFmt.format(Number.isFinite(parsed) ? parsed : 0);
}

function plural(count, one, few, many) {
  const abs = Math.abs(Math.trunc(count));
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function demoState() {
  return {
    settings: {
      period: 'Октябрь 2026',
      workDays: 22,
      ndfl: 13,
      social: 30,
      other: 35000,
    },
    employees: [
      { id: uid(), name: 'Анна Смирнова', position: 'Руководитель производства', salary: 65000, days: 22, bonus: 10 },
      { id: uid(), name: 'Иван Петров', position: 'Столяр-сборщик', salary: 58000, days: 20, bonus: 5 },
      { id: uid(), name: 'Ольга Кузнецова', position: 'Бухгалтер', salary: 48000, days: 22, bonus: 0 },
    ],
    products: [
      { id: uid(), name: 'Стол обеденный «Дуб»', qty: 10, cost: 15000, price: 34900 },
      { id: uid(), name: 'Стул «Скандинавия»', qty: 30, cost: 4200, price: 9900 },
      { id: uid(), name: 'Полка настенная', qty: 20, cost: 2300, price: 5900 },
    ],
    materials: [
      { id: uid(), name: 'Массив дуба', qty: 2, unit: 'м³', price: 42000 },
      { id: uid(), name: 'Лак мебельный', qty: 12, unit: 'л', price: 780 },
      { id: uid(), name: 'Крепёж', qty: 300, unit: 'шт.', price: 42 },
      { id: uid(), name: 'Упаковка', qty: 60, unit: 'шт.', price: 310 },
    ],
  };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Некорректный формат файла');
  }
  const hasKnownKeys = ['settings', 'employees', 'products', 'materials']
    .some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (!hasKnownKeys) {
    throw new Error('Файл не похож на резервную копию калькулятора');
  }

  const source = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const settings = {
    period: typeof source.period === 'string' ? source.period.slice(0, 60) : 'Текущий период',
    workDays: clamp(parseNum(source.workDays, 22), 1, 31),
    ndfl: clamp(parseNum(source.ndfl, 13), 0, 100),
    social: clamp(parseNum(source.social, 30), 0, 100),
    other: Math.max(0, parseNum(source.other, 0)),
  };

  const usedIds = new Set();
  const rowId = (row) => {
    let id = row && row.id != null ? String(row.id) : uid();
    id = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || uid();
    while (usedIds.has(id)) id = uid();
    usedIds.add(id);
    return id;
  };
  const rows = (value) => (Array.isArray(value) ? value : []);

  const employees = rows(raw.employees).map((row) => {
    const item = row && typeof row === 'object' ? row : {};
    return {
      id: rowId(item),
      name: String(item.name ?? '').slice(0, 80),
      position: String(item.position ?? '').slice(0, 80),
      salary: Math.max(0, parseNum(item.salary, 0)),
      days: Math.max(0, parseNum(item.days, 0)),
      bonus: Math.max(0, parseNum(item.bonus, 0)),
    };
  });

  const products = rows(raw.products).map((row) => {
    const item = row && typeof row === 'object' ? row : {};
    return {
      id: rowId(item),
      name: String(item.name ?? '').slice(0, 100),
      qty: Math.max(0, parseNum(item.qty, 0)),
      cost: Math.max(0, parseNum(item.cost, 0)),
      price: Math.max(0, parseNum(item.price, 0)),
    };
  });

  const materials = rows(raw.materials).map((row) => {
    const item = row && typeof row === 'object' ? row : {};
    return {
      id: rowId(item),
      name: String(item.name ?? '').slice(0, 100),
      qty: Math.max(0, parseNum(item.qty, 0)),
      unit: String(item.unit ?? '').slice(0, 12),
      price: Math.max(0, parseNum(item.price, 0)),
    };
  });

  return { settings, employees, products, materials };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeState(JSON.parse(saved));
  } catch (error) {
    console.warn('Не удалось прочитать сохранённые данные', error);
  }
  return demoState();
}

let state = loadState();
let saveTimer = null;
let toastTimer = null;

function calc() {
  const settings = state.settings || {};
  const workDays = Math.max(1, num(settings.workDays, 22));
  const ndflRate = clamp(num(settings.ndfl, 13), 0, 100) / 100;
  const socialRate = clamp(num(settings.social, 30), 0, 100) / 100;

  const employeeRows = state.employees.map((employee) => {
    const salary = Math.max(0, num(employee.salary));
    const days = Math.max(0, num(employee.days));
    const bonus = Math.max(0, num(employee.bonus));
    const gross = salary * (days / workDays) * (1 + bonus / 100);
    const tax = gross * ndflRate;
    return { employee, gross, tax, net: gross - tax };
  });
  const gross = sum(employeeRows.map((row) => row.gross));
  const tax = sum(employeeRows.map((row) => row.tax));
  const net = gross - tax;
  const social = gross * socialRate;

  const productRows = state.products.map((product) => {
    const quantity = Math.max(0, num(product.qty));
    const cost = Math.max(0, num(product.cost));
    const price = Math.max(0, num(product.price));
    const revenue = quantity * price;
    const totalCost = quantity * cost;
    return { product, quantity, revenue, totalCost, profit: revenue - totalCost };
  });
  const revenue = sum(productRows.map((row) => row.revenue));
  const goodsCost = sum(productRows.map((row) => row.totalCost));
  const units = sum(productRows.map((row) => row.quantity));

  const materialRows = state.materials.map((material) => {
    const quantity = Math.max(0, num(material.qty));
    const price = Math.max(0, num(material.price));
    return { material, quantity, total: quantity * price };
  });
  const materialsCost = sum(materialRows.map((row) => row.total));

  const other = Math.max(0, num(settings.other));
  const payrollWithTax = gross + social;
  const expenses = goodsCost + materialsCost + payrollWithTax + other;
  const profit = revenue - expenses;
  const employeesCount = state.employees.length;
  const averageSalary = employeesCount ? gross / employeesCount : 0;
  const profitPerEmployee = employeesCount ? profit / employeesCount : 0;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const payrollShare = revenue > 0 ? (payrollWithTax / revenue) * 100 : 0;
  const materialsShare = revenue > 0 ? (materialsCost / revenue) * 100 : 0;
  const goodsMargin = revenue > 0 ? ((revenue - goodsCost) / revenue) * 100 : 0;

  return {
    employeeRows, gross, tax, net, social, payrollWithTax,
    productRows, revenue, goodsCost, units, goodsMargin,
    materialRows, materialsCost,
    other, expenses, profit, employeesCount, averageSalary, profitPerEmployee,
    margin, payrollShare, materialsShare,
    ndflRatePercent: clamp(num(settings.ndfl, 13), 0, 100),
    socialRatePercent: clamp(num(settings.social, 30), 0, 100),
    workDays,
  };
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function setMoneyCell(id, value, negativeClass = false) {
  const element = byId(id);
  if (!element) return;
  element.textContent = money(value);
  if (negativeClass) element.classList.toggle('negative', value < -0.5);
}

function deleteButton(section, id, label) {
  return `<button type="button" class="row-del" data-delete="${section}" data-id="${id}" aria-label="${esc(label)}" title="${esc(label)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
}

function emptyRow(colspan, title, text) {
  return `<tr class="empty-row"><td colspan="${colspan}"><span class="empty-title">${esc(title)}</span>${esc(text)}</td></tr>`;
}

function renderEmployees() {
  const body = byId('employeesBody');
  if (!state.employees.length) {
    body.innerHTML = emptyRow(9, 'Сотрудников пока нет', 'Нажмите «Добавить», чтобы начать расчёт.');
    return;
  }
  body.innerHTML = state.employees.map((employee) => `
    <tr>
      <td><input class="cell-input cell-name" data-section="employees" data-id="${employee.id}" data-field="name" data-type="text" value="${esc(employee.name)}" placeholder="Имя сотрудника" aria-label="Имя сотрудника"></td>
      <td><input class="cell-input cell-position" data-section="employees" data-id="${employee.id}" data-field="position" data-type="text" value="${esc(employee.position)}" placeholder="Должность" aria-label="Должность"></td>
      <td><input class="cell-input num" type="number" min="0" step="any" data-section="employees" data-id="${employee.id}" data-field="salary" data-type="number" value="${num(employee.salary)}" aria-label="Оклад"></td>
      <td><input class="cell-input num" type="number" min="0" step="any" data-section="employees" data-id="${employee.id}" data-field="days" data-type="number" value="${num(employee.days)}" aria-label="Отработано дней"></td>
      <td><input class="cell-input num" type="number" min="0" step="any" data-section="employees" data-id="${employee.id}" data-field="bonus" data-type="number" value="${num(employee.bonus)}" aria-label="Премия, %"></td>
      <td class="cell-money" id="emp-gross-${employee.id}">—</td>
      <td class="cell-money" id="emp-tax-${employee.id}">—</td>
      <td class="cell-money strong" id="emp-net-${employee.id}">—</td>
      <td class="col-actions">${deleteButton('employees', employee.id, 'Удалить сотрудника')}</td>
    </tr>
  `).join('');
}

function renderProducts() {
  const body = byId('productsBody');
  if (!state.products.length) {
    body.innerHTML = emptyRow(8, 'Товаров пока нет', 'Добавьте товар, его себестоимость и цену продажи.');
    return;
  }
  body.innerHTML = state.products.map((product) => `
    <tr>
      <td><input class="cell-input cell-product" data-section="products" data-id="${product.id}" data-field="name" data-type="text" value="${esc(product.name)}" placeholder="Название товара" aria-label="Название товара"></td>
      <td><input class="cell-input num" type="number" min="0" step="any" data-section="products" data-id="${product.id}" data-field="qty" data-type="number" value="${num(product.qty)}" aria-label="Количество"></td>
      <td><input class="cell-input num" type="number" min="0" step="any" data-section="products" data-id="${product.id}" data-field="cost" data-type="number" value="${num(product.cost)}" aria-label="Себестоимость за единицу"></td>
      <td><input class="cell-input num" type="number" min="0" step="any" data-section="products" data-id="${product.id}" data-field="price" data-type="number" value="${num(product.price)}" aria-label="Цена продажи"></td>
      <td class="cell-money" id="prod-cost-${product.id}">—</td>
      <td class="cell-money" id="prod-revenue-${product.id}">—</td>
      <td class="cell-money strong" id="prod-profit-${product.id}">—</td>
      <td class="col-actions">${deleteButton('products', product.id, 'Удалить товар')}</td>
    </tr>
  `).join('');
}

function renderMaterials() {
  const body = byId('materialsBody');
  if (!state.materials.length) {
    body.innerHTML = emptyRow(6, 'Материалов пока нет', 'Добавьте материалы и закупки, чтобы учесть их в расходах.');
    return;
  }
  body.innerHTML = state.materials.map((material) => `
    <tr>
      <td><input class="cell-input cell-material" data-section="materials" data-id="${material.id}" data-field="name" data-type="text" value="${esc(material.name)}" placeholder="Название материала" aria-label="Название материала"></td>
      <td><input class="cell-input num" type="number" min="0" step="any" data-section="materials" data-id="${material.id}" data-field="qty" data-type="number" value="${num(material.qty)}" aria-label="Количество"></td>
      <td><input class="cell-input cell-unit" data-section="materials" data-id="${material.id}" data-field="unit" data-type="text" value="${esc(material.unit)}" placeholder="шт." aria-label="Единица измерения"></td>
      <td><input class="cell-input num" type="number" min="0" step="any" data-section="materials" data-id="${material.id}" data-field="price" data-type="number" value="${num(material.price)}" aria-label="Цена за единицу"></td>
      <td class="cell-money" id="mat-total-${material.id}">—</td>
      <td class="col-actions">${deleteButton('materials', material.id, 'Удалить материал')}</td>
    </tr>
  `).join('');
}

function updateEmployeeTable(result) {
  result.employeeRows.forEach(({ employee, gross, tax, net }) => {
    const grossCell = byId(`emp-gross-${employee.id}`);
    const taxCell = byId(`emp-tax-${employee.id}`);
    const netCell = byId(`emp-net-${employee.id}`);
    if (grossCell) grossCell.textContent = money(gross);
    if (taxCell) taxCell.textContent = money(tax);
    if (netCell) netCell.textContent = money(net);
  });

  setText('empFootGross', money(result.gross));
  setText('empFootTax', money(result.tax));
  setText('empFootNet', money(result.net));
  setText('employeesCount', String(state.employees.length));

  const hasEmployees = state.employees.length > 0;
  const table = byId('employeesTable');
  if (table) table.querySelector('tfoot').hidden = !hasEmployees;
  const note = byId('empNote');
  if (note) {
    note.hidden = !hasEmployees;
    if (hasEmployees) {
      note.innerHTML = `Страховые взносы (${pct(result.socialRatePercent)}): <b>${money(result.social)}</b> · ФОТ с взносами: <b>${money(result.payrollWithTax)}</b>`;
    }
  }
}

function updateProductTable(result) {
  result.productRows.forEach(({ product, revenue, totalCost, profit }) => {
    const costCell = byId(`prod-cost-${product.id}`);
    const revenueCell = byId(`prod-revenue-${product.id}`);
    const profitCell = byId(`prod-profit-${product.id}`);
    if (costCell) costCell.textContent = money(totalCost);
    if (revenueCell) revenueCell.textContent = money(revenue);
    if (profitCell) {
      profitCell.textContent = money(profit);
      profitCell.classList.toggle('negative', profit < -0.5);
    }
  });

  setText('prodFootCost', money(result.goodsCost));
  setText('prodFootRevenue', money(result.revenue));
  setText('prodFootProfit', money(result.revenue - result.goodsCost));
  setText('productsCount', String(state.products.length));

  const hasProducts = state.products.length > 0;
  const table = byId('productsTable');
  if (table) table.querySelector('tfoot').hidden = !hasProducts;
  const note = byId('prodNote');
  if (note) {
    note.hidden = !hasProducts;
    if (hasProducts) {
      note.innerHTML = `Валовая прибыль: <b>${money(result.revenue - result.goodsCost)}</b> · маржа <b>${pct(result.goodsMargin)}</b> · материалы учитываются отдельно`;
    }
  }
}

function updateMaterialTable(result) {
  result.materialRows.forEach(({ material, total }) => {
    const cell = byId(`mat-total-${material.id}`);
    if (cell) cell.textContent = money(total);
  });

  setText('matFootTotal', money(result.materialsCost));
  setText('materialsCount', String(state.materials.length));

  const hasMaterials = state.materials.length > 0;
  const table = byId('materialsTable');
  if (table) table.querySelector('tfoot').hidden = !hasMaterials;
  const note = byId('matNote');
  if (note) {
    note.hidden = !hasMaterials;
    if (hasMaterials) {
      const share = result.revenue > 0 ? ` · <b>${pct(result.materialsShare)}</b> от выручки` : '';
      note.innerHTML = `Материалы и закупки: <b>${money(result.materialsCost)}</b>${share}`;
    }
  }
}

function updateHero(result) {
  const period = String(state.settings.period || '').trim();
  setText('heroTitle', period ? `Расчёт зарплаты — ${period}` : 'Расчёт зарплаты и прибыли');
  setText('heroEmployees', `${result.employeesCount} ${plural(result.employeesCount, 'сотрудник', 'сотрудника', 'сотрудников')}`);
  setText('heroProducts', `${state.products.length} ${plural(state.products.length, 'товар', 'товара', 'товаров')}`);
  setText('heroMaterials', `${state.materials.length} ${plural(state.materials.length, 'материал', 'материала', 'материалов')}`);
}

function updateSummary(result) {
  setText('kpiRevenue', money(result.revenue));
  setText('kpiRevenueSub', result.units > 0
    ? `${qty(result.units)} ед. · ${state.products.length} ${plural(state.products.length, 'позиция', 'позиции', 'позиций')}`
    : 'Добавьте товары и цены');

  setText('kpiExpenses', money(result.expenses));
  setText('kpiExpensesSub', result.expenses > 0
    ? `в т.ч. материалы ${money(result.materialsCost)}`
    : 'Расходы пока не заполнены');

  setText('kpiPayroll', money(result.gross));
  setText('kpiPayrollSub', result.employeesCount > 0
    ? `НДФЛ ${money(result.tax)} · на руки ${money(result.net)}`
    : 'Добавьте сотрудников');

  setText('kpiProfit', money(result.profit));
  setText('kpiProfitSub', result.revenue > 0
    ? `Рентабельность ${pct(result.margin)}`
    : 'Нет данных о выручке');
  const profitCard = byId('kpiProfitCard');
  if (profitCard) profitCard.classList.toggle('is-negative', result.profit < -0.5);

  setText('expenseTotal', money(result.expenses));
  const bars = byId('expenseBars');
  if (bars) {
    if (result.expenses <= 0) {
      bars.innerHTML = '<div class="empty-note">Пока нет расходов для отображения.</div>';
    } else {
      const categories = [
        { label: 'Себестоимость товаров', value: result.goodsCost, tone: 'bar-goods' },
        { label: 'Материалы', value: result.materialsCost, tone: 'bar-materials' },
        { label: 'Зарплаты', value: result.gross, tone: 'bar-payroll' },
        { label: 'Страховые взносы', value: result.social, tone: 'bar-social' },
        { label: 'Прочие расходы', value: result.other, tone: 'bar-other' },
      ].filter((category) => category.value > 0);
      bars.innerHTML = categories.map((category) => {
        const share = (category.value / result.expenses) * 100;
        return `<div class="bar-row ${category.tone}">
          <div class="bar-head"><span>${category.label}</span><b>${money(category.value)}<span class="bar-share">${pct(share)}</span></b></div>
          <div class="bar-track"><span class="bar-fill" style="width:${share.toFixed(2)}%"></span></div>
        </div>`;
      }).join('');
    }
  }

  setText('statEmployees', String(result.employeesCount));
  setText('statEmployeesSub', result.employeesCount > 0
    ? `средняя зарплата ${money(result.averageSalary)}`
    : 'добавьте сотрудников');

  setText('statProfitPer', result.employeesCount > 0 ? money(result.profitPerEmployee) : '—');
  setText('statProfitPerSub', result.employeesCount > 0
    ? `при ${result.employeesCount} ${plural(result.employeesCount, 'сотруднике', 'сотрудниках', 'сотрудниках')}`
    : 'нужен хотя бы один сотрудник');
  const profitPer = byId('statProfitPer');
  if (profitPer) profitPer.classList.toggle('neg', result.profitPerEmployee < -0.5);

  setText('statPayrollShare', result.revenue > 0 ? pct(result.payrollShare) : '—');
  setText('statPayrollShareSub', 'ФОТ с взносами к выручке');

  setText('statMaterialsShare', result.revenue > 0 ? pct(result.materialsShare) : '—');
  setText('statMaterialsShareSub', 'доля материалов в выручке');

  const insight = byId('insight');
  if (insight) {
    const isEmpty = !state.employees.length && !state.products.length && !state.materials.length;
    if (isEmpty) {
      insight.className = 'insight is-muted';
      insight.textContent = 'Добавьте сотрудников, товары и материалы — все показатели пересчитаются автоматически.';
    } else if (result.profit < 0) {
      insight.className = 'insight is-warning';
      insight.textContent = `Расходы превышают выручку на ${money(Math.abs(result.profit))}. Проверьте цены, себестоимость и фонд оплаты труда.`;
    } else {
      insight.className = 'insight';
      insight.textContent = `Чистая прибыль после всех расходов — ${money(result.profit)} (${pct(result.margin)} от выручки).`;
    }
  }
}

function refreshAll() {
  const result = calc();
  updateHero(result);
  updateSummary(result);
  updateEmployeeTable(result);
  updateProductTable(result);
  updateMaterialTable(result);
}

function renderAll() {
  renderEmployees();
  renderProducts();
  renderMaterials();
  refreshAll();
}

function fillSettings() {
  byId('setPeriod').value = state.settings.period;
  byId('setWorkDays').value = state.settings.workDays;
  byId('setNdfl').value = state.settings.ndfl;
  byId('setSocial').value = state.settings.social;
  byId('setOther').value = state.settings.other;
}

function setSaveState(mode) {
  const element = byId('saveState');
  if (!element) return;
  element.classList.remove('saving', 'error');
  if (mode === 'saving') {
    element.classList.add('saving');
    element.textContent = 'Сохранение…';
  } else if (mode === 'error') {
    element.classList.add('error');
    element.textContent = 'Не сохранено';
  } else {
    element.textContent = 'Сохранено';
  }
}

function persistNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveState('saved');
  } catch (error) {
    console.error('Не удалось сохранить данные', error);
    setSaveState('error');
  }
}

function scheduleSave() {
  setSaveState('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 350);
}

function toast(message, variant = 'info') {
  const element = byId('toast');
  if (!element) return;
  element.textContent = message;
  element.classList.remove('show', 'error');
  if (variant === 'error') element.classList.add('error');
  void element.offsetWidth;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 3200);
}

function handleInput(event) {
  const element = event.target;
  if (!(element instanceof HTMLInputElement)) return;

  if (element.dataset.setting) {
    const key = element.dataset.setting;
    state.settings[key] = element.dataset.type === 'number'
      ? parseNum(element.value, 0)
      : element.value;
    scheduleSave();
    refreshAll();
    return;
  }

  const { section, id, field, type } = element.dataset;
  if (!section || !id || !field) return;
  const collection = state[section];
  if (!Array.isArray(collection)) return;
  const item = collection.find((row) => row.id === id);
  if (!item) return;

  item[field] = type === 'number' ? parseNum(element.value, 0) : element.value;
  scheduleSave();
  refreshAll();
}

function focusNewRow(section, id) {
  requestAnimationFrame(() => {
    const input = document.querySelector(`[data-section="${section}"][data-id="${id}"][data-field="name"]`);
    if (input) input.focus();
  });
}

function addRow(section) {
  let row;
  if (section === 'employees') {
    row = {
      id: uid(),
      name: '',
      position: '',
      salary: 0,
      days: num(state.settings.workDays, 22) || 22,
      bonus: 0,
    };
    state.employees.push(row);
    renderEmployees();
  } else if (section === 'products') {
    row = { id: uid(), name: '', qty: 1, cost: 0, price: 0 };
    state.products.push(row);
    renderProducts();
  } else if (section === 'materials') {
    row = { id: uid(), name: '', qty: 1, unit: 'шт.', price: 0 };
    state.materials.push(row);
    renderMaterials();
  } else {
    return;
  }

  refreshAll();
  scheduleSave();
  focusNewRow(section, row.id);
}

function deleteRow(section, id) {
  if (!Array.isArray(state[section])) return;
  state[section] = state[section].filter((row) => row.id !== id);
  if (section === 'employees') renderEmployees();
  if (section === 'products') renderProducts();
  if (section === 'materials') renderMaterials();
  refreshAll();
  scheduleSave();
}

function handleClick(event) {
  const addButton = event.target.closest('[data-add]');
  if (addButton) {
    addRow(addButton.dataset.add);
    return;
  }

  const deleteBtn = event.target.closest('[data-delete]');
  if (deleteBtn) {
    deleteRow(deleteBtn.dataset.delete, deleteBtn.dataset.id);
    return;
  }

  const navButton = event.target.closest('[data-scroll]');
  if (navButton) {
    const target = byId(navButton.dataset.scroll);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function loadDemo() {
  if (!confirm('Заполнить таблицы примером? Текущие данные будут заменены.')) return;
  state = demoState();
  fillSettings();
  renderAll();
  persistNow();
  toast('Пример данных загружен');
}

function clearData() {
  if (!confirm('Удалить всех сотрудников, товары и материалы? Настройки расчёта сохранятся.')) return;
  state.employees = [];
  state.products = [];
  state.materials = [];
  renderAll();
  persistNow();
  toast('Все строки удалены');
}

function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `zarplata-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast('Резервная копия скачана');
}

async function importData(event) {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    state = normalizeState(parsed);
    fillSettings();
    renderAll();
    persistNow();
    toast('Данные загружены из файла');
  } catch (error) {
    console.error(error);
    toast(error && error.message ? `Ошибка импорта: ${error.message}` : 'Не удалось прочитать файл', 'error');
  }
}

function updateThemeUI() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const button = byId('themeToggle');
  if (button) {
    const label = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }
  const meta = byId('themeColor');
  if (meta) meta.setAttribute('content', isDark ? '#0b1210' : '#f3f6f4');
}

function applyTheme(theme, persist = true) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = normalized;
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, normalized);
    } catch (error) {
      console.warn('Не удалось сохранить тему', error);
    }
  }
  updateThemeUI();
}

function wireTheme() {
  updateThemeUI();

  const button = byId('themeToggle');
  if (button) {
    button.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (media && typeof media.addEventListener === 'function') {
    media.addEventListener('change', (event) => {
      let saved = null;
      try {
        saved = localStorage.getItem(THEME_KEY);
      } catch (error) {
        saved = null;
      }
      if (!saved) applyTheme(event.matches ? 'dark' : 'light', false);
    });
  }
}

function wireEvents() {
  document.addEventListener('input', handleInput);
  document.addEventListener('click', handleClick);
  wireTheme();

  byId('printBtn').addEventListener('click', () => window.print());
  byId('exportBtn').addEventListener('click', exportData);
  byId('importBtn').addEventListener('click', () => byId('importFile').click());
  byId('importFile').addEventListener('change', importData);
  byId('demoBtn').addEventListener('click', loadDemo);
  byId('clearBtn').addEventListener('click', clearData);

  window.addEventListener('pagehide', () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Не удалось сохранить данные при закрытии', error);
    }
  });
}

function init() {
  fillSettings();
  renderAll();
  wireEvents();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveState('saved');
  } catch (error) {
    console.warn('Локальное хранилище недоступно', error);
    setSaveState('error');
  }
}

init();
