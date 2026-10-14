import './cash_flow.css';
import { startApplication } from './main';

const pageTemplate = document.getElementById('capability-page') as HTMLTemplateElement | null;
if (!pageTemplate) {
	throw new Error('Cash Flow page must include a "capability-page" template.');
}

startApplication(pageTemplate.innerHTML);