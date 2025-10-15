"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "./Navbar";

export default function ConditionalNavbar() {
  const pathname = usePathname();
  const [isLaptop, setIsLaptop] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLaptop(window.innerWidth >= 1024); // lg breakpoint
    };

    // Check on mount
    checkScreenSize();

    // Add event listener for resize
    window.addEventListener('resize', checkScreenSize);

    // Cleanup
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Hide navbar on /chats page for laptop view only
  if (pathname === '/chats' && isLaptop) {
    return null;
  }

  return <Navbar />;
}
