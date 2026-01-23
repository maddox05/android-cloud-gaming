import { useEffect } from "react";
import "./ShapoWidget.css";

interface ShapoWidgetProps {
  widgetId: string;
}

export default function ShapoWidget({ widgetId }: ShapoWidgetProps) {
  useEffect(() => {
    if (!document.getElementById("shapo-embed-js")) {
      const script = document.createElement("script");
      script.id = "shapo-embed-js";
      script.src = "https://cdn.shapo.io/js/embed.js";
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  return <div id={`shapo-widget-${widgetId}`} className="shapo-widget"></div>;
}
