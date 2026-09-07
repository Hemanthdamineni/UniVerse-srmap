import { Navigate } from "react-router-dom";

// B3 / T5.3.2 — the retired per-type career routes now redirect to the one
// discovery page (`/career/opportunities`) with the type pre-applied as a
// `?type=` filter, so old links and bookmarks don't hit the 404 page.
const CAREER_TYPE_REDIRECTS: Record<string, string> = {
  "/career/jobs": "job",
  "/career/internships": "internship",
  "/career/hackathons": "hackathon",
  "/career/competitions": "competition",
};

export const careerRedirectRoutes = Object.entries(CAREER_TYPE_REDIRECTS).map(([from, type]) => ({
  path: from,
  element: <Navigate to={`/career/opportunities?type=${type}`} replace />,
}));
