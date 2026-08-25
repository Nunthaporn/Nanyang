import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../../apps/vvic/frontend/src/index.css";
import "../../apps/vvic/frontend/src/interactions.css";
import "../../apps/easy-lean/frontend/src/styles.css";
import "./shell.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
