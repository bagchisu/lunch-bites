import type { CapabilityContext } from './main';

declare global {
  interface Window {
    loadCategoryTransactions: (categoryId: number) => void;
  }
}

google.charts.load('current', { packages: ['treemap'] });
const chartApiReady = new Promise<void>((resolve) => {
  google.charts.setOnLoadCallback(resolve);
});

const CATEGORIES_ENDPOINT = '/categories';
const TRANSACTIONS_ENDPOINT = '/transactions';
const BUDGETS_ENDPOINT = '/summary';
const periodMenu = document.getElementById('period-menu') as HTMLDetailsElement | null;
const periodMenuTrigger = document.getElementById('period-menu-trigger');
const categoryMap = new Map<number, any>();
const categoryExpensesMap = new Map<number, any[]>();
let appContext: CapabilityContext;
let currentPeriod = -1;

function getPeriodDates(monthOffset: number): { startOfMonth: Date; endOfMonth: Date } {
  const today = new Date();
  const month = today.getMonth() - monthOffset;
  const startOfMonth = new Date(today.getFullYear(), month, 1);
  const endOfMonth = new Date(today.getFullYear(), month + 1, 0);
  return { startOfMonth, endOfMonth };
}

function getDateParameter(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addCategories(categories: Array<any>) {
  for (const category of categories) {
    categoryMap.set(category.id, category);
    if (category.children) {
      addCategories(category.children);
    }
  }
}

function createCategoryMap(categoryInfo: any) {
  categoryMap.clear();
  addCategories(categoryInfo.categories);
}

function calculateSpent(categoryExpense: any): number {
  return categoryExpense.totals.recurring_activity + categoryExpense.totals.other_activity;
}

function calculateBudgetPct(categoryExpense: any): number | undefined {
  if (categoryExpense.totals.budgeted === null) {
    return undefined;
  }
  const spent = calculateSpent(categoryExpense);
  return spent / (spent + categoryExpense.totals.available);
}

function drawBudgetTreeMap(categoryExpenses: Array<any>) {
  const dataArray: Array<any[]> = [];
  const dataDetails: Array<any> = [];
  const rootCategory = 'All Expenses by category';
  dataArray.push(['Expense Category', 'Parent Category', 'Amount in base currency', 'Percentage of budget used']);
  dataArray.push([rootCategory, null, 0, 0]);
  dataDetails.push({});

  for (const categoryExpense of categoryExpenses) {
    const category = categoryMap.get(categoryExpense.category_id);
    if (!category) {
      continue;
    }

    let parentCategoryName = rootCategory;
    if (category.group_id) {
      const parentCategory = categoryMap.get(category.group_id);
      if (parentCategory) {
        parentCategoryName = parentCategory.name;
        const foundParent = dataArray.find((item) => item[0] === parentCategoryName);
        if (foundParent === undefined) {
          dataArray.push([parentCategoryName, rootCategory, 0, 0]);
          dataDetails.push({});
        }
      }
    }

    const spent = calculateSpent(categoryExpense);
    if (spent <= 0) {
      continue;
    }

    let budgetPct = calculateBudgetPct(categoryExpense);
    if (budgetPct !== undefined && budgetPct <= 1) {
      budgetPct = 1 - budgetPct;
    }
    dataArray.push([category.name, parentCategoryName, spent, budgetPct]);
    dataDetails.push(categoryExpense);
  }

  void drawTreeMap(dataArray, dataDetails);
}

async function drawTreeMap(dataArray: Array<any[]>, dataDetails: Array<any>) {
  await chartApiReady;
  const element = document.getElementById('chart-div');
  if (!element) {
    return;
  }

  const data = google.visualization.arrayToDataTable(dataArray);
  const tree = new google.visualization.TreeMap(element);
  tree.draw(data, {
    maxColor: 'rgb(251, 50, 50)',
    maxColorValue: 2,
    midColor: '#ddd',
    midColorValue: 1,
    minColor: 'rgb(50, 221, 111)',
    minColorValue: 0,
    noColor: '#aaa',
    headerHeight: 15,
    fontColor: 'black',
    showScale: false,
    showTooltips: true,
    maxDepth: 1,
    maxPostDepth: 2,
    generateTooltip: (row: number, size: number) => showStaticTooltip(data, dataDetails, row, size),
    useWeightedAverageForAggregation: true,
  } as any);
}

function showStaticTooltip(data: any, dataDetails: Array<any>, row: number, size: number): string {
  const details = dataDetails[row];
  const budgetPct = details?.totals ? calculateBudgetPct(details) : undefined;
  const categoryId = details?.category_id;
  return '<div id="treemap-tooltip">' +
    '<span><b>' + data.getValue(row, 0) + '</b></span><br>' +
    '<span> $' + size.toFixed(2) + ' (' + (budgetPct !== undefined ? (budgetPct * 100).toFixed(0) + '% of budget' : 'no budget for this category') + ')</span><br>' +
    (categoryId ? '<button type="button" class="treemap-tooltip__button" onclick="loadCategoryTransactions(' + categoryId + ')">Transactions</button>' : '') +
    '</div>';
}

async function loadBudgetSummary(startDate: Date, endDate: Date) {
  const query = `?start_date=${getDateParameter(startDate)}&end_date=${getDateParameter(endDate)}`;
  const budgetsData = await appContext.getInfo(`${BUDGETS_ENDPOINT}${query}`);
  drawBudgetTreeMap(budgetsData.categories);
}

async function loadTransactions(startDate: Date, endDate: Date): Promise<Array<any>> {
  const query = `?start_date=${getDateParameter(startDate)}&end_date=${getDateParameter(endDate)}`;
  const transactionsData = await appContext.getInfo(`${TRANSACTIONS_ENDPOINT}${query}`);
  return transactionsData.transactions;
}

async function onPeriodChange(period: number) {
  if (period === currentPeriod) {
    return;
  }
  currentPeriod = period;
  if (periodMenuTrigger) {
    periodMenuTrigger.textContent = periodMenu?.querySelector<HTMLButtonElement>(`[data-period="${period}"]`)?.textContent || 'Select period';
  }
  if (periodMenu) {
    periodMenu.open = false;
  }

  categoryExpensesMap.clear();
  const { startOfMonth, endOfMonth } = getPeriodDates(period);
  await loadBudgetSummary(startOfMonth, endOfMonth);
}

function addPeriodOptions() {
  const periodOptions = periodMenu?.querySelector('.period-menu__options');
  if (!periodOptions || periodOptions.querySelector('[data-period="1"]')) {
    return;
  }

  const today = new Date();
  for (let monthsBeforeCurrent = 1; monthsBeforeCurrent <= 5; monthsBeforeCurrent++) {
    const periodDate = new Date(today.getFullYear(), today.getMonth() - monthsBeforeCurrent, 1);
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.dataset.period = String(monthsBeforeCurrent);
    item.textContent = periodDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    periodOptions.appendChild(item);
  }

  periodMenu?.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((item) => {
    item.addEventListener('click', () => {
      const period = item.dataset.period;
      if (period) {
        void onPeriodChange(Number(period)).catch((error) => console.error('Error loading period:', error));
      }
    });
  });
}

async function loadCategoryTransactions(categoryId: number) {
  if (categoryExpensesMap.size === 0) {
    const { startOfMonth, endOfMonth } = getPeriodDates(currentPeriod);
    try {
      const transactions = await loadTransactions(startOfMonth, endOfMonth);
      for (const transaction of transactions) {
        const categoryTransactions = categoryExpensesMap.get(transaction.category_id) || [];
        categoryTransactions.push(transaction);
        categoryExpensesMap.set(transaction.category_id, categoryTransactions);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      return;
    }
  }
  showCategoryTransactions(categoryId);
}

function getSubcategoryTransactions(category: any, transactions: Array<any>) {
  for (const subcategory of category.children || []) {
    transactions.push(...(categoryExpensesMap.get(subcategory.id) || []));
    getSubcategoryTransactions(subcategory, transactions);
  }
}

function showCategoryTransactions(categoryId: number) {
  const category = categoryMap.get(categoryId);
  if (!category) {
    console.error(`Category with ID ${categoryId} not found.`);
    return;
  }

  const transactions = [...(categoryExpensesMap.get(categoryId) || [])];
  getSubcategoryTransactions(category, transactions);
  transactions.sort((left, right) => left.date.localeCompare(right.date));
  const modalContent = document.getElementById('transactions-modal-content');
  if (!modalContent) {
    return;
  }

  modalContent.innerHTML = `<h3>${category.name} transactions</h3>`;
  if (transactions.length === 0) {
    modalContent.innerHTML += '<p>No transactions found for this category.</p>';
  } else {
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'transactions-table-wrap';
    const transactionTable = document.createElement('table');
    transactionTable.className = 'transactions-table';
    transactionTable.innerHTML = `
      <thead>
        <tr><th scope="col">Date</th><th scope="col">Category</th><th scope="col">Payee</th><th scope="col">Amount (${appContext.userInfo.primary_currency?.toUpperCase() || ''})</th></tr>
      </thead>
      <tbody></tbody>
    `;
    const tableBody = transactionTable.querySelector('tbody')!;
    for (const transaction of transactions) {
      const row = document.createElement('tr');
      const dateCell = document.createElement('td');
      dateCell.textContent = transaction.date;
      const categoryCell = document.createElement('td');
      categoryCell.textContent = transaction.category_id ? categoryMap.get(transaction.category_id)?.name || 'Unknown' : 'Uncategorized';
      const payeeCell = document.createElement('td');
      payeeCell.textContent = transaction.payee;
      const amountCell = document.createElement('td');
      amountCell.textContent = Number(transaction.to_base).toFixed(2);
      amountCell.className = 'transactions-table__amount';
      row.append(dateCell, categoryCell, payeeCell, amountCell);
      tableBody.appendChild(row);
    }
    tableWrapper.appendChild(transactionTable);
    modalContent.appendChild(tableWrapper);
  }

  const transactionsModal = document.getElementById('transactions-modal') as HTMLDialogElement | null;
  transactionsModal?.showModal();
}

export async function initializeExpensesTreemap(context: CapabilityContext) {
  appContext = context;
  window.loadCategoryTransactions = (categoryId) => {
    void loadCategoryTransactions(categoryId);
  };
  addPeriodOptions();
  categoryExpensesMap.clear();
  createCategoryMap(await appContext.getInfo(CATEGORIES_ENDPOINT));
  currentPeriod = -1;
  await onPeriodChange(0);
}