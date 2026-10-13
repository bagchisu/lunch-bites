import './style.css'
import appShell from './app-shell.html?raw';
import { capabilityCatalog } from './capability-catalog';
import type { CapabilityContext, UserInfo } from './capability';

const API_URL = 'https://api.lunchmoney.dev/v2';
const ME_ENDPOINT = '/me';
const TOKEN_STORAGE_KEY = 'lunch-bites.access-token';

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

export function startApplication(
  pageHtml?: string,
  initializeCapability?: (context: CapabilityContext) => Promise<void> | void,
): void {
  const applicationRoot = document.getElementById('application-root');
  if (!applicationRoot) {
    throw new Error('Application page must include an element with id "application-root".');
  }
  applicationRoot.innerHTML = appShell;

  const capabilityRoot = document.getElementById('capability-root');
  if (!capabilityRoot) {
    throw new Error('The shared application shell must include an element with id "capability-root".');
  }
  const modal = document.getElementById('apiKeyModal') as HTMLDialogElement | null;
  const apiKeyForm = document.getElementById('apiKeyForm') as HTMLFormElement | null;
  const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement | null;
  const apiKeyError = document.getElementById('apiKeyError');
  const saveBtn = document.getElementById('saveBtn');
  const updateBtn = document.getElementById('updateBtn');
  const budgetName = document.getElementById('budget-name');

  let accessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
  let isAuthenticated = false;

  const capabilityNav = document.getElementById('capability-nav');
  const currentPath = window.location.pathname;
  for (const item of capabilityCatalog) {
    const link = document.createElement('a');
    link.className = 'capability-nav__item';
    link.href = item.href;

    if (item.href === currentPath) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }

    const marker = document.createElement('span');
    marker.className = 'capability-nav__marker';
    marker.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = item.title;
    link.append(marker, label);
    capabilityNav?.appendChild(link);
  }

  if (pageHtml) {
    capabilityRoot.innerHTML = pageHtml;
  } else {
    const header = document.createElement('header');
    header.className = 'app-toolbar';
    const heading = document.createElement('div');
    heading.className = 'app-heading';
    const eyebrow = document.createElement('p');
    eyebrow.className = 'app-heading__eyebrow';
    eyebrow.textContent = 'Lunch Bites';
    const title = document.createElement('h2');
    title.textContent = 'Choose a capability';
    heading.append(eyebrow, title);
    header.appendChild(heading);

    const home = document.createElement('section');
    home.className = 'capability-home';
    home.setAttribute('aria-label', 'Available capability');
    for (const item of capabilityCatalog) {
      const link = document.createElement('a');
      link.className = 'capability-launch';
      link.href = item.href;
      const marker = document.createElement('span');
      marker.className = 'capability-launch__marker';
      marker.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('span');
      copy.className = 'capability-launch__copy';
      const cardTitle = document.createElement('span');
      cardTitle.className = 'capability-launch__title';
      cardTitle.textContent = item.title;
      const description = document.createElement('span');
      description.className = 'capability-launch__description';
      description.textContent = item.description;
      copy.append(cardTitle, description);

      const arrow = document.createElement('span');
      arrow.className = 'capability-launch__arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      link.append(marker, copy, arrow);
      home.appendChild(link);
    }
    capabilityRoot.append(header, home);
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

    if (initializeCapability) {
      try {
        await initializeCapability(context);
      } catch (error) {
        console.error('Error initializing capability:', error);
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
}