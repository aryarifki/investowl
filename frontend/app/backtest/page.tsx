import { redirect } from "next/navigation";

export default function BacktestPage() {
  redirect("/signal?tab=backtest");
}

