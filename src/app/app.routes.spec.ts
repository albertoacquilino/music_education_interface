import { routes } from './app.routes';

describe('activity routes', () => {
  it('exposes independent PLP and target-intonation route launches', async () => {
    const home = routes.find(route => route.path === 'home');
    const exercise = home?.children?.find(route => route.path === 'exercise');
    const intonation = home?.children?.find(route => route.path === 'intonation');

    expect(exercise).toBeDefined();
    expect(intonation).toBeDefined();
    expect(await intonation?.loadComponent?.())
      .toBeDefined();
  });
});
