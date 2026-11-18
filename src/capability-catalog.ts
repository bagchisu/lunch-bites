export interface CapabilityLink {
  title: string;
  href: string;
  description: string;
}

const base = import.meta.env.BASE_URL;

export const capabilityCatalog: CapabilityLink[] = [
  {
    title: 'Expenses Treemap',
    href: `${base}expenses_treemap.html`,
    description: 'Explore category spending and budget usage.',
  },
  {
    title: 'Cash Flow',
    href: `${base}cash_flow.html`,
    description: 'A view of upcoming income and expenses in cash accounts.',
  },
];
