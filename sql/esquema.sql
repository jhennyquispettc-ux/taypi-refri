-- =====================================================================
-- Taypi Refri v2 - Esquema PostgreSQL (Supabase usado solo como base de datos)
-- Ejecutar completo en el SQL Editor de Supabase.
-- El backend Express se conecta directo con el usuario postgres.
-- =====================================================================

-- Usuarios: se crean en su primer login con Google
create table usuarios (
  id          serial primary key,
  google_sub  text not null unique,           -- id de la cuenta de Google
  email       text not null unique,
  nombre      text not null,
  foto_url    text,
  rol         text not null default 'cliente' check (rol in ('cliente', 'admin')),
  creado_en   timestamptz not null default now()
);

-- Cuenta del día: una por usuario y por fecha (hora de Bolivia)
create table cuentas (
  id          serial primary key,
  usuario_id  int not null references usuarios (id),
  fecha       date not null,
  bebidas     int not null default 0 check (bebidas >= 0),
  pagada      boolean not null default false,
  pagada_en   timestamptz,
  creado_en   timestamptz not null default now(),
  unique (usuario_id, fecha)
);

-- Turnos: quién usa el refrigerador. También es el registro de cada uso.
--   pendiente -> pidió abrir, tiene 10 s para abrir la puerta
--   abierto   -> la puerta se abrió (usuario_id null = abierto sin turno)
--   cerrado   -> la puerta se cerró y se aplicó el cambio a la cuenta
--   expirado  -> no abrió a tiempo
--   liberado  -> un admin lo canceló a la fuerza
create table turnos (
  id                serial primary key,
  usuario_id        int references usuarios (id),
  cuenta_id         int references cuentas (id),
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente', 'abierto', 'cerrado', 'expirado', 'liberado')),
  creado_en         timestamptz not null default now(),
  expira_en         timestamptz,
  abierto_en        timestamptz,
  cerrado_en        timestamptz,
  botellas_inicio   int,                   -- botellas al abrir la puerta
  botellas_corte    int,                   -- última cantidad ya cobrada (apertura o corte de 2 min)
  botellas_fin      int,                   -- botellas al cerrar
  retiradas         int not null default 0, -- total neto: + sacó, − devolvió/repuso
  corte_automatico  boolean not null default false
);
-- El bloqueo: un solo turno activo a la vez
create unique index turnos_un_activo on turnos ((true)) where estado in ('pendiente', 'abierto');

-- Historial del ESP32 (cada 1 s) para el dashboard
create table lecturas (
  id              bigserial primary key,
  botellas        int,
  temperatura     numeric(5, 2),
  humedad         numeric(5, 2),
  puerta_abierta  boolean not null,
  creado_en       timestamptz not null default now()
);
create index lecturas_creado_en on lecturas (creado_en desc);

-- Supabase expone el esquema public por su API REST con la anon key.
-- Activamos RLS sin políticas: nadie entra por ahí, solo el backend
-- (el usuario postgres es dueño de las tablas y no queda restringido).
alter table usuarios enable row level security;
alter table cuentas  enable row level security;
alter table turnos   enable row level security;
alter table lecturas enable row level security;

-- Primer administrador: entra una vez con Google en la web y luego ejecuta:
-- update usuarios set rol = 'admin' where email = 'tu-correo@gmail.com';
