// Выполнять в консоли index.html только в пустом тестовом профиле браузера.
(() => {
  if (localStorage.getItem("rashody") !== null) throw new Error("Нужен пустой тестовый профиль: данные не изменены.");
  const passed = [];
  const check = (condition, name) => { if (!condition) throw new Error(name); passed.push(name); };
  const row = (category) => [...byId("budget-categories").children].find((item) => item.dataset.category === category && !item.hidden);
  const switchCurrency = (currency) => {
    byId("budget-currency").value = currency;
    byId("budget-currency").dispatchEvent(new Event("change"));
  };
  const limit = (category, value) => {
    row(category).querySelector("input").value = value;
    row(category).querySelector("form").requestSubmit();
  };
  const add = (amount, category = "Еда", currency = "KZT", date = localDate()) => {
    byId("amount").value = amount;
    byId("category").value = category;
    byId("currency").value = currency;
    byId("date").value = date;
    expenseForm.requestSubmit();
  };
  check(byId("budget-limit").textContent === "Не задан" && byId("budget-left").textContent === "—", "Лимиты изначально не заданы");
  limit("Еда", "10 000"); limit("Транспорт", "5000"); limit("Дом", "15000");
  add("5000"); add("2500", "Транспорт"); add("12000", "Дом");
  check(byId("month-total").textContent === "19 500 ₸" && byId("budget-spent").textContent === "19 500 ₸" &&
    byId("budget-limit").textContent === "30 000 ₸" && byId("budget-left").textContent === "10 500 ₸", "Пример: 30 000 − 19 500 = 10 500 ₸");
  check(["5 000 ₸", "2 500 ₸", "3 000 ₸"].every((value, i) => row(initialCategories[i]).querySelector(".left").textContent === value), "Остатки всех категорий");
  check(byId("budget-unset").hidden, "Все лимиты заданы");
  for (const value of ["", "-1", "1.5", "1,5", "NaN", "Infinity", "abc", "1e3", "9007199254740992"]) {
    limit("Еда", value);
    check(row("Еда").querySelector("input").getAttribute("aria-invalid") === "true" &&
      row("Еда").querySelector("input").value === value && byId("budget-limit").textContent === "30 000 ₸", `Отклонён лимит: ${value}`);
  }
  limit("Еда", String(Number.MAX_SAFE_INTEGER));
  check(row("Еда").querySelector(".error").textContent.includes("слишком велик"), "Переполнение общего бюджета отклоняется");
  limit("Еда", "5000");
  check(row("Еда").querySelector(".budget-warning").textContent === "Лимит исчерпан", "Исчерпание лимита");
  limit("Еда", "0");
  check(row("Еда").querySelector(".left").textContent === "−5 000 ₸" &&
    row("Еда").querySelector(".budget-warning").textContent === "Перерасход: 5 000 ₸", "Нулевой лимит и отрицательный остаток");
  add("7000");
  check(byId("budget-warning").textContent === "Перерасход: 6 500 ₸" && row("Еда").querySelector(".spent").textContent === "12 000 ₸", "Трата разрешена при перерасходе, общая сводка обновляется");
  limit("Еда", "15000");
  check(row("Еда").querySelector(".budget-warning").hidden && byId("budget-warning").hidden, "Повышение лимита убирает предупреждение");
  row("Еда").querySelector('button[type="button"]').click();
  check(row("Еда").querySelector(".limit").textContent === "Не задан" && row("Еда").querySelector(".left").textContent === "—" &&
    !byId("budget-unset").hidden && byId("budget-spent").textContent === "26 500 ₸", "Снятие лимита сохраняет расходы в общем итоге");
  initialCategories.slice(1).forEach((name) => row(name).querySelector('button[type="button"]').click());
  check(byId("budget-limit").textContent === "Не задан" && byId("budget-warning").hidden, "Без всех лимитов нет общего предупреждения");
  limit("Еда", "15000");
  row("Еда").querySelector("input").value = "17000";
  const before = byId("budget-spent").textContent;
  add("12,50", "Еда", "USD");
  const oldMonth = new Date(); oldMonth.setDate(0);
  add("1000", "Еда", "KZT", localDate(oldMonth));
  add("1000", "Еда", "KZT", `${new Date().getFullYear() - 1}${localDate().slice(4)}`);
  byId("period-from").value = "1900-01-01";
  byId("period-to").value = "1900-01-02";
  byId("period-to").dispatchEvent(new Event("change"));
  check(byId("budget-spent").textContent === before && row("Еда").querySelector("input").value === "17000" &&
    row("Еда").querySelector(".limit").textContent === "15 000 ₸", "USD, другие месяцы и фильтры не влияют на бюджет; черновик сохранён");
  byId("new-category").value = "<b>Здоровье</b>";
  byId("save-category").click();
  check(row("<b>Здоровье</b>").querySelector(".limit").textContent === "Не задан" &&
    !byId("budget-categories").querySelector("b"), "Новая категория без лимита, HTML выводится текстом");
  const originalSet = Storage.prototype.setItem;
  const snapshot = localStorage.getItem("rashody");
  try {
    Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); };
    limit("Еда", "19000");
    check(!byId("storage-error").hidden && row("Еда").querySelector("input").value === "19000" &&
      row("Еда").querySelector(".limit").textContent === "15 000 ₸", "Отказ записи сохраняет черновик и прежние расчёты");
  } finally { Storage.prototype.setItem = originalSet; }
  check(localStorage.getItem("rashody") === snapshot, "Отказ записи не меняет хранилище");
  const fixture = snapshot;
  const legacy = JSON.stringify({ categories: [...initialCategories], expenses: [{ amount: 5000, category: "Еда", date: localDate(), comment: "" }] });
  localStorage.setItem("rashody", legacy); load(); render();
  check(byId("budget-spent").textContent === "5 000 ₸" && byId("budget-limit").textContent === "Не задан" &&
    localStorage.getItem("rashody") === legacy, "Старые данные без бюджетов и валюты читаются без перезаписи");
  for (const budgets of [null, [{ month: "2026-13", category: "Еда", amount: 1 }],
    [{ month: localDate().slice(0, 7), category: "Еда", amount: -1 }],
    [{ month: localDate().slice(0, 7), category: "Еда", amount: 1 }, { month: localDate().slice(0, 7), category: "Еда", amount: 2 }]]) {
    const invalid = JSON.stringify({ ...JSON.parse(legacy), budgets });
    localStorage.setItem("rashody", invalid); load(); render();
    check(row("Еда").querySelector("input").disabled && localStorage.getItem("rashody") === invalid, "Повреждённый бюджет не перезаписан, ввод отключён");
  }
  localStorage.setItem("rashody", fixture);
  load();
  expenseForm.querySelectorAll("input, select, textarea, button").forEach((field) => { field.disabled = false; });
  byId("storage-error").hidden = true;
  byId("reset-period").click();
  renderCategories(); render();
  const legacyBudget = JSON.stringify({ categories: [...initialCategories], expenses: [],
    budgets: [{ month: localDate().slice(0, 7), category: "Еда", amount: 10000 }] });
  localStorage.setItem("rashody", legacyBudget); load();
  byId("budget-categories").replaceChildren(); renderCategories(); render();
  check(row("Еда").querySelector(".limit").textContent === "10 000 ₸" &&
    localStorage.getItem("rashody") === legacyBudget, "Старый лимит без валюты читается как тенге без перезаписи");
  const formCurrency = byId("currency").value;
  const period = [byId("period-from").value, byId("period-to").value];
  switchCurrency("USD");
  check(byId("budget-limit").textContent === "Не задан" && byId("budget-spent").textContent === "0,00 $" &&
    byId("currency").value === formCurrency && byId("period-from").value === period[0] && byId("period-to").value === period[1],
  "Выбор доллара не меняет валюту траты и фильтры; старый лимит не становится долларовым");
  limit("Еда", "100"); limit("Транспорт", "50,00");
  add("12,50", "Еда", "USD"); add("0.10", "Еда", "USD"); add("20", "Транспорт", "USD");
  check(byId("budget-limit").textContent === "150,00 $" && byId("budget-spent").textContent === "32,60 $" &&
    byId("budget-left").textContent === "117,40 $" && row("Еда").querySelector(".left").textContent === "87,40 $" &&
    row("Транспорт").querySelector(".left").textContent === "30,00 $", "Точные центы и общий долларовый бюджет из примера");
  for (const value of ["", "-1", "abc", "12,345", "1e3", "Infinity", "90071992547409,92", "9".repeat(10000)]) {
    const before = localStorage.getItem("rashody");
    limit("Еда", value);
    check(row("Еда").querySelector("input").getAttribute("aria-invalid") === "true" &&
      row("Еда").querySelector("input").value === value && localStorage.getItem("rashody") === before,
    `Неверный долларовый лимит отклонён: ${value.length > 30 ? "длинное число" : value}`);
  }
  limit("Еда", "90 071 992 547 409,91");
  check(row("Еда").querySelector(".error").textContent.includes("слишком велик"), "Переполнение долларового бюджета отклоняется");
  limit("Еда", "10");
  check(row("Еда").querySelector(".left").textContent === "−2,60 $" &&
    row("Еда").querySelector(".budget-warning").textContent === "Перерасход: 2,60 $", "Долларовый перерасход категории");
  limit("Еда", "12,60");
  check(row("Еда").querySelector(".budget-warning").textContent === "Лимит исчерпан", "Долларовый лимит исчерпан");
  limit("Еда", "0");
  check(row("Еда").querySelector(".budget-warning").textContent === "Перерасход: 12,60 $", "Нулевой долларовый лимит");
  limit("Еда", "1 000.25");
  check(row("Еда").querySelector(".limit").textContent === "1 000,25 $", "Пробелы и точка в долларовом лимите");
  limit("Еда", "100");
  row("Еда").querySelector("input").value = "25,50";
  switchCurrency("KZT");
  row("Еда").querySelector("input").value = "17000";
  switchCurrency("USD");
  check(row("Еда").querySelector("input").value === "25,50" &&
    row("Еда").querySelector(".limit").textContent === "100,00 $", "Долларовый черновик переживает переключение и не меняет расчёты");
  add("5000"); add("3", "Дом", "USD");
  const dollarSpent = byId("budget-spent").textContent;
  add("100", "Еда", "USD", localDate(oldMonth));
  add("100", "Еда", "USD", `${new Date().getFullYear() - 1}${localDate().slice(4)}`);
  byId("period-from").value = "1900-01-01"; byId("period-to").value = "1900-01-02";
  byId("period-to").dispatchEvent(new Event("change"));
  check(dollarSpent === "35,60 $" && byId("budget-spent").textContent === dollarSpent &&
    !byId("budget-unset").hidden, "Категория без лимита учтена; тенге, другие месяцы, годы и фильтры не меняют долларовый бюджет");
  try {
    Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); };
    limit("Еда", "190,50");
    switchCurrency("KZT"); switchCurrency("USD");
    check(!byId("storage-error").hidden && row("Еда").querySelector("input").value === "190,50" &&
      row("Еда").querySelector(".limit").textContent === "100,00 $", "Ошибка записи сохраняет долларовый черновик при переключении");
  } finally { Storage.prototype.setItem = originalSet; }
  row("Еда").querySelector('button[type="button"]').click();
  check(row("Еда").querySelector(".limit").textContent === "Не задан" &&
    byId("budget-spent").textContent === "35,60 $", "Снятие долларового лимита сохраняет расходы");
  switchCurrency("KZT");
  check(row("Еда").querySelector(".limit").textContent === "10 000 ₸" &&
    row("Еда").querySelector(".left").textContent === "5 000 ₸" && row("Еда").querySelector("input").value === "17000",
  "Долларовые изменения не затронули лимит и черновик тенге");
  switchCurrency("USD"); limit("Еда", "100");
  for (const name of initialCategories.slice(0, 2)) row(name).querySelector('button[type="button"]').click();
  check(byId("budget-limit").textContent === "Не задан" && byId("budget-left").textContent === "—" &&
    byId("budget-warning").hidden, "Без долларовых лимитов нет общего остатка и предупреждения");
  const base = { categories: [...initialCategories], expenses: [] };
  for (const budgets of [
    [{ month: localDate().slice(0, 7), category: "Еда", currency: "EUR", amount: 100 }],
    [{ month: localDate().slice(0, 7), category: "Еда", amount: 100 },
      { month: localDate().slice(0, 7), category: "Еда", currency: "KZT", amount: 200 }],
    [{ month: localDate().slice(0, 7), category: "Еда", currency: "USD", amount: Number.MAX_SAFE_INTEGER },
      { month: localDate().slice(0, 7), category: "Дом", currency: "USD", amount: 1 }]
  ]) {
    const invalid = JSON.stringify({ ...base, budgets });
    localStorage.setItem("rashody", invalid); load(); render();
    check(!storageReadable && row("Еда").querySelector("input").disabled &&
      localStorage.getItem("rashody") === invalid, "Неподдерживаемая валюта, дубликат или переполнение бюджета не затираются");
  }
  localStorage.setItem("rashody", JSON.stringify({ ...base, budgets: ["KZT", "USD"].map((currency) =>
    ({ month: localDate().slice(0, 7), category: "Еда", currency, amount: Number.MAX_SAFE_INTEGER })) }));
  load(); render();
  check(storageReadable && data.budgets.length === 2, "Безопасный предел проверяется отдельно для каждой валюты");
  // Restore the original fixture so the existing F5 instructions remain valid.
  localStorage.setItem("rashody", fixture); load();
  expenseForm.querySelectorAll("input, select, textarea, button").forEach((field) => { field.disabled = false; });
  byId("storage-error").hidden = true;
  switchCurrency("KZT"); byId("budget-categories").replaceChildren();
  byId("reset-period").click(); renderCategories(); render();
  check(!/NaN|Infinity/.test(document.body.textContent), "Нет NaN и Infinity");
  return { passed: passed.length, checks: passed, next: "После F5: бюджет 15 000 ₸, потрачено 26 500 ₸, остаток −11 500 ₸." };
})();
