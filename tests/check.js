// Выполнять в консоли index.html только в пустом тестовом профиле браузера.
(async () => {
  if (localStorage.getItem("rashody") !== null) throw new Error("Нужен пустой тестовый профиль: сохранённые данные не изменены.");
  const passed = [];
  function check(condition, name) {
    if (!condition) throw new Error(name);
    passed.push(name);
  }
  const rows = () => [...document.querySelectorAll(".expense")];
  function add(amount, currency = "KZT", date = localDate(), category = "Еда", comment = "") {
    byId("amount").value = amount;
    byId("currency").value = currency;
    byId("category").value = category;
    byId("date").value = date;
    byId("comment").value = comment;
    expenseForm.requestSubmit();
  }
  function reset() {
    localStorage.removeItem("rashody");
    data = { categories: [...initialCategories], expenses: [] };
    renderCategories();
    byId("reset-period").click();
  }
  function daysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return localDate(date);
  }

  check(byId("date").value === localDate() && byId("month-total").textContent === "0 ₸" &&
    byId("month-total-usd").textContent === "0,00 $" && !byId("empty-state").hidden, "Пустой список и сегодняшняя дата");
  check(byId("report-currency").value === "KZT" && byId("report-total").textContent === "0 ₸" &&
    !byId("report-empty").hidden && byId("report-error").hidden, "Пустой отчёт в тенге без ошибки чтения");
  check(!validDate("2026-02-29") && validDate("2024-02-29") && !validDate("0000-01-01"), "Проверка календарной даты");
  for (const amount of ["", "0", "-100", "12,5", "12.50", "abc", "NaN", "Infinity", "1e3", "9007199254740992"]) {
    add(amount, "KZT", localDate(), "Еда", "Не терять");
    check(rows().length === 0 && !byId("amount-error").hidden && byId("comment").value === "Не терять", `Отклонена сумма KZT: ${amount}`);
  }
  add("100", "KZT", "");
  check(rows().length === 0 && !byId("date-error").hidden, "Обязательная дата");
  add("100", "KZT", localDate(), "");
  check(rows().length === 0 && !byId("category-error").hidden, "Обязательная категория");
  add("5 000");
  add("2 500", "KZT", localDate(), "Транспорт");
  add("12 000", "KZT", localDate(), "Дом", "Последняя запись");
  check(byId("month-total").textContent === "19 500 ₸" && rows()[0].textContent.includes("Последняя запись"), "19 500 ₸ и новая запись за тот же день сверху");
  check(byId("report-total").textContent === "19 500 ₸" && byId("report-empty").hidden, "Отчёт обновляется после добавления: 19 500 ₸");
  check(byId("amount").value === "" && byId("comment").value === "" && byId("category").value === "Дом" &&
    byId("date").value === localDate(), "Сброс суммы и комментария, сохранение категории и даты");
  const previousMonth = new Date();
  previousMonth.setDate(0);
  add("1000", "KZT", localDate(previousMonth));
  add("1000", "KZT", `${new Date().getFullYear() - 1}${localDate().slice(4)}`);
  check(byId("month-total").textContent === "19 500 ₸" && rows().length === 5, "Другой месяц и год не входят в месячный итог");
  check(byId("report-total").textContent === "19 500 ₸", "Другой месяц и год не входят в отчёт");
  const dates = rows().map((row) => row.querySelector("time").dateTime);
  check(dates.every((date, index) => index === 0 || dates[index - 1] >= date), "Сортировка по дате");
  for (const amount of ["0.001", "12,345", "-0.01", "0,00", "1.2.3", "90071992547409.92"]) {
    add(amount, "USD");
    check(rows().length === 5 && !byId("amount-error").hidden, `Отклонена сумма USD: ${amount}`);
  }
  add("12,50", "USD");
  add("0.10", "USD");
  check(byId("month-total-usd").textContent === "12,60 $" && byId("month-total").textContent === "19 500 ₸" &&
    byId("currency").value === "USD", "Центы точны, валюты не складываются, выбор валюты остаётся");
  byId("report-currency").value = "USD";
  byId("report-currency").dispatchEvent(new Event("change"));
  check(byId("report-total").textContent === "12,60 $" && byId("budget-currency").value === "KZT" &&
    byId("currency").value === "USD", "Валюта отчёта независима от бюджета и точно считает центы");
  byId("report-currency").value = "KZT";
  byId("report-currency").dispatchEvent(new Event("change"));
  check(byId("currency").value === "USD" && byId("report-total").textContent === "19 500 ₸", "Смена валюты отчёта не меняет валюту новой траты");
  check(parseAmount("90 071 992 547 409,91", "USD") === Number.MAX_SAFE_INTEGER &&
    money(Number.MAX_SAFE_INTEGER, "USD") === "90 071 992 547 409,91 $", "Точный ввод и вывод у границы безопасного диапазона");

  byId("category-details").open = true;
  byId("new-category").value = "   ";
  byId("save-category").click();
  check(!byId("new-category-error").hidden, "Пустая категория отклоняется");
  byId("new-category").value = " Здоровье ";
  byId("save-category").click();
  byId("new-category").value = "ЗДОРОВЬЕ";
  byId("save-category").click();
  check(byId("category").options.length === 4 && byId("category").value === "Здоровье", "Категория обрезана, выбрана и не дублируется");
  const persistenceFixture = localStorage.getItem("rashody");
  byId("new-category").value = "<img src=x>";
  byId("save-category").click();
  add("1", "KZT", localDate(), "<img src=x>", "<script>alert(1)</script>");
  check(rows()[0].textContent.includes("<img src=x>") && rows()[0].textContent.includes("<script>") &&
    !byId("expense-list").querySelector("img, script"), "HTML категории и комментария выводится текстом");

  const originalSet = Storage.prototype.setItem;
  const savedBeforeFailure = localStorage.getItem("rashody");
  const countBeforeFailure = rows().length;
  try {
    Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); };
    add("123", "KZT", localDate(), "Еда", "Остаться в форме");
    check(rows().length === countBeforeFailure && byId("amount").value === "123" &&
      byId("comment").value === "Остаться в форме" && !byId("storage-error").hidden, "При отказе записи форма и список не теряют данные");
  } finally {
    Storage.prototype.setItem = originalSet;
  }
  check(localStorage.getItem("rashody") === savedBeforeFailure, "Отказ записи не изменяет хранилище");

  reset();
  add(String(Number.MAX_SAFE_INTEGER));
  add("1");
  check(rows().length === 1 && !byId("amount-error").hidden, "Переполнение итога отклоняется");
  add("0.01", "USD");
  check(rows().length === 2 && byId("month-total-usd").textContent === "0,01 $", "Лимит тенге не мешает долларам");

  reset();
  [0, 6, 7, 13, 14, 29, 30].forEach((days) => add("100", "KZT", daysAgo(days)));
  const monthBeforeFilter = byId("month-total").textContent;
  const reportBeforeFilter = byId("report-total").textContent;
  for (const [days, count] of [[1, 1], [7, 2], [14, 4], [30, 6]]) {
    document.querySelector(`[data-days="${days}"]`).click();
    check(byId("period-from").value === daysAgo(days - 1) && byId("period-to").value === localDate() &&
      rows().length === count && byId("period-total").textContent === `${count * 100} ₸` &&
      byId("month-total").textContent === monthBeforeFilter, `Период ${days} дней с обеими границами`);
  }
  byId("period-from").value = daysAgo(14);
  byId("period-to").value = daysAgo(6);
  byId("period-to").dispatchEvent(new Event("change"));
  check(rows().length === 4 && byId("period-total").textContent === "400 ₸", "Произвольный период включает обе границы");
  byId("period-from").value = "";
  byId("period-from").dispatchEvent(new Event("change"));
  check(rows().length === 6, "Период с одной границей");
  byId("period-from").value = localDate();
  byId("period-from").dispatchEvent(new Event("change"));
  check(!byId("period-error").hidden && byId("period-summary").hidden && rows().length === 7, "Обратный диапазон показывает ошибку и не фильтрует");
  byId("period-from").value = "1900-01-01";
  byId("period-to").value = "1900-01-02";
  byId("period-to").dispatchEvent(new Event("change"));
  check(rows().length === 0 && byId("empty-state").textContent === "За этот период трат нет" &&
    byId("period-total").textContent === "0 ₸" && byId("period-total-usd").textContent === "0,00 $", "Пустой период и нулевые итоги");
  check(byId("report-total").textContent === reportBeforeFilter, "Пустой период истории не меняет отчёт");
  byId("reset-period").click();
  check(rows().length === 7 && !byId("period-from").value && !byId("period-to").value, "Сброс периода");
  add("12,50", "USD", daysAgo(14));
  add("0.10", "USD", daysAgo(6));
  add("100", "USD", daysAgo(30));
  byId("period-from").value = daysAgo(14);
  byId("period-to").value = daysAgo(6);
  byId("period-to").dispatchEvent(new Event("change"));
  check(byId("period-total").textContent === "400 ₸" && byId("period-total-usd").textContent === "12,60 $", "Итоги периода считают валюты отдельно");
  byId("reset-period").click();

  reset();
  const reportCategories = () => [...byId("report-categories").children].map((item) => [
    item.querySelector(".report-category-name").textContent,
    item.querySelector(".report-category-amount").textContent
  ]);
  const checkCategories = (expected, name) => check(JSON.stringify(reportCategories()) === JSON.stringify(expected), name);
  check(byId("report-top").hidden && reportCategories().length === 0 && !byId("report-empty").hidden,
    "В пустом отчёте нет списка категорий");
  add("5000");
  checkCategories([["Еда", "5 000 ₸"]], "Одна категория без пустых строк");
  add("2500", "KZT", localDate(), "Транспорт");
  add("12000", "KZT", localDate(), "Дом");
  checkCategories([["Дом", "12 000 ₸"], ["Еда", "5 000 ₸"], ["Транспорт", "2 500 ₸"]], "Категории по убыванию: Дом, Еда, Транспорт");
  add("8000");
  checkCategories([["Еда", "13 000 ₸"], ["Дом", "12 000 ₸"], ["Транспорт", "2 500 ₸"]], "Повторные траты складываются и меняют порядок");
  byId("new-category").value = "Здоровье";
  byId("save-category").click();
  add("1000", "KZT", localDate(), "Здоровье");
  check(byId("report-total").textContent === "28 500 ₸" && reportCategories().length === 3 &&
    !reportCategories().some(([category]) => category === "Здоровье"), "Четвёртая категория входит в итог, но не в тройку");
  const topBeforeFilter = JSON.stringify(reportCategories());
  byId("period-to").value = "1900-01-02";
  byId("period-to").dispatchEvent(new Event("change"));
  check(JSON.stringify(reportCategories()) === topBeforeFilter, "Фильтр истории не меняет тройку категорий");
  add("50000", "KZT", localDate(previousMonth), "Здоровье");
  add("50000", "KZT", `${new Date().getFullYear() - 1}${localDate().slice(4)}`, "Здоровье");
  check(JSON.stringify(reportCategories()) === topBeforeFilter, "Прошлый месяц и другой год не меняют тройку");
  byId("report-currency").value = "USD";
  byId("report-currency").dispatchEvent(new Event("change"));
  check(byId("report-top").hidden && reportCategories().length === 0 && !byId("report-empty").hidden,
    "Валюта без трат убирает прежний список категорий");
  add("12,50", "USD"); add("0.10", "USD"); add("20", "USD", localDate(), "Транспорт");
  checkCategories([["Транспорт", "20,00 $"], ["Еда", "12,60 $"]], "Две долларовые категории с точными центами");
  check(byId("report-total").textContent === "32,60 $" && !byId("report-top").hidden, "Долларовая тройка согласована с итогом");
  byId("report-currency").value = "KZT";
  byId("report-currency").dispatchEvent(new Event("change"));
  check(JSON.stringify(reportCategories()) === topBeforeFilter, "Возврат к тенге восстанавливает свою тройку");
  reset();
  byId("new-category").value = "Здоровье"; byId("save-category").click();
  ["Транспорт", "Здоровье", "Еда", "Дом"].forEach((category) => add("5000", "KZT", localDate(), category));
  checkCategories([["Дом", "5 000 ₸"], ["Еда", "5 000 ₸"], ["Здоровье", "5 000 ₸"]], "Равные суммы упорядочены по русскому названию");
  byId("new-category").value = "<b>Категория</b>"; byId("save-category").click();
  add("20000", "KZT", localDate(), "<b>Категория</b>");
  check(reportCategories()[0][0] === "<b>Категория</b>" && !byId("report-categories").querySelector("b"),
    "Название категории в отчёте остаётся текстом");

  reset();
  check(byId("report-previous-total").textContent === "0 ₸" && byId("report-difference").textContent === "Без изменений" &&
    !byId("report-previous-empty").hidden && !byId("report-empty").hidden, "Оба месяца пустые: нули и Без изменений");
  add("5000"); add("2500", "KZT", localDate(), "Транспорт"); add("12000", "KZT", localDate(), "Дом");
  check(byId("report-difference").textContent === "Больше на 19 500 ₸" && !byId("report-previous-empty").hidden,
    "При пустом прошлом месяце разница считается от нуля");
  add("15000", "KZT", localDate(previousMonth));
  check(byId("report-previous-total").textContent === "15 000 ₸" && byId("report-difference").textContent === "Больше на 4 500 ₸" &&
    byId("report-previous-empty").hidden, "Рост относительно прошлых 15 000 ₸");
  add("4500", "KZT", localDate(previousMonth));
  check(byId("report-difference").textContent === "Без изменений", "Равные месяцы: Без изменений");
  add("5500", "KZT", localDate(previousMonth));
  check(byId("report-previous-total").textContent === "25 000 ₸" && byId("report-difference").textContent === "Меньше на 5 500 ₸",
    "Снижение относительно прошлых 25 000 ₸");
  const previousYear = new Date(previousMonth); previousYear.setFullYear(previousYear.getFullYear() - 1);
  const nextMonth = new Date(); nextMonth.setDate(1); nextMonth.setMonth(nextMonth.getMonth() + 1);
  add("50000", "KZT", localDate(previousYear)); add("50000", "KZT", localDate(nextMonth));
  byId("period-to").value = "1900-01-02"; byId("period-to").dispatchEvent(new Event("change"));
  check(byId("report-previous-total").textContent === "25 000 ₸" && byId("report-difference").textContent === "Меньше на 5 500 ₸",
    "Другой год, следующий месяц и фильтр не меняют сравнение");
  byId("report-currency").value = "USD"; byId("report-currency").dispatchEvent(new Event("change"));
  check(byId("report-previous-total").textContent === "0,00 $" && byId("report-difference").textContent === "Без изменений" &&
    !byId("report-previous-empty").hidden && !byId("report-empty").hidden, "Пустые доллары не используют суммы тенге");
  add("12.50", "USD"); add("0.10", "USD"); add("20", "USD", localDate(), "Транспорт");
  add("30", "USD", localDate(previousMonth));
  check(byId("report-total").textContent === "32,60 $" && byId("report-previous-total").textContent === "30,00 $" &&
    byId("report-difference").textContent === "Больше на 2,60 $", "Долларовое сравнение с точными центами");
  add("2.61", "USD", localDate(previousMonth));
  check(byId("report-difference").textContent === "Меньше на 0,01 $", "Снижение на один цент без ошибки округления");
  byId("report-currency").value = "KZT"; byId("report-currency").dispatchEvent(new Event("change"));
  check(byId("report-difference").textContent === "Меньше на 5 500 ₸", "Возврат к своему сравнению в тенге");
  reset();
  add("15000", "KZT", localDate(previousMonth));
  check(byId("report-total").textContent === "0 ₸" && byId("report-difference").textContent === "Меньше на 15 000 ₸" &&
    !byId("report-empty").hidden && byId("report-previous-empty").hidden, "Пустой текущий месяц сравнивается с непустым прошлым");
  const OriginalDate = Date;
  let reportNow = "2026-12-31T12:00:00";
  try {
    globalThis.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : [reportNow])); } };
    data.expenses = [
      { amount: 19500, currency: "KZT", category: "Еда", date: "2027-01-01", comment: "" },
      { amount: 15000, currency: "KZT", category: "Еда", date: "2026-12-31", comment: "" },
      { amount: 999, currency: "KZT", category: "Еда", date: "2026-01-01", comment: "" },
      { amount: 999, currency: "KZT", category: "Еда", date: "2025-12-31", comment: "" }
    ];
    render();
    check(byId("report-total").textContent === "15 000 ₸" && byId("report-previous-total").textContent === "0 ₸",
      "В декабре январские записи не входят в отчёт");
    reportNow = "2027-01-01T12:00:00";
    document.dispatchEvent(new Event("visibilitychange"));
    check(byId("report-total").textContent === "19 500 ₸" && byId("report-previous-total").textContent === "15 000 ₸" &&
      byId("report-difference").textContent === "Больше на 4 500 ₸" &&
      byId("report-previous-month").textContent === new Date("2026-12-01T12:00:00").toLocaleDateString("ru-RU", { month: "long", year: "numeric" }),
      "При возврате в январе сравнение обновляется на декабрь прошлого года");
  } finally {
    globalThis.Date = OriginalDate;
    reset();
  }

  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  const copiedReports = [];
  try {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { copiedReports.push(text); }
    } });
    add("5000", "KZT", localDate(), "Еда", "Личный комментарий");
    add("2500", "KZT", localDate(), "Транспорт"); add("12000", "KZT", localDate(), "Дом");
    add("15000", "KZT", localDate(previousMonth));
    check(copiedReports.length === 0, "Отчёт не копируется без нажатия");
    byId("copy-report").click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const expectedReport = [
      `Отчёт за ${byId("report-month").textContent}`, "Все записи месяца", "Итого: 19 500 ₸",
      "Самые затратные категории:", "1. Дом: 12 000 ₸", "2. Еда: 5 000 ₸", "3. Транспорт: 2 500 ₸",
      `${byId("report-previous-month").textContent}: 15 000 ₸`, "Больше на 4 500 ₸",
      "Сравнение всех записей двух календарных месяцев; текущий месяц ещё может быть не завершён."
    ].join("\n");
    check(copiedReports[0] === expectedReport && !copiedReports[0].includes("Личный комментарий"),
      "Кнопка копирует полный отчёт с переносами строк без комментариев");
    check(byId("report-copy-status").textContent === "Отчёт скопирован" && byId("report-manual-copy").hidden,
      "После успешного копирования показано подтверждение");
    add("500");
    check(byId("report-copy-status").textContent === "", "Изменение отчёта убирает прежнее подтверждение");
    await copyReport();
    check(copiedReports.at(-1).includes("Итого: 20 000 ₸") && copiedReports.at(-1).includes("2. Еда: 5 500 ₸"),
      "Повторное копирование использует обновлённые суммы");
    navigator.clipboard.writeText = async () => { throw new Error("Clipboard denied"); };
    await copyReport();
    check(!byId("report-manual-copy").hidden && byId("report-copy-status").textContent === "" &&
      byId("report-text").value === copiedReports.at(-1), "Отказ буфера показывает тот же текст без ложного успеха");
    check(document.activeElement === byId("report-text") && byId("report-text").selectionStart === 0 &&
      byId("report-text").selectionEnd === byId("report-text").value.length && byId("report-text").readOnly,
      "Текст ручного копирования выделен и защищён от случайного изменения");
    byId("report-currency").value = "USD"; byId("report-currency").dispatchEvent(new Event("change"));
    check(!byId("report-manual-copy").hidden && byId("report-text").value.includes("Итого: 0,00 $") &&
      byId("report-text").value.includes("В этом месяце трат нет") && byId("report-text").value.includes("В прошлом месяце трат нет") &&
      !byId("report-text").value.includes("₸"), "Открытый ручной текст обновляется при смене валюты и пустых месяцах");
    add("12.50", "USD"); add("0.10", "USD"); add("20", "USD", localDate(), "Транспорт");
    add("30", "USD", localDate(previousMonth));
    check(byId("report-text").value.includes("Итого: 32,60 $") && byId("report-text").value.includes("Больше на 2,60 $") &&
      byId("report-text").value.includes("2. Еда: 12,60 $"), "Ручной текст обновляется после добавления долларовых трат");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    await copyReport();
    check(!byId("report-manual-copy").hidden && byId("report-copy-status").textContent === "", "При отсутствии API буфера доступно ручное копирование");
    let finishCopy;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: () => new Promise((resolve) => { finishCopy = resolve; })
    } });
    const pendingCopy = copyReport();
    byId("report-currency").value = "KZT"; byId("report-currency").dispatchEvent(new Event("change"));
    finishCopy(); await pendingCopy;
    check(byId("report-copy-status").textContent === "" && !byId("report-manual-copy").hidden &&
      byId("report-text").value.includes("Итого: 20 000 ₸"), "Поздний ответ буфера не подтверждает уже изменённый отчёт");
    navigator.clipboard.writeText = async (text) => { copiedReports.push(text); };
    await copyReport();
    check(byId("report-manual-copy").hidden && byId("report-copy-status").textContent === "Отчёт скопирован",
      "Успешная повторная попытка скрывает ручное поле");
  } finally {
    if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    else delete navigator.clipboard;
  }

  const legacy = JSON.stringify({ categories: [...initialCategories], expenses: [{ amount: 5000, category: "Еда", date: localDate(), comment: "Старая запись" }] });
  localStorage.setItem("rashody", legacy);
  load();
  render();
  check(byId("month-total").textContent === "5 000 ₸" && byId("month-total-usd").textContent === "0,00 $" &&
    localStorage.getItem("rashody") === legacy, "Старые записи читаются как тенге без перезаписи");
  localStorage.setItem("rashody", "{");
  load();
  check(!byId("storage-error").hidden && byId("amount").disabled && localStorage.getItem("rashody") === "{", "Повреждённые данные не затираются");
  render();
  check(!byId("report-error").hidden && byId("report-content").hidden && byId("report-currency").disabled,
    "При повреждённых данных отчёт скрыт и показана ошибка");
  check(byId("copy-report").disabled && byId("report-text").value === "" && byId("report-copy-status").textContent === "",
    "При ошибке чтения копирование отключено и прежний текст очищен");
  localStorage.setItem("rashody", persistenceFixture);
  expenseForm.querySelectorAll("input, select, textarea, button").forEach((field) => { field.disabled = false; });
  byId("storage-error").hidden = true;
  load();
  renderCategories();
  render();
  return { passed: passed.length, checks: passed, next: "Обновите страницу: ожидаются 19 500 ₸, 12,60 $, 7 трат и категория Здоровье." };
})();
