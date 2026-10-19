import './cash_flow.css';
import { startApplication } from './main';
import type { CapabilityContext } from './capability';

let appContext: CapabilityContext;

const PLAID_ACCOUNTS_ENDPOINT = '/plaid_accounts';
const MANUAL_ACCOUNTS_ENDPOINT = '/manual_accounts';
const RECURRING_ITEMS_ENDPOINT = '/recurring_items';
const TIME_HORIZON_DAYS = 30;
const MINIMUM_BALANCES_STORAGE_KEY = 'cash-flow-minimum-balances';
const cashAccounts = new Map<number, any>();
const minimumBalances = loadMinimumBalances();

function loadMinimumBalances(): Map<number, number> {
  try {
    const storedBalances = JSON.parse(localStorage.getItem(MINIMUM_BALANCES_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    const balances = new Map<number, number>();
    for (const [accountId, amount] of Object.entries(storedBalances)) {
      const numericAccountId = Number(accountId);
      if (Number.isSafeInteger(numericAccountId) && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) {
        balances.set(numericAccountId, amount);
      }
    }
    return balances;
  } catch {
    return new Map<number, number>();
  }
}

function saveMinimumBalances() {
  localStorage.setItem(MINIMUM_BALANCES_STORAGE_KEY, JSON.stringify(Object.fromEntries(minimumBalances)));
}

async function initializeCashAccounts() {
  const plaidAccounts = await appContext.getInfo(PLAID_ACCOUNTS_ENDPOINT);
  for (const account of plaidAccounts['plaid_accounts'].filter((account: any) => account.type === 'cash')) {
    cashAccounts.set(account.id, account);
  }
  const manualAccounts = await appContext.getInfo(MANUAL_ACCOUNTS_ENDPOINT);
  for (const account of manualAccounts['manual_accounts'].filter((account: any) => account.type === 'cash')) {
    cashAccounts.set(account.id, account);
  }
  console.debug('Cash accounts:', cashAccounts);
}

async function loadRecurringItems(horizonDays: number): Promise<Map<number, any[]>> {
  const today = new Date();
  const horizonDate = new Date(today.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const recurringItems = await appContext.getInfo(`${RECURRING_ITEMS_ENDPOINT}?start_date=${today.toISOString().split('T')[0]}&end_date=${horizonDate.toISOString().split('T')[0]}`);
  const pendingDebits = new Map<number, any[]>();
  for (const item of recurringItems.recurring_items) {
    if (item.matches?.found_transactions.length !== 0) {
      continue;
    }
    const itemCriteria = item.transaction_criteria;
    const account = cashAccounts.get(itemCriteria.plaid_account_id || itemCriteria.manual_account_id);
    if (account) {
      let recurringItems = pendingDebits.get(account.id);
      if (recurringItems === undefined) {
        recurringItems = [];
        pendingDebits.set(account.id, recurringItems);
      }
      for (const expectedDate of item.matches!.expected_occurrence_dates) {
        recurringItems.push({
          expected_date: expectedDate,
          payee: itemCriteria.payee,
          amount: Number(itemCriteria.amount),
          currency: itemCriteria.currency,
          to_base: itemCriteria.to_base
        });
      }
    }
  }
  // sort the recurring items for each account by expected date
  for (const items of pendingDebits.values()) {
    items.sort((a, b) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime());
  }
  console.debug('Pending debits:', pendingDebits);
  return pendingDebits;
}

function showCashFlowTable(pendingDebits: Map<number, any[]>) {
  function checkConsistentLocalCurrency(items: any[], currency: string): boolean {
    for (const item of items) {
      if (item.currency !== currency) {
        return false;
      }
    }
    return true;
  }
  const accountsDiv = document.getElementById('cash-flow-results');
  if (accountsDiv) {
    accountsDiv.replaceChildren();
    for (const account of cashAccounts.values()) {
      const header = document.createElement('h3');
      header.textContent = account.display_name;
      accountsDiv.appendChild(header);
      const balanceParagraph = document.createElement('p');
      balanceParagraph.textContent = `Balance: ${Number(account.balance).toFixed(2)} ${account.currency.toUpperCase()}`;
      const primaryCurrency = appContext.userInfo?.primary_currency;
      if (primaryCurrency && account.currency !== primaryCurrency){
        balanceParagraph.textContent += ` (${Number(account.to_base).toFixed(2)} ${primaryCurrency.toUpperCase()})`;
      }
      accountsDiv.appendChild(balanceParagraph);
      const accountDebits = pendingDebits.get(account.id) ?? [];
      // use local currency if all debits are in the same currency as the account, otherwise use primary currency
      const useLocalCurrency = checkConsistentLocalCurrency(accountDebits, account.currency);
      const minimumLocalBalance = minimumBalances.get(account.id) ?? 0; // minimum balance is stored in the account's local currency
      const minimumBalanceLabel = document.createElement('label');
      minimumBalanceLabel.append(`Minimum balance (${account.currency.toUpperCase()}): `);
      const minimumBalanceInput = document.createElement('input');
      minimumBalanceInput.type = 'number';
      minimumBalanceInput.min = '0';
      minimumBalanceInput.step = '1';
      minimumBalanceInput.value = minimumLocalBalance.toString();
      minimumBalanceInput.setAttribute('aria-label', `Minimum balance for ${account.display_name}`);
      minimumBalanceInput.addEventListener('change', () => {
        if (!minimumBalanceInput.validity.valid) {
          return;
        }
        if (minimumBalanceInput.value === '') {
          minimumBalances.delete(account.id);
        } else {
          minimumBalances.set(account.id, Number(minimumBalanceInput.value));
        }
        saveMinimumBalances();
        showCashFlowTable(pendingDebits);
      });
      minimumBalanceLabel.appendChild(minimumBalanceInput);
      accountsDiv.appendChild(minimumBalanceLabel);
      const balanceConversionRate = Number(account.balance) !== 0 ? Number(account.to_base) / Number(account.balance) : undefined;
      const minimumBalanceInDisplayCurrency = useLocalCurrency
        ? minimumLocalBalance
        : balanceConversionRate === undefined ? 0 : minimumLocalBalance * balanceConversionRate;
      if (accountDebits && accountDebits.length > 0) {
        const table = document.createElement('table');
        table.classList.add('cash-flow-table');
        const headerRow = table.insertRow();
        headerRow.insertCell().textContent = 'Expected Date';
        headerRow.insertCell().textContent = 'Payee';
        headerRow.insertCell().textContent = `Amount (${useLocalCurrency ? account.currency.toUpperCase() : primaryCurrency?.toUpperCase()})`;
        headerRow.insertCell().textContent = 'Balance After';
        let balanceAfter = Number(useLocalCurrency ? account.balance : account.to_base);
        for (const debit of accountDebits) {
          balanceAfter -= useLocalCurrency ? debit.amount : Number(debit.to_base);
          const row = table.insertRow();
          row.insertCell().textContent = debit.expected_date;
          row.insertCell().textContent = debit.payee;
          row.insertCell().textContent = `${useLocalCurrency ? debit.amount.toFixed(2) : Number(debit.to_base).toFixed(2)}`;
          row.insertCell().textContent = `${Number(balanceAfter).toFixed(2)}`; // color red if negative
          row.cells[2].style.textAlign = 'right';
          row.cells[3].style.textAlign = 'right';
          if (balanceAfter < 0) {
            row.cells[3].style.color = 'red';
          } else if (balanceAfter < minimumBalanceInDisplayCurrency) {
            row.cells[3].style.color = 'orange';
          } else {
            row.cells[3].style.color = 'green';
          }
        }
        table.style.fontSize = 'smaller';
        accountsDiv.appendChild(table);
        if (balanceAfter < minimumBalanceInDisplayCurrency) {
          const replenishParagraph = document.createElement('p');
          const replenishAmount = minimumBalanceInDisplayCurrency - balanceAfter;
          replenishParagraph.innerHTML = `<strong>Minimum replenishment needed: ${replenishAmount.toFixed(2)} ${useLocalCurrency ? account.currency.toUpperCase() : primaryCurrency?.toUpperCase()}</strong>`;
          accountsDiv.appendChild(replenishParagraph);
        }
      }
    }
  }
}
export async function checkCashFlow(context: CapabilityContext) {
  appContext = context;
  await initializeCashAccounts();
  const horizonInput = document.getElementById('cash-flow-time-horizon') as HTMLInputElement;
  horizonInput.value = TIME_HORIZON_DAYS.toString();
  const updateCashFlow = async () => {
    const horizonDays = Number(horizonInput.value);
    if (!Number.isSafeInteger(horizonDays) || horizonDays <= 0) {
      horizonInput.setCustomValidity('Enter a whole number greater than 0.');
      horizonInput.reportValidity();
      return;
    }
    horizonInput.setCustomValidity('');
    const pendingDebits = await loadRecurringItems(horizonDays);
    showCashFlowTable(pendingDebits);
  };
  horizonInput.addEventListener('change', updateCashFlow);
  await updateCashFlow();
}

const pageTemplate = document.getElementById('capability-page') as HTMLTemplateElement | null;
if (!pageTemplate) {
	throw new Error('Cash Flow page must include a "capability-page" template.');
}

startApplication(pageTemplate.innerHTML, checkCashFlow);