import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./shell.css";
import "./vvic-overrides.css";
import "./easy-lean-overrides.css";
import "./easy-lean-title-position.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
