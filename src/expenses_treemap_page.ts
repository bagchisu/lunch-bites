import { startApplication } from './main';
import pageHtml from './pages/expenses_treemap.html?raw';
import { initializeExpensesTreemap } from './expenses_treemap';

startApplication(pageHtml, initializeExpensesTreemap);
