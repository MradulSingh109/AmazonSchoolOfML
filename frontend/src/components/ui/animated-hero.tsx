import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MoveRight, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["intelligent", "algorithmic", "optimized", "regime-aware", "predictive"],
    []
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full text-white relative z-10">
      <div className="container mx-auto">
        <div className="flex gap-6 py-12 md:py-16 items-center justify-center flex-col">
          <div>
            {/* <Button variant="secondary" size="sm" className="gap-4 bg-white/10 hover:bg-white/20 text-white border border-white/10">
              Read our launch article <MoveRight className="w-4 h-4" />
            </Button> */}
          </div>
          <div className="flex gap-4 flex-col items-center">
            <h1 className="text-4xl md:text-6xl max-w-3xl tracking-tighter text-center font-bold">
              <span className="text-white drop-shadow-md">Trade with Tech that is</span>
              <span className="relative flex w-full justify-center overflow-hidden text-center h-16 md:h-20 pt-2 text-white-400">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className="absolute font-extrabold"
                    initial={{ opacity: 0, y: -40 }}
                    transition={{ type: "spring", stiffness: 100, damping: 15 }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? -60 : 60,
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>

            <p className="text-base md:text-lg leading-relaxed tracking-tight text-zinc-300 max-w-2xl text-center drop-shadow">
              {/* Build, optimize, and backtest state-of-the-art machine learning pipelines and mathematical 
              intraday strategies. Eliminate cognitive bias and run simulations with active risk management. */}
            </p>
          </div>
          <div className="flex flex-row gap-3 mt-4">
            {/* <Button size="lg" className="gap-4 bg-transparent text-white border-white/20 hover:bg-white/10" variant="outline">
              Jump on a call <PhoneCall className="w-4 h-4" />
            </Button> */}
            <Button size="lg" variant="outline" className="gap-4 font-semibold inline-flex items-center justify-center bg-black text-white hover:bg-white hover:text-black border-zinc-800 hover:border-white transition-all duration-300 rounded-full">
              Sign up
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
