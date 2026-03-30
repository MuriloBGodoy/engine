import ReactECharts from "echarts-for-react";
import { useEffect, useState } from "react";
import { engineDB } from "../services/db";

export function DashboardPage() {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const cars = await engineDB.getCars();
      const formatted = cars
        .map((car) => ({
          name: `${car.brand} ${car.model}`,
          value: Math.round((car.savedValue / car.targetValue) * 100),
        }))
        .sort((a, b) => a.value - b.value);

      setChartData(formatted);
    };
    loadData();
  }, []);

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
        name: "Progresso",
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
          color: function (params) {
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
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white">
            Performance <span className="text-red-600">Garagem</span>
          </h1>
          <p className="text-gray-400 mt-2 font-medium">
            Acompanhe a corrida rumo aos seus objetivos.
          </p>
        </div>
      </div>

      <div className="bg-[#111] p-8 rounded-[2rem] border border-[#222] shadow-2xl relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            size: "20px 20px",
          }}
        ></div>

        {chartData.length > 0 ? (
          <ReactECharts option={option} style={{ height: "500px" }} />
        ) : (
          <div className="h-[500px] flex items-center justify-center text-gray-500 italic">
            Nenhum carro na garagem para iniciar a corrida...
          </div>
        )}
      </div>
    </div>
  );
}
