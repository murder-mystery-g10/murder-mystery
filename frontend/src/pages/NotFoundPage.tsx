import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main>
      <h1>Pagina nu există</h1>
      <Link to="/">Înapoi la început</Link>
    </main>
  )
}
