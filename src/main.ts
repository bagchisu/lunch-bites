import './style.css'

export interface UserInfo {
  budget_name?: string;
  primary_currency?: string;
  [key: string]: any;
}

export interface CapabilityContext {
  accessToken: string;
  userInfo: UserInfo;
  getInfo: (endpoint: string) => Promise<any>;
}

const API_URL = 'https://api.lunchmoney.dev/v2';
const ME_ENDPOINT = '/me';
const TOKEN_STORAGE_KEY = 'lunch-bites.access-token';
const capabilityName = document.body.dataset.capability;
const requiresCapabilityAuth = capabilityName === 'expenses-treemap';
const modal = document.getElementById('apiKeyModal') as HTMLDialogElement | null;
const apiKeyForm = document.getElementById('apiKeyForm') as HTMLFormElement | null;
const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement | null;
const apiKeyError = document.getElementById('apiKeyError');
const saveBtn = document.getElementById('saveBtn');
const updateBtn = document.getElementById('updateBtn');
const budgetName = document.getElementById('budget-name');

let accessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
let isAuthenticated = false;

export async function getInfo(accessToken: string, endpoint: string): Promise<any> {
  const requestUrl = `${API_URL}${endpoint}`;
  const response = await fetch(requestUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Error accessing ${requestUrl}: ${response.status} - ${response.statusText}`);
  }
  return response.json();
}

async function loadAllData() {
  const enteredToken = apiKeyInput?.value.trim() || '';
  if (!enteredToken) {
    modal?.showModal();
    return;
  }

  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.disabled = true;
  }
  if (apiKeyError) {
    apiKeyError.textContent = '';
  }

  let userInfo: UserInfo;
  try {
    userInfo = await getInfo(enteredToken, ME_ENDPOINT);
  } catch (error) {
    if (apiKeyError) {
      apiKeyError.textContent = 'Unable to verify this API key. Check the key and try again.';
    }
    console.error('Error loading user data:', error);
    if (!modal?.open) {
      modal?.showModal();
    }
    if (saveBtn instanceof HTMLButtonElement) {
      saveBtn.disabled = false;
    }
    return;
  }

  accessToken = enteredToken;
  isAuthenticated = true;
  sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  if (budgetName) {
    budgetName.textContent = userInfo.budget_name || '';
  }
  modal?.close();

  const context: CapabilityContext = {
    accessToken,
    userInfo,
    getInfo: (endpoint) => getInfo(accessToken, endpoint),
  };

  if (requiresCapabilityAuth) {
    try {
      const { initializeExpensesTreemap } = await import('./expenses_treemap');
      await initializeExpensesTreemap(context);
    } catch (error) {
      console.error('Error loading Expenses Treemap:', error);
    }
  }
  if (saveBtn instanceof HTMLButtonElement) {
    saveBtn.disabled = false;
  }
}

apiKeyForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  void loadAllData();
});

updateBtn?.addEventListener('click', () => {
  modal?.showModal();
});

modal?.addEventListener('cancel', (event) => {
  if (!isAuthenticated) {
    event.preventDefault();
  }
});

if (apiKeyInput) {
  apiKeyInput.value = accessToken;
}
modal?.showModal();
if (accessToken) {
  void loadAllData();
}