export interface CapabilityLink {
  title: string;
  href: string;
  description: string;
}

export const capabilityCatalog: CapabilityLink[] = [
  {
    title: 'Expenses Treemap',
    href: '/expenses_treemap.html',
    description: 'Explore category spending and budget usage.',
  },
  {
    title: 'Cash Flow',
    href: '/cash_flow.html',
    description: 'A view of upcoming income and expenses in cash accounts.',
  },
];
