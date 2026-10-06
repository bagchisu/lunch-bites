# Lunch Bites

Experimental utilities using the [Lunch Money API](https://lunchmoney.dev/v2/docs).

## Tree map of expenses

Lunch Money organizes expenses into hierarchical [categories](https://lunchmoney.app/features/categories-tags) and there may be [budgets](https://lunchmoney.app/features/budgeting/) associated with them. A [Tree map](https://en.wikipedia.org/wiki/Treemapping) helps to visualize the amount spent in each category as rectangles whose areas are in proportion to the total, allowing for drilling down the category hierarchy. In addition, it also allows for coloring the rectangles based on the portion of the budget spent in each category.

![treemap example](./docs/treemap.png)

## Getting started

[Install Node.js](https://nodejs.org/en/download) and clone this repo. Then run locally using `npm run dev`. A [Lunch Money access token](https://my.lunchmoney.app/developers) is required.

That's it for now! Stay tuned for other utilities.
