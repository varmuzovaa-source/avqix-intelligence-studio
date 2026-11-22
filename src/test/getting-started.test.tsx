import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GettingStarted } from '@/components/analytics/getting-started';

describe('AVQIX onboarding', () => {
  it('guides a new user through client, goals, data and tasks without requiring live connections', () => {
    const html = renderToStaticMarkup(<GettingStarted />);
    expect(html).toContain('Začněte pracovat i bez připojených účtů');
    expect(html).toContain('Bez živé synchronizace');
    for (const path of ['/klienti', '/cile', '/search-console', '/ukoly']) {
      expect(html).toContain('href="' + path + '"');
    }
    expect(html).toContain('Data se zatím ukládají lokálně');
  });
});
