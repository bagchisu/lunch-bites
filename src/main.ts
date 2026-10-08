import './style.css'

declare global {
  interface Window {
    loadCategoryTransactions: (categoryId: number) => void;
  }
}
// Load the Visualization API and the corechart package.
google.charts.load('current', {'packages':['corechart','treemap']});

const API_URL = "https://api.lunchmoney.dev/v2";
const ME_ENDPOINT = API_URL + "/me";
const CATEGORIES_ENDPOINT = API_URL + "/categories";
const TRANSACTIONS_ENDPOINT = API_URL + "/transactions";
const BUDGETS_ENDPOINT = API_URL + "/summary";
const modal = document.getElementById('apiKeyModal') as HTMLDialogElement | null;
const updateBtn = document.getElementById('updateBtn');
const saveBtn = document.getElementById('saveBtn');
const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement | null;
const periodMenu = document.getElementById('period-menu') as HTMLDetailsElement | null;
const periodMenuTrigger = document.getElementById('period-menu-trigger');

var currentPeriod = -1;
var accessToken = apiKeyInput?.value.trim() || "";
var userInfo: any = {};
const categoryMap = new Map<number,any>();
const categoryExpensesMap = new Map<number,any>();

function getPeriodDates(monthOffset: number): { startOfMonth: Date, endOfMonth: Date } {
  const today = new Date();
  const month = today.getMonth() - monthOffset
  var startOfMonth = new Date(today.getFullYear(), month, 1);
  var endOfMonth = new Date(today.getFullYear(), month + 1, 0);
  return { startOfMonth, endOfMonth };
}

function onPeriodChange(period: number) {
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
  console.log(`Period changed to: ${period}`);

  const { startOfMonth, endOfMonth } = getPeriodDates(period);
  console.log(`Loading data from ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}`);
  loadBudgetSummary(startOfMonth, endOfMonth);
  categoryExpensesMap.clear();
}

const periodOptions = periodMenu?.querySelector('.period-menu__options');
if (periodOptions) {
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
}

periodMenu?.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((item) => {
  item.addEventListener('click', () => {
    const period = item.dataset.period;
    if (period) {
      onPeriodChange(Number(period));
    }
  });
});

if (apiKeyInput?.value.trim() === "") {
  modal?.showModal();
}
updateBtn?.addEventListener('click', () => {
  modal?.showModal();
});

saveBtn?.addEventListener('click', loadAllData);

async function getInfo(accessToken:string, endpoint:string):Promise<any> {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.status !== 200) {
    throw new Error(`Error accessing ${endpoint}: ${response.status} - ${response.statusText}`);
  }
  return response.json();
}

function addCategory(categoryArray:Array<any>) {
  for (const category of categoryArray) {
    categoryMap.set(category.id, category);
    if (category.children) {
      addCategory(category.children)
    }
  }
}

function createCategoryMap(categoryInfo:any){
  categoryMap.clear();
  addCategory(categoryInfo.categories)
}

function loadAllData() {
  accessToken = apiKeyInput!.value.trim();
  // check if access token is valid by calling the /me endpoint to get basic user info
  if (!accessToken) {
    modal?.showModal();
    return;
  }
  loadUserData().then(() => {
    onPeriodChange(0);
  }).catch((error) => {
    console.error('Error loading user data:', error);
  });
}

async function loadUserData() {
  userInfo = await getInfo(accessToken, ME_ENDPOINT);
  document.getElementById('budget-name')!.textContent = userInfo.budget_name;
  console.log('User data:', userInfo);

  // get categories
  createCategoryMap(await getInfo(accessToken, CATEGORIES_ENDPOINT));
  console.log('Category map:', categoryMap);
  // TODO get budgets
}


async function loadBudgetSummary(startDate: Date, endDate: Date) {
  // aggregate transactions amounts (in base currency) by category for the defined period
  const budgetsData = await getInfo(accessToken, `${BUDGETS_ENDPOINT}?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`)
  drawBudgetTreeMap(budgetsData.categories);
}

async function loadTransactions(startDate: Date, endDate: Date) {
  // aggregate transactions amounts (in base currency) by category for the defined period
  const transactionsData = await getInfo(accessToken, `${TRANSACTIONS_ENDPOINT}?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`)
  return transactionsData.transactions;
}

function calculateSpent(catExp: any): number {
  return catExp.totals.recurring_activity + catExp.totals.other_activity;
}

function calculateBudgetPct(catExp: any): number | undefined {
  var budgetPct = undefined;
  if (catExp.totals.budgeted !== null) {
    const spent = calculateSpent(catExp);
    budgetPct = spent / (spent + catExp.totals.available);
  }
  return budgetPct;
}

