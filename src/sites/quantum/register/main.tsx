import React from "react";
import ReactDOM from "react-dom/client";
import "@cloudscape-design/global-styles/index.css";
import App from "./app";

const container = document.getElementById("root");
if (!container) throw new Error("root element not found");
ReactDOM.createRoot(container).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
