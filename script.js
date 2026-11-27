"use strict";

const STORAGE_KEY = "rashody";
const initialCategories = ["Еда", "Транспорт", "Дом"];
const byId = (id) => document.getElementById(id);
const expenseForm = byId("expense-form");
let data = { categories: [...initialCategories], expenses: [] };
let storageReadable = true;
let reportText = "";
let reportCopyAttempt = 0;

function localDate(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value.slice(0, 4) !== "0000" &&
    localDate(new Date(`${value}T12:00:00`)) === value;
}

function money(amount, currency) {
  if (amount < 0) return `−${money(-amount, currency)}`;
  const digits = String(amount).padStart(currency === "USD" ? 3 : 1, "0");
  const whole = currency === "USD" ? digits.slice(0, -2) : digits;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return currency === "USD" ? `${grouped},${digits.slice(-2)} $` : `${grouped} ₸`;
}

function parseAmount(value, currency, allowZero = false) {
  const raw = value.trim().replace(/[ \u00a0\u202f]/g, "");
  if (!(currency === "USD" ? /^\d+([.,]\d{1,2})?$/ : /^\d+$/).test(raw)) return null;
  const [whole, fraction = ""] = raw.split(/[.,]/);
  const amount = Number(currency === "USD" ? whole + fraction.padEnd(2, "0") : whole);
  return Number.isSafeInteger(amount) && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

function totals(expenses) {
  return expenses.reduce((sum, expense) => {
    sum[expense.currency] += expense.amount;
    return sum;
  }, { KZT: 0, USD: 0 });
}

function renderTotals(prefix, expenses) {
  const sum = totals(expenses);
  byId(`${prefix}-total`).textContent = money(sum.KZT, "KZT");
  byId(`${prefix}-total-usd`).textContent = money(sum.USD, "USD");
}

function fieldError(id, message) {
  const field = byId(id);
  field.setAttribute("aria-invalid", String(Boolean(message)));
  byId(`${id}-error`).textContent = message;
  byId(`${id}-error`).hidden = !message;
}

function save(next) {
  if (!storageReadable) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    data = next;
    byId("storage-error").hidden = true;
    return true;
  } catch {
    byId("storage-error").textContent = "Не удалось сохранить данные. Проверьте свободное место и разрешение браузера на хранение данных. Введённое осталось в форме.";
    byId("storage-error").hidden = false;
    return false;
  }
}

function load() {
  storageReadable = true;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return;
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.expenses) ||
      !initialCategories.every((name) => parsed.categories.includes(name)) ||
      !parsed.categories.every((name) => typeof name === "string" && name.trim()) ||
      !parsed.expenses.every((expense) => expense && Number.isSafeInteger(expense.amount) && expense.amount > 0 &&
        parsed.categories.includes(expense.category) && typeof expense.date === "string" && validDate(expense.date) &&
        typeof expense.comment === "string" && (expense.currency === undefined || ["KZT", "USD"].includes(expense.currency)))) {
      throw new Error("Invalid saved data");
    }
    parsed.expenses = parsed.expenses.map((expense) => ({ ...expense, currency: expense.currency === undefined ? "KZT" : expense.currency }));
    if (!Object.values(totals(parsed.expenses)).every(Number.isSafeInteger)) throw new Error("Invalid saved total");
    const budgets = parsed.budgets === undefined ? [] : parsed.budgets;
    if (!Array.isArray(budgets)) throw new Error("Invalid budgets");
    const keys = new Set();
    const monthTotals = new Map();
    for (const budget of budgets) {
      const currency = budget?.currency === undefined ? "KZT" : budget.currency;
      if (!budget || typeof budget.month !== "string" || !validDate(`${budget.month}-01`) ||
        !["KZT", "USD"].includes(currency) || !parsed.categories.includes(budget.category) ||
        !Number.isSafeInteger(budget.amount) || budget.amount < 0) {
        throw new Error("Invalid budget");
      }
      const key = JSON.stringify([budget.month, budget.category, currency]);
      const monthKey = JSON.stringify([budget.month, currency]);
      const total = (monthTotals.get(monthKey) || 0) + budget.amount;
      if (keys.has(key) || !Number.isSafeInteger(total)) throw new Error("Invalid budget total");
      keys.add(key);
      monthTotals.set(monthKey, total);
    }
    parsed.budgets = budgets.map((budget) => ({ ...budget, currency: budget.currency === undefined ? "KZT" : budget.currency }));
    data = parsed;
  } catch {
    storageReadable = false;
    byId("storage-error").textContent = "Не удалось прочитать сохранённые данные. Они не изменены. Добавление недоступно: проверьте разрешение браузера на хранение данных или восстановите сохранённые записи.";
    byId("storage-error").hidden = false;
    expenseForm.querySelectorAll("input, select, textarea, button").forEach((field) => { field.disabled = true; });
  }
}

