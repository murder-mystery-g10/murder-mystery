import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="landing-container text-center">
      <h1>Pagină inexistentă</h1>
      <p>Indiciul pe care îl cauți nu se află aici.</p>
      <Link to="/" className="btn btn-secondary">
        Înapoi la pagina principală
      </Link>
    </main>
  )
}
