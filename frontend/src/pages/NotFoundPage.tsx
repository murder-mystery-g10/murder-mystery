import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="landing-container text-center">
      <h1>Page not found</h1>
      <p>The clue you are looking for is not here.</p>
      <Link to="/" className="btn btn-secondary">
        Back to home
      </Link>
    </main>
  )
}
