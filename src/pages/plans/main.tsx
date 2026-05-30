import React from "react";
import ReactDOM from "react-dom/client";
import "@cloudscape-design/global-styles/index.css";
import "../../styles/tokens.css";
import App from "./app";

const container = document.getElementById("root");
if (!container) throw new Error("root element not found");
const root = ReactDOM.createRoot(container);
root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
