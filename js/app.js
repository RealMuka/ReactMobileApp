'use strict';

/* ==================== 1. Константы и справочные данные ==================== */

const STORAGE_KEY = 'fitcaloria_simple_v2';

const MEAL_TITLES = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус'
};

// Приёмы пищи, которые показываются в дневнике (перекус виден только в диалоге добавления).
const MEAL_KEYS = Object.keys(MEAL_TITLES);
const DIARY_MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];

const NUTRITION_KEYS = ['calories', 'protein', 'fats', 'carbs'];

// Связь между макросами дневника, нормами и элементами на экране.
const MACROS = [
  { key: 'protein', targetKey: 'proteins', eatenId: 'proteinEaten', goalId: 'proteinGoal', progressId: 'proteinProgress' },
  { key: 'fats', targetKey: 'fats', eatenId: 'fatsEaten', goalId: 'fatsGoal', progressId: 'fatsProgress' },
  { key: 'carbs', targetKey: 'carbs', eatenId: 'carbsEaten', goalId: 'carbsGoal', progressId: 'carbsProgress' }
];

const LIMITS = {
  weight: { min: 20, max: 350 },
  height: { min: 100, max: 250 },
  age: { min: 14, max: 100 },
  bodyFat: { min: 3, max: 60 },
  portion: { min: 1, max: 3000 },
  waist: { min: 30, max: 250 },
  macrosPer100g: 100
};

const GOAL_DEFICIT = -15;

// Белок: 2 г/кг безжировой массы, при дефиците калорий — 2,3 г/кг.
const PROTEIN_FACTOR_BASE = 2;
const PROTEIN_FACTOR_DEFICIT = 2.3;
// Жиры: ориентир 0,8 г/кг безжировой массы, углеводы заполняют оставшиеся калории.
const FAT_FACTOR = 0.8;

const CHART_MAX_POINTS = 14;
const CHART_MIN_RANGE = 2;
const TOAST_TIMEOUT_MS = 2600;

const DEFAULT_PRODUCTS = [
  { id: 1, name: 'Творог 5%', protein: 17, fats: 5, carbs: 1.8, calories: 121 },
  { id: 2, name: 'Куриное филе', protein: 23.5, fats: 1.9, carbs: 0, calories: 113 },
  { id: 3, name: 'Гречка варёная', protein: 3.6, fats: 1.2, carbs: 17.1, calories: 92 },
  { id: 4, name: 'Овсяные хлопья', protein: 13.2, fats: 6.5, carbs: 55.7, calories: 366 },
  { id: 5, name: 'Яйцо куриное', protein: 12.7, fats: 10.9, carbs: 0.7, calories: 157 },
  { id: 6, name: 'Банан', protein: 1.1, fats: 0.3, carbs: 22.8, calories: 89 },
  { id: 7, name: 'Рис варёный', protein: 2.7, fats: 0.3, carbs: 28, calories: 130 },
  { id: 8, name: 'Молоко 2.5%', protein: 3, fats: 2.5, carbs: 4.7, calories: 52 },
  { id: 9, name: 'Йогурт натуральный', protein: 4.3, fats: 3.2, carbs: 6.2, calories: 68 },
  { id: 10, name: 'Протеиновый коктейль', protein: 24, fats: 1.5, carbs: 2.5, calories: 120 },
  { id: 11, name: 'Яблоко', protein: 0.3, fats: 0.2, carbs: 13.8, calories: 52 },
  { id: 12, name: 'Хлеб цельнозерновой', protein: 9, fats: 3.5, carbs: 41, calories: 247 }
];

/* ==================== 2. Состояние приложения ==================== */

let state = loadState();
let selectedProductId = null;
let preferredMeal = 'breakfast';
let activeChart = 'weight';
let toastTimeout = null;

/* ==================== 3. Работа с localStorage ==================== */

function loadState() {
  const defaults = createInitialState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return defaults;
    return {
      ...defaults,
      ...saved,
      user: { ...defaults.user, ...(saved.user || {}) },
      targets: { ...defaults.targets, ...(saved.targets || {}) },
      products: Array.isArray(saved.products) && saved.products.length ? saved.products : defaults.products,
      diary: { ...defaults.diary, ...(saved.diary || {}) },
      weights: Array.isArray(saved.weights) ? saved.weights : [],
      waist: Array.isArray(saved.waist) ? saved.waist : []
    };
  } catch (error) {
    return defaults;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    showToast('Не удалось сохранить данные в браузере.');
  }
}

