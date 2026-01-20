import { useEffect } from "react";
import "./Pages.css";

declare global {
  interface Window {
    blogbott_initializePage?: () => void;
  }
}

export default function Blog() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://blogbott.com/aiblog.js";
    script.async = true;

    script.onload = () => {
      if (typeof window.blogbott_initializePage === "function") {
        window.blogbott_initializePage();
      } else {
        console.error(
          "BlogBott script loaded, but window.blogbott_initializePage() is undefined"
        );
      }
    };

    script.onerror = () =>
      console.error("Failed to load https://blogbott.com/aiblog.js");

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <div className="page-container">
      <div id="blogbott.com_app" />
    </div>
  );
}
