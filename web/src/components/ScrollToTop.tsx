import { useEffect } from "react";
import { useLocation } from "react-router";

/** Reset scroll on page change and jump to a #hash target when there is one. */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}
