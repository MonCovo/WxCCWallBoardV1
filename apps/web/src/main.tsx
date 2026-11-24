import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IconProvider } from "@momentum-design/components/react";
import "@momentum-design/fonts/dist/css/fonts.css";
import "@momentum-design/tokens/dist/css/typography/complete.css";
import "@momentum-design/tokens/dist/css/components/complete.css";
import "@momentum-design/tokens/dist/css/elevation/complete.css";
import "@momentum-design/tokens/dist/css/motion/complete.css";
/* Stable + high-contrast Webex themes (accents included). */
import "@momentum-design/tokens/dist/css/theme/webex/dark-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/light-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/dark-indigo-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/light-indigo-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/dark-jade-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/light-jade-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/dark-bronze-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/light-bronze-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/dark-rose-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/light-rose-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/dark-lavender-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/light-lavender-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/hc-dark-stable.css";
import "@momentum-design/tokens/dist/css/theme/webex/hc-light-stable.css";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <IconProvider iconSet="momentum-icons">
      <App />
    </IconProvider>
  </StrictMode>,
);