function drawBudgetTreeMap(categoryExpenses: Array<any>) {
  const dataArray = []
  const dataDetails = []
  const rootCategory = 'All Expenses by category';
  dataArray.push(['Expense Category', 'Parent Category', 'Amount in base currency', 'Percentage of budget used'])
  dataArray.push([rootCategory, null, 0, 0])
  dataDetails.push({})
  for (const catExp of categoryExpenses) {
    const category = categoryMap.get(catExp.category_id)
    var parentCategoryName = rootCategory
    if (category!.group_id) {
      const parentCategory = categoryMap.get(category!.group_id);
      parentCategoryName = parentCategory!.name;
      const foundParent = dataArray.find(item => item[0] === parentCategoryName)
      if (foundParent == undefined) {
        dataArray.push([parentCategoryName, rootCategory, 0, 0])
        dataDetails.push({})
      }
    }
    const spent = calculateSpent(catExp);
    if (spent > 0) {
      var budgetPct = undefined;
      if (catExp.totals.budgeted !== null) {
        budgetPct = calculateBudgetPct(catExp);
        if (budgetPct !== undefined && budgetPct <= 1) {
          budgetPct = 1 - budgetPct;
        }
      }
      dataArray.push([category!.name, parentCategoryName, spent, budgetPct])
      dataDetails.push(catExp)
    }
  }
  plotTreeMap(dataArray, dataDetails)
}

function loadCategoryTransactions(categoryId: number) {
  if (categoryExpensesMap.size === 0) {
    // lazy load transactions for the current period and populate the categoryExpensesMap
    const { startOfMonth, endOfMonth } = getPeriodDates(currentPeriod);
    console.log(`Loading all transactions from ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}`);
    loadTransactions(startOfMonth, endOfMonth).then(transactions => {
      for (const transaction of transactions) {
        if (!categoryExpensesMap.has(transaction.category_id)) {
          categoryExpensesMap.set(transaction.category_id, []);
        }
        categoryExpensesMap.get(transaction.category_id)!.push(transaction);
      }
      showCategoryTransactions(categoryId);
    }).catch(error => {
      console.error('Error loading transactions:', error);
    });
  } else {
    showCategoryTransactions(categoryId);
  }
}
window.loadCategoryTransactions = loadCategoryTransactions;

function getSubcategoryTransactions(category: any, transactions: Array<any>) {
  if (category.children) {
    for (const subcategory of category.children) {
      const subcategoryTransactions = categoryExpensesMap.get(subcategory.id) || [];
      transactions.push(...subcategoryTransactions);
      getSubcategoryTransactions(subcategory, transactions);
    }
  }
}

function showCategoryTransactions(categoryId: number) {
  const category = categoryMap.get(categoryId);
  if (!category) {
    console.error(`Category with ID ${categoryId} not found.`);
    return;
  }
  const transactions = [...categoryExpensesMap.get(categoryId) || []];
  getSubcategoryTransactions(category, transactions);
  transactions.sort((a, b) => a.date.localeCompare(b.date));
  const modalContent = document.getElementById('transactions-modal-content');
  if (modalContent) {
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
          <tr><th scope="col">Date</th><th scope="col">Category</th><th scope="col">Payee</th><th scope="col">Amount (${userInfo?.primary_currency?.toUpperCase()})</th></tr>
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
        amountCell.textContent = `${transaction.to_base.toFixed(2)}`;
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
}

function plotTreeMap(dataArray: Array<any>, dataDetails: Array<any>) {
  console.log('Data array for treemap:', dataArray);
  console.log('Data details for treemap:', dataDetails);

  function showStaticTooltip(row:number, size:number, value:number) {
    function htmlDetails(details:any) {
      if (!details || !details.totals) {
        return '';
      }
      var html = '<ul>';
      for (const [key, value] of Object.entries(details.totals)) {
        html += `<li>${key}: $${value}</li>`;
      }
      html += '</ul>';
      return html;
    }
    var budgetPct = undefined;
    if (dataDetails[row] && dataDetails[row].totals) {
      budgetPct = calculateBudgetPct(dataDetails[row]);
    }
    if (budgetPct !== undefined) {
      budgetPct = budgetPct * 100;
    }

    return '<div id="treemap-tooltip">' +
          '<span><b>' + data.getValue(row, 0) + '</b></span><br>' +
          '<span> $' + size.toFixed(2) + ' (' + (budgetPct !== undefined ? budgetPct.toFixed(0) + '% of budget' : 'no budget for this category') + ')</span><br>' +
          // '<div>' + htmlDetails(dataDetails[row]) + '</div>' +
          '<span><a href="#" onclick="loadCategoryTransactions(' + dataDetails[row].category_id + ')">Show transactions</a></span>' +
          '</div>';
  }

  var data = google.visualization.arrayToDataTable(dataArray)
  var element = document.getElementById('chart-div');
  if (element) {
    var tree = new google.visualization.TreeMap(element);
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
      // maxDepth: 1,
      // maxPostDepth: 2,
      generateTooltip: showStaticTooltip,
      useWeightedAverageForAggregation: true
    } as any);
  }
}



