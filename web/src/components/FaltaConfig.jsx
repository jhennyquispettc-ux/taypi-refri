// Se muestra si faltan variables de entorno al compilar / desplegar
export function FaltaConfig({ variables }) {
  return (
    <main className="centrado">
      <section className="tarjeta tarjeta-login">
        <h1>Falta configuración</h1>
        <p>La aplicación no puede iniciar porque faltan estas variables de entorno:</p>
        <ul className="lista-variables">
          {variables.map((v) => <li key={v}><code>{v}</code></li>)}
        </ul>
        <p className="nota">
          En local, copia <code>.env.example</code> como <code>.env</code> y completa los valores.
          En Vercel, agrégalas en <em>Settings → Environment Variables</em> y vuelve a desplegar.
        </p>
      </section>
    </main>
  );
}
