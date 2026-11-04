import express from 'express';
import { createAuthRouter } from '../app/http/auth-routes.js';
import { createReservaRouter } from '../app/http/reserva-routes.js';
import { createAgendaRouter } from '../app/http/agenda-routes.js';

export function createApp({
  userRepository,
  tenantRepository,
  odontologoRepository,
  pacienteRepository,
  turnoRepository,
  now,
} = {}) {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.use('/api/auth', createAuthRouter({ userRepository, tenantRepository }));
  app.use(
    '/api',
    createAgendaRouter({ userRepository, odontologoRepository, turnoRepository })
  );
  app.use(
    '/api',
    createReservaRouter({
      tenantRepository,
      odontologoRepository,
      pacienteRepository,
      turnoRepository,
      now,
    })
  );
  return app;
}

const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== 'test') {
  const app = createApp();
  app.listen(port, () => {
    console.log(`backend listening on ${port}`);
  });
}
