import { transformFilter } from "./src/components/atomic-crm/providers/fakerest/internal/transformFilter";

// Test the transformFilter function
const test1 = transformFilter({
  company_id: 1,
  id: { $ne: 2 },
});

console.log("Test 1 - $ne operator:", test1);

const test2 = transformFilter({
  contact_id: { $in: [1, 2, 3] },
});

console.log("Test 2 - $in operator:", test2);

const test3 = transformFilter({
  company_id: 1,
  id: { $ne: 2 },
  contact_id: { $in: [1, 2, 3] },
});

console.log("Test 3 - Both operators:", test3);
