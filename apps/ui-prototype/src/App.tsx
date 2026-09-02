import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { VariantA } from "./variants/VariantA";
import { VariantC } from "./variants/VariantC";
import type { Screen } from "./mockData";

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 761px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    const update = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

// Selected direction: A on desktop and C on mobile, with one shared navigation state.
export function App() {
  const isDesktop = useDesktopLayout();
  const [screen, setScreen] = useState<Screen>(() => {
    const value = new URLSearchParams(window.location.search).get("screen");
    return value === "sales" || value === "inventory" || value === "debts" ? value : "dashboard";
  });

  const changeScreen = (next: Screen) => {
    if (next === screen) return;
    const update = () => {
      flushSync(() => setScreen(next));
      const url = new URL(window.location.href);
      url.searchParams.set("screen", next);
      window.history.replaceState({}, "", url);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.startViewTransition(update);
    } else {
      update();
    }
  };
  const props = { screen, onScreenChange: changeScreen };

  return (
    <div className="app-stage" data-layout={isDesktop ? "desktop-a" : "mobile-c"}>
      <div className="route-transition" key={`${isDesktop ? "a" : "c"}-${screen}`}>
        {isDesktop ? <VariantA {...props} /> : <VariantC {...props} />}
      </div>
    </div>
  );
}
