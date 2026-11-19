import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="empty">
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to the job board</Link>
      </p>
    </div>
  );
}