function budgetWarning(limit, spent, currency) {
  if (limit === undefined) return "";
  return spent > limit ? `Перерасход: ${money(spent - limit, currency)}`
    : spent === limit ? "Лимит исчерпан" : "";
}

function renderBudget() {
  const month = localDate().slice(0, 7);
  const currency = byId("budget-currency").value;
  const symbol = currency === "USD" ? "$" : "₸";
  byId("budget-month").textContent = new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  const budgets = (data.budgets || []).filter((budget) => budget.month === month && budget.currency === currency);
  const expenses = data.expenses.filter((expense) => expense.currency === currency && expense.date.slice(0, 7) === month);
  const total = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const spent = totals(expenses)[currency];
  byId("budget-limit").textContent = budgets.length ? money(total, currency) : "Не задан";
  byId("budget-spent").textContent = money(spent, currency);
  byId("budget-left").textContent = budgets.length ? money(total - spent, currency) : "—";
  byId("budget-warning").textContent = budgetWarning(budgets.length ? total : undefined, spent, currency);
  byId("budget-warning").hidden = !byId("budget-warning").textContent;
  byId("budget-unset").hidden = data.categories.every((category) => budgets.some((budget) => budget.category === category));
  const container = byId("budget-categories");
  // Keep existing editors so filtering or adding a spend never discards an unsaved limit.
  if (container.dataset.month !== month) {
    container.replaceChildren();
    container.dataset.month = month;
  }
  // Retain each currency's editors, including drafts and errors, while switching.
  [...container.children].forEach((row) => { row.hidden = row.dataset.currency !== currency; });
  data.categories.forEach((category, index) => {
    let row = [...container.children].find((item) => item.dataset.category === category && item.dataset.currency === currency);
    const limit = budgets.find((budget) => budget.category === category)?.amount;
    if (!row) {
      row = document.createElement("article");
      row.className = "budget-category";
      row.dataset.category = category;
      row.dataset.currency = currency;
      const inputId = `budget-input-${index}-${currency}`;
      // Only fixed markup goes through innerHTML; category names are always text.
      row.innerHTML = `<h3></h3>
        <dl class="budget-values"><div><dt>Лимит</dt><dd class="limit"></dd></div><div><dt>Потрачено</dt><dd class="spent"></dd></div><div><dt>Осталось</dt><dd class="left"></dd></div></dl>
        <p class="budget-warning" role="status" hidden></p>
        <form class="budget-editor" novalidate><div class="field"><label for="${inputId}"></label>
        <input id="${inputId}" type="text" inputmode="${currency === "USD" ? "decimal" : "numeric"}" placeholder="${currency === "USD" ? "100,00" : "10 000"}" aria-describedby="${inputId}-error" required>
        <p id="${inputId}-error" class="error" hidden></p></div>
        <button type="submit">Сохранить</button><button type="button" class="secondary">Убрать лимит</button></form>`;
      row.querySelector("h3").textContent = category;
      row.querySelector("label").textContent = `Лимит: ${category}, ${symbol}`;
      const input = row.querySelector("input");
      input.value = limit === undefined ? "" : money(limit, currency).replace(` ${symbol}`, "");
      const change = (remove) => {
        byId("budget-status").textContent = "";
        if (month !== localDate().slice(0, 7)) {
          render();
          byId("budget-status").textContent = "Начался новый месяц. Укажите лимит заново.";
          return;
        }
        const amount = parseAmount(input.value, currency, true);
        const others = (data.budgets || []).filter((budget) => !(budget.month === month && budget.category === category && budget.currency === currency));
        const otherTotal = others.filter((budget) => budget.month === month && budget.currency === currency).reduce((sum, budget) => sum + budget.amount, 0);
        const error = remove ? "" : amount === null ? currency === "USD"
          ? "Введите лимит в долларах: 0 или больше, не более двух знаков после запятой."
          : "Введите лимит в целых тенге: 0 или больше."
          : !Number.isSafeInteger(otherTotal + amount) ? "Общий бюджет слишком велик для точного расчёта." : "";
        fieldError(input.id, error);
        if (error) { input.focus(); return; }
        const next = remove ? others : [...others, { month, category, currency, amount }];
        if (!save({ ...data, budgets: next })) return;
        input.value = remove ? "" : money(amount, currency).replace(` ${symbol}`, "");
        renderBudget();
        byId("budget-status").textContent = remove ? `Лимит убран: ${category}, ${symbol}` : `Лимит сохранён: ${category}, ${symbol}`;
      };
      row.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); change(false); });
      row.querySelector('button[type="button"]').addEventListener("click", () => change(true));
      container.append(row);
    }
    const categorySpent = totals(expenses.filter((expense) => expense.category === category))[currency];
    row.querySelector(".limit").textContent = limit === undefined ? "Не задан" : money(limit, currency);
    row.querySelector(".spent").textContent = money(categorySpent, currency);
    row.querySelector(".left").textContent = limit === undefined ? "—" : money(limit - categorySpent, currency);
    row.querySelector(".budget-warning").textContent = budgetWarning(limit, categorySpent, currency);
    row.querySelector(".budget-warning").hidden = !row.querySelector(".budget-warning").textContent;
    row.querySelectorAll("input, button").forEach((field) => { field.disabled = !storageReadable; });
    row.querySelector('button[type="button"]').disabled = !storageReadable || limit === undefined;
  });
}

