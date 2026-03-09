import { describe, it } from 'vitest';

describe('projection calculation utility', () => {
  it.todo('sufficient history (N≥5): returns estimated date with correct confidence label');
  it.todo('insufficient history (N=1): returns confidence: "low"');
  it.todo('no history (N=0): returns null or confidence: "insufficient"');
  it.todo('announced date present: returns announced date with confidence: "announced", ignores formula');
  it.todo('LTS projection uses N=3, not N=5');
  it.todo('average interval calculation is correct (sum of gaps / count)');
});
