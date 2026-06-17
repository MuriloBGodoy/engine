import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export function DashboardPage({ cars = [] }) {
  const { t } = useTranslation();

  const chartData = useMemo(
    () =>
      cars
        .map((car) => ({
          name: `${car.brand} ${car.model}`,
          value: car.targetValue
            ? Math.round((car.savedValue / car.targetValue) * 100)
            : 0,
        }))
        .sort((a, b) => a.value - b.value),
    [cars],
  );

  const option = {
    backgroundColor: "transparent",
    grid: { top: 10, bottom: 30, left: 150, right: 80 },
    xAxis: {
      max: 100,
      splitLine: { show: false },
      axisLabel: { color: "#666" },
    },
    yAxis: {
      type: "category",
      data: chartData.map((d) => d.name),
      inverse: true,
      animationDuration: 300,
      animationDurationUpdate: 300,
      axisLabel: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "bold",
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        realtimeSort: true,
        name: t("dashboard.progress"),
        type: "bar",
        data: chartData.map((d) => d.value),
        label: {
          show: true,
          position: "right",
          valueAnimation: true,
          color: "#fff",
          formatter: "{c}%",
        },
        itemStyle: {
          color(params) {
            return params.value >= 100 ? "#22c55e" : "#dc2626";
          },
          borderRadius: [0, 10, 10, 0],
        },
      },
    ],
    animationDuration: 2000,
    animationDurationUpdate: 2000,
    animationEasing: "linear",
    animationEasingUpdate: "linear",
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-5xl font-black uppercase italic tracking-tight text-slate-950 dark:text-white">
            {t("dashboard.title")}
          </h1>
          <p className="mt-2 font-medium text-gray-500 dark:text-gray-400">
            {t("dashboard.subtitle")}
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-gray-200 bg-white p-8 shadow-2xl dark:border-[#222] dark:bg-[#111]">
        <div
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {chartData.length > 0 ? (
          <ReactECharts option={option} style={{ height: "500px" }} />
        ) : (
          <div className="flex h-[500px] items-center justify-center text-gray-500 italic">
            {t("dashboard.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
