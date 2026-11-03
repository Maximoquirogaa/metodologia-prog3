import { test, expect } from '@playwright/test';

test.describe('agenda privada (E2E)', () => {
  // Mock de las respuestas de la API del backend (C-06 pendiente → mock de DELETE)
  test.use({
    // Se configura por test con page.route()
  });

  test('login secretaria → agenda del día visible en <3 clics', async ({ page }) => {
    // Intercepta POST /api/auth/login → devuelve token de secretaria
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'tok-secretaria',
          token_type: 'Bearer',
          expires_in: 900,
          user: {
            id: 'u-secretaria',
            tenant_id: 't-1',
            rol: 'secretaria',
            email: 'secretaria@demo.test',
          },
        }),
      });
    });

    // Intercepta GET /api/agenda → devuelve turnos del día
    await page.route('**/api/agenda*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fecha: '2026-11-09',
          odontologoId: null,
          turnos: [
            {
              id: 't-1',
              inicio: '2026-11-09T09:00:00-03:00',
              fin: '2026-11-09T09:30:00-03:00',
              estado: 'reservado',
              paciente: { id: 'p-1', nombre: 'Ana Gómez', telefono: '1144556677' },
              odontologo: { id: 'o-1', nombre: 'Dr. López' },
            },
            {
              id: 't-2',
              inicio: '2026-11-09T12:00:00-03:00',
              fin: '2026-11-09T12:30:00-03:00',
              estado: 'atendido',
              paciente: { id: 'p-2', nombre: 'Luis Pérez', telefono: '2233445566' },
              odontologo: { id: 'o-1', nombre: 'Dr. López' },
            },
          ],
        }),
      });
    });

    // Clic 1: ir a /login (la app redirige a /login por defecto)
    await page.goto('/login');

    // Clic 2: completar email
    await page.fill('[data-testid="email-input"]', 'secretaria@demo.test');

    // Clic 3: completar password
    await page.fill('[data-testid="password-input"]', 'clave123');

    // Clic 4: iniciar sesión → redirige a /agenda
    await page.click('[data-testid="login-button"]');

    // Verifica que la agenda es visible (título de la agenda)
    await expect(page.locator('[data-testid="agenda-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="turno-t-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="turno-t-2"]')).toBeVisible();
  });

  test('login odontólogo → solo su agenda (no ve la de otros)', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'tok-odontologo',
          token_type: 'Bearer',
          expires_in: 900,
          user: {
            id: 'u-odontologo',
            tenant_id: 't-1',
            rol: 'odontologo',
            email: 'odontologo@demo.test',
          },
        }),
      });
    });

    await page.route('**/api/agenda*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fecha: '2026-11-09',
          odontologoId: 'o-1',
          turnos: [
            {
              id: 't-1',
              inicio: '2026-11-09T09:00:00-03:00',
              fin: '2026-11-09T09:30:00-03:00',
              estado: 'reservado',
              paciente: { id: 'p-1', nombre: 'Ana Gómez', telefono: '1144556677' },
              odontologo: { id: 'o-1', nombre: 'Dr. López' },
            },
          ],
        }),
      });
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'odontologo@demo.test');
    await page.fill('[data-testid="password-input"]', 'clave123');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="agenda-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="turno-t-1"]')).toBeVisible();

    // El odontólogo no debe ver el filtro de odontólogo (es para secretaria)
    await expect(page.locator('[data-testid="odontologo-filter"]')).not.toBeVisible();
  });

  test('anónimo en /agenda → redirect a /login', async ({ page }) => {
    await page.goto('/agenda');

    // Debe redirigir a /login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });
});
