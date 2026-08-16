import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rutina personalizada online | PyMes Sistemas",
  description: "Rutina personalizada, seguimiento y reuniones con un profesor para entrenar en gimnasio, casa o al aire libre.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function PersonalizedRoutineLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
