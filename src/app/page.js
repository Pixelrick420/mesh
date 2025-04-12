// page.js (root page)
"use client";
import { useState } from "react";
import ResetPasswordPage from "./reset-password/page";
import LoginPage from "./login/page";
import SignupPage from "./signup/page";
import CanvasPage from "./canvas/page";

export default function Home() {
  const [currentPage, setCurrentPage] = useState("login");

  const renderPage = () => {
    switch (currentPage) {
      case "signup":
        return <SignupPage />;
      case "reset-password":
        return <ResetPasswordPage />;
      case "login":
        return <LoginPage />;
      case "canvas":
        return <CanvasPage />;
    }
  };

  return <main>{renderPage()}</main>;
}