function renderReport() {
  const today = new Date();
  const month = localDate(today).slice(0, 7);
  byId("report-month").textContent = today.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  byId("report-error").hidden = storageReadable;
  byId("report-content").hidden = !storageReadable;
  byId("report-currency").disabled = !storageReadable;
  byId("copy-report").disabled = !storageReadable;
  if (!storageReadable) {
    reportText = "";
    reportCopyAttempt++;
    byId("report-text").value = "";
    byId("report-copy-status").textContent = "";
    byId("report-manual-copy").hidden = true;
    return;
  }
  const currency = byId("report-currency").value;
  const expenses = data.expenses.filter((expense) => expense.currency === currency && expense.date.slice(0, 7) === month);
  const total = totals(expenses)[currency];
  byId("report-total").textContent = money(total, currency);
  byId("report-empty").hidden = expenses.length > 0;
  const categoryTotals = new Map();
  expenses.forEach((expense) => {
    categoryTotals.set(expense.category, (categoryTotals.get(expense.category) || 0) + expense.amount);
  });
  const topCategories = [...categoryTotals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru-RU")).slice(0, 3);
  byId("report-top").hidden = topCategories.length === 0;
  byId("report-categories").replaceChildren(...topCategories.map(([category, amount]) => {
    const item = document.createElement("li");
    const row = document.createElement("div");
    row.className = "report-category-row";
    const name = document.createElement("span");
    name.className = "report-category-name";
    name.textContent = category;
    const value = document.createElement("span");
    value.className = "report-category-amount";
    value.textContent = money(amount, currency);
    row.append(name, value);
    item.append(row);
    return item;
  }));
  const previousDate = new Date(today);
  previousDate.setDate(1);
  previousDate.setMonth(previousDate.getMonth() - 1);
  const previousMonth = localDate(previousDate).slice(0, 7);
  const previousExpenses = data.expenses.filter((expense) => expense.currency === currency && expense.date.slice(0, 7) === previousMonth);
  const previousTotal = totals(previousExpenses)[currency];
  const difference = total - previousTotal;
  byId("report-previous-month").textContent = previousDate.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  byId("report-previous-total").textContent = money(previousTotal, currency);
  byId("report-previous-empty").hidden = previousExpenses.length > 0;
  byId("report-difference").textContent = difference > 0 ? `Больше на ${money(difference, currency)}`
    : difference < 0 ? `Меньше на ${money(-difference, currency)}` : "Без изменений";
  const text = [
    `Отчёт за ${byId("report-month").textContent}`,
    "Все записи месяца",
    `Итого: ${money(total, currency)}`,
    ...(topCategories.length ? ["Самые затратные категории:",
      ...topCategories.map(([category, amount], index) => `${index + 1}. ${category}: ${money(amount, currency)}`)]
      : ["В этом месяце трат нет"]),
    `${byId("report-previous-month").textContent}: ${money(previousTotal, currency)}`,
    ...(previousExpenses.length ? [] : ["В прошлом месяце трат нет"]),
    byId("report-difference").textContent,
    byId("report-comparison-note").textContent
  ].join("\n");
  if (text !== reportText) {
    reportText = text;
    reportCopyAttempt++;
    byId("report-copy-status").textContent = "";
  }
  byId("report-text").value = text;
}

async function copyReport() {
  renderReport();
  if (!storageReadable) return;
  const text = reportText;
  const attempt = ++reportCopyAttempt;
  byId("report-copy-status").textContent = "";
  try {
    await navigator.clipboard.writeText(text);
    if (attempt !== reportCopyAttempt) return;
    byId("report-manual-copy").hidden = true;
    byId("report-copy-status").textContent = "Отчёт скопирован";
  } catch {
    if (attempt !== reportCopyAttempt) return;
    byId("report-manual-copy").hidden = false;
    byId("report-text").focus();
    byId("report-text").select();
  }
}

function renderCategories(selected = byId("category").value) {
  byId("category").replaceChildren(...data.categories.map((name) => new Option(name, name)));
  byId("category").value = data.categories.includes(selected) ? selected : data.categories[0];
}

function render() {
  const today = localDate();
  byId("month-label").textContent = new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  renderTotals("month", data.expenses.filter((expense) => expense.date.slice(0, 7) === today.slice(0, 7)));
  renderBudget();

  renderReport();

  const from = byId("period-from").value;
  const to = byId("period-to").value;
  const invalidFrom = Boolean(from) && !validDate(from);
  const invalidTo = Boolean(to) && !validDate(to);
  const reversed = from && to && from > to;
  const invalidPeriod = invalidFrom || invalidTo || reversed;
  byId("period-error").textContent = reversed ? "Дата «С» должна быть не позже даты «По»." : "Укажите корректные даты периода.";
  byId("period-error").hidden = !invalidPeriod;
  byId("period-from").setAttribute("aria-invalid", String(Boolean(invalidFrom || reversed)));
  byId("period-to").setAttribute("aria-invalid", String(Boolean(invalidTo || reversed)));
  byId("period-summary").hidden = invalidPeriod || !(from || to);

  const expenses = data.expenses.filter((expense) => invalidPeriod ||
    ((!from || expense.date >= from) && (!to || expense.date <= to)))
    .sort((a, b) => b.date.localeCompare(a.date));
  renderTotals("period", expenses);
  byId("empty-state").hidden = expenses.length > 0;
  byId("empty-state").textContent = data.expenses.length ? "За этот период трат нет" : "Пока нет трат";
  byId("expense-list").replaceChildren(...expenses.map((expense) => {
    const item = document.createElement("li");
    item.className = "expense";
    const category = document.createElement("p");
    category.className = "expense-category";
    category.textContent = expense.category;
    const amount = document.createElement("p");
    amount.className = "expense-amount";
    amount.textContent = money(expense.amount, expense.currency);
    const date = document.createElement("time");
    date.className = "expense-date";
    date.dateTime = expense.date;
    date.textContent = expense.date.split("-").reverse().join(".");
    item.append(category, amount, date);
    if (expense.comment) {
      const comment = document.createElement("p");
      comment.className = "expense-comment";
      comment.textContent = expense.comment;
      item.append(comment);
    }
    return item;
  }));
}

expenseForm.addEventListener("submit", (event) => {
  event.preventDefault();
  byId("save-status").textContent = "";
  const currency = byId("currency").value;
  const amount = parseAmount(byId("amount").value, currency);
  const category = byId("category").value;
  const date = byId("date").value;
  const amountError = amount === null
    ? currency === "USD" ? "Введите положительную сумму в долларах, не более двух знаков после запятой." : "Введите положительную сумму в целых тенге, например 5 000."
    : !Number.isSafeInteger(totals(data.expenses)[currency] + amount)
      ? "Сумма слишком велика для точного расчёта итога." : "";
  fieldError("amount", amountError);
  fieldError("currency", ["KZT", "USD"].includes(currency) ? "" : "Выберите валюту.");
  fieldError("category", data.categories.includes(category) ? "" : "Выберите категорию.");
  fieldError("date", validDate(date) ? "" : "Укажите корректную дату.");
  const firstInvalid = expenseForm.querySelector('[aria-invalid="true"]:not(#new-category)');
  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }
  const expense = { amount, currency, category, date, comment: byId("comment").value.trim() };
  if (!save({ ...data, expenses: [expense, ...data.expenses] })) return;
  byId("amount").value = "";
  byId("comment").value = "";
  render();
  byId("save-status").textContent = "Трата добавлена";
  byId("amount").focus();
});