function createInitialState() {
  return {
    user: {
      weight: 70,
      height: 175,
      age: 22,
      gender: 'male',
      bodyFat: '',
      activity: 1.375,
      goal: GOAL_DEFICIT,
      desktopMode: false,
      darkMode: false
    },
    targets: { calories: 2000, proteins: 120, fats: 60, carbs: 250 },
    products: structuredClone(DEFAULT_PRODUCTS),
    diary: createEmptyDiary(),
    weights: [],
    waist: []
  };
}

function createEmptyDiary() {
  return Object.fromEntries(MEAL_KEYS.map(key => [key, []]));
}

/* ==================== 4. Утилиты ==================== */

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function setValue(id, value) {
  const element = byId(id);
  if (element) element.value = value;
}

function toNumber(value) {
  return Number(value) || 0;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function isOutOfRange(value, { min, max }) {
  return value < min || value > max;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function today() {
  return new Date().toLocaleDateString('ru-RU');
}

/* ==================== 5. Расчёты питания ==================== */

function emptyNutrition() {
  return { calories: 0, protein: 0, fats: 0, carbs: 0 };
}

// Итог по продукту с учётом веса порции в граммах.
function nutritionFor(product, weight) {
  const ratio = weight / 100;
  return {
    calories: product.calories * ratio,
    protein: product.protein * ratio,
    fats: product.fats * ratio,
    carbs: product.carbs * ratio
  };
}

function totalForMeal(meal) {
  return state.diary[meal].reduce((sum, item) => {
    const nutrition = nutritionFor(item, item.weight);
    NUTRITION_KEYS.forEach(key => {
      sum[key] += nutrition[key];
    });
    return sum;
  }, emptyNutrition());
}

function getDailyTotals() {
  return MEAL_KEYS.reduce((sum, meal) => {
    const mealTotal = totalForMeal(meal);
    NUTRITION_KEYS.forEach(key => {
      sum[key] += mealTotal[key];
    });
    return sum;
  }, emptyNutrition());
}

/* ==================== 6. Отрисовка дневника ==================== */

function setProgress(id, current, target) {
  const element = byId(id);
  if (!element) return;
  const percent = target > 0 ? (current / target) * 100 : 0;
  element.style.width = `${Math.min(100, percent)}%`;
}

function updateDashboard() {
  const totals = getDailyTotals();
  const targets = state.targets;

  setText('caloriesEaten', Math.round(totals.calories));
  setText('caloriesGoal', Math.round(targets.calories));
  setText('caloriesLeft', `${Math.max(0, Math.round(targets.calories - totals.calories))} ккал`);
  setText('caloriePercent', `${Math.round(totals.calories / Math.max(1, targets.calories) * 100)}%`);
  setProgress('calorieProgress', totals.calories, targets.calories);

  MACROS.forEach(macro => {
    const eaten = totals[macro.key];
    const goal = targets[macro.targetKey];
    setText(macro.eatenId, Math.round(eaten));
    setText(macro.goalId, Math.round(goal));
    setProgress(macro.progressId, eaten, goal);
  });

  renderMeals();
}

function renderMeals() {
  const root = byId('mealList');
  if (!root) return;
  root.innerHTML = DIARY_MEAL_KEYS.map(renderMealCard).join('');
}

function renderMealCard(mealKey) {
  const total = totalForMeal(mealKey);
  const items = state.diary[mealKey].map((item, index) => renderFoodRow(item, index, mealKey)).join('');
  const summary = `${Math.round(total.calories)} ккал · Б ${Math.round(total.protein)} г · Ж ${Math.round(total.fats)} г · У ${Math.round(total.carbs)} г`;
  const empty = '<div class="empty-state">Пока ничего не добавлено</div>';

  return `
    <article class="meal-card">
      <div class="meal-header">
        <div>
          <div class="meal-title">${MEAL_TITLES[mealKey]}</div>
          <div class="meal-total">${summary}</div>
        </div>
        <button class="text-button" data-add-meal="${mealKey}">+ Добавить</button>
      </div>
      <div class="meal-items">${items || empty}</div>
    </article>`;
}

function renderFoodRow(item, index, mealKey) {
  const nutrition = nutritionFor(item, item.weight);
  const name = escapeHtml(item.name);
  const details = `${round(item.weight)} г · Б ${round(nutrition.protein)} г · Ж ${round(nutrition.fats)} г · У ${round(nutrition.carbs)} г`;
  const removeButton = `<button class="remove-button" data-remove-meal="${mealKey}" data-remove-index="${index}" aria-label="Удалить ${name}">×</button>`;

  return `
    <div class="food-row">
      <div>
        <div class="food-row-name">${name}</div>
        <div class="food-row-detail">${details}</div>
      </div>
      <div class="food-row-right"><strong>${Math.round(nutrition.calories)} ккал</strong>${removeButton}</div>
    </div>`;
}

/* ==================== 7. Отрисовка каталога продуктов ==================== */

function renderFoods() {
  const container = byId('foodResults');
  const search = byId('foodSearch');
  if (!container || !search) return;

  const query = search.value.trim().toLocaleLowerCase('ru');
  const products = state.products.filter(product => product.name.toLocaleLowerCase('ru').includes(query));
  const empty = '<div class="empty-state">Ничего не найдено. Попробуй другое название или добавь свой продукт.</div>';

  container.innerHTML = products.length ? products.map(renderFoodResult).join('') : empty;
}

function renderFoodResult(product) {
  const summary = `${product.calories} ккал · Б ${product.protein} г · Ж ${product.fats} г · У ${product.carbs} г на 100 г`;

  return `
    <button class="food-result" data-select-product="${product.id}">
      <span><strong>${escapeHtml(product.name)}</strong><small>${summary}</small></span>
      <span class="   -circle">+</span>
      <span class="delete-food">-</span>
    </button>`;
}

/* ==================== 8. Отрисовка статистики ==================== */

function renderWeights() {
  const weights = state.weights;
  const waists = state.waist || [];
  const entries = activeChart === 'weight' ? weights : waists;
  const unit = activeChart === 'weight' ? 'кг' : 'см';

  setText('weightCount', weights.length);
  setText('waistCount', waists.length);
  setText('currentWeight', latestMeasurement(weights, 'кг'));
  setText('currentWaist', latestMeasurement(waists, 'см'));

  updateChartTabs();
  updateMeasurementForm();
  renderChart(entries, unit);
  renderHistory(entries, unit);
}

function latestMeasurement(entries, unit) {
  if (!entries.length) return `— ${unit}`;
  return `${round(entries[entries.length - 1].value)} ${unit}`;
}

function updateChartTabs() {
  document.querySelectorAll('[data-chart]').forEach(button => {
    button.classList.toggle('active', button.dataset.chart === activeChart);
  });
}

function updateMeasurementForm() {
  const isWeight = activeChart === 'weight';
  setText('measurementTitle', isWeight ? 'Добавить вес' : 'Добавить обхват талии');
  setText('measurementDescription', isWeight
    ? 'Записывай вес, чтобы отслеживать изменения.'
    : 'Измеряй талию примерно в одинаковых условиях.');
  byId('weightForm').classList.toggle('hidden', !isWeight);
  byId('waistForm').classList.toggle('hidden', isWeight);
}

function renderChart(entries, unit) {
  const chart = byId('progressChart');
  const empty = byId('chartEmpty');
  if (!chart || !empty) return;

  chart.innerHTML = '';
  if (!entries.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const visible = entries.slice(-CHART_MAX_POINTS);
  const values = visible.map(item => Number(item.value));
  const min = Math.min(...values);
  const range = Math.max(Math.max(...values) - min, CHART_MIN_RANGE);

  chart.innerHTML = visible
    .map((item, index) => renderChartBar(item, index, visible.length, min, range, unit))
    .join('');
}

function renderChartBar(item, index, total, min, range, unit) {
  const value = Number(item.value);
  const height = 9 + ((value - min) / range) * 78;
  const label = chartDateLabel(item.date);
  const latest = index === total - 1 ? ' latest' : '';

  return `
    <div class="chart-bar-item${latest}">
      <div class="chart-bar-value">${round(value)}${unit}</div>
      <div class="chart-bar" style="height:${height}%" title="${escapeHtml(item.date)}: ${round(value)} ${unit}"></div>
      <div class="chart-date">${escapeHtml(label)}</div>
    </div>`;
}

function chartDateLabel(date) {
  const parts = String(date).split('.');
  return parts.length >= 2 ? parts[0] : date;
}

function renderHistory(entries, unit) {
  const container = byId('weightHistory');
  if (!container) return;

  const history = entries.slice().reverse();
  const empty = '<p class="muted small-text">Пока нет записей. Добавь первое измерение выше.</p>';

  container.innerHTML = history.length
    ? history.map(item => `
        <div class="history-item">
          <span>${escapeHtml(item.date)}</span>
          <strong>${round(item.value)} ${unit}</strong>
        </div>`).join('')
    : empty;
}

/* ==================== 9. Навигация, тема и уведомления ==================== */

function navigate(screen) {
  document.querySelectorAll('.screen').forEach(section => {
    section.classList.toggle('hidden', section.id !== `screen-${screen}`);
  });
  document.querySelectorAll('[data-screen]').forEach(link => {
    link.classList.toggle('active', link.dataset.screen === screen);
  });
  if (screen === 'foods') renderFoods();
  if (screen === 'stats') renderWeights();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyAppearance() {
  document.body.classList.toggle('dark', Boolean(state.user.darkMode));
  document.body.classList.toggle('force-desktop', Boolean(state.user.desktopMode));
}

function showToast(message) {
  const toast = byId('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), TOAST_TIMEOUT_MS);
}

/* ==================== 10. Настройки и расчёт норм ==================== */

function readUserForm() {
  const bodyFatInput = byId('bodyFat').value.trim();
  return {
    weight: toNumber(byId('userWeight').value),
    height: toNumber(byId('userHeight').value),
    age: toNumber(byId('userAge').value),
    gender: byId('userGender').value,
    bodyFat: bodyFatInput === '' ? null : Number(bodyFatInput),
    activity: toNumber(byId('activity').value),
    goal: toNumber(document.querySelector('input[name="goal"]:checked')?.value)
  };
}

// Возвращает текст ошибки или null, если данные корректны.
function validateUserForm(user) {
  if (isOutOfRange(user.weight, LIMITS.weight)
    || isOutOfRange(user.height, LIMITS.height)
    || isOutOfRange(user.age, LIMITS.age)) {
    return 'Проверь вес, рост и возраст.';
  }
  if (user.bodyFat !== null && (!Number.isFinite(user.bodyFat) || isOutOfRange(user.bodyFat, LIMITS.bodyFat))) {
    return 'Процент жира должен быть от 3 до 60.';
  }
  return null;
}

function calculateMetabolism(user) {
  if (user.bodyFat !== null) {
    const leanMass = user.weight * (1 - user.bodyFat / 100);
    return {
      bmr: 370 + 21.6 * leanMass,
      leanMass,
      method: `Использована формула Katch–McArdle. Безжировая масса: ${round(leanMass)} кг. Основной обмен — оценка, а не точное измерение.`
    };
  }

  const genderOffset = user.gender === 'male' ? 5 : -161;
  return {
    bmr: 10 * user.weight + 6.25 * user.height - 5 * user.age + genderOffset,
    leanMass: null,
    method: 'Процент жира не указан, поэтому использована формула Mifflin–St Jeor. Укажи процент жира, если хочешь считать нормы с учётом безжировой массы.'
  };
}

function calculateTargets(user, metabolism) {
  const calories = Math.round(metabolism.bmr * user.activity * (1 + user.goal / 100));
  const massBase = metabolism.leanMass === null ? user.weight : metabolism.leanMass;
  const proteinFactor = user.goal === GOAL_DEFICIT ? PROTEIN_FACTOR_DEFICIT : PROTEIN_FACTOR_BASE;
  const proteins = Math.round(massBase * proteinFactor);
  const fats = Math.round(massBase * FAT_FACTOR);
  const carbs = Math.max(0, Math.round((calories - proteins * 4 - fats * 9) / 4));

  return { calories, proteins, fats, carbs };
}

function applyUserForm() {
  const user = readUserForm();
  const error = validateUserForm(user);
  if (error) {
    showToast(error);
    return;
  }

  const metabolism = calculateMetabolism(user);
  const targets = calculateTargets(user, metabolism);

  state.user = { ...state.user, ...user, bodyFat: user.bodyFat === null ? '' : user.bodyFat };
  state.targets = targets;
  saveState();
  setText('calculationInfo', metabolism.method);
  updateDashboard();
  showToast('Суточная норма рассчитана.');
}

function fillSettings() {
  const user = state.user;
  setValue('userWeight', user.weight);
  setValue('userHeight', user.height);
  setValue('userAge', user.age);
  setValue('userGender', user.gender);
  setValue('bodyFat', user.bodyFat);
  setValue('activity', String(user.activity));

  const goalInput = document.querySelector(`input[name="goal"][value="${user.goal}"]`);
  if (goalInput) goalInput.checked = true;

  byId('desktopMode').checked = Boolean(user.desktopMode);
  byId('darkMode').checked = Boolean(user.darkMode);
  setText('calculationInfo', describeCurrentCalculation(user));
}

function describeCurrentCalculation(user) {
  if (user.bodyFat === '') {
    return 'Процент жира не указан: расчёт калорий использует вес, рост, возраст и пол.';
  }
  const leanMass = user.weight * (1 - Number(user.bodyFat) / 100);
  return `Текущий расчёт учитывает безжировую массу: ${round(leanMass)} кг.`;
}

/* ==================== 11. Работа с дневником и продуктами ==================== */

function openAddDialog(productId, meal = 'breakfast') {
  const product = state.products.find(item => item.id === Number(productId));
  if (!product) return;

  selectedProductId = product.id;
  setText('dialogFoodName', product.name);
  setValue('portionWeight', 100);
  setValue('mealSelect', meal);
  updatePortionInfo();
  byId('addFoodDialog').showModal();
}

function updatePortionInfo() {
  const product = state.products.find(item => item.id === selectedProductId);
  if (!product) return;

  const weight = Math.max(0, toNumber(byId('portionWeight').value));
  const nutrition = nutritionFor(product, weight);
  setText('portionInfo', `${Math.round(nutrition.calories)} ккал · Белки ${round(nutrition.protein)} г · Жиры ${round(nutrition.fats)} г · Углеводы ${round(nutrition.carbs)} г`);
}

function addProductToDiary(product, weight, meal) {
  state.diary[meal].push({ ...product, weight: Number(weight) });
  saveState();
  updateDashboard();
  showToast(`${product.name} добавлен в дневник`);
}

function removeDiaryItem(meal, index) {
  state.diary[meal].splice(index, 1);
  saveState();
  updateDashboard();
  showToast('Продукт удалён из дневника.');
}

function resetDiary() {
  state.diary = createEmptyDiary();
  saveState();
  updateDashboard();
  showToast('Дневник очищен.');
}

function addCustomProduct(product) {
  state.products.push(product);
  saveState();
  renderFoods();
}

/* ==================== 12. Обработчики событий ==================== */

function goToFoodSearch(meal = 'breakfast') {
  preferredMeal = meal;
  navigate('foods');
  byId('foodSearch').focus();
}

function handleMealListClick(event) {
  const addButton = event.target.closest('[data-add-meal]');
  if (addButton) {
    goToFoodSearch(addButton.dataset.addMeal);
    return;
  }

  const removeButton = event.target.closest('[data-remove-meal]');
  if (removeButton) {
    removeDiaryItem(removeButton.dataset.removeMeal, Number(removeButton.dataset.removeIndex));
  }
}

function handleFoodResultsClick(event) {
  const button = event.target.closest('[data-select-product]');
  if (button) openAddDialog(button.dataset.selectProduct, preferredMeal);
}

function handleAddFoodSubmit(event) {
  event.preventDefault();
  const product = state.products.find(item => item.id === selectedProductId);
  const weight = toNumber(byId('portionWeight').value);
  if (!product || isOutOfRange(weight, LIMITS.portion)) {
    showToast('Укажи порцию от 1 до 3000 г.');
    return;
  }
  addProductToDiary(product, weight, byId('mealSelect').value);
  byId('addFoodDialog').close();
}

function handleNewProductSubmit(event) {
  event.preventDefault();
  const product = {
    id: Date.now(),
    name: byId('customName').value.trim(),
    calories: toNumber(byId('customCalories').value),
    protein: toNumber(byId('customProtein').value),
    fats: toNumber(byId('customFats').value),
    carbs: toNumber(byId('customCarbs').value)
  };
  if (!product.name) {
    showToast('Укажи название продукта.');
    return;
  }
  if (product.protein + product.fats + product.carbs > LIMITS.macrosPer100g) {
    showToast('Сумма БЖУ на 100 г не может превышать 100 г.');
    return;
  }
  addCustomProduct(product);
  byId('newProductDialog').close();
  event.target.reset();
  showToast('Продукт сохранён.');
}

function handleWeightSubmit(event) {
  event.preventDefault();
  const value = toNumber(byId('newWeight').value);
  if (isOutOfRange(value, LIMITS.weight)) {
    showToast('Укажи вес от 20 до 350 кг.');
    return;
  }
  state.weights.push({ value, date: today() });
  state.user.weight = value;
  saveState();
  renderWeights();
  setValue('newWeight', '');
  showToast('Вес сохранён.');
}

function handleWaistSubmit(event) {
  event.preventDefault();
  const value = toNumber(byId('newWaist').value);
  if (isOutOfRange(value, LIMITS.waist)) {
    showToast('Укажи обхват талии от 30 до 250 см.');
    return;
  }
  state.waist.push({ value, date: today() });
  saveState();
  renderWeights();
  setValue('newWaist', '');
  showToast('Обхват талии сохранён.');
}

function handleResetDay() {
  const confirmed = confirm('Удалить все продукты из дневника? База продуктов и настройки останутся.');
  if (!confirmed) return;
  resetDiary();
}

function handleThemeToggle() {
  state.user.darkMode = !state.user.darkMode;
  byId('darkMode').checked = state.user.darkMode;
  applyAppearance();
  saveState();
}

function handleDarkModeChange(event) {
  state.user.darkMode = event.target.checked;
  applyAppearance();
  saveState();
}

function handleDesktopModeChange(event) {
  state.user.desktopMode = event.target.checked;
  applyAppearance();
  saveState();
  showToast(event.target.checked ? 'Включён широкий режим ПК.' : 'Включена автоматическая адаптация.');
}

/* ==================== 13. Инициализация ==================== */

function bindEvents() {
  document.querySelectorAll('[data-screen]').forEach(link => {
    link.addEventListener('click', () => navigate(link.dataset.screen));
  });
  document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => byId(button.dataset.close).close());
  });
  document.querySelectorAll('[data-chart]').forEach(button => {
    button.addEventListener('click', () => {
      activeChart = button.dataset.chart;
      renderWeights();
    });
  });

  byId('themeButton').addEventListener('click', handleThemeToggle);
  byId('darkMode').addEventListener('change', handleDarkModeChange);
  byId('desktopMode').addEventListener('change', handleDesktopModeChange);

  byId('openAddFood').addEventListener('click', () => goToFoodSearch('breakfast'));
  byId('openNewProduct').addEventListener('click', () => byId('newProductDialog').showModal());
  byId('foodSearch').addEventListener('input', renderFoods);
  byId('foodResults').addEventListener('click', handleFoodResultsClick);
  byId('mealList').addEventListener('click', handleMealListClick);

  byId('portionWeight').addEventListener('input', updatePortionInfo);
  byId('addFoodForm').addEventListener('submit', handleAddFoodSubmit);
  byId('newProductForm').addEventListener('submit', handleNewProductSubmit);
  byId('settingsForm').addEventListener('submit', event => {
    event.preventDefault();
    applyUserForm();
  });

  byId('weightForm').addEventListener('submit', handleWeightSubmit);
  byId('waistForm').addEventListener('submit', handleWaistSubmit);
  byId('resetDay').addEventListener('click', handleResetDay);
}

function init() {
  bindEvents();
  fillSettings();
  applyAppearance();
  updateDashboard();
  renderFoods();
  renderWeights();
}

init();