byId("currency").addEventListener("change", () => {
  byId("amount").inputMode = byId("currency").value === "USD" ? "decimal" : "numeric";
  byId("amount").placeholder = byId("currency").value === "USD" ? "12,50" : "5 000";
  fieldError("amount", "");
  fieldError("currency", "");
});

byId("save-category").addEventListener("click", () => {
  const name = byId("new-category").value.trim();
  fieldError("new-category", name ? "" : "Введите название категории.");
  if (!name) {
    byId("new-category").focus();
    return;
  }
  const existing = data.categories.find((category) => category.toLocaleLowerCase("ru-RU") === name.toLocaleLowerCase("ru-RU"));
  if (!existing && !save({ ...data, categories: [...data.categories, name] })) return;
  renderCategories(existing || name);
  renderBudget();
  fieldError("category", "");
  byId("new-category").value = "";
  byId("category-details").open = false;
  byId("category").focus();
});

byId("new-category").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    byId("save-category").click();
  }
});

byId("period-from").addEventListener("change", render);
byId("report-currency").addEventListener("change", renderReport);
byId("copy-report").addEventListener("click", copyReport);
byId("budget-currency").addEventListener("change", () => {
  byId("budget-status").textContent = "";
  renderBudget();
});
byId("period-to").addEventListener("change", render);
byId("reset-period").addEventListener("click", () => {
  byId("period-from").value = "";
  byId("period-to").value = "";
  render();
});

document.querySelectorAll("[data-days]").forEach((button) => {
  button.addEventListener("click", () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - Number(button.dataset.days) + 1);
    byId("period-from").value = localDate(start);
    byId("period-to").value = localDate(end);
    render();
  });
});

load();
renderCategories();
byId("date").value = localDate();
render();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});
